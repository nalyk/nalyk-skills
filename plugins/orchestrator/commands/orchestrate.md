---
description: Decompose a task, confirm the plan, dispatch parallel agents, synthesize
allowed-tools: Skill, Agent, Read, Glob, Grep, Bash, Edit, Write, TodoWrite
---

# /orchestrate

Load the orchestrator skill (`skills/orchestrator/SKILL.md`), then:

1. **Decompose** the request into independent workstreams (max 5).
2. **Confirm**: show the plan as one short list — `[N] <agent type> — <task>`,
   with phases if any — and wait for the user's go-ahead.
3. **Dispatch**: launch each phase's workstreams as parallel `Agent` calls in
   a single message. Use `subagent_type` Explore (read-only), Plan (design
   only — Plan agents do not edit files), or general-purpose (edits/commands).
   Use `isolation: worktree` if parallel agents mutate files. Pass a short
   summary of prior-phase results into dependent phases.
4. **Synthesize**: merge results, surface conflicts between workstreams, and
   report any failures with their errors.

## Request

$ARGUMENTS
