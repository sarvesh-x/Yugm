/**
 * Read-only impact report for child-row replacement during delta sync.
 *
 * Uses the schema generator's shared CHILD_TABLES declaration and the generated
 * manifest's modelToTable mapping. It does not read MongoDB/D1, edit the DDL or
 * decide per-parent vs per-batch replacement.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CHILD_TABLES } from "./childTables.js";
import { ROOT_TABLES } from "./mappings.js";

export interface ChildTableImpact {
  model: string;
  collection: string;
  rootTable: string;
  fields: string[];
  childTables: string[];
}

export interface ChildTableAuditReport {
  source: string;
  rootTableCount: number;
  impactedRootCount: number;
  childTableCount: number;
  impacts: ChildTableImpact[];
  unmappedModels: string[];
  reviewItems: Array<{ id: string; statement: string }>;
  digest: string;
}

const collectionByTable = new Map(Object.entries(ROOT_TABLES).map(([collection, table]) => [table, collection]));

export function buildChildTableAudit(modelToTable: Record<string, string>, source = "manifest"): ChildTableAuditReport {
  const impacts: ChildTableImpact[] = [];
  const unmappedModels: string[] = [];

  for (const [model, fields] of Object.entries(CHILD_TABLES).sort(([a], [b]) => a.localeCompare(b))) {
    const rootTable = modelToTable[model];
    const collection = rootTable ? collectionByTable.get(rootTable) : undefined;
    if (!rootTable || !collection) {
      unmappedModels.push(model);
      continue;
    }
    impacts.push({
      model,
      collection,
      rootTable,
      fields: Object.keys(fields).sort(),
      childTables: Object.values(fields).sort(),
    });
  }

  const hash = createHash("sha256");
  hash.update(`${source}\n`);
  for (const impact of impacts) {
    hash.update(`${impact.collection}|${impact.childTables.join(",")}\n`);
  }
  for (const model of unmappedModels) hash.update(`unmapped:${model}\n`);

  return {
    source,
    rootTableCount: Object.keys(ROOT_TABLES).length,
    impactedRootCount: impacts.length,
    childTableCount: impacts.reduce((sum, impact) => sum + impact.childTables.length, 0),
    impacts,
    unmappedModels,
    reviewItems: [
      {
        id: "replacement-unit",
        statement: "Decide whether child rows are replaced per changed parent or per delta batch; both keep the root upsert atomic.",
      },
      {
        id: "stale-child-rows",
        statement: "Delete and reinsert child rows for changed parents in the same transaction so stale rows cannot survive.",
      },
      {
        id: "idempotent-replay",
        statement: "Replaying a delta must not duplicate child rows; source_id/position uniqueness must be enforced.",
      },
    ],
    digest: hash.digest("hex"),
  };
}

export async function loadChildTableAudit(manifestFile: string): Promise<ChildTableAuditReport> {
  const manifest = JSON.parse(await readFile(path.resolve(manifestFile), "utf8")) as {
    modelToTable?: Record<string, string>;
  };
  if (!manifest.modelToTable || typeof manifest.modelToTable !== "object") {
    throw new Error(`${manifestFile}: missing modelToTable mapping`);
  }
  return buildChildTableAudit(manifest.modelToTable, path.basename(manifestFile));
}
