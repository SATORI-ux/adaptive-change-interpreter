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

const TITLE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "of",
  "the",
  "to",
  "with"
]);

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

function getDiffNameOnlyAndWords(repoPath, range) {
  try {
    return runGitCommand(repoPath, `diff --unified=0 --word-diff=plain ${range}`)
      .slice(0, 8000);
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

function stripSubjectPrefix(subject = "") {
  return subject
    .replace(/^\s*(add|added|build|built|create|created|enable|enabled|implement|implemented|introduce|introduced|require|required|support|supported|wire|wired|fix|fixed|update|updated|refine|refined|improve|improved|tighten|tightened|normalize|normalized)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value = "") {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (/^[A-Z0-9_/-]+$/.test(word)) {
        return word;
      }

      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(" ");
}

function tokenizeTitleEvidence(value = "") {
  return String(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !TITLE_STOP_WORDS.has(token));
}

function getTitleCorroboration(title, evidenceText) {
  const titleTokens = [...new Set(tokenizeTitleEvidence(title))];

  if (titleTokens.length === 0) {
    return {
      ratio: 0,
      matched: [],
      missing: []
    };
  }

  const evidenceTokens = new Set(tokenizeTitleEvidence(evidenceText));
  const matched = titleTokens.filter((token) => evidenceTokens.has(token));
  const missing = titleTokens.filter((token) => !evidenceTokens.has(token));

  return {
    ratio: matched.length / titleTokens.length,
    matched,
    missing
  };
}

function describeThemeTitle(themes = []) {
  if (themes.includes("backend_logic") && themes.includes("frontend_behavior")) {
    return "Frontend And Backend Flow";
  }

  if (themes.includes("data_model")) {
    return "Data Shape Change";
  }

  if (themes.includes("configuration_build")) {
    return "Configuration And Build Change";
  }

  if (themes.includes("notifications_background")) {
    return "Background Behavior Change";
  }

  if (themes.includes("frontend_behavior")) {
    return "User-Facing Behavior Change";
  }

  if (themes.includes("documentation")) {
    return "Documentation Context Change";
  }

  return "Focused Implementation Change";
}

function buildRangeTitle({ subject, scored, diffEvidence }) {
  const subjectTitle = titleCase(stripSubjectPrefix(subject));
  const hasFeatureSubject = FEATURE_SUBJECT_PATTERNS.some((pattern) => pattern.test(subject));
  const hasLowValueSubject = LOW_VALUE_SUBJECT_PATTERNS.some((pattern) => pattern.test(subject));
  const hasMultipleAreas = scored.themes.length > 1;
  const hasChangedFiles = scored.changedPaths.length > 0;

  let title = subjectTitle || describeThemeTitle(scored.themes);
  const evidence = [];
  let score = 25;
  const corroborationText = [
    scored.changedPaths.join(" "),
    scored.themes.join(" "),
    diffEvidence || ""
  ].join(" ");
  const corroboration = getTitleCorroboration(title, corroborationText);

  if (subjectTitle) {
    score += 15;
    evidence.push(`Candidate title starts from commit subject "${subject}".`);
  } else {
    evidence.push("No descriptive commit subject was available, so the title falls back to changed-file themes.");
  }

  if (hasFeatureSubject) {
    score += 5;
    evidence.push("The commit subject uses feature-building language.");
  }

  if (hasMultipleAreas) {
    score += 10;
    evidence.push(`The range touches multiple themes: ${scored.themes.join(", ")}.`);
  }

  if (hasChangedFiles) {
    score += 5;
    evidence.push(`Changed files include ${scored.changedPaths.slice(0, 4).join(", ")}.`);
  }

  if (corroboration.ratio >= 0.67) {
    score += 30;
    evidence.push(`Diff/path evidence corroborates title words: ${corroboration.matched.join(", ")}.`);
  } else if (corroboration.ratio >= 0.34) {
    score += 10;
    evidence.push(`Diff/path evidence partially corroborates title words: ${corroboration.matched.join(", ")}.`);
  } else {
    score -= 20;
    evidence.push(
      `Diff/path evidence does not corroborate enough title words; missing ${corroboration.missing.join(", ") || "specific title terms"}.`
    );
  }

  if (hasLowValueSubject) {
    score -= 20;
    evidence.push("The commit subject reads as maintenance or cleanup, which lowers title confidence.");
  }

  score = Math.max(5, Math.min(score, 95));

  if (!subjectTitle || hasLowValueSubject) {
    title = describeThemeTitle(scored.themes);
  }

  const level = score >= 75
    ? "high"
    : score >= 45
      ? "medium"
      : "low";

  return {
    title,
    titleConfidence: {
      level,
      score,
      reasoning: evidence.join(" ")
    }
  };
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
    reasons.push("The commit title describes feature work.");
  }

  if (LOW_VALUE_SUBJECT_PATTERNS.some((pattern) => pattern.test(subject))) {
    score -= 3;
    reasons.push("The commit title reads as maintenance or cleanup, so this range is ranked lower.");
  }

  if (addedPaths.length > 0) {
    score += Math.min(addedPaths.length * 2, 6);
    reasons.push(`New files enter the project: ${addedPaths.slice(0, 5).join(", ")}.`);
  }

  if (categories.length > 1) {
    score += Math.min(categories.length, 5);
    reasons.push(`The diff crosses ${categories.join(", ")}.`);
  }

  if (hasCategory(counts, "frontend_app") && hasCategory(counts, "backend")) {
    score += 5;
    reasons.push("Frontend and backend files changed together.");
  }

  if (hasCategory(counts, "backend") && hasCategory(counts, "database")) {
    score += 4;
    reasons.push("Backend logic changed alongside data-shape files.");
  }

  if (hasCategory(counts, "config_build") && categories.length > 1) {
    score += 2;
    reasons.push("Configuration or build wiring changed alongside implementation files.");
  }

  if (hasCategory(counts, "notifications_background")) {
    score += 2;
    reasons.push("Background or notification behavior is part of the diff.");
  }

  if (isGeneratedOnly(counts, changedPaths.length)) {
    score -= 6;
    reasons.push("Only generated output changed, so the range is weak for understanding source behavior.");
  }

  if (isDocsOnly(counts, changedPaths.length)) {
    score -= 2;
    reasons.push("Docs changed without runtime files, so the value is mostly intent/context.");
  }

  if (isConfigOnly(counts, changedPaths.length)) {
    score -= 1;
    reasons.push("Config-only changes are most valuable when the question is environment behavior.");
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
    return "Strong range evidence";
  }

  if (candidate.score >= 6) {
    return "Moderate range evidence";
  }

  return "Light range evidence";
}

function buildReadingReason(candidate) {
  if (candidate.themes.includes("backend_logic") && candidate.themes.includes("frontend_behavior")) {
    return "Read this to trace how user flow and backend enforcement meet.";
  }

  if (candidate.themes.includes("data_model")) {
    return "Read this to see how data shape influences application behavior.";
  }

  if (candidate.themes.includes("configuration_build")) {
    return "Read this when environment, build, or deployment assumptions matter.";
  }

  if (candidate.themes.includes("frontend_behavior")) {
    return "Read this for a user-facing behavior change.";
  }

  return "Read this for a focused slice of project history.";
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
    const diffEvidence = getDiffNameOnlyAndWords(repoPath, range);
    const scored = scoreCommit({
      subject: commit.subject,
      nameStatus,
      classifiedFiles
    });
    const titledRange = buildRangeTitle({
      subject: commit.subject,
      scored,
      diffEvidence
    });

    if (scored.score < 3) {
      continue;
    }

    candidates.push({
      range,
      from: parent,
      to: commit.sha,
      title: titledRange.title,
      titleConfidence: titledRange.titleConfidence,
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
      "These ranges are evidence-ranked starting points, not guaranteed feature boundaries."
  };
}
