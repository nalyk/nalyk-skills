# Proctor

**Hook-enforced development discipline for Claude Code.**

Skills teach methodology. Hooks enforce compliance. Store survives compaction.

## What Problem This Solves

Agent development plugins today rely on prose instructions the LLM reads
and decides to follow. This works 80-90% of the time. It fails exactly
when it matters most — under context pressure, after compaction, in long
sessions, when the LLM rationalizes past the rules.

Proctor is the first development discipline plugin where critical rules
are enforced by code, not compliance. The skills teach *why*. The hooks
enforce *when*. The store guarantees *what survives*.

## Requirements

- Claude Code CLI ≥ 2.1.260
- Function hooks enabled: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`
- A git repository (for git gates and branch protection)

## Installation

### Option 1: Marketplace (recommended)

From inside Claude Code:

```
/plugin marketplace add nalyk/nalyk-skills
/plugin install proctor@nalyk-skills
```

Or from the terminal:

```bash
claude plugin marketplace add nalyk/nalyk-skills
claude plugin install proctor@nalyk-skills
```

### Option 2: Project-scoped (shared with your team)

```bash
claude plugin install proctor@nalyk-skills --scope project
```

This writes to `.claude/settings.json` which you commit to version
control. Teammates get Proctor when they trust the project folder.

### Option 3: Team settings (auto-install for all team members)

Add to your project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "nalyk-skills": {
      "source": {
        "source": "github",
        "repo": "nalyk/nalyk-skills"
      }
    }
  }
}
```

### Option 4: Local development

```bash
git clone https://github.com/nalyk/nalyk-skills.git
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir ./nalyk-skills/plugins/proctor
```

### Enable function hooks

Proctor's enforcement layer requires the function hooks runtime.
Set the environment variable before launching:

