import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "..");

function runCli(args) {
  return execFileSync(process.execPath, ["src/index.mjs", ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

test("writes JSON output to a file when --output is provided", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aci-output-json-"));
  const outputPath = path.join(tempDir, "nested", "health.json");

  const stdout = runCli([
    "--repo",
    ".",
    "--mode",
    "project_health_review",
    "--output",
    outputPath
  ]);

  assert.equal(stdout, "");
  assert.ok(fs.existsSync(outputPath));

  const parsed = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(parsed.mode, "project_health_review");
});

test("writes Markdown output to a file when --output is provided", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aci-output-md-"));
  const outputPath = path.join(tempDir, "reports", "health.md");

  const stdout = runCli([
    "--repo",
    ".",
    "--mode",
    "project_health_review",
    "--format",
    "markdown",
    "--output",
    outputPath
  ]);

  assert.equal(stdout, "");
  assert.ok(fs.existsSync(outputPath));

  const markdown = fs.readFileSync(outputPath, "utf8");
  assert.match(markdown, /# Project Health Review/);
  assert.match(markdown, /## Project Overview/);
  assert.ok(!markdown.trim().startsWith("{"));
});
