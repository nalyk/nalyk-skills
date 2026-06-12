# nalyk-skills

Personal Claude Code plugin marketplace. 8 plugins covering automation, orchestration, code review, debugging, multi-model debate, SEO analysis, and philosophical reasoning.

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

### debate (v2.0.0)

Multi-model adversarial debate. Claude defends a position against external CLI models (agy/Gemini, Codex, Qwen) in parallel rounds. Produces consensus, tradeoff documents, or ADRs.

Refuses to run with Claude-only. Requires at least 1 external CLI.

```bash
/plugin install debate@nalyk-skills
```

**Prerequisites -- at least one:**

| CLI | Install | Notes |
|-----|---------|-------|
| agy (Gemini models) | Antigravity CLI v1.0.7+, per vendor docs | pinned to a Gemini model; the legacy `gemini` CLI is dead/unsupported |
| Codex | `npm i -g @openai/codex` | ChatGPT Plus |
| Qwen | `npm i -g @qwen-code/qwen-code` | free tier 2000 req/day |

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

## Scripts

### scripts/enable-session-memory.py

Enables the unreleased Claude Code Session Memory feature by modifying local feature flags in `~/.claude.json`.

```bash
python3 scripts/enable-session-memory.py
# Restart Claude Code after running
```

**What it sets:**

| Setting | Server Default | Script Sets |
|---------|---------------|-------------|
| First trigger | 140,000 tokens | 10,000 tokens |
| Update interval | 10,000 tokens | 5,000 tokens |
| Tool call trigger | 5 calls | 3 calls |

Storage: `~/.claude/projects/{project}/{session-id}/session-memory/summary.md`

The server may reset these flags on sync. Re-run if session memory stops working.

Source: [decodeclaude.com/session-memory](https://decodeclaude.com/session-memory/)

## Plugin Details

See individual plugin READMEs in `plugins/<name>/` for full documentation.

## License

MIT (unless noted otherwise per plugin)
