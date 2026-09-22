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
- **SDD state persistence.** When subagent-driven-development or
  executing-plans loads, a run starts; the plan's `### Task N` headings
  size it and the ledger's lines (`Task N: complete`, `Task N: fix round
  M — approach: …`, `Ruling: …`, `minor (deferred): …`) drive it. State
  is persisted in the store and injected into your context after
  compaction. Look for the `[PROCTOR — SDD STATE]`
  block.
- **Progress dashboard.** During SDD, a status bar appears above the
  prompt showing completion percentage, task count, agent count, fix
  rounds, and elapsed time.
- **Fix-round cap.** The hooks track fix rounds, warn at the cap and
  deny any dispatch past it.
- **Planning mode gate.** When brainstorming or writing-plans is active,
  Write/Edit tool calls for implementation files are mechanically blocked.
  Design docs (.md) are allowed. Exit with an implementation skill or
  "proctor: approve design".
- **Step budget.** During SDD, each task has a configurable step budget
  (tool call limit). Bash, Write, Edit and NotebookEdit all spend from it
  and all check it. The dashboard shows usage percentage. Warning at 80%,
  forced adjudication at 100%.
- **Structured tracing.** All gate denials, skill invocations, SDD
  transitions, and agent spawns are logged to a ring buffer in $.store
  for observability.
- **Model selection nudge.** When spawning subagents without specifying a
  model, you are reminded that the session model may be unnecessarily
  expensive.
- **Ruling aggregation.** When the last task is marked complete, and in
  the finishing skill's prompt, all rulings and deferred minors are
  surfaced for inclusion in your final message.
- **Context pressure warning.** At high turn counts, you are reminded that
  SDD state survives compaction and the ledger should be current.
- **Secret detection gate.** `git commit` is hard-denied if the staged
  diff contains AWS keys, API tokens, GitHub/GitLab PATs, private keys,
  or hardcoded passwords. This is irreversible — credentials cannot be
  un-pushed.
- **Destructive command warning.** `rm -rf`, `chmod 777`, pipe-to-shell,
  `dd if=`, and `mkfs` commands trigger a soft warning showing the
  actual command so you can verify intent before proceeding.
- **Time budget.** During SDD, each task has a configurable wall-clock
  limit. Warning at 80% (once), wrap-up at 100% (once per task).
- **Diff size awareness.** Before a commit, a warning fires if >500
  lines are staged, suggesting smaller focused commits.
- **Test command hint.** If a test command has been detected but no tests
  have been run this session, a hint is injected with the exact command
  to run before the git gate blocks you.
- **Quiet mode.** Your human partner can say `proctor: quiet on` to
  suppress soft warnings (destructive cmd, large commit, watchdog,
  model selection, context pressure). Hard gates always enforce. Toggle
  back with `proctor: quiet off`.
- **Success signals.** After tests pass, you are told "git commit is
  unblocked". After tests fail, you are told exactly what's blocked.
- **SDD completion summary.** When an SDD session ends, you see task
  count, elapsed time, fix rounds, agents, rulings, and deferred items.
- **Failed approach tracking.** When fix rounds increment, the failed
  approach is captured. After compaction, a "DO NOT REDO" section lists
  every failed approach so you never retry what already failed.
- **Task completion evidence.** When a task completes, evidence is
  recorded and a "Next:" guidance message tells you what to do next.
- **SDD session recovery.** On session restart, if an active SDD state
  exists, it is detected and resumed automatically with a status message.
- **Pre-flight gate check.** Type `proctor: check` before attempting a
  commit to see which gates will pass and which will block, with
  specific remediation steps for each failing gate.
- **Self-diagnosis.** Type `proctor: diagnose` for actionable analysis
  of gate autonomy rate, fix round patterns, rationalization warnings,
  and skill usage recommendations.
- **SDD scope update.** Say `proctor: tasks N` to update the total task
  count when scope changes. Also auto-detects "Task N: added" patterns.
- **Autonomy metrics.** Gate passes are tracked alongside denials.
  `proctor: status` shows your autonomy rate (passes / total gate events),
  or `n/a` before any gate has fired.
- **Test failure context.** When tests are failing, the compaction block
  includes a summary of the failure output for faster diagnosis.
- **Phase lifecycle tracking.** Your current development phase (idle →
  brainstorming → planning → implementing → reviewing → finishing) is
  tracked automatically based on skill invocations. It survives
  compaction and is visible via `proctor: status`.
- **Quality metrics.** Cross-session counters track total commits, gate
  denials, fix rounds, and test runs. View with `proctor: status`.
- **Trace visibility.** Type `proctor: show trace` to see the last 25
  structured events with timestamps. Type `proctor: status` for a full
  dashboard (includes quiet mode state, autonomy rate).

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
- **Time budget per task** — wall-clock minutes per SDD task before
  forced adjudication (default: 30)
- **Executable doc patterns** — globs for prose-shaped files that are
  really behaviour; a glob without `/` matches at any depth (default:
  none)

The remote's default branch (`origin/HEAD`) is protected alongside the
configured list.

These are set per-user via the plugin configuration UI. You do not need
to manage them — the hooks read them automatically.

## User Instructions

User instructions (CLAUDE.md, AGENTS.md, direct requests) take precedence
over skills. Only skip skill workflows when your human partner has
explicitly told you to.
