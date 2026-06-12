# Audit Agent

Four slash commands for auditing products and code through three complementary lenses.

## Installation

```bash
/plugin install audit-agent@nalyk-skills
```

## Commands

| Command | Framework | Best For |
|---------|-----------|----------|
| `/jobs-audit <subject>` | Steve Jobs design thinking — 13 simplification questions | feature bloat, design audits |
| `/carlin-audit <subject>` | George Carlin BS detector — 13 truth questions | marketing speak, corporate speak, hollow claims |
| `/vibe-audit <path>` | Brutal engineering audit — 20 scored metrics | vibe checks, slop checks, technical due diligence |
| `/multi-audit <target> [--jobs] [--carlin] [--vibe] [--all]` | Parallel subagents + cross-framework synthesis | major releases, acquisitions |

## How It Works

- Each audit scopes itself first: only items applicable to the artifact class are assessed; skipped items are listed with a reason, and output ends with "N/M applicable items assessed."
- `/vibe-audit` marks non-assessable metrics N/A and renormalizes the final score over assessable ones.
- `/multi-audit` subagents read and execute the individual command files directly (single source of truth), then synthesize via `references/synthesis-matrix.md`.
- Shared evidence/hygiene standards live in `references/audit-protocol.md`.

## File Structure

```
audit-agent/
├── .claude-plugin/plugin.json
├── commands/
│   ├── jobs-audit.md
│   ├── carlin-audit.md
│   ├── vibe-audit.md
│   └── multi-audit.md
├── references/
│   ├── synthesis-matrix.md
│   └── audit-protocol.md
└── README.md
```

## License

MIT
