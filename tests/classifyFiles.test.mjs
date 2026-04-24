import test from "node:test";
import assert from "node:assert/strict";
import { classifyFiles } from "../src/analyze/classifyFiles.mjs";

function categoriesFor(paths) {
  return Object.fromEntries(
    classifyFiles(paths).files.map((file) => [file.path, file.category])
  );
}

test("classifies dist and build paths as generated output before extension heuristics", () => {
  assert.deepEqual(
    categoriesFor([
      "dist/index.html",
      "dist/styles/main.css",
      "dist/service-worker.js",
      "dist/icon.svg",
      "build/app.tsx",
      "build/README.md"
    ]),
    {
      "dist/index.html": "generated_output",
      "dist/styles/main.css": "generated_output",
      "dist/service-worker.js": "generated_output",
      "dist/icon.svg": "generated_output",
      "build/app.tsx": "generated_output",
      "build/README.md": "generated_output"
    }
  );
});

test("keeps equivalent source paths in their normal categories", () => {
  assert.deepEqual(
    categoriesFor([
      "index.html",
      "styles/main.css",
      "service-worker.js",
      "icon.svg"
    ]),
    {
      "index.html": "frontend_app",
      "styles/main.css": "styling",
      "service-worker.js": "notifications_background",
      "icon.svg": "assets"
    }
  );
});
