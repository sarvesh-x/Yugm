import { profileSchema } from "@yugm/shared";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { asAuthUser } from "../services/authAccounts.js";
import { mongoAuthAccountStore } from "../services/mongoAuthAccounts.js";
import { mongoAuthSessionStore } from "../services/mongoAuthSessionStore.js";
import { updateProfileForUser } from "../services/profileUpdate.js";
import { disconnectOtherUserSockets, disconnectUserSockets } from "../services/socket.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { createAuthSessionRouter, publicAuthUser } from "./authSession.js";

export const authRouter = createAuthSessionRouter({
  accounts: mongoAuthAccountStore,
  sessions: mongoAuthSessionStore,
  enforceSession: requireAuth,
  onSessionIssued: disconnectOtherUserSockets,
  onLogout: disconnectUserSockets
});

authRouter.patch("/profile", requireAuth, validateBody(profileSchema.partial()), asyncHandler(async (req: AuthRequest, res) => {
  const { user, xpGrant } = await updateProfileForUser(req.user!.id, req.body);
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  sendOk(res, { user: publicAuthUser(asAuthUser(user)), xpGrant });
}));
