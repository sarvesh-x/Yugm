/**
 * Aggregates local DCR-2 evidence into one readiness checklist.
 *
 * Reads only local report JSON files. It never reads MongoDB, D1, Cloudflare,
 * billing APIs or any remote service. A ready result means the supplied local
 * evidence is internally consistent and owner attestations are present; it is
 * not production acceptance or permission to cut over.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export interface ReadinessCheck {
  id: string;
  passed: boolean;
  detail: string;
}

export interface Dcr2ReadinessReport {
  ready: boolean;
  checks: ReadinessCheck[];
  openReviewItemCount: number;
  reviewSources: string[];
  digest: string;
}

async function readJson(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.resolve(file), "utf8")) as Record<string, unknown>;
}

function check(id: string, passed: boolean, detail: string): ReadinessCheck {
  return { id, passed, detail };
}

export async function summarizeDcr2Readiness(files: {
  capacity: string;
  projection: string;
  queries: string;
  billing: string;
  recovery: string;
  attestation: string;
}): Promise<Dcr2ReadinessReport> {
  const [capacity, projection, queries, billing, recovery, attestation] = await Promise.all([
    readJson(files.capacity),
    readJson(files.projection),
    readJson(files.queries),
    readJson(files.billing),
    readJson(files.recovery),
    readJson(files.attestation),
  ]);

  const checks: ReadinessCheck[] = [
    check("capacity-hard-limits", capacity.hardGatesPassed === true, "D1 hard-limit screener must pass"),
    check("workers-paid-metrics", capacity.workersPaid === true, "capacity metrics must record Workers Paid"),
    check("projection-reviewed", projection.declaredAtLeastObserved === true, "declared projection must cover observed growth"),
    check("query-hard-limits", queries.hardGatesPassed === true, "query profile must pass hard limits"),
    check(
      "billing-inclusions",
      billing.withinIncludedReads === true && billing.withinIncludedWrites === true && billing.withinIncludedStorage === true,
      "billing estimate must be within Paid inclusions"
    ),
    check("recovery-evidence", recovery.evidenceComplete === true, "verification, rehearsal and attestation must be complete"),
    check("owner-workers-paid", attestation.workersPaid === true, "owner must attest Workers Paid is configured"),
    check("owner-schema-approved", attestation.schemaApproved === true, "owner must attest the D1 schema is approved"),
  ];

  const reviewSources = [capacity, projection, queries, billing, recovery]
    .map((report) => report.reviewItems)
    .filter((items): items is unknown[] => Array.isArray(items))
    .map((items, index) => ({ index, count: items.length }));

  const openReviewItemCount = reviewSources.reduce((sum, entry) => sum + entry.count, 0);
  const digestInput = checks.map((entry) => `${entry.id}:${entry.passed}`).join("\n");
  const hash = createHash("sha256").update(digestInput).update(`\nreviews:${openReviewItemCount}\n`).digest("hex");

  return {
    ready: checks.every((entry) => entry.passed),
    checks,
    openReviewItemCount,
    reviewSources: reviewSources.map((entry) => `report-${entry.index + 1}`),
    digest: hash,
  };
}
