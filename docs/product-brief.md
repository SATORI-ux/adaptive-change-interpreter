# Product Brief (Agent-Oriented)

## Purpose
This project translates code changes into structured explanations of:
- what changed
- why it matters
- why it was structured this way
- what risks exist
- what to verify next

It is a learning and judgment tool, not a generic explainer.

## Product direction
The current product surface is a local-first CLI and JSON engine.

Longer term, this should be able to support a polished GUI for reviewing change interpretations, reading order, risks, and verification steps. That future interface should not change the core product role: the engine still needs to produce grounded, judgment-oriented interpretations before the UI tries to make them pleasant to explore.

Near-term feature decisions should therefore preserve:
- stable structured output
- clear evaluation criteria
- explainable quality checks
- separation between interpretation logic and presentation

## Core principle
Prioritize:
- behavior
- system flow
- code shape
- risk awareness

Do not prioritize:
- syntax narration
- line-by-line explanation
- generic summaries

## Target user
- solo builders
- AI-assisted developers
- users who can write code but struggle with system understanding and risk

## What good output feels like
The user should be able to say:
- I understand what happened
- I understand why it was built this way
- I know what to check next
- I see potential risks

## Required output elements
Every meaningful explanation should cover:
- behavior change
- system impact
- structure reasoning
- risk signals
- verification steps

## Anti-goals
Do not:
- explain trivial syntax
- assume intent without evidence
- generate generic summaries
- over-explain basic concepts

## Core insight
This tool teaches judgment, not just mechanics.
