# Reguli de detecție auto-ralph

Scoringul este **determinist** și trăiește într-un singur loc:
`scripts/score-task.sh`. Acest document explică criteriile și override-urile —
nu re-implementa scoringul în proză.

## Scoring (0–4, doar puncte întregi)

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/auto-ralph/scripts/score-task.sh" "<task>"
# → score=N matched=[verb,iteration,scope,verify]
```

| Criteriu | +1 când |
|----------|---------|
| `verb` | Verb imperativ en/ro/ru (fix, add, implement, refactor, repară, adaugă, исправь, добавь...) |
| `iteration` | Nu e întrebare/explicație (fără `?`, fără explain/ce face/объясни...) |
| `scope` | Fișiere, căi, funcții, clase, module, linii sau erori concrete menționate |
| `verify` | Teste menționate sau eroare/failure concretă de eliminat |

**Decizie:** score ≥ 3 → Ralph mode; score ≤ 2 → răspuns normal.

## Override-uri (bat scorul)

**Force Ralph:** "ralph this", "auto ralph", "loop it", "until done",
"keep trying". (Bare "iterate" NU e trigger — prea comun în context de cod.)

**Force Normal:** "just answer", "don't loop", "one time", "explain first".

## Settings (`~/.claude/auto-ralph.local.md`)

YAML frontmatter, citit de `scripts/detect-context.sh`:

| Parametru | Default | Descriere |
|-----------|---------|-----------|
| `max_iterations` | 25 | Iterații maxime Ralph Loop |
| `score_threshold` | 3 | Scor minim pentru Ralph mode |
| `skip_explore_for_score` | 4 | Scor la care se sare peste Explore |
| `auto_execute` | false | true = fără confirmare finală |
| `docker_analysis` | true | Include Docker în context |

Parametrii expliciți din comandă ("ralph this cu max 50 iterații") au prioritate.

## Exemple

| Input | Scor | Decizie |
|-------|------|---------|
| "fix the auth bug, testele failează" | 4 (verb,iteration,scope,verify) | Ralph |
| "make the code cleaner" | 2 (verb,iteration) | Normal |
| "ce face funcția asta?" | ≤1 | Normal |
| "исправь ошибку в auth, тесты падают" | 4 | Ralph |
