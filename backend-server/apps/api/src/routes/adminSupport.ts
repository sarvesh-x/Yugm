import { Router } from "express";
import { z } from "zod";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { requirePermission, type AdminAuthRequest } from "../middleware/adminAuth.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, HttpError, isValidObjectId, ErrorCode } from "../utils/http.js";
import { SupportTicket } from "../models/SupportTicket.js";
import { AdminAuditLog } from "../models/AdminAuditLog.js";

const adminSupportRouter = Router();

adminSupportRouter.get("/support/tickets", requirePermission("support.read"),
  asyncHandler(async (req: AdminAuthRequest, res) => {
    const { skip, limit, page } = pageParams(req.query as Record<string, unknown>);
    const { status, priority, category, q } = req.query;

    const filter: Record<string, unknown> = {};
    if (status && ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(status as string)) {
      filter.status = status;
    }
    if (priority && ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority as string)) {
      filter.priority = priority;
    }
    if (category) {
      filter.category = category;
    }
    if (q && typeof q === "string") {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { subject: { $regex: escaped, $options: "i" } },
        { message: { $regex: escaped, $options: "i" } }
      ];
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "username displayName avatar")
        .populate("assignedTo", "username email")
        .lean(),
      SupportTicket.countDocuments(filter)
    ]);

    adminOk(res, { tickets }, paginationMeta(page, limit, total));
  })
);

adminSupportRouter.get("/support/tickets/:ticketId", requirePermission("support.read"),
  asyncHandler(async (req: AdminAuthRequest, res) => {
    const ticket = await SupportTicket.findById(req.params.ticketId)
      .populate("userId", "username displayName avatar")
      .populate("assignedTo", "username email")
      .populate("messages.senderId", "username displayName avatar")
      .lean();

    if (!ticket) {
      throw new HttpError(404, "Ticket not found");
    }

    adminOk(res, { ticket });
  })
);

adminSupportRouter.post("/support/tickets/:ticketId/respond", requirePermission("support.reply"),
  validateBody(z.object({
    message: z.string().min(1).max(2000)
  })),
  asyncHandler(async (req: AdminAuthRequest, res) => {
    const ticket = await SupportTicket.findById(req.params.ticketId);
    if (!ticket) {
      throw new HttpError(404, "Ticket not found");
    }

    ticket.messages.push({
      senderId: req.admin!._id,
      senderRole: "ADMIN",
      message: req.body.message,
      createdAt: new Date()
    });

    if (ticket.status === "OPEN") {
      ticket.status = "IN_PROGRESS";
    }

    await ticket.save();

    await AdminAuditLog.create({
      adminId: req.admin!._id,
      action: "SUPPORT_RESPOND",
      entityType: "SupportTicket",
      entityId: ticket._id,
      metadata: { subject: ticket.subject }
    });

    adminOk(res, { ticket });
  })
);

adminSupportRouter.patch("/support/tickets/:ticketId/status", requirePermission("support.reply"),
  validateBody(z.object({
    status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
    note: z.string().max(500).optional()
  })),
  asyncHandler(async (req: AdminAuthRequest, res) => {
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.ticketId,
      {
        status: req.body.status,
        resolvedAt: req.body.status === "RESOLVED" ? new Date() : undefined
      },
      { new: true }
    );

    if (!ticket) {
      throw new HttpError(404, "Ticket not found");
    }

    await AdminAuditLog.create({
      adminId: req.admin!._id,
      action: "SUPPORT_STATUS_UPDATE",
      entityType: "SupportTicket",
      entityId: ticket._id,
      metadata: { status: req.body.status, note: req.body.note }
    });

    adminOk(res, { ticket });
  })
);

adminSupportRouter.patch("/support/tickets/:ticketId/assign", requirePermission("support.reply"),
  asyncHandler(async (req: AdminAuthRequest, res) => {
    const { adminUserId } = req.body || {};

    let assignToId = req.admin!._id;
    if (adminUserId) {
      if (!isValidObjectId(adminUserId)) {
        throw new HttpError(400, "Invalid admin user ID", ErrorCode.VALIDATION);
      }
      assignToId = adminUserId;
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.ticketId,
      { assignedTo: assignToId },
      { new: true }
    );

    if (!ticket) {
      throw new HttpError(404, "Ticket not found");
    }

    await AdminAuditLog.create({
      adminId: req.admin!._id,
      action: "SUPPORT_ASSIGN",
      entityType: "SupportTicket",
      entityId: ticket._id,
      metadata: { assignedTo: adminUserId || req.admin!._id }
    });

    adminOk(res, { ticket });
  })
);

adminSupportRouter.get("/support/stats", requirePermission("support.read"),
  asyncHandler(async (_req: AdminAuthRequest, res) => {
    const [openCount, inProgressCount, resolvedCount, closedCount, urgentCount] = await Promise.all([
      SupportTicket.countDocuments({ status: "OPEN" }),
      SupportTicket.countDocuments({ status: "IN_PROGRESS" }),
      SupportTicket.countDocuments({ status: "RESOLVED" }),
      SupportTicket.countDocuments({ status: "CLOSED" }),
      SupportTicket.countDocuments({ priority: "URGENT", status: { $ne: "CLOSED" } })
    ]);

    adminOk(res, {
      stats: {
        open: openCount,
        inProgress: inProgressCount,
        resolved: resolvedCount,
        closed: closedCount,
        urgent: urgentCount,
        total: openCount + inProgressCount + resolvedCount + closedCount
      }
    });
  })
);

export { adminSupportRouter };
