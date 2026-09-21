# nalyk-skills

Personal Claude Code plugin marketplace. 9 plugins covering automation, orchestration, code review, debugging, multi-model debate, SEO analysis, philosophical reasoning, and hook-enforced development discipline.

## Installation

Add the marketplace:

```bash
/plugin marketplace add nalyk/nalyk-skills
```

Install individual plugins:

```bash
/plugin install <plugin-name>@nalyk-skills
```

## Plugins

### auto-ralph (v3.0.0)

Gates imperative coding tasks (en/ro/ru) into Ralph Loops. A silent-by-default `UserPromptSubmit` hook flags matches; a deterministic 0-4 scorer routes score >= 3 to `/ralph-loop`.

```bash
/plugin install auto-ralph@nalyk-skills
```

**Triggers:** "ralph this", "auto ralph", "loop it" -- or auto-detects bug fixes, features, and refactoring tasks (score >= 3).

**Configuration:** `~/.claude/auto-ralph.local.md`

| Parameter | Default | Description |
|-----------|---------|-------------|
| max_iterations | 25 | Max Ralph Loop iterations |
| score_threshold | 3 | Min score for activation |
| skip_explore_for_score | 4 | Skip Explore phase at this score |
| default_language | ro | Output language (ro/en/ru) |
| auto_execute | false | Skip confirmation prompt |
| docker_analysis | true | Include Docker context |

Output: Romanian. Input: ro/en/ru/mixed.

---

### orchestrator (v2.0.0)

Decomposes a task into parallel subagent workstreams, routes them to appropriate agents, and synthesizes results.

```bash
/plugin install orchestrator@nalyk-skills
```

**Commands:**

| Command | Purpose |
|---------|---------|
| `/orchestrate <task>` | Full decomposition + parallel execution + synthesis |
| `/parallel <tasks...>` | Quick parallel launch without decomposition |
| `/plan-only <task>` | Preview execution plan without running |

Commands-only — no auto-trigger. The skill activates exclusively via the three commands above.

---

### audit-agent (v2.1.0)

Three audit frameworks: Steve Jobs (design simplification, 13 questions), George Carlin (BS detection, 13 questions), Vibe (engineering quality, 20 scored metrics).

```bash
/plugin install audit-agent@nalyk-skills
```

**Commands:**

| Command | Purpose |
|---------|---------|
| `/jobs-audit <target>` | Design thinking -- simplification, elegance, restraint |
| `/carlin-audit <target>` | BS detection -- hidden agendas, euphemisms, contradictions |
| `/vibe-audit <target>` | Engineering quality -- 20 metrics, 0-5 scale each |
| `/multi-audit <target>` | Run multiple frameworks + cross-reference synthesis |

**Triggers:** "feature bloat" / "design audit" (Jobs), "BS detector" / "marketing speak" / "corporate speak" (Carlin), "vibe check" / "slop check" / "technical due diligence" (Vibe). Generic phrases like "simplify" and "code review" are intentionally not claimed.

---

### debate (v2.1.0)

Multi-model adversarial debate. Claude defends a position against external CLI models (agy/Gemini, Codex, Mistral Vibe) in parallel rounds. Produces consensus, tradeoff documents, or ADRs.

Refuses to run with Claude-only. Requires at least 1 external CLI.

```bash
/plugin install debate@nalyk-skills
```

**Prerequisites -- at least one:**

| CLI | Install | Notes |
|-----|---------|-------|
| agy (Gemini models) | Antigravity CLI v1.0.7+, per vendor docs | pinned to a Gemini model; the legacy `gemini` CLI is dead/unsupported |
| Codex | `npm i -g @openai/codex` | ChatGPT Plus |
| Mistral Vibe (Devstral) | `curl -LsSf https://mistral.ai/vibe/install.sh \| bash` | then `vibe --setup`; free API key at console.mistral.ai |

**Commands:**

| Command | Purpose |
|---------|---------|
| `/debate <topic>` | Full adversarial debate |
| `/debate:doctor` | Check CLI availability and auth |
| `/debate:adr <topic>` | Debate with formal Architecture Decision Record output |

**Configuration:** `~/.claude/debate.local.md`

---

### diagnosticianul (v2027.0.0)

Elite Senior Principal Engineer persona. Four specialized diagnostic protocols for code review, system design, UI analysis, and algorithmic debugging. Romanian-flavored.

```bash
/plugin install diagnosticianul@nalyk-skills
```

**Protocols:**

| Protocol | Trigger | Function |
|----------|---------|----------|
| protocol-critic | Code snippets, PRs | Forensic code autopsy |
| protocol-architect | "Design a system" | Rigid system planning |
| protocol-visual | UI/CSS/frontend | UI quality enforcement |
| protocol-core | Algorithms, bugs | Surgical debugging |

**Triggers:** noun-domain signals only (race condition, time complexity, deadlock, database schema, API design, CSS/typography/accessibility). The main persona is invoked explicitly; generic verbs like "fix bug" or "code review" are not claimed.

---

### organon (v2.0.0)

