---
description: "Multi-model adversarial debate. Claude defends a position against external CLI models (agy/Gemini, Codex, Qwen). Usage: /debate <topic>"
argument-hint: "<topic to debate - question, decision, code, architecture, anything>"
allowed-tools: Bash, Task, Read, Write, Glob, Grep, TodoWrite, Skill
---

# Multi-Model Adversarial Debate

**TOPIC:** $ARGUMENTS

Full protocol reference: `${CLAUDE_PLUGIN_ROOT}/references/debate-protocol.md`
CLI details: `${CLAUDE_PLUGIN_ROOT}/references/cli-invocation.md`

---

## PHASE 0: PREFLIGHT + WORKSPACE

Run this single preflight (settings, challenger detection with cache fallback, workspace creation). Replace `topic-slug-here` with a lowercase-hyphen slug of the topic (max 50 chars):

```bash
SLUG="topic-slug-here"

# Settings (defaults, overridden by ~/.claude/debate.local.md if present)
TIMEOUT_PER_CLI=120; MAX_ROUNDS=5
SETTINGS="$HOME/.claude/debate.local.md"
if [ -f "$SETTINGS" ]; then
    v=$(grep -m1 -E '^timeout_per_cli:' "$SETTINGS" | grep -oE '[0-9]+' || true); [ -n "$v" ] && TIMEOUT_PER_CLI="$v"
    v=$(grep -m1 -E '^max_rounds:' "$SETTINGS" | grep -oE '[0-9]+' || true); [ -n "$v" ] && MAX_ROUNDS="$v"
fi

# Challengers: doctor cache if fresh (<24h), else fast inline detection
CACHE=/tmp/debate-available-challengers
if [ -f "$CACHE" ] && [ -n "$(find "$CACHE" -mmin -1440 2>/dev/null)" ]; then
    CHALLENGERS=$(tr '\n' ' ' < "$CACHE")
else
    CHALLENGERS=""
    for c in agy codex qwen; do command -v "$c" >/dev/null 2>&1 && CHALLENGERS="$CHALLENGERS$c "; done
fi
COUNT=$(echo "$CHALLENGERS" | wc -w)

# Workspace: debates/NNN-slug/ (agy gets its own subdir for persona isolation)
mkdir -p debates
LAST=$(ls debates 2>/dev/null | grep -E '^[0-9]{3}-' | sort | tail -1 | cut -c1-3 || true)
NEXT=$(printf '%03d' $((10#${LAST:-0} + 1)))
WORKSPACE_PATH="$(pwd)/debates/${NEXT}-${SLUG}"
mkdir -p "$WORKSPACE_PATH/rounds" "$WORKSPACE_PATH/agy"

echo "CHALLENGERS=$CHALLENGERS"; echo "COUNT=$COUNT"
echo "TIMEOUT_PER_CLI=$TIMEOUT_PER_CLI"; echo "MAX_ROUNDS=$MAX_ROUNDS"
echo "WORKSPACE_PATH=$WORKSPACE_PATH"
```

**If COUNT=0: STOP.** Output: "DEBATE ABORTED: no external challengers. Claude debating itself is theater. Run /debate:doctor and install at least one CLI (agy/codex/qwen)." Do not proceed.

Otherwise show a one-line banner: `(DEBATE) topic | challengers: <list> | max rounds: <N>` — then generate personas:

**Invoke the `debate-persona-generator` skill** with TOPIC, detected DOMAIN, and WORKSPACE_PATH. It must write three DISTINCT persona files:
- `$WORKSPACE_PATH/agy/GEMINI.md` (Architect — read by agy)
- `$WORKSPACE_PATH/AGENTS.md` (Operator — read by codex)
- `$WORKSPACE_PATH/QWEN.md` (Adversary — read by qwen)

Only write files for available challengers. Verify each file exists before Phase 1.

---

## PHASE 1: CLAUDE'S OPENING POSITION

Analyze the topic. State, in this format:

