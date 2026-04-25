import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "..");

function runGit(repoPath, args) {
  return execFileSync("git", args, {
    cwd: repoPath,
    encoding: "utf8",
  }).trim();
}

function writeFile(repoPath, filePath, contents) {
  const absolutePath = path.join(repoPath, filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function commit(repoPath, message) {
  runGit(repoPath, ["add", "."]);
  runGit(repoPath, [
    "-c",
    "user.name=Feature Timeline Fixture",
    "-c",
    "user.email=feature-timeline@example.com",
    "commit",
    "-m",
    message,
  ]);
}

function createTimelineRepo() {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), "aci-feature-timeline-"));
  runGit(repoPath, ["init", "--quiet"]);
  runGit(repoPath, ["config", "core.autocrlf", "false"]);

  writeFile(repoPath, "README.md", "# Timeline Fixture\n");
  commit(repoPath, "Create project baseline");

  writeFile(repoPath, "README.md", "# Timeline Fixture\n\nFix typo in documentation.\n");
  commit(repoPath, "Fix typo");

  writeFile(repoPath, "index.html", "<button data-checkout>Checkout</button>\n");
  writeFile(
    repoPath,
    "api/orders.js",
    [
      "export function createOrder(order) {",
      "  return { ok: true, order };",
      "}",
      "",
    ].join("\n")
  );
  commit(repoPath, "Add checkout order flow");

  return repoPath;
}

function createDeceptiveTitleRepo() {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), "aci-feature-title-"));
  runGit(repoPath, ["init", "--quiet"]);
  runGit(repoPath, ["config", "core.autocrlf", "false"]);

  writeFile(repoPath, "README.md", "# Deceptive Title Fixture\n");
  commit(repoPath, "Create project baseline");

  writeFile(
    repoPath,
    "api/orders.js",
    [
      "export function createOrder(order) {",
      "  return { ok: true, order };",
      "}",
      "",
    ].join("\n")
  );
  commit(repoPath, "Add dark mode checkout flow");

  return repoPath;
}

function runCli(args) {
  return execFileSync(process.execPath, ["src/index.mjs", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

test("feature timeline ranks feature-like ranges above minor updates", () => {
  const repoPath = createTimelineRepo();
  const stdout = runCli([
    "--repo",
    repoPath,
    "--mode",
    "feature_timeline",
    "--max-commits",
    "10",
    "--limit",
    "3"
  ]);
  const output = JSON.parse(stdout);

  assert.equal(output.mode, "feature_timeline");
  assert.ok(output.candidateRanges.length > 0);
  assert.equal(output.candidateRanges[0].commit.subject, "Add checkout order flow");
  assert.equal(output.candidateRanges[0].title, "Checkout Order Flow");
  assert.ok(["medium", "high"].includes(output.candidateRanges[0].titleConfidence.level));
  assert.ok(output.candidateRanges[0].titleConfidence.score >= 65);
  assert.match(output.candidateRanges[0].titleConfidence.reasoning, /commit subject/i);
  assert.match(output.candidateRanges[0].titleConfidence.reasoning, /corroborates/i);
  assert.ok(output.candidateRanges[0].themes.includes("frontend_behavior"));
  assert.ok(output.candidateRanges[0].themes.includes("backend_logic"));
});

test("feature timeline lowers title confidence when subject words are not corroborated", () => {
  const repoPath = createDeceptiveTitleRepo();
  const stdout = runCli([
    "--repo",
    repoPath,
    "--mode",
    "feature_timeline",
    "--max-commits",
    "10",
    "--limit",
    "1"
  ]);
  const output = JSON.parse(stdout);
  const candidate = output.candidateRanges[0];

  assert.equal(candidate.commit.subject, "Add dark mode checkout flow");
  assert.equal(candidate.title, "Dark Mode Checkout Flow");
  assert.equal(candidate.titleConfidence.level, "low");
  assert.ok(candidate.titleConfidence.score < 75);
  assert.match(candidate.titleConfidence.reasoning, /does not corroborate|partially corroborates/i);
});

test("feature timeline renders as markdown", () => {
  const repoPath = createTimelineRepo();
  const stdout = runCli([
    "--repo",
    repoPath,
    "--mode",
    "feature_timeline",
    "--format",
    "markdown",
    "--max-commits",
    "10"
  ]);

  assert.match(stdout, /# Feature Timeline/);
  assert.match(stdout, /Candidate Ranges/);
  assert.match(stdout, /Checkout Order Flow/);
  assert.match(stdout, /Title confidence/);
  assert.match(stdout, /Add checkout order flow/);
});
