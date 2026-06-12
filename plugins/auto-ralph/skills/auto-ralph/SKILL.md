---
name: auto-ralph
description: >-
  Decides whether an imperative coding task (fix/add/implement/refactor —
  en/ro/ru) should run as a Ralph Loop via /ralph-loop. Invoke when the prompt
  has an imperative verb PLUS multi-step or verifiable scope (tests, concrete
  error, named files), or on explicit triggers "ralph this", "auto ralph",
  "loop it", "until done". Never on questions or "just answer"/"don't loop".
---

# auto-ralph

Gate skill: scores imperative coding tasks and routes score ≥ 3 to a Ralph Loop.
Output: MEREU română. Input: en/ro/ru/mixed, fără întrebări despre limbă.

## Contract de activare

Primul output, mereu:

```
(AUTONALYK) ═══════════════════════════════════
  Task detectat: [tip]
  Scor: [X]/4 → [Ralph mode / Normal mode]
═══════════════════════════════════════════════
```

## Faza 0 — Loop activ (OBLIGATORIU)

Dacă există `.claude/ralph-loop.local.md`: avertizează (loop deja activ, opțiuni:
așteaptă / `/cancel-ralph` / adaugă manual la loop-ul curent) și **STOP** — al
doilea loop corupe starea.

## Faza 1 — Scoring determinist

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/auto-ralph/scripts/score-task.sh" "<promptul userului>"
```

Output: `score=N matched=[...]`. Decizie: **score ≥ 3 → Ralph mode**; score ≤ 2 →
afișează bannerul și răspunde normal (fără celelalte faze). Override-uri
explicite (force-on/force-off) bat scorul — vezi `references/detection-rules.md`.

## Faza 1.5 — Explore (opțional)

Refactor mare sau cod necunoscut la scor 3–4 → rulează întâi un subagent
Explore (Task tool, `subagent_type: "Explore"`). Template-uri de prompt:
`references/explore-patterns.md`.

## Faza 2 — Context

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/auto-ralph/scripts/detect-context.sh" [dir]
```

JSON cu: git, tests (posibil `NO_TESTS_DETECTED`), errors, structure, docker,
settings (din `~/.claude/auto-ralph.local.md`; parametrii expliciți din comandă
au prioritate).

## Faza 3 — Generare prompt

Alege template din `references/prompt-patterns.md` (bug-fix / feature / test /
refactor / general; varianta NO_TESTS când nu există teste). Include mereu
promise `<promise>GATA</promise>` și reminder `/cancel-ralph`.

## Faza 4 — Confirmare (SINGURA întrebare)

Arată preview-ul prompt-ului și întreabă:
`Execut? (max 25 iterații) [Da - Recomandat] [Modifică prompt] [Nu]`
(sare peste dacă `auto_execute: true` în settings).

## Faza 5 — Execuție (prompt-file, OBLIGATORIU)

1. **Scrie prompt-ul** cu Write tool în `/tmp/ralph-prompt.txt`.
2. **Invocă** (comandă single-line):
   ```bash
   /ralph-loop --prompt-file /tmp/ralph-prompt.txt --max-iterations 25 --completion-promise "GATA"
   ```

**DE CE:** Claude Code Bash tool respinge comenzi cu newline-uri. Prompt-ul
multi-line inline cauzează `Bash command permission check failed`.

**NU FOLOSI NICIODATĂ** forma inline (va eșua):
```bash
# BROKEN - newlines in $ARGUMENTS cause Bash rejection
/ralph-loop "multi\nline\nprompt" --max-iterations 25 --completion-promise "GATA"
```

## Safety

- Max iterations mereu setat (default 25).
- Nu executa fără confirmare; nu cere clarificări inutile.
- Promise onestă: instruiește explicit să NU emită `GATA` neverificat.

## Referințe

- `references/detection-rules.md` — criterii scoring + override-uri + settings
- `references/explore-patterns.md` — template-uri Explore
- `references/prompt-patterns.md` — template-uri prompt + exemplu complet
