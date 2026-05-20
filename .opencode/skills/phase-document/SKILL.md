---
name: phase-document
description: Write phase completion markdown to docs/ and update AGENTS.md
---

## What I do
After verification passes, I write a structured markdown document for the completed phase.

## Template

```markdown
# Phase N: Title

> Completion date: YYYY-MM-DD

## Problems Addressed
- [P1] Description (link to analysis/ file)

## Files Modified
| File | Change |
|------|--------|
| `path/to/file.ts` | What changed and why |

## Verification
- ✅ Server typecheck: passed
- ✅ Client typecheck: passed
- ✅ Lint: passed
- ✅ Tests: N/N passed

## Key Decisions
- What was decided and why

## Follow-ups
- Any remaining issues or next steps
```

## Steps
1. Read the latest docs/phase-*.md for continuity
2. Write new docs/phase-N-title.md
3. Update AGENTS.md Progress section (add phase as completed)
4. Update AGENTS.md Relevant Files section
