import type { Request } from "express";
import { AdminAuditLog } from "../models/AdminAuditLog.js";

type AuditInput = {
  adminId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
};

export async function auditLog(input: AuditInput) {
  try {
    return await AdminAuditLog.create({
      adminId: input.adminId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      targetUserId: input.targetUserId,
      metadata: input.metadata ?? {},
      ipAddress: input.req?.ip,
      userAgent: input.req?.get("user-agent")
    });
  } catch (error) {
    console.warn("Admin audit log failed:", error instanceof Error ? error.message : String(error));
    return undefined;
  }
}
