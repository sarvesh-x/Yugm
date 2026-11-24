import type { D1Database } from "@cloudflare/workers-types";
import { createHttpSessionAuth } from "../middleware/httpAccessSession.js";
import { createAuthSessionRouter, type AuthRateLimiters } from "../routes/authSession.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { createD1AuthAccountStore } from "./d1AuthAccounts.js";
import { createD1AuthSessionStore } from "./d1AuthSessionStore.js";

/** Candidate router for the isolated Auth journey. */
export function createD1AuthRouter(db: D1Database, rateLimiters: AuthRateLimiters) {
  const { required } = createHttpSessionAuth(createD1AccessSessionReader(db, "http"), (_req, res, user) => {
    res.locals.authUserId = user.id;
  });
  return createAuthSessionRouter({
    accounts: createD1AuthAccountStore(db),
    sessions: createD1AuthSessionStore(db),
    enforceSession: required,
    rateLimiters
  });
}
