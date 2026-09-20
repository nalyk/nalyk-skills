---
name: dispatching-parallel-agents
description: Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies
---

# Dispatching Parallel Agents

Delegate independent tasks to specialized agents with isolated context.

**Core principle:** Dispatch one agent per independent problem domain.
Let them work concurrently.

## When to Use

- Multiple unrelated failures (different test files, different subsystems)
- Independent tasks that don't share state
- Parallel investigations where each is self-contained

## When NOT to Use

- Tasks that share files or interfaces (use sequential dispatch)
- Tasks where one depends on another's output
- When coordination overhead exceeds parallelism benefit

## How to Dispatch

For each independent task:

1. **Craft isolated context.** The agent gets exactly what it needs —
   never your session's history.
2. **Specify the model.** Mechanical tasks take a cheap model; judgment
   tasks take a capable one.
3. **Define the report contract.** What the agent writes, where, and
   what status it returns.
4. **Set boundaries.** The agent never dispatches its own subagents.

## Coordination

- Record each agent's identity from the dispatch result
- Track completion via reports, not polling
- When genuinely idle, wait in bounded stretches (5-10 minutes)
- Between stretches, reconcile: list live children, chase finished ones

## After Completion

Merge results. If agents touched overlapping areas despite independence
classification, resolve conflicts before proceeding.
