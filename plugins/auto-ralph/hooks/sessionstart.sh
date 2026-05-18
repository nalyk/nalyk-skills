#!/bin/bash
# auto-ralph v2.1 — SessionStart priming hook
#
# Goal: prime the model at session start so it knows auto-ralph is the gating
#       skill for imperative coding tasks. This payload lands in the cacheable
#       prompt prefix, so it is FREE on every subsequent turn (prompt caching).
#
# Keep this short. SessionStart competes with many other priming sources.

set -u
cat > /dev/null 2>/dev/null || true  # drain stdin if any

LOG_FILE="${AUTO_RALPH_LOG:-/tmp/auto-ralph-hook.log}"
printf '[%s] sessionstart fired\n' "$(date -Iseconds 2>/dev/null || date)" \
    >> "$LOG_FILE" 2>/dev/null || true

cat << 'EOF'
[plugin auto-ralph@nalyk-skills v2.1 ACTIVE]
Imperative coding tasks (fix/repair/add/implement/create/build/test/refactor
in en/ro/ru) MUST be routed through Skill(auto-ralph:auto-ralph) BEFORE you
answer. The skill scores 0–4 and decides Ralph mode vs normal mode.
Explicit triggers ALWAYS activate it: "ralph this", "auto ralph", "loop it",
"iterate", "keep trying", "until done".
Explicit skips ALWAYS bypass it: "just answer", "don't loop", "explain first".
A UserPromptSubmit hook reinforces this on every turn.
EOF

exit 0
