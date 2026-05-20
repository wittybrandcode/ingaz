---
name: session-handoff
description: Create handoff document for next session when context is full
---

## What I do
When context is running low or session needs to end, I create a handoff document so the next session can resume seamlessly.

## Template

```markdown
# Session Handoff — YYYY-MM-DD

## State
- Session: <number>
- Context usage: <estimate>

## Completed
- Phase N: Title
  - Files changed: [...]
  - Verification: ✅

## Next Phase
- Phase N+1: Title
- Starting point / entry file
- Any blockers

## Context to Restore
- Last modified files:
  - `path/to/file` (what was being worked on)
- Current branch/state: `git status` summary
- Stashed changes: yes/no

## Commands
```bash
# Run at session start
cd server && npm run typecheck
```

## Key Decisions
- What important choices were made