```
## CLAUDE'S OPENING POSITION
**Position:** [clear, specific stance]
**Reasoning:** [numbered points]
**Confidence:** HIGH/MEDIUM/LOW
**Weaknesses I see:** [list]
**My assumptions:** [list]
```

---

## PHASE 2: PARALLEL CHALLENGE

One Bash call launches ALL challengers in parallel (background + wait, same prompt to each — each CLI reads its own persona file):

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/challenge-all.sh" "$WORKSPACE_PATH" "$CHALLENGE_PROMPT" "$TIMEOUT_PER_CLI" "$ROUND_NUMBER"
```

CHALLENGE_PROMPT = Claude's opening position + the round task:

```
## ROUND {N} CHALLENGE
### Position to Critique
{CLAUDE_POSITION}
### Your Task
Find flaws: edge cases, risks, questionable assumptions. Recommend alternatives.
Respond with valid JSON: {"verdict":"agree|partial|disagree","critique":"...","evidence":"...","alternative":"...","confidence":"high|medium|low","objection_strength":"strong|moderate|minor","assumptions_challenged":[...],"your_perspective":"..."}
If you agree too easily you are not helping. If you truly agree, explain why the position is solid.
```

Each result is a JSON envelope `{model, status, output|error, stderr_tail}` (also saved to `$WORKSPACE_PATH/rounds/`). Parse the `output` field for the challenger's JSON; if non-JSON, treat as raw critique. Skip failed challengers (status != ok), note the failure, continue with the rest. Abort only if ALL fail.

Display per challenger:

```
### agy (Gemini) says: / ### codex says: / ### qwen says:
Verdict / Critique / Evidence / Alternative / Assumptions challenged
```

---

## PHASE 3: CONSENSUS CHECK

| Challenger | Verdict | Objection strength | Blocking? |
|------------|---------|--------------------|-----------|
| agy | | | |
| codex | | | |
| qwen | | | |

Rules:
- All AGREE (high confidence) → Phase 8 fast exit
- All PARTIAL with minor objections → address briefly, Phase 8
- Any DISAGREE or STRONG objection, or mixed → Phase 4
- Skepticism: round-1 agreement that looks like rubber-stamping → treat as PARTIAL, continue

---

## PHASE 4: CLAUDE RESPONDS

For each blocking critique: ACCEPT (update position, explain) / PARTIALLY ACCEPT (scope it) / REJECT (explain with specifics). Track position evolution v1 → v2 → ...

---

## PHASE 5: CHALLENGER REBUTTAL (per-challenger prompts)

For each challenger whose critique you REJECTED, the prompts now differ — dispatch the challenger agents IN PARALLEL (all Task calls in ONE message):

- Agents: `challenger-agy`, `challenger-codex`, `challenger-qwen`
- Pass each: `WORKSPACE_PATH`, `TIMEOUT_PER_CLI`, `ROUND`, and a PROMPT containing their original critique + Claude's response + the question: "ACCEPT / MAINTAIN (why) / ESCALATE (clarify)"

ACCEPT → resolved. MAINTAIN → log disagreement. ESCALATE → back to Phase 4 with the clarified critique.

---

## PHASE 6: ITERATION CHECK

- All resolved → Phase 8 (consensus)
- Round < MAX_ROUNDS and unresolved → Phase 4
- Round = MAX_ROUNDS and unresolved → Phase 7

---

## PHASE 7: ASSUMPTION EXTRACTION (no consensus)

Dispatch the `assumption-extractor` agent with TOPIC, final positions, and debate history. Output: assumption map (party / core assumption / if-true-then) + "which assumption matches YOUR reality?"

---

## PHASE 8: FINAL OUTPUT

**Consensus:** final (evolved) position, what Claude learned per challenger, position evolution, rounds used, collapsed audit trail.

**No consensus:** fill `${CLAUDE_PLUGIN_ROOT}/templates/tradeoff-document.md` — options, exposed assumptions, common ground, decision checklist. Disagreement is signal, not failure.

---

## ERROR HANDLING

- One CLI fails mid-debate → log, continue with the rest
- ALL challengers fail → abort with error
- Timeouts are reported in the final output ("[model] timed out in round N")
