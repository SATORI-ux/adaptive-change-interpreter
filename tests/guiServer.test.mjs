import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Readable } from "node:stream";
import {
  getRepoInfo,
  resolvePublicPath,
  server
} from "../src/gui/server.mjs";
import { evaluateOutputQuality } from "../src/evaluate/evaluateOutputQuality.mjs";

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

function createRepo() {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), "aci-gui-server-"));
  runGit(repoPath, ["init", "--quiet"]);
  writeFile(
    repoPath,
    "package.json",
    JSON.stringify({ name: "gui-server-fixture" }, null, 2)
  );
  writeFile(repoPath, "src/index.js", "export const value = 1;\n");
  runGit(repoPath, ["add", "."]);
  runGit(repoPath, [
    "-c",
    "user.name=GUI Server Fixture",
    "-c",
    "user.email=gui-server@example.com",
    "commit",
    "-m",
    "Create GUI server fixture",
  ]);
  return repoPath;
}

function requestServer({ method = "GET", url = "/", body } = {}) {
  return new Promise((resolve) => {
    const rawBody = body ? JSON.stringify(body) : "";
    const request = Readable.from(rawBody ? [rawBody] : []);
    const response = {
      statusCode: 200,
      headers: {},
      writeHead(statusCode, headers = {}) {
        this.statusCode = statusCode;
        this.headers = headers;
      },
      end(contents = "") {
        resolve({
          statusCode: this.statusCode,
          headers: this.headers,
          body: String(contents)
        });
      }
    };

    request.method = method;
    request.url = url;
    request.headers = {
      host: "localhost"
    };

    server.emit("request", request, response);
  });
}

async function postAnalyze(body) {
  const response = await requestServer({
    method: "POST",
    url: "/api/analyze",
    body
  });
  const payload = JSON.parse(response.body);

  assert.equal(
    response.statusCode,
    200,
    payload.error || `Expected /api/analyze to accept ${body.mode}.`
  );

  return payload;
}

test("repo-info resolves subdirectories to the Git root", () => {
  const repoPath = createRepo();
  const nestedPath = path.join(repoPath, "src");
  const payload = getRepoInfo(nestedPath);

  assert.equal(fs.realpathSync(payload.path), fs.realpathSync(repoPath));
  assert.equal(payload.label, "gui-server-fixture");
});

test("static path resolver rejects paths outside the public directory", () => {
  assert.equal(resolvePublicPath("/%2e%2e/server.mjs"), null);
});

test("GUI analysis flow keeps timeline candidates and paired output quality usable", async () => {
  const timeline = await postAnalyze({
    repo: repoRoot,
    mode: "feature_timeline",
    maxCommits: "25",
    limit: "4"
  });
  const candidate = timeline.candidateRanges?.[0];

  assert.equal(timeline.mode, "feature_timeline");
  assert.ok(candidate, "Timeline should return at least one GUI-selectable range.");
  assert.ok(candidate.from, "Timeline candidate should include a starting commit.");
  assert.ok(candidate.to, "Timeline candidate should include an ending commit.");
  assert.ok(candidate.title, "Timeline candidate should include a brief title.");
  assert.doesNotMatch(
    candidate.title,
    /^high-signal range\b/i,
    "Timeline titles should avoid generic placeholder phrasing."
  );
  assert.ok(
    candidate.titleConfidence?.reasoning,
    "Timeline candidate should explain title confidence for the GUI."
  );

  const paired = await postAnalyze({
    repo: repoRoot,
    mode: "paired_session",
    depth: "level_1",
    from: candidate.from,
    to: candidate.to
  });
  const evaluation = evaluateOutputQuality(paired);
  const hardFailures = evaluation.checks
    .filter((check) => check.status === "fail")
    .map((check) => `${check.id}: ${check.title}`);

  assert.equal(paired.mode, "paired_session");
  assert.equal(
    evaluation.totals.fail,
    0,
    `GUI paired-session output should not have hard quality failures.\n${hardFailures.join("\n")}`
  );
});
