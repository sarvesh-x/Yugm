import type { RateLimit } from "@cloudflare/workers-types";
import type { Request } from "express";
import { authIdentifierKey, refreshKey } from "../../api/src/middleware/authRateLimitKeys.js";
import type { AuthRateLimiters } from "../../api/src/routes/authSession.js";
import { asyncHandler, ErrorCode, HttpError } from "../../api/src/utils/http.js";

export const authClientIpHeader = "x-yugm-client-ip";

export interface AuthRateLimitBindings {
  AUTH_REQUESTS: RateLimit;
  AUTH_IDENTIFIER: RateLimit;
  AUTH_REFRESH: RateLimit;
}

export function createWorkerAuthRateLimiters(env: AuthRateLimitBindings): AuthRateLimiters {
  const { AUTH_REQUESTS, AUTH_IDENTIFIER, AUTH_REFRESH } = env;
  const clientIp = (req: Request) => req.get(authClientIpHeader) ?? "unknown";
  function forKey(binding: RateLimit, key: (req: Request) => string) {
    return asyncHandler(async (req, res, next) => {
      const { success } = await binding.limit({ key: key(req) });
      if (!success) {
        res.setHeader("Retry-After", "60");
        throw new HttpError(429, "Too many requests, please try again later.", ErrorCode.RATE_LIMITED);
      }
      next();
    });
  }

  return {
    authLimiter: forKey(AUTH_REQUESTS, clientIp),
    authIdentifierLimiter: forKey(AUTH_IDENTIFIER, req => authIdentifierKey(req.body, clientIp(req))),
    refreshLimiter: forKey(AUTH_REFRESH, req => refreshKey(req.body, clientIp(req)))
  };
}
