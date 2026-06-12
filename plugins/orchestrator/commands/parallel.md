---
description: Launch the listed tasks as parallel Agent calls in one message
allowed-tools: Agent, Read, Glob, Grep
---

# /parallel

Launch each listed task as its own `Agent` call — **all calls in ONE message**
so they run in parallel. No decomposition, no confirmation.

Per task, pick `subagent_type` from an optional prefix:

- `explore:` → Explore (read-only)
- `plan:` → Plan (design only; Plan agents do not edit files)
- no prefix → general-purpose

If two or more tasks mutate files, add `isolation: worktree` to each.

When all agents return, present results per task; mark failures with their
error instead of hiding them.

## Tasks

$ARGUMENTS
