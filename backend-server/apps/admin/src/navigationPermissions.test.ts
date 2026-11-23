import assert from "node:assert/strict";
import { test } from "node:test";
import { canAccessView, VIEW_PERMISSIONS, type ViewKey } from "./navigationPermissions.js";

const admin = (permissions: string[] = [], isSuperAdmin = false) => ({ permissions, isSuperAdmin });

test("unrestricted views are available to any admin", () => {
  const restricted = new Set(Object.keys(VIEW_PERMISSIONS));
  const unrestricted = (["dashboard", "users", "reports", "rooms", "wallet", "settings"] as ViewKey[])
    .filter((view) => !restricted.has(view));

  for (const view of unrestricted) {
    assert.equal(canAccessView(admin(), view), true, view);
  }
});

test("restricted views require the exact permission", () => {
  for (const [view, permission] of Object.entries(VIEW_PERMISSIONS)) {
    assert.equal(canAccessView(admin(), view as ViewKey), false, `${view} without ${permission}`);
    assert.equal(canAccessView(admin(["unrelated.read"]), view as ViewKey), false, `${view} with wrong permission`);
    assert.equal(canAccessView(admin([permission as string]), view as ViewKey), true, `${view} with ${permission}`);
  }
});

test("super admins can reach every mapped view regardless of explicit permissions", () => {
  for (const view of Object.keys(VIEW_PERMISSIONS)) {
    assert.equal(canAccessView(admin([], true), view as ViewKey), true, view);
  }
});

test("the permission map uses non-empty permission identifiers", () => {
  const entries = Object.entries(VIEW_PERMISSIONS);
  assert.ok(entries.length > 0);
  for (const [view, permission] of entries) {
    assert.match(view, /^[A-Za-z]+$/);
    assert.match(permission as string, /^[a-z_.]+$/);
  }
});
