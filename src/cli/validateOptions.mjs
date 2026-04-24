const VALID_MODES = new Set([
  "change_interpretation",
  "project_health_review",
  "paired_session",
  "feature_timeline"
]);

const VALID_DEPTHS = new Set(["level_1", "level_2"]);
const VALID_FORMATS = new Set(["json", "markdown"]);

function formatAllowedValues(values) {
  return [...values].map((value) => `"${value}"`).join(", ");
}

export function validateOptions(options = {}) {
  if (!VALID_MODES.has(options.mode)) {
    throw new Error(
      `Unsupported "--mode" value: ${options.mode}. Use one of: ${formatAllowedValues(VALID_MODES)}.`
    );
  }

  if (!VALID_DEPTHS.has(options.depth)) {
    throw new Error(
      `Unsupported "--depth" value: ${options.depth}. Use one of: ${formatAllowedValues(VALID_DEPTHS)}.`
    );
  }

  if (!VALID_FORMATS.has(options.format)) {
    throw new Error(
      `Unsupported "--format" value: ${options.format}. Use one of: ${formatAllowedValues(VALID_FORMATS)}.`
    );
  }

  if (
    options.maxCommits &&
    options.maxCommits !== "all" &&
    (!/^\d+$/.test(options.maxCommits) || Number(options.maxCommits) < 1)
  ) {
    throw new Error('Unsupported "--max-commits" value. Use a positive number or "all".');
  }

  if (
    options.limit &&
    (!/^\d+$/.test(options.limit) || Number(options.limit) < 1)
  ) {
    throw new Error('Unsupported "--limit" value. Use a positive number.');
  }
}
