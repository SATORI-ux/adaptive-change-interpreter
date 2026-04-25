import { collectRepoData } from "../git/collectRepoData.mjs";
import { classifyFiles } from "./classifyFiles.mjs";
import { detectRiskSignals } from "./detectRiskSignals.mjs";
import { buildChangeInterpretation } from "./buildChangeInterpretation.mjs";
import { buildProjectHealthReview } from "./buildProjectHealthReview.mjs";
import { buildFeatureTimeline } from "./buildFeatureTimeline.mjs";
import { validateOptions } from "../cli/validateOptions.mjs";

export function runAnalysis(options = {}) {
  validateOptions(options);

  if (options.mode === "feature_timeline") {
    return buildFeatureTimeline(options);
  }

  const repoData = collectRepoData(options);
  const classifiedChangedFiles = classifyFiles(repoData.changedFiles);
  const classifiedTrackedFiles = classifyFiles(repoData.trackedFiles);
  const riskSignals = detectRiskSignals(
    repoData,
    classifiedChangedFiles,
    classifiedTrackedFiles
  );

  const changeInterpretation = buildChangeInterpretation(
    repoData,
    classifiedChangedFiles,
    riskSignals,
    {
      explanationDepth: options.depth
    }
  );

  const projectRepoData = options.mode === "paired_session"
    ? collectRepoData({
        ...options,
        mode: "project_health_review",
        from: undefined,
        to: undefined
      })
    : repoData;
  const projectClassifiedTrackedFiles = options.mode === "paired_session"
    ? classifyFiles(projectRepoData.trackedFiles)
    : classifiedTrackedFiles;
  const projectRiskSignals = options.mode === "paired_session"
    ? detectRiskSignals(projectRepoData, classifyFiles([]), projectClassifiedTrackedFiles)
    : riskSignals;

  const projectHealthReview = buildProjectHealthReview(
    projectRepoData,
    projectClassifiedTrackedFiles,
    projectRiskSignals
  );

  if (options.mode === "change_interpretation") {
    return changeInterpretation;
  }

  if (options.mode === "project_health_review") {
    return projectHealthReview;
  }

  return {
    mode: "paired_session",
    repoPath: repoData.repoPath,
    commitRange: repoData.commitRange,
    changeInterpretation,
    projectHealthReview
  };
}
