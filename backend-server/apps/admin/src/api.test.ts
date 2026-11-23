import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  adminApi,
  adminApiMultipart,
  adminApiWithMeta,
  ApiError,
  formatDate,
  formatNumber,
} from "./api.js";

type FetchCall = { url: string; init: RequestInit };
const calls: FetchCall[] = [];
const originalFetch = globalThis.fetch;

function stubFetch(body: unknown, status = 200) {
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  calls.length = 0;
});

test("formatting helpers handle missing, invalid and numeric values", () => {
  assert.equal(formatDate(undefined), "Never");
  assert.equal(formatDate("not-a-date"), "not-a-date");
  assert.match(formatDate("2026-01-02T03:04:05.000Z"), /2026/);
  assert.equal(formatNumber(1_234_567), new Intl.NumberFormat("en-IN").format(1_234_567));
  assert.equal(formatNumber(undefined), "0");
});

test("adminApi returns data and sends JSON auth headers", async () => {
  stubFetch({ success: true, data: { id: "a1" } });

  const result = await adminApi<{ id: string }>("/admins/me", { token: "token-1" });

  assert.deepEqual(result, { id: "a1" });
  assert.equal(calls[0].url, "/api/admin/admins/me");
  const headers = calls[0].init.headers as Headers;
  assert.equal(headers.get("Authorization"), "Bearer token-1");
  assert.equal(headers.get("Content-Type"), "application/json");
});

test("adminApi throws ApiError with the server message on a failed envelope", async () => {
  stubFetch({ success: false, error: { message: "Forbidden" } }, 403);

  await assert.rejects(
    () => adminApi("/admins/me", { token: "token-1" }),
    (error: unknown) => error instanceof ApiError && error.status === 403 && error.message === "Forbidden"
  );
});

test("adminApiWithMeta preserves pagination meta", async () => {
  stubFetch({ success: true, data: { items: [] }, meta: { total: 7 } });

  const result = await adminApiWithMeta<{ items: unknown[] }>("/users");

  assert.deepEqual(result.data, { items: [] });
  assert.deepEqual(result.meta, { total: 7 });
});

test("adminApiMultipart sends auth without forcing a JSON content type", async () => {
  stubFetch({ success: true, data: { ok: true } });

  await adminApiMultipart("/assets", "token-2", new FormData());

  const headers = calls[0].init.headers as Headers;
  assert.equal(headers.get("Authorization"), "Bearer token-2");
  assert.equal(headers.get("Content-Type"), null);
});
