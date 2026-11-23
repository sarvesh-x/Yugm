/**
 * Local-only DCR-2 recovery-evidence CLI.
 *
 * Usage:
 *   npm run capacity:recovery -- --verification <report.json> --rehearsal <dir> --attestation <attestation.json> [--out <report.json>]
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { assessRecoveryEvidence } from "../migration/dcr2RecoveryEvidence.js";

function argument(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const verification = argument("verification");
  const rehearsal = argument("rehearsal");
  const attestation = argument("attestation");
  if (!verification || !rehearsal || !attestation) {
    console.error("Missing --verification <report.json>, --rehearsal <dir> or --attestation <attestation.json>.");
    process.exit(1);
  }

  const report = await assessRecoveryEvidence({
    verificationFile: verification,
    rehearsalDirectory: rehearsal,
    attestationFile: attestation,
  });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const output = argument("out");
  if (output) {
    const target = path.resolve(output);
    await writeFile(target, json, "utf8");
    console.log(`Wrote recovery evidence report to ${target}`);
  } else {
    process.stdout.write(json);
  }
  console.error(
    `Recovery evidence: ${report.evidenceComplete ? "COMPLETE" : "INCOMPLETE"} ` +
      `(verification ${report.verificationPassed}, rehearsal ${report.rehearsalPassed}, ` +
      `id_map rows ${report.idMapLines}, attestation ${report.attestationComplete}); ` +
      `${report.reviewItems.length} review items remain open`
  );
  if (!report.evidenceComplete) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
