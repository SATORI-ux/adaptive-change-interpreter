const ACTION_WORDS = [
  "check",
  "confirm",
  "verify",
  "review",
  "trace",
  "run",
  "compare",
  "inspect",
  "test",
  "scan",
  "list",
  "pick",
  "document",
  "tighten",
  "resolve",
  "remove",
  "add",
  "create",
  "keep",
  "look for",
  "make",
  "start",
  "write"
];

const UNCERTAINTY_WORDS = [
  "inferred",
  "inference",
  "uncertain",
  "heuristic",
  "suggest",
  "appears",
  "likely",
  "grounded",
  "direct signals",
  "visible repo evidence",
  "not prove",
  "require more"
];

const LOW_VALUE_PHRASES = [
  "this matters because even a small set of files can reveal",
  "the changed files appear to support one focused change",
  "a good review should help you understand",
  "run the changed user flow end to end",
  "confirm the files highest in reading order match the intended behavior"
];

function normalizeText(value = "") {
  return String(value).toLowerCase();
}

function textIncludesAny(text, words) {
  const normalized = normalizeText(text);
  return words.some((word) => normalized.includes(word));
}

function hasConcretePathReference(text = "") {
  return /(^|[\s"'([{])[\w./-]+\.(mjs|js|ts|tsx|jsx|html|css|json|md|sql|toml|yml|yaml)([\s"',.)\]}:]|$)/i.test(text);
}

function hasMeaningfulArray(items) {
  return Array.isArray(items) && items.some((item) => String(item || "").trim().length > 0);
}

function createPass(id, title, evidence = []) {
  return {
    id,
    title,
    status: "pass",
    evidence
  };
}

function createFail(id, title, whyItMatters, evidence = [], suggestion) {
  return {
    id,
    title,
    status: "fail",
    whyItMatters,
    evidence,
    suggestion
  };
}

function createWarn(id, title, whyItMatters, evidence = [], suggestion) {
  return {
    id,
    title,
    status: "warn",
    whyItMatters,
    evidence,
    suggestion
  };
}

function collectTextFromRiskSignals(riskSignals = []) {
  return riskSignals
    .flatMap((signal) => [
      signal.title,
      signal.whyItMatters,
      ...(signal.evidence || []),
      ...(signal.whatToVerify || []),
      signal.mitigation
    ])
    .filter(Boolean)
    .join(" ");
}

function evaluateRiskSignals(riskSignals = [], label) {
  const checks = [];

  if (!Array.isArray(riskSignals)) {
    return [
      createFail(
        `${label}.risk_signals_array`,
        "Risk signals must be an array",
        "Risk review cannot be evaluated if the output shape is missing.",
        [],
        "Return an array, even when there are no meaningful risk signals."
      )
    ];
  }

  const unsupportedSignals = riskSignals.filter((signal) => {
    return !hasMeaningfulArray(signal.evidence) || !hasMeaningfulArray(signal.whatToVerify);
  });

  if (unsupportedSignals.length > 0) {
    checks.push(
      createFail(
        `${label}.risk_signal_support`,
        "Risk signals need evidence and verification guidance",
        "Risk without evidence becomes alarmist, and risk without a check does not help the user act.",
        unsupportedSignals.map((signal) => signal.id || signal.title || "unnamed risk"),
        "Attach concrete evidence and at least one verification step to each risk signal."
      )
    );
  } else {
    checks.push(
      createPass(
        `${label}.risk_signal_support`,
        "Risk signals include evidence and verification guidance",
        riskSignals.map((signal) => signal.id || signal.title).filter(Boolean)
      )
    );
  }

  return checks;
}

function evaluateVerificationSteps(steps = [], label) {
  if (!hasMeaningfulArray(steps)) {
    return createFail(
      `${label}.verification_actionability`,
      "Verification steps are missing",
      "The output contract requires concrete checks so the user knows what to do next.",
      [],
      "Add specific verification steps tied to the changed behavior, system boundary, or risk signals."
    );
  }

  const weakSteps = steps.filter((step) => !textIncludesAny(step, ACTION_WORDS));

  if (weakSteps.length > 0) {
    return createFail(
      `${label}.verification_actionability`,
      "Verification steps should be action-oriented",
      "Vague verification advice does not help the user reduce uncertainty.",
      weakSteps,
      "Start verification steps with concrete actions such as check, trace, compare, inspect, run, or verify."
    );
  }

  return createPass(
    `${label}.verification_actionability`,
    "Verification steps are action-oriented",
    steps
  );
}

function evaluateConfidence(confidence, label) {
  const reasoning = confidence?.reasoning || "";

  if (!reasoning.trim()) {
    return createFail(
      `${label}.confidence_boundaries`,
      "Confidence reasoning is missing",
      "The product must separate observed evidence from inferred intent.",
      [],
      "Explain what the output knows directly and what remains inferred or heuristic."
    );
  }

  if (!textIncludesAny(reasoning, UNCERTAINTY_WORDS)) {
    return createFail(
      `${label}.confidence_boundaries`,
      "Confidence reasoning does not mark uncertainty",
      "Without uncertainty markers, inferred intent can read like fact.",
      [reasoning],
      "Use explicit wording such as grounded, inferred, heuristic, visible evidence, or requires more runtime proof."
    );
  }

  return createPass(
    `${label}.confidence_boundaries`,
    "Confidence reasoning marks evidence limits",
    [reasoning]
  );
}

function evaluateSpecificity(textFields = [], label) {
  const combined = textFields.filter(Boolean).join(" ");
  const lowValueHits = LOW_VALUE_PHRASES.filter((phrase) =>
    normalizeText(combined).includes(phrase)
  );

  if (lowValueHits.length > 0 && !hasConcretePathReference(combined)) {
    return createWarn(
      `${label}.specificity`,
      "Output leans on generic fallback language",
      "Generic language can satisfy structure while failing the interpretation goal.",
      lowValueHits,
      "Anchor explanation in changed surfaces, named files, detected risks, or explicitly stated uncertainty."
    );
  }

  if (hasConcretePathReference(combined)) {
    return createPass(
      `${label}.specificity`,
      "Output includes concrete file or artifact references",
      textFields.filter(hasConcretePathReference)
    );
  }

  return createWarn(
    `${label}.specificity`,
    "Output has limited concrete evidence references",
    "The explanation may still be valid, but stronger outputs usually name files, layers, or artifacts.",
    textFields.filter(Boolean).slice(0, 3),
    "Reference the highest-value files or artifacts when explaining code shape and system relationships."
  );
}

function evaluateChangeInterpretation(output, label = "change_interpretation") {
  const checks = [];
  const requiredTextFields = [
    ["overview", output.overview],
    ["whyItMatters", output.whyItMatters],
    ["codeShape", output.codeShape],
    ["patternTrend", output.patternTrend],
    ["carryForwardLesson", output.carryForwardLesson]
  ];

  const missingTextFields = requiredTextFields
    .filter(([, value]) => !String(value || "").trim())
    .map(([name]) => name);

  if (missingTextFields.length > 0) {
    checks.push(
      createFail(
        `${label}.contract_coverage`,
        "Change interpretation is missing required explanation fields",
        "The output is incomplete if it does not cover behavior, impact, code shape, pattern, and carry-forward insight.",
        missingTextFields,
        "Populate every explanation field with product-specific content."
      )
    );
  } else {
    checks.push(
      createPass(
        `${label}.contract_coverage`,
        "Change interpretation covers the explanation contract",
        requiredTextFields.map(([name]) => name)
      )
    );
  }

  if (!hasMeaningfulArray(output.keyThemes)) {
    checks.push(
      createFail(
        `${label}.themes`,
        "Key themes are missing",
        "The interpreter should group changes into meaningful themes instead of treating all files equally.",
        [],
        "Detect at least one meaningful theme when the change range contains changed files."
      )
    );
  } else {
    checks.push(createPass(`${label}.themes`, "Key themes are present", output.keyThemes));
  }

  if (!hasMeaningfulArray(output.readingOrder)) {
    checks.push(
      createFail(
        `${label}.reading_order`,
        "Reading order is missing",
        "The user needs a prioritized path through the change, not an undifferentiated file list.",
        [],
        "Return a reading order with priorities and reasons."
      )
    );
  } else {
    checks.push(
      createPass(
        `${label}.reading_order`,
        "Reading order prioritizes files",
        output.readingOrder.slice(0, 3).map((item) => item.path)
      )
    );
  }

  checks.push(
    evaluateSpecificity(
      [
        output.overview,
        output.whyItMatters,
        output.codeShape,
        ...(output.howPiecesConnect || []),
        collectTextFromRiskSignals(output.riskSignals)
      ],
      label
    )
  );
  checks.push(...evaluateRiskSignals(output.riskSignals, label));
  checks.push(evaluateVerificationSteps(output.whatToVerify, label));
  checks.push(evaluateConfidence(output.confidence, label));

  return checks;
}

function evaluateProjectHealthReview(output, label = "project_health_review") {
  const checks = [];

  if (!String(output.projectOverview || "").trim()) {
    checks.push(
      createFail(
        `${label}.overview`,
        "Project overview is missing",
        "A health review needs to explain the project shape before ranking risks or improvements.",
        [],
        "Summarize the main systems, boundaries, and where complexity is accumulating."
      )
    );
  } else {
    checks.push(createPass(`${label}.overview`, "Project overview is present", [output.projectOverview]));
  }

  if (!hasMeaningfulArray(output.whatIsWorkingWell)) {
    checks.push(
      createFail(
        `${label}.strengths`,
        "Project strengths are missing",
        "A useful health review should identify what is already working, not only risks.",
        [],
        "Add concise strengths with why they matter."
      )
    );
  } else {
    checks.push(
      createPass(
        `${label}.strengths`,
        "Project strengths are present",
        output.whatIsWorkingWell.map((item) => item.title)
      )
    );
  }

  if (!hasMeaningfulArray(output.improvementPriorities)) {
    checks.push(
      createFail(
        `${label}.priorities`,
        "Improvement priorities are missing",
        "The review should rank next steps so the user can act.",
        [],
        "Add prioritized improvements with why-now reasoning and concrete actions."
      )
    );
  } else {
    checks.push(
      createPass(
        `${label}.priorities`,
        "Improvement priorities are present",
        output.improvementPriorities.map((item) => item.title)
      )
    );
  }

  checks.push(
    evaluateSpecificity(
      [
        output.projectOverview,
        ...(output.whatIsWorkingWell || []).flatMap((item) => [
          item.title,
          item.whyItMatters
        ]),
        ...(output.improvementPriorities || []).flatMap((item) => [
          item.title,
          item.whyNow,
          ...(item.actions || [])
        ]),
        collectTextFromRiskSignals(output.riskSignals)
      ],
      label
    )
  );
  checks.push(...evaluateRiskSignals(output.riskSignals, label));
  checks.push(evaluateVerificationSteps(output.whatToVerifyNext, label));
  checks.push(evaluateConfidence(output.confidence, label));

  return checks;
}

function summarizeChecks(checks) {
  const failed = checks.filter((check) => check.status === "fail");
  const warnings = checks.filter((check) => check.status === "warn");

  return {
    status: failed.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
    totals: {
      pass: checks.filter((check) => check.status === "pass").length,
      warn: warnings.length,
      fail: failed.length
    }
  };
}

export function evaluateOutputQuality(output) {
  const checks = [];

  if (output?.mode === "change_interpretation") {
    checks.push(...evaluateChangeInterpretation(output));
  } else if (output?.mode === "project_health_review") {
    checks.push(...evaluateProjectHealthReview(output));
  } else if (output?.mode === "paired_session") {
    checks.push(
      ...evaluateChangeInterpretation(
        output.changeInterpretation || {},
        "paired_session.change_interpretation"
      )
    );
    checks.push(
      ...evaluateProjectHealthReview(
        output.projectHealthReview || {},
        "paired_session.project_health_review"
      )
    );
  } else {
    checks.push(
      createFail(
        "output.mode",
        "Unsupported output mode",
        "The evaluator only understands change interpretation, project health review, and paired session outputs.",
        [String(output?.mode || "missing")],
        "Evaluate a valid adaptive-change-interpreter output object."
      )
    );
  }

  return {
    mode: "output_quality_evaluation",
    evaluatedMode: output?.mode || null,
    ...summarizeChecks(checks),
    checks
  };
}
