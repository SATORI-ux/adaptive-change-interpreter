function getTopCategories(countsByCategory = {}, limit = 3) {
  return Object.entries(countsByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category]) => category);
}

function detectThemes(classifiedChangedFiles) {
  const counts = classifiedChangedFiles.countsByCategory || {};
  const topCategories = getTopCategories(counts, 5);
  const themes = [];

  for (const category of topCategories) {
    if (category === "frontend_app") {
      themes.push("frontend_behavior");
    } else if (category === "styling") {
      themes.push("visual_design");
    } else if (category === "backend") {
      themes.push("backend_logic");
    } else if (category === "database") {
      themes.push("data_model");
    } else if (category === "config_build") {
      themes.push("configuration_build");
    } else if (category === "notifications_background") {
      themes.push("notifications_background");
    } else if (category === "docs") {
      themes.push("documentation");
    }
  }

  return themes;
}

function buildOverview(repoData, themes) {
  const changedCount = repoData.changedFiles?.length || 0;

  if (themes.includes("frontend_behavior") && themes.includes("visual_design")) {
    return `This change range touches ${changedCount} file(s) and mainly reads as a UI-facing feature or refinement that spans both behavior and presentation.`;
  }

  if (themes.includes("backend_logic") && themes.includes("frontend_behavior")) {
    return `This change range touches ${changedCount} file(s) and spans both frontend and backend layers, which usually means the feature or fix crosses a system boundary rather than living in one file.`;
  }

  if (themes.includes("configuration_build")) {
    return `This change range touches ${changedCount} file(s) and includes configuration or build-related work, which can affect how the project behaves across environments.`;
  }

  return `This change range touches ${changedCount} file(s) and appears to be a focused update with a few meaningful implementation areas.`;
}

function buildWhyItMatters(themes) {
  if (themes.includes("frontend_behavior") && themes.includes("visual_design")) {
    return "The main impact is user-facing. The behavior and presentation layers appear to have changed together, which usually means the user experience was adjusted rather than only the internal plumbing.";
  }

  if (themes.includes("backend_logic") && themes.includes("frontend_behavior")) {
    return "This matters because cross-layer changes are where misunderstanding often happens. The user-facing flow may now depend on backend assumptions, validation, or data handling that should be checked end to end.";
  }

  if (themes.includes("configuration_build")) {
    return "This matters because configuration changes can affect environments, deployment behavior, or app wiring in ways that are not always obvious from the UI alone.";
  }

  return "This matters because even a small set of files can reveal the direction of the feature, the structure of the code, and the kinds of follow-up checks that will matter next.";
}

function buildCodeShapeExplanation(classifiedChangedFiles) {
  const counts = classifiedChangedFiles.countsByCategory || {};
  const hasFrontend = counts.frontend_app > 0;
  const hasStyling = counts.styling > 0;
  const hasBackend = counts.backend > 0;
  const hasConfig = counts.config_build > 0;

  if (hasFrontend && hasStyling && !hasBackend) {
    return "The code shape suggests a feature implemented across the app shell and its visual layer. That usually means one file owns behavior while styling files absorb the presentation changes, which is a normal structure for UI work.";
  }

  if (hasFrontend && hasBackend) {
    return "The code shape suggests the change crosses a system boundary. That usually means the frontend is coordinating with backend logic rather than acting as a self-contained interface-only change.";
  }

  if (hasConfig) {
    return "The code shape suggests some of the change lives in configuration or setup layers. That often means the behavior is influenced by environment or build rules rather than only by feature code.";
  }

  return "The code shape suggests a focused change with a limited number of implementation surfaces, which is usually easier to reason about and test.";
}

function buildReadingOrder(classifiedChangedFiles) {
  const files = classifiedChangedFiles.files || [];

  const scored = files.map((file) => {
    let priority = 50;
    let reason = "Supporting file in the selected change range.";

    const lower = file.path.toLowerCase();

    if (lower === "index.html") {
      priority = 100;
      reason = "Entrypoint file. Useful for understanding how the feature is exposed in the UI.";
    } else if (lower.includes("app.") || lower.includes("/app.")) {
      priority = 95;
      reason = "Likely orchestration file. Useful for seeing how the changed behavior is wired together.";
    } else if (file.category === "frontend_app") {
      priority = 85;
      reason = "Behavior file. Useful for understanding feature logic and flow.";
    } else if (file.category === "backend") {
      priority = 84;
      reason = "Backend file. Useful for understanding data handling or enforcement logic.";
    } else if (file.category === "notifications_background") {
      priority = 80;
      reason = "Background logic file. Useful for understanding route, notification, or off-page behavior.";
    } else if (file.category === "styling") {
      priority = 70;
      reason = "Presentation file. Best read after you understand the behavior or structure it supports.";
    } else if (file.category === "config_build") {
      priority = 65;
      reason = "Configuration file. Useful for environment or build understanding.";
    } else if (file.category === "docs") {
      priority = 60;
      reason = "Documentation file. Useful for context, but not always the first technical read.";
    }

    return {
      path: file.path,
      category: file.category,
      priority,
      reason,
    };
  });

  return scored.sort((a, b) => b.priority - a.priority);
}

