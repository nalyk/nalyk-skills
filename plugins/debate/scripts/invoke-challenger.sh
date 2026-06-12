#!/usr/bin/env bash
# invoke-challenger.sh CLI_NAME WORKSPACE PROMPT [TIMEOUT]
#
# Runs one external challenger CLI from the debate workspace (so it picks up
# its persona context file) and emits exactly one JSON object on stdout:
#   {model, status: ok|timeout|not_found|error, output|error, stderr_tail}
#
# Exit-code map: 0 -> ok, 124 -> timeout, 127 -> not_found, else -> error.
set -u

CLI_NAME="${1:?usage: invoke-challenger.sh CLI_NAME WORKSPACE PROMPT [TIMEOUT]}"
WORKSPACE="${2:?missing WORKSPACE}"
PROMPT="${3:?missing PROMPT}"
TIMEOUT="${4:-120}"

fail_json() { # status error
    jq -n --arg m "$CLI_NAME" --arg s "$1" --arg e "$2" \
        '{model:$m,status:$s,error:$e,stderr_tail:""}'
}

if ! cd "$WORKSPACE" 2>/dev/null; then
    fail_json "error" "workspace_not_found"
    exit 0
fi

# Persona isolation: agy reads GEMINI.md from CWD but may also ingest a
# workspace AGENTS.md (the Codex persona). The workspace therefore keeps the
# agy persona in its own subdir: WORKSPACE/agy/GEMINI.md.
if [ "$CLI_NAME" = "agy" ] && [ -d "$WORKSPACE/agy" ]; then
    cd "$WORKSPACE/agy" || { fail_json "error" "agy_subdir_unreadable"; exit 0; }
fi

OUT="$(mktemp "/tmp/debate-${CLI_NAME}-out.XXXXXX")"
ERR="$(mktemp "/tmp/debate-${CLI_NAME}-err.XXXXXX")"
trap 'rm -f "$OUT" "$ERR"' EXIT

RC=0
case "$CLI_NAME" in
    agy)
        # ALWAYS pin a Gemini model: agy also serves Claude models, and an
        # unpinned call degrades the debate to Claude-vs-Claude.
        timeout "$TIMEOUT" agy -p "$PROMPT" \
            --dangerously-skip-permissions \
            --print-timeout "${TIMEOUT}s" \
            --model "Gemini 3.5 Flash (High)" \
            >"$OUT" 2>"$ERR" || RC=$?
        ;;
    codex)
        timeout "$TIMEOUT" codex exec "$PROMPT" \
            --full-auto --skip-git-repo-check \
            >"$OUT" 2>"$ERR" || RC=$?
        ;;
    qwen)
        timeout "$TIMEOUT" qwen -p "$PROMPT" -y \
            >"$OUT" 2>"$ERR" || RC=$?
        ;;
    *)
        fail_json "error" "unknown_cli"
        exit 0
        ;;
esac

STDERR_TAIL="$(tail -c 500 "$ERR" 2>/dev/null || true)"

case "$RC" in
    0)
        jq -n --arg m "$CLI_NAME" --rawfile out "$OUT" --arg st "$STDERR_TAIL" \
            '{model:$m,status:"ok",output:$out,stderr_tail:$st}'
        ;;
    124)
        jq -n --arg m "$CLI_NAME" --arg st "$STDERR_TAIL" \
            '{model:$m,status:"timeout",error:"cli_timeout",stderr_tail:$st}'
        ;;
    127)
        jq -n --arg m "$CLI_NAME" \
            '{model:$m,status:"not_found",error:"cli_not_found",stderr_tail:""}'
        ;;
    *)
        jq -n --arg m "$CLI_NAME" --arg rc "$RC" --arg st "$STDERR_TAIL" \
            '{model:$m,status:"error",error:("exit_"+$rc),stderr_tail:$st}'
        ;;
esac
