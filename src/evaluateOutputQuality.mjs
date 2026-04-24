import fs from "node:fs";
import { evaluateOutputQuality } from "./evaluate/evaluateOutputQuality.mjs";

const [, , outputPath] = process.argv;

if (!outputPath) {
  console.error("Usage: node src/evaluateOutputQuality.mjs <output-json-path>");
  process.exit(1);
}

let parsed;

try {
  parsed = JSON.parse(fs.readFileSync(outputPath, "utf8"));
} catch (error) {
  console.error(`Could not read or parse output JSON: ${error.message}`);
  process.exit(1);
}

const evaluation = evaluateOutputQuality(parsed);
console.log(JSON.stringify(evaluation, null, 2));

if (evaluation.status === "fail") {
  process.exit(1);
}