function buildHowPiecesConnect(themes) {
  const connections = [];

  if (themes.includes("frontend_behavior") && themes.includes("visual_design")) {
    connections.push("Behavior files appear to drive the feature logic, while styling files shape how that behavior is presented to the user.");
  }

  if (themes.includes("backend_logic") && themes.includes("frontend_behavior")) {
    connections.push("Frontend files likely depend on backend rules or responses, so the visible flow should be checked against the server-side truth.");
  }

  if (themes.includes("configuration_build")) {
    connections.push("Configuration or build files may influence how the feature behaves across environments, even if the visible UI change looks small.");
  }

  if (connections.length === 0) {
    connections.push("The changed files appear to support one focused change rather than many unrelated concerns.");
  }

  return connections;
}

function buildPatternTrend(themes) {
  if (themes.includes("frontend_behavior") && themes.includes("visual_design")) {
    return "This looks like a cross-cutting UI refinement pattern, where one feature touches both interaction logic and the styling layer. That is normal, but it can become fragile if ownership starts spreading across too many files.";
  }

  if (themes.includes("backend_logic") && themes.includes("frontend_behavior")) {
    return "This looks like a boundary-crossing implementation pattern. These changes are often more important to understand at the flow level than at the line-by-line level.";
  }

  if (themes.includes("configuration_build")) {
    return "This suggests a project-shape trend where configuration is becoming a meaningful part of behavior. That is not bad, but it raises the importance of environment clarity.";
  }

  return "This looks like a focused incremental change rather than a broad architectural shift.";
}

function dedupeStrings(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function buildWhatToVerify(riskSignals = []) {
  const checks = riskSignals.flatMap((signal) => signal.whatToVerify || []);

  if (checks.length === 0) {
    return [
      "Run the changed user flow end to end.",
      "Confirm the files highest in reading order match the intended behavior.",
      "Check whether the implementation still looks clean after the feature was added."
    ];
  }

  return dedupeStrings(checks);
}

function buildCarryForwardLesson(themes, riskSignals = []) {
  const hasRepoHygiene = riskSignals.some(
    (signal) =>
      signal.category === "repo_hygiene" ||
      signal.category === "security_hygiene"
  );

  if (hasRepoHygiene) {
    return "A feature can work and still reveal hygiene gaps. One of the main lessons is to treat repo discipline and implementation quality as part of the feature, not as cleanup for later.";
  }

  if (themes.includes("backend_logic") && themes.includes("frontend_behavior")) {
    return "When a change spans frontend and backend, the most useful habit is to think in flows and boundaries, not isolated files.";
  }

  if (themes.includes("frontend_behavior") && themes.includes("visual_design")) {
    return "UI changes often look simple in the interface but are easier to understand when you separate behavior ownership from presentation ownership.";
  }

  return "A good review should help you understand the structure and likely pressure points of a change, not just what lines moved.";
}

function buildConfidence(repoData, themes) {
  const changedCount = repoData.changedFiles?.length || 0;

  if (changedCount === 0) {
    return {
      level: "low",
      reasoning: "No changed files were detected in the selected range, so interpretation confidence is limited."
    };
  }

  if (themes.length >= 2) {
    return {
      level: "medium",
      reasoning: "The changed files suggest a meaningful pattern, but implementation intent still has to be inferred from file types and diff shape."
    };
  }

  return {
    level: "medium",
    reasoning: "The change appears focused enough to interpret, but some intent is still inferred rather than explicitly stated."
  };
}

export function buildChangeInterpretation(
  repoData,
  classifiedChangedFiles,
  riskSignals,
  options = {}
) {
  const themes = detectThemes(classifiedChangedFiles);
  const readingOrder = buildReadingOrder(classifiedChangedFiles);

  return {
    mode: "change_interpretation",
    repoPath: repoData.repoPath,
    commitRange: repoData.commitRange,
    explanationDepth: options.explanationDepth || "level_1",
    overview: buildOverview(repoData, themes),
    whyItMatters: buildWhyItMatters(themes),
    codeShape: buildCodeShapeExplanation(classifiedChangedFiles),
    keyThemes: themes,
    readingOrder,
    howPiecesConnect: buildHowPiecesConnect(themes),
    patternTrend: buildPatternTrend(themes),
    riskSignals,
    whatToVerify: buildWhatToVerify(riskSignals),
    carryForwardLesson: buildCarryForwardLesson(themes, riskSignals),
    confidence: buildConfidence(repoData, themes)
  };
}