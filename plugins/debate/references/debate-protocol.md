# Debate Protocol Reference

Hybrid protocol: **parallel first, sequential if needed**. `commands/debate.md` is the executable orchestration; this file explains the rationale and rules.

```
Phase 0: PREFLIGHT + WORKSPACE + PERSONAS
    ├── Read ~/.claude/debate.local.md (timeout_per_cli, max_rounds; defaults 120/5)
    ├── Challengers: /tmp/debate-available-challengers if <24h old,
    │   else inline `command -v agy|codex|qwen` fallback (no abort on stale cache)
    ├── 0 challengers -> ABORT (Claude-only debate is theater)
    ├── Create debates/NNN-slug/{rounds/,agy/}
    └── debate-persona-generator skill writes DISTINCT personas:
        agy/GEMINI.md (Architect), AGENTS.md (Operator), QWEN.md (Adversary)
          |
Phase 1: CLAUDE'S OPENING (position, reasoning, confidence, weaknesses, assumptions)
          |
Phase 2: PARALLEL CHALLENGE
    └── ONE bash call: scripts/challenge-all.sh WORKSPACE PROMPT TIMEOUT ROUND
        (background + wait: round costs max(timeouts), not the sum)
          |
Phase 3: CONSENSUS CHECK
    ├── All agree / all partial-minor -> Phase 8 fast exit
    └── Any disagree/strong or mixed -> Phase 4
          |
Phase 4: CLAUDE RESPONDS (accept / partially accept / reject; track v1 -> v2 -> ...)
          |
Phase 5: CHALLENGER REBUTTAL (prompts now differ per challenger)
    └── Dispatch challenger-agy / challenger-codex / challenger-qwen agents
        IN PARALLEL (all Task calls in ONE message), each gets WORKSPACE_PATH,
        TIMEOUT_PER_CLI and its own prompt; agents run invoke-challenger.sh.
        Replies: ACCEPT (resolved) / MAINTAIN (log) / ESCALATE (back to Phase 4)
          |
Phase 6: ITERATION CHECK (resolved -> Phase 8; round < MAX -> Phase 4; else Phase 7)
          |
Phase 7: ASSUMPTION EXTRACTION (assumption-extractor agent)
          |
Phase 8: FINAL OUTPUT (consensus summary OR tradeoff document)
```

## The Three Perspectives

| Persona file | CLI | Perspective | Catches |
|--------------|-----|-------------|---------|
| `agy/GEMINI.md` | agy (Gemini) | **Architect** | Scaling, complexity, design flaws |
| `AGENTS.md` | codex | **Operator** | Maintenance, failure modes, debugging |
| `QWEN.md` | qwen | **Adversary** | Security, edge cases, abuse scenarios |

Personas are written ONCE at debate start and never modified mid-debate — each CLI re-reads its file on every invocation (fresh process), giving a stable expert identity across rounds.

## Consensus Rules

| Condition | Action |
|-----------|--------|
| All `verdict:"agree"` (high confidence) | Fast exit |
| All `verdict:"partial"` + `objection_strength:"minor"` | Address briefly, fast exit |
| Any `disagree` or `strong` objection, or mixed verdicts | Confrontation |

**Skepticism rule:** round-1 agreement that doesn't engage the challenger's specific expertise angle is rubber-stamping — treat as `partial` and continue.

**Multi-perspective value:** agreement from all three angles is a strong signal; disagreement reveals WHICH aspect (scaling? operations? security?) is weak.

## Limits and Error Handling

- Defaults: MAX_ROUNDS=5, TIMEOUT_PER_CLI=120s (overridable in `~/.claude/debate.local.md`)
- One CLI fails (timeout/auth/parse) → log, continue with the rest
- ALL CLIs fail, or workspace creation fails → abort
- Minimum viability: Claude + 1 responding challenger

## Position Evolution

Track every change: `v1 (opening) -> v2 (accepted Architect's scaling critique) -> vN (final)`. This evolution IS the audit trail that makes debates valuable.

## Outputs

- **Consensus:** evolved position + per-perspective validation + what changed
- **No consensus:** fill `${CLAUDE_PLUGIN_ROOT}/templates/tradeoff-document.md` — the assumption map ("Claude assumes X → option A; agy assumes Y → option B") turns "who's right?" into "which assumption matches YOUR reality?"

## Academic Foundation

Irving et al. (2018) "AI safety via debate"; ExpertPrompting (2023) — detailed personas outperform simple role prompts; multi-agent debate research — diverse perspectives catch more flaws than homogeneous critics.
