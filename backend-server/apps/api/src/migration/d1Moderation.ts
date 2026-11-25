import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { moderateContent } from "../services/contentModeration.js";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { asyncHandler, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";

const checkTextSchema = z.object({
  text: z.string().min(1).max(2000),
  context: z.enum(["chat", "profile", "room_title", "room_description", "clan", "message"]).optional().default("chat")
});

const toxicityScores = (includeSexuallyExplicit: boolean) => ({
  toxicity: 0,
  severeToxicity: 0,
  identityAttack: 0,
  insult: 0,
  threat: 0,
  ...(includeSexuallyExplicit ? { sexuallyExplicit: 0 } : {})
});

export function createD1ModerationRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const requireModerationSession = asyncHandler(async (req, res, next) => {
    await requireHttpSession(req.headers.authorization, access);
    next();
  });

  router.post("/v1/moderation/check-text", requireModerationSession, asyncHandler(async (req, res) => {
    const parsed = checkTextSchema.safeParse(req.body);
    // The legacy router calls Zod's parse directly, so malformed input reaches
    // its generic error handler as a 500 INTERNAL with the Zod issue text. The
    // shared D1 handler masks 500 messages, so preserve that body here.
    if (!parsed.success) {
      res.status(500).json({
        ok: false,
        error: { message: parsed.error.message, code: "INTERNAL", requestId: crypto.randomUUID() }
      });
      return;
    }
    const { text, context } = parsed.data;
    const result = moderateContent(text);
    const isFlagged = !result.isClean;

    sendOk(res, {
      text,
      context,
      isClean: !isFlagged,
      isBlocked: result.action === "BLOCK",
      severity: result.severity,
      keywordFlags: result.flaggedWords,
      aiFlags: [],
      toxicityScores: toxicityScores(true),
      topLabel: null,
      aiModelReady: false,
      aiModelLoading: false
    });
  }));

  router.post("/v1/moderation/check-voice", requireModerationSession, asyncHandler(async (req, res) => {
    const { transcript } = req.body as { transcript?: unknown };
    if (!transcript || typeof transcript !== "string") {
      res.status(400).json({ ok: false, error: { message: "Transcript is required" } });
      return;
    }

    const result = moderateContent(transcript);
    sendOk(res, {
      transcript,
      isClean: result.isClean,
      severity: result.severity,
      keywordFlags: result.flaggedWords,
      aiFlags: [],
      toxicityScores: toxicityScores(false)
    });
  }));

  return router;
}
