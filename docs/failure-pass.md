# Failure Pass

## Purpose
Stress test a change beyond the happy path.

Focus on:
- what could break
- what assumptions are fragile
- what is not enforced but relied on

---

## Instructions

Run a failure pass on the change.

### Identify:

1. Weak points
- fragile logic
- unclear ownership
- hidden coupling

2. Failure modes
- what breaks under stress
- what fails silently

3. Edge cases
- null / empty state
- malformed input
- unexpected sequence
- stale state

4. Boundary issues
- frontend vs backend assumptions
- service layer vs UI behavior
- missing enforcement

5. Config and environment risks
- wrong environment behavior
- hardcoded values
- deployment mismatch

---

## Output format

- Most likely failure points
- Why they could fail
- Edge cases to test
- Boundary mismatches
- Config risks
- Highest-value verification steps
- Minimal fixes (only if needed)

---

## Rules

- prioritize realistic risks
- avoid theoretical noise
- do not suggest broad rewrites
- separate confirmed vs inferred issues
- if something is safe, say so clearly

---

## Goal

Shift from:
“it works”

to:
“it is unlikely to break”