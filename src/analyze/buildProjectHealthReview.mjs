function getCategoryCount(countsByCategory = {}, category) {
  return countsByCategory[category] || 0;
}

function getTopCategories(countsByCategory = {}, limit = 5) {
  return Object.entries(countsByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category, count]) => ({ category, count }));
}

function findFilesByCategory(classified, category) {
  return classified.files
    ?.filter((file) => file.category === category)
    .map((file) => file.path) || [];
}

function buildProjectSummary(repoData, classifiedTrackedFiles) {
  const counts = classifiedTrackedFiles.countsByCategory || {};
  const topCategories = getTopCategories(counts, 4);

  const hasFrontend = getCategoryCount(counts, "frontend_app") > 0;
  const hasStyling = getCategoryCount(counts, "styling") > 0;
  const hasBackend = getCategoryCount(counts, "backend") > 0;
  const hasDatabase = getCategoryCount(counts, "database") > 0;
  const hasNotifications = getCategoryCount(counts, "notifications_background") > 0;
  const hasConfig = getCategoryCount(counts, "config_build") > 0;

  const categorySummary = topCategories
    .map((entry) => `${entry.category} (${entry.count})`)
    .join(", ");

  let summary =
    `This repository currently contains ${repoData.trackedFiles.length} tracked file(s). ` +
    `The strongest visible implementation areas are: ${categorySummary || "no strong file-category pattern detected yet"}.`;

  if (hasFrontend && hasStyling && hasBackend) {
    summary +=
      " The project now spans UI behavior, presentation, and backend logic, which means review value comes from understanding boundaries between layers rather than only isolated files.";
  } else if (hasFrontend && hasStyling) {
    summary +=
      " The project currently reads as a frontend-heavy application with both behavior and presentation surfaces in active use.";
  }

  if (hasDatabase) {
    summary +=
      " Database-related files are also present, which raises the importance of keeping frontend assumptions aligned with backend or data-layer truth.";
  }

  if (hasNotifications) {
    summary +=
      " Background or notification logic is present, which adds an extra behavior surface that can drift if routes or environments change.";
  }

  if (hasConfig) {
    summary +=
      " Configuration and build files are part of the repo shape, so deployment and environment clarity matter alongside feature work.";
  }

  return summary;
}

function buildWhatIsWorkingWell(repoData, classifiedTrackedFiles, riskSignals) {
  const counts = classifiedTrackedFiles.countsByCategory || {};
  const strengths = [];

  if (repoData.gitignore?.exists) {
    strengths.push({
      title: ".gitignore is present",
      whyItMatters:
        "This reduces the chance of accidental commits involving local artifacts, generated files, or environment-specific files."
    });
  }

  if (repoData.packageJson) {
    strengths.push({
      title: "Project metadata is structured enough to inspect package-level behavior",
      whyItMatters:
        "A readable package.json makes build and tooling review easier and gives the project a clearer source of truth."
    });
  }

  if (getCategoryCount(counts, "frontend_app") > 0 && getCategoryCount(counts, "styling") > 0) {
    strengths.push({
      title: "The repo has a visible split between app behavior and styling",
      whyItMatters:
        "That is a healthy sign because it usually means presentation and logic are not completely collapsed into one layer."
    });
  }

  if (getCategoryCount(counts, "backend") > 0 || getCategoryCount(counts, "database") > 0) {
    strengths.push({
      title: "The project goes beyond a purely static frontend",
      whyItMatters:
        "This suggests the app is already structured around real data or workflow behavior, not only visual mockups."
    });
  }

  if (riskSignals.length === 0) {
    strengths.push({
      title: "No major heuristic risk signals were detected in this pass",
      whyItMatters:
        "That does not prove the project is perfect, but it usually means there are no obvious hygiene or structure warnings from the current rules."
    });
  }

  if (strengths.length === 0) {
    strengths.push({
      title: "The repo is analyzable as a coherent project",
      whyItMatters:
        "Even a small but structured codebase is easier to improve than a scattered folder of unrelated files."
    });
  }

  return strengths;
}

function buildArtifactsAndDrift(classifiedTrackedFiles, riskSignals) {
  const driftItems = [];

  const localArtifacts = findFilesByCategory(classifiedTrackedFiles, "local_artifact");
  if (localArtifacts.length > 0) {
    driftItems.push({
      title: "Local artifact files are present in tracked files",
      impact:
        "This suggests some repo hygiene cleanup may have happened later than ideal, or that artifact exclusions are not fully enforced yet.",
      evidence: localArtifacts
    });
  }

  const generatedOutput = findFilesByCategory(classifiedTrackedFiles, "generated_output");
  if (generatedOutput.length > 0) {
    driftItems.push({
      title: "Generated output is present in tracked files",
      impact:
        "This can blur the project’s source of truth and make debugging or deployment behavior harder to reason about.",
      evidence: generatedOutput.slice(0, 10)
    });
  }

  const workflowSignals = riskSignals.filter(
    (signal) =>
      signal.category === "workflow_complexity" ||
      signal.category === "config_drift"
  );

  if (workflowSignals.length > 0) {
    driftItems.push({
      title: "Environment or workflow complexity is beginning to accumulate",
      impact:
        "Multiple build paths, deployment-specific files, or hardcoded destinations can create drift if ownership is not kept explicit.",
      evidence: workflowSignals.map((signal) => signal.title)
    });
  }

  if (driftItems.length === 0) {
    driftItems.push({
      title: "No strong artifact or drift signal detected from current heuristics",
      impact:
        "That is a healthy sign for this pass, though more subtle drift can still exist in runtime behavior or architecture decisions.",
      evidence: []
    });
  }

  return driftItems;
}

