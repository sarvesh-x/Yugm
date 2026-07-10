import type { Request } from "express";
import { auditLog } from "./adminAudit.js";

type AuditLogInput = {
  adminId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
};

export async function recordAuditLog(input: AuditLogInput) {
  return auditLog(input);
}
