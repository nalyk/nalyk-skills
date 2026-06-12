#!/bin/bash
# auto-ralph — deterministic 0-4 task scorer.
# Usage: score-task.sh "<task text>"   (or task text on stdin)
# Output: score=N matched=[criterion,...]
# Criteria (+1 each): verb, iteration, scope, verify. Threshold for Ralph mode: 3.

set -u

TASK="${*:-}"
if [ -z "$TASK" ]; then
    TASK="$(cat 2>/dev/null || true)"
fi
if [ -z "$TASK" ]; then
    echo "usage: score-task.sh \"<task text>\"" >&2
    exit 1
fi

LOWER="$(printf '%s' "$TASK" | tr '[:upper:]' '[:lower:]')"

SCORE=0
MATCHED=""

add() { SCORE=$((SCORE + 1)); MATCHED="${MATCHED:+$MATCHED,}$1"; }

# 1. Imperative verb (en/ro/ru) => clear success criteria.
VERBS='fix|repair|solve|debug|add|implement|create|build|make|test|refactor|repară|fixează|rezolvă|adaugă|implementează|creează|fă|fă-mi|testează|refactorizează|исправь|почини|добавь|создай|сделай|протестируй|рефактор'
if printf '%s' "$LOWER" | grep -qiE "\b($VERBS)\b"; then
    add verb
fi

# 2. Iteration-friendly: not a question or explanation request.
QUESTIONS='explain|understand|what is|what does|why|how does|show me|explică|ce face|cum funcționează|de ce|ajută-mă să înțeleg|объясни|что это|что делает|как работает|почему|помоги понять'
if ! printf '%s' "$LOWER" | grep -qE '\?' && \
   ! printf '%s' "$LOWER" | grep -qiE "($QUESTIONS)"; then
    add iteration
fi

# 3. Defined scope: file/path/function/module/class/line/error mentioned.
SCOPE='\.[a-z]{1,4}\b|/[a-z0-9_.-]+|\b(function|func|method|class|module|component|endpoint)\b|\b(funcți[ae]|clas[ăa]|modul)\b|\b(функци[яю]|класс|модул)|\bline [0-9]+|\berror\b|\beroare|\bошибк'
if printf '%s' "$LOWER" | grep -qiE "($SCOPE)"; then
    add scope
fi

# 4. Verifiable completion: tests or a concrete error/failure to make disappear.
VERIFY='\btest(s|e|ele|ing)?\b|\btestează|coverage|\bтест|\bfail(s|ing|ed|ează)?\b|\berror\b|\beroare|\bошибк|\bcrash|\bbroken|\bnu merge|\bне работает|stack trace|exception'
if printf '%s' "$LOWER" | grep -qiE "($VERIFY)"; then
    add verify
fi

echo "score=$SCORE matched=[$MATCHED]"
