# Project Health Review Mode

## Purpose
Provide a checkpoint-level review of the project.

Not tied to a single diff.

Focus:
- structure
- drift
- risk accumulation
- improvement priorities

## Core outputs

### 1. Project overview
- what the system does
- main components
- where complexity is forming

### 2. What is working well
Highlight:
- clear structure
- good modularization
- strong product focus

Avoid reusable praise that could apply to most repositories. Prefer concrete
language about what the evidence enables, protects, or makes easier to verify.

### 3. Risk signals
Focus on:
- boundary issues
- config drift
- weak validation
- frontend/backend mismatch
- security hygiene concerns

Do not over-report noise.

### 4. Artifacts and drift
Look for:
- stale files
- duplicated logic
- inconsistent patterns
- leftover debug or temporary code

### 5. Improvement priorities
Rank:
- what to fix now
- what is acceptable
- what can wait

Focus on highest leverage.

### 6. What to verify next
Give practical next checks.

---

## Review posture

- judgment-oriented, not exhaustive
- signal over noise
- practical over theoretical
- grounded in real risk

---

## Anti-goals

Do not:
- act as full security audit
- list every minor issue
- overwhelm with low-value observations
