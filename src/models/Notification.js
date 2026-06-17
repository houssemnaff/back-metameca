import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  type:    { type: String, default: "new_reservation" },
  title:   { type: String, required: true },
  message: { type: String, required: true },
  read:    { type: Boolean, default: false },
  data:    { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

export default mongoose.model("Notification", notificationSchema);
