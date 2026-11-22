/** Validation report builder for Phase 2 rehearsal. Operates on supplied aggregates only. */
import type { ValidationCheck, ValidationReport } from "./types.js";

export class ValidationReportBuilder {
  private readonly checks: ValidationCheck[] = [];

  assert(domain: string, name: string, passed: boolean, detail?: string) {
    this.checks.push({ domain, name, passed, detail });
    return this;
  }

  count(domain: string, name: string, expected: number, actual: number) {
    this.checks.push({ domain, name, passed: expected === actual, expected, actual });
    return this;
  }

  unique(domain: string, name: string, values: readonly string[]) {
    const distinct = new Set(values).size;
    this.checks.push({
      domain,
      name,
      passed: distinct === values.length,
      expected: values.length,
      actual: distinct,
      detail: distinct === values.length ? undefined : "duplicate identifiers found"
    });
    return this;
  }

  referential(domain: string, name: string, childIds: readonly string[], parentIds: readonly string[]) {
    const parents = new Set(parentIds);
    const orphans = childIds.filter((id) => !parents.has(id));
    this.checks.push({
      domain,
      name,
      passed: orphans.length === 0,
      expected: 0,
      actual: orphans.length,
      detail: orphans.length ? `orphan references: ${orphans.slice(0, 10).join(", ")}` : undefined
    });
    return this;
  }

  /** Integer-only reconciliation: balances are never derived from floating point sums. */
  balance(domain: string, name: string, balance: number, ledgerSum: number) {
    if (!Number.isSafeInteger(balance) || !Number.isSafeInteger(ledgerSum)) {
      this.checks.push({ domain, name, passed: false, detail: "balance and ledger sum must be safe integers" });
      return this;
    }
    this.checks.push({ domain, name, passed: balance === ledgerSum, expected: balance, actual: ledgerSum });
    return this;
  }

  report(snapshotId: string): ValidationReport {
    return {
      snapshotId,
      generatedAt: new Date().toISOString(),
      passed: this.checks.every((check) => check.passed),
      checks: [...this.checks]
    };
  }
}
