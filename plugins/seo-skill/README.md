# SEO Skill — Deterministic SEO Engine

SEO analysis plugin for Claude Code with **reproducible, deterministic
scoring**. Every score is computed by a Python engine from 98 atomic checks
with traceable formulas — same URL, same score, every time. Claude never
invents numbers.

## Structure

- `skills/seo/` — single orchestrator skill; routes every SEO topic (audit,
  technical, content, schema, sitemap, images, GEO, hreflang, programmatic,
  planning, link graph, monitoring, log files) to on-demand reference files
  in `skills/seo/references/`
- `agents/` — 7 specialist subagents for parallel full-site analysis
- `engine/` — crawler, 98-check scorer, link graph, auto-fixer, SQLite
  history, report generator, CLI
- `integrations/` — PageSpeed Insights (real CWV) and Google Search Console
- `hooks/regression-check.py` — standalone regression gate (run explicitly,
  not wired as a hook)
- `ci/` — GitHub Actions and GitLab CI templates
- `schema/templates.json` — JSON-LD templates

## Installation

```bash
/plugin install seo-skill@nalyk-skills
```

Python deps (from the plugin root): `pip install -r requirements.txt`
(core: beautifulsoup4, requests, lxml; optional: aiohttp, google-api
packages for GSC). The engine degrades gracefully without optional deps.

## Usage

Ask Claude to audit a site ("audit https://example.com", "check schema",
"analyze Core Web Vitals", ...). The skill routes the topic and runs the
engine. Direct CLI:

```bash
python3 -m engine.cli audit https://example.com --compare --output report.md
python3 -m engine.cli history https://example.com
python3 -m engine.cli audit https://example.com --compare --fail-on-regression  # CI gate
```

Optional: set `PAGESPEED_API_KEY` for real Core Web Vitals (free, 25K
queries/day); pass `--gsc-credentials` for real search data.

## Scoring

98 checks across 7 weighted categories: Technical 25%, Content 25%,
On-Page 20%, Schema 10%, Performance (CWV) 10%, Images 5%, AI Search 5%.

## Tests

```bash
python3 -m pytest tests/ -v
```

## License

MIT — see [LICENSE](LICENSE). Knowledge base originally derived from
[AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo).
