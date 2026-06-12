# orchestrator

Decompose a task into parallel subagent workstreams and dispatch them with the
native `Agent` tool. Explicit-invocation only — no auto-triggering.

## Commands

### /orchestrate [task]

Decompose into independent workstreams (max 5), confirm the plan as a short
list, dispatch each phase as parallel `Agent` calls in one message, synthesize
results and surface conflicts.

### /parallel [tasks...]

Launch the listed tasks as parallel `Agent` calls in one message. Optional
prefixes per task: `explore:` (read-only), `plan:` (design only). No prefix →
general-purpose.

```
/parallel "explore:find all API routes" "explore:check test coverage" "review auth flow"
```

### /plan-only [task]

Emit the decomposition without dispatching anything.

## Agent selection

- **Explore** — read-only codebase questions
- **Plan** — design and trade-off analysis; Plan agents do not edit files
- **general-purpose** — edits files, runs commands
- `isolation: worktree` when parallel agents mutate files

## License

MIT
