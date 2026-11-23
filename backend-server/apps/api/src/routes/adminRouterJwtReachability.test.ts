import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express, { type NextFunction, type Request, type Response, type Router } from "express";
import { mock, test } from "node:test";
import type { AdminAuthRequest } from "../middleware/adminAuth.js";
import { HttpError } from "../utils/http.js";

// Set before dynamic imports so config/env.js resolves a deterministic test secret.
process.env.ADMIN_JWT_SECRET = "admin-router-reachability-test-secret";

const [{ AdminUser }, adminAuth, adminAssets, adminBadges, adminCosmetics, adminReactions, adminSupport] =
  await Promise.all([
    import("../models/AdminUser.js"),
    import("../middleware/adminAuth.js"),
    import("./adminAssets.js"),
    import("./adminBadges.js"),
    import("./adminCosmetics.js"),
    import("./adminReactions.js"),
    import("./adminSupport.js"),
  ]);

const admin = {
  id: "507f1f77bcf86cd799439011",
  email: "admin@example.test",
  displayName: "Test Admin",
  role: "SUPER_ADMIN",
  permissions: [],
  isSuperAdmin: true,
  status: "ACTIVE",
};

function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const status = error instanceof HttpError ? error.status : 500;
  res.status(status).json({ error: status === 401 ? "unauthorized" : "error" });
}

test("a valid admin JWT is accepted by requireAdminAuth and reaches the protected boundary", async (t) => {
  const findById = mock.method(AdminUser, "findById", async () => admin);
  t.after(() => findById.mock.restore());

  const app = express();
  app.use(adminAuth.requireAdminAuth);
  app.get("/probe", (req: AdminAuthRequest, res) => {
    res.json({ adminId: req.admin?.id, permissions: req.adminPermissions?.length ?? 0 });
  });
  app.use(errorHandler);

  const server: Server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const token = adminAuth.signAdminAccessToken(admin as never);
    const response = await fetch(`http://127.0.0.1:${port}/probe`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await response.json()) as { adminId?: string; permissions?: number };

    assert.equal(response.status, 200);
    assert.equal(body.adminId, admin.id);
    assert.ok((body.permissions ?? 0) > 0, "super admin should receive a populated permission set");
    assert.equal(findById.mock.callCount(), 1);
  } finally {
    server.close();
    await once(server, "close");
  }
});

function hasExplicitGuard(router: Router): boolean {
  return router.stack.some((layer) => (layer.handle as { name?: string } | undefined)?.name === "requireAdminAuth");
}

test("formerly dependent admin routers carry an explicit requireAdminAuth layer", () => {
  const guarded = [
    adminAssets.adminAssetsRouter,
    adminBadges.adminBadgesRouter,
    adminCosmetics.adminCosmeticsRouter,
    adminReactions.adminReactionsRouter,
    adminSupport.adminSupportRouter,
  ];

  for (const router of guarded) {
    assert.equal(hasExplicitGuard(router), true, "expected an explicit admin auth guard");
  }
  assert.equal(hasExplicitGuard(adminBadges.badgeArtRouter), false, "public badge art must stay unguarded");
});
