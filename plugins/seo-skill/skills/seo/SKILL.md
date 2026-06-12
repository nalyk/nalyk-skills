---
name: seo
description: >
  Deterministic SEO analysis via Python engine (98 checks, crawler, real CWV,
  link graph, auto-fixes, regression history). Triggers on: SEO audit, schema
  markup, Core Web Vitals, E-E-A-T, hreflang, GEO/AI Overviews, sitemap, llms.txt.
---

# SEO — Deterministic SEO Analysis Engine

Every numeric score comes from the Python engine (98 atomic checks, traceable
formulas). **NEVER invent a numeric score** — run the engine; prose is for
recommendations only.

## Engine Execution

```bash
# Full audit (use ${CLAUDE_PLUGIN_ROOT}/.venv/bin/python if a venv exists)
cd "${CLAUDE_PLUGIN_ROOT}" && python3 -m engine.cli audit <URL> --compare --output report.md

# Real CWV / GSC data (both optional)
cd "${CLAUDE_PLUGIN_ROOT}" && PAGESPEED_API_KEY="$KEY" python3 -m engine.cli audit <URL> --gsc-credentials /path/to/sa.json

# Audit history / CI gating
cd "${CLAUDE_PLUGIN_ROOT}" && python3 -m engine.cli history <URL>
cd "${CLAUDE_PLUGIN_ROOT}" && python3 -m engine.cli audit <URL> --compare --fail-on-regression
```

Deps: `beautifulsoup4`, `requests`, `lxml` (core); `aiohttp`, google-api
packages (optional). Engine degrades gracefully if optional deps are missing.

## Routing

Load the matching reference on demand — do NOT load all at startup. Each row:
Read `${CLAUDE_PLUGIN_ROOT}/skills/seo/references/<topic>.md`, then act.

| Topic / user intent | Reference | Engine command |
|---------------------|-----------|----------------|
| Full site audit, "audit my site" | `audit.md` | `engine.cli audit <url> --compare` |
| Single-page analysis | `page.md` | `engine.cli audit <url> --max-pages 1` |
| Generate/apply fixes | `fix.md` | run audit first, then auto-fixer |
| Internal links, PageRank, orphans | `linkgraph.md` | crawl, then `engine/link_graph.py` |
| History, regressions, CI/CD | `monitor.md` | `engine.cli history <url>` |
| Technical SEO, robots.txt, security | `technical.md` | — |
| Content quality, E-E-A-T | `content.md` | — |
| Schema / structured data | `schema.md` | — |
| Sitemaps (analyze/generate) | `sitemap.md` | — |
| Image optimization | `images.md` | — |
| GEO, AI Overviews, llms.txt | `geo.md` | — |
| SEO strategy / planning | `plan.md` | templates in `references/plan-assets/` |
| Programmatic SEO at scale | `programmatic.md` | — |
| Comparison / alternatives pages | `competitor-pages.md` | — |
| Hreflang / international | `hreflang.md` | — |
| Server log analysis | `logfile.md` | — |

Shared single-source-of-truth references (cite, never restate):
`quality-gates.md`, `cwv-thresholds.md`, `schema-types.md`,
`eeat-framework.md`, `ai-crawlers.md`.

## Subagents (7)

For parallel full-site analysis, dispatch via Task: `seo-technical`,
`seo-content`, `seo-schema`, `seo-sitemap`, `seo-performance`, `seo-visual`,
`seo-linkgraph` (defined in `${CLAUDE_PLUGIN_ROOT}/agents/`).

## Scoring Weights (computed by engine)

Technical 25%, Content 25%, On-Page 20%, Schema 10%, CWV 10%, Images 5%,
AI Search 5%.
