---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero
context for the codebase. Document everything: which files to touch,
code, testing, docs. Bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

**Core principle:** The plan does all the thinking. Execution follows
it mechanically. A plan that requires judgment at execution time is an
incomplete plan.

**Hook enforcement:** Proctor's planning mode gate blocks Write and Edit
for implementation code while this skill is active. You can write the
plan document and read any file, but you cannot write production code.
This is mechanical — the gate does not ask, it denies. If you find
yourself wanting to "just scaffold a file to check," that impulse is
the gate working. Put the scaffold in the plan.

## When to Use

- After proctor:brainstorming produces an approved architectural design
- When a spec or requirements document is ready for breakdown
- Before any multi-step implementation work
- When your human partner says "plan this" or "break this down"

**Not for:** single-file bounded changes (those go through
proctor:brainstorming's bounded path directly).

## Process

### 1. Scope check

If the spec covers multiple independent subsystems, it should have been
broken into separate plans during proctor:brainstorming. Suggest breaking
if it wasn't. One plan per coherent unit of work.

### 2. Detect the plan directory

Never hardcode paths. Check for an existing plan directory:

```bash
PLAN_DIR=$(find . -maxdepth 2 -type d -name plans 2>/dev/null | head -1)
PLAN_DIR=${PLAN_DIR:-docs/plans}
mkdir -p "$PLAN_DIR"
```

Name the plan file: `$PLAN_DIR/YYYY-MM-DD-<feature-name>.md` using
today's date.

### 3. Map the file structure

Before defining tasks, map which files will be created or modified.
Design units with clear boundaries. Prefer smaller, focused files.

List every file the plan touches. Group by module or subsystem. Note
which files already exist and which are new.

### 4. Design tasks

Each task:
- Can be implemented and tested independently
- Has clear inputs and outputs
- Names the files it creates or modifies
- Includes exact test cases with expected output
- Ends with a commit point
- TDD: test steps come before implementation steps

Every step that runs a command has an `Expected:` line showing what
correct output looks like.

### 5. Define task interfaces

Between tasks, document what each produces and what the next consumes.
Interface mismatches are the #1 source of SDD fix rounds. Be explicit
about:
- Function signatures and return types
- File paths created
- Environment variables or config set
- Data shapes passed between components

### 6. Write global constraints

A section naming rules that bind every task: naming conventions, test
patterns, API shapes, error handling policy. These travel with every
dispatch in SDD and every task step in inline execution.

### 7. Write review focus

A section naming the input classes and failure modes the plan's tests do
NOT exercise. The final reviewer checks each deliberately. Be honest
about coverage gaps.

### 8. Execution handoff

At the end of the plan, present the choice:

- **Subagent-driven** (proctor:subagent-driven-development): fresh
  context per task + per-task review. Higher cost, higher assurance.
  Best for complex plans with many integration points.
- **Inline** (proctor:executing-plans): one context, one final review.
  Lower cost, faster. Best for well-specified plans with few cross-task
  dependencies.

## Cross-Skill References

- **proctor:brainstorming** — produces the approved design that feeds
  this skill; architectural path ends with "invoke proctor:writing-plans"
- **proctor:subagent-driven-development** — one execution mode; consumes
  the plan's tasks, global constraints, and review focus
- **proctor:executing-plans** — the other execution mode; same inputs
- **proctor:using-git-worktrees** — both execution modes start with
  workspace isolation

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "I'll figure out the details during implementation" | That is the plan's job. Implementation follows mechanically. |
| "This task is too small to plan" | Small tasks get small plans. The structure still applies. |
| "I'll just start coding and plan as I go" | The planning gate blocks code writes. Plan first. |
| "The interfaces are obvious" | Interface mismatches cause the most fix rounds. Write them down. |
| "Expected output is redundant" | Without Expected lines, the implementer cannot verify correctness. |
| "TDD ordering doesn't matter in the plan" | Test steps before implementation steps is the invariant. Always. |
| "I'll add the review focus section later" | Review focus written after implementation is rationalization, not planning. |

## Checklist

1. Verify scope is single-subsystem (suggest breaking if not)
2. Detect or create the plan directory
3. Map every file the plan creates or modifies
4. Write tasks — each independently testable, TDD-ordered, with
   Expected lines
5. Document task interfaces — what each produces, what the next consumes
6. Write global constraints section
7. Write review focus section (uncovered inputs and failure modes)
8. Present execution handoff choice (SDD vs. inline)
9. Self-review the plan for interface mismatches and missing Expected
   lines
