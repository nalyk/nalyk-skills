---
name: using-proctor
description: Use when starting any conversation — establishes skill discovery, enforcement hooks, and the rule that skills precede action
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, ignore this skill.
</SUBAGENT-STOP>

# Using Proctor

Proctor is a Claude Code plugin that combines development skills with
function hooks. Skills teach methodology. Hooks enforce compliance.
Store state survives compaction.

## What the Hooks Do (You Do Not Need to Manage These)

Proctor's hooks run automatically. You do not configure, invoke, or
reference them. What they enforce:

- **Git gate.** Commit and push are blocked without fresh passing test
  evidence. You cannot rationalize past this.
- **Branch protection.** Destructive git operations on main/master are
  blocked until your human partner grants explicit consent.
- **Skill watchdog.** If you work for several turns without invoking a
  skill, a reminder fires. It fires once.
- **SDD state persistence.** When running subagent-driven development or
  executing-plans, task state is persisted in the store and injected into
  your context after compaction. Look for the `[PROCTOR — SDD STATE]`
  block.
- **Progress dashboard.** During SDD, a status bar appears above the
  prompt showing completion percentage, task count, agent count, fix
  rounds, and elapsed time.
- **Fix-round cap.** The hooks track fix rounds and warn at the cap.
- **Planning mode gate.** When brainstorming or writing-plans is active,
  Write/Edit tool calls for implementation files are mechanically blocked.
  Design docs (.md) are allowed. Exit with an implementation skill or
  "proctor: approve design".
- **Step budget.** During SDD, each task has a configurable step budget
  (tool call limit). The dashboard shows usage percentage. Warning at 80%,
  forced adjudication at 100%.
- **Structured tracing.** All gate denials, skill invocations, SDD
  transitions, and agent spawns are logged to a ring buffer in $.store
  for observability.
- **Model selection nudge.** When spawning subagents without specifying a
  model, you are reminded that the session model may be unnecessarily
  expensive.
- **Ruling aggregation.** At session end, all rulings and deferred minors
  are surfaced for inclusion in your final message.
- **Context pressure warning.** At high turn counts, you are reminded that
  SDD state survives compaction and the ledger should be current.

## The Rule

**Invoke relevant skills BEFORE any response or action** — including
clarifying questions, exploring the codebase, or checking files.

Then announce "Using [skill] to [purpose]" and follow the skill. If it
has a checklist, create a todo per item.

## Skill Priority

Process skills come first — they set the approach. Implementation skills
carry it out.

- "Let's build X" → proctor:brainstorming first, then implementation.
- "Fix this bug" → proctor:systematic-debugging first, then fix.
- "Execute this plan" → proctor:subagent-driven-development or
  proctor:executing-plans, depending on context.

## Red Flags

These thoughts mean STOP — you are rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |

## Configuration

Proctor's enforcement thresholds are configurable via plugin settings:

- **Protected branches** — which branches are guarded (default:
  main, master, production, release)
- **Test freshness** — minutes before test evidence expires (default: 5)
- **Skill watchdog threshold** — turns without a skill before the
  reminder fires (default: 4)
- **Fix-round cap** — maximum fix attempts before forced adjudication
  (default: 5)
- **Step budget per task** — tool call limit per SDD task before forced
  adjudication (default: 100)

These are set per-user via the plugin configuration UI. You do not need
to manage them — the hooks read them automatically.

## User Instructions

User instructions (CLAUDE.md, AGENTS.md, direct requests) take precedence
over skills. Only skip skill workflows when your human partner has
explicitly told you to.
