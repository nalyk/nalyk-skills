---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

Write comprehensive implementation plans assuming the engineer has zero
context for the codebase. Document everything: which files to touch,
code, testing, docs. Bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

**Save plans to:** `docs/plans/YYYY-MM-DD-<feature-name>.md`

## Scope Check

If the spec covers multiple independent subsystems, it should have been
broken into separate plans during brainstorming. Suggest breaking if it
wasn't.

## File Structure

Before defining tasks, map which files will be created or modified.
Design units with clear boundaries. Prefer smaller, focused files.

## Task Design

Each task:
- Can be implemented and tested independently
- Has clear inputs and outputs
- Names the files it creates or modifies
- Includes exact test cases with expected output
- Ends with a commit point
- TDD: test steps come before implementation steps

Every step that runs a command has an `Expected:` line showing what
correct output looks like.

## Task Interfaces

Between tasks, document what each produces and what the next consumes.
Interface mismatches are the #1 source of SDD fix rounds.

## Global Constraints

A section naming rules that bind every task: naming conventions, test
patterns, API shapes, error handling policy.

## Review Focus

A section naming the input classes and failure modes the plan's tests do
NOT exercise. The final reviewer checks each deliberately.

## Execution Handoff

At the end, present the choice:
- **Subagent-driven** (proctor:subagent-driven-development): fresh context
  per task + per-task review. Higher cost, higher assurance.
- **Inline** (proctor:executing-plans): one context, one final review.
  Lower cost, faster. Best for well-specified plans.
