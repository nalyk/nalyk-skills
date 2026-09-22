---
name: dispatching-parallel-agents
description: Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies
---

# Dispatching Parallel Agents

## Overview

**Core principle:** Dispatch one agent per independent problem domain.
Let them work concurrently. Merge results only when all are done.

Parallel dispatch trades coordination complexity for wall-clock speed.
The trade is worth it only when tasks share no files, no interfaces, and
no ordering constraints. If two tasks touch the same module, they are
not independent — run them sequentially.

**Hook enforcement:** Proctor tracks agent spawns via the `agent.spawn`
hook. Each dispatch increments the agent counter visible in the SDD
dashboard. The hook records the model each agent uses — spawning without
an explicit model triggers a soft reminder about cost. During SDD every
spawn also spends one step of the current task's budget, and a dispatch
past the fix-round cap (counted from the ledger's
`Task N: fix round M` lines) is denied.

## When to Use

- Multiple unrelated failures (different test files, different subsystems)
- Independent tasks that don't share state or files
- Parallel investigations where each is self-contained
- Broad review or audit across disjoint modules

## When NOT to Use

- Tasks that share files or interfaces (use sequential dispatch)
- Tasks where one depends on another's output
- When coordination overhead exceeds parallelism benefit
- When fix-round cap is nearly exhausted — each parallel agent's fix
  rounds count against the same cap
- Inside an SDD task loop (SDD mandates sequential implementers per
  task — see proctor:subagent-driven-development)

## Max Parallelism

**Recommend 3-5 concurrent agents.** Beyond 5:

- Context-switch overhead for tracking reports grows nonlinearly
- Merge conflicts between "independent" agents increase — independence
  is a judgment call, and judgments degrade at scale
- Resource contention (file handles, test runners, build locks) causes
  flaky failures that look like bugs
- Recovery from a single failed agent cascades when you're already
  tracking 6+ others

Start with 3. Add more only when the first batch proves truly
independent.

## How to Dispatch

For each independent task:

1. **Craft isolated context.** The agent gets exactly what it needs —
   never your session's history. Include: the task description, relevant
   file paths, interfaces it must respect, and the report contract.

2. **Specify the model explicitly.** Mechanical tasks (grep, rename,
   isolated function) take a cheap model. Judgment tasks (debugging,
   architecture, review) take a capable one. Omitting the model inherits
   the session's — often the most expensive. Proctor warns on omission.

3. **Define the report contract.** Specify:
   - Report file path (unique per agent)
   - Expected status values: DONE, DONE_WITH_CONCERNS, BLOCKED,
     NEEDS_CONTEXT
   - What the agent writes on success (files changed, tests run, outcome)
   - What the agent writes on failure (error, hypothesis, files touched)

4. **Set boundaries.** The agent never dispatches its own subagents.
   State this explicitly in the dispatch instructions.

5. **Record the dispatch.** Note the agent identity from the dispatch
   result, the task it owns, and the model assigned.

## Coordination

- Record each agent's identity from the dispatch result immediately
- Track completion via reports, not polling
- When genuinely idle waiting for agents, use bounded waits:
  - Wait 3 minutes, then check for completed reports
  - If no reports, wait another 3 minutes
  - After 10 minutes with no progress from any agent, investigate:
    check agent status, read partial output, assess whether agents are
    stuck
- Between checks, reconcile: list live children, collect finished
  reports, update your tracking

## Error Handling

Agents fail. Plan for it.

### Agent Reports BLOCKED

1. Read the blocker description from the report
2. Assess: is the blocker a missing dependency from another agent?
   If yes, the tasks were not truly independent — switch to sequential
3. If the blocker is environmental (missing tool, permission, config):
   provide the missing context and re-dispatch
4. If the blocker is a design gap: rule on it, record the ruling, and
   re-dispatch with the ruling included

### Agent Reports NEEDS_CONTEXT

Provide the missing context and re-dispatch. If this happens repeatedly,
the task's context boundary was drawn too tightly — expand it.

### Agent Stops Responding

1. Check agent status via the dispatch system
2. If the agent crashed or timed out, do not re-dispatch blindly —
   read whatever partial output exists
3. Assess whether partial work is salvageable (check git diff in the
   agent's working area)
4. Re-dispatch with a fresh agent, providing the partial work as context
   so it doesn't repeat completed steps

### Multiple Agents Fail

If 2+ agents fail on unrelated tasks, suspect an environmental problem
(broken dependency, flaky infrastructure) before assuming each failure
is independent. Check the common factors first.

### Merge Conflicts After "Independent" Agents

Despite independence classification, agents sometimes touch overlapping
areas (shared imports, package files, lock files, test fixtures).

1. Collect all agents' results before merging any
2. Identify conflicts
3. Resolve in a single pass — don't merge one and then discover the
   conflict with the next
4. Run the full test suite after merging all results

## Cross-Skill References

- **proctor:subagent-driven-development** — SDD uses sequential dispatch
  within its task loop. Parallel dispatch is for the spaces between SDD
  tasks (e.g., investigating multiple unrelated failures before planning)
  or for non-SDD work. Never mix: SDD task-loop agents are sequential;
  parallel agents are for independent problems outside that loop.
- **proctor:verification-before-completion** — After merging parallel
  results, verify the combined outcome. Agent self-reports are
  insufficient — run the verification yourself.
- **proctor:systematic-debugging** — When dispatching parallel agents
  for debugging, each agent follows the four-phase debugging process
  independently. Collect root causes before attempting cross-cutting
  fixes.

## Red Flags — STOP

- Dispatching 6+ agents at once without proven independence
- Agents sharing files but classified as "independent"
- Re-dispatching a failed agent without reading its output
- Trusting agent success reports without independent verification
- Entering fix loops in parallel — fix rounds count against the SDD cap

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "They're mostly independent" | Mostly ≠ fully. Shared files mean sequential. |
| "More agents = faster" | Beyond 5, coordination overhead dominates. |
| "Agent said it's done" | Verify independently. Reports are claims, not evidence. |
| "I'll merge conflicts later" | Conflicts compound. Collect all results first, then merge once. |
| "Just re-dispatch the failed one" | Read the failure output first. Blind re-dispatch repeats the failure. |
| "Fix rounds are per-agent" | No. Fix rounds are per SDD cycle. Parallel fix agents burn the cap faster. |

## Checklist

1. Confirm tasks are truly independent (no shared files, no shared
   interfaces, no ordering dependencies)
2. Set max parallelism (3-5 agents)
3. Craft isolated context for each agent
4. Specify model explicitly for each agent
5. Define report contract (path, status values, content)
6. Set boundary: no sub-dispatching
7. Record each dispatch (agent ID, task, model)
8. Monitor with bounded waits (3-minute intervals, 10-minute
   investigation threshold)
9. Handle failures: read output before re-dispatching
10. Collect ALL results before merging any
11. Resolve merge conflicts in a single pass
12. Run full test suite after merge
13. Verify combined outcome independently (proctor:verification-before-completion)
