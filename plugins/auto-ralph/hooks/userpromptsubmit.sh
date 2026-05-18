#!/bin/bash
# auto-ralph v2.1 — UserPromptSubmit hook
#
# v2.0 BUG: emitted `{"systemMessage": "..."}` which Claude Code routes as a
#           user-visible banner, NOT as model-visible context injection.
#           Empirical proof: in-session system-reminder showed claudeception
#           hook output verbatim but contained zero "AUTO-RALPH CHECK" text,
#           even though this hook fired (exit 0, valid JSON).
#
# v2.1 FIX: emit plain stdout. Claude Code injects plain stdout from
#           UserPromptSubmit hooks into the model context as
#           <user-prompt-submit-hook> — the model SEES this.
#
# Side benefits:
#   • Adds /tmp/auto-ralph-hook.log observability (timestamp + prompt length).
#   • Banner is short, cache-friendly (no volatile content in payload).
#   • Reinforces the (AUTONALYK) scoring contract from SKILL.md.

set -u

# Consume stdin (UserPromptSubmit payload — JSON with .prompt). We don't need
# to parse it, but consuming prevents SIGPIPE for the parent.
STDIN_PAYLOAD="$(cat 2>/dev/null || true)"

# --- Observability: log every invocation (best-effort, never fails the hook)
LOG_FILE="${AUTO_RALPH_LOG:-/tmp/auto-ralph-hook.log}"
{
    PROMPT_LEN=$(printf '%s' "$STDIN_PAYLOAD" | wc -c)
    printf '[%s] userpromptsubmit fired (payload=%s bytes)\n' \
        "$(date -Iseconds 2>/dev/null || date)" "$PROMPT_LEN"
} >> "$LOG_FILE" 2>/dev/null || true

# --- Context injection (plain stdout → model-visible)
cat << 'EOF'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔁 AUTO-RALPH GATE — evaluate BEFORE composing any response
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Plugin auto-ralph@nalyk-skills is ACTIVE. For the current user prompt:

SCORE (0–4):
  +1  clear success criteria — verbs: fix/repair/add/implement/create/build/
      test/refactor and ro/ru equivalents (repară, fixează, adaugă,
      implementează, creează, testează, refactorizează, исправь, добавь,
      создай, сделай, протестируй)
  +1  iteration-friendly (not a question, explanation, or one-shot lookup)
  +1  defined scope (specific files, functions, modules, or concrete errors)
  +1  verifiable completion (tests, error to remove, observable behaviour)

DECISION (no exceptions):
  • Score ≥ 3  → invoke Skill(auto-ralph:auto-ralph) IMMEDIATELY,
                 BEFORE answering. The skill emits its own (AUTONALYK)
                 banner and runs Faza 0–5.
  • Score ≤ 2  → respond normally. NO banner required.

OVERRIDES (always win over score):
  • Force ON  : "ralph this", "auto ralph", "loop it", "iterate",
                "keep trying", "until done"
  • Force OFF : "just answer", "don't loop", "explain first", "one time"

ACTIVE-LOOP GUARD:
  Before activating, the skill checks for ".claude/ralph-loop.local.md".
  If present, it MUST warn and stop — never start a second loop.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

exit 0
