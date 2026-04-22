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

function uniq(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function getReadmeSummary(readmeExcerpt = "") {
  const cleaned = readmeExcerpt
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .join(" ");

  if (!cleaned) {
    return null;
  }

  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  const summary = sentences.slice(0, 2).join(" ").trim();
  return summary || null;
}

function getScriptNames(packageScripts = {}) {
  return Object.keys(packageScripts);
}

function hasScript(packageScripts = {}, prefix) {
  return getScriptNames(packageScripts).some((name) => name === prefix || name.startsWith(`${prefix}:`));
}

function inferProjectIdentity(repoData) {
  const readmeSummary = getReadmeSummary(repoData.evidence?.readme?.excerpt || "");

  if (readmeSummary) {
    return {
      summary: `The README suggests this project is trying to do something specific rather than acting as a generic starter: ${readmeSummary}`,
      source: "readme"
    };
  }

  const packageDescription = repoData.packageJson?.description?.trim();
  if (packageDescription) {
    return {
      summary: `The package description suggests the repo has a defined purpose: ${packageDescription}.`,
      source: "package_json"
    };
  }

  return {
    summary:
      "The repo does not expose a strong product description in the gathered evidence, so the project purpose still has to be inferred mostly from file structure.",
    source: "inference"
  };
}

function detectSystems(repoData, classifiedTrackedFiles) {
  const evidence = repoData.evidence || {};
  const counts = classifiedTrackedFiles.countsByCategory || {};
  const systems = [];

  if (getCategoryCount(counts, "frontend_app") > 0) {
    const entryLabel = evidence.frontendEntryFiles?.length
      ? `A frontend application shell is present, with likely entry files such as ${evidence.frontendEntryFiles.slice(0, 3).join(", ")}.`
      : "A frontend application shell is present based on the tracked HTML and JavaScript files.";
    systems.push(entryLabel);
  }

  if (getCategoryCount(counts, "styling") > 0) {
    systems.push("A dedicated visual layer is visible through tracked styling files, which is a good sign that behavior and presentation are not completely collapsed together.");
  }

  if (evidence.backendFiles?.length > 0) {
    systems.push(`Backend support is present through files such as ${evidence.backendFiles.slice(0, 3).join(", ")}, which means some important behavior likely lives beyond the browser layer.`);
  }

  if (evidence.databaseFiles?.length > 0) {
    systems.push(`Database or persistence concerns are visible through ${evidence.databaseFiles.length} tracked database-oriented file(s), so data-shape assumptions matter alongside UI behavior.`);
  }

  if (evidence.serviceWorkerFiles?.length > 0) {
    systems.push(`Background or notification behavior is present through ${evidence.serviceWorkerFiles.slice(0, 2).join(", ")}, which adds another execution surface beyond the main page lifecycle.`);
  }

  const scripts = evidence.packageScripts || {};
  if (hasScript(scripts, "build") || hasScript(scripts, "dev") || hasScript(scripts, "preview")) {
    const scriptNames = getScriptNames(scripts).slice(0, 6).join(", ");
    systems.push(`The build and workflow layer is explicit in package scripts such as ${scriptNames}, which makes environment and deployment ownership easier to inspect.`);
  }

  return systems;
}

function buildProjectSummary(repoData, classifiedTrackedFiles) {
  const counts = classifiedTrackedFiles.countsByCategory || {};
  const topCategories = getTopCategories(counts, 4);
  const categorySummary = topCategories
    .map((entry) => `${entry.category} (${entry.count})`)
    .join(", ");
  const identity = inferProjectIdentity(repoData);
  const systems = detectSystems(repoData, classifiedTrackedFiles);

  let summary =
    `${identity.summary} ` +
    `This repository currently contains ${repoData.trackedFiles.length} tracked file(s), with the strongest visible implementation areas being ${categorySummary || "no strong file-category pattern detected yet"}.`;

  if (systems.length > 0) {
    summary += ` The current repo evidence points to these main systems: ${systems.join(" ")}`;
  }

  const boundarySignals = [];
  if (getCategoryCount(counts, "frontend_app") > 0 && repoData.evidence?.backendFiles?.length > 0) {
    boundarySignals.push("frontend behavior versus backend enforcement");
  }
  if (repoData.evidence?.serviceWorkerFiles?.length > 0) {
    boundarySignals.push("page behavior versus background notification logic");
  }
  if (repoData.evidence?.privateBuildIndicators?.length > 0 || hasScript(repoData.evidence?.packageScripts, "build")) {
    boundarySignals.push("source code versus environment-specific build or deploy rules");
  }

  if (boundarySignals.length > 0) {
    summary += ` The main complexity appears to be accumulating at the boundaries between ${boundarySignals.join(", ")}.`;
  }

  return summary;
}

function buildWhatIsWorkingWell(repoData, classifiedTrackedFiles, riskSignals) {
  const counts = classifiedTrackedFiles.countsByCategory || {};
  const strengths = [];
  const readmeSummary = getReadmeSummary(repoData.evidence?.readme?.excerpt || "");
  const scripts = repoData.evidence?.packageScripts || {};

  if (readmeSummary) {
    strengths.push({
      title: "The repository documents product intent in plain language",
      whyItMatters:
        "A readable README gives the project a stable source of truth for what it is trying to do, which lowers the chance of feature drift during AI-assisted iteration."
    });
  }

  if (repoData.packageJson) {
    const scriptNames = getScriptNames(scripts);
    const workflowDescription = scriptNames.length > 0
      ? ` Scripts such as ${scriptNames.slice(0, 5).join(", ")} make the workflow inspectable.`
      : "";

    strengths.push({
      title: "Project metadata is structured enough to inspect package-level behavior",
      whyItMatters:
        `A readable package.json makes build and tooling review easier and gives the project a clearer source of truth.${workflowDescription}`
    });
  }

  if (getCategoryCount(counts, "frontend_app") > 0 && getCategoryCount(counts, "styling") > 0) {
    strengths.push({
      title: "The repo shows a visible split between app behavior and presentation",
      whyItMatters:
        "That separation is a healthy sign because cross-cutting UI changes are easier to reason about when styling and behavior are not fully tangled."
    });
  }

  if (repoData.evidence?.backendFiles?.length > 0 || repoData.evidence?.databaseFiles?.length > 0) {
    strengths.push({
      title: "The project already reflects real system boundaries instead of staying purely cosmetic",
      whyItMatters:
        "Seeing backend or data-layer structure in the repo means the app is being shaped around actual workflow behavior rather than only mockup-level screens."
    });
  }

  if (repoData.gitignore?.exists) {
    strengths.push({
      title: ".gitignore is present and reviewable",
      whyItMatters:
        "That does not guarantee perfect hygiene, but it gives the project a place where artifact and secret-handling rules can be made explicit."
    });
  }

  if (riskSignals.length === 0) {
    strengths.push({
      title: "No major heuristic risk signals were detected in this pass",
      whyItMatters:
        "That does not prove the repo is perfect, but it suggests there are no obvious high-signal hygiene or structure warnings from the current rules."
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

function buildArtifactsAndDrift(repoData, classifiedTrackedFiles, riskSignals) {
  const evidence = repoData.evidence || {};
  const driftItems = [];

  const localArtifacts = evidence.localArtifactFiles?.length
    ? evidence.localArtifactFiles
    : findFilesByCategory(classifiedTrackedFiles, "local_artifact");
  if (localArtifacts.length > 0) {
    driftItems.push({
      title: "Local artifact files are present in tracked files",
      impact:
        "This suggests some hygiene rules may have been tightened after work was already in motion, which is common, but it also means residue can stay around unless cleanup is deliberate.",
      evidence: localArtifacts
    });
  }

  const generatedOutput = evidence.generatedOutputFiles?.length
    ? evidence.generatedOutputFiles
    : findFilesByCategory(classifiedTrackedFiles, "generated_output");
  if (generatedOutput.length > 0) {
    driftItems.push({
      title: "Generated output is present in tracked files",
      impact:
        "Tracked build artifacts can blur the source of truth by making it harder to tell whether behavior should be edited in source files or regenerated from the build pipeline.",
      evidence: generatedOutput.slice(0, 10)
    });
  }

  if (evidence.privateBuildIndicators?.length > 0) {
    driftItems.push({
      title: "Environment-specific or private-build paths appear to exist",
      impact:
        "Once a repo grows multiple build or deployment paths, drift becomes more likely unless ownership of those differences is made explicit.",
      evidence: evidence.privateBuildIndicators.slice(0, 10)
    });
  }

  const workflowSignals = riskSignals.filter(
    (signal) =>
      signal.category === "workflow_complexity" ||
      signal.category === "config_drift"
  );

  if (workflowSignals.length > 0) {
    driftItems.push({
      title: "Environment and routing assumptions deserve an explicit owner",
      impact:
        "The strongest drift risks in this pass come from configuration and workflow boundaries, not from syntax-level code issues.",
      evidence: workflowSignals.map((signal) => signal.title)
    });
  }

  if (driftItems.length === 0) {
    driftItems.push({
      title: "No strong artifact or drift signal detected from current heuristics",
      impact:
        "That is a healthy sign for this pass, though more subtle drift can still exist in runtime behavior, documentation accuracy, or environment ownership.",
      evidence: []
    });
  }

  return driftItems;
}

function buildImprovementPriorities(repoData, riskSignals, classifiedTrackedFiles) {
  const priorities = [];
  const evidence = repoData.evidence || {};

  const highSeveritySignals = riskSignals.filter((signal) => signal.severity === "high");
  if (highSeveritySignals.length > 0) {
    priorities.push({
      priority: "high",
      title: "Resolve the strongest hygiene or exposure risks first",
      whyNow:
        "High-severity issues undermine trust in the rest of the project and are usually cheaper to address before more feature work depends on them.",
      actions: uniq(highSeveritySignals.flatMap((signal) => signal.whatToVerify || [])).slice(0, 6)
    });
  }

  const mediumSeveritySignals = riskSignals.filter((signal) => signal.severity === "medium");
  if (mediumSeveritySignals.length > 0) {
    priorities.push({
      priority: "medium",
      title: "Reduce avoidable complexity before adding much more surface area",
      whyNow:
        "The medium-severity signals in this pass point more toward drift and weak boundaries than toward one catastrophic flaw, which is exactly the stage where cleanup has high leverage.",
      actions: uniq(mediumSeveritySignals.flatMap((signal) => signal.whatToVerify || [])).slice(0, 6)
    });
  }

  const hasFrontend = getCategoryCount(classifiedTrackedFiles.countsByCategory, "frontend_app") > 0;
  const hasBackend = evidence.backendFiles?.length > 0 || getCategoryCount(classifiedTrackedFiles.countsByCategory, "backend") > 0;
  if (hasFrontend && hasBackend) {
    priorities.push({
      priority: "medium",
      title: "Review the assumptions shared across frontend and backend layers",
      whyNow:
        "Once both layers are active, a lot of bugs come from mismatched promises and enforcement rules rather than isolated implementation mistakes.",
      actions: [
        "Trace one important user flow end to end.",
        "Check whether backend enforcement matches what the UI appears to promise.",
        "Look for duplicated assumptions across client and server layers."
      ]
    });
  }

  if (evidence.serviceWorkerFiles?.length > 0) {
    priorities.push({
      priority: "medium",
      title: "Make background and routing ownership more explicit",
      whyNow:
        "Service worker behavior is easy to forget during normal UI development, so notification targets and route ownership should be treated as first-class design decisions.",
      actions: [
        "Document which file owns notification or redirect targets.",
        "Verify background behavior against the current deployment target.",
        "Check whether any environment-specific URL should move into config."
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
  const checks = uniq(riskSignals.flatMap((signal) => signal.whatToVerify || []));

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
      "selected repository evidence such as README, scripts, and service worker snippets",
      "heuristic hygiene and drift signals",
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

function buildConfidence(repoData, riskSignals, classifiedTrackedFiles) {
  const trackedCount = classifiedTrackedFiles.files?.length || 0;
  const evidence = repoData.evidence || {};
  const evidencePoints = [
    evidence.readme?.exists,
    Object.keys(evidence.packageScripts || {}).length > 0,
    evidence.serviceWorkerSnippets?.length > 0,
    evidence.backendFiles?.length > 0,
    evidence.databaseFiles?.length > 0
  ].filter(Boolean).length;

  if (trackedCount === 0) {
    return {
      level: "low",
      reasoning: "No tracked files were available for a meaningful project health review."
    };
  }

  if (evidencePoints >= 3) {
    return {
      level: "medium",
      reasoning: "This review is grounded in multiple direct repo signals such as README content, package scripts, and system-specific files, but it is still a heuristic project review rather than a runtime audit."
    };
  }

  if (riskSignals.length >= 3) {
    return {
      level: "medium",
      reasoning: "There is enough visible repo evidence to identify meaningful project-health patterns, but several conclusions still depend on inference from structure rather than runtime proof."
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
      repoData,
      classifiedTrackedFiles,
      riskSignals
    ),
    improvementPriorities: buildImprovementPriorities(
      repoData,
      riskSignals,
      classifiedTrackedFiles
    ),
    whatToVerifyNext: buildWhatToVerifyNext(riskSignals),
    reviewBoundaries: buildReviewBoundaries(),
    confidence: buildConfidence(repoData, riskSignals, classifiedTrackedFiles)
  };
}
