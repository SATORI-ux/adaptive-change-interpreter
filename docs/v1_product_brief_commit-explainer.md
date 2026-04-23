# v1 Product Brief: Adaptive Code Change Interpreter

## Working title
**Adaptive Code Change Interpreter**  
Temporary internal name for a learning-oriented tool that turns confusing repo history into structured explanations of **intent, code shape, risk, and mitigation**.

---

## 1. Product summary
This product helps solo builders, newer developers, and AI-assisted coders understand what changed in a project, why it was implemented that way, what risks or weak patterns may exist, and what to inspect next.

It is **not** a generic code explainer, **not** a repo chat agent, and **not** a full security scanner. Its role is to act as a **translation layer between raw code changes and better engineering judgment**.

### Core promise
**Turn confusing code changes into clear, progressively deeper explanations of what changed, why it was structured that way, what could go wrong, and what to verify next.**

---

## 2. Problem
Modern coding workflows, especially AI-assisted ones, create a common failure state:
- code changes accumulate quickly
- commits often do not tell the full story
- technical language is hard to parse at speed
- users lose the thread of the feature, bug fix, or refactor
- returning to a project after a break becomes mentally expensive
- beginners often do not recognize risky or sloppy patterns until something breaks
- common hygiene mistakes, such as committing secrets or missing `.gitignore`, are often learned only after exposure is already possible

Existing tools often do one of the following:
- show raw diffs without interpretation
- summarize changes too generically
- over-explain syntax the user already understands
- use jargon without adapting to the user's comfort level
- explain isolated lines rather than the larger behavioral or structural change
- ignore maintainability or security signals unless a separate tool catches them

This tool exists to reduce that confusion and help users build better instincts.

---

## 3. v1 goal
Build a useful learning and comprehension tool that can:
1. analyze a commit range or branch comparison
2. group meaningful changes into understandable themes
3. explain those changes in plain language
4. adapt explanation depth to the user's experience level
5. highlight what files matter most and what to inspect next
6. explain **why the code is shaped the way it is**
7. surface likely risks, weak patterns, and follow-up checks
8. translate jargon into digestible guidance without feeling patronizing

### v1 success criteria
A successful v1 should make the user feel:
- "I understand what happened."
- "I understand why the code was structured this way."
- "I know where to look first."
- "I can see the likely risks or weak spots."
- "This taught me something reusable, not just this one diff."
- "The language matched my skill level."

---

## 4. Product boundary and feature restraint
This project will be live-tested by a beginner user and must stay focused on a **core functional workflow**.

That means v1 should avoid feature sprawl. A feature belongs in v1 only if it clearly improves one of the following:
- understanding the story of a change
- understanding why the code is shaped that way
- recognizing likely risks or weak patterns
- knowing what to verify or improve next

A feature does **not** belong in v1 just because it sounds useful in theory.

### v1 discipline rule
**Prefer one strong workflow over many shallow helpers.**

---

## 5. Target user
### Primary audience
- solo builders
- newer developers
- self-taught developers
- users building with heavy LLM assistance
- people returning to their own projects after a gap
- developers who understand code basics but lose the larger architectural thread
- builders who can get code working but struggle to judge whether it is safe, durable, or well-structured

### Secondary audience
- junior developers onboarding into an unfamiliar codebase
- hobbyists learning from side projects
- small teams that want clearer change explanations for handoff or review

---

## 6. Core user need
The user does **not** need a tool that says:
- "this line adds a string"
- "this function returns a boolean"
- "this variable is defined here"

The user **does** need a tool that says:
- what behavior changed
- what that change affects
- why the change was introduced or likely introduced
- how multiple files interact
- why the code was structured in this particular way
- what engineering pattern or shortcut the change resembles
- what risks or weak spots might exist nearby
- what to verify before trusting the change
- what to learn from this change going forward

### User value statement
**Help me understand the story, structure, and likely risks of a change, not just the syntax of the diff.**

---

## 7. Product principles
### 7.1 Teach behavior first
Prioritize:
- behavioral change
- flow change
- system interaction
- architectural movement

Only explain syntax when it is necessary to support understanding.

### 7.2 Teach judgment, not just mechanics
The product should help users recognize:
- healthy modularization
- risky shortcuts
- code sprawl
- weak boundaries
- security hygiene issues
- common maintainability traps

### 7.3 Adapt depth instead of flattening everything
The tool should never assume that a beginner wants low-value explanations of trivial constructs.

