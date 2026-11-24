import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { getAppCheck } from "firebase-admin/app-check";

test("the mounted auth App Check gate rejects missing, invalid and consumed tokens", async (t) => {
  // Exercise the production enforcement branch on a loopback-only API with a stubbed SDK.
  process.env.NODE_ENV = "production";
  process.env.YUGM_RUNTIME = "cloudflare";
  process.env.MONGODB_URI = "mongodb://127.0.0.1:1/yugm-app-check-fixture";
  process.env.REDIS_URL = "";
  process.env.JWT_SECRET = "local-app-check-test-secret";
  process.env.APP_CHECK_ENFORCE = "true";
  process.env.FCM_PROJECT_ID = "yugm-app-check-fixture";
  process.env.FCM_CLIENT_EMAIL = "fixture@example.test";
  process.env.FCM_PRIVATE_KEY = generateKeyPairSync("rsa", { modulusLength: 2048 })
    .privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  const [{ createApp }, { initFirebase }, { default: admin }] = await Promise.all([
    import("../app.js"),
    import("../services/firebase.js"),
    import("firebase-admin")
  ]);
  await initFirebase();
  t.after(() => admin.app().delete());

  const appCheck = getAppCheck(admin.app());
  const seen = new Set<string>();
  const verify = t.mock.method(appCheck, "verifyToken", async (...[token, options]: Parameters<typeof appCheck.verifyToken>) => {
    assert.deepEqual(options, { consume: true });
    if (token === "invalid-fixture") throw new Error("Invalid fixture token");
    assert.equal(token, "limited-use-fixture");
    const alreadyConsumed = seen.has(token);
    seen.add(token);
    return {
      alreadyConsumed, appId: "fixture-app",
      token: { sub: "fixture-app", iss: "fixture-issuer", aud: [], exp: 0, iat: 0 }
    };
  });

  const server = createApp().listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${port}/api/auth/me`;

    async function verifyResponse(message: string, token?: string) {
      const response = await fetch(url, { headers: token ? { "X-Firebase-AppCheck": token } : {} });
      assert.equal(response.status, 401);
      const body = await response.json() as { ok: boolean; error: { code: string; message: string } };
      assert.equal(body.ok, false);
      assert.equal(body.error.code, "UNAUTHORIZED");
      assert.equal(body.error.message, message);
    }

    await verifyResponse("App verification token is required");
    assert.equal(verify.mock.callCount(), 0);
    await verifyResponse("App verification failed", "invalid-fixture");
    // A valid app token reaches the independent user-auth gate.
    await verifyResponse("Missing auth token", "limited-use-fixture");
    await verifyResponse("App verification token has already been used", "limited-use-fixture");
    assert.deepEqual(verify.mock.calls.map(({ arguments: args }) => args), [
      ["invalid-fixture", { consume: true }],
      ["limited-use-fixture", { consume: true }],
      ["limited-use-fixture", { consume: true }]
    ]);
  } finally {
    const closed = once(server, "close");
    server.close();
    await closed;
  }
});
