function hasCategory(classified, category) {
  return classified.files?.some((file) => file.category === category);
}

function findFilesByCategory(classified, category) {
  return classified.files
    ?.filter((file) => file.category === category)
    .map((file) => file.path) || [];
}

function findEnvLikeTrackedFiles(trackedFiles = []) {
  return trackedFiles.filter((file) => {
    const lower = file.toLowerCase();
    return (
      lower === ".env" ||
      lower.startsWith(".env.") ||
      lower.includes("/.env") ||
      lower.endsWith(".env")
    );
  });
}

function findHardcodedUrls(text = "") {
  const matches = text.match(/https?:\/\/[^\s"'`<>]+/g) || [];
  return [...new Set(matches)];
}

function normalizePath(filePath = "") {
  return filePath.replaceAll("\\", "/").toLowerCase();
}

function getChangedPathsByCategory(classifiedChangedFiles, category) {
  return classifiedChangedFiles.files
    ?.filter((file) => file.category === category)
    .map((file) => file.path) || [];
}

function getAddedDiffLines(diffText = "") {
  return diffText
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1).trim())
    .filter(Boolean);
}

function getAddedDiffLinesByPath(diffSnippets = []) {
  return diffSnippets.map((item) => ({
    path: item.path,
    lines: getAddedDiffLines(item.excerpt)
  }));
}

