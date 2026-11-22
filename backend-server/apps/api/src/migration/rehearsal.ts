/**
 * End-to-end rehearsal harness: reads an immutable snapshot directory, runs the
 * reviewed mappings through the real importer in dry-run mode, and writes
 * transform/validation/id-map artifacts. It never connects to MongoDB or D1.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { importMappedCollection } from "./import.js";
import { IdMapRegistry, makeIdMapEntry } from "./idMap.js";
import { ROOT_TABLES } from "./mappings.js";
import { FileSystemSnapshotStore, readSnapshotManifest } from "./snapshot.js";
import { TransformContext } from "./transform.js";
import type {
  Checkpoint,
  CheckpointStore,
  SnapshotManifest,
  TargetRow,
  TargetWriter,
  TransformReport,
  ValidationReport
} from "./types.js";
import { ValidationReportBuilder } from "./validate.js";

export interface RehearsalOptions {
  snapshotDirectory: string;
  outputDirectory: string;
  /** When omitted, every snapshot collection with a reviewed mapping is rehearsed. */
  collections?: string[];
}

export interface RehearsalResult {
  snapshotId: string;
  collections: string[];
  transform: TransformReport;
  validation: ValidationReport;
  idMapCount: number;
  idMapChecksum: string;
  artifacts: string[];
}

class NoopTarget implements TargetWriter {
  async write(): Promise<void> {}
}

class NoopCheckpoints implements CheckpointStore {
  async load(): Promise<Checkpoint | undefined> { return undefined; }
  async save(): Promise<void> {}
}

function asIds(rows: readonly TargetRow[], column = "source_id"): string[] {
  return rows.map((row) => row[column]).filter((value): value is string => typeof value === "string");
}

async function writeJson(directory: string, name: string, value: unknown): Promise<string> {
  const file = path.join(directory, name);
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return file;
}

export async function rehearseSnapshot(options: RehearsalOptions): Promise<RehearsalResult> {
  const manifest: SnapshotManifest = await readSnapshotManifest(options.snapshotDirectory);
  const source = new FileSystemSnapshotStore(options.snapshotDirectory);
  const context = new TransformContext(manifest.snapshotId);
  const idMaps = new IdMapRegistry();
  const validation = new ValidationReportBuilder();
  const results: string[] = [];

  // An explicit collection list is checked verbatim; the default rehearses only
  // reviewed collections actually present in the snapshot.
  const requested = options.collections
    ?? Object.keys(ROOT_TABLES).filter((name) => manifest.collections.some((entry) => entry.name === name));
  for (const collection of requested) {
    const rootTable = ROOT_TABLES[collection];
    if (!rootTable) throw new Error(`No reviewed root table for collection ${collection}`);
    const snapshotEntry = manifest.collections.find((entry) => entry.name === collection);
    if (!snapshotEntry) throw new Error(`${collection} is not in the snapshot manifest`);

    const rootIds: string[] = [];
    const childParentIds: string[] = [];
    const parentColumn = `${rootTable}_id`;
    const importResult = await importMappedCollection({
      snapshot: manifest,
      collection,
      source,
      target: new NoopTarget(),
      checkpoints: new NoopCheckpoints(),
      dryRun: true,
      onWrite: (table, rows) => {
        if (table === rootTable) {
          rootIds.push(...asIds(rows));
          idMaps.addMany(rows.map((row) => makeIdMapEntry(collection, table, String(row.source_id))));
        } else {
          childParentIds.push(...asIds(rows, parentColumn));
        }
      }
    }, context);

    validation
      .count("migration", `${collection}: processed`, snapshotEntry.count, importResult.processed)
      .assert("migration", `${collection}: dry run wrote nothing`, importResult.dryRun)
      .unique("identity", `${collection}: source_id uniqueness`, rootIds)
      .referential("ownership", `${collection}: child parents resolve`, childParentIds, rootIds);
    results.push(collection);
  }

  validation.assert("accounting", "at least one reviewed collection present", results.length > 0);
  const accounting = context.unaccounted();
  validation.assert("accounting", "all source rows accounted for", accounting.length === 0, accounting.join("; ") || undefined);
  const totalTransformed = Object.values(context.report().collections)
    .reduce((sum, counts) => sum + counts.transformed, 0);
  validation.count("accounting", "id_map covers all root rows", totalTransformed, idMaps.size);

  await mkdir(options.outputDirectory, { recursive: true });
  const transform: TransformReport = context.report();
  const report: ValidationReport = validation.report(manifest.snapshotId);
  const idMapFile = await idMaps.write(options.outputDirectory);
  const artifacts = [
    await writeJson(options.outputDirectory, "transform-report.json", transform),
    await writeJson(options.outputDirectory, "validation-report.json", report),
    idMapFile
  ];

  return {
    snapshotId: manifest.snapshotId,
    collections: results,
    transform,
    validation: report,
    idMapCount: idMaps.size,
    idMapChecksum: idMaps.checksum(),
    artifacts
  };
}
