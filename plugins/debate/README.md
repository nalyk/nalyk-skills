# debate

Multi-model adversarial debate plugin for Claude Code. Claude forms a position; external CLI models challenge it in parallel; Claude defends, updates, or synthesizes. **Refuses to run Claude-only** — Claude debating itself is theater.

## Challengers

| CLI | Provides | Notes |
|-----|----------|-------|
| `agy` | Gemini | Antigravity CLI v1.0.7+, pinned to a Gemini model. The legacy `gemini` CLI is dead — a resolving binary is a stale shim. |
| `codex` | GPT | `npm i -g @openai/codex`, then `codex auth` (ChatGPT Plus) |
| `vibe` | Mistral Vibe (Devstral) | `curl -LsSf https://mistral.ai/vibe/install.sh \| bash`, then `vibe --setup` (free API key: console.mistral.ai) |

Minimum: 1 working challenger. Check with `/debate:doctor`.

## Commands

| Command | Purpose |
|---------|---------|
| `/debate <topic>` | Full adversarial debate |
| `/debate:doctor` | Probe CLI availability + auth (live round-trip), cache the working list (24h) |
| `/debate:adr <decision>` | Debate with formal ADR output |

## How It Works

1. **Workspace + personas** — `debates/NNN-slug/` is created; the `debate-persona-generator` skill writes three distinct expert personas as CLI context files: `agy/GEMINI.md` (Architect), `AGENTS.md` (Operator), `vibe/AGENTS.md` (Adversary). agy and vibe each get their own subdir so they never ingest the Codex `AGENTS.md` persona.
2. **Claude's opening position** — stance, reasoning, confidence, assumptions.
3. **Parallel challenge** — `scripts/challenge-all.sh` launches all challengers in the background and waits: a round costs max(timeouts), not the sum.
4. **Consensus check** — all agree → fast exit; disagreement → confrontation rounds (per-challenger rebuttals via challenger agents + `scripts/invoke-challenger.sh`).
5. **Iterate** to consensus or max rounds; then **assumption extraction**.
6. **Output** — consensus with audit trail, or a tradeoff document mapping which assumption makes each option correct. Disagreement is signal, not failure.

## Configuration (single source of truth)

`~/.claude/debate.local.md`:

```yaml
---
max_rounds: 5            # confrontation round cap
timeout_per_cli: 120     # seconds per CLI invocation
adr_path: "./docs/decisions"   # where /debate:adr writes
---
```

## Structure

```
debate/
├── .claude-plugin/plugin.json
├── commands/            debate.md, doctor.md, adr.md
├── agents/              challenger-agy.md, challenger-codex.md, challenger-vibe.md, assumption-extractor.md
├── scripts/             invoke-challenger.sh, challenge-all.sh, doctor.sh
├── skills/              debate/, debate-persona-generator/
├── templates/           adr-template.md, tradeoff-document.md
└── references/          debate-protocol.md, cli-invocation.md
```

## License

MIT
