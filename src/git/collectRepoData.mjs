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

function tryGitCommand(repoPath, command) {
  try {
    return {
      ok: true,
      stdout: execSync(`git -C "${repoPath}" ${command}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim()
    };
  } catch (error) {
    return {
      ok: false,
      stderr: error.stderr?.toString()?.trim() || "",
      message: error.message
    };
  }
}

function pathHasGitDirectory(candidatePath) {
  return fs.existsSync(path.join(candidatePath, ".git"));
}

function safeReadDirectories(directoryPath) {
  try {
    return fs.readdirSync(directoryPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => !entry.name.startsWith("."))
      .map((entry) => path.join(directoryPath, entry.name));
  } catch {
    return [];
  }
}

function addGitRootSuggestion(suggestions, candidatePath) {
  if (!candidatePath || !fs.existsSync(candidatePath)) {
    return;
  }

  if (pathHasGitDirectory(candidatePath)) {
    suggestions.add(path.resolve(candidatePath));
  }
}

function findNearbyGitRoots(startPath) {
  const suggestions = new Set();
  const absoluteStartPath = path.resolve(startPath);

  let currentPath = absoluteStartPath;
  for (let depth = 0; depth < 4; depth += 1) {
    addGitRootSuggestion(suggestions, currentPath);

    for (const childPath of safeReadDirectories(currentPath).slice(0, 30)) {
      addGitRootSuggestion(suggestions, childPath);
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }

    currentPath = parentPath;
  }

  return [...suggestions]
    .filter((suggestion) => suggestion !== absoluteStartPath)
    .slice(0, 5);
}

function formatGitRootSuggestions(startPath) {
  const suggestions = findNearbyGitRoots(startPath);

  if (suggestions.length === 0) {
    return "";
  }

  return ` Nearby Git checkout suggestion(s): ${suggestions.join("; ")}`;
}

function escapeForDoubleQuotes(value = "") {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

function normalizeFilePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function readTextFileIfPresent(absolutePath, maxLength = 4000) {
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(absolutePath, "utf8");
    return raw.slice(0, maxLength);
  } catch {
    return null;
  }
}

function findTrackedFiles(trackedFiles, matcher) {
  return trackedFiles.filter((filePath) => matcher(normalizeFilePath(filePath)));
}

function readTrackedFileSnippets(repoPath, trackedFiles, maxLength = 2000) {
  return trackedFiles
    .map((filePath) => {
      const absolutePath = path.join(repoPath, filePath);
      const excerpt = readTextFileIfPresent(absolutePath, maxLength);

      if (!excerpt) {
        return null;
      }

      return {
        path: filePath,
        excerpt,
      };
    })
    .filter(Boolean);
}

function readChangedDiffSnippets(repoPath, commitRange, changedFiles, maxLength = 1600) {
  if (!commitRange) {
    return [];
  }

  return changedFiles
    .map((filePath) => {
      try {
        const diffText = runGitCommand(
          repoPath,
          `diff --unified=2 ${commitRange} -- "${escapeForDoubleQuotes(filePath)}"`
        );

        if (!diffText) {
          return null;
        }

        return {
          path: filePath,
          excerpt: diffText.slice(0, maxLength),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function collectRepoEvidence(repoPath, trackedFiles, changedFiles, commitRange, packageJson) {
  const readmeCandidates = findTrackedFiles(trackedFiles, (filePath) => {
    const lower = filePath.toLowerCase();
    return lower === "readme.md" || lower.endsWith("/readme.md");
  });
  const readmePath = readmeCandidates[0] || null;
  const readmeExcerpt = readmePath
    ? readTextFileIfPresent(path.join(repoPath, readmePath), 4000)
    : null;

  const sourceOfTruthDocFiles = findTrackedFiles(trackedFiles, (filePath) => {
    const lower = filePath.toLowerCase();
    return (
      lower === "readme.md" ||
      lower === "agents.md" ||
      lower === "docs/product-brief.md" ||
      lower === "docs/output-spec.md" ||
      lower === "docs/health-review.md" ||
      lower === "docs/failure-pass.md"
    );
  });

  const sourceOfTruthDocSnippets = readTrackedFileSnippets(
    repoPath,
    sourceOfTruthDocFiles,
    2000
  );

  const serviceWorkerFiles = findTrackedFiles(trackedFiles, (filePath) => {
    const lower = filePath.toLowerCase();
    return lower.includes("service-worker") || lower.endsWith("sw.js");
  });

  const configFiles = findTrackedFiles(trackedFiles, (filePath) => {
    const lower = filePath.toLowerCase();
    return (
      lower === ".gitignore" ||
      lower === "package.json" ||
      lower === "package-lock.json" ||
      lower === "vercel.json" ||
      lower === "netlify.toml" ||
      lower.endsWith("vite.config.js") ||
      lower.endsWith("vite.config.mjs") ||
      lower.endsWith("vite.config.ts")
    );
  });

  const databaseFiles = findTrackedFiles(trackedFiles, (filePath) => {
    const lower = filePath.toLowerCase();
    return lower.startsWith("supabase/") || lower.endsWith(".sql");
  });

  const backendFiles = findTrackedFiles(trackedFiles, (filePath) => {
    const lower = filePath.toLowerCase();
    return (
      lower.startsWith("supabase/functions/") ||
      lower.startsWith("api/") ||
      lower.startsWith("server/")
    );
  });

  const frontendEntryFiles = findTrackedFiles(trackedFiles, (filePath) => {
    const lower = filePath.toLowerCase();
    return (
      lower === "index.html" ||
      lower.endsWith("/index.html") ||
      lower.endsWith("/main.js") ||
      lower.endsWith("/main.ts") ||
      lower.endsWith("/app.js") ||
      lower.endsWith("/app.mjs") ||
      lower.endsWith("/app.ts") ||
      lower.endsWith("/app.jsx") ||
      lower.endsWith("/app.tsx")
    );
  });

  const analysisEngineFiles = findTrackedFiles(trackedFiles, (filePath) => {
    const lower = filePath.toLowerCase();
    return (
      lower.startsWith("src/analyze/") ||
      lower.startsWith("src/git/") ||
      lower === "src/index.mjs" ||
      lower === "src/validateschema.mjs"
    );
  });

  const pipelineSupportFiles = findTrackedFiles(trackedFiles, (filePath) => {
    const lower = filePath.toLowerCase();
    return (
      lower.startsWith("schemas/") ||
      lower.startsWith("examples/")
    );
  });

  const generatedOutputFiles = findTrackedFiles(trackedFiles, (filePath) => {
    const lower = filePath.toLowerCase();
    return lower.startsWith("dist/") || lower.startsWith("build/");
  });

  const envLikeTrackedFiles = findTrackedFiles(trackedFiles, (filePath) => {
    const lower = filePath.toLowerCase();
    return (
      lower === ".env" ||
      lower.startsWith(".env.") ||
      lower.includes("/.env") ||
      lower.endsWith(".env")
    );
  });

  const localArtifactFiles = findTrackedFiles(trackedFiles, (filePath) => {
    const lower = filePath.toLowerCase();
    return lower.endsWith(".ds_store");
  });

  const privateBuildIndicators = findTrackedFiles(trackedFiles, (filePath) => {
    const lower = filePath.toLowerCase();
    return (
      lower.includes("private") ||
      lower.includes(".vercel") ||
      lower === "vercel.json"
    );
  });

  return {
    readme: {
      exists: Boolean(readmePath),
      path: readmePath,
      excerpt: readmeExcerpt,
    },
    sourceOfTruthDocFiles,
    sourceOfTruthDocSnippets,
    packageScripts: packageJson?.scripts || {},
    configFiles,
    serviceWorkerFiles,
    serviceWorkerSnippets: readTrackedFileSnippets(repoPath, serviceWorkerFiles, 2000),
    databaseFiles,
    backendFiles,
    frontendEntryFiles,
    analysisEngineFiles,
    pipelineSupportFiles,
    generatedOutputFiles,
    envLikeTrackedFiles,
    localArtifactFiles,
    privateBuildIndicators,
    changedFileSnippets: readTrackedFileSnippets(repoPath, changedFiles, 1200),
    changedDiffSnippets: readChangedDiffSnippets(repoPath, commitRange, changedFiles, 1600),
  };
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

  const gitRepoCheck = tryGitCommand(absoluteRepoPath, "rev-parse --is-inside-work-tree");
  if (!gitRepoCheck.ok || gitRepoCheck.stdout !== "true") {
    const details = gitRepoCheck.stderr ? ` Git said: ${gitRepoCheck.stderr}` : "";
    const suggestions = formatGitRootSuggestions(absoluteRepoPath);
    throw new Error(
      `Repo path exists, but Git does not recognize it as a work tree: ${absoluteRepoPath}. ` +
      `Use the folder that contains the repository's .git directory, or clone the repo first.${suggestions}${details}`
    );
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
  const trackedFiles = trackedFilesRaw ? trackedFilesRaw.split("\n").filter(Boolean) : [];

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
    commits: commitsRaw ? commitsRaw.split("\n").filter(Boolean) : [],
    changedFiles: changedFilesRaw ? changedFilesRaw.split("\n").filter(Boolean) : [],
    diffStat: diffStatRaw,
    rawDiff,
    trackedFiles,
    rootFiles,
    gitignore: {
      exists: gitignoreExists,
      content: gitignoreContent,
    },
    packageJson,
    evidence: collectRepoEvidence(
      absoluteRepoPath,
      trackedFiles,
      changedFilesRaw ? changedFilesRaw.split("\n").filter(Boolean) : [],
      commitRange,
      packageJson
    ),
    collectedAt: new Date().toISOString(),
  };
}
