import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import { connectDB } from "./db.js";
import aiRoutes  from "./routes/ai.js";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import clientRoutes from "./routes/clients.js";
import reservationRoutes from "./routes/reservations.js";

const app = express();
const PORT = process.env.PORT || 4000;

connectDB();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://phenomenal-chimera-8b205c.netlify.app",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS bloqué pour: ${origin}`));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.get("/api/health", (_, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() })
);

app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes); 

// debug middleware (OK)
app.use("/api/products", (req, res, next) => {
  console.log("Content-Type:", req.headers["content-type"]);
  next();
});

app.use("/api/products", productRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/reservations", reservationRoutes);

app.use((req, res) =>
  res.status(404).json({ error: "Route introuvable" })
);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Erreur interne du serveur" });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur backend démarré sur http://localhost:${PORT}`);
});