import mongoose, { Schema } from "mongoose";

export interface ISupportMessage {
  senderId: mongoose.Types.ObjectId;
  senderRole: "USER" | "ADMIN";
  message: string;
  createdAt: Date;
}

const supportTicketSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    category: { type: String, enum: ["General", "Account", "Payment", "Technical", "Report", "Content", "Other"], default: "General" },
    subject: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"], default: "OPEN", index: true },
    priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], default: "MEDIUM", index: true },
    messages: [
      {
        senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        senderRole: { type: String, enum: ["USER", "ADMIN"], required: true },
        message: { type: String, required: true, maxlength: 2000 },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    lastMessageAt: Date,
    closedAt: Date,
    resolvedAt: Date
  },
  { timestamps: true }
);

supportTicketSchema.index({ status: 1, createdAt: -1 });
supportTicketSchema.index({ userId: 1, status: 1 });

// Legacy SupportMessage model for backward compatibility
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
