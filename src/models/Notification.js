import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  type:     { type: String, default: "new_reservation" },
  title:    { type: String, required: true },
  message:  { type: String, required: true },
  read:     { type: Boolean, default: false },
  data:     { type: mongoose.Schema.Types.Mixed, default: {} },
  // null = admin notification, ObjectId = client notification
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", default: null },
}, { timestamps: true });

export default mongoose.model("Notification", notificationSchema);
