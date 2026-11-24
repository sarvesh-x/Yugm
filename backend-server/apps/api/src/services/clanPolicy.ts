import { z } from "zod";

const avatarSchema = z.string().refine(
  (v) => /^https?:\/\//i.test(v) || /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(v),
  "Avatar must be an http(s) URL or a data image URL"
);

export const clanSchema = z.object({
  name: z.string().min(3).max(48),
  description: z.string().max(220).optional(),
  avatar: avatarSchema.optional(),
  privacy: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  familyLabel: z.string().min(2).max(32).default("Family")
});
export const clanMemberIdSchema = z.object({ userId: z.string().regex(/^[0-9a-fA-F]{24}$/) });
export const clanMemberRoleSchema = z.object({ role: z.enum(["CO_LEADER", "OFFICER", "MEMBER"]) });
export const clanMessageSchema = z.object({ message: z.string().min(1).max(600) });
export const clanMessageReportSchema = z.object({
  reason: z.string().min(2).max(80),
  description: z.string().max(500).optional()
});
export const CLAN_INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const clanUpdateSchema = z.object({
  name: z.string().min(3).max(48).optional(),
  description: z.string().max(220).nullable().optional(),
  avatar: avatarSchema.nullable().optional(),
  privacy: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  familyLabel: z.string().min(2).max(32).optional()
}).refine((value) => Object.values(value).some((entry) => entry !== undefined), {
  message: "Provide at least one clan setting to update"
});
export function slugifyClan(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 42) || "clan";
}

export function canManageClan(role: string | null) {
  return role === "LEADER" || role === "CO_LEADER";
}

export function canInviteMembers(role: string | null) {
  return role === "LEADER" || role === "CO_LEADER" || role === "OFFICER";
}

export function canModerateChat(role: string | null) {
  return role === "LEADER" || role === "CO_LEADER" || role === "OFFICER";
}

export function canAssignRole(actorRole: string | null, targetRole: string | null, nextRole: string) {
  if (actorRole === "LEADER") return nextRole === "CO_LEADER" || nextRole === "OFFICER" || nextRole === "MEMBER";
  if (actorRole !== "CO_LEADER" || targetRole === "CO_LEADER" || targetRole === "LEADER") return false;
  return nextRole === "OFFICER" || nextRole === "MEMBER";
}

export function canRemoveMember(actorRole: string | null, targetRole: string | null) {
  if (actorRole === "LEADER") return targetRole !== "LEADER";
  return actorRole === "CO_LEADER" && (targetRole === "MEMBER" || targetRole === "OFFICER");
}
