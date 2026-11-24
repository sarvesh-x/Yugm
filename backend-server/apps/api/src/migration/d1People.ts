import { ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { ACTIVE_COSMETIC_KEYS, AVATAR_PART_KEYS } from "./authProfileFields.js";

export function d1UserId(value: string) {
  if (!isValidObjectId(value)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  return value.toLowerCase();
}

export function visiblePerson(alias: string, viewer: string) {
  return `${alias}.is_blocked = 0 AND ${alias}.deletion_requested_at IS NULL AND NOT EXISTS (
    SELECT 1 FROM blocks WHERE
      (blocker_id = ${alias}.source_id AND blocked_user_id = ${viewer})
      OR (blocker_id = ${viewer} AND blocked_user_id = ${alias}.source_id)
  )`;
}

export function personJson(alias: string, details = false) {
  const column = (key: string) => key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  return `json_object('_id', ${alias}.source_id, 'name', ${alias}.name, 'username', ${alias}.username,
    'avatar', ${alias}.avatar, 'avatarType', ${alias}.avatar_type, 'city', ${alias}.city,
    'xp', ${alias}.xp, 'level', ${alias}.level, 'levelTitle', ${alias}.level_title,
    'vipTier', ${alias}.vip_tier, 'vipExpiresAt', ${alias}.vip_expires_at,
    'avatarParts', json_object(${AVATAR_PART_KEYS.map(key => `'${key}', ${alias}.avatar_parts_${key}`).join(", ")}),
    'activeCosmetics', json_object(${ACTIVE_COSMETIC_KEYS.map(key => `'${key}', ${alias}.active_cosmetics_${column(key)}`).join(", ")})${details
      ? `, 'bio', ${alias}.bio, 'followersCount', ${alias}.followers_count,
          'isVerified', json(CASE WHEN ${alias}.is_verified = 1 THEN 'true' ELSE 'false' END)`
      : ""})`;
}

export function person(record: string) {
  const { avatarParts, activeCosmetics, ...fields } = JSON.parse(record) as Record<string, unknown>;
  const present = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).filter(([, item]) => item != null));
  const parts = present(avatarParts as Record<string, unknown>);
  return {
    ...present(fields),
    avatarParts: Object.keys(parts).length ? parts : undefined,
    activeCosmetics: present(activeCosmetics as Record<string, unknown>)
  };
}
