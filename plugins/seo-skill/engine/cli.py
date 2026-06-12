"""CLI entry point for Claude SEO v2 engine.

Can be run standalone for testing or from Claude Code skills.
"""

import argparse
import json
import sys
from datetime import datetime

from engine import AuditResult, CrawlResult
from engine.crawler import SEOCrawler
from engine.scorer import ScoringEngine
from engine.auto_fixer import AutoFixer
from engine.report import generate_report
from engine.db import AuditDB


def run_audit(url: str, max_pages: int = 200, pagespeed_key: str = None,
              compare: bool = False, output: str = None,
              gsc_credentials: str = None, gsc_property: str = None,
              date_range_days: int = 28) -> AuditResult:
    """Run a complete SEO audit."""

    # 1. Crawl
    print(f"🕷️  Crawling {url} (max {max_pages} pages)...")
    crawler = SEOCrawler(max_pages=max_pages)
    crawl = crawler.crawl(url)
    print(f"   ✓ Crawled {crawl.pages_crawled} pages in {crawl.crawl_duration:.1f}s")

    # 2. CWV — try even without an API key (rate-limited)
    cwv = None
    try:
        from integrations.pagespeed import PageSpeedClient
        print(f"📊 Measuring Core Web Vitals...")
        psi = PageSpeedClient(api_key=pagespeed_key)
        cwv = psi.analyze(url, strategy="mobile")
        if cwv.source != "none":
            print(f"   ✓ CWV data from {cwv.source}: LCP={cwv.lcp_ms}ms, CLS={cwv.cls}")
        else:
            print(f"   ⚠ No CWV data available")
    except Exception as e:
        print(f"   ⚠ PageSpeed API unavailable: {e}")

    # 3. GSC (optional)
    search_data = None
    try:
        from integrations.gsc import GSCClient
        gsc = GSCClient(
            credentials_path=gsc_credentials,
            gsc_property=gsc_property,
            date_range_days=date_range_days,
        )
        print(f"🔍 Fetching Google Search Console data...")
        search_data = gsc.fetch(url)
        if search_data and search_data.source != "none":
            print(f"   ✓ GSC data: {search_data.total_impressions} impressions, "
                  f"avg position {search_data.avg_position}, "
                  f"{search_data.indexed_pages} indexed pages")
        else:
            print(f"   ⚠ GSC not configured — search checks return neutral (0.5)")
    except ImportError:
        print(f"   ⚠ GSC deps not installed (google-api-python-client) — skipping")
    except Exception as e:
        print(f"   ⚠ GSC unavailable: {e}")

    # 4. Score
    print(f"📋 Running {len(ScoringEngine()._checks)} deterministic checks...")
    engine = ScoringEngine()
    context = {
        "pages": crawl.pages,
        "crawl": crawl,
        "cwv": cwv,
        "search_data": search_data,
        "robots_txt": crawl.robots_txt,
        "sitemap_urls": crawl.sitemap_urls,
        "llms_txt": "",  # Would be fetched by crawler
    }
    overall, categories, issues = engine.run_all(context)
    failed = [i for i in issues if not i.passed]
    print(f"   ✓ Score: {overall}/100 ({len(failed)} issues found)")

    # 5. Impact-weighted sort: crawl depth by default, GSC impressions overlay
    if search_data and search_data.page_impressions:
        import math
        def _impact_key(issue):
            """Sort by severity first, then by GSC impressions (log-scaled)."""
            sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
            sev = sev_order.get(issue.severity.value, 5)
            # Find max impressions for any page this check relates to
            max_imp = max(search_data.page_impressions.values()) if search_data.page_impressions else 1
            imp_score = 0
            for url in search_data.page_impressions:
                if url in issue.evidence.get("pages", []) or url in issue.evidence.get("thin_pages", []):
                    imp_score = max(imp_score, search_data.page_impressions[url])
            return (sev, -math.log1p(imp_score))
        issues.sort(key=_impact_key)

    # 6. Auto-fix
    print(f"🔧 Generating fixes...")
    fixer = AutoFixer()
    fixes = fixer.generate_fixes(issues, crawl)
    print(f"   ✓ {len(fixes)} fixes generated")

    # 7. Build result
    audit = AuditResult(
        url=url,
        timestamp=datetime.now().isoformat(),
        overall_score=overall,
        categories=categories,
        pages_crawled=crawl.pages_crawled,
        issues=issues,
        fixes=fixes,
        crawl_result=crawl,
        cwv_data=cwv,
        search_data=search_data,
    )

    # 8. Compare with previous
    if compare:
        db = AuditDB()
        previous = db.get_previous(url)
        if previous:
            audit.comparison = db.compare(audit, previous)
            delta = audit.comparison["score_delta"]
            arrow = "↑" if delta > 0 else ("↓" if delta < 0 else "→")
            print(f"📈 Compared with previous: {arrow} {delta:+.1f} points")

    # 9. Save to history
    try:
        db = AuditDB()
        db.save_audit(audit)
    except Exception:
        pass

    # 10. Generate report
    report = generate_report(audit)

    if output:
        with open(output, "w") as f:
            if output.endswith(".json"):
                json.dump({
                    "url": audit.url,
                    "timestamp": audit.timestamp,
                    "overall_score": audit.overall_score,
                    "categories": {cs.category: cs.score for cs in audit.categories},
                    "issues_count": len(failed),
                    "fixes_count": len(fixes),
                }, f, indent=2)
            else:
                f.write(report)
        print(f"\n📄 Report saved to {output}")
    else:
        print(f"\n{report}")

    return audit


