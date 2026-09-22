# What proves what

Every feature Proctor ships, and where it is proven. `make test` at the
repo root runs all of it; nothing here is a description of intent —
each line names tests that fail when the feature stops working.

Layers, in the order `make test` runs them:

| Layer | What it proves |
|-------|----------------|
| `claude plugin validate` | the manifest and hooks module load the way the engine's loader reads them |
| `tests/command-matching.test.mjs` | the pure helpers, over long tables of real command lines |
| `tests/feature-inventory.test.mjs` | a ratchet: every hook, gate, command, pattern set, helper and config key still exists |
| `tests/hook-runtime.test.mjs` | the hooks' control flow against a fake engine |
| `tests/skill-contract.test.mjs` | the skills against the hooks: what the skills teach is what the hooks read |
| `tests/engine/*.test.ts` | every feature through **the real engine** (`claude plugin test`), the host answered by `tests/engine/world.ts` |
| `tests/proctor-configured/` (repo root) | the same module with every `userConfig` option set away from its default, through the engine's real options pipeline |

## Hard gates

| Feature | Proven in |
|---------|-----------|
| Test evidence: missing, stale, failing, unproven (piped, `;`, `&`, backgrounded, timed out, interrupted) | `engine/gates.test.ts` › test evidence |
| The gate steps aside: no suite, `proctor: no tests`, inert prose; and does not for a runbook, a skill, a push, a merge, an unreadable `git status` | `engine/gates.test.ts` › the gate steps aside; `engine/gates-extra.test.ts` › what the change is |
| Branch protection: every destructive verb, a same-line switch, a push refspec onto a protected branch (`HEAD:main`, `:main`, `+x:refs/heads/…`, `--all`, `--mirror`), the remote's default branch, per-branch consent | `engine/gates.test.ts` › protected branches; `engine/gates-extra.test.ts` › protected branches, every way onto one; `engine/detection.test.ts` › the remote's default branch |
| Secret detection: 13 credential shapes, 5 non-secrets, `commit -am`, a pathspec commit, a line that writes and commits in one go, the untracked scan following the line's pathspec | `engine/gates.test.ts` › secrets; `engine/gates-extra.test.ts` › secrets, every shape |
| Planning mode: Write, Edit, NotebookEdit, every shell write in a line, design docs allowed, a design folder not exempting code | `engine/workflow.test.ts` › planning mode; `engine/surfaces.test.ts` › planning mode's edges |
| Step and time budgets: counted by all four tools, 80% and 100%, extend, reset | `engine/workflow.test.ts` › an SDD run; `engine/sdd-flow.test.ts` › budgets arrive when they are crossed |
| SDD merge gate: no merge while tasks are unmarked or a fix round is open | `engine/sdd-flow.test.ts` › finishing |
| Fix-round cap: no dispatch past the cap, from the ledger or the dispatch's own prompt | `engine/sdd-flow.test.ts` › the fix-round cap blocks dispatch past it |
| A heredoc hides its body, not the commands after it | `engine/gates-extra.test.ts` › a heredoc does not hide what follows it |
| A command named inside a quoted argument is not a command being run | `engine/gates-extra.test.ts` › a command named inside a quoted argument |

## The SDD run

| Feature | Proven in |
|---------|-----------|
| A run starts: the skill, a direct SKILL.md read, an announcement; and is not restarted by a later mention | `engine/sdd-flow.test.ts` › the run starts and sizes itself |
| Sized by the plan's `### Task N` headings, or the ledger header | same |
| Driven by the ledger through Write, Edit and the shell; each signal counted once however often the ledger is rewritten or repeated | `engine/sdd-flow.test.ts` › the ledger drives the run |
| Signals read in document order (a ruling above a completion belongs to the task above it) | same › the last task ends the run |
| Task completion, evidence, budget reset, scope changes, fix rounds, rulings, deferred minors | same; `engine/surfaces.test.ts` › turn-end parsing |
| Done-check and ruling aggregation: on the last completion, in the finishing skill's prompt, on a finishing answer, and at the merge gate | `engine/sdd-flow.test.ts` › finishing |
| Recovery after a restart, with a fresh task clock | `engine/workflow.test.ts` › a resumed run |
| Agent spawns counted against the session, the run and the task | `engine/sdd-flow.test.ts` › agent spawns are counted |

## What the model is told

| Feature | Proven in |
|---------|-----------|
| The `[PROCTOR]` status block on every prompt, after another plugin's context | `engine/delivery.test.ts`; `engine/surfaces.test.ts` › the status block |
| Turn-end notes arriving with the next prompt, once | `engine/delivery.test.ts` |
| Mid-turn notes on the tool result (task progress, budgets, scope) | `engine/sdd-flow.test.ts` |
| The compaction block: plan, tasks, budgets, rulings, deferred minors, DO NOT REDO, evidence, the last failure output | `engine/surfaces.test.ts` › the compaction block |
| Live state in every skill prompt | `engine/surfaces.test.ts` › what a skill's prompt carries |
| Tool descriptions naming the gates | `engine/workflow.test.ts` › what the model is told up front |
| Commit attribution, and no `[Tests: ✓]` for stale, failing or unproven evidence | `engine/surfaces.test.ts` › the commit line |
| The dashboard: every segment, and fitting its box in terminal cells at any width, on terminal and desktop | `engine/surfaces.test.ts` › the dashboard |

## Session, store and operators

| Feature | Proven in |
|---------|-----------|
| Test command detection: 24 markers, `package.json` (and its stub), learned per project | `engine/detection.test.ts` › the test command |
| Worktree, default branch, executable-doc markers, non-git repos | `engine/detection.test.ts` › the repository |
| A new session resets consent, quiet mode, planning mode, notes, evidence, trace | `engine/detection.test.ts` › a new session starts clean |
| Per-project scoping, the 12-project cap, corrupt and legacy records, the write queue under parallel calls | `engine/store.test.ts` |
| Every operator command and every branch of its report | `engine/commands.test.ts` |
| Watchdog, context pressure, model-selection note, quiet mode | `engine/surfaces.test.ts` › the watchdog and quiet mode |
| Every `userConfig` option, set away from its default | `tests/proctor-configured/engine/configured.test.ts` |
| The skills' ledger lines, commands and claims against the hooks | `tests/skill-contract.test.mjs` |

## Evidence the tests bite

Run against the previous release's `hooks/proctor.tsx`, 61 of these
tests fail and the rest pass — one failure per fixed defect, not a
wall of noise:

```bash
O=$(mktemp -d); cp -r plugins/proctor "$O/p"
git show HEAD~1:plugins/proctor/hooks/proctor.tsx > "$O/p/hooks/proctor.tsx"
claude plugin test "$O/p"
```

Four more defects were found by running a real model against the
working tree (`claude -p --plugin-dir plugins/proctor --settings
'{"enabledPlugins":{"proctor@nalyk-skills":false}}'`) in a throwaway
repo: a secret committed by a line that wrote the file, a heredoc
hiding the git command after it, an untracked scan that read files the
line never staged, and a ruling written with plain hyphens. Each has a
test above.
