import { Router } from "express";
import Client from "../models/client.js";
import Reservation from "../models/Reservation.js";
import { authenticateAdmin, authenticateToken } from "../middleware/auth.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();

// GET /api/clients
router.get("/", authenticateAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};
    if (search) filter.$text = { $search: search };

    const clients = await Client.find(filter).sort({ createdAt: -1 });

    const withCounts = await Promise.all(
      clients.map(async (c) => {
        const count = await Reservation.countDocuments({ clientId: c._id });
        return { ...c.toJSON(), reservationCount: count };
      })
    );

    res.json(withCounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clients/me  ← doit être AVANT /:id
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const client = await Client.findById(req.user.id).select("-password");
    if (!client) return res.status(404).json({ error: "Client introuvable" });

    res.json({
      id:    client._id,
      name:  client.name,
      email: client.email,
      phone: client.phone,
      role:  "client",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients/register  ← doit être AVANT /:id
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, company, phone } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: "Nom, email et mot de passe requis" });

    const exists = await Client.findOne({ email });
    if (exists) return res.status(400).json({ error: "Email déjà utilisé" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const client = await Client.create({
      name,
      email,
      password: hashedPassword,
      company,
      phone,
      role: "client",
    });

    const token = jwt.sign(
      { id: client._id, email: client.email, role: "client" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      token,
      user: {
        id:    client._id,
        name:  client.name,
        email: client.email,
        role:  "client",
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients/login  ← doit être AVANT /:id
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const client = await Client.findOne({ email });
    if (!client) return res.status(404).json({ error: "Client introuvable" });

    const isMatch = await bcrypt.compare(password, client.password);
    if (!isMatch) return res.status(401).json({ error: "Mot de passe incorrect" });

    const token = jwt.sign(
      { id: client._id, email: client.email, role: "client" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id:    client._id,
        name:  client.name,
        email: client.email,
        role:  "client",
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clients/:id
router.get("/:id", authenticateAdmin, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ error: "Client introuvable" });

    const reservations = await Reservation.find({ clientId: req.params.id })
      .populate("productId", "name price image")
      .sort({ createdAt: -1 });

    const mapped = reservations.map((r) => {
      const obj = r.toJSON();
      obj.product = obj.productId;
      delete obj.productId;
      return obj;
    });

    res.json({ ...client.toJSON(), reservations: mapped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients  (admin — crée un client avec mot de passe)
router.post("/", authenticateAdmin, async (req, res) => {
  try {
    const { name, email, password, phone, company, address, notes } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: "Nom, email et mot de passe requis" });

    const exists = await Client.findOne({ email });
    if (exists) return res.status(409).json({ error: "Email déjà utilisé" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const client = await Client.create({
      name, email, phone, company, address, notes,
      password: hashedPassword,
    });

    res.status(201).json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/clients/:id
router.put("/:id", authenticateAdmin, async (req, res) => {
  try {
    // Ne jamais écraser le mot de passe via cette route
    const { password, ...safeBody } = req.body;

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { $set: safeBody },
      { new: true, runValidators: true }
    );
    if (!client) return res.status(404).json({ error: "Client introuvable" });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/clients/:id
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ error: "Client introuvable" });
    res.json({ message: "Client supprimé" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;