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
    } else if (category === "analysis_engine" || category === "other") {
      const hasImplementationLogic = classifiedChangedFiles.files?.some(
        (file) => isImplementationLikeFile(file)
      );

      if (hasImplementationLogic) {
        themes.push("implementation_logic");
      }
    }
  }

  return uniq(themes);
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

function describeRepresentativePaths(paths = [], fallback = "the changed files") {
  const representativePaths = selectRepresentativePaths(paths);

  if (representativePaths.length === 0) {
    return fallback;
  }

  return representativePaths.join(", ");
}

function getRepresentativeCategoryPaths(classifiedChangedFiles, category, limit = 3) {
  return selectRepresentativePaths(
    (classifiedChangedFiles.files || [])
      .filter((file) => file.category === category)
      .map((file) => file.path)
  ).slice(0, limit);
}

function getPrivateOrGatedPaths(paths = []) {
  return paths.filter((filePath) => {
    const lower = filePath.toLowerCase();
    return (
      lower.includes("private") ||
      lower.includes("kept") ||
      lower.includes("protected") ||
      lower.includes("guard")
    );
  });
}

function isGeneratedOrDerivedPath(filePath = "") {
  const lower = filePath.toLowerCase();
  return lower.startsWith("dist/") || lower.startsWith("build/");
}

function isImplementationCategory(category = "") {
  return [
    "frontend_app",
    "styling",
    "backend",
    "database",
    "notifications_background"
  ].includes(category);
}

function isGenericSourceCodePath(filePath = "") {
  const lower = filePath.toLowerCase();

  if (!(lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".ts") || lower.endsWith(".jsx") || lower.endsWith(".tsx"))) {
    return false;
  }

  return !(
    lower === "package.json" ||
    lower === "package-lock.json" ||
    lower.endsWith(".config.js") ||
    lower.endsWith(".config.mjs") ||
    lower.endsWith(".config.ts") ||
    lower.startsWith("supabase/") ||
    lower.startsWith("api/") ||
    lower.startsWith("server/")
  );
}

function isImplementationLikeFile(file) {
  return isImplementationCategory(file.category) || isGenericSourceCodePath(file.path);
}

