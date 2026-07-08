import mongoose, { Schema } from "mongoose";

const supportTicketSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    category: { type: String, enum: ["LOGIN", "PAYMENT", "WITHDRAWAL", "ROOM", "CHAT", "MATCHING", "SAFETY", "REPORT", "BUG", "OTHER"], required: true },
    subject: { type: String, required: true },
    status: { type: String, enum: ["OPEN", "PENDING", "CLOSED"], default: "OPEN", index: true },
    priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "MEDIUM", index: true },
    lastMessageAt: Date,
    closedAt: Date
  },
  { timestamps: true }
);

const supportMessageSchema = new Schema(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: "SupportTicket", required: true, index: true },
    senderType: { type: String, enum: ["USER", "ADMIN", "SYSTEM"], required: true },
    senderUserId: { type: Schema.Types.ObjectId, ref: "User" },
    senderAdminId: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    message: { type: String, required: true },
    attachments: { type: Schema.Types.Mixed, default: [] }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const SupportTicket = mongoose.model("SupportTicket", supportTicketSchema);
export const SupportMessage = mongoose.model("SupportMessage", supportMessageSchema);
