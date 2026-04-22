function getTopCategories(countsByCategory = {}, limit = 3) {
  return Object.entries(countsByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category]) => category);
}

function uniq(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function getCommitSubjects(commits = []) {
  return commits
    .map((entry) => entry.replace(/^[a-f0-9]+\s+/i, "").trim())
    .filter(Boolean);
}

function dedupeCommitSubjects(subjects = []) {
  const seen = new Set();
  const deduped = [];

  for (const subject of subjects) {
    const normalized = subject.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(subject);
  }

  return deduped;
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
  return sentences.slice(0, 2).join(" ").trim() || null;
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

function normalizeText(text = "") {
  return text.toLowerCase();
}

function countMatches(text, patterns = []) {
  const haystack = normalizeText(text);

  return patterns.reduce((count, pattern) => {
    if (pattern instanceof RegExp) {
      return count + (pattern.test(haystack) ? 1 : 0);
    }

    return count + (haystack.includes(String(pattern).toLowerCase()) ? 1 : 0);
  }, 0);
}

function selectRepresentativePaths(paths = []) {
  const preferred = paths.filter((filePath) => {
    const lower = filePath.toLowerCase();
    return !lower.startsWith("dist/") && !lower.endsWith(".md");
  });

  return (preferred.length > 0 ? preferred : paths).slice(0, 3);
}

function isGeneratedOrDerivedPath(filePath = "") {
  const lower = filePath.toLowerCase();
  return lower.startsWith("dist/") || lower.startsWith("build/");
}

function getDepthProfile(explanationDepth = "level_1") {
  if (explanationDepth === "level_2") {
    return {
      includeIntentContext: true,
      includeBoundaryContext: true,
      includeReadingOrderStrategy: true,
      moreDetailedTrend: true
    };
  }

  return {
    includeIntentContext: false,
    includeBoundaryContext: false,
    includeReadingOrderStrategy: false,
    moreDetailedTrend: false
  };
}

function detectIntentSignals(repoData, classifiedChangedFiles) {
  const commitSubjects = getCommitSubjects(repoData.commits);
  const diffSnippets = repoData.evidence?.changedDiffSnippets || [];
  const changedPaths = repoData.changedFiles || [];
  const combinedCommitText = commitSubjects.join(" \n ");
  const combinedDiffText = diffSnippets.map((item) => item.excerpt).join("\n");
  const combinedPathText = changedPaths.join("\n");
  const counts = classifiedChangedFiles.countsByCategory || {};

  const signalDefinitions = [
    {
      id: "dark_mode",
      label: "dark-mode or theme-system work",
      description:
        "The commit messages and changed files both suggest a theming-focused change, which usually means the goal is to alter the feel of the interface across multiple surfaces rather than tweak one isolated style rule.",
      patterns: ["dark mode", "theme", "palette", "accent", "color-scheme", "--bg", "--surface"]
    },
    {
      id: "responsive_ui",
      label: "responsive layout refinement",
      description:
        "The strongest signals point to follow-up polish for how the interface behaves across screen sizes, which often means the feature was tested in context and then adjusted for real layout pressure.",
      patterns: ["responsive", "design update", "@media", "min-width", "max-width", "clamp(", "viewport", "mobile", "screen and"]
    },
    {
      id: "toggle_or_control",
      label: "new UI controls or toggles",
      description:
        "The range appears to introduce or refine a user control, which usually means there is both visible UI work and state-handling logic behind it.",
      patterns: ["toggle", "button", "switch", "aria-", "checkbox", "theme-toggle"]
    },
    {
      id: "private_flow",
      label: "private or gated-flow behavior",
      description:
        "The changed paths suggest the range touches a more restricted or alternate experience path, which raises the importance of understanding which behavior belongs to the main flow versus a private one.",
      patterns: ["private", "kept", "guard", "access", "protected"]
    },
    {
      id: "copy_or_messaging",
      label: "product copy or messaging refinement",
      description:
        "The range appears to adjust wording or framing, which can matter more than it seems in product-led interfaces because labels, titles, and descriptions often shape the feature’s meaning.",
      patterns: ["title", "label", "copy", "headline", "subtitle", "placeholder"]
    },
    {
      id: "background_behavior",
      label: "background or notification behavior",
      description:
        "The changed evidence suggests browser behavior beyond the main page lifecycle, which adds another layer of execution and usually deserves extra verification.",
      patterns: ["service-worker", "notification", "push", "clients.openwindow", "self.addEventListener"]
    }
  ];

  const scoredSignals = signalDefinitions
    .map((signal) => {
      const commitScore = countMatches(combinedCommitText, signal.patterns);
      const diffScore = countMatches(combinedDiffText, signal.patterns);
      const pathScore = countMatches(combinedPathText, signal.patterns);
      let score = commitScore * 3 + diffScore * 2 + pathScore;

      if (signal.id === "responsive_ui" && commitScore > 0 && (counts.styling || 0) > 0) {
        score += 3;
      }

      if (signal.id === "dark_mode" && ((counts.styling || 0) > 0 || combinedPathText.includes("theme"))) {
        score += 2;
      }

      if (signal.id === "toggle_or_control" && combinedPathText.includes("theme")) {
        score += 2;
      }

      if (signal.id === "copy_or_messaging" && commitScore < 2 && diffScore < 2) {
        score -= 2;
      }

      if (signal.id === "copy_or_messaging" && repoData.changedFiles.length > 3 && commitScore <= 1) {
        score -= 3;
      }

      return {
        ...signal,
        score,
      };
    })
    .filter((signal) => signal.score > 0)
    .sort((a, b) => b.score - a.score);

  if ((counts.frontend_app || 0) > 0 && (counts.styling || 0) > 0 && scoredSignals.length === 0) {
    scoredSignals.push({
      id: "ui_surface",
      label: "UI-facing refinement work",
      description:
        "The changed surface spans behavior and presentation, which usually means the feature is being shaped at the user-experience level rather than only through internal plumbing.",
      score: 1
    });
  }

  return scoredSignals.slice(0, 3);
}

function summarizeChangedSurface(classifiedChangedFiles) {
  const counts = classifiedChangedFiles.countsByCategory || {};
  const changedAreas = [];

  if ((counts.frontend_app || 0) > 0) {
    changedAreas.push("frontend behavior");
  }
  if ((counts.styling || 0) > 0) {
    changedAreas.push("presentation");
  }
  if ((counts.backend || 0) > 0) {
    changedAreas.push("backend logic");
  }
  if ((counts.database || 0) > 0) {
    changedAreas.push("data shape");
  }
  if ((counts.notifications_background || 0) > 0) {
    changedAreas.push("background or notification behavior");
  }
  if ((counts.config_build || 0) > 0) {
    changedAreas.push("configuration or build wiring");
  }

  return changedAreas;
}

function buildOverview(repoData, classifiedChangedFiles, themes, depthProfile) {
  const changedCount = repoData.changedFiles?.length || 0;
  const commitSubjects = dedupeCommitSubjects(getCommitSubjects(repoData.commits)).slice(0, 3);
  const changedAreas = summarizeChangedSurface(classifiedChangedFiles);
  const intentSignals = detectIntentSignals(repoData, classifiedChangedFiles);

  let summary = `This change range touches ${changedCount} file(s)`;

  if (changedAreas.length > 0) {
    summary += ` and most directly affects ${changedAreas.join(", ")}.`;
  } else {
    summary += " and appears to be relatively narrow in surface area.";
  }

  if (intentSignals.length > 0) {
    summary += ` The strongest intent signals point to ${intentSignals.map((signal) => signal.label).join(", ")}.`;
  } else if (commitSubjects.length > 0) {
    summary += ` The commit history in this range suggests themes such as: ${commitSubjects.join("; ")}.`;
  } else if (themes.includes("frontend_behavior") && themes.includes("visual_design")) {
    summary += " It mainly reads as a UI-facing feature or refinement that spans both behavior and presentation.";
  } else if (themes.includes("backend_logic") && themes.includes("frontend_behavior")) {
    summary += " It spans both frontend and backend layers, which usually means the change crosses a system boundary rather than living in one file.";
  } else if (themes.includes("configuration_build")) {
    summary += " It includes configuration or build-related work, which can influence how the rest of the project behaves across environments.";
  }

  if (depthProfile.includeIntentContext && commitSubjects.length > 0) {
    summary += ` The visible commit arc is ${commitSubjects.join(" -> ")}.`;
  }

  return summary;
}

function buildWhyItMatters(repoData, classifiedChangedFiles, themes, depthProfile) {
  const readmeSummary = getReadmeSummary(repoData.evidence?.readme?.excerpt || "");
  const counts = classifiedChangedFiles.countsByCategory || {};
  const intentSignals = detectIntentSignals(repoData, classifiedChangedFiles);
  const changedAreas = summarizeChangedSurface(classifiedChangedFiles);

  if (intentSignals.length > 0) {
    const topSignal = intentSignals[0];

    if (themes.includes("frontend_behavior") && themes.includes("visual_design") && readmeSummary) {
      const boundarySentence =
        depthProfile.includeBoundaryContext && changedAreas.length > 1
          ? ` In this range, the user-facing effect likely depends on coordination across ${changedAreas.join(", ")}.`
          : "";
      return `The main impact is user-facing. ${topSignal.description}${boundarySentence}`;
    }

    return depthProfile.includeBoundaryContext && changedAreas.length > 1
      ? `${topSignal.description} The main reason to care is that the change crosses ${changedAreas.join(", ")}, so the feature story matters more than any one isolated diff hunk.`
      : topSignal.description;
  }

  if (themes.includes("frontend_behavior") && themes.includes("visual_design")) {
    if (readmeSummary) {
      return `The main impact is user-facing. Because the repository description suggests a specific product experience, changes across behavior and presentation are likely to affect how that experience actually feels, not just how it looks.`;
    }

    return "The main impact is user-facing. The behavior and presentation layers appear to have changed together, which usually means the user experience was adjusted rather than only the internal plumbing.";
  }

  if (themes.includes("backend_logic") && themes.includes("frontend_behavior")) {
    return "This matters because cross-layer changes are where misunderstanding often happens. The visible flow may now depend on backend assumptions, validation, or data handling that should be checked end to end.";
  }

  if (themes.includes("configuration_build")) {
    return "This matters because configuration changes can affect environments, deployment behavior, or app wiring in ways that are not always obvious from the main feature code.";
  }

  if ((counts.docs || 0) > 0 && repoData.changedFiles.length === counts.docs) {
    return "This range appears documentation-heavy, which often means the intent of the project or feature is being clarified rather than the runtime behavior changing directly.";
  }

  return "This matters because even a small set of files can reveal the direction of the feature, the structure of the code, and the kinds of follow-up checks that will matter next.";
}

function buildCodeShapeExplanation(repoData, classifiedChangedFiles, depthProfile) {
  const counts = classifiedChangedFiles.countsByCategory || {};
  const changedSnippets = repoData.evidence?.changedFileSnippets || [];
  const diffSnippets = repoData.evidence?.changedDiffSnippets || [];
  const changedPaths = selectRepresentativePaths(changedSnippets.map((item) => item.path));
  const diffPaths = selectRepresentativePaths(diffSnippets.map((item) => item.path));
  const intentSignals = detectIntentSignals(repoData, classifiedChangedFiles);
  const hasFrontend = (counts.frontend_app || 0) > 0;
  const hasStyling = (counts.styling || 0) > 0;
  const hasBackend = (counts.backend || 0) > 0;
  const hasConfig = (counts.config_build || 0) > 0;
  const hasBackground = (counts.notifications_background || 0) > 0;

  if (hasFrontend && hasStyling && !hasBackend) {
    const intentSentence = intentSignals[0]
      ? ` The intent signals especially read as ${intentSignals[0].label}.`
      : "";
    const depthSentence = depthProfile.includeBoundaryContext
      ? " A useful mental model is to treat the JavaScript files as behavior owners and the stylesheet as the place where that behavior gets made coherent across the interface."
      : "";

    return `The code shape suggests a feature implemented across app behavior and presentation. In practical terms, that usually means one or two files own the interaction logic while styling files absorb the visual refinement. Files in this range such as ${changedPaths.join(", ") || diffPaths.join(", ") || "the changed frontend files"} fit that pattern.${intentSentence}${depthSentence}`;
  }

  if (hasFrontend && hasBackend) {
    return depthProfile.includeBoundaryContext
      ? "The code shape suggests the change crosses a system boundary. That usually means the frontend is coordinating with backend behavior instead of acting as a self-contained interface-only change, so understanding the flow matters more than reading files in isolation. A good review should follow the request or state transition from UI trigger to backend enforcement and then back to the visible result."
      : "The code shape suggests the change crosses a system boundary. That usually means the frontend is coordinating with backend behavior instead of acting as a self-contained interface-only change, so understanding the flow matters more than reading files in isolation.";
  }

  if (hasBackground) {
    return "The code shape suggests the change affects both visible app flow and background behavior. That often raises subtle routing or state-consistency questions because the browser page is no longer the only execution surface involved.";
  }

  if (hasConfig) {
    return "The code shape suggests some of the change lives in configuration or setup layers. That often means the visible behavior is influenced by environment or build rules rather than only by feature code.";
  }

  return "The code shape suggests a focused change with a limited number of implementation surfaces, which is usually easier to reason about and test.";
}

function buildReadingOrder(classifiedChangedFiles, repoData, intentSignals, depthProfile) {
  const files = classifiedChangedFiles.files || [];
  const entryFiles = repoData.evidence?.frontendEntryFiles || [];
  const readmePath = repoData.evidence?.readme?.path;
  const preferredSourcePaths = new Set(selectRepresentativePaths(files.map((file) => file.path)));
  const wantsThemeContext = intentSignals.some(
    (signal) => signal.id === "dark_mode" || signal.id === "toggle_or_control"
  );

  const scored = files.map((file) => {
    let priority = 50;
    let reason = "Supporting file in the selected change range.";

    const lower = file.path.toLowerCase();

    if (isGeneratedOrDerivedPath(file.path)) {
      priority = 25;
      reason = "Generated or derived output. Useful only after you understand the source files that produce it.";
    } else if (preferredSourcePaths.has(file.path)) {
      priority = 97;
      reason = "Representative source file from the selected range. A strong starting point for understanding the main implementation path.";
    } else if (readmePath && file.path === readmePath) {
      priority = depthProfile.includeReadingOrderStrategy ? 88 : 78;
      reason = depthProfile.includeReadingOrderStrategy
        ? "Project framing file. Read this first if you want product intent before implementation detail."
        : "Project framing file. Useful for understanding what the change is trying to support before reading implementation details.";
    } else if (entryFiles.includes(file.path) || lower === "index.html") {
      priority = 95;
      reason = "Entrypoint or shell file. Useful for seeing where the changed behavior is exposed or initialized.";
    } else if (wantsThemeContext && lower.includes("theme")) {
      priority = 93;
      reason = "Theme or control file. Useful for understanding how the new UI state is represented and applied.";
    } else if (lower.includes("app.") || lower.includes("/app.")) {
      priority = 92;
      reason = "Likely orchestration file. Useful for seeing how the changed behavior is wired together.";
    } else if (file.category === "frontend_app") {
      priority = 85;
      reason = "Behavior file. Useful for understanding feature logic and user flow.";
    } else if (file.category === "backend") {
      priority = 84;
      reason = "Backend file. Useful for understanding enforcement logic, data handling, or cross-layer assumptions.";
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
      reason: depthProfile.includeReadingOrderStrategy && !isGeneratedOrDerivedPath(file.path)
        ? `${reason} Read this at this stage because it clarifies one layer of the feature before you move to the next.`
        : reason,
    };
  });

  return scored.sort((a, b) => b.priority - a.priority);
}

function buildHowPiecesConnect(repoData, classifiedChangedFiles, themes, depthProfile) {
  const connections = [];
  const packageScripts = Object.keys(repoData.evidence?.packageScripts || {});
  const intentSignals = detectIntentSignals(repoData, classifiedChangedFiles);

  if (themes.includes("frontend_behavior") && themes.includes("visual_design")) {
    connections.push("Behavior files appear to drive the feature logic, while styling files shape how that behavior is presented to the user.");
  }

  if (themes.includes("backend_logic") && themes.includes("frontend_behavior")) {
    connections.push("Frontend files likely depend on backend rules or responses, so the visible flow should be checked against the server-side truth.");
  }

  if (themes.includes("notifications_background")) {
    connections.push("Some of the user-visible experience may now depend on background logic, which means behavior can diverge if page flow and service-worker assumptions stop matching.");
  }

  if (themes.includes("configuration_build") && packageScripts.length > 0) {
    connections.push(`Configuration or build files may influence how the feature behaves across environments, and package scripts such as ${packageScripts.slice(0, 4).join(", ")} help define that wiring.`);
  }

  const changedAreas = summarizeChangedSurface(classifiedChangedFiles);
  if (connections.length === 0 && changedAreas.length > 1) {
    connections.push(`The changed files appear to support one connected change across ${changedAreas.join(", ")}, rather than many unrelated concerns.`);
  }

  if (intentSignals.length > 1) {
    connections.push(`Within that broader change, the strongest sub-themes appear to be ${intentSignals.map((signal) => signal.label).join(", ")}, which suggests a feature followed by real-world refinement rather than a single isolated edit.`);
  }

  if (depthProfile.includeBoundaryContext && themes.includes("frontend_behavior") && themes.includes("visual_design")) {
    connections.push("A practical way to read the range is to start with the file that introduces or wires the UI state, then move to the files that propagate that state across the interface, and only then read the stylesheet that makes the state visible.");
  }

  if (connections.length === 0) {
    connections.push("The changed files appear to support one focused change rather than many unrelated concerns.");
  }

  return connections;
}

function buildPatternTrend(themes, riskSignals, intentSignals, depthProfile) {
  const hasBoundaryRisk = riskSignals.some((signal) => signal.category === "boundary_complexity");

  if (themes.includes("frontend_behavior") && themes.includes("visual_design")) {
    return depthProfile.moreDetailedTrend && intentSignals.length > 1
      ? `This looks like a cross-cutting UI refinement pattern, where one feature touches both interaction logic and the styling layer. In this range, the sub-patterns of ${intentSignals.map((signal) => signal.label).join(", ")} suggest a feature introduction followed by stabilization and polish.`
      : "This looks like a cross-cutting UI refinement pattern, where one feature touches both interaction logic and the styling layer. That is normal, but it can become fragile if ownership starts spreading across too many files.";
  }

  if (themes.includes("backend_logic") && themes.includes("frontend_behavior")) {
    return "This looks like a boundary-crossing implementation pattern. These changes are usually more important to understand at the flow level than at the line-by-line level.";
  }

  if (themes.includes("configuration_build")) {
    return "This suggests a project-shape trend where configuration is becoming a meaningful part of behavior. That is not inherently bad, but it raises the importance of environment clarity.";
  }

  if (hasBoundaryRisk) {
    return "The current range suggests a growing boundary-complexity pattern, where bugs are more likely to come from mismatched assumptions between layers than from isolated syntax mistakes.";
  }

  return "This looks like a focused incremental change rather than a broad architectural shift.";
}

function buildWhatToVerify(riskSignals = [], readingOrder = []) {
  const checks = uniq(riskSignals.flatMap((signal) => signal.whatToVerify || []));

  if (checks.length === 0) {
    const topPath = readingOrder[0]?.path;
    return [
      "Run the changed user flow end to end.",
      topPath
        ? `Start review with ${topPath} and confirm it matches the intended behavior.`
        : "Confirm the files highest in reading order match the intended behavior.",
      "Check whether the implementation still looks clean after the feature was added."
    ];
  }

  return checks;
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

  if (themes.includes("configuration_build")) {
    return "Configuration changes are easier to trust when you explicitly name which environment assumptions live in code and which live in tooling.";
  }

  return "A good review should help you understand the structure and likely pressure points of a change, not just what lines moved.";
}

function buildConfidence(repoData, themes) {
  const changedCount = repoData.changedFiles?.length || 0;
  const evidencePoints = [
    getCommitSubjects(repoData.commits).length > 0,
    repoData.evidence?.changedFileSnippets?.length > 0,
    Boolean(getReadmeSummary(repoData.evidence?.readme?.excerpt || "")),
    repoData.diffStat?.length > 0
  ].filter(Boolean).length;

  if (changedCount === 0) {
    return {
      level: "low",
      reasoning: "No changed files were detected in the selected range, so interpretation confidence is limited."
    };
  }

  if (evidencePoints >= 3 && themes.length >= 1) {
    return {
      level: "medium",
      reasoning: "This interpretation is grounded in multiple direct signals from the selected range, including commit metadata, changed-file context, and diff shape, but some intent still has to be inferred."
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
  const intentSignals = detectIntentSignals(repoData, classifiedChangedFiles);
  const explanationDepth = options.explanationDepth || "level_1";
  const depthProfile = getDepthProfile(explanationDepth);
  const readingOrder = buildReadingOrder(
    classifiedChangedFiles,
    repoData,
    intentSignals,
    depthProfile
  );

  return {
    mode: "change_interpretation",
    repoPath: repoData.repoPath,
    commitRange: repoData.commitRange,
    explanationDepth,
    overview: buildOverview(repoData, classifiedChangedFiles, themes, depthProfile),
    whyItMatters: buildWhyItMatters(
      repoData,
      classifiedChangedFiles,
      themes,
      depthProfile
    ),
    codeShape: buildCodeShapeExplanation(
      repoData,
      classifiedChangedFiles,
      depthProfile
    ),
    keyThemes: themes,
    readingOrder,
    howPiecesConnect: buildHowPiecesConnect(
      repoData,
      classifiedChangedFiles,
      themes,
      depthProfile
    ),
    patternTrend: buildPatternTrend(
      themes,
      riskSignals,
      intentSignals,
      depthProfile
    ),
    riskSignals,
    whatToVerify: buildWhatToVerify(riskSignals, readingOrder),
    carryForwardLesson: buildCarryForwardLesson(themes, riskSignals),
    confidence: buildConfidence(repoData, themes)
  };
}
