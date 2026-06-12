---
description: Run Jobs (design), Carlin (BS), and Vibe (engineering) audits in parallel subagents, then synthesize findings via the cross-framework matrix.
argument-hint: [target] [--jobs] [--carlin] [--vibe] or [--all]
allowed-tools: Task, Read, Glob, Grep, Bash
---

# Multi-Framework Audit

**TARGET:** $ARGUMENTS

## AUDIT SELECTION

Parse flags: `--jobs`, `--carlin`, `--vibe`, `--all`. No flags = run all three.

## EXECUTION

### Step 1: Launch parallel subagents

For each selected audit, launch one subagent via the Task tool with this prompt (substitute the command file and target):

```
Read ${CLAUDE_PLUGIN_ROOT}/commands/<jobs|carlin|vibe>-audit.md and execute that audit exactly as written, with the audit subject set to: [TARGET]. Return the full audit output.
```

The command files are the single source of truth — do not paraphrase or summarize their instructions into the subagent prompt.

### Step 2: Synthesize

After all subagents complete, Read `${CLAUDE_PLUGIN_ROOT}/references/synthesis-matrix.md` and apply its escalation rules, contradiction resolutions, and output template to the combined results.

## OUTPUT

1. Key findings summary per framework (including each framework's "N/M applicable items assessed" line)
2. Cross-reference table with CRITICAL/HIGH/MEDIUM priorities (per synthesis matrix)
3. Unified action plan, prioritized
4. Contradictions requiring human judgment
5. Meta-insight: what the combined lenses reveal that no single lens would
