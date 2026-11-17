import { ErrorCode, HttpError } from "../utils/http.js";

export interface RoomGiftIntent {
  senderId: string;
  roomId: string;
  giftId: string;
  receiverId: string;
  currency: "COINS" | "DIAMONDS";
}

interface StoredGiftIntent {
  senderId: unknown;
  roomId?: unknown;
  giftId: unknown;
  receiverId: unknown;
  currency?: string | null;
  type?: string | null;
  metadata?: Record<string, unknown> | null;
}

function canonicalId(value: unknown): string {
  const reference = value && typeof value === "object" && "_id" in value ? value._id : value;
  return reference == null ? "" : String(reference).toLowerCase();
}

/** Match immutable request input, never today's catalog price or other mutable quote data. */
export function assertRoomGiftReplayMatches(previous: StoredGiftIntent, intent: RoomGiftIntent): void {
  const sameIntent = canonicalId(previous.senderId) === canonicalId(intent.senderId)
    && canonicalId(previous.roomId) === canonicalId(intent.roomId)
    && canonicalId(previous.giftId) === canonicalId(intent.giftId)
    && canonicalId(previous.receiverId) === canonicalId(intent.receiverId)
    && (previous.currency ?? "COINS") === intent.currency
    && (previous.type ?? "send") === "send"
    && previous.metadata?.pkBattleId == null
    && (previous.metadata?.command == null || previous.metadata.command === "ROOM_GIFT");
  if (!sameIntent) {
    throw new HttpError(409, "Gift request key was already used for different input", ErrorCode.CONFLICT);
  }
}

/** A transfer owns distinct ledger legs, regardless of keys chosen by any sender. */
export function roomGiftLedgerKeys(transferId: string) {
  return { debit: `gift:${transferId}:debit`, credit: `gift:${transferId}:credit` };
}
