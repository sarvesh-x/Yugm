import { Router, type Response } from "express";
import { z } from "zod";
import { requireAdminAuth, requirePermission } from "../middleware/adminAuth.js";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { listAdminMedia, listAdminQuotas, listAdminSessions, reconcileMediaQuotas } from "../services/adminMedia.js";
import { asyncHandler } from "../utils/http.js";

export const adminMediaRouter = Router();
adminMediaRouter.use(requireAdminAuth);

const booleanString = z.enum(["true", "false"]).optional();

const mediaQuery = z.object({
  ownerType: z.string().trim().min(1).max(64).optional(),
  ownerId: z.string().trim().min(1).max(128).optional(),
  category: z.string().trim().min(1).max(64).optional(),
  visibility: z.string().trim().min(1).max(32).optional(),
  status: z.string().trim().min(1).max(32).optional(),
  deleted: booleanString,
});

const sessionQuery = z.object({
  userId: z.string().trim().min(1).max(128).optional(),
  status: z.string().trim().min(1).max(32).optional(),
  category: z.string().trim().min(1).max(64).optional(),
});

adminMediaRouter.get("/media", requirePermission("cosmetics.read"),
  asyncHandler(async (req, res: Response) => {
    const parsed = mediaQuery.parse(req.query);
    const { page, limit, skip } = pageParams(req.query as Record<string, unknown>);
    const result = await listAdminMedia(
      { ...parsed, deleted: parsed.deleted === undefined ? undefined : parsed.deleted === "true" },
      skip,
      limit
    );
    adminOk(res, { media: result.items }, paginationMeta(page, limit, result.total));
  })
);

adminMediaRouter.get("/media/sessions", requirePermission("cosmetics.read"),
  asyncHandler(async (req, res: Response) => {
    const parsed = sessionQuery.parse(req.query);
    const { page, limit, skip } = pageParams(req.query as Record<string, unknown>);
    const result = await listAdminSessions(parsed, skip, limit);
    adminOk(res, { sessions: result.items }, paginationMeta(page, limit, result.total));
  })
);

adminMediaRouter.get("/media/quotas", requirePermission("cosmetics.read"),
  asyncHandler(async (req, res: Response) => {
    const { page, limit, skip } = pageParams(req.query as Record<string, unknown>);
    const result = await listAdminQuotas(skip, limit);
    adminOk(res, { quotas: result.items }, paginationMeta(page, limit, result.total));
  })
);

adminMediaRouter.get("/media/quota-reconciliation", requirePermission("cosmetics.read"),
  asyncHandler(async (_req, res: Response) => {
    adminOk(res, { reconciliation: await reconcileMediaQuotas() });
  })
);
