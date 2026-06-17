import { Router } from "express";
import Reservation from "../models/Reservation.js";
import Client from "../models/client.js";
import Product from "../models/product.js";
import { authenticateAdmin, authenticateToken } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();

// Helper: populate client + product for frontend
const populate = (query) =>
  query
    .populate("clientId", "name email phone company")
    .populate("productId", "name price image category");

const formatRes = (r) => {
  const obj = r.toJSON ? r.toJSON() : r;
  obj.client  = obj.clientId;
  obj.product = obj.productId;
  delete obj.clientId;
  delete obj.productId;
  return obj;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/reservations";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + file.originalname;
    cb(null, unique);
  },
});

const upload = multer({ storage });

router.post("/:id/files", authenticateAdmin , upload.array("files", 10), async (req, res) => {
  try {
    const r = await Reservation.findById(req.params.id);
    if (!r) return res.status(404).json({ error: "Réservation introuvable" });

    const newFiles = req.files.map((f) => ({
      originalName: f.originalname,
      filename: f.filename,
      mimetype: f.mimetype,
      size: f.size,
      url: `/uploads/reservations/${f.filename}`,
      uploadedAt: new Date(),
    }));

    r.files = [...(r.files || []), ...newFiles];
    await r.save();
    res.json(r.files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/reservations/:id/files/:filename
router.delete("/:id/files/:filename", authenticateAdmin , async (req, res) => {
  try {
    const r = await Reservation.findById(req.params.id);
    if (!r) return res.status(404).json({ error: "Réservation introuvable" });

    r.files = (r.files || []).filter((f) => f.filename !== req.params.filename);
    await r.save();

    const filePath = path.join("uploads/reservations", req.params.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ message: "Fichier supprimé" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});













// GET /api/reservations/stats/summary  ← must be before /:id
router.get("/stats/summary", authenticateAdmin , async (req, res) => {
  try {
    const [total, pending, confirmed, completed, cancelled, revenueData] = await Promise.all([
      Reservation.countDocuments(),
      Reservation.countDocuments({ status: "pending" }),
      Reservation.countDocuments({ status: "confirmed" }),
      Reservation.countDocuments({ status: "completed" }),
      Reservation.countDocuments({ status: "cancelled" }),
      Reservation.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$totalPrice" } } },
      ]),
    ]);

    res.json({
      total, pending, confirmed, completed, cancelled,
      revenue: revenueData[0]?.total || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/mine", authenticateToken, async (req, res) => {
  try {
    const reservations = await populate(
      Reservation.find({ clientId: req.user.id }).sort({ createdAt: -1 })
    );
    res.json(reservations.map(formatRes));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}); 
// GET /api/reservations
router.get("/", authenticateAdmin , async (req, res) => {
  try {
    const { status, clientId, productId } = req.query;
    const filter = {};
    if (status)    filter.status = status;
    if (clientId)  filter.clientId = clientId;
    if (productId) filter.productId = productId;

    const reservations = await populate(Reservation.find(filter).sort({ createdAt: -1 }));
    res.json(reservations.map(formatRes));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reservations/:id
router.get("/:id", authenticateAdmin , async (req, res) => {
  try {
    const r = await populate(Reservation.findById(req.params.id));
    if (!r) return res.status(404).json({ error: "Réservation introuvable" });
    res.json(formatRes(r));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reservations  (admin)
router.post("/", authenticateAdmin , async (req, res) => {
  try {
    const { clientId, productId, quantity = 1, notes, scheduledDate } = req.body;
    if (!clientId || !productId)
      return res.status(400).json({ error: "Client et produit requis" });

    const [client, product] = await Promise.all([
      Client.findById(clientId),
      Product.findById(productId),
    ]);
    if (!client)  return res.status(404).json({ error: "Client introuvable" });
    if (!product) return res.status(404).json({ error: "Produit introuvable" });

    const reservation = await Reservation.create({
      clientId,
      productId,
      quantity: Number(quantity),
      totalPrice: product.price * Number(quantity),
      notes,
      scheduledDate: scheduledDate || null,
      source: "admin",
    });

    const populated = await populate(Reservation.findById(reservation._id));
    res.status(201).json(formatRes(populated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reservations/public  (site public, san uth)
router.post("/public", async (req, res) => {
  try {
    const { clientName, clientEmail, clientPhone, productId, quantity = 1, notes, scheduledDate } = req.body;
    if (!clientEmail || !productId)
      return res.status(400).json({ error: "Email et produit requis" });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: "Produit introuvable" });

    // Upsert client
    let client = await Client.findOne({ email: clientEmail });
    if (!client) {
      client = await Client.create({
        name: clientName || clientEmail,
        email: clientEmail,
        phone: clientPhone || "",
      });
    }

    const reservation = await Reservation.create({
      clientId: client._id,
      productId,
      quantity: Number(quantity),
      totalPrice: product.price * Number(quantity),
      notes: notes || "",
      scheduledDate: scheduledDate || null,
      source: "public",
    });

    res.status(201).json({ message: "Réservation envoyée avec succès", id: reservation._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/reservations/:id/status
router.put("/:id/status", authenticateAdmin , async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ["pending", "confirmed", "cancelled", "completed"];
    if (!valid.includes(status))
      return res.status(400).json({ error: "Statut invalide" });

    const r = await Reservation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!r) return res.status(404).json({ error: "Réservation introuvable" });

    const populated = await populate(Reservation.findById(r._id));
    res.json(formatRes(populated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/reservations/:id
router.delete("/:id", authenticateAdmin , async (req, res) => {
  try {
    const r = await Reservation.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: "Réservation introuvable" });
    res.json({ message: "Réservation supprimée" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// GET /api/reservations/mine  ← client sees only their own


export default router;