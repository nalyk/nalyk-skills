# Full Website SEO Audit (v2 — Engine-Powered)

## Process

1. **Crawl site** — `engine/crawler.py` async spider (up to 500 pages)
   - BFS with depth limiting, robots.txt obedience
   - Extract meta tags, headings, images, links, schema per page
   - Track redirects, broken links, content fingerprints
   - Parse sitemap, detect orphan pages

2. **Measure CWV** — `integrations/pagespeed.py`
   - Real LCP, INP, CLS from CrUX field data (75th percentile)
   - Lighthouse lab scores (performance, accessibility, SEO)
   - Optimization opportunities with estimated savings

3. **Score deterministically** — `engine/scorer.py`
   - 98 registered checks, each with formula
   - Weighted category aggregation → overall 0-100 score
   - Every number traceable to raw evidence

4. **Analyze link graph** — `engine/link_graph.py`
   - PageRank-like internal link scoring
   - Orphan/dead-end detection
   - Cannibalization detection
   - Auto-suggested missing internal links

5. **Generate fixes** — `engine/auto_fixer.py`
   - Ready-to-apply patches for every issue
   - Meta tags, schema, robots.txt, llms.txt, security headers
   - Generated from actual page content (not templates)

6. **Compare & store** — `engine/db.py`
   - SQLite audit history
   - Regression detection vs previous audit
   - Score trends over time

## Running the Engine

```bash
# Full audit (use .venv/bin/python instead of python3 if ${CLAUDE_PLUGIN_ROOT}/.venv exists)
cd "${CLAUDE_PLUGIN_ROOT}" && python3 -m engine.cli audit <URL> --compare --output FULL-AUDIT-REPORT.md

# With PageSpeed API key for real Core Web Vitals
cd "${CLAUDE_PLUGIN_ROOT}" && PAGESPEED_API_KEY="$KEY" python3 -m engine.cli audit <URL> --compare --output FULL-AUDIT-REPORT.md

# JSON output for programmatic consumption (CI/CD, other agents)
cd "${CLAUDE_PLUGIN_ROOT}" && python3 -m engine.cli audit <URL> --output audit-data.json
```

All scores come from the engine. NEVER invent a numeric score; prose is for
recommendations only.

## Output Files

- `FULL-AUDIT-REPORT.md` — Comprehensive report with scores and fixes
- `ACTION-PLAN.md` — Prioritized recommendations
- `audit-data.json` — Machine-readable audit data (for CI/CD)

## Scoring Weights

| Category | Weight |
|----------|--------|
| Technical SEO | 25% |
| Content Quality | 25% |
| On-Page SEO | 20% |
| Schema / Structured Data | 10% |
| Performance (CWV) | 10% |
| Images | 5% |
| AI Search Readiness | 5% |

## Fallback Mode

If `aiohttp` is not installed, crawler falls back to synchronous `requests`
(slower but functional). If PageSpeed API fails, CWV checks return neutral
scores (0.5) with "data not available" message. The engine degrades
gracefully — all other checks still run.
