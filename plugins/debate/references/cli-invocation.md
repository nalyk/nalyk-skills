# CLI Invocation Reference

## Architecture

```
debates/NNN-topic-slug/            <- debate workspace
├── agy/GEMINI.md   --> agy reads at process start (Architect persona)
├── AGENTS.md       --> codex reads at process start (Operator persona)
├── QWEN.md         --> qwen reads at process start (Adversary persona)
└── rounds/rNNN_<cli>.json         <- per-round result envelopes
```

Each CLI loads its context file **at process initialization from CWD**, so every invocation must run from the workspace. The scripts handle this — never hand-roll inline per-CLI bash.

**Persona isolation:** agy reads `GEMINI.md` from CWD, but it may also ingest a CWD `AGENTS.md` (the Codex persona). The agy persona therefore lives in the `agy/` subdir, and `invoke-challenger.sh` runs agy from there.

## Supported CLIs

| CLI | Provides | Context file | Headless invocation |
|-----|----------|--------------|---------------------|
| `agy` | Gemini (Antigravity CLI v1.0.7+) | `agy/GEMINI.md` | `agy -p "<prompt>" --dangerously-skip-permissions --print-timeout <s> --model "Gemini 3.5 Flash (High)"` |
| `codex` | GPT (ChatGPT Plus) | `AGENTS.md` | `codex exec "<prompt>" --full-auto --skip-git-repo-check` (TUI output needs file redirect) |
| `qwen` | Qwen (free tier 2000 req/day) | `QWEN.md` | `qwen -p "<prompt>" -y` (auto-approval) |

### agy notes (Gemini replacement)

- The legacy `gemini` CLI is **dead**. A resolving `gemini` binary is a stale root-owned shim — never use `command -v gemini` as a health signal.
- agy takes the prompt via `-p` (no positional arg) and uses `--dangerously-skip-permissions` for auto-approval.
- agy also serves **Claude** models. ALWAYS pin `--model` to a Gemini tier (`"Gemini 3.5 Flash (High)"`), otherwise the debate becomes Claude-debates-Claude.
- No auth subcommand. Health probe:
  `timeout 60 agy -p "respond with exactly: DEBATE_AUTH_OK" --dangerously-skip-permissions | grep -q DEBATE_AUTH_OK`

## The Scripts (single source of truth)

### One challenger

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/invoke-challenger.sh" CLI_NAME WORKSPACE PROMPT [TIMEOUT]
```

cd's to the workspace (agy: its subdir), runs the right CLI with stdout captured to a file and stderr separately, maps exit codes (0 ok, 124 timeout, 127 not_found, else error), and prints one JSON envelope:

```json
{"model":"agy","status":"ok","output":"<raw CLI response>","stderr_tail":""}
{"model":"codex","status":"timeout","error":"cli_timeout","stderr_tail":"..."}
```

### All challengers, in parallel

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/challenge-all.sh" WORKSPACE PROMPT [TIMEOUT] [ROUND]
```

Reads the challenger list from `/tmp/debate-available-challengers` (if fresh, <24h) or falls back to inline `command -v` detection; launches every challenger in the background and `wait`s — a round takes max(timeouts), not the sum (~2 min instead of ~6). Results land in `WORKSPACE/rounds/rNNN_<cli>.json` and on stdout.

### Health check

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.sh"
```

Live auth round-trip per CLI, parametric status block, caches working challengers.

## Expected challenger JSON (inside the `output` field)

```json
{
  "verdict": "partial",
  "critique": "Your scaling assumptions break at 10K concurrent sessions",
  "evidence": "Concrete scenario proving the point",
  "alternative": "Recommended approach instead",
  "confidence": "high",
  "objection_strength": "strong",
  "assumptions_challenged": ["linear scaling", "network reliability"],
  "your_perspective": "architect-scaling"
}
```

If the CLI returns plain text instead of JSON, treat the whole `output` as the critique and note `parse_error`.

## Troubleshooting

- **Generic-assistant responses (persona not loaded):** the CLI did not run from the workspace. Use the scripts; verify the persona files exist (`agy/GEMINI.md`, `AGENTS.md`, `QWEN.md`).
- **All challengers give the same critique:** persona files are not distinct — regenerate with the `debate-persona-generator` skill.
- **status=not_found:** install the CLI (codex: `npm i -g @openai/codex`; qwen: `npm i -g @qwen-code/qwen-code`; agy: per vendor docs).
- **status=error with auth-ish stderr_tail:** run `/debate:doctor`; authenticate (codex: `codex auth`, qwen: `qwen auth login`; agy authenticates via its own first-run flow).