function extractStringLiterals(text = "") {
  const matches = text.match(/["'`]([^"'`]{4,80})["'`]/g) || [];
  return matches
    .map((match) => match.slice(1, -1).trim())
    .filter((value) => {
      const normalized = value.toLowerCase();
      return (
        normalized.length >= 4 &&
        !normalized.startsWith("http") &&
        !["true", "false", "null", "undefined", "button", "submit"].includes(normalized)
      );
    });
}

function findDuplicatedAddedLiterals(diffSnippets = []) {
  const literalLocations = new Map();

  for (const item of diffSnippets) {
    const addedText = getAddedDiffLines(item.excerpt).join("\n");

    for (const literal of extractStringLiterals(addedText)) {
      const normalized = literal.toLowerCase();
      const locations = literalLocations.get(normalized) || {
        literal,
        paths: new Set()
      };
      locations.paths.add(item.path);
      literalLocations.set(normalized, locations);
    }
  }

  return [...literalLocations.values()]
    .filter((entry) => entry.paths.size > 1)
    .map((entry) => ({
      literal: entry.literal,
      paths: [...entry.paths]
    }));
}

function findFrontendOnlyEnforcementEvidence(diffSnippets = [], classifiedChangedFiles) {
  const changedFrontendPaths = new Set(
    getChangedPathsByCategory(classifiedChangedFiles, "frontend_app")
  );
  const enforcementPattern = /\b(required|disabled|validate|validation|role|admin|auth|token|private|permission|allowed|limit|quota|guard|protect|deny|forbid)\b|localstorage|sessionstorage|data-requires-|aria-disabled|pattern=/i;

  return getAddedDiffLinesByPath(diffSnippets)
    .filter((item) => changedFrontendPaths.has(item.path))
    .flatMap((item) =>
      item.lines
        .filter((line) => enforcementPattern.test(line))
        .map((line) => `${item.path}: ${line}`)
    )
    .slice(0, 8);
}

function findEnvironmentConfigEvidence(diffSnippets = [], classifiedChangedFiles) {
  const changedConfigPaths = new Set(
    getChangedPathsByCategory(classifiedChangedFiles, "config_build")
  );
  const envPattern = /\b(process\.env|import\.meta\.env|node_env|mode|env|vite_|api_url|base_url|supabase|vercel|production|preview|staging)\b/i;

  return getAddedDiffLinesByPath(diffSnippets)
    .filter((item) => changedConfigPaths.has(item.path))
    .flatMap((item) =>
      item.lines
        .filter((line) => envPattern.test(line))
        .map((line) => `${item.path}: ${line}`)
    )
    .slice(0, 8);
}

function hasSourceAndGeneratedChanged(classifiedChangedFiles) {
  const changedGenerated = getChangedPathsByCategory(
    classifiedChangedFiles,
    "generated_output"
  );
  const changedSource = classifiedChangedFiles.files
    ?.filter((file) => {
      const normalized = normalizePath(file.path);
      return (
        file.category !== "generated_output" &&
        file.category !== "local_artifact" &&
        !normalized.startsWith("dist/") &&
        !normalized.startsWith("build/")
      );
    })
    .map((file) => file.path) || [];

  return {
    changedGenerated,
    changedSource
  };
}

export function detectRiskSignals(repoData, classifiedChangedFiles, classifiedTrackedFiles) {
  const signals = [];
  const evidence = repoData.evidence || {};

  if (!repoData.gitignore?.exists) {
    signals.push({
      id: "missing_gitignore",
      severity: "high",
      category: "security_hygiene",
      title: "Repository is missing a .gitignore file",
      whyItMatters:
        "Without a .gitignore, local artifacts, generated files, and sensitive environment files are more likely to be committed by accident.",
      evidence: [".gitignore was not found in the repository root."],
      whatToVerify: [
        "Create a .gitignore aligned with the real workflow.",
        "Check whether local or sensitive files were already committed earlier."
      ],
      mitigation:
        "Add a .gitignore immediately and review Git history for anything that should not have been tracked."
    });
  }

  const localArtifacts = evidence.localArtifactFiles?.length
    ? evidence.localArtifactFiles
    : findFilesByCategory(classifiedTrackedFiles, "local_artifact");
  if (localArtifacts.length > 0) {
    signals.push({
      id: "tracked_local_artifacts",
      severity: "medium",
      category: "repo_hygiene",
      title: "Local artifact files are tracked in Git",
      whyItMatters:
        "OS-generated junk files usually do not belong in version control and are a common sign of loose repo hygiene.",
      evidence: localArtifacts,
      whatToVerify: [
        "Confirm whether these files are currently tracked in Git.",
        "Scan for other local-only artifacts that may have slipped in."
      ],
      mitigation:
        "Remove tracked OS junk files and keep them excluded in .gitignore."
    });
  }

  const generatedOutput = evidence.generatedOutputFiles?.length
    ? evidence.generatedOutputFiles
    : findFilesByCategory(classifiedTrackedFiles, "generated_output");
  if (generatedOutput.length > 0) {
    signals.push({
      id: "tracked_generated_output",
      severity: "medium",
      category: "repo_hygiene",
      title: "Generated build output appears to be tracked",
      whyItMatters:
        "Tracking generated output can blur the source of truth and make debugging and deployment harder to reason about.",
      evidence: generatedOutput.slice(0, 10),
      whatToVerify: [
        "Confirm whether build output should be version-controlled for this project.",
        "Check whether deployment is meant to build from source or reuse tracked output."
      ],
      mitigation:
        "If source files are the intended source of truth, remove generated output from version control and rely on build pipelines instead."
    });
  }

  const changedOutputShape = hasSourceAndGeneratedChanged(classifiedChangedFiles);
  if (
    changedOutputShape.changedGenerated.length > 0 &&
    changedOutputShape.changedSource.length > 0
  ) {
    signals.push({
      id: "generated_output_changed_with_source",
      severity: "medium",
      category: "workflow_complexity",
      title: "Generated output changed in the same range as source files",
      whyItMatters:
        "When source and generated files move together, reviewers can lose track of which files are meant to be edited and which are derived from the build.",
      evidence: [
        `Source changes: ${changedOutputShape.changedSource.slice(0, 5).join(", ")}`,
        `Generated output changes: ${changedOutputShape.changedGenerated.slice(0, 5).join(", ")}`
      ],
      whatToVerify: [
        "Confirm which changed files are the editable source of truth.",
        "Check whether generated output should be regenerated rather than manually edited."
      ],
      mitigation:
        "Document or enforce whether generated output belongs in version control for this workflow."
    });
  }

  const envLikeFiles = evidence.envLikeTrackedFiles?.length
    ? evidence.envLikeTrackedFiles
    : findEnvLikeTrackedFiles(repoData.trackedFiles);
  if (envLikeFiles.length > 0) {
    signals.push({
      id: "tracked_env_files",
      severity: "high",
      category: "security_hygiene",
      title: "Environment-like files are tracked in Git",
      whyItMatters:
        "Tracked environment files may contain secrets or environment-specific values that should not be committed.",
      evidence: envLikeFiles,
      whatToVerify: [
        "Inspect whether these files contain sensitive values.",
        "Check whether any exposed values need to be rotated."
      ],
      mitigation:
        "Move sensitive values out of tracked files, update .gitignore, and rotate secrets if exposure already occurred."
    });
  }

  const hardcodedUrls = findHardcodedUrls(repoData.rawDiff);
  if (hardcodedUrls.length > 0) {
    signals.push({
      id: "hardcoded_absolute_urls",
      severity: "medium",
      category: "config_drift",
      title: "Hardcoded absolute URLs were found in the selected change range",
      whyItMatters:
        "Hardcoded URLs can become brittle when environments, domains, or deployment paths change.",
      evidence: hardcodedUrls.slice(0, 10),
      whatToVerify: [
        "Confirm whether these URLs are intended to be fixed in every environment.",
        "Check whether any should come from configuration instead."
      ],
      mitigation:
        "Centralize environment-sensitive URLs when practical, or clearly document which layer owns them."
    });
  }

  const envConfigEvidence = findEnvironmentConfigEvidence(
    evidence.changedDiffSnippets || [],
    classifiedChangedFiles
  );
  if (envConfigEvidence.length > 0) {
    signals.push({
      id: "environment_config_changed",
      severity: "medium",
      category: "config_drift",
      title: "Environment-sensitive configuration changed",
      whyItMatters:
        "Configuration tied to modes, environment variables, or deployment targets can behave differently across local, preview, and production environments.",
      evidence: envConfigEvidence,
      whatToVerify: [
        "Confirm the intended behavior for local, preview, and production environments.",
        "Check whether environment-specific values are documented outside the code path."
      ],
      mitigation:
        "Keep environment ownership explicit through documented variables, scripts, or deployment settings."
    });
  }

  const serviceWorkerFiles = evidence.serviceWorkerFiles?.length
    ? evidence.serviceWorkerFiles
    : findFilesByCategory(classifiedTrackedFiles, "notifications_background");
  if (serviceWorkerFiles.length > 0) {
    signals.push({
      id: "service_worker_present",
      severity: "low",
      category: "boundary_complexity",
      title: "Service worker or background notification logic is present",
      whyItMatters:
        "Service workers add an extra execution layer and can introduce routing, cache, and environment-consistency issues that are easy to miss.",
      evidence: serviceWorkerFiles,
      whatToVerify: [
        "Check whether notification and routing behavior matches the intended deployment target.",
        "Confirm service worker logic stays aligned with current app flow."
      ],
      mitigation:
        "Review service worker assumptions whenever routes, domains, or notification behavior change."
    });
  }

  const changedFrontend = hasCategory(classifiedChangedFiles, "frontend_app");
  const changedBackend = hasCategory(classifiedChangedFiles, "backend");
  const changedDatabase = hasCategory(classifiedChangedFiles, "database");
  if (changedFrontend && changedBackend) {
    signals.push({
      id: "frontend_backend_both_touched",
      severity: "medium",
      category: "boundary_complexity",
      title: "This change range touches both frontend and backend layers",
      whyItMatters:
        "When both layers change together, mismatched assumptions become more likely. UI state, validation, and backend enforcement can drift apart.",
      evidence: [
        "Changed files include both frontend_app and backend categories."
      ],
      whatToVerify: [
        "Confirm frontend behavior matches backend truth.",
        "Check whether validation or auth assumptions are enforced in both places where needed."
      ],
      mitigation:
        "Test the flow end to end, not just file by file."
    });
  }

  const duplicatedAddedLiterals = findDuplicatedAddedLiterals(
    evidence.changedDiffSnippets || []
  );
  const crossLayerDuplicatedLiterals = duplicatedAddedLiterals.filter((entry) => {
    const categories = new Set(
      entry.paths
        .map((filePath) =>
          classifiedChangedFiles.files?.find((file) => file.path === filePath)?.category
        )
        .filter(Boolean)
    );

    return categories.size > 1;
  });

  if (crossLayerDuplicatedLiterals.length > 0) {
    signals.push({
      id: "duplicated_cross_layer_assumptions",
      severity: "medium",
      category: "boundary_complexity",
      title: "Repeated literals suggest duplicated assumptions across layers",
      whyItMatters:
        "When the same status, role, route, or validation value is repeated in multiple layers, one copy can drift while the other still looks correct.",
      evidence: crossLayerDuplicatedLiterals
        .slice(0, 5)
        .map((entry) => `"${entry.literal}" appears in ${entry.paths.join(", ")}`),
      whatToVerify: [
        "Confirm whether the repeated value has a single source of truth.",
        "Check whether frontend messaging and backend enforcement can drift independently."
      ],
      mitigation:
        "Centralize shared constants when practical, or document which layer owns the value."
    });
  }

  const frontendOnlyEnforcementEvidence = findFrontendOnlyEnforcementEvidence(
    evidence.changedDiffSnippets || [],
    classifiedChangedFiles
  );
  if (
    changedFrontend &&
    !changedBackend &&
    !changedDatabase &&
    frontendOnlyEnforcementEvidence.length > 0
  ) {
    signals.push({
      id: "frontend_only_enforcement",
      severity: "medium",
      category: "boundary_complexity",
      title: "Enforcement-like behavior changed only in the frontend",
      whyItMatters:
        "Client-side guards, required fields, or permission checks can improve UX, but they do not enforce the rule unless a trusted backend or data layer also owns it.",
      evidence: frontendOnlyEnforcementEvidence,
      whatToVerify: [
        "Confirm whether the same rule is enforced outside the frontend.",
        "Check whether bypassing the UI still preserves the intended constraint."
      ],
      mitigation:
        "Keep frontend checks as UX support and place authoritative enforcement in a trusted layer when the rule matters."
    });
  }

  const privateBuildIndicators = evidence.privateBuildIndicators?.length
    ? evidence.privateBuildIndicators
    : repoData.trackedFiles.filter((file) => {
        const lower = file.toLowerCase();
        return (
          lower.includes("private") ||
          lower.includes(".vercel") ||
          lower === "vercel.json"
        );
      });

  if (privateBuildIndicators.length > 0) {
    signals.push({
      id: "private_build_split",
      severity: "low",
      category: "workflow_complexity",
      title: "Private or deployment-specific build paths are present",
      whyItMatters:
        "Once multiple build paths exist, behavior can drift between environments unless ownership is kept clear.",
      evidence: privateBuildIndicators.slice(0, 10),
      whatToVerify: [
        "Confirm which behavior belongs to public builds versus private builds.",
        "Check for duplicated logic that may diverge over time."
      ],
      mitigation:
        "Document which files and scripts own environment-specific behavior."
    });
  }

  return signals;
}
