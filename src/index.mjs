import { Command } from "commander";
import { collectRepoData } from "./git/collectRepoData.mjs";
import { classifyFiles } from "./analyze/classifyFiles.mjs";
import { detectRiskSignals } from "./analyze/detectRiskSignals.mjs";
import { buildChangeInterpretation } from "./analyze/buildChangeInterpretation.mjs";
import { buildProjectHealthReview } from "./analyze/buildProjectHealthReview.mjs";

const program = new Command();

program
  .name("adaptive-change-interpreter")
  .description("Analyze a Git repo and explain code changes.")
  .option("--repo <path>", "Path to the Git repository")
  .option("--from <commit>", "Start commit")
  .option("--to <commit>", "End commit")
  .option(
    "--depth <depth>",
    "Explanation depth: level_1 or level_2",
    "level_1"
  )
  .option(
    "--mode <mode>",
    "Analysis mode: change_interpretation, project_health_review, paired_session",
    "change_interpretation"
  );

program.parse();

const options = program.opts();

try {
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

  const projectHealthReview = buildProjectHealthReview(
    repoData,
    classifiedTrackedFiles,
    riskSignals
  );

  let output;

  if (options.mode === "change_interpretation") {
    output = changeInterpretation;
  } else if (options.mode === "project_health_review") {
    output = projectHealthReview;
  } else {
    output = {
      mode: "paired_session",
      repoPath: repoData.repoPath,
      commitRange: repoData.commitRange,
      changeInterpretation,
      projectHealthReview
    };
  }

  console.log(JSON.stringify(output, null, 2));
} catch (error) {
  console.error("Error:");
  console.error(error.message);
  process.exit(1);
}
