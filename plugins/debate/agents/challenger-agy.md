---
name: challenger-agy
description: Invokes the agy (Antigravity) CLI pinned to a Gemini model from the debate workspace. Persona loaded from the workspace's agy/GEMINI.md context file.
tools: Bash
---

# agy Challenger Agent (Gemini perspective)

Minimal orchestration wrapper. **Persona and critique style come from `WORKSPACE_PATH/agy/GEMINI.md`** — agy reads GEMINI.md from its CWD; the invoke script runs it inside the `agy/` subdir so it never ingests the Codex persona in `AGENTS.md`.

## Input Expected

- `WORKSPACE_PATH`: absolute path to the debate workspace
- `PROMPT`: the round task (position to critique + previous context). NO persona text — that comes from GEMINI.md.
- `TIMEOUT_PER_CLI`: seconds (default 120)
- `ROUND`: current debate round

## Invocation

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/invoke-challenger.sh" agy "$WORKSPACE_PATH" "$PROMPT" "$TIMEOUT_PER_CLI"
```

The script pins `--model "Gemini 3.5 Flash (High)"` — never invoke agy directly without a Gemini model pin, or the debate degrades to Claude-vs-Claude.

## Output

The script prints one JSON envelope: `{model, status, output|error, stderr_tail}`.
Return it verbatim — DO NOT interpret, filter, or summarize. Status values:

| status | meaning |
|--------|---------|
| `ok` | `output` holds agy's raw response |
| `timeout` | CLI exceeded TIMEOUT_PER_CLI |
| `not_found` | agy binary missing |
| `error` | non-zero exit; see `stderr_tail` |
