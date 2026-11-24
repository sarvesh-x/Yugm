export const DAILY_REWARD_COINS = 25;
export const DAILY_REWARD_SOURCE = "DAILY_REWARD";

export function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function nextUtcDay(date = new Date()) {
  const start = startOfUtcDay(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}
