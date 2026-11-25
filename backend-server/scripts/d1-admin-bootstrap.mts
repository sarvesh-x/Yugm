import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";

const target = process.argv[2];
if (target !== "local" && target !== "production") {
  console.error("Usage: npm run d1:admin:sql -- local|production");
  process.exit(1);
}
const email = z.string().trim().email().max(254).parse(process.env.YUGM_BOOTSTRAP_ADMIN_EMAIL).toLowerCase();
const firebaseUid = target === "production" ? z.string().trim().min(1).max(128).parse(process.env.YUGM_BOOTSTRAP_FIREBASE_UID) : null;
const passwordHash = target === "local"
  ? await bcrypt.hash(z.string().min(12).refine(value => Buffer.byteLength(value, "utf8") <= 72,
    "Maximum 72 UTF-8 bytes").parse(process.env.YUGM_BOOTSTRAP_ADMIN_PASSWORD), 12) : null;
const id = randomBytes(12).toString("hex");
const quote = (value: string | null) => value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`;

process.stdout.write(`INSERT INTO admin_users (source_id, email, display_name, role, status, is_super_admin, two_factor_enabled,
  password_hash, firebase_uid, created_at, updated_at)
SELECT ${quote(id)}, ${quote(email)}, 'Yugm administrator', 'SUPER_ADMIN', 'ACTIVE', 1, 0,
  ${quote(passwordHash)}, ${quote(firebaseUid)}, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE NOT EXISTS (SELECT 1 FROM admin_users);
`);
