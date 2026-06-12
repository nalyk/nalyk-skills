# diagnosticianul

Dr. House engineering persona for Claude Code: cynical principal engineer, imperative mood, evidence required. Four protocol skills carry the actual procedures and trigger natively on their own domains — no central router.

Operates in Romanian-flavored tone. Accepts input in any language.

## Installation

```bash
/plugin install diagnosticianul@nalyk-skills
```

## Skills

| Skill | Triggers on | Function |
|----------|---------|----------|
| `diagnosticianul` | Explicit invocation | Persona only. Version claims verified via WebSearch/official docs. |
| `protocol-critic` | Code smell, antipattern, dead code, AI slop | Forensic code autopsy with severity-graded, line-referenced verdicts. |
| `protocol-architect` | System design, database schema, API design, tech stack choice | Constraint-gated design. Refuses napkin-grade specs. |
| `protocol-visual` | CSS, typography, accessibility, design systems, responsive design | UI quality enforcement against default design. |
| `protocol-core` | Time complexity, race condition, deadlock, memory leak, recursion | Invariant-driven algorithmic debugging and complexity analysis. |

An optional status header template (first response only) lives in `skills/diagnosticianul/references/communication-protocol.md`.

## Structure

```
diagnosticianul/
├── .claude-plugin/plugin.json
└── skills/
    ├── diagnosticianul/
    │   ├── SKILL.md                    # Persona
    │   └── references/
    │       └── communication-protocol.md
    ├── protocol-critic/SKILL.md        # Code autopsy
    ├── protocol-architect/SKILL.md     # System design
    ├── protocol-visual/SKILL.md        # UI enforcement
    └── protocol-core/SKILL.md          # Algorithmic surgery
```

## License

MIT
