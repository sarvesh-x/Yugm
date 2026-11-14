import assert from "node:assert/strict";
import test from "node:test";
import { subscriptionPlans } from "@yugm/shared";
import {
  classifyGooglePlaySubscription,
  findSubscriptionPlan,
  subscriptionPlanMatchesPurchase,
  type GooglePlaySubscriptionPurchase
} from "./googlePlaySubscriptions.js";
import { parseGooglePlayNotification } from "./googlePlayWebhook.js";

const monthly = subscriptionPlans[0];

test("Google Play plan lookup uses the shared catalog", () => {
  assert.equal(findSubscriptionPlan(monthly.googleProductId)?.id, "MONTHLY");
  assert.equal(findSubscriptionPlan("unknown_product"), undefined);
  assert.equal(findSubscriptionPlan(undefined), undefined);
});

test("active Google Play subscriptions are treated as entitled", () => {
  const purchase: GooglePlaySubscriptionPurchase = {
    subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    paymentState: 2,
    autoRenewing: true,
    expiryTime: new Date(Date.now() + 86_400_000).toISOString(),
    lineItems: [{ productId: monthly.googleProductId, offerDetails: { basePlanId: monthly.basePlanId } }]
  };
  const classification = classifyGooglePlaySubscription(purchase);
  assert.equal(classification.status, "ACTIVE");
  assert.equal(classification.active, true);
  assert.equal(classification.paymentReceived, true);
  assert.equal(classification.autoRenewing, true);
});

test("grace-period subscriptions remain entitled", () => {
  const purchase: GooglePlaySubscriptionPurchase = {
    subscriptionState: "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
    expiryTime: new Date(Date.now() + 3_600_000).toISOString()
  };
  assert.equal(classifyGooglePlaySubscription(purchase).active, true);
});

test("expired and on-hold subscriptions are not entitled", () => {
  assert.equal(
    classifyGooglePlaySubscription({ subscriptionState: "SUBSCRIPTION_STATE_EXPIRED" }).active,
    false
  );
  assert.equal(
    classifyGooglePlaySubscription({ subscriptionState: "SUBSCRIPTION_STATE_ON_HOLD" }).active,
    false
  );
});

test("purchase plan matching checks product and base plan", () => {
  const matching: GooglePlaySubscriptionPurchase = {
    lineItems: [{ productId: monthly.googleProductId, offerDetails: { basePlanId: monthly.basePlanId } }]
  };
  assert.equal(subscriptionPlanMatchesPurchase(monthly, matching), true);

  const wrongProduct: GooglePlaySubscriptionPurchase = {
    lineItems: [{ productId: "other_product", offerDetails: { basePlanId: monthly.basePlanId } }]
  };
  assert.equal(subscriptionPlanMatchesPurchase(monthly, wrongProduct), false);

  const wrongBasePlan: GooglePlaySubscriptionPurchase = {
    lineItems: [{ productId: monthly.googleProductId, offerDetails: { basePlanId: "weekly" } }]
  };
  assert.equal(subscriptionPlanMatchesPurchase(monthly, wrongBasePlan), false);
});

test("Pub/Sub notification parsing decodes base64 subscription events", () => {
  const notification = {
    version: "1.0",
    packageName: "com.yugm.app",
    subscriptionNotification: {
      version: "1.0",
      notificationType: 2,
      purchaseToken: "token_123",
      subscriptionId: monthly.googleProductId
    }
  };
  const body = JSON.stringify({
    message: { data: Buffer.from(JSON.stringify(notification)).toString("base64") }
  });
  const parsed = parseGooglePlayNotification(body);
  assert.equal(parsed.packageName, "com.yugm.app");
  assert.equal(parsed.subscriptionNotification?.notificationType, 2);
  assert.equal(parsed.subscriptionNotification?.purchaseToken, "token_123");
});

test("Pub/Sub notification parsing rejects bodies without message data", () => {
  assert.throws(() => parseGooglePlayNotification("{}"));
});
