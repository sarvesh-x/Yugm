import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { Gift } from "../models/Gift.js";
import { baseGifts } from "../services/giftSeedCatalog.js";

async function main() {
  await connectDatabase();
  let created = 0;
  let updated = 0;
  for (const gift of baseGifts) {
    const existing = await Gift.findOne({ name: gift.name });
    if (existing) {
      await Gift.updateOne({ _id: existing._id }, { $set: gift });
      updated++;
    } else {
      await Gift.create({ ...gift, isActive: true });
      created++;
    }
  }
  console.log(`Seeded gifts: ${created} created, ${updated} updated (total ${baseGifts.length}).`);
  await disconnectDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
