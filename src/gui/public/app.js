const state = {
  mode: "project_health_review",
  lastOutput: null,
  browsePath: null,
  repoPath: null,
  repoLabel: null,
  timelineCandidates: [],
  timelineRepo: null,
  selectedCandidateRange: null
};

const elements = {
  repo: document.querySelector("#repoInput"),
  browse: document.querySelector("#browseButton"),
  dialog: document.querySelector("#repoDialog"),
  closeBrowse: document.querySelector("#closeBrowseButton"),
  selectCurrent: document.querySelector("#selectCurrentButton"),
  browsePath: document.querySelector("#browsePath"),
  browseMessage: document.querySelector("#browseMessage"),
  browseList: document.querySelector("#browseList"),
  from: document.querySelector("#fromInput"),
  to: document.querySelector("#toInput"),
  depth: document.querySelector("#depthInput"),
  depthHelp: document.querySelector("#depthHelp"),
  maxCommits: document.querySelector("#maxCommitsInput"),
  limit: document.querySelector("#limitInput"),
  run: document.querySelector("#runButton"),
  status: document.querySelector("#statusText"),
  output: document.querySelector("#output"),
  selectedRange: document.querySelector("#selectedRange"),
  candidateList: document.querySelector("#candidateList"),
  candidateCount: document.querySelector("#candidateCount"),
  segments: [...document.querySelectorAll(".segment")]
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function compactSha(value) {
  return String(value || "").slice(0, 10);
}

function setStatus(message) {
  elements.status.textContent = message;
}

function setMode(mode) {
  state.mode = mode;
  elements.segments.forEach((segment) => {
    segment.classList.toggle("is-active", segment.dataset.mode === mode);
  });
  document.body.dataset.mode = mode;
  updateDepthHelp();
}

function updateDepthHelp() {
  const depthDescriptions = {
    level_1: "Concise: main change, why it matters, risks, and checks.",
    level_2: "Deeper: adds intent context, boundaries, reading strategy, and tradeoffs."
  };
  const inactiveModes = new Set(["project_health_review", "feature_timeline"]);

  if (inactiveModes.has(state.mode)) {
    elements.depthHelp.textContent = "Depth is used for Change and Paired output.";
    elements.depth.disabled = true;
    return;
  }

  elements.depth.disabled = false;
  elements.depthHelp.textContent = depthDescriptions[elements.depth.value];
}

function clearTimelineCandidates() {
  state.timelineCandidates = [];
  state.timelineRepo = null;
  state.selectedCandidateRange = null;
  renderSelectedRange();
  renderCandidates();
}

function setRepoSelection(repoPath, repoLabel) {
  state.repoPath = repoPath;
  state.repoLabel = repoLabel || repoPath;
  elements.repo.value = state.repoLabel;
  elements.repo.title = repoPath;
}

function getRepoPathForPayload() {
  const currentValue = elements.repo.value.trim();

  if (state.repoPath && currentValue === state.repoLabel) {
    return state.repoPath;
  }

  return currentValue;
}

async function verifyRepoSelection(repoPath) {
  const query = repoPath ? `?path=${encodeURIComponent(repoPath)}` : "";
  const response = await fetch(`/api/repo-info${query}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Unable to verify repository.");
  }

  setRepoSelection(payload.path, payload.label);
  return payload;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function paragraph(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part)}</p>`)
    .join("");
}

function list(items, formatter = escapeHtml) {
  const rows = asArray(items).filter(Boolean);

  if (rows.length === 0) {
    return '<p class="muted">None detected.</p>';
  }

  return `<ul>${rows.map((item) => `<li>${formatter(item)}</li>`).join("")}</ul>`;
}

function section(title, content) {
  if (!content) {
    return "";
  }

  return `<section class="output-section"><h3>${escapeHtml(title)}</h3>${content}</section>`;
}

function renderProjectOverview(value) {
  const parts = String(value || "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return '<p class="muted">No project overview provided.</p>';
  }

  return `
    <div class="overview-grid">
      ${parts.map((part) => {
        const [label, ...rest] = part.split(": ");
        const hasLabel = rest.length > 0 && label.length < 32;
        return `
          <article class="overview-card">
            ${hasLabel ? `<strong>${escapeHtml(label)}</strong>` : ""}
            <p>${escapeHtml(hasLabel ? rest.join(": ") : part)}</p>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderRiskSignals(riskSignals) {
  const signals = asArray(riskSignals);

  if (signals.length === 0) {
    return '<p class="muted">None detected.</p>';
  }

  return signals.map((signal) => `
    <article class="item-card">
      <div class="item-title">
        <strong>${escapeHtml(signal.title || signal.id || "Risk signal")}</strong>
        <span>${escapeHtml(signal.severity || "unknown")}</span>
      </div>
      ${paragraph(signal.whyItMatters)}
      ${list(signal.evidence, (item) => `<code>${escapeHtml(item)}</code>`)}
      ${list(signal.whatToVerify)}
    </article>
  `).join("");
}

function renderReadingOrder(readingOrder) {
  const items = asArray(readingOrder);

  if (items.length === 0) {
    return '<p class="muted">None detected.</p>';
  }

  return `<ol>${items.map((item) => `
    <li>
      <code>${escapeHtml(item.path)}</code>
      <span class="pill">${escapeHtml(item.category)}</span>
      <p>${escapeHtml(item.reason)}</p>
    </li>
  `).join("")}</ol>`;
}

function renderConfidence(confidence = {}) {
  if (!confidence.reasoning) {
    return '<p class="muted">Confidence not provided.</p>';
  }

  return `<p><strong>${escapeHtml(confidence.level || "unknown")}:</strong> ${escapeHtml(confidence.reasoning)}</p>`;
}

function renderChangeInterpretation(output) {
  return `
    ${section("Overview", paragraph(output.overview))}
    ${section("Why It Matters", paragraph(output.whyItMatters))}
    ${section("Code Shape", paragraph(output.codeShape))}
    ${section("Key Themes", list(output.keyThemes))}
    ${section("Reading Order", renderReadingOrder(output.readingOrder))}
    ${section("System Connections", list(output.howPiecesConnect))}
    ${section("Pattern / Trend", paragraph(output.patternTrend))}
    ${section("Risk Signals", renderRiskSignals(output.riskSignals))}
    ${section("What To Verify", list(output.whatToVerify))}
    ${section("Carry-Forward Lesson", paragraph(output.carryForwardLesson))}
    ${section("Confidence", renderConfidence(output.confidence))}
  `;
}

function renderProjectHealth(output) {
  return `
    ${section("Project Overview", renderProjectOverview(output.projectOverview))}
    ${section("What Is Working Well", asArray(output.whatIsWorkingWell).map((item) => `
      <article class="item-card">
        <strong>${escapeHtml(item.title)}</strong>
        ${paragraph(item.whyItMatters)}
      </article>
    `).join(""))}
    ${section("Risk Signals", renderRiskSignals(output.riskSignals))}
    ${section("Artifacts And Drift", asArray(output.artifactsAndDrift).map((item) => `
      <article class="item-card">
        <strong>${escapeHtml(item.title)}</strong>
        ${paragraph(item.impact)}
        ${list(item.evidence, (entry) => `<code>${escapeHtml(entry)}</code>`)}
      </article>
    `).join(""))}
    ${section("Improvement Priorities", asArray(output.improvementPriorities).map((item) => `
      <article class="item-card">
        <div class="item-title">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.priority)}</span>
        </div>
        ${paragraph(item.whyNow)}
        ${list(item.actions)}
      </article>
    `).join(""))}
    ${section("What To Verify Next", list(output.whatToVerifyNext))}
    ${section("Confidence", renderConfidence(output.confidence))}
  `;
}

