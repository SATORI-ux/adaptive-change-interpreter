import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { evaluateOutputQuality } from "../src/evaluate/evaluateOutputQuality.mjs";

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

function runGit(repoPath, args) {
  return execFileSync("git", args, {
    cwd: repoPath,
    encoding: "utf8",
  }).trim();
}

function writeTempJson(prefix, contents) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  const filePath = path.join(tempDir, "output.json");
  fs.writeFileSync(filePath, contents);
  return filePath;
}

function writeFixtureFile(repoPath, filePath, contents) {
  const absolutePath = path.join(repoPath, filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function commitFixtureRepo(repoPath, message) {
  runGit(repoPath, ["add", "."]);
  runGit(repoPath, [
    "-c",
    "user.name=Acceptance Fixture",
    "-c",
    "user.email=acceptance-fixture@example.com",
    "commit",
    "-m",
    message,
  ]);

  return runGit(repoPath, ["rev-parse", "HEAD"]);
}

function createLiveCommitRangeFixtureRepo(prefix) {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-repo-`));

  runGit(repoPath, ["init", "--quiet"]);
  runGit(repoPath, ["config", "core.autocrlf", "false"]);

  writeFixtureFile(
    repoPath,
    "README.md",
    [
      "# Tiny Checkout",
      "",
      "A small checkout interface used to verify live commit-range interpretation.",
      "",
    ].join("\n")
  );
  writeFixtureFile(
    repoPath,
    "index.html",
    [
      "<!doctype html>",
      "<html lang=\"en\">",
      "<head>",
      "  <meta charset=\"utf-8\">",
      "  <title>Tiny Checkout</title>",
      "  <link rel=\"stylesheet\" href=\"styles.css\">",
      "</head>",
      "<body>",
      "  <main class=\"checkout\">",
      "    <h1>Checkout</h1>",
      "    <p class=\"status\">Ready to review your order.</p>",
      "    <button type=\"button\">Place order</button>",
      "  </main>",
      "</body>",
      "</html>",
      "",
    ].join("\n")
  );
  writeFixtureFile(
    repoPath,
    "styles.css",
    [
      ".checkout {",
      "  max-width: 32rem;",
      "  margin: 4rem auto;",
      "  font-family: system-ui, sans-serif;",
      "}",
      "",
    ].join("\n")
  );

  const from = commitFixtureRepo(repoPath, "Create checkout surface");

  writeFixtureFile(
    repoPath,
    "index.html",
    [
      "<!doctype html>",
      "<html lang=\"en\">",
      "<head>",
      "  <meta charset=\"utf-8\">",
      "  <title>Tiny Checkout</title>",
      "  <link rel=\"stylesheet\" href=\"styles.css\">",
      "  <script type=\"module\" src=\"js/app.js\"></script>",
      "</head>",
      "<body>",
      "  <main class=\"checkout\" data-state=\"review\">",
      "    <h1>Review checkout</h1>",
      "    <p class=\"status\" data-checkout-status>Confirm stock before placing the order.</p>",
      "    <button type=\"button\" data-confirm-order>Confirm order</button>",
      "  </main>",
      "</body>",
      "</html>",
      "",
    ].join("\n")
  );
  writeFixtureFile(
    repoPath,
    "styles.css",
    [
      ".checkout {",
      "  max-width: 32rem;",
      "  margin: 4rem auto;",
      "  padding: 1.5rem;",
      "  font-family: system-ui, sans-serif;",
      "  border: 1px solid #d8dee9;",
      "}",
      "",
      ".checkout[data-state=\"confirmed\"] {",
      "  border-color: #2f855a;",
      "}",
      "",
    ].join("\n")
  );
  writeFixtureFile(
    repoPath,
    "js/app.js",
    [
      "const checkout = document.querySelector('[data-state]');",
      "const status = document.querySelector('[data-checkout-status]');",
      "const confirmButton = document.querySelector('[data-confirm-order]');",
      "",
      "confirmButton?.addEventListener('click', () => {",
      "  checkout.dataset.state = 'confirmed';",
      "  status.textContent = 'Order confirmed.';",
      "});",
      "",
    ].join("\n")
  );

  const to = commitFixtureRepo(repoPath, "Add checkout confirmation behavior");

  return { repoPath, from, to };
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
        "create",
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

function assertQualityEvaluationPasses(output, fixture) {
  const evaluation = evaluateOutputQuality(output);
  const failedChecks = evaluation.checks
    .filter((check) => check.status === "fail")
    .map((check) => `${check.id}: ${check.title}`);

  assert.equal(
    evaluation.status,
    "pass",
    `${fixture.id} should pass output quality evaluation.\n${failedChecks.join("\n")}`
  );
}

function assertLiveCommitRangeCoverage(output, fixture, repoPath) {
  assert.equal(
    output.repoPath,
    repoPath,
    `${fixture.id} should report the generated live fixture repo.`
  );
  assert.match(
    output.commitRange,
    /^[a-f0-9]{40}\.\.[a-f0-9]{40}$/i,
    `${fixture.id} should analyze a real commit range.`
  );

  const changeInterpretation =
    output.mode === "paired_session" ? output.changeInterpretation : output;
  const changedPaths = changeInterpretation.readingOrder.map((item) => item.path);

  assert.ok(
    changedPaths.includes("index.html"),
    `${fixture.id} should include the changed HTML entry surface.`
  );
  assert.ok(
    changedPaths.includes("styles.css"),
    `${fixture.id} should include the changed presentation layer.`
  );
  assert.ok(
    changedPaths.includes("js/app.js"),
    `${fixture.id} should include the added behavior file.`
  );
  assert.ok(
    changeInterpretation.keyThemes.includes("frontend_behavior"),
    `${fixture.id} should detect frontend behavior from the live diff.`
  );
  assert.ok(
    changeInterpretation.keyThemes.includes("visual_design"),
    `${fixture.id} should detect presentation work from the live diff.`
  );
}

for (const fixture of fixtures) {
  test(fixture.id, () => {
    let jsonPath;
    let parsed;
    let liveRepoPath;

    if (fixture.type === "cli_output") {
      const stdout = runNode(fixture.args);
      parsed = JSON.parse(stdout);
      assert.equal(parsed.mode, fixture.expectedMode);
      jsonPath = writeTempJson(fixture.id, JSON.stringify(parsed, null, 2));
    } else if (fixture.type === "saved_output") {
      jsonPath = path.join(repoRoot, fixture.path);
      parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      assert.equal(parsed.mode, fixture.expectedMode);
    } else if (fixture.type === "live_commit_range") {
      const { repoPath, from, to } = createLiveCommitRangeFixtureRepo(fixture.id);
      liveRepoPath = repoPath;
      const stdout = runNode([
        "src/index.mjs",
        "--repo",
        repoPath,
        "--from",
        from,
        "--to",
        to,
        "--mode",
        fixture.mode,
      ]);
      parsed = JSON.parse(stdout);
      assert.equal(parsed.mode, fixture.expectedMode);
      jsonPath = writeTempJson(fixture.id, JSON.stringify(parsed, null, 2));
    } else {
      throw new Error(`Unsupported fixture type: ${fixture.type}`);
    }

    validateAgainstSchema(jsonPath);
    assertProductContract(parsed, fixture);
    assertQualityEvaluationPasses(parsed, fixture);

    if (fixture.type === "live_commit_range") {
      assertLiveCommitRangeCoverage(parsed, fixture, liveRepoPath);
    }
  });
}
