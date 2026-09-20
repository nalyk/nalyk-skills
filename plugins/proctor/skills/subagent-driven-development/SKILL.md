---
name: subagent-driven-development
description: Use when executing implementation plans with independent tasks in the current session
---

# Subagent-Driven Development

Execute plan by dispatching a fresh implementer subagent per task, a task
review after each, and a broad whole-branch review at the end.

**Why subagents:** Fresh context per task prevents context pollution.
Precisely crafted instructions ensure focus. Your own context stays clean
for coordination.

**Core principle:** Fresh subagent per task + task review (spec + quality)
+ broad final review = high quality, fast iteration.

**Hook enforcement:** Proctor tracks your SDD state automatically. The
progress dashboard above the prompt shows completion percentage, task
count, agent count, fix rounds, step budget usage, and elapsed time.
After compaction, the `[PROCTOR — SDD STATE]` block in your context
shows the recovery point — which tasks are complete, which is current,
and what rulings you made. The hooks enforce the fix-round cap, step
budget (warning at 80%, forced adjudication at 100%), and nudge model
selection. All transitions are traced to $.store for observability.

**Narration:** between tool calls, narrate at most one short line.

**Continuous execution:** Do not pause to check in with your human partner
between tasks. Execute all tasks from the plan without stopping.

**Rulings, not stalls.** Conflicts, ambiguities, plan defects — decide
them. Record every decision in the ledger as
`Ruling: <what you decided> — <why> — <cost if wrong>`, and keep going.

Four things stop you: irreversible/destructive operations;
security-sensitive actions; side effects outside this worktree; a plan so
broken that every path forward is a guess.

## Setup

Ensure work happens in an isolated workspace: use
proctor:using-git-worktrees.

Track progress in a ledger file (`progress.md` in the plan's workspace).
The ledger is your recovery map. After compaction, trust the ledger and
`git log` over your own recollection. Proctor's store also tracks state,
but the file ledger is the human-readable record.

Read the plan once, note its context and Global Constraints, create a
todo per task. If the plan names a Spec, read it — the spec is the
authority.

Before Task 1, scan the plan for conflicts. One row per pair of tasks
sharing a file or interface. Rule on each conflict, record in ledger.

## Model Selection

Use the least powerful model that can handle each role:

- **Mechanical tasks** (isolated functions, clear specs): cheap model
- **Integration tasks** (multi-file, pattern matching): standard model
- **Architecture and final review**: most capable model
- **Fix-loop rounds 4-5**: at least one tier above the stuck implementer

**Always specify the model explicitly.** Proctor warns when you don't —
an omitted model inherits the session's, often the most expensive.

## The Task Loop

### 1. Dispatch the implementer

Record BASE (`git rev-parse HEAD`) before dispatching.

- Compose the dispatch with: (1) one line on where this task fits;
  (2) the brief path as requirements; (3) interfaces from earlier tasks;
  (4) your resolution of any ambiguity; (5) the report-file path.
- The implementer never dispatches subagents — not helpers, not reviewers.
- Never dispatch multiple implementers in parallel.

### 2. Handle the report

- **DONE:** Generate review package, dispatch task reviewer.
- **DONE_WITH_CONCERNS:** Read concerns. If correctness/scope, address
  before review. If observations, note and proceed.
- **NEEDS_CONTEXT:** Provide missing context and re-dispatch.
- **BLOCKED:** Assess the blocker. Provide context, escalate model, break
  into smaller pieces, or rule on plan correction.

### 3. Review the task

Per-task reviews are task-scoped gates. Never skip the review.
The reviewer gets: the brief path, the report-file path, the review
package path, and the global constraints.

### 4. The fix loop

Triggers when review reports spec failure, Critical or Important findings.

- **Minor findings:** Record in ledger as deferred. Never enter the loop.
- **Plan-mandated conflicts:** Rule against the spec, ledger the ruling.

Five rounds maximum:

- **Rounds 1-3:** Resume the original implementer with open findings.
- **Rounds 4-5:** Fresh implementer on a more capable model. Proctor's
  hooks enforce this escalation.

Every round: implementer fixes → re-runs covering tests → scoped
re-review.

**The breaker (Proctor enforces the cap):** When round 5's re-review
still has open findings, adjudicate each:
- Contestable → park with ruling
- Real but not load-bearing → park with ruling
- Real and load-bearing → rule on smallest unblocking change

### 5. Complete the task

Append to ledger:
`Task <N>: complete (commits <base7>..<head7>, review clean)`

Mark todo complete. Move on.

## Final Review

Dispatch on the most capable model. Point it at ledger's deferred-minor
and parked lines. If findings remain after ONE fix pass, adjudicate
residuals. There is no second fix wave.

## Finish

Collect every `Ruling:` line into your final message under "Rulings I
made." Collect every deferred minor. Proctor's hooks aggregate these
automatically — the `context` injection at session end lists them all.
Verify the list is exhaustive.

Delete the plan's workspace. Use proctor:finishing-a-development-branch.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Close enough on spec" | Reviewer found gaps = not done. Fix or adjudicate at the cap. |
| "I'll fix it myself" | Controller fixes pollute context and skip review. |
| "One more round will converge" | Past the cap, rounds don't converge. Adjudicate. |
| "This finding is obviously wrong" | Adjudicate only at the cap. Every ruling is a ledger entry. |
| "The fix was small, skip re-review" | Unreviewed fixes cause regressions. Every round ends with re-review. |
| "Ledger bookkeeping is overhead" | The ledger survives compaction. So does Proctor's store. Both are essential. |
