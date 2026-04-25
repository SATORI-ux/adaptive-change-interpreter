function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function heading(level, text) {
  return `${"#".repeat(level)} ${text}`;
}

function paragraph(text) {
  return hasText(text) ? [String(text).trim()] : [];
}

function bulletList(items = [], formatter = (item) => item) {
  const formatted = asArray(items)
    .map(formatter)
    .filter(hasText);

  if (formatted.length === 0) {
    return ["- None detected."];
  }

  return formatted.map((item) => `- ${item}`);
}

function numberedList(items = [], formatter = (item) => item) {
  const formatted = asArray(items)
    .map(formatter)
    .filter(hasText);

  if (formatted.length === 0) {
    return ["1. None detected."];
  }

  return formatted.map((item, index) => `${index + 1}. ${item}`);
}

function code(value) {
  return `\`${String(value || "").trim()}\``;
}

function section(title, lines = [], level = 2) {
  const content = asArray(lines).filter(hasText);

  if (content.length === 0) {
    return [];
  }

  return [heading(level, title), "", ...content, ""];
}

function renderConfidence(confidence = {}) {
  if (!confidence || !hasText(confidence.reasoning)) {
    return ["Confidence not provided."];
  }

  return [`${confidence.level || "unknown"}: ${confidence.reasoning}`];
}

function renderReadingOrder(readingOrder = []) {
  return numberedList(readingOrder, (item) => {
    if (!item) {
      return null;
    }

    const category = item.category ? ` (${item.category})` : "";
    const reason = item.reason ? ` - ${item.reason}` : "";
    return `${code(item.path)}${category}${reason}`;
  });
}

function renderRiskSignals(riskSignals = []) {
  const signals = asArray(riskSignals);

  if (signals.length === 0) {
    return ["- None detected."];
  }

  return signals.flatMap((signal) => {
    const severity = signal.severity ? ` [${signal.severity}]` : "";
    const lines = [
      `- ${signal.title || signal.id || "Risk signal"}${severity}`,
      `  Why it matters: ${signal.whyItMatters || "No explanation provided."}`
    ];

    if (hasText(signal.evidence?.join(""))) {
      lines.push(`  Evidence: ${asArray(signal.evidence).map(code).join(", ")}`);
    }

    if (hasText(signal.whatToVerify?.join(""))) {
      lines.push(`  Verify: ${asArray(signal.whatToVerify).join(" ")}`);
    }

    return lines;
  });
}

function renderStrengths(strengths = []) {
  return bulletList(strengths, (item) => {
    if (!item) {
      return null;
    }

    return `${item.title}: ${item.whyItMatters}`;
  });
}

function renderArtifactsAndDrift(items = []) {
  return bulletList(items, (item) => {
    if (!item) {
      return null;
    }

    const evidence = asArray(item.evidence).length > 0
      ? ` Evidence: ${asArray(item.evidence).map(code).join(", ")}`
      : "";
    return `${item.title}: ${item.impact}${evidence}`;
  });
}

function renderImprovementPriorities(priorities = []) {
  return numberedList(priorities, (item) => {
    if (!item) {
      return null;
    }

    const actions = asArray(item.actions).length > 0
      ? ` Actions: ${asArray(item.actions).join(" ")}`
      : "";
    return `[${item.priority || "unranked"}] ${item.title}: ${item.whyNow}${actions}`;
  });
}

function renderChangeInterpretation(output, level = 1) {
  return [
    heading(level, "Change Interpretation"),
    "",
    ...section("Overview", paragraph(output.overview), level + 1),
    ...section("Why It Matters", paragraph(output.whyItMatters), level + 1),
    ...section("Code Shape", paragraph(output.codeShape), level + 1),
    ...section("Key Themes", bulletList(output.keyThemes), level + 1),
    ...section("Reading Order", renderReadingOrder(output.readingOrder), level + 1),
    ...section("System Connections", bulletList(output.howPiecesConnect), level + 1),
    ...section("Pattern / Trend", paragraph(output.patternTrend), level + 1),
    ...section("Risk Signals", renderRiskSignals(output.riskSignals), level + 1),
    ...section("What To Verify", bulletList(output.whatToVerify), level + 1),
    ...section("Carry-Forward Lesson", paragraph(output.carryForwardLesson), level + 1),
    ...section("Confidence", renderConfidence(output.confidence), level + 1)
  ];
}

