# AGENTS.md

## Project intent
This repository builds a learning-oriented change interpretation tool.

Its job is to turn confusing code changes into structured explanations of:
- what changed
- why it matters
- why the code is shaped this way
- what could go wrong
- what to verify next

This project is not:
- a generic code explainer
- a repo chat agent
- a full security scanner
- a code editing or auto-fix agent by default

Keep the product focused on interpretation, judgment, and practical guidance.

## Source of truth
Before changing prompts, output structure, review behavior, or product framing, check relevant markdown documents. Treat them as source of truth for intent, scope, quality bar, and terminology.

Prioritize these when present:
- product brief
- output examples
- review-mode or health-review docs
- feature notes
- evaluation notes

If code, prompts, and markdown disagree, do not silently choose one. Call out the conflict and resolve it toward the documented product intent unless explicitly told otherwise.

## Working style
- Prefer small, targeted changes over broad rewrites.
- Preserve the core workflow unless there is a clear product reason to change it.
- Read nearby files before changing logic that affects prompts, ranking, clustering, or output sections.
- Explain behavior, code shape, risks, and verification steps.
- Be direct and precise. Avoid filler, generic praise, and padded explanation.
- Do not add abstractions just to look sophisticated.

## Core product behavior
This tool should prioritize:
- behavioral change
- flow change
- system interaction
- architectural movement
- risk and mitigation awareness
- useful reading order and inspection guidance

Do not default to line-by-line syntax narration unless explicitly requested.

Avoid shallow summaries that could apply to any diff.

## Explanation contract
A strong output should answer:
- What changed?
- Why does it matter?
- Why was it structured this way?
- What pattern, shortcut, or trend does it suggest?
- What might be risky, brittle, or unclear?
- What should be verified or improved next?

If these questions are not answered, the output is incomplete.

## Certainty and inference rules
Separate clearly:
- observed change
- likely intent
- uncertain interpretation

Do not present inferred intent as fact.

If intent is ambiguous:
- say so clearly
- provide likely interpretations
- avoid confident storytelling not supported by the change

## Anti-generic output rules
Do not:
- narrate trivial syntax
- summarize each file equally
- use filler educational language
- flatten all output to beginner level
- overuse jargon without translation
- sound exhaustive at the cost of usefulness

Every explanation should reflect the actual change and file relationships.

## Change grouping rules
Group changes into meaningful themes or chapters, such as:
- authentication flow
- validation
- UI behavior
- state handling
- data fetching
- configuration
- deployment
- project structure

Do not treat raw changed-file order as importance.
Rank significance and recommend reading order based on impact.

## Code shape reasoning
Explain why the implementation is shaped the way it is.

Useful categories include:
- centralization vs duplication
- separation of concerns
- coupling between modules
- local patch vs broader abstraction
- intentional structure vs likely shortcut
- future maintainability impact

Focus on structure and implications more than syntax.

## Risk signals
Flag realistic risks only when there is signal.

Common categories:
- weak boundaries
- frontend-only enforcement
- missing or fragile validation
- config or environment drift
- duplicated or scattered logic
- brittle initialization
- stale artifacts or ownership confusion
- security hygiene issues

Always explain why something is risky and what evidence supports the concern.

Do not use alarmist language when the signal is tentative.

## Verification guidance
Always provide concrete checks when relevant:
- what to test
- what edge cases to try
- what assumptions to validate
- what could silently fail
- what files or layers should be inspected next

Avoid vague advice such as “test thoroughly”.

## Depth and adaptation
Adapt explanation depth to the user’s level.

Lower-depth outputs should:
- prioritize clarity
- explain flow and interactions
- translate jargon only when needed

Higher-depth outputs should:
- focus on architecture
- highlight tradeoffs
- discuss coupling, boundary design, and future impact

Do not default to beginner hand-holding unless appropriate.

## Project Health Review mode
When running broader analysis, step back from the single diff and assess:
- what the project appears to do
- where complexity is accumulating
- what is working well
- where drift or weak boundaries are emerging
- which improvements have the highest leverage

This mode is a judgment-oriented checkpoint, not a full audit, profiler, or vulnerability scanner.

## Failure awareness
Actively look for:
- what could break
- what is assumed but not enforced
- what may work only in one environment
- what may silently drift over time
- what a beginner or AI-assisted builder is least likely to notice

Surface these clearly without overstating confidence.

## Documentation expectations
When product behavior or evaluation criteria change meaningfully:
- update the relevant markdown file if one exists
- keep docs concise and practical
- preserve examples that show the intended quality bar

If the same correction is needed more than once, add or refine guidance here.

## Output expectations
When reviewing or explaining changes, prioritize:
- behavior
- why it matters
- code shape
- file relationships
- risks
- what to verify next
- carry-forward lesson

Avoid line-by-line narration unless explicitly requested.

## Done means
A task is not done just because text was generated or a prompt was changed.

A task is done when:
- the output better matches the product’s interpretation goals
- the change preserves or improves explanation quality
- likely risks or regressions are considered
- relevant docs are updated or explicitly noted
- uncertainty is labeled honestly where needed