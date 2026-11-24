import { z } from "zod";

export const datingPreferenceSchema = z.object({
  interestedIn: z.enum(["Everyone", "Women", "Men", "Non-binary"]),
  lookingFor: z.enum(["Friendship", "Dating", "Relationship", "Networking"]),
  datingAgeMin: z.number().int().min(18).max(80),
  datingAgeMax: z.number().int().min(18).max(80),
  verifiedOnly: z.boolean().optional()
}).refine(value => value.datingAgeMin <= value.datingAgeMax, {
  message: "Minimum age must be below maximum age", path: ["datingAgeMin"]
});