function renderProjectHealthReview(output, level = 1) {
  return [
    heading(level, "Project Health Review"),
    "",
    ...section("Project Overview", paragraph(output.projectOverview), level + 1),
    ...section("What Is Working Well", renderStrengths(output.whatIsWorkingWell), level + 1),
    ...section("Risk Signals", renderRiskSignals(output.riskSignals), level + 1),
    ...section("Artifacts And Drift", renderArtifactsAndDrift(output.artifactsAndDrift), level + 1),
    ...section("Improvement Priorities", renderImprovementPriorities(output.improvementPriorities), level + 1),
    ...section("What To Verify Next", bulletList(output.whatToVerifyNext), level + 1),
    ...section("Confidence", renderConfidence(output.confidence), level + 1)
  ];
}

function renderMetadata(output = {}) {
  const lines = [];

  if (hasText(output.repoPath)) {
    lines.push(`- Repository: ${code(output.repoPath)}`);
  }

  if (hasText(output.commitRange)) {
    lines.push(`- Commit range: ${code(output.commitRange)}`);
  } else if (hasText(output.commitRangeContext)) {
    lines.push(`- Commit range: ${code(output.commitRangeContext)}`);
  }

  if (hasText(output.explanationDepth)) {
    lines.push(`- Explanation depth: ${code(output.explanationDepth)}`);
  }

  return lines;
}

function renderFeatureTimeline(output, level = 1) {
  const candidateLines = numberedList(output.candidateRanges, (candidate) => {
    if (!candidate) {
      return null;
    }

    const why = asArray(candidate.whyThisRange).join(" ");
    const files = asArray(candidate.changedFiles).slice(0, 6).map(code).join(", ");
    const subject = candidate.commit?.subject ? ` ${candidate.commit.subject}.` : "";
    const titleConfidence = candidate.titleConfidence
      ? ` Title confidence: ${candidate.titleConfidence.level} (${candidate.titleConfidence.score}/100). ${candidate.titleConfidence.reasoning}`
      : "";
    return `${candidate.title || candidate.label} - ${candidate.label} (${candidate.confidence}, score ${candidate.score}) - ${code(candidate.range)}.${subject}${titleConfidence} ${candidate.readingReason} Themes: ${asArray(candidate.themes).join(", ")}. Files: ${files}. Why: ${why}`;
  });

  return [
    heading(level, "Feature Timeline"),
    "",
    ...section("Review Note", paragraph(output.reviewNote), level + 1),
    ...section("Scanned Commits", paragraph(String(output.scannedCommits || 0)), level + 1),
    ...section("Candidate Ranges", candidateLines, level + 1)
  ];
}

export function renderMarkdown(output = {}) {
  let lines;

  if (output.mode === "change_interpretation") {
    lines = [
      ...renderMetadata(output),
      "",
      ...renderChangeInterpretation(output)
    ];
  } else if (output.mode === "project_health_review") {
    lines = [
      ...renderMetadata(output),
      "",
      ...renderProjectHealthReview(output)
    ];
  } else if (output.mode === "paired_session") {
    lines = [
      heading(1, "Paired Session"),
      "",
      ...renderMetadata(output),
      "",
      ...renderChangeInterpretation(output.changeInterpretation || {}, 2),
      ...renderProjectHealthReview(output.projectHealthReview || {}, 2)
    ];
  } else if (output.mode === "feature_timeline") {
    lines = [
      ...renderMetadata(output),
      "",
      ...renderFeatureTimeline(output)
    ];
  } else {
    throw new Error(`Unsupported output mode for markdown rendering: ${output.mode || "missing"}`);
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}
