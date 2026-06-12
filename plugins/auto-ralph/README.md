# auto-ralph

Gates imperative coding tasks into Ralph Loops. A `UserPromptSubmit` hook
detects imperative verbs (en/ro/ru) and explicit triggers, and — only then —
emits a one-line nudge to invoke the `auto-ralph` skill. The skill scores the
task deterministically (0–4) and routes score ≥ 3 to `/ralph-loop`.

Depends on the `ralph-loop` plugin.

## Installation

```bash
/plugin install auto-ralph@nalyk-skills
```

## How it works

```
User prompt → hook matches imperative verb / trigger → one-line nudge →
  skill runs scripts/score-task.sh (0-4) →
    score >= 3 → detect context → generate prompt → confirm → /ralph-loop
    score <= 2 → normal response
```

No verb match, force-off phrase ("just answer", "don't loop", "explain first",
"one time"), or no match at all → the hook stays silent. If a loop is already
active (`.claude/ralph-loop.local.md`), the hook warns instead of re-triggering.

## Triggers

- **Explicit (always):** "ralph this", "auto ralph", "loop it", "until done"
- **Auto (score >= 3):** imperative verb (fix/add/implement/refactor, repară/
  adaugă, исправь/добавь...) plus defined scope and verifiable completion
- **Disable:** "just answer", "don't loop", "explain first", "one time"

## Scoring

`skills/auto-ralph/scripts/score-task.sh "<task>"` → `score=N matched=[...]`
(+1 each: imperative verb, iteration-friendly, defined scope, verifiable).
Details: `skills/auto-ralph/references/detection-rules.md`.

## Configuration

`~/.claude/auto-ralph.local.md` (YAML frontmatter): `max_iterations` (25),
`score_threshold` (3), `skip_explore_for_score` (4), `auto_execute` (false),
`docker_analysis` (true). Explicit command parameters override settings.

## Language

Output: Romanian. Input: en/ro/ru/mixed. Completion promise: "GATA".
