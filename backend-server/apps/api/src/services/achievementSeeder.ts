import { Achievement } from "../models/Achievement.js";
import { defaultAchievements } from "./achievementDefinitions.js";

export async function seedAchievements() {
  const result = await Achievement.bulkWrite(defaultAchievements.map(def => ({
    updateOne: {
      filter: { id: def.id },
      update: { $setOnInsert: def },
      upsert: true
    }
  })), { ordered: false });
  const inserted = result.upsertedCount ?? 0;
  if (inserted > 0) console.log(`Seeded ${inserted} progression achievements`);
}
