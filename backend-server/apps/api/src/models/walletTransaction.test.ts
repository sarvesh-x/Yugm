import assert from "node:assert/strict";
import test from "node:test";
import { walletSources, walletSourceLabels } from "@yugm/shared";
import { WalletTransaction } from "./WalletTransaction.js";

test("wallet transaction source enum matches shared walletSources", () => {
  const sourcePath = WalletTransaction.schema.path("source") as unknown as {
    enumValues: string[];
  };
  assert.deepEqual([...sourcePath.enumValues].sort(), [...walletSources].sort());
});

test("every wallet source has a display label", () => {
  for (const source of walletSources) {
    assert.equal(typeof walletSourceLabels[source], "string", `missing label for ${source}`);
    assert.ok(walletSourceLabels[source].length > 0, `empty label for ${source}`);
  }
});

test("wallet source values are uppercase snake case", () => {
  for (const source of walletSources) {
    assert.match(source, /^[A-Z][A-Z0-9_]*$/);
  }
});
