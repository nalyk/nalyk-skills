---
name: debate
description: >-
  Multi-model adversarial debate: Claude defends a position against external
  CLI models (agy/Gemini, Codex, Qwen). Trigger on "debate this", "challenge
  my thinking", "devil's advocate", "stress test this idea", "second opinion
  from other models", "what am I missing".
---

# Debate System

Claude forms a position, then external AI models challenge it through structured adversarial debate. **NOT Claude debating itself** — different models = different blind spots = genuine value. Refuses to run with zero external challengers.

## Commands

| Command | Purpose |
|---------|---------|
| `/debate <topic>` | Full adversarial debate |
| `/debate:doctor` | Probe challenger CLIs, cache the working list |
| `/debate:adr <decision>` | Debate + formal ADR output |

## Challengers

| CLI | Model | Persona file (in debate workspace) |
|-----|-------|-----------------------------------|
| `agy` | Gemini (Antigravity CLI, pinned to a Gemini model) | `agy/GEMINI.md` |
| `codex` | GPT (ChatGPT Plus) | `AGENTS.md` |
| `qwen` | Qwen | `QWEN.md` |

The legacy `gemini` CLI is dead; a resolving binary is a stale shim. Use `agy`.

## Protocol (hybrid)

Workspace + personas → Claude's position → parallel challenge (all CLIs at once via `${CLAUDE_PLUGIN_ROOT}/scripts/challenge-all.sh`) → consensus check → sequential confrontation if disagreement → iterate to max rounds → consensus OR tradeoff document with assumption extraction. **Disagreement is signal, not failure** — the tradeoff output maps which assumption makes each option correct.

Details on demand:
- Orchestration: `${CLAUDE_PLUGIN_ROOT}/references/debate-protocol.md`
- CLI flags/invocation: `${CLAUDE_PLUGIN_ROOT}/references/cli-invocation.md`

## Settings

`~/.claude/debate.local.md` YAML frontmatter: `max_rounds` (default 5), `timeout_per_cli` (default 120), `adr_path` (default `./docs/decisions`).
