import { Router } from "express";
import Notification from "../models/Notification.js";
import { authenticateAdmin, authenticateToken } from "../middleware/auth.js";

const router = Router();

/* ── Admin: all notifications (history) ── */
router.get("/", authenticateAdmin, async (req, res) => {
  try {
    const notifications = await Notification.find({ clientId: null })
      .sort({ createdAt: -1 })
      .limit(30);
    const total = await Notification.countDocuments({ clientId: null, read: false });
    res.json({ notifications, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Admin: mark one as read ── */
router.patch("/:id/read", authenticateAdmin, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Admin: mark all as read ── */
router.patch("/read-all", authenticateAdmin, async (req, res) => {
  try {
    await Notification.updateMany({ clientId: null, read: false }, { read: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Client: get own notifications ── */
router.get("/my", authenticateToken, async (req, res) => {
  try {
    const notifications = await Notification.find({ clientId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20);
    const total = await Notification.countDocuments({ clientId: req.user.id, read: false });
    res.json({ notifications, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Client: mark one as read ── */
router.patch("/my/:id/read", authenticateToken, async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, clientId: req.user.id },
      { read: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Client: mark all as read ── */
router.patch("/my/read-all", authenticateToken, async (req, res) => {
  try {
    await Notification.updateMany({ clientId: req.user.id, read: false }, { read: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
