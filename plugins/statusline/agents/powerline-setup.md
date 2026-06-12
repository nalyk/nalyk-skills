---
name: powerline-setup
description: Manually enable this plugin's powerline statusline when auto-configure was skipped (an existing statusLine was present) and the user explicitly asks to switch to it.
allowedTools:
  - Read
  - Edit
  - Write
  - Bash
---

# Powerline Setup Agent

Configure this plugin's powerline statusline in `~/.claude/settings.json`.

## Task

1. The renderer script is at `${CLAUDE_PLUGIN_ROOT}/scripts/statusline-command.sh` (absolute path — do not search for it).

2. Read `~/.claude/settings.json`. If it already contains a `statusLine`, show it to the user and confirm before replacing it.

3. Set (preserving all other settings):
   ```json
   "statusLine": {
     "type": "command",
     "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/statusline-command.sh"
   }
   ```
   with `${CLAUDE_PLUGIN_ROOT}` expanded to the real path.

4. Report success and remind the user to restart Claude Code.
