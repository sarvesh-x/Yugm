import { Block } from "../models/Block.js";
import { ErrorCode, HttpError } from "../utils/http.js";

export async function areUsersBlocked(userA: string, userB: string) {
  if (!userA || !userB || userA === userB) return false;
  return Boolean(await Block.exists({
    $or: [
      { blockerId: userA, blockedUserId: userB },
      { blockerId: userB, blockedUserId: userA }
    ]
  }));
}

export async function assertUsersCanInteract(userA: string, userB: string, message = "Cannot interact with this user") {
  if (await areUsersBlocked(userA, userB)) {
    throw new HttpError(403, message, ErrorCode.FORBIDDEN);
  }
}
