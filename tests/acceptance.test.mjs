import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "..");
const fixturesPath = path.join(
  repoRoot,
  "tests",
  "fixtures",
  "acceptance-cases.json"
);
const schemaValidatorPath = path.join(repoRoot, "src", "validateSchema.mjs");
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf8"));

function runNode(args) {
  return execFileSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function writeTempJson(prefix, contents) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  const filePath = path.join(tempDir, "output.json");
  fs.writeFileSync(filePath, contents);
  return filePath;
}

function validateAgainstSchema(jsonPath) {
  const result = runNode([schemaValidatorPath, jsonPath]);
  assert.match(result, /Validation passed\./);
}

function normalizeText(value = "") {
  return String(value).toLowerCase();
}

function assertNonEmptyString(value, message) {
  assert.equal(typeof value, "string", message);
  assert.ok(value.trim().length > 0, message);
}

function assertIncludesAny(text, patterns, message) {
  const normalized = normalizeText(text);
  assert.ok(
    patterns.some((pattern) => normalized.includes(pattern)),
    `${message}\nReceived: ${text}`
  );
}

function assertConcreteVerificationSteps(steps, label) {
  assert.ok(Array.isArray(steps), `${label} should be an array.`);
  assert.ok(steps.length > 0, `${label} should contain at least one step.`);

  for (const step of steps) {
    assertNonEmptyString(step, `${label} entries must be non-empty strings.`);
    assertIncludesAny(
      step,
      [
        "check",
        "confirm",
        "verify",
        "review",
        "trace",
        "run",
        "compare",
        "inspect",
        "list",
        "pick",
        "test",
        "remove",
        "document",
        "write",
        "keep",
        "add",
        "resolve",
        "reduce",
        "scan",
        "look for",
        "tighten"
      ],
      `${label} should contain action-oriented verification guidance.`
    );
  }
}

function assertRiskSignals(riskSignals, label) {
  assert.ok(Array.isArray(riskSignals), `${label} should be an array.`);

  for (const signal of riskSignals) {
    assertNonEmptyString(signal.title, `${label} title should be present.`);
    assertNonEmptyString(
      signal.whyItMatters,
      `${label} should explain why the risk matters.`
    );
    assert.ok(
      Array.isArray(signal.evidence) && signal.evidence.length > 0,
      `${label} should include supporting evidence.`
    );
    assert.ok(
      Array.isArray(signal.whatToVerify) && signal.whatToVerify.length > 0,
      `${label} should include verification guidance.`
    );
  }
}

function assertConfidenceShowsBoundaries(confidence, label) {
  assert.ok(confidence && typeof confidence === "object", `${label} is required.`);
  assertNonEmptyString(confidence.reasoning, `${label} reasoning should be present.`);
  assertIncludesAny(
    confidence.reasoning,
    [
      "inferred",
      "inference",
      "uncertain",
      "heuristic",
      "grounded",
      "direct signals",
      "visible repo evidence",
      "require more",
      "not prove"
    ],
    `${label} should separate observed evidence from uncertainty or limits.`
  );
}

function assertChangeInterpretationContract(changeInterpretation, label) {
  assert.equal(changeInterpretation.mode, "change_interpretation");
  assertNonEmptyString(
    changeInterpretation.overview,
    `${label} should describe the main behavior change.`
  );
  assertIncludesAny(
    changeInterpretation.overview,
    ["change", "touches", "affects", "behavior", "flow", "range"],
    `${label} overview should identify the main changed behavior or surface.`
  );

  assertNonEmptyString(
    changeInterpretation.whyItMatters,
    `${label} should explain why the change matters.`
  );
  assertIncludesAny(
    changeInterpretation.whyItMatters,
    ["impact", "matters", "user", "system", "flow", "boundary", "behavior"],
    `${label} should explain behavioral or system impact.`
  );

  assertNonEmptyString(
    changeInterpretation.codeShape,
    `${label} should explain why the code is shaped this way.`
  );
  assertIncludesAny(
    changeInterpretation.codeShape,
    [
      "structure",
      "shape",
      "boundary",
      "layer",
      "coordinat",
      "separat",
      "implemented across"
    ],
    `${label} should discuss code shape or module relationships.`
  );

  assertRiskSignals(
    changeInterpretation.riskSignals,
    `${label} risk signals`
  );
  assertConcreteVerificationSteps(
    changeInterpretation.whatToVerify,
    `${label} verification steps`
  );
  assertConfidenceShowsBoundaries(
    changeInterpretation.confidence,
    `${label} confidence`
  );
}

function assertProjectHealthReviewContract(projectHealthReview, label) {
  assert.equal(projectHealthReview.mode, "project_health_review");
  assertNonEmptyString(
    projectHealthReview.projectOverview,
    `${label} should summarize project behavior and shape.`
  );
  assertIncludesAny(
    projectHealthReview.projectOverview,
    ["project", "repository", "system", "boundary", "surface", "complexity"],
    `${label} project overview should identify the main system shape.`
  );

  assert.ok(
    Array.isArray(projectHealthReview.whatIsWorkingWell) &&
      projectHealthReview.whatIsWorkingWell.length > 0,
    `${label} should identify what is working well.`
  );

  for (const strength of projectHealthReview.whatIsWorkingWell) {
    assertNonEmptyString(strength.title, `${label} strengths need titles.`);
    assertNonEmptyString(
      strength.whyItMatters,
      `${label} strengths should explain why they matter.`
    );
  }

  assert.ok(
    Array.isArray(projectHealthReview.improvementPriorities) &&
      projectHealthReview.improvementPriorities.length > 0,
    `${label} should include prioritized next steps.`
  );

  for (const priority of projectHealthReview.improvementPriorities) {
    assertNonEmptyString(priority.title, `${label} priorities need titles.`);
    assertNonEmptyString(
      priority.whyNow,
      `${label} priorities should explain why they matter now.`
    );
    assertConcreteVerificationSteps(
      priority.actions,
      `${label} priority actions`
    );
  }

  assertConcreteVerificationSteps(
    projectHealthReview.whatToVerifyNext,
    `${label} whatToVerifyNext`
  );
  assertConfidenceShowsBoundaries(
    projectHealthReview.confidence,
    `${label} confidence`
  );
}

function assertProductContract(output, fixture) {
  if (output.mode === "change_interpretation") {
    assertChangeInterpretationContract(output, fixture.id);
    return;
  }

  if (output.mode === "project_health_review") {
    assertProjectHealthReviewContract(output, fixture.id);
    return;
  }

  if (output.mode === "paired_session") {
    assertChangeInterpretationContract(
      output.changeInterpretation,
      `${fixture.id} changeInterpretation`
    );
    assertProjectHealthReviewContract(
      output.projectHealthReview,
      `${fixture.id} projectHealthReview`
    );
    return;
  }

  throw new Error(`Unsupported output mode for product contract: ${output.mode}`);
}

for (const fixture of fixtures) {
  test(fixture.id, () => {
    let jsonPath;
    let parsed;

    if (fixture.type === "cli_output") {
      const stdout = runNode(fixture.args);
      parsed = JSON.parse(stdout);
      assert.equal(parsed.mode, fixture.expectedMode);
      jsonPath = writeTempJson(fixture.id, JSON.stringify(parsed, null, 2));
    } else if (fixture.type === "saved_output") {
      jsonPath = path.join(repoRoot, fixture.path);
      parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      assert.equal(parsed.mode, fixture.expectedMode);
    } else {
      throw new Error(`Unsupported fixture type: ${fixture.type}`);
    }

    validateAgainstSchema(jsonPath);
    assertProductContract(parsed, fixture);
  });
}
