import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function runGitCommand(repoPath, command) {
  try {
    return execSync(`git -C "${repoPath}" ${command}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const stderr = error.stderr?.toString()?.trim() || "Unknown Git error";
    throw new Error(`Git command failed: git -C "${repoPath}" ${command}\n${stderr}`);
  }
}

export function collectRepoData({ repo, from, to, mode }) {
  if (!repo) {
    throw new Error('Missing required "--repo" argument.');
  }

  if (!from && mode !== "project_health_review") {
    throw new Error('Missing required "--from" argument.');
  }

  if (!to && mode !== "project_health_review") {
    throw new Error('Missing required "--to" argument.');
  }

  if (!fs.existsSync(repo)) {
    throw new Error(`Repo path does not exist: ${repo}`);
  }

  const absoluteRepoPath = path.resolve(repo);

  const isGitRepo = runGitCommand(absoluteRepoPath, "rev-parse --is-inside-work-tree");
  if (isGitRepo !== "true") {
    throw new Error(`Not a valid Git repository: ${absoluteRepoPath}`);
  }

  const commitRange = from && to ? `${from}..${to}` : null;

  const commitsRaw = commitRange
    ? runGitCommand(absoluteRepoPath, `log --oneline ${commitRange}`)
    : "";

  const changedFilesRaw = commitRange
    ? runGitCommand(absoluteRepoPath, `diff --name-only ${commitRange}`)
    : "";

  const diffStatRaw = commitRange
    ? runGitCommand(absoluteRepoPath, `diff --stat ${commitRange}`)
    : "";

  const rawDiff = commitRange
    ? runGitCommand(absoluteRepoPath, `diff --unified=0 ${commitRange}`)
    : "";

  const trackedFilesRaw = runGitCommand(absoluteRepoPath, "ls-files");

  const rootFiles = fs.readdirSync(absoluteRepoPath);

  const gitignorePath = path.join(absoluteRepoPath, ".gitignore");
  const gitignoreExists = fs.existsSync(gitignorePath);
  const gitignoreContent = gitignoreExists
    ? fs.readFileSync(gitignorePath, "utf8")
    : "";

  const packageJsonPath = path.join(absoluteRepoPath, "package.json");
  const packageJsonExists = fs.existsSync(packageJsonPath);

  let packageJson = null;
  if (packageJsonExists) {
    try {
      const raw = fs.readFileSync(packageJsonPath, "utf8");
      packageJson = JSON.parse(raw);
    } catch {
      packageJson = null;
    }
  }

  return {
    repoPath: absoluteRepoPath,
    mode,
    commitRange,
    commits: commitsRaw ? commitsRaw.split("\n") : [],
    changedFiles: changedFilesRaw ? changedFilesRaw.split("\n") : [],
    diffStat: diffStatRaw,
    rawDiff,
    trackedFiles: trackedFilesRaw ? trackedFilesRaw.split("\n") : [],
    rootFiles,
    gitignore: {
      exists: gitignoreExists,
      content: gitignoreContent,
    },
    packageJson,
    collectedAt: new Date().toISOString(),
  };
}