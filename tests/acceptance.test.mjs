import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "..");
const fixturesPath = path.join(
  repoRoot,
  "tests",
  "fixtures",
  "acceptance-cases.json"
);
const schemaValidatorPath = path.join(repoRoot, "src", "validateSchema.mjs");
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf8"));

function runNode(args) {
  return execFileSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function writeTempJson(prefix, contents) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  const filePath = path.join(tempDir, "output.json");
  fs.writeFileSync(filePath, contents);
  return filePath;
}

function validateAgainstSchema(jsonPath) {
  const result = runNode([schemaValidatorPath, jsonPath]);
  assert.match(result, /Validation passed\./);
}

for (const fixture of fixtures) {
  test(fixture.id, () => {
    let jsonPath;

    if (fixture.type === "cli_output") {
      const stdout = runNode(fixture.args);
      const parsed = JSON.parse(stdout);
      assert.equal(parsed.mode, fixture.expectedMode);
      jsonPath = writeTempJson(fixture.id, JSON.stringify(parsed, null, 2));
    } else if (fixture.type === "saved_output") {
      jsonPath = path.join(repoRoot, fixture.path);
      const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      assert.equal(parsed.mode, fixture.expectedMode);
    } else {
      throw new Error(`Unsupported fixture type: ${fixture.type}`);
    }

    validateAgainstSchema(jsonPath);
  });
}