function renderFeatureTimeline(output) {
  const candidates = asArray(output.candidateRanges);

  if (candidates.length === 0) {
    return `
      ${section("Review Note", paragraph(output.reviewNote))}
      ${section("Scanned Commits", paragraph(output.scannedCommits))}
      ${section("Candidate Ranges", '<p class="muted">None detected.</p>')}
    `;
  }

  return `
    ${section("Review Note", paragraph(output.reviewNote))}
    ${section("Scanned Commits", paragraph(output.scannedCommits))}
    ${section("Candidate Ranges", candidates.map((candidate) => `
      <article class="item-card">
        <div class="item-title">
          <strong>${escapeHtml(candidate.title || candidate.label)}</strong>
          <span>${escapeHtml(candidate.label)} · ${escapeHtml(candidate.confidence)} / ${escapeHtml(candidate.score)}</span>
        </div>
        ${renderTitleConfidence(candidate.titleConfidence)}
        <p><code>${escapeHtml(candidate.range)}</code></p>
        <p>${escapeHtml(candidate.readingReason)}</p>
        ${list(candidate.themes)}
        ${list(candidate.whyThisRange)}
      </article>
    `).join(""))}
  `;
}

function renderTitleConfidence(titleConfidence) {
  if (!titleConfidence) {
    return "";
  }

  return `
    <div class="confidence-strip">
      <span>${escapeHtml(titleConfidence.level)} title · ${escapeHtml(titleConfidence.score)}/100</span>
      <p>${escapeHtml(titleConfidence.reasoning)}</p>
    </div>
  `;
}

