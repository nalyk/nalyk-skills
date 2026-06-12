#!/bin/bash
# SessionStart hook: set this plugin's statusline ONLY when none is configured.
# Never overwrites an existing statusLine, never prints unless it changed something.

SETTINGS_FILE="$HOME/.claude/settings.json"
PLUGIN_SCRIPT="${CLAUDE_PLUGIN_ROOT}/scripts/statusline-command.sh"

command -v jq >/dev/null 2>&1 || exit 0
[ -f "$SETTINGS_FILE" ] || exit 0

# If any statusLine is already configured (ours or the user's), leave it alone.
if jq -e '(.statusLine // empty) | length > 0' "$SETTINGS_FILE" >/dev/null 2>&1; then
    exit 0
fi

tmp=$(mktemp) || exit 0
trap 'rm -f "$tmp"' EXIT

if jq --arg cmd "bash $PLUGIN_SCRIPT" \
      '.statusLine = {type: "command", command: $cmd}' \
      "$SETTINGS_FILE" > "$tmp" && mv "$tmp" "$SETTINGS_FILE"; then
    echo "Statusline configured. Restart Claude Code to see it."
fi
