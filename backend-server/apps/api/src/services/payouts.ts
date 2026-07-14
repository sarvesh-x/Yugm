import crypto from "crypto";
import { env } from "../config/env.js";
import { ErrorCode, HttpError } from "../utils/http.js";

export interface PayoutRecipient {
  userId: string;
  legalFullName: string;
  upiId?: string;
  bankAccount?: { accountNumber: string; ifsc: string; holderName: string };
}

export interface PayoutResult {
  success: boolean;
  payoutId: string;
  reference: string;
  status: string;
  providerName: string;
  fee?: number;
  errorMessage?: string;
}

export interface PayoutProvider {
  readonly name: string;
  transfer(recipient: PayoutRecipient, amountInr: number, notes?: string): Promise<PayoutResult>;
}

const FUND_ACCOUNT_CACHE = new Map<string, { fundAccountId: string; createdAt: Date }>();

class RazorpayPayoutProvider implements PayoutProvider {
  readonly name = "razorpay";

  private requireConfig() {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new HttpError(503, "Razorpay payouts are not configured", ErrorCode.VALIDATION);
    }
    return { keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET };
  }

  private authHeader() {
    const { keyId, keySecret } = this.requireConfig();
    return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
  }

  private async createFundAccount(recipient: PayoutRecipient): Promise<string> {
    const cached = FUND_ACCOUNT_CACHE.get(recipient.userId);
    if (cached && Date.now() - cached.createdAt.getTime() < 86400000) {
      return cached.fundAccountId;
    }

    let contactId: string;
    const contactRes = await fetch("https://api.razorpay.com/v1/contacts", {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: recipient.legalFullName,
        reference_id: recipient.userId,
        notes: { userId: recipient.userId }
      })
    });
    const contactJson = await contactRes.json().catch(() => ({}));
    if (!contactRes.ok) {
      throw new HttpError(502, `Failed to create Razorpay contact: ${contactJson?.error?.description ?? "Unknown error"}`, ErrorCode.VALIDATION);
    }
    contactId = contactJson.id;

    let fundAccountBody: Record<string, unknown>;
    if (recipient.upiId) {
      fundAccountBody = {
        contact_id: contactId,
        account_type: "vpa",
        vpa: { address: recipient.upiId }
      };
    } else if (recipient.bankAccount) {
      fundAccountBody = {
        contact_id: contactId,
        account_type: "bank_account",
        bank_account: {
          name: recipient.bankAccount.holderName,
          ifsc: recipient.bankAccount.ifsc,
          account_number: recipient.bankAccount.accountNumber
        }
      };
    } else {
      throw new HttpError(400, "No payout method configured (UPI or bank account)", ErrorCode.VALIDATION);
    }

    const faRes = await fetch("https://api.razorpay.com/v1/fund_accounts", {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(fundAccountBody)
    });
    const faJson = await faRes.json().catch(() => ({}));
    if (!faRes.ok) {
      throw new HttpError(502, `Failed to create Razorpay fund account: ${faJson?.error?.description ?? "Unknown error"}`, ErrorCode.VALIDATION);
    }

    FUND_ACCOUNT_CACHE.set(recipient.userId, { fundAccountId: faJson.id, createdAt: new Date() });
    return faJson.id;
  }

  async transfer(recipient: PayoutRecipient, amountInr: number, notes?: string): Promise<PayoutResult> {
    const amountInPaise = Math.round(amountInr * 100);
    if (amountInPaise < 100) {
      return { success: false, payoutId: "", reference: "", status: "failed", providerName: this.name, errorMessage: "Minimum payout is ₹1.00" };
    }

    const fundAccountId = await this.createFundAccount(recipient);
    const idempotencyKey = crypto.randomUUID();

    const response = await fetch("https://api.razorpay.com/v1/payouts", {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
        "X-Razorpay-Idempotency": idempotencyKey
      },
      body: JSON.stringify({
        fund_account_id: fundAccountId,
        amount: amountInPaise,
        currency: "INR",
        mode: recipient.upiId ? "UPI" : "IMPS",
        purpose: "payout",
        queue_if_low_balance: true,
        reference_id: `payout_${recipient.userId}_${Date.now()}`,
        notes: { userId: recipient.userId, ...(notes ? { notes } : {}) }
      })
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        payoutId: json.id ?? "",
        reference: json.id ?? "",
        status: json.status ?? "failed",
        providerName: this.name,
        errorMessage: json?.error?.description ?? "Razorpay payout failed"
      };
    }

    return {
      success: json.status === "processed" || json.status === "queued",
      payoutId: json.id,
      reference: json.id,
      status: json.status,
      providerName: this.name,
      fee: json.fee ?? 0
    };
  }
}

class NoopPayoutProvider implements PayoutProvider {
  readonly name = "noop";

  async transfer(_recipient: PayoutRecipient, amountInr: number, notes?: string): Promise<PayoutResult> {
    return {
      success: true,
      payoutId: `noop_${Date.now()}`,
      reference: notes ?? `noop_${Date.now()}`,
      status: "processed",
      providerName: this.name
    };
  }
}

let _payoutProvider: PayoutProvider | null = null;

export function getPayoutProvider(): PayoutProvider {
  if (_payoutProvider) return _payoutProvider;
  _payoutProvider = env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
    ? new RazorpayPayoutProvider()
    : new NoopPayoutProvider();
  return _payoutProvider;
}

export function resetPayoutProvider(): void {
  _payoutProvider = null;
  FUND_ACCOUNT_CACHE.clear();
}
