import { classifyFiles } from "./classifyFiles.mjs";
import { resolveGitRepoPath, runGitCommand } from "../git/collectRepoData.mjs";

const FEATURE_SUBJECT_PATTERNS = [
  /\badd\b/i,
  /\bbuild\b/i,
  /\bcreate\b/i,
  /\benable\b/i,
  /\bimplement\b/i,
  /\bintroduce\b/i,
  /\brequire\b/i,
  /\bsupport\b/i,
  /\bwire\b/i
];

const LOW_VALUE_SUBJECT_PATTERNS = [
  /\btypo\b/i,
  /\bformat\b/i,
  /\blint\b/i,
  /\bchore\b/i,
  /\bversion\b/i,
  /\bdeps?\b/i,
  /\bcleanup\b/i
];

function parsePositiveInteger(value, fallback) {
  if (!value) {
    return fallback;
  }

  if (value === "all") {
    return null;
  }

  return Number(value);
}

function getCommitRows(repoPath, maxCommits) {
  const limitArg = maxCommits ? `-n ${maxCommits}` : "";
  const raw = runGitCommand(
    repoPath,
    `log --reverse --format=%H%x09%s ${limitArg}`
  );

  return raw
    ? raw.split("\n").filter(Boolean).map((line) => {
        const [sha, ...subjectParts] = line.split("\t");
        return {
          sha,
          subject: subjectParts.join("\t").trim()
        };
      })
    : [];
}

function getCommitParent(repoPath, sha) {
  try {
    return runGitCommand(repoPath, `rev-parse ${sha}~1`);
  } catch {
    return null;
  }
}

function getNameStatus(repoPath, range) {
  const raw = runGitCommand(repoPath, `diff --name-status ${range}`);

  return raw
    ? raw.split("\n").filter(Boolean).map((line) => {
        const [status, ...pathParts] = line.split(/\s+/);
        return {
          status,
          path: pathParts[pathParts.length - 1]
        };
      })
    : [];
}

function getDiffStat(repoPath, range) {
  try {
    return runGitCommand(repoPath, `diff --shortstat ${range}`);
  } catch {
    return "";
  }
}

function countByCategory(classifiedFiles) {
  return classifiedFiles.countsByCategory || {};
}

function hasCategory(counts, category) {
  return (counts[category] || 0) > 0;
}

function isGeneratedOnly(counts, changedCount) {
  return (counts.generated_output || 0) > 0 &&
    (counts.generated_output || 0) === changedCount;
}

function isDocsOnly(counts, changedCount) {
  return (counts.docs || 0) > 0 && (counts.docs || 0) === changedCount;
}

function isConfigOnly(counts, changedCount) {
  return (counts.config_build || 0) > 0 &&
    (counts.config_build || 0) === changedCount;
}

function buildThemes(counts) {
  const themes = [];

  if (hasCategory(counts, "frontend_app")) {
    themes.push("frontend_behavior");
  }
  if (hasCategory(counts, "styling")) {
    themes.push("visual_design");
  }
  if (hasCategory(counts, "backend")) {
    themes.push("backend_logic");
  }
  if (hasCategory(counts, "database")) {
    themes.push("data_model");
  }
  if (hasCategory(counts, "config_build")) {
    themes.push("configuration_build");
  }
  if (hasCategory(counts, "notifications_background")) {
    themes.push("notifications_background");
  }
  if (hasCategory(counts, "docs")) {
    themes.push("documentation");
  }
  if (themes.length === 0) {
    themes.push("implementation_logic");
  }

  return themes;
}

function getConfidence(score) {
  if (score >= 11) {
    return "high";
  }

  if (score >= 6) {
    return "medium";
  }

  return "low";
}