function renderBrowseEntries(payload) {
  const rows = [];

  if (payload.parent) {
    rows.push({
      type: "parent",
      name: "Parent Folder",
      path: payload.parent,
      label: ".."
    });
  }

  for (const entry of asArray(payload.entries)) {
    rows.push({
      type: "folder",
      name: entry.name,
      path: entry.path,
      isGitRepo: entry.isGitRepo
    });
  }

  if (rows.length === 0) {
    elements.browseList.innerHTML = '<p class="muted">No folders found here.</p>';
    return;
  }

  elements.browseList.innerHTML = rows.map((row, index) => `
    <button class="browse-row" type="button" data-index="${index}">
      <span>
        <strong>${escapeHtml(row.type === "parent" ? row.label : row.name)}</strong>
        <small>${escapeHtml(row.type === "parent" ? "Go to parent folder" : row.path)}</small>
      </span>
      ${row.isGitRepo ? '<span class="repo-badge">Git repo</span>' : '<span class="repo-badge muted-badge">Folder</span>'}
    </button>
  `).join("");

  elements.browseList.querySelectorAll(".browse-row").forEach((row) => {
    row.addEventListener("click", () => {
      const target = rows[Number(row.dataset.index)];
      loadBrowsePath(target.path);
    });
  });
}

async function loadBrowsePath(folderPath) {
  elements.browseMessage.textContent = "Loading folder...";
  elements.browseList.innerHTML = "";

  try {
    const query = folderPath ? `?path=${encodeURIComponent(folderPath)}` : "";
    const response = await fetch(`/api/browse${query}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to browse folder.");
    }

    state.browsePath = payload.path;
    elements.browsePath.textContent = payload.path;
    elements.selectCurrent.disabled = !payload.isGitRepo;
    elements.browseMessage.textContent = payload.isGitRepo
      ? "This folder is a Git repository. You can choose it."
      : "Open a folder marked Git repo, or choose this folder once it is a repository.";
    renderBrowseEntries(payload);
  } catch (error) {
    elements.browseMessage.textContent = error.message;
  }
}

function renderMetadata(output) {
  const parts = [
    output.repoPath && `Repo: ${escapeHtml(output.repoPath)}`,
    output.commitRange && `Range: ${escapeHtml(output.commitRange)}`,
    output.commitRangeContext && `Range: ${escapeHtml(output.commitRangeContext)}`,
    output.explanationDepth && `Depth: ${escapeHtml(output.explanationDepth)}`
  ].filter(Boolean);

  return parts.length > 0
    ? `<div class="metadata">${parts.map((part) => `<span>${part}</span>`).join("")}</div>`
    : "";
}

function getSelectedCandidate() {
  if (!state.selectedCandidateRange) {
    return null;
  }

  return state.timelineCandidates.find(
    (candidate) => candidate.range === state.selectedCandidateRange
  ) || null;
}

function selectCandidate(candidate) {
  state.selectedCandidateRange = candidate?.range || null;

  if (candidate) {
    elements.from.value = candidate.from;
    elements.to.value = candidate.to;
  }

  renderSelectedRange();
  renderCandidates();
}

function syncSelectedCandidateFromRange(from, to) {
  const range = from && to ? `${from}..${to}` : null;

  if (!range) {
    return;
  }

  const matchingCandidate = state.timelineCandidates.find(
    (candidate) => candidate.range === range
  );

  state.selectedCandidateRange = matchingCandidate?.range || null;
  renderSelectedRange();
  renderCandidates();
}

function renderSelectedRange() {
  const candidate = getSelectedCandidate();

  if (!candidate) {
    elements.selectedRange.classList.add("is-empty");
    elements.selectedRange.innerHTML = `
      <span>Selected range</span>
      <p>No range selected.</p>
    `;
    return;
  }

  elements.selectedRange.classList.remove("is-empty");
  elements.selectedRange.innerHTML = `
    <span>Selected range</span>
    <strong>${escapeHtml(candidate.title || candidate.label)}</strong>
    <p>${escapeHtml(compactSha(candidate.from))}..${escapeHtml(compactSha(candidate.to))}</p>
    ${candidate.titleConfidence ? `<small>${escapeHtml(candidate.titleConfidence.level)} title · ${escapeHtml(candidate.titleConfidence.score)}/100</small>` : ""}
  `;
}

function activatePairedTab(tabName) {
  document.querySelectorAll(".paired-tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tabName);
  });
  document.querySelectorAll(".paired-panel").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tabName;
  });
}

function bindPairedTabs() {
  document.querySelectorAll(".paired-tab").forEach((button) => {
    button.addEventListener("click", () => {
      activatePairedTab(button.dataset.tab);
    });
  });
}

function renderPairedSession(output) {
  const selectedCandidate = getSelectedCandidate();
  const selectedSummary = selectedCandidate
    ? `<p class="paired-context">Selected range: <strong>${escapeHtml(selectedCandidate.title || selectedCandidate.label)}</strong></p>`
    : "";

  return `
    ${renderMetadata(output)}
    <section class="paired-shell">
      <div class="paired-header">
        <div>
          <h2>Paired Session</h2>
          ${selectedSummary}
        </div>
        <div class="paired-tabs" role="tablist" aria-label="Paired session sections">
          <button class="paired-tab is-active" type="button" data-tab="change">Change Interpretation</button>
          <button class="paired-tab" type="button" data-tab="context">Project Context</button>
        </div>
      </div>
      <section class="paired-panel" data-panel="change">
        ${renderChangeInterpretation(output.changeInterpretation || {})}
      </section>
      <section class="paired-panel" data-panel="context" hidden>
        <p class="paired-context-note">Repo-wide context for judging the selected change range.</p>
        ${renderProjectHealth(output.projectHealthReview || {})}
      </section>
    </section>
  `;
}

function renderOutput(output) {
  state.lastOutput = output;

  if (output.mode === "feature_timeline") {
    state.timelineCandidates = asArray(output.candidateRanges);
    state.timelineRepo = output.repoPath || elements.repo.value.trim();
    renderCandidates();
  }

  if (output.mode === "paired_session") {
    const [from, to] = String(output.commitRange || "").split("..");
    syncSelectedCandidateFromRange(from, to);
    elements.output.innerHTML = renderPairedSession(output);
    bindPairedTabs();
    return;
  }

  const bodyByMode = {
    change_interpretation: renderChangeInterpretation,
    project_health_review: renderProjectHealth,
    feature_timeline: renderFeatureTimeline
  };
  const titleByMode = {
    change_interpretation: "Change Interpretation",
    project_health_review: "Project Health Review",
    feature_timeline: "Feature Timeline"
  };

  elements.output.innerHTML = `
    ${renderMetadata(output)}
    <h2>${escapeHtml(titleByMode[output.mode] || "Output")}</h2>
    ${bodyByMode[output.mode] ? bodyByMode[output.mode](output) : ""}
  `;
}

function renderCandidates() {
  const candidates = asArray(state.timelineCandidates);
  elements.candidateCount.textContent = String(candidates.length);

  if (candidates.length === 0) {
    elements.candidateList.innerHTML = '<p class="muted">Run Timeline to list candidate ranges.</p>';
    return;
  }

  elements.candidateList.innerHTML = candidates.map((candidate, index) => {
    const isSelected = candidate.range === state.selectedCandidateRange;

    return `
      <article class="candidate-item ${isSelected ? "is-selected" : ""}">
        <button class="candidate-card" type="button" data-index="${index}">
          <strong>${escapeHtml(candidate.title || candidate.label)}</strong>
          <span>${escapeHtml(compactSha(candidate.from))}..${escapeHtml(compactSha(candidate.to))}</span>
          ${candidate.titleConfidence ? `<small>${escapeHtml(candidate.titleConfidence.level)} title · ${escapeHtml(candidate.titleConfidence.score)}/100</small>` : ""}
          <small>${escapeHtml(candidate.readingReason)}</small>
        </button>
        ${isSelected ? `<button class="run-selected-inline" type="button" data-run-index="${index}">Run Selected Range</button>` : ""}
      </article>
    `;
  }).join("");

  elements.candidateList.querySelectorAll(".candidate-card").forEach((card) => {
    card.addEventListener("click", () => {
      const candidate = candidates[Number(card.dataset.index)];
      selectCandidate(candidate);
    });
  });

  elements.candidateList.querySelectorAll(".run-selected-inline").forEach((button) => {
    button.addEventListener("click", () => {
      const candidate = candidates[Number(button.dataset.runIndex)];
      selectCandidate(candidate);
      runSelectedRange();
    });
  });
}

function runSelectedRange() {
  const candidate = getSelectedCandidate();

  if (!candidate) {
    return;
  }

  selectCandidate(candidate);
  setMode("paired_session");
  runAnalysis();
}

function buildPayload() {
  return {
    repo: getRepoPathForPayload(),
    mode: state.mode,
    depth: elements.depth.value,
    maxCommits: elements.maxCommits.value.trim(),
    limit: elements.limit.value.trim(),
    from: elements.from.value.trim(),
    to: elements.to.value.trim()
  };
}

async function runAnalysis() {
  elements.run.disabled = true;
  setStatus("Running...");

  if (state.mode === "feature_timeline") {
    clearTimelineCandidates();
  }

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(buildPayload())
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Analysis failed.");
    }

    renderOutput(payload);
    if (payload.repoPath) {
      await verifyRepoSelection(payload.repoPath);
    }
    setStatus("Ready");
  } catch (error) {
    elements.output.innerHTML = `
      <section class="error-panel">
        <h2>Analysis Error</h2>
        <p>${escapeHtml(error.message)}</p>
      </section>
    `;
    setStatus("Error");
  } finally {
    elements.run.disabled = false;
    renderSelectedRange();
  }
}

async function loadDefaults() {
  const response = await fetch("/api/defaults");
  const defaults = await response.json();
  setRepoSelection(defaults.repo || "", defaults.repoLabel || defaults.repo);
  document.body.dataset.mode = state.mode;
}

elements.segments.forEach((segment) => {
  segment.addEventListener("click", () => {
    setMode(segment.dataset.mode);
  });
});

elements.run.addEventListener("click", runAnalysis);

elements.depth.addEventListener("change", updateDepthHelp);

elements.repo.addEventListener("input", () => {
  state.repoPath = null;
  state.repoLabel = null;
  elements.repo.title = "";
  clearTimelineCandidates();
});

elements.browse.addEventListener("click", () => {
  elements.dialog.showModal();
  loadBrowsePath(getRepoPathForPayload());
});

elements.closeBrowse.addEventListener("click", () => {
  elements.dialog.close();
});

elements.selectCurrent.addEventListener("click", async () => {
  if (!state.browsePath) {
    return;
  }

  try {
    await verifyRepoSelection(state.browsePath);
    clearTimelineCandidates();
    elements.dialog.close();
    setStatus("Repository selected");
  } catch (error) {
    elements.browseMessage.textContent = error.message;
  }
});

elements.dialog.addEventListener("cancel", () => {
  elements.browseMessage.textContent = "";
});

await loadDefaults();
updateDepthHelp();
