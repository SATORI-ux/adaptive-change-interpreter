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

function createLiveCommitRangeFixtureRepo(prefix, scenario = "checkout_ui") {
  if (scenario !== "checkout_ui") {
    return createTrickyCommitRangeFixtureRepo(prefix, scenario);
  }

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

function initializeFixtureRepo(prefix) {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-repo-`));

  runGit(repoPath, ["init", "--quiet"]);
  runGit(repoPath, ["config", "core.autocrlf", "false"]);

  writeFixtureFile(
    repoPath,
    "README.md",
    [
      "# Fixture Project",
      "",
      "A small repository used to verify tricky change interpretation cases.",
      "",
    ].join("\n")
  );
  writeFixtureFile(repoPath, ".gitignore", ["node_modules/", ".env", ""].join("\n"));

  return repoPath;
}

function createDocsOnlyFixture(prefix) {
  const repoPath = initializeFixtureRepo(prefix);
  writeFixtureFile(
    repoPath,
    "docs/operating-notes.md",
    [
      "# Operating Notes",
      "",
      "The first version names the review workflow at a high level.",
      "",
    ].join("\n")
  );

  const from = commitFixtureRepo(repoPath, "Create documentation baseline");

  writeFixtureFile(
    repoPath,
    "README.md",
    [
      "# Fixture Project",
      "",
      "A small repository used to verify tricky change interpretation cases.",
      "",
      "The review flow now expects a named owner for release checks.",
      "",
    ].join("\n")
  );
  writeFixtureFile(
    repoPath,
    "docs/operating-notes.md",
    [
      "# Operating Notes",
      "",
      "The review workflow now separates author checks from release-owner checks.",
      "",
      "Release owners verify rollback notes before tagging a build.",
      "",
    ].join("\n")
  );

  const to = commitFixtureRepo(repoPath, "Clarify release review ownership");
  return { repoPath, from, to };
}

function createConfigOnlyFixture(prefix) {
  const repoPath = initializeFixtureRepo(prefix);
  writeFixtureFile(
    repoPath,
    "package.json",
    JSON.stringify(
      {
        name: "fixture-config",
        type: "module",
        scripts: {
          test: "node --test"
        }
      },
      null,
      2
    )
  );

  const from = commitFixtureRepo(repoPath, "Create config baseline");

  writeFixtureFile(
    repoPath,
    "package.json",
    JSON.stringify(
      {
        name: "fixture-config",
        type: "module",
        scripts: {
          test: "node --test",
          build: "vite build"
        },
        devDependencies: {
          vite: "^5.0.0"
        }
      },
      null,
      2
    )
  );
  writeFixtureFile(
    repoPath,
    "vite.config.js",
    [
      "export default {",
      "  mode: process.env.NODE_ENV || 'development',",
      "  define: {",
      "    __API_URL__: JSON.stringify(process.env.VITE_API_URL),",
      "  },",
      "  build: {",
      "    outDir: 'dist',",
      "  },",
      "};",
      "",
    ].join("\n")
  );

  const to = commitFixtureRepo(repoPath, "Add Vite build configuration");
  return { repoPath, from, to };
}

function createFrontendBackendBoundaryFixture(prefix) {
  const repoPath = initializeFixtureRepo(prefix);
  writeFixtureFile(
    repoPath,
    "index.html",
    [
      "<!doctype html>",
      "<button type=\"button\" data-submit-order>Submit order</button>",
      "",
    ].join("\n")
  );
  writeFixtureFile(
    repoPath,
    "api/orders.js",
    [
      "export function submitOrder(order) {",
      "  return { ok: true, order };",
      "}",
      "",
    ].join("\n")
  );

  const from = commitFixtureRepo(repoPath, "Create order submission flow");

  writeFixtureFile(
    repoPath,
    "index.html",
    [
      "<!doctype html>",
      "<button type=\"button\" data-submit-order data-requires-stock-check>Submit order</button>",
      "<p data-order-status data-error-code=\"stock_check_required\">Stock will be checked before confirmation.</p>",
      "",
    ].join("\n")
  );
  writeFixtureFile(
    repoPath,
    "api/orders.js",
    [
      "export function submitOrder(order) {",
      "  if (!order.stockChecked) {",
      "    return { ok: false, error: 'stock_check_required' };",
      "  }",
      "",
      "  return { ok: true, order };",
      "}",
      "",
    ].join("\n")
  );

  const to = commitFixtureRepo(repoPath, "Require stock check before order confirmation");
  return { repoPath, from, to };
}

function createGeneratedOutputHeavyFixture(prefix) {
  const repoPath = initializeFixtureRepo(prefix);
  writeFixtureFile(
    repoPath,
    "src/lib/render.js",
    [
      "export function renderMessage(message) {",
      "  return `<p>${message}</p>`;",
      "}",
      "",
    ].join("\n")
  );
  writeFixtureFile(repoPath, "dist/index.html", "<main><p>Ready</p></main>\n");
  writeFixtureFile(repoPath, "dist/app.js", "console.log('ready');\n");
  writeFixtureFile(repoPath, "dist/service-worker.js", "self.addEventListener('install', () => {});\n");

  const from = commitFixtureRepo(repoPath, "Create render output baseline");

  writeFixtureFile(
    repoPath,
    "src/lib/render.js",
    [
      "export function renderMessage(message, tone = 'neutral') {",
      "  return `<p data-tone=\"${tone}\">${message}</p>`;",
      "}",
      "",
    ].join("\n")
  );
  writeFixtureFile(repoPath, "dist/index.html", "<main><p data-tone=\"neutral\">Ready</p></main>\n");
  writeFixtureFile(repoPath, "dist/app.js", "console.log('ready with tone');\n");
  writeFixtureFile(
    repoPath,
    "dist/service-worker.js",
    "self.addEventListener('install', () => { self.skipWaiting(); });\n"
  );

  const to = commitFixtureRepo(repoPath, "Add message tone rendering");
  return { repoPath, from, to };
}

