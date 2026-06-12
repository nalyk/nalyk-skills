# SEO Auto-Fix Generation & Application

Generate and optionally apply ready-to-use fixes for all detected SEO issues.
Unlike v1 which said "add schema" — v2 generates the ACTUAL schema from your
page content, ready to paste.

## Commands

| Command | What it does |
|---------|-------------|
| `/seo fix <url>` | Generate fixes for all issues |
| `/seo fix <url> --apply` | Apply fixes to local project files |
| `/seo fix <url> --type schema` | Generate only schema fixes |
| `/seo fix <url> --type security` | Generate only security header fixes |

## Fix Categories

### HTML Injection Fixes
- Missing/bad title tags → generated from page content
- Missing meta descriptions → auto-generated from first meaningful text
- Missing canonical tags → self-referencing to final URL
- Missing viewport meta → standard mobile viewport
- Missing OG tags → generated from title + description + URL
- Missing alt text → descriptive text from image filename/context

### File Creation Fixes
- Missing robots.txt → generated with AI crawler recommendations
- Missing sitemap.xml → generated from crawled page URLs
- Missing llms.txt → generated from site structure

### Schema Generation
- Missing Organization schema → from homepage title + URL
- Missing Article schema → from page headings + dates + author
- Missing Product schema → from product page content
- Missing BreadcrumbList → from URL hierarchy
- Deprecated schema → replacement with current types

### Configuration Fixes
- Missing HSTS → Nginx/Apache/Cloudflare configs
- Missing CSP → starter policy with report-only mode
- Missing X-Content-Type-Options → one-line config

### Content Suggestions
- Internal link opportunities → source page + target + anchor text
- Heading hierarchy fixes → corrected H1-H3 structure
- Thin content warnings → minimum word count guidance

## How It Works

The engine uses `engine/auto_fixer.py` which:
1. Takes the list of failed checks from `engine/scorer.py`
2. For each check, dispatches to a specific fix generator
3. Fix generators use REAL page data (not templates with placeholders)
4. Returns structured Fix objects with code, description, and impact

## Apply Mode

When `--apply` is used:
- Searches local project for matching files
- Applies HTML fixes via string replacement
- Creates new files (robots.txt, sitemap.xml, llms.txt) in project root
- All changes shown as diff before applying
- User confirms before any file modification
