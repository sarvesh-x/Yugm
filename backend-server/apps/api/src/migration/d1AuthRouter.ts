import type { D1Database } from "@cloudflare/workers-types";
import { profileSchema } from "@yugm/shared";
import { createHttpSessionAuth } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { createAuthSessionRouter, publicAuthUser, type AuthRateLimiters } from "../routes/authSession.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { createD1AuthAccountStore } from "./d1AuthAccounts.js";
import { createD1AuthSessionStore } from "./d1AuthSessionStore.js";
import { updateD1Profile } from "./d1ProfileEdits.js";

/** Candidate router for the isolated Auth journey. */
export function createD1AuthRouter(db: D1Database, rateLimiters: AuthRateLimiters) {
  const { required } = createHttpSessionAuth(createD1AccessSessionReader(db, "http"), (_req, res, user) => {
    res.locals.authUserId = user.id;
  });
  const accounts = createD1AuthAccountStore(db);
  const router = createAuthSessionRouter({
    accounts,
    sessions: createD1AuthSessionStore(db),
    enforceSession: required,
    rateLimiters
  });
  router.patch("/profile", required, validateBody(profileSchema.partial()), asyncHandler(async (req, res) => {
    const { xpGrant } = await updateD1Profile(db, req.headers.authorization, req.body);
    const user = await accounts.findById(res.locals.authUserId);
    if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    sendOk(res, { user: publicAuthUser(user), xpGrant });
  }));
  return router;
}