Philosophical reasoning engine. 63 principles (0-62) from 20 philosophers applied as a decision engine and code review framework. Based on [Organon](https://gitlab.com/lightcyphers-open/organon) by Lightcyphers SRL.

```bash
/plugin install organon@nalyk-skills
```

**Commands:**

| Command | Purpose |
|---------|---------|
| `/organon` | Auto-detect mode and depth from context |
| `/organon:decide <topic>` | Explicit decision analysis |
| `/organon:review <path>` | Philosophical code review |

**Depth levels:** quick (1 principle), standard (multiple principles), deep (full 22-step protocol + Summa Method objections).

**Philosophers:** Aristotle, Aquinas, Kant, Machiavelli, Peirce, Plato, Poincare, Popper, Seneca, Stoics, Swinburne, Wittgenstein, plus Leibniz, Boole, Frege, Godel, Turing, Shannon, Church, Marcus Aurelius, Epictetus.

**License:** CC-BY-SA-4.0

**Credits:** Original idea and code by Anatolie Golovco.

---

### seo-skill (v3.0.0)

Deterministic SEO analysis engine. 98 atomic checks across 7 categories, async multi-page crawler, real Core Web Vitals via PageSpeed Insights, internal link graph with PageRank, auto-fix generation, audit history with regression detection.

```bash
/plugin install seo-skill@nalyk-skills
```

**Post-install -- Python dependencies** (from the installed seo-skill plugin directory):

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

**Requirements:** Python 3.10+. Optional: `PAGESPEED_API_KEY` (free, 25K queries/day).

**Commands:**

| Command | Purpose |
|---------|---------|
| `/seo audit <url>` | Full site audit with deterministic scoring |
| `/seo fix <url>` | Generate ready-to-apply fixes |
| `/seo linkgraph <url>` | Internal link graph + PageRank |
| `/seo technical <url>` | Technical SEO (9 categories) |
| `/seo content <url>` | E-E-A-T and content quality |
| `/seo schema <url>` | Schema detection, validation, generation |
| `/seo page <url>` | Deep single-page analysis |
| `/seo history <url>` | Audit score history |
| `/seo monitor setup` | Generate CI/CD configs (GitHub Actions, GitLab CI) |

One orchestrator skill plus 7 specialist subagents, CI/CD integration.

---

### statusline (v3.0.0)

Powerline-style status bar for Claude Code. Shows model badge, git status, context window usage, vim mode.

```bash
/plugin install statusline@nalyk-skills
```

**Requirements:** `jq`, terminal with Unicode support. Powerline font recommended.

Auto-configures via `SessionStart` hook only when no statusLine is set; never overwrites an existing one. Restart Claude Code after install.

---

### proctor (v2.6.0)

Hook-enforced development discipline for Claude Code. Skills teach methodology; hooks enforce compliance mechanically (git gates, planning mode, step/time budgets, quiet mode, pre-flight checks, self-diagnosis, autonomy metrics); store + tracing survive compaction.

```bash
/plugin install proctor@nalyk-skills
```

**Requirements:** Claude Code CLI >= 2.1.260, `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`, a git repository.

**Skills (14):**

| Skill | Purpose |
|-------|---------|
| `using-proctor` | Bootstrap -- skill discovery and hook awareness |
| `brainstorming` | Turn ideas into designs (spike/bounded/architectural) |
| `test-driven-development` | Red-green-refactor with git gate enforcement |
| `systematic-debugging` | Root cause before fixes, four-phase investigation |
| `verification-before-completion` | Evidence before claims, mechanically enforced |
| `subagent-driven-development` | Fresh agents per task with dashboard + state persistence |
| `executing-plans` | Inline plan execution with same enforcement as SDD |
| `writing-plans` | Create implementation plans from specs |
| `requesting-code-review` | Dispatch reviewers with proper packages |
| `receiving-code-review` | Evaluate feedback technically |
| `finishing-a-development-branch` | Verify -> present options -> execute -> clean up |
| `using-git-worktrees` | Workspace isolation with branch protection |
| `dispatching-parallel-agents` | Independent concurrent tasks |
| `writing-skills` | TDD applied to skill creation |

**Hard gates (5):** Test evidence, test freshness, test passing, branch protection, secret/credential detection. Planning mode blocks Write/Edit during design phases.

**Soft enforcers (12):** Skill watchdog, model selection, fix-round cap, step budget, time budget, context pressure, ruling aggregation, rationalization detection, destructive command warning, diff size awareness, test hint, task advance guidance.

**Operator commands (8):** `proctor: status`, `proctor: show trace`, `proctor: check` (pre-flight gate status), `proctor: diagnose` (self-analysis), `proctor: tasks N` (scope update), `proctor: quiet on/off`, `proctor: allow <branch>`, `proctor: approve design`.

**Autonomy features:** Failed approach tracking with "DO NOT REDO" compaction injection, SDD session recovery, task completion evidence, structured "Next steps:" on all gate denials, autonomy metrics (gate pass/deny ratio).

**Observability:** Structured event tracing, cross-session quality metrics, phase lifecycle tracking, real-time SDD progress dashboard.

**Configuration (6 options):** Protected branches, test freshness window, skill watchdog threshold, fix-round cap, step budget per task, time budget per task — all configurable via the plugin settings UI.

Without `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`, the skills still work as prose guidance but hooks do not fire.

---

## Plugin Details

See individual plugin READMEs in `plugins/<name>/` for full documentation.

## License

MIT (unless noted otherwise per plugin)