function createAmbiguousImplementationFixture(prefix) {
  const repoPath = initializeFixtureRepo(prefix);
  writeFixtureFile(
    repoPath,
    "src/lib/format.js",
    [
      "export function formatLabel(value) {",
      "  return String(value).trim();",
      "}",
      "",
    ].join("\n")
  );

  const from = commitFixtureRepo(repoPath, "Create label formatter");

  writeFixtureFile(
    repoPath,
    "src/lib/format.js",
    [
      "export function formatLabel(value) {",
      "  return String(value).trim().replace(/\\s+/g, ' ');",
      "}",
      "",
    ].join("\n")
  );

  const to = commitFixtureRepo(repoPath, "Normalize label whitespace");
  return { repoPath, from, to };
}

function createFrontendOnlyEnforcementFixture(prefix) {
  const repoPath = initializeFixtureRepo(prefix);
  writeFixtureFile(
    repoPath,
    "index.html",
    [
      "<!doctype html>",
      "<form data-signup-form>",
      "  <input name=\"email\">",
      "  <button type=\"submit\">Continue</button>",
      "</form>",
      "<script type=\"module\" src=\"js/app.js\"></script>",
      "",
    ].join("\n")
  );
  writeFixtureFile(
    repoPath,
    "js/app.js",
    [
      "const form = document.querySelector('[data-signup-form]');",
      "form?.addEventListener('submit', (event) => {",
      "  event.preventDefault();",
      "});",
      "",
    ].join("\n")
  );

  const from = commitFixtureRepo(repoPath, "Create signup form");

  writeFixtureFile(
    repoPath,
    "index.html",
    [
      "<!doctype html>",
      "<form data-signup-form data-requires-email>",
      "  <input name=\"email\" required pattern=\".+@.+\">",
      "  <button type=\"submit\" aria-disabled=\"true\">Continue</button>",
      "</form>",
      "<script type=\"module\" src=\"js/app.js\"></script>",
      "",
    ].join("\n")
  );
  writeFixtureFile(
    repoPath,
    "js/app.js",
    [
      "const form = document.querySelector('[data-signup-form]');",
      "const email = form?.querySelector('[name=\"email\"]');",
      "form?.addEventListener('submit', (event) => {",
      "  if (!email?.value.includes('@')) {",
      "    event.preventDefault();",
      "    localStorage.setItem('signup_validation_error', 'email_required');",
      "  }",
      "});",
      "",
    ].join("\n")
  );

  const to = commitFixtureRepo(repoPath, "Require email in signup form");
  return { repoPath, from, to };
}

