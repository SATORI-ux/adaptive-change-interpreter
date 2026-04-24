# Output Specification

## Standard Structure

### 1. Overview
Short explanation of the main change in plain language.

### 2. Why it matters
What changed at a behavioral or system level.

### 3. Code shape
Why the implementation is structured this way:
- centralization vs duplication
- coupling vs separation
- shortcut vs intentional design

### 4. Key themes
Group changes into meaningful areas:
- auth
- UI behavior
- validation
- data flow
- config
- etc.

### 5. Reading order
Which files to inspect first and why.

### 6. System connections
How files/modules interact.

### 7. Pattern recognition
What trend or pattern this suggests:
- scaling risk
- improving structure
- shortcut accumulation

### 8. Risk signals
Only include when meaningful.

Explain:
- what is risky
- why it is risky
- what evidence exists

### 9. What to verify
Concrete checks:
- edge cases
- assumptions
- environment differences

### 10. Carry-forward lesson
Reusable insight.

### 11. Confidence
Clearly state:
- known vs inferred
- uncertainty when present

---

## Output Rules

- prioritize behavior over syntax
- avoid generic phrasing
- avoid equal weighting of all files
- do not over-explain basics
- do not invent intent

---

## Failure condition

Output is weak if:
- it could apply to any diff
- it narrates syntax
- it lacks risk or verification insight
- it assumes intent without evidence

---

## Evaluation pass

The project includes a deterministic output-quality evaluator to catch explanations that are structurally valid but weak against the product contract.

The evaluator should check:
- required explanation coverage
- meaningful themes and reading order
- concrete evidence or file/artifact references
- risk signals with evidence and verification guidance
- action-oriented verification steps
- confidence language that separates direct evidence from inference

The evaluator is not a replacement for human judgment. It is a guardrail that helps keep CLI output, saved fixtures, and future GUI-facing output aligned with the same explanation standards.
