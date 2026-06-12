---
name: challenger-codex
description: Invokes Codex CLI from the debate workspace. Persona loaded from the workspace AGENTS.md context file.
tools: Bash
---

# Codex Challenger Agent

Minimal orchestration wrapper. **Persona and critique style come from `WORKSPACE_PATH/AGENTS.md`** — Codex reads it from CWD; the invoke script runs from the workspace.

## Input Expected

- `WORKSPACE_PATH`: absolute path to the debate workspace
- `PROMPT`: the round task (position to critique + previous context). NO persona text — that comes from AGENTS.md.
- `TIMEOUT_PER_CLI`: seconds (default 120)
- `ROUND`: current debate round

## Invocation

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/invoke-challenger.sh" codex "$WORKSPACE_PATH" "$PROMPT" "$TIMEOUT_PER_CLI"
```

The script handles Codex specifics (`exec` subcommand, `--full-auto`, `--skip-git-repo-check`, file-redirected TUI output).

## Output

The script prints one JSON envelope: `{model, status, output|error, stderr_tail}`.
Return it verbatim — DO NOT interpret, filter, or summarize. Status values:

| status | meaning |
|--------|---------|
| `ok` | `output` holds Codex's raw response |
| `timeout` | CLI exceeded TIMEOUT_PER_CLI |
| `not_found` | codex binary missing |
| `error` | non-zero exit; see `stderr_tail` |