It should scale explanation depth based on:
- overall coding comfort
- topic familiarity
- explanation preference

### 7.4 Layer complexity
The first view should be clean and readable.  
Deeper context should be available on demand.

### 7.5 Be honest about uncertainty
The tool should distinguish between:
- observed change
- likely intent
- uncertain interpretation

### 7.6 Prefer usefulness over exhaustiveness
The product should not try to explain every file equally.  
It should identify priority, significance, likely reading order, and likely weak points.

---

## 8. Core v1 use cases
### Use case 1: Understand a recent feature branch
A user compares a branch or commit range and gets a structured explanation of what changed, why it matters, which files form the core of the change, and what risks or tradeoffs were introduced.

### Use case 2: Return to a project after time away
A user revisits a repo and wants a digestible recap of recent work without re-reading every diff.

### Use case 3: Learn from AI-assisted changes
A user used an LLM to make changes and now needs the code translated into conceptual language they can actually retain.

### Use case 4: Catch common beginner mistakes earlier
A user wants to spot patterns such as committed secrets, unclear module ownership, fragile initialization, or frontend-only enforcement before those issues become more expensive.

### Use case 5: Build understanding progressively
A user reads the high-level explanation first, then opens deeper explanations only where needed.

### Use case 6: Run a broader project review at meaningful checkpoints
A user wants an optional, on-demand project-level review when a feature plateaus, before deployment, during cleanup, or when the codebase starts feeling messy.

---

## 9. Core workflow
### Primary v1 workflow: Change Interpretation
1. user selects a commit range or branch comparison
2. tool identifies major change clusters
3. tool generates a plain-language overview
4. tool explains why the code is structured this way
5. tool highlights file reading order
6. tool surfaces likely risks or weak patterns
7. tool suggests what to verify, test, or improve next
8. user can expand into deeper conceptual detail based on comfort level

### Definition of a complete v1 output
A v1 output is successful only if it answers:
- What changed?
- Why does it matter?
- Why was it structured this way?
- What pattern or trend does it suggest?
- What might be risky, brittle, or sloppy?
- What should I verify or improve next?

---

## 10. Secondary analysis mode
### Project Health Review
This is an **optional, manual mode** that steps back from individual commits and reviews the project more broadly. It should **not** run by default with every commit explanation.

### Purpose
Provide a broader checkpoint-style review when a user wants to understand the current state of the project beyond one change set.

### When to use it
- after a feature branch feels complete enough
- before deployment or sharing
- after a long burst of AI-assisted changes
- when the codebase starts feeling harder to reason about
- before cleanup or refactor work
- after returning to a project from a long break

### Core outputs
#### 10.1 Project overview
- what the project appears to do
- key systems or moving parts
- where complexity is accumulating
- what seems well-structured already

#### 10.2 Risk signals
- security hygiene concerns
- obvious boundary or auth mistakes
- sensitive data exposure risks
- fragile implementation patterns

#### 10.3 Artifacts and drift
- dead or stale files
- commented-out leftovers
- duplicate utilities or patterns
- inconsistent naming or abandoned abstractions
- temporary debugging logic still present

#### 10.4 Improvement priorities
- what is working well
- what is acceptable for now
- what should be cleaned up soon
- highest-leverage next improvements

### Boundaries
Project Health Review is **not** a full penetration test, dependency CVE scanner, performance profiler, or lint replacement. It is a **human-readable project review lens** focused on judgment, hygiene, drift, and practical mitigation.

---

## 11. v1 scope
### In scope
- local repository analysis
- Git commit range or branch comparison as primary input
- change grouping into themes or "chapters"
- plain-language summary of meaningful changes
- why-it-matters explanation
- explanation of code structure and design shape
- file priority / reading order
- concept detection
- explanation depth modes
- uncertainty labeling
- simple risk signaling
- simple "what to test" or "what to verify" guidance
- mitigation or better-practice suggestions when the signal is strong enough
- optional Project Health Review with overview, risk signals, artifacts/drift, and improvement priorities

### Out of scope
- code editing or auto-fixing
- agentic repo actions
- general-purpose repo chat
- full architecture diagrams
- multi-repo dependency awareness
- team collaboration features
- full IDE integration as a hard requirement for v1
- perfect intent inference
- dependency CVE scanning
- formal security auditing
- replacing linting, static analysis, or specialized security tools
- beginner programming lessons unrelated to the analyzed change
- persistent background scanning on every commit by default

---

