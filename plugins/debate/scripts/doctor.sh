#!/usr/bin/env bash
# doctor.sh — debate system health check.
# Detects challenger CLIs (agy, codex, vibe), probes authentication with a
# live round-trip, prints one parametric status block, and caches the working
# challenger list to /tmp/debate-available-challengers.
#
# NOTE: never treat `command -v gemini` as a health signal — the dead gemini
# CLI can still resolve via a stale shim. gemini is not supported; agy is.
set -u

CACHE="/tmp/debate-available-challengers"
AVAILABLE=""
SUMMARY=""

probe() { # name detect_label probe_command...
    local name="$1"; shift
    local installed="N" auth="-"
    if command -v "$name" >/dev/null 2>&1; then
        installed="Y"
        if "$@"; then auth="Y"; else auth="N"; fi
    fi
    SUMMARY="${SUMMARY}$(printf '|  %-6s | %-9s | %-13s |' "$name" "$installed" "$auth")
"
    if [ "$auth" = "Y" ]; then
        AVAILABLE="${AVAILABLE}${name}
"
    fi
}

probe_agy() {
    timeout 60 agy -p "respond with exactly: DEBATE_AUTH_OK" \
        --dangerously-skip-permissions 2>/dev/null | grep -q "DEBATE_AUTH_OK"
}

probe_codex() {
    local out rc=1
    out="$(mktemp /tmp/debate-doctor-codex.XXXXXX)"
    # Codex TUI output needs a file redirect; run from /tmp to skip repo checks.
    ( cd /tmp && timeout 60 codex exec "respond with exactly: DEBATE_AUTH_OK" \
        --full-auto --skip-git-repo-check >"$out" 2>&1 )
    grep -q "DEBATE_AUTH_OK" "$out" && rc=0
    rm -f "$out"
    return "$rc"
}

probe_vibe() {
    timeout 60 vibe --prompt "respond with exactly: DEBATE_AUTH_OK" --yolo --trust 2>/dev/null \
        | grep -q "DEBATE_AUTH_OK"
}

echo "=== DEBATE SYSTEM DIAGNOSTIC ==="
echo "Probing challengers (live auth round-trip, up to 60s each)..."
probe agy   probe_agy
probe codex probe_codex
probe vibe  probe_vibe

COUNT="$(echo "$AVAILABLE" | grep -c .)" || COUNT=0
LIST="$(echo "$AVAILABLE" | tr '\n' ' ' | sed 's/ *$//')"

case "$COUNT" in
    0) LEVEL="DISABLED   (no genuine diversity - debates will refuse to run)" ;;
    1) LEVEL="MINIMAL    (functional, limited perspective diversity)" ;;
    2) LEVEL="FUNCTIONAL (good perspective coverage)" ;;
    *) LEVEL="OPTIMAL    (full adversarial coverage)" ;;
esac

echo ""
echo "+------------------------------------------+"
echo "|  CLI    | Installed | Authenticated |"
printf '%s' "$SUMMARY"
echo "+------------------------------------------+"
echo "|  CHALLENGERS AVAILABLE: $COUNT ($LIST)"
echo "|  DEBATE CAPABILITY: $LEVEL"
echo "+------------------------------------------+"

if [ "$COUNT" -eq 0 ]; then
    cat <<'EOF'

Install and authenticate at least ONE challenger:

  agy    Antigravity CLI v1.0.7+ (Gemini models) - install per vendor docs,
         must be on PATH as 'agy'. Probe: agy -p "..." --dangerously-skip-permissions
  codex  npm i -g @openai/codex          then: codex auth   (ChatGPT Plus)
  vibe   curl -LsSf https://mistral.ai/vibe/install.sh | bash   then: vibe --setup (free key: console.mistral.ai)

Then re-run /debate:doctor.
EOF
    rm -f "$CACHE"
    exit 0
fi

printf '%s' "$AVAILABLE" > "$CACHE"
echo ""
echo "Cached working challengers to $CACHE (valid 24h)."
