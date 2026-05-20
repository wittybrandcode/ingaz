---
name: git-commit
description: Commit changes with conventional phase-based commit message
---

## What I do
Stage and commit phase changes with a structured message.

## Steps
1. Run `git status` to review all changes
2. Run `git diff` to verify content is correct
3. Stage all changes: `git add -A`
4. Commit with message format: `phase-N: <area>: <brief description>`
5. Do NOT push unless asked

## Commit Message Format
```
phase-01: security: remove JWT_SECRET fallback, enable cookie-parser
phase-02: db: add FK for subtasks.winnerCommentId, fix setup.ts
phase-03: auth: add token blacklist check, add transactions
```

## Rules
- Never commit secrets or .env files
- Keep message under 72 chars
- Reference issue numbers if applicable
