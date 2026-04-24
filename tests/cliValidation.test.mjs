import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "..");

function runCliExpectFailure(args) {
  try {
    execFileSync(process.execPath, ["src/index.mjs", ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });
  } catch (error) {
    return {
      stdout: error.stdout?.toString() || "",
      stderr: error.stderr?.toString() || "",
      status: error.status
    };
  }

  throw new Error("Expected CLI command to fail.");
}

test("rejects unsupported mode before analysis", () => {
  const result = runCliExpectFailure([
    "--repo",
    ".",
    "--mode",
    "repo_chat"
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported "--mode" value: repo_chat/);
});

test("rejects unsupported depth before analysis", () => {
  const result = runCliExpectFailure([
    "--repo",
    ".",
    "--mode",
    "project_health_review",
    "--depth",
    "deep"
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported "--depth" value: deep/);
});

test("rejects unsupported format before analysis", () => {
  const result = runCliExpectFailure([
    "--repo",
    ".",
    "--mode",
    "project_health_review",
    "--format",
    "html"
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported "--format" value: html/);
});

test("explains when an existing path is not a Git checkout", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aci-non-git-"));
  const result = runCliExpectFailure([
    "--repo",
    tempDir,
    "--mode",
    "project_health_review"
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Git does not recognize it as a work tree/);
  assert.match(result.stderr, /folder that contains the repository's \.git directory/);
});
