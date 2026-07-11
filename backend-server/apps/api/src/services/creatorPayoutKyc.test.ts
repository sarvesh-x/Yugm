import assert from "node:assert/strict";
import test from "node:test";
import { publicCreatorPayoutKyc } from "./creatorPayoutKyc.js";

test("creator payout KYC never exposes encrypted or raw identifiers", () => {
  const payload = publicCreatorPayoutKyc({
    _id: "kyc-1",
    userId: "user-1",
    panNumberEncrypted: "encrypted-pan",
    upiIdEncrypted: "encrypted-upi",
    bankAccountEncrypted: "encrypted-bank",
    panLast4: "1234",
    upiIdMasked: "sa***@upi",
    bankAccountLast4: "5678",
    kycStatus: "PENDING"
  }, true);

  assert.equal(payload.panLast4, "1234");
  assert.equal(payload.upiIdMasked, "sa***@upi");
  assert.equal(payload.bankAccountLast4, "5678");
  assert.equal(payload.sensitiveFieldsMasked, true);
  assert.equal("panNumber" in payload, false);
  assert.equal("upiId" in payload, false);
  assert.equal("bankAccount" in payload, false);
  assert.equal("panNumberEncrypted" in payload, false);
});
