export const PLATFORM_FEE_PERCENTAGE = 10;
export const CREATOR_SHARE_PERCENTAGE = 100 - PLATFORM_FEE_PERCENTAGE;

export function platformFee(amount: number) {
  return Math.floor(amount * PLATFORM_FEE_PERCENTAGE / 100);
}

export function creatorShare(amount: number) {
  return amount - platformFee(amount);
}
