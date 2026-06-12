# SEO Monitoring & Regression Detection

Track SEO health over time and catch regressions before they hit production.

## Commands

| Command | What it does |
|---------|-------------|
| `/seo history <url>` | Show audit score history |
| `/seo audit <url> --compare` | Audit with regression detection |
| `/seo monitor setup` | Generate CI/CD config files |

## Audit History

Stored in SQLite at `~/.claude/seo-audit-history.db`.

### What's Tracked
- Overall score and all category scores
- Every individual check result with evidence
- Pages crawled count
- Timestamps for trend analysis

### Comparison Output
```
📈 Compared with previous audit (2026-02-09):
  Overall: ↑ +4.2 points (68.3 → 72.5)

  Category changes:
  - Technical: ↑ +2.1
  - Content:   ↑ +5.3
  - Schema:    ↑ +8.0
  - CWV:       ↓ -1.2

  New issues (3):
  - tech.url.no_redirect_chains
  - images.alt_text.descriptive
  - geo.llms_txt.exists

  Resolved issues (5):
  - onpage.title.exists
  - schema.no_placeholder
  - tech.security.hsts
  - onpage.meta_desc.exists
  - content.eeat.contact_info
```

## CI/CD Integration

### GitHub Actions
Copy `ci/github-action.yml` to `.github/workflows/seo-audit.yml`.

Triggers:
- On push to main (when HTML/PHP/JSX files change)
- Weekly scheduled run (Monday 6am)
- PR comments with audit summary

### GitLab CI
Copy `ci/gitlab-ci.yml` to your `.gitlab-ci.yml`.

### Merge Blocking
Use `--fail-on-regression` flag to exit with code 1 if score decreased:
```bash
cd "${CLAUDE_PLUGIN_ROOT}" && python3 -m engine.cli audit https://yoursite.com --compare --fail-on-regression
```

## Standalone Regression Check

After an audit that wrote `audit-report.json` or `FULL-AUDIT-REPORT.json`
to the working directory, run:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/hooks/regression-check.py"
```

It compares with the last stored audit and exits 2 if the score dropped
more than 5 points (use that exit code to block CI or a release step).
