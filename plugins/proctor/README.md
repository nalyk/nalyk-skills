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
| **Test evidence** | `git commit`, `git push` | Fresh passing test run in this session — unless the project has no test suite, the change is prose-only, or you said `proctor: no tests` |
| **Test freshness** | `git commit`, `git push` | Test run within 5 minutes (configurable) |
| **Test passing** | `git commit`, `git push` | Last test run exit code 0 |
| **Proven test status** | `git commit`, `git push` | The last test run finished in the foreground and its own exit status reached the result — not hidden by a following `\|`, `;`, `\|\|` or `&` (`set -o pipefail` / `set -e` count), not sent to the background, not moved there by the Bash timeout, not interrupted |
| **Branch protection** | `git commit/push/merge/rebase/reset` on a protected branch — including a line that switches onto one first (`git checkout main && git merge feat`), and a push that writes one from elsewhere (`git push origin HEAD:main`, `:main`, `--all`, `--mirror`). The remote's default branch (`origin/HEAD`) is protected alongside the configured list | Feature branch or explicit human consent |
| **SDD merge** | `git merge` while the SDD run has tasks unmarked or a fix round open | Finish and mark the tasks, or `proctor: sdd stop` |
| **Fix-round cap** | An Agent dispatch past the cap — a round the ledger recorded, or one the dispatch's prompt names for the current task | Adjudicate with `Ruling:` lines, complete the task, or `proctor: sdd stop` |
| **Step budget** | Bash, Write, Edit or NotebookEdit once an SDD task hits 100% of its step budget | Complete the task, `proctor: budget extend`, or `proctor: sdd stop` |
| **Time budget** | The same four tools once an SDD task hits 100% of its time budget | Same three exits |
| **Planning mode (Bash)** | Shell writes to implementation files during a design phase | A design doc, or exit planning mode |
| **Secret detection** | `git commit` with staged credentials | No AWS/OpenAI/GitHub/GitLab/Slack tokens, private keys, or password-shaped assignments (quoted or not) among the **added** lines — the commit that removes a leaked key is not the one to block |

### Soft Enforcers (context injection — the agent is reminded)

An SDD run works through the whole plan in one turn, so what happens
during it is reported on the result of the tool call that caused it:
task progress when a ledger line is written, budget warnings on the call
that crosses 80% or reaches 100%, model advice on the Agent result. A
note produced when a turn ends (the watchdog, context pressure, a
done-check from the answer) cannot reach the model then — a turn's
result carries nothing the model reads — so it arrives with the next
prompt.

Quiet mode (`proctor: quiet on`) suppresses the nudges: the watchdog,
model selection, context pressure, the destructive-command and diff-size
warnings, and the step-aside and run-complete lines. Notes that carry the
run's state — task progress, budgets, the fix-round cap, the done-check,
the ruling aggregation — still arrive, and hard gates always enforce.

| Enforcer | When it fires | What it says |
|----------|--------------|-------------|
| **Skill watchdog** | 4+ turns without invoking a skill | "Check if brainstorming, TDD, debugging, or review applies" (once) |
| **Model selection** | Agent spawn without explicit model during SDD | "Consider a cheaper model for mechanical tasks" |
| **Fix-round cap** | Round N of 5 reached | "Decide on each open finding — skip debatable ones, resolve critical ones" |
| **Escalation** | Round 4-5 (the last two of the cap) dispatched on the model the stuck implementer used | "Try a more capable model" |
| **Step budget** | 80% / 100% of tool call limit per task | Warning at 80% (once), wrap-up at 100% (once per task), on the tool result |
| **Time budget** | 80% / 100% of wall-clock limit per task | Warning at 80% (once), wrap-up at 100% (once per task) |
| **Context pressure** | Turn 50, 70, 90 | "Progress preserved automatically — focus on current task" |
| **Ruling aggregation** | The last task marked complete; the finishing skill loaded | Full list of rulings and deferred minors |
| **SDD done-check** | The finishing skill loaded, or an answer claiming the finish | Each unmet condition: tasks unmarked, fix round open, tests missing/failing/stale/unproven |
| **Destructive command** | `rm -rf`, `chmod 777`, `curl\|bash`, etc. | Shows the actual command — "verify this is intentional" |
| **Diff size** | >500 lines staged (pre-commit) | "Consider splitting into smaller commits" |
| **Test hint** | No tests run this session | Shows detected test command with actionable next step |
| **Phase indicator** | Skill invocation changes lifecycle phase | Shows current phase in context |
| **Task advance** | SDD task marked complete | "Next: Task N" with budget reset notification |