function buildImprovementPriorities(riskSignals, classifiedTrackedFiles) {
  const priorities = [];

  const highSeveritySignals = riskSignals.filter((signal) => signal.severity === "high");
  if (highSeveritySignals.length > 0) {
    priorities.push({
      priority: "high",
      title: "Resolve the strongest hygiene or exposure risks first",
      whyNow:
        "High-severity issues tend to undermine trust in the rest of the project and are usually cheaper to handle early.",
      actions: highSeveritySignals.flatMap((signal) => signal.whatToVerify || []).slice(0, 6)
    });
  }

  const mediumSeveritySignals = riskSignals.filter((signal) => signal.severity === "medium");
  if (mediumSeveritySignals.length > 0) {
    priorities.push({
      priority: "medium",
      title: "Reduce avoidable project complexity before adding more feature surface",
      whyNow:
        "Medium-severity signals often point to drift, weak boundaries, or confusion that will compound during future work.",
      actions: mediumSeveritySignals.flatMap((signal) => signal.whatToVerify || []).slice(0, 6)
    });
  }

  const hasFrontend = getCategoryCount(classifiedTrackedFiles.countsByCategory, "frontend_app") > 0;
  const hasBackend = getCategoryCount(classifiedTrackedFiles.countsByCategory, "backend") > 0;

  if (hasFrontend && hasBackend) {
    priorities.push({
      priority: "medium",
      title: "Review boundary assumptions between frontend and backend layers",
      whyNow:
        "As soon as both layers are active, bugs often come from mismatched assumptions instead of syntax mistakes.",
      actions: [
        "Trace one important user flow end to end.",
        "Check whether backend enforcement matches what the UI appears to promise.",
        "Look for duplicated assumptions across client and server layers."
      ]
    });
  }

  if (priorities.length === 0) {
    priorities.push({
      priority: "low",
      title: "Continue with controlled incremental improvements",
      whyNow:
        "The current heuristic pass did not find major pressure points, so the best next move is to keep structure clean while building gradually.",
      actions: [
        "Add features in small, reviewable slices.",
        "Re-run project health review at feature plateaus.",
        "Keep ownership of config and behavior explicit as the project grows."
      ]
    });
  }

  return priorities;
}

function buildWhatToVerifyNext(riskSignals) {
  const checks = [...new Set(riskSignals.flatMap((signal) => signal.whatToVerify || []))];

  if (checks.length > 0) {
    return checks;
  }

  return [
    "Review one key feature flow end to end.",
    "Confirm the repo’s ignore and build rules match the actual workflow.",
    "Check whether any growing complexity still has a single clear owner."
  ];
}

function buildReviewBoundaries() {
  return {
    included: [
      "repo structure and tracked-file shape",
      "heuristic hygiene and drift signals",
      "basic configuration and artifact review",
      "practical improvement prioritization"
    ],
    notIncluded: [
      "full penetration testing",
      "dependency CVE scanning",
      "runtime verification",
      "formal static analysis",
      "guaranteed vulnerability detection"
    ]
  };
}

function buildConfidence(riskSignals, classifiedTrackedFiles) {
  const trackedCount = classifiedTrackedFiles.files?.length || 0;

  if (trackedCount === 0) {
    return {
      level: "low",
      reasoning: "No tracked files were available for a meaningful project health review."
    };
  }

  if (riskSignals.length >= 3) {
    return {
      level: "medium",
      reasoning: "There is enough visible repo evidence to identify meaningful project-health patterns, but this remains a heuristic review rather than a full audit."
    };
  }

  return {
    level: "medium",
    reasoning: "The repo shape is visible enough to support a useful checkpoint review, but deeper runtime or architectural conclusions would require more than this pass."
  };
}

export function buildProjectHealthReview(
  repoData,
  classifiedTrackedFiles,
  riskSignals
) {
  return {
    mode: "project_health_review",
    repoPath: repoData.repoPath,
    commitRangeContext: repoData.commitRange || null,
    projectOverview: buildProjectSummary(repoData, classifiedTrackedFiles),
    whatIsWorkingWell: buildWhatIsWorkingWell(
      repoData,
      classifiedTrackedFiles,
      riskSignals
    ),
    riskSignals,
    artifactsAndDrift: buildArtifactsAndDrift(
      classifiedTrackedFiles,
      riskSignals
    ),
    improvementPriorities: buildImprovementPriorities(
      riskSignals,
      classifiedTrackedFiles
    ),
    whatToVerifyNext: buildWhatToVerifyNext(riskSignals),
    reviewBoundaries: buildReviewBoundaries(),
    confidence: buildConfidence(riskSignals, classifiedTrackedFiles)
  };
}