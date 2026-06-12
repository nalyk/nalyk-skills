#!/bin/bash
# auto-ralph — SessionStart hook: one-line priming notice.
set -u
cat > /dev/null 2>&1 || true
echo "[auto-ralph] Imperative coding tasks (en/ro/ru) are gated by Skill(auto-ralph:auto-ralph); a per-turn hook flags matches."
exit 0