### Infrastructure (invisible — the agent doesn't manage these)

| Feature | What it does |
|---------|-------------|
| **SDD tracking** | A run starts when subagent-driven-development or executing-plans loads (or is announced); the plan's `### Task N` headings size it; the ledger (`progress.md`) drives it — `Plan: <path> — <N> tasks`, `Task N: complete`, `Task N: fix round M — approach: …`, `Ruling: …`, `minor (deferred): …`, `Task N: added`, read as they are written through Write, Edit or the shell, each counted once however often the ledger is rewritten |
| **SDD state persistence** | Task completion, fix rounds, rulings, failed approaches tracked in `$.store` |
| **Live status** | A `[PROCTOR]` block rides on every prompt as context the model reads: test verdict and age, planning mode, phase, SDD progress |
| **Compaction recovery** | `[PROCTOR — SDD STATE]` is one of the conversation's context blocks, which the engine re-reads at compaction — with its "DO NOT REDO" section and the last test run's failure output |
| **SDD session recovery** | Active SDD state detected and resumed on session restart |
| **Failed approach tracking** | Fix round descriptions captured and injected post-compaction to prevent retries |
| **Task completion evidence** | Completion evidence recorded per task for audit trail |
| **Progress dashboard** | Status bar above prompt during SDD |
| **Test run tracking** | Records every test execution for the git gate; a passing command is remembered for the project's next session |
| **Branch tracking** | Detects branch changes for protection enforcement |
| **Agent counting** | Tracks agents spawned for dashboard and diagnostics |
| **Commit attribution** | Appends task references and test evidence to commit messages |
| **Phase lifecycle** | Tracks idle → brainstorming → planning → implementing → reviewing → finishing |
| **Quality metrics** | Cross-session counters: commits, gate denials, gates passed, fix rounds, test runs, autonomy rate |
| **Ruling persistence** | Last 20 rulings preserved across sessions |

### Operator Commands

| Command | What it does |
|---------|-------------|
| `proctor: status` | Full status dashboard: phase, branch, quiet mode, SDD state, test evidence, quality metrics |
| `proctor: show trace` | Last 25 structured trace events with timestamps |
| `proctor: allow <branch>` | Grant consent for protected branch operations |
| `proctor: approve design` | Exit planning mode |
| `proctor: no tests` | Stand the test gate down for this session — for projects that genuinely have no suite |
| `proctor: budget extend` | Grant the current SDD task one more full step and time budget |
| `proctor: quiet on` | Suppress soft warnings (hard gates still enforce) |
| `proctor: quiet off` | Re-enable all warnings |
| `proctor: check` | Pre-flight gate status: test evidence, branch protection, planning mode, secret scan |
| `proctor: diagnose` | Self-analysis: gate autonomy rate, fix round patterns, recommendations |
| `proctor: tasks N` | Update SDD total task count (scope change) |
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
| `executableDocPatterns` | `[]` | Globs for prose-shaped files that are really behaviour, e.g. `runbooks/**`; a glob without `/` (`*.runbook.md`) matches at any depth |
| `testFreshnessMinutes` | `5` | How many minutes before test evidence expires |
| `watchdogTurnThreshold` | `4` | Turns without a skill before the watchdog fires |
| `fixRoundCap` | `5` | Maximum fix-loop rounds in SDD |
| `stepBudgetPerTask` | `100` | Tool call limit per SDD task (warn 80%, block 100%) |
| `timeBudgetPerTaskMinutes` | `30` | Wall-clock limit per SDD task in minutes (warn 80%, block 100%) |

### When the test gate stands down

A project with no test suite could otherwise never commit, so the gate
steps aside — visibly, with a line in the transcript — when:

- **no test marker file exists** anywhere in the repo (a docs, notes or
  config repo: there is no suite to run) — a `package.json` whose test
  script is missing or the `npm init` stub is not a marker, or
- **the change is inert prose only**, or
- you said **`proctor: no tests`** this session.

"The change" is whatever the operation actually sends: for a commit, the
working tree; for a push, the commits the upstream does not have. A push
is never excused by an unrelated edit sitting in the working tree, and
when there is no upstream to compare against the gate enforces rather
than guesses. A merge is never excused on prose grounds at all.

Every other gate keeps enforcing regardless: branch protection, secret
detection and planning mode are untouched by this.

"Inert prose" is narrower than "a .md file". These stay behaviour and
keep the gate enforcing:

| Kind | Examples |
|------|----------|
| Agent and tool instructions | `SKILL.md`, `CLAUDE.md`, `AGENTS.md`, anything under `.claude/`, `.cursor/`, `.github/` |
| Runbooks and playbooks | `RUNBOOK.md`, `runbooks/**`, `playbooks/**` |
| Anything a test reads | `tests/`, `spec/`, `fixtures/`, `testdata/`, `__snapshots__/`, `e2e/`, `golden/` |
| A plugin's own behaviour | `commands/`, `agents/`, `skills/`, `prompts/`, `references/`, `templates/` |
| Prose a toolchain executes | every `.md`/`.rst`/`.qmd` in a repo holding `book.toml`, `_quarto.yml`, `runme.yaml`, `mkdocs.yml`, `jupytext.toml` or a Docusaurus config |
| Whatever you declare | `executableDocPatterns` |

Quiet mode is toggled at runtime via `proctor: quiet on/off` — it
suppresses soft warnings while hard gates continue to enforce. This
is session-scoped and does not persist across sessions.

## Architecture

```
proctor/
├── .claude-plugin/plugin.json     # Plugin manifest
├── hooks/
│   ├── hooks.json                 # Module registration
│   └── proctor.tsx                # All hook registrations
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

`$.store` is one namespace shared by every session on the machine, so
session state, test evidence, the SDD run and the trace log are each
filed under the **project root** — the repo `git rev-parse
--show-toplevel` reports, not the cwd of the moment. A second session in
another repo no longer overwrites the first one's branch consents, quiet
mode or evidence, and `cd`-ing into a subdirectory does not make a
session's own test run look foreign. Two sessions in the *same* repo
still share one record: they share the branch and the consents that go
with it, so the sharing is the accurate reading.

Every write goes through a single per-key queue. Counters are the one
exception to "state is load-bearing": they are telemetry, they are
written best-effort, and a counter that cannot be written can never stop
a gate from firing.

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

## Testing

`make test` at the repo root runs four layers:

- `claude plugin validate` — the manifest and hooks module as the
  engine's loader reads them
- `tests/*.test.mjs` — the pure helpers, a feature ratchet, and the
  hooks against a small fake engine
- `tests/engine/*.test.ts` — `claude plugin test`: every feature driven
  through **the real engine**, with the host (git, files, store, the
  tools' own results) answered beneath the plugin by `tests/engine/world.ts`.
  The fake engine could only ever agree with Proctor's own reading of
  the API; this layer is where five delivery channels that never
  reached the model were found.
- `tests/skill-contract.test.mjs` — the skills against the hooks: every
  ledger line a skill teaches parses as the hooks read it, every command
  taught is answered, every mechanism a skill claims exists
- `tests/proctor-configured/` (repo root) — the same module loaded with
  every `userConfig` option set away from its default, through the
  engine's real options pipeline

`tests/COVERAGE.md` maps every feature to the tests that prove it.

An end-to-end check against a live model loads the working tree in
place of the installed copy:

```bash
claude -p --plugin-dir plugins/proctor \
  --settings '{"enabledPlugins":{"proctor@nalyk-skills":false}}' \
  --output-format stream-json --verbose "..."
```

## Status

Proctor requires the function hooks runtime, which is behind
`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` and has not officially shipped.
The runtime exists in Claude Code ≥ 2.1.260. Build against it to learn
the shape, not to run production on it until Anthropic ships the feature.

## License

MIT