function scoreCommit({ subject, nameStatus, classifiedFiles }) {
  const counts = countByCategory(classifiedFiles);
  const changedPaths = nameStatus.map((item) => item.path).filter(Boolean);
  const addedPaths = nameStatus
    .filter((item) => item.status?.startsWith("A"))
    .map((item) => item.path);
  const categories = Object.keys(counts);
  const reasons = [];
  let score = 0;

  if (FEATURE_SUBJECT_PATTERNS.some((pattern) => pattern.test(subject))) {
    score += 4;
    reasons.push("Commit subject uses feature-building language.");
  }

  if (LOW_VALUE_SUBJECT_PATTERNS.some((pattern) => pattern.test(subject))) {
    score -= 3;
    reasons.push("Commit subject looks like maintenance or cleanup, so confidence is reduced.");
  }

  if (addedPaths.length > 0) {
    score += Math.min(addedPaths.length * 2, 6);
    reasons.push(`Adds new file(s): ${addedPaths.slice(0, 5).join(", ")}.`);
  }

  if (categories.length > 1) {
    score += Math.min(categories.length, 5);
    reasons.push(`Touches multiple areas: ${categories.join(", ")}.`);
  }

  if (hasCategory(counts, "frontend_app") && hasCategory(counts, "backend")) {
    score += 5;
    reasons.push("Crosses frontend and backend boundaries.");
  }

  if (hasCategory(counts, "backend") && hasCategory(counts, "database")) {
    score += 4;
    reasons.push("Connects backend logic with data-shape changes.");
  }

  if (hasCategory(counts, "config_build") && categories.length > 1) {
    score += 2;
    reasons.push("Combines configuration/build wiring with implementation changes.");
  }

  if (hasCategory(counts, "notifications_background")) {
    score += 2;
    reasons.push("Touches background or notification behavior.");
  }

  if (isGeneratedOnly(counts, changedPaths.length)) {
    score -= 6;
    reasons.push("Only generated output changed, which is usually less useful for learning source behavior.");
  }

  if (isDocsOnly(counts, changedPaths.length)) {
    score -= 2;
    reasons.push("Docs-only changes can clarify intent but may not reveal runtime behavior.");
  }

  if (isConfigOnly(counts, changedPaths.length)) {
    score -= 1;
    reasons.push("Config-only changes are useful mainly when environment behavior is the topic.");
  }

  return {
    score,
    reasons,
    changedPaths,
    addedPaths,
    themes: buildThemes(counts)
  };
}

function buildLabel(candidate) {
  if (candidate.score >= 11) {
    return "Strong insight candidate";
  }

  if (candidate.score >= 6) {
    return "Likely useful change range";
  }

  return "Possible narrow insight";
}

function buildReadingReason(candidate) {
  if (candidate.themes.includes("backend_logic") && candidate.themes.includes("frontend_behavior")) {
    return "Good candidate for understanding user flow and backend enforcement boundaries.";
  }

  if (candidate.themes.includes("data_model")) {
    return "Good candidate for understanding how data shape affects application behavior.";
  }

  if (candidate.themes.includes("configuration_build")) {
    return "Useful for understanding environment, build, or deployment assumptions.";
  }

  if (candidate.themes.includes("frontend_behavior")) {
    return "Useful for understanding a user-facing behavior change.";
  }

  return "Useful if you want a focused look at this part of the project history.";
}

export function buildFeatureTimeline(options = {}) {
  const repoPath = resolveGitRepoPath(options.repo);
  const maxCommits = parsePositiveInteger(options.maxCommits, 50);
  const limit = parsePositiveInteger(options.limit, 8) || 8;
  const commits = getCommitRows(repoPath, maxCommits);
  const candidates = [];

  for (const commit of commits) {
    const parent = getCommitParent(repoPath, commit.sha);

    if (!parent) {
      continue;
    }

    const range = `${parent}..${commit.sha}`;
    const nameStatus = getNameStatus(repoPath, range);
    const changedPaths = nameStatus.map((item) => item.path).filter(Boolean);

    if (changedPaths.length === 0) {
      continue;
    }

    const classifiedFiles = classifyFiles(changedPaths);
    const scored = scoreCommit({
      subject: commit.subject,
      nameStatus,
      classifiedFiles
    });

    if (scored.score < 3) {
      continue;
    }

    candidates.push({
      range,
      from: parent,
      to: commit.sha,
      commit: {
        sha: commit.sha,
        subject: commit.subject
      },
      label: buildLabel(scored),
      score: scored.score,
      confidence: getConfidence(scored.score),
      themes: scored.themes,
      changedFiles: scored.changedPaths.slice(0, 12),
      whyThisRange: scored.reasons,
      recommendedMode: "paired_session",
      readingReason: buildReadingReason(scored),
      diffStat: getDiffStat(repoPath, range)
    });
  }

  const candidateRanges = candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    mode: "feature_timeline",
    repoPath,
    scannedCommits: commits.length,
    candidateRanges,
    reviewNote:
      "These ranges are heuristic recommendations, not guaranteed feature boundaries. Use them as starting points for change interpretation."
  };
}
