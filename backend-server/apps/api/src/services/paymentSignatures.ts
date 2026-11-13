import crypto from "node:crypto";

function timingSafeHexEqual(expected: string, actual: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expected) || !/^[a-f0-9]{64}$/i.test(actual)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
}

export function computeRazorpayPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  keySecret: string;
}): string {
  return crypto
    .createHmac("sha256", input.keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
}

export function verifyRazorpayPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const expected = computeRazorpayPaymentSignature({
    orderId: input.orderId,
    paymentId: input.paymentId,
    keySecret: input.keySecret
  });
  return timingSafeHexEqual(expected, input.signature);
}

export function isValidRazorpayWebhook(body: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  try {
    return timingSafeHexEqual(expected, signature);
  } catch {
    return false;
  }
}
