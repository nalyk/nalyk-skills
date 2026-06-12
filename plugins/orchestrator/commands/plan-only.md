---
description: Emit the workstream decomposition without dispatching any agents
allowed-tools: Skill, Read, Glob, Grep
---

# /plan-only

Load the orchestrator skill (`skills/orchestrator/SKILL.md`) and decompose the
request into workstreams. **Do not dispatch any agents.**

Output one short list:

```
[1] Explore — <task>
[2] Plan — <task>
[3] general-purpose — <task>  (depends: 1, 2)
```

Note which workstreams run in parallel (same phase) and which need
`isolation: worktree`. End with: "Run /orchestrate with the same request to
execute."

## Request

$ARGUMENTS
