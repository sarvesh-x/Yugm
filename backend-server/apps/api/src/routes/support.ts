import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, sendOk, HttpError, ErrorCode } from "../utils/http.js";
import { SupportTicket } from "../models/SupportTicket.js";
import { createLimiter } from "../middleware/rateLimit.js";

export const supportRouter = Router();

const CATEGORIES = [
  "General", "Account", "Payment", "Technical", "Report", "Content", "Other"
] as const;

const createTicketSchema = z.object({
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(2000),
  category: z.enum(CATEGORIES).default("General"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM")
});

const addMessageSchema = z.object({
  message: z.string().min(1).max(2000)
});

const publicRequestSchema = z.object({
  email: z.string().trim().email().max(254),
  username: z.string().trim().min(2).max(32).optional().default(""),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(2000),
  requestType: z.enum(["ACCOUNT_DELETION", "PRIVACY", "SUPPORT"])
});

supportRouter.post("/public-requests", createLimiter, validateBody(publicRequestSchema),
  asyncHandler(async (req, res) => {
    const { email, username, subject, message, requestType } = req.body;
    const category = requestType === "SUPPORT" ? "General" : "Account";
    const ticket = await SupportTicket.create({
      requesterEmail: email,
      subject: requestType === "ACCOUNT_DELETION" ? `Account deletion request: ${subject}` : subject,
      message: [username ? `Username: ${username}` : "", `Request type: ${requestType}`, message].filter(Boolean).join("\n\n"),
      category,
      priority: requestType === "ACCOUNT_DELETION" ? "HIGH" : "MEDIUM",
      status: "OPEN",
      messages: []
    });
    sendOk(res, { requestId: ticket.id, received: true }, 201);
  })
);

supportRouter.post("/tickets", requireAuth, validateBody(createTicketSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { subject, message, category, priority } = req.body;
    const ticket = await SupportTicket.create({
      userId: req.user!.id,
      subject,
      message,
      category,
      priority,
      messages: [{
        senderId: req.user!.id,
        senderRole: "USER",
        message,
        createdAt: new Date()
      }]
    });
    sendOk(res, { ticket }, 201);
  })
);

supportRouter.get("/tickets", requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string | undefined;

    const filter: Record<string, unknown> = { userId: req.user!.id };
    if (status && ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(status)) {
      filter.status = status;
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SupportTicket.countDocuments(filter)
    ]);

    sendOk(res, {
      tickets,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  })
);

supportRouter.get("/tickets/:ticketId", requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const ticket = await SupportTicket.findOne({
      _id: req.params.ticketId,
      userId: req.user!.id
    }).lean();

    if (!ticket) {
      throw new HttpError(404, "Ticket not found", ErrorCode.VALIDATION);
    }

    sendOk(res, { ticket });
  })
);

supportRouter.post("/tickets/:ticketId/messages", requireAuth, validateBody(addMessageSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const ticket = await SupportTicket.findOne({
      _id: req.params.ticketId,
      userId: req.user!.id
    });

    if (!ticket) {
      throw new HttpError(404, "Ticket not found", ErrorCode.VALIDATION);
    }

    if (ticket.status === "CLOSED") {
      throw new HttpError(400, "Ticket is closed", ErrorCode.VALIDATION);
    }

    ticket.messages.push({
      senderId: req.user!.id,
      senderRole: "USER",
      message: req.body.message,
      createdAt: new Date()
    });

    if (ticket.status === "RESOLVED") {
      ticket.status = "OPEN";
    }

    await ticket.save();

    sendOk(res, { ticket });
  })
);

supportRouter.post("/tickets/:ticketId/close", requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const ticket = await SupportTicket.findOneAndUpdate(
      { _id: req.params.ticketId, userId: req.user!.id },
      { status: "CLOSED" },
      { new: true }
    );

    if (!ticket) {
      throw new HttpError(404, "Ticket not found", ErrorCode.VALIDATION);
    }

    sendOk(res, { ticket });
  })
);
