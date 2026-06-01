  import { Router } from "express";
  import Product from "../models/Product.js";
  import { authenticateAdmin  } from "../middleware/auth.js";
  import multer from "multer";
  import path from "path";
  import fs from "fs";
  import sharp from "sharp";
import csv from "csv-parser";

  import { CloudinaryStorage } from "multer-storage-cloudinary";
  import cloudinary from "../config/cloudinary.js";
  const router = Router();
const uploadCsv = multer({ storage: multer.memoryStorage() });

  // ── Multer: memoryStorage pour passer à sharp ──
  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "products",
      allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"], // 👈 add avif
      transformation: [
        { quality: "auto:best" },  // meilleure qualité auto
        { fetch_format: "auto" },  // format optimal selon navigateur
      ],
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
  });

  function generateRef(category = "GEN") {
    const safe = (category || "GEN").slice(0, 3).toUpperCase();
    const unique = Date.now().toString().slice(-6);
    return `${safe}-${unique}`;
  }

  // GET /api/products
 router.get("/", async (req, res) => {
  try {
    const { category, status, search, family } = req.query; // 👈 add family
    const filter = {};
    if (category) filter.category = category;
    if (status)   filter.status   = status;
    if (search)   filter.$text    = { $search: search };
    if (family)   filter.family   = family;             // 👈 add this

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

  // GET /api/products/categories/list
  router.get("/categories/list", authenticateAdmin, async (req, res) => {
    try {
      const cats = await Product.distinct("category");
      res.json(cats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/products/:id
  router.get("/:id", async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).json({ error: "Produit introuvable" });
      res.json(product);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

router.get("/", async (req, res) => {
  try {
    const { family } = req.query;

    const filter = {};

    if (family) {
      filter.family = family;
    }

    const products = await Product.find(filter);

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products
router.post(
  "/",
  authenticateAdmin,
  upload.array("images", 10),
  async (req, res) => {
    try {
      console.log("FILES:", req.files);
      console.log("BODY:", req.body);

      const { name, description, price, stock, category, status, reference, family } = req.body;

      if (!name || price === undefined || !family) {
        return res.status(400).json({ error: "Nom, prix et family sont requis" });
      }

      const finalReference = reference?.trim() || generateRef(category);

      const images = (req.files || []).map(file => ({
        url: file.path,
        public_id: file.filename,
      }));

      const product = await Product.create({
        name, description, price, stock,
        category, status,
        reference: finalReference,
        family, images,
      });

      res.status(201).json(product);
    } catch (err) {
      console.error("FULL ERROR:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

  // PUT /api/products/:id
  router.put(
    "/:id",
    authenticateAdmin ,
    upload.array("images", 10),
    async (req, res) => {
      try {
        const updates = { ...req.body };

        if (req.files && req.files.length > 0) {
          updates.images = req.files.map(file => ({
            url: file.path,
            public_id: file.filename,
          }));
        }

        if (!updates.reference) {
          updates.reference = generateRef(updates.category || "GEN");
        }

        const product = await Product.findByIdAndUpdate(
          req.params.id,
          { $set: updates },
          { new: true }
        );

        res.json(product);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  // DELETE /api/products/:id
  router.delete("/:id", authenticateAdmin, async (req, res) => {
    try {
      const product = await Product.findByIdAndDelete(req.params.id);
      if (!product) return res.status(404).json({ error: "Produit introuvable" });
      res.json({ message: "Produit supprimé" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  export default router;