def main():
    parser = argparse.ArgumentParser(description="Claude SEO v2 — Deterministic SEO Audit Engine")
    sub = parser.add_subparsers(dest="command")

    # audit
    audit_p = sub.add_parser("audit", help="Run full SEO audit")
    audit_p.add_argument("url", help="URL to audit")
    audit_p.add_argument("--max-pages", type=int, default=200, help="Max pages to crawl")
    audit_p.add_argument("--pagespeed-key", help="Google PageSpeed Insights API key")
    audit_p.add_argument("--compare", action="store_true", help="Compare with last audit")
    audit_p.add_argument("--output", "-o", help="Output file path (.md or .json)")
    audit_p.add_argument("--fail-on-regression", action="store_true",
                         help="Exit code 1 if score decreased (for CI)")
    audit_p.add_argument("--gsc-credentials", help="Path to GSC service account JSON")
    audit_p.add_argument("--gsc-property", help="GSC property URL (auto-detected if omitted)")
    audit_p.add_argument("--date-range", type=int, default=28,
                         help="GSC date range in days (default: 28)")

    # history
    hist_p = sub.add_parser("history", help="Show audit history")
    hist_p.add_argument("url", help="URL to show history for")
    hist_p.add_argument("--limit", type=int, default=10, help="Number of entries")

    args = parser.parse_args()

    if args.command == "audit":
        audit = run_audit(
            url=args.url,
            max_pages=args.max_pages,
            pagespeed_key=args.pagespeed_key,
            compare=args.compare,
            output=args.output,
            gsc_credentials=args.gsc_credentials,
            gsc_property=args.gsc_property,
            date_range_days=args.date_range,
        )
        if args.fail_on_regression and audit.comparison:
            if audit.comparison.get("score_delta", 0) < 0:
                print(f"\n❌ REGRESSION: Score decreased by {audit.comparison['score_delta']}")
                sys.exit(1)

    elif args.command == "history":
        db = AuditDB()
        history = db.get_history(args.url, limit=args.limit)
        if not history:
            print(f"No audit history for {args.url}")
            return
        print(f"\nAudit History for {args.url}")
        print(f"{'Date':<22} {'Score':>6} {'Tech':>6} {'Content':>8} {'Schema':>7} {'CWV':>6} {'Pages':>6}")
        print("-" * 65)
        for h in history:
            print(f"{h['timestamp'][:19]:<22} {h['overall_score']:>6.1f} {h['tech_score']:>6.1f} "
                  f"{h['content_score']:>8.1f} {h['schema_score']:>7.1f} {h['perf_score']:>6.1f} "
                  f"{h['pages_crawled']:>6}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
