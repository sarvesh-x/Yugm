import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express, { type NextFunction, type Request, type Response, type Router } from "express";
import { test } from "node:test";
import { adminAssetsRouter } from "./adminAssets.js";
import { adminBadgesRouter } from "./adminBadges.js";
import { adminCosmeticsRouter } from "./adminCosmetics.js";
import { adminReactionsRouter } from "./adminReactions.js";
import { adminSupportRouter } from "./adminSupport.js";
import { adminMediaRouter } from "./adminMedia.js";
import { HttpError } from "../utils/http.js";

function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const status = error instanceof HttpError ? error.status : 500;
  res.status(status).json({ error: status === 401 ? "unauthorized" : "error" });
}

async function statusWithoutToken(router: Router, requestPath: string): Promise<number> {
  const app = express();
  app.use("/api/admin", router);
  app.use(errorHandler);
  const server: Server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/api/admin${requestPath}`);
    await response.arrayBuffer();
    return response.status;
  } finally {
    server.close();
    await once(server, "close");
  }
}

const guardedRouters = [
  { name: "adminAssetsRouter", router: adminAssetsRouter, path: "/assets/staging/example.png" },
  { name: "adminBadgesRouter", router: adminBadgesRouter, path: "/badges" },
  { name: "adminCosmeticsRouter", router: adminCosmeticsRouter, path: "/cosmetics" },
  { name: "adminReactionsRouter", router: adminReactionsRouter, path: "/reactions" },
  { name: "adminSupportRouter", router: adminSupportRouter, path: "/support/tickets" },
  { name: "adminMediaRouter", router: adminMediaRouter, path: "/media" },
] as const;

for (const { name, router, path } of guardedRouters) {
  test(`${name} rejects unauthenticated requests without relying on mount order`, async () => {
    assert.equal(await statusWithoutToken(router, path), 401);
  });
}
