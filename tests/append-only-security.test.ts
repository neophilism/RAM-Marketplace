import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(root: string): string[] {
  const output: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      output.push(...sourceFiles(path));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      output.push(path);
    }
  }
  return output;
}

test("application code does not mutate or delete audit history", () => {
  const files = [...sourceFiles("lib"), ...sourceFiles("app")];
  const forbidden = /auditEvent\.(update|updateMany|delete|deleteMany)\s*\(/;

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.equal(
      forbidden.test(source),
      false,
      `Audit history must remain append-only: ${file}`
    );
  }
});

test("application code does not mutate or delete financial ledger entries", () => {
  const files = [...sourceFiles("lib"), ...sourceFiles("app")];
  const forbidden =
    /financialLedgerEntry\.(update|updateMany|delete|deleteMany)\s*\(/;

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.equal(
      forbidden.test(source),
      false,
      `Financial ledger must remain append-only: ${file}`
    );
  }
});
