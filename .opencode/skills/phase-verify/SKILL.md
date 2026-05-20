---
name: phase-verify
description: Run typecheck, lint, and test suite to verify phase completion
---

## What I do
After completing a phase of changes, I run the full verification pipeline:
1. `cd server && npm run typecheck` — server TypeScript
2. If errors: fix them, re-run until clean
3. `cd client && npm run typecheck` — client TypeScript
4. If errors: fix them, re-run until clean
5. `cd server && npm run lint` — lint server code
6. Fix any warnings
7. `cd client && npm run lint` — lint client code
8. Fix any warnings
9. `cd server && npm run test` — run 43 tests
10. All tests must pass

## When to use me
Use after every phase before documenting completion. Do NOT skip.

## Output
- List of any issues found and fixed
- Final status: ✅ typecheck ✓ lint ✓ test ✓
