import { Router } from "express";
import Notification from "../models/Notification.js";
import { authenticateAdmin } from "../middleware/auth.js";

const router = Router();

// GET /api/notifications — all unread
router.get("/", authenticateAdmin, async (req, res) => {
  try {
    const notifications = await Notification.find({ read: false })
      .sort({ createdAt: -1 })
      .limit(20);
    const total = await Notification.countDocuments({ read: false });
    res.json({ notifications, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch("/:id/read", authenticateAdmin, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/read-all — mark all as read
router.patch("/read-all", authenticateAdmin, async (req, res) => {
  try {
    await Notification.updateMany({ read: false }, { read: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
