import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { renderMarkdown } from "./render/renderMarkdown.mjs";
import { runAnalysis } from "./analyze/runAnalysis.mjs";

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
  )
  .option(
    "--format <format>",
    "Output format: json or markdown",
    "json"
  )
  .option(
    "--output <path>",
    "Write output to a file instead of stdout"
  )
  .option(
    "--max-commits <count>",
    "Maximum recent commits to scan for feature_timeline mode",
    "50"
  )
  .option(
    "--limit <count>",
    "Maximum feature_timeline candidate ranges to return",
    "8"
  );

program.parse();

const options = program.opts();

try {
  const output = runAnalysis(options);

  const renderedOutput = options.format === "json"
    ? `${JSON.stringify(output, null, 2)}\n`
    : renderMarkdown(output);

  if (options.output) {
    const outputPath = path.resolve(options.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, renderedOutput);
  } else {
    process.stdout.write(renderedOutput);
  }
} catch (error) {
  console.error("Error:");
  console.error(error.message);
  process.exit(1);
}
