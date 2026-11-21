import assert from "node:assert/strict";
import { test } from "node:test";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/yugm-test";
process.env.MONGODB_DB_NAME ??= "yugm-test";

const { AdminAuditLog } = await import("../models/AdminAuditLog.js");
const { auditLog } = await import("./adminAudit.js");

test("string entity IDs are audited in metadata instead of failing an ObjectId cast", async () => {
  const originalCreate = AdminAuditLog.create;
  let captured: Record<string, unknown> | undefined;
  (AdminAuditLog as unknown as { create: unknown }).create = async (data: Record<string, unknown>) => {
    captured = data;
    return data;
  };
  try {
    await auditLog({
      action: "asset.staged",
      entityType: "AssetObject",
      entityId: "9d8c0e0e-1234-4abc-8def-0123456789ab",
      metadata: { version: 1 }
    });
    assert.equal(captured?.entityId, undefined);
    assert.equal((captured?.metadata as Record<string, unknown>).entityId, "9d8c0e0e-1234-4abc-8def-0123456789ab");
    assert.equal((captured?.metadata as Record<string, unknown>).version, 1);

    await auditLog({ action: "asset.published", entityType: "AssetObject", entityId: "507f1f77bcf86cd799439011" });
    assert.equal(captured?.entityId, "507f1f77bcf86cd799439011");
  } finally {
    (AdminAuditLog as unknown as { create: unknown }).create = originalCreate;
  }
});
