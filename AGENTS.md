# AGENTS.md

## Project intent
This repository builds a learning-oriented change interpretation tool.

Its purpose is to translate code changes into:
- what changed
- why it matters
- why the code is shaped this way
- what could go wrong
- what to verify next

This is not:
- a generic code explainer
- a repo chat agent
- a full security scanner
- a code editing or auto-fix agent by default

Keep the product focused on interpretation, judgment, and practical guidance.

---

## Source of truth
When relevant, consult:
- `docs/product-brief.md`
- `docs/output-spec.md`
- `docs/health-review.md`
- `docs/failure-pass.md`

These define product intent, output structure, and review standards.

If code, prompts, and docs conflict:
- do not silently choose one
- call out the conflict
- resolve toward documented intent unless instructed otherwise

---

## Working style
- Prefer small, targeted changes over broad rewrites
- Preserve core workflow unless there is a clear product reason to change it
- Read nearby files before modifying cross-cutting behavior
- Explain behavior, code shape, risks, and verification steps
- Be direct and precise; avoid filler or generic phrasing

---

## Core behavior
Prioritize:
- behavioral change
- system flow
- file relationships
- code shape
- risk awareness

Do not default to:
- line-by-line syntax narration
- shallow summaries that could apply to any diff

---

## Explanation contract
A strong output answers:
- What changed?
- Why does it matter?
- Why was it structured this way?
- What pattern or trend does this suggest?
- What might be risky or unclear?
- What should be verified next?

If these are missing, the output is incomplete.

---

## Certainty rules
Separate clearly:
- observed facts
- inferred intent
- uncertainty

Do not present inference as fact.

If intent is unclear:
- say so
- offer likely interpretations
- avoid confident speculation

---

## Change interpretation rules
- Group changes into meaningful themes
- Do not treat all files equally
- Rank importance and suggest reading order

Common themes:
- auth
- validation
- UI behavior
- data flow
- config
- deployment
- structure

---

## Code shape reasoning
Explain why the implementation is structured this way.

Focus on:
- separation of concerns
- centralization vs duplication
- coupling between modules
- shortcuts vs intentional design
- maintainability impact

---

## Risk signals
Flag risks only when there is signal.

Common areas:
- weak boundaries
- frontend-only enforcement
- missing or fragile validation
- config or environment drift
- duplicated or scattered logic
- brittle initialization
- security hygiene issues

Always explain:
- why it is risky
- what evidence supports it

Avoid alarmist language.

---

## Verification guidance
Provide concrete checks:
- edge cases to test
- assumptions to validate
- failure modes to consider
- files or layers to inspect

Avoid vague advice.

---

## Depth and adaptation
Adjust depth to the user:
- lower level: clarity and flow
- higher level: architecture and tradeoffs

Do not default to beginner explanations unless needed.

---

## Review posture
After meaningful changes:
- run a failure-oriented analysis
- look for fragile assumptions, edge cases, and boundary issues
- consider config drift and environment differences
- identify what is most likely to break

Prioritize realistic risks over theoretical noise.

---

## Project Health Review mode
When reviewing the project broadly:
- assess structure and system boundaries
- identify where complexity is accumulating
- highlight what is working well
- surface drift and high-leverage improvements

This is a checkpoint review, not a full audit.

---

## Documentation expectations
When behavior or evaluation criteria change:
- update relevant docs
- keep documentation concise and practical
- preserve useful examples

If issues repeat, refine guidance here.

---

## Output expectations
Prioritize:
- behavior
- why it matters
- code shape
- system relationships
- risks
- what to verify next
- carry-forward insight

Avoid line-by-line narration unless requested.

---

## Done means
A task is complete when:
- output aligns with interpretation goals
- explanation quality is preserved or improved
- risks and assumptions are surfaced
- relevant docs are updated or noted
- uncertainty is clearly labeled