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

export function detectRiskSignals(repoData, classifiedChangedFiles, classifiedTrackedFiles) {
  const signals = [];

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

  const localArtifacts = findFilesByCategory(classifiedTrackedFiles, "local_artifact");
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

  const generatedOutput = findFilesByCategory(classifiedTrackedFiles, "generated_output");
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

  const envLikeFiles = findEnvLikeTrackedFiles(repoData.trackedFiles);
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

  const serviceWorkerFiles = findFilesByCategory(classifiedTrackedFiles, "notifications_background");
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

  const privateBuildIndicators = repoData.trackedFiles.filter((file) => {
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