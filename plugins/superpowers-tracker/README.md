# superpowers-tracker

A live tracker for [obra/superpowers](https://github.com/obra/superpowers) inside Claude Code. It shows a stage rail in the band above the prompt and a dashboard pane, toasts when work lands, and offers to resume unfinished plans. Optional modes add nudges and guards.

It is an observer first. In the default mode it never blocks, rewrites or delays anything. It never writes inside superpowers' own folders (`.superpowers/sdd/`, `.superpowers/brainstorm/`, `docs/superpowers/`, the plugin install). It makes no network calls and sends no telemetry.

Built against **superpowers 6.4.2** (commit `8ca22db`). Every superpowers format the tracker depends on lives in `hooks/patterns.ts`, so a new superpowers release means editing that one file.

## Install

From the [nalyk-skills](https://github.com/nalyk/nalyk-skills) marketplace, at user scope. It loads in every project and stays dormant wherever superpowers isn't used.

```bash
/plugin marketplace add nalyk/nalyk-skills
/plugin install superpowers-tracker@nalyk-skills --scope user
```

**Requirements:** Claude Code with mods (function hooks), built and tested on 2.1.289. superpowers itself is optional: without it the tracker loads quietly and shows nothing.

To try a working copy without installing, load the folder for one session:

```bash
claude --plugin-dir plugins/superpowers-tracker
```

## It fires on its own

You never need to type `/sp` for it to come alive.

| State | When | What you see |
|---|---|---|
| dormant | No superpowers anywhere | Nothing. No timers, no scan beyond one stat. |
| armed | superpowers is installed, or its bootstrap is in context | `▐ϟ superpowers▌ 6.4.2 · ready`, muted, no motion (hidden under `band compact`) |
| resumable | The startup scan found earlier or still-running work | The resume capsule, a toast, and a ghost-text prompt suggestion |
| live | The first superpowers signal: a skill, an SDD script, a write to `docs/superpowers/`, a superpowers-shaped subagent | The full rail, with a pulse |
| shipped | Every task is done and the final review is clean | A spark, then a gold `✓ shipped` capsule for 30 s |

The startup scan runs on every session start, after `/clear`, `--continue` and `--resume`. It never delays the session. It looks in this checkout and in every git worktree (`git worktree list`), and finds:
- SDD and inline plans in progress (`.superpowers/sdd/*/progress.md` against the plan's tasks), including orphaned workspaces whose plan no longer exists;
- plans written but never executed, and specs with no plan (14-day window, dated by the file name or the commit that added it);
- a visual companion still running (its pid is checked; a dead one is marked stale);
- a ledger that is still moving: `◐ live in another session (likely)`. The tracker follows it read-only and never acts on it;
- the tracker's own snapshots, the "left off at" record, and the last session here that used superpowers.

Results are cached in the plugin store, keyed by repo root and file mtimes.

## The band

```
▐ϟ superpowers▌  ARCH  ● Brainstorm ━━━ ● Spec ━━━ ● Plan ━━━ ◆  Execute  ▕█████▋   ▏ 5/9  ○ Review ╌╌╌ ○ Finish ╌╌╌   ⚖ 2   ⌁ 1   ⚠ 1
⠹ implementer ◈ sonnet · Task 6 · Idempotency keys  ●●○○○  1m12s  ✗ ● RED→GREEN ✓                                         ▂▂▃▃▄▅
```

Resumable:

```
▐ϟ resumable▌ Retry Policy · ▕███▍      ▏ 1/3 · Task 2 at fix 2/5 · 3h ago  ⚖ 1                      r: resume  o: open  x: dismiss
```

A critical warning replaces row 2 with a red, round-bordered strip, `[a] ack  [o] open`. It stays until it is acknowledged.

Width tiers:

| Columns | Band |
|---|---|
| under 50 | `ϟ E ▕█████▍ ▏ 5/9 ⚠1` |
| 50–89 | Initials (`B S P E R F`), with the current stage spelled out |
| 90–139 | Everything |
| 140 and up | Also the plan title |

Motion is purposeful only:
- a shimmer on the current segment while a turn runs (≤ 12 fps);
- a pulse when a node lands;
- a 400 ms ease on the progress bar;
- a spinner per running subagent.

`/sp config motion off`, `NO_COLOR` or an ANSI theme stops all of it. An idle band runs no timer.

## The pane (`/sp`)

Seven tabs, switched with `1`–`7`, or `n` and `p`:

```
╭─────────────────────────────────────────────────────────────────────╮
│  ϟ superpowers  execute › 2026-10-05-retry-policy …  OBSERVE   6.4.2 │
│  1: Flow   2 Plan   3: Agents  4: Ledger  5: Tests  6: Workspace  7  │
│  T A S K S                                            Retry Policy  │
│  ●  #1 Backoff calculator       ████████████                        │
│  ◐  #2 Retry policy             ··········   ●●○○○                  │
│  ○  #3 HTTP wrapper             ············                        │
│  k: up  j: down  v: expand  n: next tab  p: prev tab  e: export  q   │
╰─────────────────────────────────────────────────────────────────────╯
```

1. **Flow**: a subway map. Skills sit on `┃`, subagents fork `├━━◐` and rejoin `╰━━●`, and compactions break the line with `┊`. `v` opens the selected station.
2. **Plan**: one row per task (status, steps bar, fix pips, commits, duration) and a detail card. Below it, a Gantt strip drawn as a Raster: build `█`, review `█`, fix rounds `▒`, now `│`.
3. **Agents**: swimlanes on the session's time axis, then a table with running rows first. Hover a row to see its full description.
4. **Ledger**: rulings as cards (decision, why, cost if wrong), parked findings, deferred minors, the pre-flight table.
5. **Tests**: each task's chain of red and green dots, a `RED→GREEN ✓` or `⚠ impl first` badge, and the debugging meter.
6. **Workspace**: an environment grid, a braille context gauge, links, every resume candidate with its actions, and the last session id with `claude --resume <id>`.
7. **Warnings**: cards by severity, with `ack` and `open evidence`.

Every tab has a designed empty state, a loading skeleton, and a "couldn't parse … showing last good read" card.

On the desktop app, the rail and the Flow map draw as interactive SVG, with gradients, a SMIL shimmer and tooltips. VS Code and mobile get the Box/Text version.

## Modes

| Mode | Effect |
|---|---|
| `observe` (default) | Records and displays only. Never denies, rewrites or injects. |
| `assist` | Adds a ≤ 3-line ledger note to the model's context. It is added to the next prompt after a compaction, to the first prompt after resuming a plan mid-execution, and to the result of an Agent call that re-dispatches a completed task. The note quotes the ledger and never guesses. |
| `strict` | Assist, plus denials that name the evidence: an implementer for a task the ledger marks complete; a second implementer while one runs; an SDD subagent with no model; a main-loop source write while brainstorming is on the bounded or architectural path without approval. It never blocks reads, tests, git or docs, and never denies because of a session it only inferred. The band shows `STRICT`. |

## Warnings

- **Critical**: a completed task re-dispatched.
- **Warn**:
  - code before approval;
  - implementation dispatched on main or master with no worktree;
  - an SDD subagent with no model;
  - parallel implementers;
  - a subagent spawned by an implementer or a reviewer;
  - the fix loop past round 5;
  - the controller editing code during SDD;
  - the bootstrap missing after a compaction;
  - 3+ failed fixes while debugging;
  - rulings lost when the workspace was deleted.
- **Info**: a success claim with no verification in the same turn; performative agreement; production code before a test.

## Commands

| Command | |
|---|---|
| `/sp [1-7]` | Open the pane (on a tab) |
| `/sp status` | Stage, tasks, warnings, rulings, minors |
| `/sp ledger` | Rulings I made, parked findings, deferred minors (ready to paste) |
| `/sp export` | Markdown report to `.superpowers/tracker/<session>.md` (self-ignoring folder) |
| `/sp ack [id\|all]` | Acknowledge warnings |
| `/sp mode observe\|assist\|strict` | See Modes |
| `/sp band auto\|always\|compact\|off` | `off` moves a one-line summary to the status line |
| `/sp config [key [value]]` | Show or change settings |
| `/sp reset` | Clear this session's tracker state; settings stay |
| `/sp resume [n]` | Fill the prompt box with candidate n's resume text. You press Enter. |
| `/sp dismiss [n] [--forget]` | Hide a candidate for this session, or for good. It returns if its ledger changes. |
| `/sp scan` | Rerun the startup scan |
| `/sp demo` | A scripted 60-second run through every state |
| `/sp theme` | Token swatches with contrast ratios; preview dark, light, daltonized, ANSI |
| `/sp diagnose` | The phrase that triggers diagnosing-superpowers, and the session id; offers to send it |

## Settings (`/sp config`)

| Key | Default |
|---|---|
| `motion` | `on` |
| `theme` | `auto` (follows Claude Code's theme and `NO_COLOR`), `dark`, `light`, `daltonized`, `ansi` |
| `toasts` | `on`. Toasts within 1 s fold into one. |
| `testRunners` | npm, pnpm, yarn and bun test; vitest, jest, pytest, go test, cargo test, rspec, mix test, dotnet test, phpunit, task-done |
| `testFiles` | `test/`, `*.test.*`, `*_test.*`, `test_*.py`, … |
| `specDir`, `planDir` | `docs/superpowers/specs`, `docs/superpowers/plans` |
| `pollMs` | `2000`. The ledger is polled only while this session executes a plan, or follows another session's. |
| `windowDays` | `14` |
| `autoOpenPane` | `never`, `resumable`, `live` |
| `mode`, `band` | See above |

Settings persist in the plugin store. Session data lives in `$.state` and survives hot reloads.

## Design: "Arc"

Each stage owns a hue, from ideas (violet) to shipped (gold): brainstorm `#B48CFF`, spec `#7AA2FF`, plan `#5CC8FF`, execute `#3DDBB5`, review `#A3E635`, finish `#FFC857`.
- Gradients blend in OKLCH (`hooks/ui/oklch.ts`).
- Every text token reaches 4.5:1 on its canvas in dark, light and both daltonized themes; a test enforces it. The light theme darkens plan, execute and the brand's cyan end to pass.
- Daltonized themes shift review to `#38BDF8` and critical to `#FB923C`.
- Status is always a glyph plus a color: `●` done, `◐` running, `○` pending, `✗` failed, `⚠` parked; model tiers `◇ ◈ ◆`.
- The brand mark is `ϟ` (U+03DF, single width). There are no emoji anywhere.

### Recording a demo GIF

Use a terminal at 120 or 160 columns, in fullscreen mode, so the pane docks.

```sh
claude --plugin-dir plugins/superpowers-tracker
/sp demo        # band and pane play 60 s through every state
```

Record with your tool of choice, for example `vhs`, `asciinema` plus `agg`, or a screen recorder. `/sp theme` switches palettes between takes.

## Tests

```sh
claude plugin validate plugins/superpowers-tracker
claude plugin test plugins/superpowers-tracker
```

From the repository root, `make test` runs both, with every other plugin's checks. The tests live in `tests/engine/`.

The 61 tests cover:
- the parsers (fenced Task headings, every ledger line form, roles and verdicts);
- the full happy path, from brainstorming to finishing, with the band asserted at each step;
- the fix loop to the breaker;
- re-dispatch after compaction under each mode, missing models and parallel implementers;
- the unverified-claim warning;
- every startup-scan fixture: checkout, `.worktrees/`, orphan, unexecuted plan, spec without a plan, live and dead companion, live elsewhere, `--resume` replay;
- ranking, the `+N` pill, suggestions, `/sp resume` (fills, never submits), dismiss and forget across a restart, the scan cache;
- width tiers 48–160, themes, motion, every surface, every pane tab, hotkeys, the not-placed fallback;
- contrast, OKLCH, glyph widths, Raster code points, render time, an idle band holding still, the demo.

## Troubleshooting

- **The band is empty.** Run `claude --debug`. Look for `ui.render (AbovePrompt): a hook returned a tree that does not validate`, and for `superpowers-tracker:` lines.
- **Nothing happens in a project that uses superpowers.** Run `/sp scan`. If superpowers isn't installed or enabled and no bootstrap is in context, the tracker stays dormant until the first skill fires.
- **`claude plugin test` says hooks modules are turned off.** Start `claude` once with network access, then run it again.
- **Too many resume candidates.** Use `/sp dismiss n --forget`, or narrow `windowDays`.
