# Server Log Analysis for SEO

Analyze Nginx/Apache access logs to understand how search engines crawl your site.

## Commands

| Command | What it does |
|---------|-------------|
| `/seo logfile <path>` | Analyze access log file |
| `/seo logfile <path> --bot googlebot` | Filter to specific bot |

## What It Detects

### Crawler Activity
- Googlebot (desktop + mobile) frequency and patterns
- AI crawler activity (GPTBot, ClaudeBot, PerplexityBot)
- Bingbot, Yandex, other search engine crawlers
- Crawl frequency by URL path and time of day

### Crawl Budget Waste
- URLs returning 404/410 that bots keep requesting
- Redirect chains bots are following
- Query parameter URLs being crawled unnecessarily
- Pages with low content value receiving high crawl attention

### Anomaly Detection
- Sudden crawl rate changes (spike or drop)
- New bot user agents appearing
- Unusual status code patterns
- Pages that stopped being crawled

## Log Format Support
- Nginx combined format (default)
- Apache combined format
- Custom formats (auto-detected)

## Output
- `LOGFILE-ANALYSIS.md` — Comprehensive crawl analysis
- Bot activity summary with charts
- Crawl budget optimization recommendations
