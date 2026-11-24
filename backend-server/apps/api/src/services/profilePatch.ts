import { ErrorCode, HttpError } from "../utils/http.js";
import { normalizeProfileUpdate } from "./profileCompletion.js";

const PROFILE_FIELDS = [
  "name", "username", "gender", "age", "city", "state", "bio", "vibeLine",
  "interests", "hobbies", "languages", "avatar", "interestedIn", "lookingFor",
  "datingAgeMin", "datingAgeMax"
] as const;

export function profilePatch(body: Record<string, unknown>) {
  const normalized = normalizeProfileUpdate(body);
  const update: Record<string, unknown> = {};
  for (const field of PROFILE_FIELDS) {
    if (field in normalized) update[field] = normalized[field];
  }

  const avatarType = body.avatarType;
  if (avatarType !== undefined) {
    if (!["UPLOADED", "GENERATED", "DEFAULT"].includes(String(avatarType))) {
      throw new HttpError(400, "Invalid avatar type", ErrorCode.VALIDATION);
    }
    update.avatarType = avatarType;
    if (avatarType === "GENERATED") update.avatar = null;
    if (avatarType === "UPLOADED" || avatarType === "DEFAULT") update.avatarParts = null;
  }

  const avatarParts = body.avatarParts;
  if (avatarParts !== undefined) {
    if (!avatarParts || typeof avatarParts !== "object" || Array.isArray(avatarParts)) {
      throw new HttpError(400, "Invalid avatar parts", ErrorCode.VALIDATION);
    }
    const parts = avatarParts as Record<string, unknown>;
    const keys = ["background", "clothes", "head", "mouth", "eyes", "top"];
    for (const key of keys) {
      if (!Number.isInteger(parts[key]) || (parts[key] as number) < 0 || (parts[key] as number) > 47) {
        throw new HttpError(400, "Invalid avatar part", ErrorCode.VALIDATION);
      }
    }
    update.avatarParts = {
      background: parts.background,
      clothes: parts.clothes,
      head: parts.head,
      mouth: parts.mouth,
      eyes: parts.eyes,
      top: parts.top
    };
    update.avatarType = "GENERATED";
  }
  return update;
}
