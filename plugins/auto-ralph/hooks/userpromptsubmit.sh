#!/bin/bash
# auto-ralph — UserPromptSubmit hook
# Parses the prompt; emits ONE line only when an imperative coding verb or an
# explicit force-on trigger is present. Silent otherwise (exit 0, no output).

set -u

command -v jq >/dev/null 2>&1 || exit 0

PAYLOAD="$(cat 2>/dev/null || true)"
PROMPT="$(printf '%s' "$PAYLOAD" | jq -r '.prompt // empty' 2>/dev/null || true)"
[ -n "$PROMPT" ] || exit 0

# Lowercase for matching (UTF-8 aware for ro/ru).
LOWER="$(printf '%s' "$PROMPT" | tr '[:upper:]' '[:lower:]')"

# Force-off phrases always win: stay silent.
if printf '%s' "$LOWER" | grep -qiE "just answer|don'?t loop|explain first|one time"; then
    exit 0
fi

# Explicit force-on triggers (bare "iterate" intentionally excluded — too common).
FORCE_ON='ralph this|auto ralph|loop it|until done'
# Imperative verbs en/ro/ru.
VERBS='fix|repair|add|implement|create|build|test|refactor|repară|fixează|adaugă|implementează|creează|testează|refactorizează|исправь|добавь|создай|сделай|протестируй'

MATCH="$(printf '%s' "$LOWER" | grep -oiE "$FORCE_ON" | head -1)"
if [ -z "$MATCH" ]; then
    MATCH="$(printf '%s' "$LOWER" | grep -oiE "\b($VERBS)\b" | head -1)"
fi
[ -n "$MATCH" ] || exit 0

# Active loop guard: warn instead of re-triggering.
CWD="$(printf '%s' "$PAYLOAD" | jq -r '.cwd // empty' 2>/dev/null || true)"
LOOP_FILE="${CWD:-$PWD}/.claude/ralph-loop.local.md"
if [ -f "$LOOP_FILE" ]; then
    echo "auto-ralph: Ralph Loop already active (.claude/ralph-loop.local.md) — do NOT start another; use /cancel-ralph to stop it."
    exit 0
fi

echo "auto-ralph: imperative \"$MATCH\" detected — invoke Skill(auto-ralph:auto-ralph) before answering."
exit 0
