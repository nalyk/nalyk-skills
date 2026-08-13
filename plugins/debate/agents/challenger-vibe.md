---
name: challenger-vibe
description: Invokes the Mistral Vibe CLI from the debate workspace. Persona loaded from the workspace vibe/AGENTS.md context file.
tools: Bash
---

# Vibe Challenger Agent

Minimal orchestration wrapper. **Persona and critique style come from `WORKSPACE_PATH/vibe/AGENTS.md`** — vibe reads `AGENTS.md` from CWD (the same filename codex reads), so the invoke script runs vibe from the `vibe/` subdir to isolate it from the Codex persona.

## Input Expected

- `WORKSPACE_PATH`: absolute path to the debate workspace
- `PROMPT`: the round task (position to critique + previous context). NO persona text — that comes from vibe/AGENTS.md.
- `TIMEOUT_PER_CLI`: seconds (default 120)
- `ROUND`: current debate round

## Invocation

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/invoke-challenger.sh" vibe "$WORKSPACE_PATH" "$PROMPT" "$TIMEOUT_PER_CLI"
```

The script handles vibe specifics (`--prompt` prompt flag, `--yolo` auto-approval, `--trust` to load the workspace persona in a fresh untrusted dir).

## Output

The script prints one JSON envelope: `{model, status, output|error, stderr_tail}`.
Return it verbatim — DO NOT interpret, filter, or summarize. Status values:

| status | meaning |
|--------|---------|
| `ok` | `output` holds Vibe's raw response |
| `timeout` | CLI exceeded TIMEOUT_PER_CLI |
| `not_found` | vibe binary missing |
| `error` | non-zero exit; see `stderr_tail` |