## 12. Primary input model
### v1 input types
1. **Commit range**  
   Primary input for v1. Best balance of clarity and meaningful story.

2. **Branch comparison**  
   Useful for feature work and personal projects.

### Secondary mode inputs
- current repo snapshot
- optionally recent commit window for context

### Deferred inputs
- single commit analysis
- pull request analysis
- entire repo timeline mode

Rationale: single commits can be too granular, while full repo analysis is too broad for the main workflow.

---

## 13. Primary output model
Every explanation should follow a repeatable structure.

### 13.1 Overview
A short plain-language description of the main change.

### 13.2 Why it matters
What changed in terms of behavior, workflow, architecture, or product direction.

### 13.3 Code shape
Explain why the implementation is structured this way.

### 13.4 Key themes
Group the changes into a few meaningful areas, such as:
- authentication flow
- state handling
- UI behavior
- data fetching
- validation
- configuration
- deployment

### 13.5 Reading order
Recommend which files or modules to inspect first and why.

### 13.6 How the pieces connect
Explain relationships between files, functions, or layers.

### 13.7 Pattern or trend recognition
Describe what engineering pattern, shortcut, or codebase trend the change suggests.

### 13.8 Risk signals
Flag likely concerns by category, with plain-language reasoning.

### 13.9 What to verify
Suggest concrete checks, tests, or follow-up review points.

### 13.10 Mitigation or better practice
Offer practical guidance when there is a clear signal.

### 13.11 Carry-forward lesson
State the reusable lesson the user should take into future work.

### 13.12 Confidence / uncertainty
When intent is ambiguous, say so clearly.

---

## 14. Explanation depth system
The explanation system is a core differentiator.

### 14.1 Overall comfort levels
#### Level 1: Foundations in place, project structure still confusing
User understands basic programming ideas but struggles with flow across files and systems.

#### Level 2: Comfortable with code, needs help connecting systems
User understands functions, state, APIs, and Git basics, but larger patterns and architecture still take effort.

#### Level 3: Comfortable with structure, wants insight not hand-holding
User wants intent, tradeoffs, and architectural movement more than syntax definitions.

### 14.2 Topic familiarity tags
In addition to a global level, the tool should track known vs less familiar topics such as:
- React/state
- API flow
- authentication
- database operations
- TypeScript
- styling systems
- deployment/configuration
- Git workflows
- security hygiene
- project structure

### 14.3 Output behavior by level
#### Level 1
- use plain language by default
- define terms only when needed
- prioritize change story, code shape, and practical risk
- avoid line-by-line commentary

#### Level 2
- explain patterns and relationships more directly
- reduce basic terminology definitions
- introduce tradeoffs where useful

#### Level 3
- focus on architecture, abstraction, implications, and mitigation priorities
- avoid explaining familiar basics
- emphasize design movement, coupling, and future impact

---

## 15. Interaction design principles
### First screen should answer:
- What changed?
- Why does it matter?
- Why was it structured this way?
- What should I look at first?

### Deeper layers should be expandable:
- concepts involved
- jargon translation
- file relationships
- pattern interpretation
- risks / tests
- confidence notes

### v1 interaction controls
- explanation depth selector
- topic familiarity preferences
- expand/collapse detail sections
- mark concept as "I know this"
- mark explanation as "too technical" or "too shallow"
- optional Project Health Review trigger

---

## 16. Tone and language rules
The product should sound:
- clear
- calm
- direct
- non-patronizing
- technically honest

The product should avoid:
- filler educational language
- trivial syntax narration
- overconfident explanations of inferred intent
- jargon without translation
- classroom-style hand-holding unless explicitly needed
- alarmist security language when the signal is tentative

### Tone example
Bad:
> This string constant is declared and then passed to the function.

Better:
> This change centralizes the API endpoint into one place, which makes request behavior easier to maintain and reduces hardcoded duplication.

Even better for this product:
> This change centralizes configuration instead of scattering it through request code. That usually improves maintainability, but it is also worth checking whether environment-specific values are now being handled safely.

---

## 17. What makes this product distinct
This tool is differentiated by a combination of:
- learning-oriented explanation
- adaptive depth
- code-shape interpretation instead of raw diff narration
- risk and mitigation awareness without pretending to be a full auditor
- priority-based reading guidance
- technical translation for real project workflows

It is **not** trying to out-compete Git tooling on raw Git features.
It is trying to make change history **digestible, teachable, and reusable**.

---

