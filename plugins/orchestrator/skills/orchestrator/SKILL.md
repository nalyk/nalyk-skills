---
name: orchestrator
description: >-
  Decompose a task into parallel subagent workstreams.
  Use only via /orchestrate, /parallel, /plan-only.
---

# Orchestrator

Split a task into independent workstreams, dispatch them as parallel Agent
calls, synthesize the results.

## Decomposition

- A workstream is independent if it needs no output from, and writes no files
  touched by, any other workstream.
- Split on natural seams: distinct deliverables, distinct directories,
  read-vs-write.
- Dependent steps go in a later phase, not a bigger prompt.
- Keep it to at most 5 workstreams; merge trivial ones.

## Dispatch

**Send all independent Agent calls in ONE message** — that is what makes them
run in parallel. Sequential phases wait for the prior phase, then dispatch the
next batch (again, one message per batch), passing forward a short summary of
prior results.

Agent selection:

- `subagent_type: Explore` — read-only codebase questions; fast, cheap.
- `subagent_type: Plan` — design and trade-off analysis. Plan agents design;
  they do not edit files.
- `subagent_type: general-purpose` — anything that edits files or runs commands.
- `run_in_background: true` — long workstreams you want to keep working past.
- `isolation: worktree` — when two or more parallel agents mutate files.

## Synthesis

Merge the results into one answer: list what each workstream produced, surface
conflicts or contradictions between workstreams explicitly, and report failed
workstreams with their errors instead of papering over them.
