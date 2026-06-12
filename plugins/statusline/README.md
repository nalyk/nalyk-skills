# statusline

Powerline-style statusline for Claude Code: model badge, directory, git branch with ahead/behind and staged/modified/untracked counts, context window meter, vim mode, time. Single jq call and a single `git status --porcelain=v2` per render; plain-text fallback if `jq` is missing.

## Installation

```bash
/plugin install statusline@nalyk-skills
```

A `SessionStart` hook sets `statusLine` in `~/.claude/settings.json` **only if no statusLine is configured**. It never touches an existing statusLine (yours or any other plugin's) and stays silent in that case. To switch from an existing statusline, use the `powerline-setup` agent or configure manually:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash <plugin-root>/scripts/statusline-command.sh"
  }
}
```

Restart Claude Code after configuration changes.

## Requirements

- `jq` (without it the statusline degrades to plain text)
- Powerline-compatible font (recommended)

## Structure

```
statusline/
├── .claude-plugin/plugin.json
├── hooks/hooks.json              # SessionStart auto-configure (non-destructive)
├── scripts/
│   ├── auto-configure.sh         # Sets statusLine only when absent
│   └── statusline-command.sh     # Renderer
└── agents/powerline-setup.md     # Manual/override setup
```

## License

MIT