function createTrickyCommitRangeFixtureRepo(prefix, scenario) {
  if (scenario === "docs_only") {
    return createDocsOnlyFixture(prefix);
  }

  if (scenario === "config_only") {
    return createConfigOnlyFixture(prefix);
  }

  if (scenario === "frontend_backend_boundary") {
    return createFrontendBackendBoundaryFixture(prefix);
  }

  if (scenario === "generated_output_heavy") {
    return createGeneratedOutputHeavyFixture(prefix);
  }

  if (scenario === "ambiguous_implementation") {
    return createAmbiguousImplementationFixture(prefix);
  }

  if (scenario === "frontend_only_enforcement") {
    return createFrontendOnlyEnforcementFixture(prefix);
  }

  throw new Error(`Unsupported live fixture scenario: ${scenario}`);
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
    ["impact", "matters", "user", "system", "flow", "boundary", "behavior", "runtime"],
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
  if (output.mode === "feature_timeline") {
    assert.equal(output.mode, "feature_timeline");
    assert.ok(
      Array.isArray(output.candidateRanges),
      `${fixture.id} should include candidate ranges.`
    );
    assert.ok(
      output.candidateRanges.length > 0,
      `${fixture.id} should find at least one candidate range.`
    );

    for (const candidate of output.candidateRanges) {
      assertNonEmptyString(candidate.range, `${fixture.id} candidates need ranges.`);
      assertNonEmptyString(candidate.label, `${fixture.id} candidates need labels.`);
      assertNonEmptyString(candidate.title, `${fixture.id} candidates need titles.`);
      assert.ok(candidate.titleConfidence, `${fixture.id} candidates need title confidence.`);
      assert.ok(
        ["low", "medium", "high"].includes(candidate.titleConfidence.level),
        `${fixture.id} title confidence needs a known level.`
      );
      assert.ok(
        candidate.titleConfidence.score >= 0 && candidate.titleConfidence.score <= 100,
        `${fixture.id} title confidence score should be 0-100.`
      );
      assertNonEmptyString(
        candidate.titleConfidence.reasoning,
        `${fixture.id} title confidence needs reasoning.`
      );
      assertNonEmptyString(candidate.readingReason, `${fixture.id} candidates need reading reasons.`);
      assert.ok(
        Array.isArray(candidate.whyThisRange) && candidate.whyThisRange.length > 0,
        `${fixture.id} candidates should explain why the range is useful.`
      );
    }
    return;
  }

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
  if (output.mode === "feature_timeline") {
    return;
  }

  const evaluation = evaluateOutputQuality(output);
  const failedChecks = evaluation.checks
    .filter((check) => check.status === "fail")
    .map((check) => `${check.id}: ${check.title}`);

  assert.equal(
    evaluation.totals.fail,
    0,
    `${fixture.id} should not have hard output quality failures.\n${failedChecks.join("\n")}`
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
  const expectedChangedPaths = fixture.expectedChangedPaths || [];
  const expectedThemes = fixture.expectedThemes || [];
  const expectedRiskSignals = fixture.expectedRiskSignals || [];

  for (const expectedPath of expectedChangedPaths) {
    assert.ok(
      changedPaths.includes(expectedPath),
      `${fixture.id} should include changed path ${expectedPath}.`
    );
  }

  for (const expectedTheme of expectedThemes) {
    assert.ok(
      changeInterpretation.keyThemes.includes(expectedTheme),
      `${fixture.id} should detect theme ${expectedTheme}.`
    );
  }

  for (const expectedRiskSignal of expectedRiskSignals) {
    assert.ok(
      changeInterpretation.riskSignals.some((signal) => signal.id === expectedRiskSignal),
      `${fixture.id} should detect risk signal ${expectedRiskSignal}.`
    );
  }
}

function assertMarkdownCliOutput(repoPath, from, to, mode) {
  const stdout = runNode([
    "src/index.mjs",
    "--repo",
    repoPath,
    "--from",
    from,
    "--to",
    to,
    "--mode",
    mode,
    "--format",
    "markdown",
  ]);

  assert.match(stdout, /# Change Interpretation|# Paired Session/);
  assert.match(stdout, /Risk Signals/);
  assert.doesNotThrow(() => {
    assert.notEqual(stdout.trim().startsWith("{"), true);
  });
}

function getValueAtPath(target, dottedPath) {
  if (!dottedPath) {
    return target;
  }

  return dottedPath.split(".").reduce((value, key) => value?.[key], target);
}

function stringifyExpectationValue(value) {
  if (Array.isArray(value) || (value && typeof value === "object")) {
    return JSON.stringify(value, null, 2);
  }

  return String(value ?? "");
}

function assertExpectedIncludes(output, fixture) {
  const expectations = fixture.expectedIncludes || [];

  for (const expectation of expectations) {
    const actualValue = getValueAtPath(output, expectation.path);
    const haystack = stringifyExpectationValue(actualValue);

    for (const snippet of expectation.includes || []) {
      assert.match(
        haystack.toLowerCase(),
        new RegExp(snippet.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        `${fixture.id} should include "${snippet}" at ${expectation.path}.`
      );
    }
  }
}

function assertExpectedExcludes(output, fixture) {
  const expectations = fixture.expectedExcludes || [];

  for (const expectation of expectations) {
    const actualValue = getValueAtPath(output, expectation.path);
    const haystack = stringifyExpectationValue(actualValue);

    for (const snippet of expectation.excludes || []) {
      assert.doesNotMatch(
        haystack.toLowerCase(),
        new RegExp(snippet.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        `${fixture.id} should not include "${snippet}" at ${expectation.path}.`
      );
    }
  }
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
      const { repoPath, from, to } = createLiveCommitRangeFixtureRepo(
        fixture.id,
        fixture.scenario
      );
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
    assertExpectedIncludes(parsed, fixture);
    assertExpectedExcludes(parsed, fixture);

    if (fixture.type === "live_commit_range") {
      assertLiveCommitRangeCoverage(parsed, fixture, liveRepoPath);

      if (fixture.id === "live_commit_range_change_interpretation") {
        assertMarkdownCliOutput(
          liveRepoPath,
          parsed.commitRange.split("..")[0],
          parsed.commitRange.split("..")[1],
          fixture.mode
        );
      }
    }
  });
}
