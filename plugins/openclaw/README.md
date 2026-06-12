# openclaw

Expert plugin for OpenClaw — the self-hosted, open-source multi-channel AI gateway. Reference corpus scraped from docs.openclaw.ai (268 pages), chrome-stripped, organized into 14 topic files.

## Installation

```bash
/plugin install openclaw@nalyk-skills
```

Pure knowledge plugin; no hooks, no external dependencies.

## How It Works

The `openclaw-expert` skill is a router: it greps the relevant `reference/*.md` file for keywords and `[Source: <url>]` page anchors, then Reads only the matching section (offset/limit). It never reads whole reference files. `reference/INDEX.md` maps every file to its page anchors. Topic routing table lives in `SKILL.md`.

Auto-activates on: OpenClaw, `openclaw.json`, ClawHub, pi-mono, gateway/channel setup for messaging-platform agent bots.

## Maintenance

```bash
scripts/strip-chrome.py [--check] [--index]   # strip scraped-site chrome, regen reference/INDEX.md
scripts/sync-docs.sh [--fetch]                # strip + index + print sizes; --fetch re-scrape is a documented stub
```

`strip-chrome.py` removes nav/sidebar/TOC blocks after each `[Source:]` anchor (corpus-frequency + TOC-repeat heuristics), drops `Copy` button artifacts, and unescapes HTML entities. It verifies the `[Source:]` anchor count per file is unchanged and fails otherwise. After a re-sync, update the size table in `skills/openclaw-expert/SKILL.md` from the printed sizes.

## Structure

```
openclaw/
├── .claude-plugin/plugin.json
├── scripts/
│   ├── strip-chrome.py
│   └── sync-docs.sh
└── skills/openclaw-expert/
    ├── SKILL.md                 # router: topic table + retrieval protocol + quick reference
    └── reference/               # 14 topic files (~1.2MB) + INDEX.md
```

## License

MIT
