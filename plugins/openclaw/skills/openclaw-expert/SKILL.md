---
name: openclaw-expert
description: OpenClaw expert — self-hosted multi-channel AI agent gateway. Activates on any mention of OpenClaw, openclaw.json, ClawHub, pi-mono, or gateway/channel setup for WhatsApp/Telegram/Discord/Signal-style agent bots. Covers config, channels, providers, tools, CLI, sandboxing, automation.
---

# OpenClaw Expert

OpenClaw is a self-hosted, open-source (MIT) multi-channel gateway for AI agents: one Gateway process connects messaging surfaces (WhatsApp, Telegram, Discord, Slack, Signal, iMessage, Matrix, MS Teams, and ~20 more) to model providers (Anthropic, OpenAI, OpenRouter, Bedrock, Mistral, local models).

- **Repo**: https://github.com/openclaw/openclaw — **Docs**: https://docs.openclaw.ai
- **Stack**: TypeScript, Node 22+, pnpm, pi-mono agent runtime
- **Config**: JSON5 at `~/.openclaw/openclaw.json` (strict validation, hot-reload)
- **Default port**: 18789 (WS + HTTP), Canvas: 18793

## Retrieval Protocol (grep-first, NEVER whole-file Read)

Reference files are large (19K–201K). Do NOT Read a whole file.

1. Pick the file from the routing table below (or check `reference/INDEX.md` — it maps every file to its `[Source: <url>]` page anchors).
2. **Grep the file** for keywords and/or the `[Source:` anchor URL to get line numbers: `grep -n 'dmPolicy\|\[Source:' reference/channels.md`
3. **Read with offset/limit** around the hits (sections run from one `[Source:` anchor to the next `---`).
4. Answer with concrete config patterns and CLI commands.
5. Bleeding-edge gaps: fetch `https://docs.openclaw.ai/<path>` or `https://docs.openclaw.ai/sitemap.xml`.

## File Routing

| File | Size | Covers |
|---|---|---|
| `reference/gateway-ops.md` | 201K | Gateway config + reference, auth, security, sandboxing, networking, remote access, Tailscale, web UI/dashboard/TUI, protocols, health/doctor |
| `reference/channels.md` | 192K | Every channel (WhatsApp, Telegram, Discord, Slack, Signal, iMessage, Matrix, Teams, BlueBubbles, Nostr, Twitch...), pairing, groups, broadcast, routing |
| `reference/concepts.md` | 134K | Architecture, agent runtime/loop, system prompt, sessions, memory, compaction, multi-agent, streaming, retry, queue, models |
| `reference/troubleshooting.md` | 134K | FAQ, triage, debug workflows, channel/gateway troubleshooting |
| `reference/tools.md` | 128K | Lobster, LLM task, exec, web search, browser, sub-agents, skills, ClawHub, plugins, slash commands, elevated mode |
| `reference/install.md` | 100K | npm/curl/Docker/Nix/Ansible/Bun install, updating, uninstalling |
| `reference/cli.md` | 65K | All 44 CLI commands (gateway, configure, doctor, channels, agents, devices, cron, sessions, webhooks...) |
| `reference/platforms.md` | 59K | macOS app internals, Linux, Windows/WSL2, iOS, Android, Hetzner, GCP, Fly |
| `reference/automation.md` | 57K | Cron jobs, cron vs heartbeat, hooks, webhooks, Gmail PubSub, polls |
| `reference/templates-reference.md` | 53K | AGENTS/SOUL/BOOT/BOOTSTRAP/IDENTITY/HEARTBEAT templates, RPC adapters, prompt caching |
| `reference/getting-started.md` | 37K | Onboarding, CLI wizard, personal assistant setup, hubs |
| `reference/providers.md` | 27K | Anthropic, OpenAI, OpenRouter, Bedrock, Mistral, LiteLLM, local models |
| `reference/nodes-media.md` | 22K | Node management, voice notes, camera, talk mode, voice wake |
| `reference/plugins-extensions.md` | 19K | Voice call plugin, Zalo personal, community plugins |

## Core Architecture (Quick Reference)

```
GATEWAY (daemon)  port 18789 (WS+HTTP), Canvas 18793
  Channels (WhatsApp/Telegram/...) → Agent Runtime (pi-mono) → Tools (exec/web/browser/skills) → Sessions (JSONL per agent)
  WS API: connect → req/res + events
  Config: ~/.openclaw/openclaw.json (JSON5, hot-reload)
```

## File System Layout

```
~/.openclaw/
├── openclaw.json     # Main config (JSON5, hot-reloaded)
├── credentials/      # Provider credentials (0o600)
├── workspace/        # Default agent workspace
│   ├── AGENTS.md SOUL.md TOOLS.md USER.md IDENTITY.md
│   ├── BOOTSTRAP.md MEMORY.md HEARTBEAT.md
│   ├── memory/       # Daily memory files (on-demand, NOT injected)
│   └── skills/       # Per-agent skills (highest precedence)
├── skills/           # Shared skills (all agents)
├── agents/<agentId>/sessions/<SessionId>.jsonl
└── sandboxes/        # Sandbox workspaces
```

## Essential CLI (Quick Reference)

```bash
npm install -g openclaw@latest && openclaw onboard --install-daemon
openclaw gateway [status]           # Start / check service
openclaw configure                  # Interactive wizard
openclaw config get|set <path> [v]  # Read/write config
openclaw doctor [--fix]             # Diagnose + repair
openclaw channels list|login|status
openclaw agents list --bindings
openclaw devices list|approve|reject
openclaw logs --follow / status --all / health --verbose
openclaw security audit [--deep] [--fix]
```

## Config Patterns (Quick Reference)

```json5
// Minimal: ~/.openclaw/openclaw.json
{
  agents: { defaults: { workspace: "~/.openclaw/workspace" } },
  channels: { whatsapp: { allowFrom: ["+15555550123"] } },
}
// DM policy (any channel): dmPolicy: "pairing" | "allowlist" | "open" | "disabled"
// Models: agents.defaults.model: { primary: "anthropic/claude-sonnet-4-5", fallbacks: ["openai/gpt-5.2"] }
```
