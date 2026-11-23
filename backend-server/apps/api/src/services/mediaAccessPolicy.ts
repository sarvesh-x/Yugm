/**
 * Pure, source-of-truth policy for private media access.
 *
 * The runtime resolver supplies authoritative resource facts; this module only
 * decides the outcome. It has no database, storage or credential access.
 */

export interface MediaAccessSubject {
  ownerType: string;
  ownerId: string;
  visibility: string;
  deletedAt?: unknown;
  processingStatus: string;
  moderationStatus: string;
}

export interface MediaAccessActor {
  userId: string;
  /** USER-owned media where ownerId is the actor. */
  isMediaOwner: boolean;
  /** Room/clan/conversation owner, distinct from the media registry owner. */
  isResourceOwner: boolean;
  /** Room host-side admins or clan admins. Platform-admin override is not included. */
  isResourceAdmin: boolean;
  /** Accepted invitee and active room/clan/conversation participant. */
  isAcceptedParticipant: boolean;
  isBlocked?: boolean;
  isHiddenForActor?: boolean;
}

export type MediaAccessPolicyDecision = "public" | "owner" | "resource-admin" | "participant" | "deny";
export type MediaAccessDenialReason = "INVALID_MEDIA_STATE" | "BLOCKED_OR_HIDDEN" | "NO_ACCESS";

export type MediaAccessPolicyResult =
  | { allowed: true; decision: Exclude<MediaAccessPolicyDecision, "deny"> }
  | { allowed: false; decision: "deny"; reason: MediaAccessDenialReason };

export function decideMediaAccess(media: MediaAccessSubject, actor: MediaAccessActor): MediaAccessPolicyResult {
  if (media.deletedAt || media.processingStatus !== "READY" || media.moderationStatus === "REJECTED") {
    return { allowed: false, decision: "deny", reason: "INVALID_MEDIA_STATE" };
  }
  if (actor.isBlocked || actor.isHiddenForActor) {
    return { allowed: false, decision: "deny", reason: "BLOCKED_OR_HIDDEN" };
  }
  if (actor.isMediaOwner || actor.isResourceOwner) {
    return { allowed: true, decision: "owner" };
  }
  if (media.visibility !== "PRIVATE") {
    return { allowed: true, decision: "public" };
  }
  if (actor.isResourceAdmin) {
    return { allowed: true, decision: "resource-admin" };
  }
  if (actor.isAcceptedParticipant) {
    return { allowed: true, decision: "participant" };
  }
  return { allowed: false, decision: "deny", reason: "NO_ACCESS" };
}
