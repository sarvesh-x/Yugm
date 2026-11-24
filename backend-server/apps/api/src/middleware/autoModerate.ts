import { applyAutoModeration } from "../services/autoModeration.js";
import { ErrorCode, HttpError } from "../utils/http.js";

export function autoModerate(...fields: string[]) {
  return async (req: any, _res: any, next: any) => {
    for (const field of fields) {
      const text = req.body?.[field];
      if (!text || typeof text !== "string") continue;
      const result = await applyAutoModeration(req.user?._id, text, { type: req.path });
      if (result.action === "BLOCK") {
        return next(new HttpError(400, "Content was blocked by auto-moderation", ErrorCode.CONTENT_BLOCKED));
      }
    }
    next();
  };
}
