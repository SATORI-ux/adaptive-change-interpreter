import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { getRepoInfo, resolvePublicPath } from "../src/gui/server.mjs";

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
