import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { Gift } from "../models/Gift.js";

const baseGifts = [
  { name: "Rose", icon: "🌹", coinPrice: 10, pkPoints: 10, diamondPrice: 0, category: "normal", rarity: "common", tradable: true },
  { name: "Heart", icon: "❤️", coinPrice: 25, pkPoints: 25, diamondPrice: 0, category: "normal", rarity: "common", tradable: true },
  { name: "Star", icon: "⭐", coinPrice: 50, pkPoints: 50, diamondPrice: 0, category: "normal", rarity: "rare", tradable: true },
  { name: "Firework", icon: "🎆", coinPrice: 99, pkPoints: 99, diamondPrice: 2, category: "premium", rarity: "rare", tradable: true },
  { name: "Crown", icon: "👑", coinPrice: 299, pkPoints: 299, diamondPrice: 5, category: "premium", rarity: "epic", tradable: true, upgradeable: true, upgradePath: [] },
  { name: "Diamond", icon: "💎", coinPrice: 499, pkPoints: 499, diamondPrice: 10, category: "luxury", rarity: "legendary", tradable: true },
  { name: "Rocket", icon: "🚀", coinPrice: 999, pkPoints: 999, diamondPrice: 20, category: "luxury", rarity: "legendary", tradable: true },
  { name: "Dragon", icon: "🐉", coinPrice: 1999, pkPoints: 1999, diamondPrice: 40, category: "luxury", rarity: "mythic", tradable: true, limitedEdition: { active: true, total: 100, remaining: 100 } }
];

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
