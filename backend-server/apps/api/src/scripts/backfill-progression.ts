import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { User } from "../models/User.js";
import { calculateLevel } from "../services/levels.js";

const APPLY = process.argv.includes("--apply");
const BATCH_SIZE = 500;

async function main() {
  if (APPLY && process.env.PROGRESSION_BACKFILL_CONFIRM !== "YES") {
    throw new Error("Refusing to write. Set PROGRESSION_BACKFILL_CONFIRM=YES after validating the dry-run against a staging snapshot.");
  }

  await connectDatabase();
  let scanned = 0;
  let changed = 0;
  let operations: Array<{
    updateOne: {
      filter: { _id: unknown };
      update: { $set: { level: number; levelTitle: string } };
    };
  }> = [];

  const flush = async () => {
    if (operations.length === 0) return;
    if (APPLY) await User.bulkWrite(operations, { ordered: false });
    operations = [];
  };

  try {
    const cursor = User.find().select("_id xp level levelTitle").lean().cursor({ batchSize: BATCH_SIZE });
    for await (const user of cursor) {
      scanned += 1;
      const status = calculateLevel(Math.max(0, Number(user.xp ?? 0)));
      if (user.level !== status.level || user.levelTitle !== status.title) {
        changed += 1;
        operations.push({
          updateOne: {
            filter: { _id: user._id },
            update: { $set: { level: status.level, levelTitle: status.title } }
          }
        });
      }
      if (operations.length >= BATCH_SIZE) await flush();
    }
    await flush();
    console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", scanned, changed, batchSize: BATCH_SIZE }));
    if (!APPLY) console.log("No data changed. Re-run with --apply and PROGRESSION_BACKFILL_CONFIRM=YES to write these values.");
  } finally {
    await disconnectDatabase();
  }
}

main().catch(async (error) => {
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
