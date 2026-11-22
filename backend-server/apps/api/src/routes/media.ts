import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import {
  authorizeMediaDownload,
  cancelUploadSession,
  completeUploadSession,
  createUploadSession
} from "../services/media.js";

export const mediaRouter = Router();

/**
 * Creates a private staging grant. The client never chooses a storage key,
 * bucket, owner or expiry; all of those are derived on the server.
 */
mediaRouter.post("/media/uploads", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const body = req.body as Record<string, unknown> | undefined;
  const category = typeof body?.category === "string" ? body.category : "";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const bytes = body?.bytes;
  if (!category || !contentType || !fileName || !Number.isSafeInteger(bytes)) {
    throw new HttpError(400, "category, contentType, fileName and integer bytes are required", ErrorCode.VALIDATION);
  }
  const session = await createUploadSession({
    category,
    contentType,
    fileName,
    bytes: bytes as number,
    actorId: String(req.user!._id)
  });
  sendOk(res, session, 201);
}));

/** Idempotent publication: server verifies staging before changing any reference. */
mediaRouter.post("/media/uploads/:sessionId/complete", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const result = await completeUploadSession(String(req.params.sessionId), String(req.user!._id));
  sendOk(res, result);
}));

mediaRouter.delete("/media/uploads/:sessionId", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const result = await cancelUploadSession(String(req.params.sessionId), String(req.user!._id));
  sendOk(res, result);
}));

/** Returns a short-lived signed URL only after resource-level authorization. */
mediaRouter.get("/media/:mediaId/download", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const result = await authorizeMediaDownload(String(req.params.mediaId), String(req.user!._id));
  sendOk(res, result);
}));
