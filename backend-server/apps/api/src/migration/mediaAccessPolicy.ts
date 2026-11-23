/**
 * Design contract for the DCR-4 private-media policy.
 *
 * This module is a pure harness only. It is not imported by the runtime media
 * service, does not read MongoDB/R2 and does not grant access by itself. It
 * encodes the owner decisions recorded in ADR-0005 so future implementation
 * can be tested against one policy source.
 */
import type { QuarantineReason } from "./types.js";

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
  /** Room/clan/conversation owner, distinct from media registry owner. */
  isResourceOwner: boolean;
  /** Room host/mod/admin, clan admin or conversation admin. Platform-admin override is not included. */
  isResourceAdmin: boolean;
  /** Accepted invitee and active room/clan/conversation participant. */
  isAcceptedParticipant: boolean;
  /** Existing block or hide-for checks must still deny access. */
  isBlocked?: boolean;
  isHiddenForActor?: boolean;
}

export type MediaAccessPolicyDecision = "public" | "owner" | "resource-admin" | "participant" | "deny";

export interface PolicyDenial {
  allowed: false;
  decision: "deny";
  reason: QuarantineReason | "INVALID_MEDIA_STATE";
}

export interface PolicyGrant {
  allowed: true;
  decision: Exclude<MediaAccessPolicyDecision, "deny">;
}

export type MediaAccessPolicyResult = PolicyGrant | PolicyDenial;

export function decideMediaAccess(media: MediaAccessSubject, actor: MediaAccessActor): MediaAccessPolicyResult {
  if (media.deletedAt || media.processingStatus !== "READY" || media.moderationStatus === "REJECTED") {
    return { allowed: false, decision: "deny", reason: "INVALID_MEDIA_STATE" };
  }
  if (actor.isBlocked || actor.isHiddenForActor) {
    return { allowed: false, decision: "deny", reason: "INVALID_MEDIA_STATE" };
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
  return { allowed: false, decision: "deny", reason: "INVALID_MEDIA_STATE" };
}
