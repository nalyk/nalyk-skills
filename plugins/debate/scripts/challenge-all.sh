#!/usr/bin/env bash
# challenge-all.sh WORKSPACE PROMPT [TIMEOUT] [ROUND]
#
# Launches every available challenger IN PARALLEL (background + wait) via
# invoke-challenger.sh. Writes each result to WORKSPACE/rounds/rNNN_<cli>.json
# and prints all result JSON objects (one per line block) to stdout.
set -u

WORKSPACE="${1:?usage: challenge-all.sh WORKSPACE PROMPT [TIMEOUT] [ROUND]}"
PROMPT="${2:?missing PROMPT}"
TIMEOUT="${3:-120}"
ROUND="${4:-1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="/tmp/debate-available-challengers"

# Challenger list: doctor cache if fresh (<24h), else fast inline detection.
CLIS=""
if [ -f "$CACHE" ] && [ -n "$(find "$CACHE" -mmin -1440 2>/dev/null)" ]; then
    CLIS="$(cat "$CACHE")"
else
    for c in agy codex qwen; do
        if command -v "$c" >/dev/null 2>&1; then
            CLIS="${CLIS}${c}
"
        fi
    done
fi

if [ -z "$(echo "$CLIS" | tr -d '[:space:]')" ]; then
    jq -n '{status:"error",error:"no_challengers_available",hint:"run /debate:doctor"}'
    exit 1
fi

mkdir -p "$WORKSPACE/rounds"
RTAG="$(printf 'r%03d' "$ROUND")"

PIDS=""
for CLI in $CLIS; do
    "$SCRIPT_DIR/invoke-challenger.sh" "$CLI" "$WORKSPACE" "$PROMPT" "$TIMEOUT" \
        > "$WORKSPACE/rounds/${RTAG}_${CLI}.json" &
    PIDS="$PIDS $!"
done

# shellcheck disable=SC2086
wait $PIDS

for CLI in $CLIS; do
    cat "$WORKSPACE/rounds/${RTAG}_${CLI}.json"
    echo
done
