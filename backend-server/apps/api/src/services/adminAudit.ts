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

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

export async function auditLog(input: AuditInput) {
  try {
    // entityId is stored as an ObjectId. String IDs (cosmetics, reactions,
    // asset UUIDs) must go to metadata instead; passing them directly would
    // throw a cast error and silently lose the audit entry.
    const entityId = input.entityId && objectIdPattern.test(input.entityId) ? input.entityId : undefined;
    const metadata = {
      ...(input.metadata ?? {}),
      ...(input.entityId && !entityId ? { entityId: input.entityId } : {})
    };
    return await AdminAuditLog.create({
      adminId: input.adminId,
      action: input.action,
      entityType: input.entityType,
      entityId,
      targetUserId: input.targetUserId,
      metadata,
      ipAddress: input.req?.ip,
      userAgent: input.req?.get("user-agent")
    });
  } catch (error) {
    console.warn("Admin audit log failed:", error instanceof Error ? error.message : String(error));
    return undefined;
  }
}