```bash
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

Or export it in your shell profile:

```bash
echo 'export CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1' >> ~/.bashrc
```

Without the flag, the skills still load and work as prose guidance
(like any other skills plugin), but the hooks — git gates, branch
protection, SDD dashboard, state persistence — do not fire.

## What the Hooks Enforce

### Hard Gates (deny — the agent cannot proceed)

| Gate | What it blocks | What it requires |
|------|---------------|-----------------|
| **Test evidence** | `git commit`, `git push` | Fresh passing test run in this session |
| **Test freshness** | `git commit`, `git push` | Test run within 5 minutes (configurable) |
| **Test passing** | `git commit`, `git push` | Last test run exit code 0 |
| **Branch protection** | `git commit/push/merge/rebase/reset` on main/master | Feature branch or explicit human consent |
| **Secret detection** | `git commit` with staged credentials | No AWS keys, API tokens, private keys, or hardcoded passwords in diff |

### Soft Enforcers (context injection — the agent is reminded)

| Enforcer | When it fires | What it says |
|----------|--------------|-------------|
| **Skill watchdog** | 4+ turns without invoking a skill | "If a skill applies, invoke it now" (once) |
| **Model selection** | Agent spawn without explicit model during SDD | "Session model may be unnecessarily expensive" |
| **Fix-round cap** | Round N of 5 reached | "Adjudicate — do not dispatch another round" |
| **Step budget** | 80% / 100% of tool call limit per task | Warning at 80%, forced adjudication at 100% |
| **Time budget** | 80% / 100% of wall-clock limit per task | Warning at 80%, forced adjudication at 100% |
| **Context pressure** | Turn 60, 80 | "SDD state survives compaction — verify ledger" |
| **Ruling aggregation** | Session completion detected | Full list of rulings and deferred minors |
| **Destructive command** | `rm -rf`, `chmod 777`, `curl\|bash`, etc. | "Verify this is intentional" |
| **Diff size** | Commit exceeds 500 lines changed | "Consider breaking into smaller commits" |
| **Test hint** | No tests run this session | Injects detected test command |
| **Phase indicator** | Skill invocation changes lifecycle phase | Shows current phase in context |

### Infrastructure (invisible — the agent doesn't manage these)

| Feature | What it does |
|---------|-------------|
| **SDD state persistence** | Task completion, fix rounds, rulings tracked in `$.store` |
| **Compaction recovery** | `[PROCTOR — SDD STATE]` block injected into context post-compaction |
| **Progress dashboard** | Status bar above prompt during SDD |
| **Test run tracking** | Records every test execution for the git gate |
| **Branch tracking** | Detects branch changes for protection enforcement |
| **Agent counting** | Tracks agents spawned for dashboard and diagnostics |
| **Commit attribution** | Appends task references and test evidence to commit messages |
| **Phase lifecycle** | Tracks idle → brainstorming → planning → implementing → reviewing → finishing |
| **Quality metrics** | Cross-session counters: commits, gate denials, fix rounds, test runs |
| **Ruling persistence** | Last 20 rulings preserved across sessions |

### Operator Commands

| Command | What it does |
|---------|-------------|
| `proctor: status` | Full status dashboard: phase, branch, SDD state, test evidence, quality metrics |
| `proctor: show trace` | Last 25 structured trace events with timestamps |
| `proctor: allow <branch>` | Grant consent for protected branch operations |
| `proctor: approve design` | Exit planning mode |
| `sdd done` / `proctor: sdd stop` | Deactivate SDD session |

## Skills

Proctor includes 14 development skills. Each is a methodology document
the agent reads and follows. The hooks enforce the critical gates that
skills alone cannot guarantee.

| Skill | Purpose |
|-------|---------|
| `using-proctor` | Bootstrap — establishes skill discovery and hook awareness |
| `brainstorming` | Turn ideas into designs (spike/bounded/architectural paths) |
| `test-driven-development` | Red-green-refactor cycle. Git gate blocks commits without tests |
| `systematic-debugging` | Root cause before fixes. Four-phase investigation |
| `verification-before-completion` | Evidence before claims. Git gate enforces mechanically |
| `subagent-driven-development` | Execute plans with fresh agents per task. Dashboard + state persistence |
| `executing-plans` | Execute plans inline (cheaper). Same enforcement as SDD |
| `writing-plans` | Create implementation plans from specs |
| `requesting-code-review` | Dispatch reviewers with proper packages |
| `receiving-code-review` | Evaluate feedback technically, not performatively |
| `finishing-a-development-branch` | Verify → present options → execute → clean up |
| `using-git-worktrees` | Workspace isolation. Branch protection hooks enforce |
| `dispatching-parallel-agents` | Independent concurrent tasks |
| `writing-skills` | TDD applied to skill creation |

## Configuration

Plugin options (via `plugin.json` `userConfig`):

| Option | Default | Description |
|--------|---------|-------------|
| `protectedBranches` | `["main","master","production","release"]` | Branches protected from destructive git ops |
| `testFreshnessMinutes` | `5` | How many minutes before test evidence expires |
| `watchdogTurnThreshold` | `4` | Turns without a skill before the watchdog fires |
| `fixRoundCap` | `5` | Maximum fix-loop rounds in SDD |
| `stepBudgetPerTask` | `100` | Tool call limit per SDD task (warn 80%, block 100%) |
| `timeBudgetPerTaskMinutes` | `30` | Wall-clock limit per SDD task in minutes (warn 80%, block 100%) |

## Architecture

```
proctor/
├── .claude-plugin/plugin.json     # Plugin manifest
├── hooks/
│   ├── hooks.json                 # Module registration
│   └── proctor.ts                 # All hook registrations
├── skills/                        # 14 methodology skills
│   ├── using-proctor/
│   ├── brainstorming/
│   ├── test-driven-development/
│   ├── systematic-debugging/
│   ├── verification-before-completion/
│   ├── subagent-driven-development/
│   ├── executing-plans/
│   ├── writing-plans/
│   ├── requesting-code-review/
│   ├── receiving-code-review/
│   ├── finishing-a-development-branch/
│   ├── using-git-worktrees/
│   ├── dispatching-parallel-agents/
│   └── writing-skills/
├── README.md
└── package.json
```

### The Three Layers

**Teaching layer (skills):** Prose documents that explain methodology.
Rationalization tables, core principles, checklists. The agent reads
these and follows them. This is what existing plugins do.

**Enforcement layer (hooks):** TypeScript middleware that fires on engine
events. Hard gates deny operations that violate rules. Soft enforcers
inject reminders when patterns suggest non-compliance. This is what only
function hooks can do.

**Infrastructure layer (store):** Persistent state that survives
compaction. Task progress, test evidence, rulings, fix-round counts.
Injected into context automatically so the agent never forgets where it
is.

### Why Each Layer Exists

The teaching layer handles **nuance** — when to use TDD, how to classify
a task as spike vs architectural, what makes a good ruling. Hooks cannot
express this.

The enforcement layer handles **compliance** — did you run tests before
committing, are you on a protected branch, have you invoked a skill.
Prose cannot guarantee this.

The infrastructure layer handles **memory** — what tasks are complete,
what rulings were made, when was the last test run. Neither prose nor
hooks alone can persist state across compaction.

## How It Differs From Superpowers

Proctor is inspired by [Superpowers](https://github.com/obra/superpowers)
and shares its philosophy. Source: [nalyk/proctor](https://github.com/nalyk/proctor).

The shared philosophy: TDD, systematic debugging, verification before
completion, subagent-driven development with ledger-based recovery.

The differences:

| Aspect | Superpowers | Proctor |
|--------|------------|---------|
| **Platform** | 9+ harnesses (universal) | Claude Code CLI only |
| **Enforcement** | Prose instructions | Function hooks (hard gates + soft nudges) |
| **State** | Ledger files (agent-managed) | `$.store` + ledger files (hook-managed + agent-managed) |
| **Compaction recovery** | Agent must read ledger | Hook injects state into context automatically |
| **Verification** | Prose rule | Git gate (mechanical denial) |
| **Branch protection** | Prose rule | Hook gate (mechanical denial) |
| **Progress visibility** | Post-hoc (diagnosing-superpowers) | Real-time dashboard |
| **Skill invocation** | Bootstrap re-reading | Hook watchdog |
| **Fix-round tracking** | Agent counting | Hook state machine |
| **Ruling aggregation** | Agent scanning ledger | Hook aggregation at session end |

Superpowers is the right choice for Codex, Cursor, Gemini CLI, and other
harnesses where function hooks are not available. Proctor is for Claude
Code CLI sessions where mechanical enforcement matters.

## Status

Proctor requires the function hooks runtime, which is behind
`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` and has not officially shipped.
The runtime exists in Claude Code ≥ 2.1.260. Build against it to learn
the shape, not to run production on it until Anthropic ships the feature.

## License

MIT
