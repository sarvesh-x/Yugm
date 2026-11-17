import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { Gift } from "../models/Gift.js";

const APPLY = process.argv.includes("--apply");

async function main() {
  if (APPLY && process.env.PK_GIFT_POINTS_BACKFILL_CONFIRM !== "YES") {
    throw new Error("Refusing to write. Set PK_GIFT_POINTS_BACKFILL_CONFIRM=YES after reviewing the dry run against staging.");
  }
  await connectDatabase();
  try {
    const missing = await Gift.find({ $or: [{ pkPoints: { $exists: false } }, { pkPoints: 0 }] }).select("_id name coinPrice pkPoints").lean();
    if (APPLY && missing.length) {
      await Gift.bulkWrite(missing.map((gift) => ({
        updateOne: { filter: { _id: gift._id, $or: [{ pkPoints: { $exists: false } }, { pkPoints: 0 }] }, update: { $set: { pkPoints: gift.coinPrice } } }
      })), { ordered: false });
    }
    console.log(`${APPLY ? "Updated" : "Would update"} ${missing.length} gifts with initial PK points from coin price; points remain separately editable afterward.`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
