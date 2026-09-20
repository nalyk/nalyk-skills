---
name: executing-plans
description: Use when executing an implementation plan yourself in the current session — your human partner chose inline execution, or no subagent tool is available
---

# Executing Plans

Execute the plan yourself, task by task. One fresh-context review of the
whole branch at the end.

**Why inline:** Costs one context (yours) plus one final reviewer.
Gives up fresh context per task and per-task review. This skill
compensates: the brief is the spec, the ledger is your memory, TDD is
the per-task gate, the final reviewer is the second pair of eyes.

**Hook enforcement:** Same as SDD — Proctor tracks task state, shows the
progress dashboard, enforces the git gate, and persists recovery state.
The `[PROCTOR — SDD STATE]` block appears after compaction.

**Core principle:** The plan already did the thinking. Execute it exactly,
prove each step with a test you watched fail and then pass, leave a record.

**Continuous execution.** Do not pause between tasks.

**Rulings, not stalls.** Record in ledger as
`Ruling: <what> — <why> — <cost if wrong>`.

## Setup

Use proctor:using-git-worktrees for isolation. Track progress in a
ledger file. After compaction, trust the ledger and `git log` over your
recollection.

Load proctor:test-driven-development before Task 1 — it governs every
step. Pre-flight scan the plan for inter-task conflicts.

## The Task Loop

### 1. Take the task

Read the brief for every task, including ones you remember from setup.
Mark the todo in_progress.

### 2. Work the steps

Follow the plan's steps under TDD. Every step with `Expected:` — run the
command, read output, compare. Three outcomes:

- **Matches:** Next step.
- **Code is wrong:** proctor:systematic-debugging.
- **Plan is wrong:** Rule, ledger it, continue.

### 3. Completion contract

Before the ledger line, all of these are true with evidence:
- Every test the brief names exists and ran
- The final test run passed
- Every `Expected:` line was compared against real output
- Every deviation has a `Ruling:` line

proctor:verification-before-completion governs the claim.

### 4. Complete the task

Append to ledger, mark todo complete, take the next task.

## Final Review

Dispatch on the most capable model using
proctor:requesting-code-review. Sort findings: Critical/Important enter
the fix pass. Minor goes to the ledger as deferred.

Fix Critical/Important yourself in ONE pass. Each fix verified by TDD.
No second fix wave.

## Finish

Collect all `Ruling:` lines and deferred minors into your final message.
Delete the workspace. Use proctor:finishing-a-development-branch.
