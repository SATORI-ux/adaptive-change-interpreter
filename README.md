# Adaptive Change Interpreter

A local-first CLI for interpreting code changes and project shape.

The tool reads a Git repository and produces structured JSON that explains:
- what changed
- why it matters
- why the code is shaped this way
- what could be risky
- what to verify next

It is focused on interpretation and practical judgment, not generic repo chat or automatic fixes.

## Setup

Install dependencies from this repository:

```powershell
npm.cmd install
```

Run the test suite:

```powershell
npm.cmd test
```

Evaluate a saved output against the explanation-quality contract:

```powershell
npm.cmd run evaluate:output -- examples\latest-output.json
```

## Repository Input

`--repo` must point to a local Git checkout. To analyze a GitHub repository, clone it first, then pass the cloned folder path.

Example clone target:

```powershell
git clone https://github.com/SATORI-ux/within-reach "C:\Users\dukes\OneDrive\Desktop\HTML-materials\Projects\within-reach"
```

Existing local example:

```powershell
C:\Users\dukes\OneDrive\Desktop\HTML-materials\Projects\check-in-space
```

## Main Modes

Project health review:

```powershell
node src/index.mjs --repo "C:\Users\dukes\OneDrive\Desktop\HTML-materials\Projects\check-in-space" --mode project_health_review
```

Change interpretation for a commit range:

```powershell
node src/index.mjs --repo "C:\Users\dukes\OneDrive\Desktop\HTML-materials\Projects\check-in-space" --from HEAD~1 --to HEAD --mode change_interpretation
```

Paired session, combining change interpretation and project health review:

```powershell
node src/index.mjs --repo "C:\Users\dukes\OneDrive\Desktop\HTML-materials\Projects\check-in-space" --from HEAD~1 --to HEAD --mode paired_session
```

Use deeper explanations when you want more architecture and tradeoff context:

```powershell
node src/index.mjs --repo "C:\Users\dukes\OneDrive\Desktop\HTML-materials\Projects\check-in-space" --from HEAD~3 --to HEAD --mode paired_session --depth level_2
```

## Save Output

PowerShell examples for saving JSON output:

```powershell
node src/index.mjs --repo "C:\Users\dukes\OneDrive\Desktop\HTML-materials\Projects\check-in-space" --mode project_health_review | Set-Content -Path "examples\check-in-space-health-review.json"
```

```powershell
node src/index.mjs --repo "C:\Users\dukes\OneDrive\Desktop\HTML-materials\Projects\check-in-space" --from HEAD~1 --to HEAD --mode paired_session --depth level_2 | Set-Content -Path "examples\check-in-space-paired-session.json"
```

Validate a saved output file against the schema:

```powershell
node src/validateSchema.mjs "examples\check-in-space-paired-session.json"
```

## Useful Commit Range Commands

Inspect recent commits in the target repo:

```powershell
git -C "C:\Users\dukes\OneDrive\Desktop\HTML-materials\Projects\check-in-space" log --oneline -5
```

Use explicit commit SHAs when `HEAD~1..HEAD` is too narrow:

```powershell
node src/index.mjs --repo "C:\Users\dukes\OneDrive\Desktop\HTML-materials\Projects\check-in-space" --from <older-commit-sha> --to <newer-commit-sha> --mode change_interpretation --depth level_2
```

## Notes For This Stage

- `project_health_review` does not require `--from` or `--to`.
- `change_interpretation` and `paired_session` require both `--from` and `--to`.
- Output is JSON so it can be validated, saved, compared, or used as a fixture.
- Generated `dist/` and `build/` files are classified as `generated_output`, even when their extensions look like frontend, styling, docs, assets, or service worker files.
- The current interface is intentionally CLI-first, but the structured output and evaluation pass are meant to preserve a path toward a polished GUI later.
