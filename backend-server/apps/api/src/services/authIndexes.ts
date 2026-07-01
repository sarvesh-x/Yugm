import { User } from "../models/User.js";

export async function ensureAuthIndexes() {
  await User.syncIndexes();
  console.log("Auth indexes ready");
}
