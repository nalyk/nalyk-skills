---
description: "Adversarial debate with formal Architecture Decision Record output. Usage: /debate:adr <important decision>"
argument-hint: "<important decision requiring formal documentation>"
allowed-tools: Bash, Task, Read, Write, Glob, Grep, TodoWrite, Skill
---

# Debate with ADR Output

**DECISION:** $ARGUMENTS

Runs the full debate protocol, then writes a formal Architecture Decision Record.

---

## 1. RUN THE DEBATE

Execute the complete `/debate` flow from `${CLAUDE_PLUGIN_ROOT}/commands/debate.md` (preflight, workspace, personas, parallel challenge via `${CLAUDE_PLUGIN_ROOT}/scripts/challenge-all.sh`, confrontation rounds, assumption extraction if needed).

**Track everything** — the ADR needs the complete audit trail.

Banner: `(DEBATE:ADR) decision | challengers: <list> | output: ADR`

---

## 2. DETERMINE ADR NUMBER AND PATH

```bash
# adr_path from ~/.claude/debate.local.md if present, default ./docs/decisions
ADR_PATH="./docs/decisions"
SETTINGS="$HOME/.claude/debate.local.md"
if [ -f "$SETTINGS" ]; then
    v=$(grep -m1 -E '^adr_path:' "$SETTINGS" | sed -E 's/^adr_path:[[:space:]]*"?([^"]*)"?/\1/' || true)
    [ -n "$v" ] && ADR_PATH="$v"
fi
mkdir -p "$ADR_PATH"

LAST_ADR=$(ls "$ADR_PATH" 2>/dev/null | grep -E '^[0-9]+-' | sort -n | tail -1 | grep -oE '^[0-9]+' || true)
ADR_NUM=$(printf '%04d' $((10#${LAST_ADR:-0} + 1)))
echo "ADR_PATH=$ADR_PATH"; echo "ADR_NUM=$ADR_NUM"
```

Filename: `$ADR_NUM-<slug>.md` (topic lowercased, hyphens, max 50 chars). Example: `0012-use-redis-for-session-caching.md`.

---

## 3. GENERATE THE ADR

Read `${CLAUDE_PLUGIN_ROOT}/templates/adr-template.md` and fill it with the debate results (challenges per model — agy/codex/qwen, position evolution, consensus status, alternatives, consequences, risks, assumptions, full audit trail). Write the result to `$ADR_PATH/$ADR_NUM-<slug>.md`.

---

## 4. FINAL OUTPUT

```
ADR CREATED: <path>  (ADR-<num>, status PROPOSED, consensus YES/NO)
Next: review, set status ACCEPTED, commit to version control.
```
