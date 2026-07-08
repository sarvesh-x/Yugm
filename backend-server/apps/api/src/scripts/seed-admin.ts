import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { env } from "../config/env.js";
import { AdminUser } from "../models/AdminUser.js";
import { AppConfig } from "../models/AppConfig.js";

const defaultConfigs = [
  ["minimum_withdrawal_amount", 500, "Minimum coins/INR-equivalent required before host withdrawal"],
  ["host_earning_percentage_default", 50, "Default host earning percentage from gifts"],
  ["daily_free_coin_amount", 0, "Daily free coins, if enabled"],
  ["max_voice_room_speakers", 12, "Maximum speakers in voice rooms"],
  ["max_video_room_speakers", 4, "Maximum speakers in video rooms"],
  ["profile_review_required", true, "Whether profile review is required before full discovery"],
  ["new_user_free_coins", 0, "Coins granted to new users"],
  ["report_auto_escalation_threshold", 3, "Reports needed before automatic escalation"],
  ["chat_spam_message_limit", 8, "Repeated messages per minute before spam risk"],
  ["maintenance_mode", false, "Global maintenance mode flag"],
  ["force_update_android", false, "Force Android client update"],
  ["force_update_ios", false, "Force iOS client update"]
] as const;

async function upsertAdmin(email: string, displayName: string, role: string, firebaseUid?: string, password?: string) {
  const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
  return AdminUser.findOneAndUpdate(
    { email: email.toLowerCase() },
    {
      $setOnInsert: {
        email,
        displayName,
        role,
        firebaseUid,
        passwordHash,
        status: firebaseUid || passwordHash ? "ACTIVE" : "INVITED",
        isSuperAdmin: role === "SUPER_ADMIN"
      }
    },
    { upsert: true, new: true }
  );
}

async function main() {
  await connectDatabase();
  if (env.SEED_SUPER_ADMIN_EMAIL && env.SEED_SUPER_ADMIN_NAME) {
    await upsertAdmin(env.SEED_SUPER_ADMIN_EMAIL, env.SEED_SUPER_ADMIN_NAME, "SUPER_ADMIN", env.SEED_SUPER_ADMIN_FIREBASE_UID, env.SEED_SUPER_ADMIN_PASSWORD);
    console.log(`Seeded super admin: ${env.SEED_SUPER_ADMIN_EMAIL}`);
  } else {
    console.log("Skipped super admin seed: set SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_NAME");
  }

  const roleSeeds = [
    ["admin@example.internal", "Admin", "ADMIN"],
    ["moderator@example.internal", "Moderator", "MODERATOR"],
    ["finance@example.internal", "Finance Manager", "FINANCE_MANAGER"],
    ["support@example.internal", "Support Agent", "SUPPORT_AGENT"],
    ["content@example.internal", "Content Reviewer", "CONTENT_REVIEWER"]
  ] as const;
  for (const [email, name, role] of roleSeeds) {
    await upsertAdmin(email, name, role);
  }

  for (const [key, value, description] of defaultConfigs) {
    await AppConfig.updateOne({ key }, { $setOnInsert: { key, value, description } }, { upsert: true });
  }
  console.log("Seeded admin roles and app config defaults");
  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
