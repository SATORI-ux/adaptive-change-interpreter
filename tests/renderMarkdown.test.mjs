import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { renderMarkdown } from "../src/render/renderMarkdown.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("renders paired-session output as readable markdown", () => {
  const output = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "examples", "latest-output.json"), "utf8")
  );
  const markdown = renderMarkdown(output);

  assert.match(markdown, /^# Paired Session/m);
  assert.match(markdown, /## Change Interpretation/);
  assert.match(markdown, /### Overview/);
  assert.match(markdown, /### Risk Signals/);
  assert.match(markdown, /## Project Health Review/);
  assert.match(markdown, /### Improvement Priorities/);
  assert.match(markdown, /### Confidence/);
  assert.ok(!markdown.trim().startsWith("{"));
});

test("rejects unsupported output modes", () => {
  assert.throws(
    () => renderMarkdown({ mode: "repo_chat" }),
    /Unsupported output mode/
  );
});
