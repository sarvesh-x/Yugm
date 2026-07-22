import { env } from "../config/env.js";

export interface OtpProvider {
  sendOtp(identifier: string): Promise<{ success: boolean; channel: string; messageId?: string }>;
  verifyOtp(identifier: string, otp: string): Promise<boolean>;
}

class DevOtpProvider implements OtpProvider {
  private store = new Map<string, { otp: string; expiresAt: number }>();

  async sendOtp(identifier: string) {
    const otp = env.DEV_BYPASS_OTP || "123456";
    this.store.set(identifier, { otp, expiresAt: Date.now() + 300_000 });
    console.log(`[DEV OTP] OTP for ${identifier}: ${otp}`);
    return { success: true, channel: identifier.includes("@") ? "email" : "phone" };
  }

  async verifyOtp(identifier: string, otp: string) {
    const stored = this.store.get(identifier);
    if (stored && stored.otp === otp && stored.expiresAt > Date.now()) {
      this.store.delete(identifier);
      return true;
    }
    return false;
  }
}

let provider: OtpProvider = new DevOtpProvider();

export function getOtpProvider(): OtpProvider {
  return provider;
}

export function setOtpProvider(custom: OtpProvider) {
  provider = custom;
}