function hasPathToken(filePath = "", token = "") {
  const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\/_\\-.])${escapedToken}([\\/_\\-.]|$)`).test(filePath);
}

function isSignalBearingImplementationFile(file) {
  const lower = file.path.toLowerCase();

  if (!isImplementationCategory(file.category)) {
    return false;
  }

  if (file.category === "styling" ||
      file.category === "backend" ||
      file.category === "database" ||
      file.category === "notifications_background") {
    return true;
  }

  return (
    lower.endsWith(".html") ||
    lower.startsWith("js/") ||
    lower.includes("/js/") ||
    hasPathToken(lower, "theme") ||
    hasPathToken(lower, "ui") ||
    lower.includes("/app.") ||
    lower.includes("/main.") ||
    hasPathToken(lower, "components") ||
    hasPathToken(lower, "component") ||
    hasPathToken(lower, "pages") ||
    hasPathToken(lower, "page") ||
    hasPathToken(lower, "screens") ||
    hasPathToken(lower, "screen") ||
    hasPathToken(lower, "routes") ||
    hasPathToken(lower, "route")
  );
}

function getSignalBearingImplementationPaths(classifiedChangedFiles) {
  return (classifiedChangedFiles.files || [])
    .filter((file) => isSignalBearingImplementationFile(file))
    .map((file) => file.path);
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

function buildReadingStageReason(file, baseReason, context = {}) {
  const lower = file.path.toLowerCase();

  if (isGeneratedOrDerivedPath(file.path)) {
    return baseReason;
  }

  if (context.readmePath && file.path === context.readmePath) {
    return `${baseReason} Use this step to anchor yourself in the product goal before interpreting implementation choices.`;
  }

  if (lower === "index.html" || lower.endsWith("/index.html")) {
    return `${baseReason} Read this early to see where the changed experience becomes visible to the user.`;
  }

  if (lower.endsWith(".html")) {
    return `${baseReason} Read this after the main entry document so you can compare how an alternate page surface expresses the same feature ideas.`;
  }

  if (context.entryFiles?.includes(file.path) || lower.includes("app.") || lower.includes("/app.")) {
    return `${baseReason} Read this right after the entry document so you can trace how the visible experience gets coordinated in code.`;
  }

  if (context.preferredSourcePaths?.has(file.path) && (lower.includes("private") || lower.includes("kept"))) {
    return `${baseReason} Read this after the main entry path so you can compare the alternate or gated flow against the default experience.`;
  }

  if (context.preferredSourcePaths?.has(file.path)) {
    return `${baseReason} Start here to see the primary feature path before branching into supporting files.`;
  }

  if (context.wantsThemeContext && lower.includes("theme")) {
    return `${baseReason} Read this after the entry flow so you can see how UI state is represented and applied across the feature.`;
  }

  if (lower.includes("app.") || lower.includes("/app.")) {
    return `${baseReason} Read this once you know the entry point so you can trace how the rest of the feature gets coordinated.`;
  }

  if (file.category === "backend") {
    return `${baseReason} Read this after the UI layer so you can compare what the interface assumes with what the backend actually enforces.`;
  }

  if (file.category === "notifications_background") {
    return `${baseReason} Read this after the main flow so you can check whether off-page behavior still matches the visible experience.`;
  }

  if (file.category === "styling") {
    return `${baseReason} Save this for later so you can interpret the visual polish in the context of behavior you already understand.`;
  }

  if (file.category === "config_build") {
    return `${baseReason} Read this after the feature files if you need to understand environment or deployment assumptions.`;
  }

  if (file.category === "docs") {
    return `${baseReason} Use this to cross-check intent if the code story starts feeling ambiguous.`;
  }

  return `${baseReason} Read this at this stage because it adds supporting detail without being the best first entry point.`;
}

function detectIntentSignals(repoData, classifiedChangedFiles) {
  const commitSubjects = getCommitSubjects(repoData.commits);
  const implementationPaths = new Set(
    getSignalBearingImplementationPaths(classifiedChangedFiles)
  );
  const diffSnippets = repoData.evidence?.changedDiffSnippets || [];
  const changedPaths = (repoData.changedFiles || []).filter((filePath) =>
    implementationPaths.has(filePath)
  );
  const combinedCommitText = commitSubjects.join(" \n ");
  const combinedDiffText = diffSnippets
    .filter((item) => implementationPaths.has(item.path))
    .map((item) => item.excerpt)
    .join("\n");
  const combinedPathText = changedPaths.join("\n");
  const counts = classifiedChangedFiles.countsByCategory || {};

  const signalDefinitions = [
    {
      id: "dark_mode",
      label: "dark-mode or theme-system work",
      description:
        "The commit messages and changed files point to theme-system work across more than one interface surface.",
      patterns: ["dark mode", "dark-theme", "theme", "palette"]
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
        "The range introduces or refines a user control, so review both the visible UI and the state-handling path behind it.",
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
        "The range adjusts wording or framing. In product-led interfaces, labels and descriptions often carry feature meaning, not just decoration.",
      patterns: ["title", "label", "copy", "headline", "subtitle", "placeholder"]
    },
    {
      id: "background_behavior",
      label: "background or notification behavior",
      description:
        "The changed evidence includes browser behavior outside the main page lifecycle, adding another execution path to verify.",
      patterns: ["service-worker", "notification", "push", "clients.openwindow", "self.addEventListener"]
    }
  ];

  const scoredSignals = signalDefinitions
    .map((signal) => {
      const commitScore = countMatches(combinedCommitText, signal.patterns);
      const diffScore = countMatches(combinedDiffText, signal.patterns);
      const pathScore = countMatches(combinedPathText, signal.patterns);
      let score = commitScore * 3 + diffScore * 2 + pathScore;

      // Commit subjects can describe polish or docs around a feature without
      // meaning the implementation actually changed in that area.
      if (diffScore === 0 && pathScore === 0) {
        score = 0;
      }

      if (signal.id === "responsive_ui" && commitScore > 0 && (counts.styling || 0) > 0) {
        score += 3;
      }

      if (signal.id === "dark_mode" && ((counts.styling || 0) > 0 || combinedPathText.includes("theme"))) {
        score += 2;
      }

      if (
        signal.id === "dark_mode" &&
        !/\b(dark mode|dark-theme|theme|palette)\b/i.test(
          `${combinedCommitText}\n${combinedDiffText}\n${combinedPathText}`
        )
      ) {
        score = 0;
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
        "The changed surface spans behavior and presentation, so the user experience changed alongside the internal wiring.",
      score: 1
    });
  }

  return scoredSignals.slice(0, 3);
}

function summarizeChangedSurface(classifiedChangedFiles) {
  const counts = classifiedChangedFiles.countsByCategory || {};
  const changedAreas = [];
  const hasGenericSourceCode = (classifiedChangedFiles.files || []).some(
    (file) => file.category === "other" && isGenericSourceCodePath(file.path)
  );

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
  if (hasGenericSourceCode) {
    changedAreas.push("implementation logic");
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
    summary += " but the changed paths do not map cleanly to a stronger known category, so the surface area should be treated as uncertain.";
  }

  if (intentSignals.length > 0) {
    summary += ` The strongest intent signals point to ${intentSignals.map((signal) => signal.label).join(", ")}.`;
  } else if (commitSubjects.length > 0) {
    summary += ` The commit subjects provide indirect intent evidence: ${commitSubjects.join("; ")}.`;
  } else if (themes.includes("frontend_behavior") && themes.includes("visual_design")) {
    summary += " It mainly reads as a UI-facing feature or refinement that spans both behavior and presentation.";
  } else if (themes.includes("backend_logic") && themes.includes("frontend_behavior")) {
    summary += " The observed file categories span frontend and backend layers, which is direct evidence that review should follow the flow across that boundary.";
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
      ? `${topSignal.description} The change crosses ${changedAreas.join(", ")}, so review the feature story before getting lost in isolated diff hunks.`
      : topSignal.description;
  }

  if (themes.includes("frontend_behavior") && themes.includes("visual_design")) {
    if (readmeSummary) {
      return "The main impact is user-facing. Behavior and presentation changed together, so review the experience as a flow rather than separating visual polish from interaction logic.";
    }

    return "The main impact is user-facing. Behavior and presentation changed together, so the review should focus on the experience the user now moves through.";
  }

  if (themes.includes("backend_logic") && themes.includes("frontend_behavior")) {
    return "This matters because cross-layer changes are where misunderstanding often happens. The visible flow may now depend on backend assumptions, validation, or data handling that should be checked end to end.";
  }

  if (themes.includes("configuration_build")) {
    return "This matters because configuration changes can affect environments, deployment behavior, or app wiring in ways that are not always obvious from the main feature code.";
  }

  if (themes.includes("implementation_logic")) {
    return "This matters because the change touches implementation logic without a stronger product-specific category signal, so the safest interpretation is to focus on what behavior the code path may now shape and what remains uncertain.";
  }

  if ((counts.docs || 0) > 0 && repoData.changedFiles.length === counts.docs) {
    return "This range is documentation-heavy. Treat it as intent or operating-context work unless a runtime file also changes.";
  }

  const changedPathSummary = describeRepresentativePaths(repoData.changedFiles);
  return `This matters because the selected range changes ${changedPathSummary}, but the available category and intent signals are weak. Treat the behavioral impact as uncertain until you inspect the changed path directly and identify its callers or runtime surface.`;
}

function buildCodeShapeExplanation(repoData, classifiedChangedFiles, themes, depthProfile) {
  const counts = classifiedChangedFiles.countsByCategory || {};
  const changedSnippets = repoData.evidence?.changedFileSnippets || [];
  const diffSnippets = repoData.evidence?.changedDiffSnippets || [];
  const signalBearingPaths = getSignalBearingImplementationPaths(classifiedChangedFiles);
  const changedPaths = selectRepresentativePaths(
    signalBearingPaths.length > 0
      ? signalBearingPaths
      : changedSnippets.map((item) => item.path)
  );
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

    return `The code shape is split between app behavior and presentation. Files such as ${changedPaths.join(", ") || diffPaths.join(", ") || "the changed frontend files"} carry the implementation path, while styling expresses the resulting state to the user.${intentSentence}${depthSentence}`;
  }

  if (hasFrontend && hasBackend) {
    const frontendPaths = getRepresentativeCategoryPaths(classifiedChangedFiles, "frontend_app", 2);
    const backendPaths = getRepresentativeCategoryPaths(classifiedChangedFiles, "backend", 2);
    const boundaryLabel = [
      frontendPaths.length > 0 ? `frontend surface (${frontendPaths.join(", ")})` : "frontend surface",
      backendPaths.length > 0 ? `backend/API surface (${backendPaths.join(", ")})` : "backend/API surface"
    ].join(" and ");
    const privatePaths = getPrivateOrGatedPaths([...frontendPaths, ...backendPaths, ...repoData.changedFiles]);
    const privateSentence = privatePaths.length > 0
      ? ` Some changed paths look private or gated (${selectRepresentativePaths(privatePaths).join(", ")}), so compare what the public UI exposes with what the protected path enforces.`
      : "";
    const depthSentence = depthProfile.includeBoundaryContext
      ? " Follow the request, state transition, or validation rule from UI trigger to trusted backend handling, then back to the visible result."
      : " Read those files as one flow, not as isolated edits.";

    return `The code shape crosses a concrete system boundary between ${boundaryLabel}.${privateSentence}${depthSentence}`;
  }

  if (hasBackground) {
    return "The code shape spans visible app flow and background behavior. That makes route ownership and state consistency more important than a page-only review.";
  }

  if (hasConfig) {
    return "Part of the change lives in configuration or setup layers. Review environment and build assumptions alongside the feature code.";
  }

  if (themes.includes("implementation_logic")) {
    return "The code shape is a focused implementation change with less explicit product framing than a named frontend, backend, or docs change. Start with the changed code path, then use callers or tests to identify the behavior it supports.";
  }

  const evidencePaths = changedPaths.length > 0 ? changedPaths : diffPaths;
  return `The code shape is not strongly categorized by the current heuristics. The clearest evidence is concentrated in ${describeRepresentativePaths(evidencePaths)}, so the safest reading is to start from those files and avoid naming a broader architecture pattern until callers, tests, or runtime entry points confirm it.`;
}

function buildReadingOrder(classifiedChangedFiles, repoData, intentSignals, depthProfile) {
  const files = classifiedChangedFiles.files || [];
  const entryFiles = repoData.evidence?.frontendEntryFiles || [];
  const readmePath = repoData.evidence?.readme?.path;
  const preferredSourcePaths = new Set(
    selectRepresentativePaths(
      files
        .filter((file) => isImplementationLikeFile(file))
        .map((file) => file.path)
    )
  );
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
    } else if (lower === "index.html" || lower.endsWith("/index.html")) {
      priority = 99;
      reason = "Entry document. Best first file for seeing where the changed experience becomes visible.";
    } else if (lower.endsWith(".html")) {
      priority = 95;
      reason = "Alternate document surface. Read this to compare secondary page or route behavior against the main entry.";
    } else if (entryFiles.includes(file.path) || lower.includes("app.") || lower.includes("/app.")) {
      priority = 98;
      reason = "Entry coordinator. Read this to trace how the visible experience is wired in code.";
    } else if (preferredSourcePaths.has(file.path) && (lower.includes("app.") || lower.includes("/app."))) {
      priority = 96;
      reason = "Main orchestration file. Useful for tracing how the feature state or flow gets coordinated after entry.";
    } else if (preferredSourcePaths.has(file.path) && (lower.includes("private") || lower.includes("kept"))) {
      priority = 94;
      reason = "Alternate or gated-flow file. Read this to see where behavior diverges from the default path.";
    } else if (preferredSourcePaths.has(file.path)) {
      priority = 97;
      reason = "Representative source file from the selected range. A strong starting point for understanding the main implementation path.";
    } else if (readmePath && file.path === readmePath) {
      priority = depthProfile.includeReadingOrderStrategy ? 88 : 78;
      reason = depthProfile.includeReadingOrderStrategy
        ? "Project framing file. Read this first if you want product intent before implementation detail."
        : "Project framing file. Useful for understanding what the change is trying to support before reading implementation details.";
    } else if (wantsThemeContext && lower.includes("theme")) {
      priority = 93;
      reason = "Theme or control file. Read this to see how UI state is represented and applied.";
    } else if (lower.includes("app.") || lower.includes("/app.")) {
      priority = 92;
      reason = "Likely orchestration file. Read this to see how the changed behavior is wired together.";
    } else if (file.category === "frontend_app") {
      priority = 85;
      reason = "Behavior file. Read this for feature logic and user flow.";
    } else if (isGenericSourceCodePath(file.path)) {
      priority = 83;
      reason = "Implementation file. Read this for the main code path before assigning a broader product meaning.";
    } else if (file.category === "backend") {
      priority = 84;
      reason = "Backend file. Read this for enforcement logic, data handling, or cross-layer assumptions.";
    } else if (file.category === "notifications_background") {
      priority = 80;
      reason = "Background logic file. Read this for route, notification, or off-page behavior.";
    } else if (file.category === "styling") {
      priority = 70;
      reason = "Presentation file. Best read after you understand the behavior or structure it supports.";
    } else if (file.category === "config_build") {
      priority = 65;
      reason = "Configuration file. Read this for environment or build assumptions.";
    } else if (file.category === "docs") {
      priority = 60;
      reason = "Documentation file. Read this for context after identifying the runtime surface.";
    }

    return {
      path: file.path,
      category: file.category,
      priority,
      reason: depthProfile.includeReadingOrderStrategy && !isGeneratedOrDerivedPath(file.path)
        ? buildReadingStageReason(file, reason, {
            entryFiles,
            preferredSourcePaths,
            readmePath,
            wantsThemeContext
          })
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
    connections.push("Frontend files depend on backend rules or responses, so check the visible flow against server-side enforcement.");
  }

  if (themes.includes("notifications_background")) {
    connections.push("Some of the user-visible experience may now depend on background logic, which means behavior can diverge if page flow and service-worker assumptions stop matching.");
  }

  if (themes.includes("configuration_build") && packageScripts.length > 0) {
    connections.push(`Configuration or build files may influence how the feature behaves across environments, and package scripts such as ${packageScripts.slice(0, 4).join(", ")} help define that wiring.`);
  }

  const changedAreas = summarizeChangedSurface(classifiedChangedFiles);
  if (connections.length === 0 && changedAreas.length > 1) {
    connections.push(`The changed categories span ${changedAreas.join(", ")}. That is evidence of a cross-surface change, but the exact relationship should be confirmed by tracing the changed files rather than assuming one unified feature.`);
  }

  if (intentSignals.length > 1) {
    connections.push(`Within that broader change, the strongest sub-themes are ${intentSignals.map((signal) => signal.label).join(", ")}, pointing to a feature plus follow-up refinement rather than a single isolated edit.`);
  }

  if (depthProfile.includeBoundaryContext && themes.includes("frontend_behavior") && themes.includes("visual_design")) {
    connections.push("A practical way to read the range is to start with the file that introduces or wires the UI state, then move to the files that propagate that state across the interface, and only then read the stylesheet that makes the state visible.");
  }

  if (connections.length === 0) {
    const changedPathSummary = describeRepresentativePaths(repoData.changedFiles);
    connections.push(`No strong cross-file relationship is directly observable from the current categories. Start with ${changedPathSummary} and confirm whether the change is isolated or connected through callers, imports, or documented workflow.`);
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
    return "This is a boundary-crossing implementation pattern. Understand the flow before reviewing individual lines.";
  }

  if (themes.includes("configuration_build")) {
    return "The observed theme is configuration or build wiring, so the trend evidence points to environment and tooling assumptions becoming part of behavior. The risk is not the configuration itself; it is unclear ownership when those assumptions are not documented or verified.";
  }

  if (themes.includes("implementation_logic")) {
    return "This looks like a focused implementation adjustment with ambiguous product intent. The important pattern is not the file type itself, but whether the changed logic has clear callers, tests, and behavioral ownership.";
  }

  if (hasBoundaryRisk) {
    return "The current range carries a boundary-complexity pattern: bugs are more likely to come from mismatched layer assumptions than isolated syntax mistakes.";
  }

  return "No broad architectural trend is directly supported by the current evidence. Treat this as a localized change unless caller tracing, repeated file patterns, or risk signals show that the same concern is spreading.";
}

function buildFeatureSpecificVerification(
  themes,
  intentSignals,
  readingOrder,
  changedFiles = []
) {
  const checks = [];
  const topPath = readingOrder[0]?.path;
  const alternateHtml = changedFiles.find((filePath) => {
    const lower = filePath.toLowerCase();
    return lower.endsWith(".html") && lower !== "index.html" && !lower.endsWith("/index.html");
  });
  const hasThemeSignal = intentSignals.some((signal) => signal.id === "dark_mode");
  const hasControlSignal = intentSignals.some((signal) => signal.id === "toggle_or_control");
  const hasResponsiveSignal = intentSignals.some((signal) => signal.id === "responsive_ui");
  const hasPrivateSignal = intentSignals.some((signal) => signal.id === "private_flow");

  checks.push("Run the changed user flow end to end in the browser.");

  if (topPath) {
    checks.push(`Start with ${topPath} and confirm the visible entry experience matches the intended feature story.`);
  }

  if (hasThemeSignal) {
    checks.push("Toggle the theme-related control and confirm the state change is applied consistently across the main UI surfaces.");
  }

  if (hasControlSignal) {
    checks.push("Use the changed control in the browser and confirm the visible state, labels, and follow-up action match the intended flow.");
  }

  if (hasResponsiveSignal) {
    checks.push("Check the updated screens at narrow and wide viewport sizes to confirm the responsive polish holds up under real layout pressure.");
  }

  if (hasPrivateSignal || alternateHtml) {
    checks.push(
      alternateHtml
        ? `Compare the default page and ${alternateHtml} to make sure alternate or gated flows still express the feature coherently.`
        : "Compare the default and alternate/gated flows to make sure the feature behaves consistently where it is supposed to."
    );
  }

  if (themes.includes("frontend_behavior") && themes.includes("visual_design")) {
    checks.push("Confirm the behavior and visual layer still feel aligned, especially around state changes, layout shifts, and affordances.");
  }

  if (themes.includes("backend_logic") && themes.includes("frontend_behavior")) {
    checks.push("Trace one important request end to end and confirm the UI promise still matches backend enforcement.");
  }

  if (themes.includes("notifications_background")) {
    checks.push("Verify any background or notification-triggered paths still land in the correct route and state.");
  }

  if (themes.includes("configuration_build")) {
    checks.push("Check whether the feature still behaves correctly under the intended build or environment configuration.");
  }

  if (themes.includes("implementation_logic")) {
    checks.push("Inspect the changed implementation path and identify which callers or workflows depend on it.");
    checks.push("Run or add a focused test around the behavior most likely to be affected by the changed logic.");
  }

  return checks;
}

function buildRiskSpecificVerification(riskSignals = []) {
  const preferredSignals = [
    "frontend_backend_both_touched",
    "hardcoded_absolute_urls",
    "service_worker_present",
    "private_build_split",
    "tracked_generated_output",
    "tracked_local_artifacts",
    "tracked_env_files",
    "missing_gitignore"
  ];

  const orderedSignals = [...riskSignals].sort((a, b) => {
    const aIndex = preferredSignals.indexOf(a.id);
    const bIndex = preferredSignals.indexOf(b.id);
    const normalizedA = aIndex === -1 ? preferredSignals.length : aIndex;
    const normalizedB = bIndex === -1 ? preferredSignals.length : bIndex;

    if (normalizedA !== normalizedB) {
      return normalizedA - normalizedB;
    }

    return 0;
  });

  return uniq(
    orderedSignals
      .flatMap((signal) => signal.whatToVerify || [])
      .slice(0, 4)
  );
}

function buildWhatToVerify(
  themes,
  intentSignals = [],
  riskSignals = [],
  readingOrder = [],
  changedFiles = []
) {
  const featureChecks = buildFeatureSpecificVerification(
    themes,
    intentSignals,
    readingOrder,
    changedFiles
  );
  const riskChecks = buildRiskSpecificVerification(riskSignals);
  const checks = uniq([...featureChecks, ...riskChecks]);

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

  return checks.slice(0, 8);
}

function buildCarryForwardLesson(themes, riskSignals = [], intentSignals = [], changedFiles = []) {
  const hasRepoHygiene = riskSignals.some(
    (signal) =>
      signal.category === "repo_hygiene" ||
      signal.category === "security_hygiene"
  );
  const hasThemeSignal = intentSignals.some(
    (signal) => signal.id === "dark_mode" || signal.id === "toggle_or_control"
  );
  const hasResponsiveSignal = intentSignals.some((signal) => signal.id === "responsive_ui");
  const hasPrivateSignal = intentSignals.some((signal) => signal.id === "private_flow");
  const alternateHtml = changedFiles.find((filePath) => {
    const lower = filePath.toLowerCase();
    return lower.endsWith(".html") && lower !== "index.html" && !lower.endsWith("/index.html");
  });

  if (hasThemeSignal && hasResponsiveSignal) {
    return "A cross-cutting UI feature is easier to trust when you review it in layers: first the visible entry points, then the state or control logic behind it, and finally the responsive and visual polish that makes the feature feel coherent.";
  }

  if (hasThemeSignal) {
    return "Theme-oriented features rarely live in one place. The reusable lesson is to review both how the UI state is toggled and how that state is expressed across the interface, because visual consistency problems often come from the gap between those two layers.";
  }

  if (hasPrivateSignal || alternateHtml) {
    return alternateHtml
      ? `When a feature spans both the default page and an alternate surface like ${alternateHtml}, the most useful habit is to compare them deliberately instead of assuming the secondary path stayed in sync.`
      : "When a feature spans both the default and a gated path, the most useful habit is to compare those flows directly instead of assuming the alternate path stayed in sync.";
  }

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

  if (themes.includes("implementation_logic")) {
    return "When a change does not carry an obvious product label, the most useful habit is to trace callers and tests before naming intent too confidently.";
  }

  return "When the evidence does not support a confident product-level interpretation, the reusable lesson is to keep the explanation bounded: name the changed files, state what is inferred, and verify the behavior before generalizing.";
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
      themes,
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
    whatToVerify: buildWhatToVerify(
      themes,
      intentSignals,
      riskSignals,
      readingOrder,
      repoData.changedFiles
    ),
    carryForwardLesson: buildCarryForwardLesson(
      themes,
      riskSignals,
      intentSignals,
      repoData.changedFiles
    ),
    confidence: buildConfidence(repoData, themes)
  };
}
