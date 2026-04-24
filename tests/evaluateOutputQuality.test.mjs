import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { evaluateOutputQuality } from "../src/evaluate/evaluateOutputQuality.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

function loadFixtureOutput(filePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, filePath), "utf8"));
}

test("passes a saved paired-session output that satisfies the explanation contract", () => {
  const output = loadFixtureOutput("examples/latest-output.json");
  const evaluation = evaluateOutputQuality(output);

  assert.equal(evaluation.status, "pass");
  assert.equal(evaluation.totals.fail, 0);
});

test("fails a change interpretation that is structurally present but explanation-weak", () => {
  const evaluation = evaluateOutputQuality({
    mode: "change_interpretation",
    repoPath: "/tmp/example",
    commitRange: "abc..def",
    explanationDepth: "level_1",
    overview: "Changed some files.",
    whyItMatters: "This matters because even a small set of files can reveal the direction of the feature.",
    codeShape: "The changed files appear to support one focused change.",
    keyThemes: [],
    readingOrder: [],
    howPiecesConnect: [],
    patternTrend: "A good review should help you understand the structure.",
    riskSignals: [
      {
        id: "vague_risk",
        severity: "medium",
        category: "boundary_complexity",
        title: "Something may be risky",
        whyItMatters: "It might break.",
        evidence: [],
        whatToVerify: [],
        mitigation: "Look into it."
      }
    ],
    whatToVerify: ["Make sure it works."],
    carryForwardLesson: "A good review should help you understand what changed.",
    confidence: {
      level: "medium",
      reasoning: "This is correct."
    }
  });

  assert.equal(evaluation.status, "fail");
  assert.ok(
    evaluation.checks.some((check) => check.id === "change_interpretation.themes" && check.status === "fail")
  );
  assert.ok(
    evaluation.checks.some((check) => check.id === "change_interpretation.risk_signal_support" && check.status === "fail")
  );
  assert.ok(
    evaluation.checks.some((check) => check.id === "change_interpretation.confidence_boundaries" && check.status === "fail")
  );
});

test("fails unsupported output modes", () => {
  const evaluation = evaluateOutputQuality({
    mode: "repo_chat",
    answer: "Hello"
  });

  assert.equal(evaluation.status, "fail");
  assert.equal(evaluation.checks[0].id, "output.mode");
});
