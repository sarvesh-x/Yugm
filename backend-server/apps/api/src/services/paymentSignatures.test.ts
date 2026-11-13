import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  computeRazorpayPaymentSignature,
  isValidRazorpayWebhook,
  verifyRazorpayPaymentSignature
} from "./paymentSignatures.js";

const KEY_SECRET = "test-razorpay-key-secret";
const WEBHOOK_SECRET = "test-razorpay-webhook-secret";

function hmac(body: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

test("computeRazorpayPaymentSignature matches Razorpay's documented HMAC format", () => {
  const signature = computeRazorpayPaymentSignature({
    orderId: "order_123",
    paymentId: "pay_456",
    keySecret: KEY_SECRET
  });
  assert.equal(signature, hmac("order_123|pay_456", KEY_SECRET));
});

test("verifyRazorpayPaymentSignature accepts a valid signature", () => {
  const signature = computeRazorpayPaymentSignature({
    orderId: "order_123",
    paymentId: "pay_456",
    keySecret: KEY_SECRET
  });
  assert.equal(
    verifyRazorpayPaymentSignature({ orderId: "order_123", paymentId: "pay_456", signature, keySecret: KEY_SECRET }),
    true
  );
});

test("verifyRazorpayPaymentSignature rejects a signature from another payment", () => {
  const signature = computeRazorpayPaymentSignature({
    orderId: "order_123",
    paymentId: "pay_456",
    keySecret: KEY_SECRET
  });
  assert.equal(
    verifyRazorpayPaymentSignature({ orderId: "order_123", paymentId: "pay_999", signature, keySecret: KEY_SECRET }),
    false
  );
});

test("verifyRazorpayPaymentSignature rejects a wrong-length signature without throwing", () => {
  assert.equal(
    verifyRazorpayPaymentSignature({ orderId: "order_123", paymentId: "pay_456", signature: "abc", keySecret: KEY_SECRET }),
    false
  );
});

test("verifyRazorpayPaymentSignature rejects a signature made with a different secret", () => {
  const signature = hmac("order_123|pay_456", "attacker-secret");
  assert.equal(
    verifyRazorpayPaymentSignature({ orderId: "order_123", paymentId: "pay_456", signature, keySecret: KEY_SECRET }),
    false
  );
});

test("isValidRazorpayWebhook accepts a valid body signature", () => {
  const body = JSON.stringify({ event: "payout.processed", payload: { payout: { id: "pout_1" } } });
  assert.equal(isValidRazorpayWebhook(body, hmac(body, WEBHOOK_SECRET), WEBHOOK_SECRET), true);
});

test("isValidRazorpayWebhook rejects a tampered body", () => {
  const body = JSON.stringify({ event: "payout.processed", payload: { payout: { id: "pout_1" } } });
  const signature = hmac(body, WEBHOOK_SECRET);
  const tampered = JSON.stringify({ event: "payout.processed", payload: { payout: { id: "pout_2" } } });
  assert.equal(isValidRazorpayWebhook(tampered, signature, WEBHOOK_SECRET), false);
});

test("isValidRazorpayWebhook rejects a wrong-length signature without throwing", () => {
  assert.equal(isValidRazorpayWebhook("{}", "not-a-hex-signature", WEBHOOK_SECRET), false);
});