## 18. Product posture and monetization principles
### Product posture
The product should be positioned as a **trustworthy, user-first tool**, not as an aggressive monetization engine.

### Core principle
**The main function of the tool should be free and robust.**
Users should be able to fully test the core experience, understand their code better, and decide on their own whether the product is worth supporting.

### What should remain free
- the main change interpretation workflow
- adaptive explanation depth
- code-shape and pattern explanation
- basic risk signaling and mitigation guidance
- a solid baseline version of Project Health Review

### What paid should add
Paid features should add **deeper workflow value**, not unlock the product's basic usefulness. Likely candidates include:
- saved project memory over time
- historical learning timelines
- deeper or more customizable review packs
- exportable reports or team-ready summaries
- multi-project organization and power-user workflow features

### Monetization rule
**Free should solve the main problem. Paid should make the solution meaningfully better for recurring or serious use.**

### Anti-patterns to avoid
- ads in the core experience
- artificial usage limits on the main workflow
- paywalling basic understanding of a user's own code
- making Pro feel like the product finally works

---

## 19. Technical expectations for v1
### Likely pipeline
1. ingest Git diff / commit metadata
2. gather changed files and classify them
3. detect clusters of related changes
4. summarize those clusters
5. map clusters to concepts, code-shape decisions, and likely system effects
6. flag likely risk signals where the evidence is strong enough
7. render explanation at selected depth

### High-level technical constraints
- commit messages may be weak or missing
- intent often must be inferred carefully
- noise filtering will be important
- file significance ranking must outperform raw changed-file order
- concept detection must avoid generic, low-value labeling
- risk signaling must stay honest about confidence level

---

## 20. Risks
### 20.1 Generic output risk
If the tool sounds like every other AI summary product, it loses its value immediately.

### 20.2 Over-explanation risk
If the tool explains trivial syntax or beginner concepts too often, users will stop trusting it.

### 20.3 Wrong-intent risk
If the tool confidently states intent when the diff does not support it, the product becomes misleading.

### 20.4 Review overreach risk
If Project Health Review starts pretending to be a full security audit or static analyzer, user trust will drop.

### 20.5 Scope expansion risk
It will be tempting to add:
- full repo chat
- IDE integration
- code fixes
- diagrams
- onboarding mode
- PR review mode
- many separate review toggles too early

These should be resisted until the core explanation system proves useful.

---

## 21. Non-goals
v1 is **not** intended to:
- replace GitHub, GitLens, or source control tools
- teach programming from scratch
- become a universal architecture viewer
- generate code
- review code quality comprehensively in all dimensions
- explain every line in a diff
- act as a full security scanner
- run persistent project-wide analysis by default on every small change

---

## 22. Early success measures
### Qualitative success
Users say things like:
- "This helped me get back into the project fast."
- "I finally understand what changed."
- "I understand why this was built this way."
- "This showed me risks I would not have noticed."
- "This explained the important technical terms without talking down to me."
- "The reading order was useful."

### Quantitative early indicators
- repeat use on the same repo over time
- frequent use after breaks or across feature branches
- users adjusting explanation levels rather than abandoning output
- positive feedback on relevance of reading order and change grouping
- repeated use of Project Health Review at meaningful checkpoints, not just once

---

## 23. Recommended v1 build posture
Build for **personal workflow utility first**.
If it becomes valuable in daily use, then evaluate whether it should expand into:
- a desktop utility
- a local-first web app
- a VS Code extension
- a GitHub app

For v1, usefulness matters more than packaging.

---

## 24. Open questions
These do not need to block v1, but they should be answered during early exploration.

1. Should v1 be local-first only, or should GitHub repo support exist early?
2. Should explanations be generated entirely on demand, or cached per commit range?
3. Should the first UI be a web app, terminal tool, or editor extension?
4. How opinionated should concept tagging be?
5. Should user comfort level be manually selected, learned over time, or both?
6. Should the tool preserve a long-term learning timeline for a repo, or stay session-based in v1?
7. How much of Project Health Review should be repo-wide versus based on a recent commit window?
8. What is the smallest paid feature that adds real workflow value without compromising the free core?

---

## 25. Simple v1 thesis
**If the product can reliably turn a commit range into a clean, adaptive explanation of what changed, why it matters, why it was structured that way, and what to verify next, it is already useful.**

**If the optional Project Health Review can give a trustworthy high-level snapshot of structure, risk, drift, and improvement priorities, it becomes meaningfully more valuable without bloating the main workflow.**
