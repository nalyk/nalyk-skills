#!/usr/bin/env bash
# Re-sync the openclaw-expert reference corpus from docs.openclaw.ai.
#
# Pipeline:
#   1. fetch   — sitemap-driven re-scrape into reference/ (STUB, see below)
#   2. strip   — remove site chrome, Copy artifacts, HTML entities
#   3. index   — regenerate reference/INDEX.md
#   4. sizes   — print actual per-file sizes so the SKILL.md routing table
#                can be kept truthful
#
# Usage: sync-docs.sh [--fetch] [--strip-only]
#   default      strip + index + sizes (works offline)
#   --fetch      also attempt the re-scrape first (requires network access
#                to docs.openclaw.ai; currently a documented stub)
set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REF_DIR="$PLUGIN_ROOT/skills/openclaw-expert/reference"
SITEMAP_URL="https://docs.openclaw.ai/sitemap.xml"
SKILL_MD="$PLUGIN_ROOT/skills/openclaw-expert/SKILL.md"

fetch_docs() {
  # --- STUB ---------------------------------------------------------------
  # docs.openclaw.ai is frequently unreachable from build environments, so
  # the fetch step is a documented stub. To implement:
  #   1. curl the sitemap:
  #        curl -fsSL --max-time 30 "$SITEMAP_URL" \
  #          | grep -o '<loc>[^<]*</loc>' | sed 's/<\/\?loc>//g' > /tmp/urls.txt
  #   2. For each URL, fetch the page as text (e.g. `lynx -dump`, `pandoc`,
  #      or an r.jina.ai-style reader) and append it to the topic file that
  #      matches its path prefix (channels/* -> channels.md, cli/* -> cli.md,
  #      ...), preceded by:
  #        ---\n## <Topic> > <Page>\n\n[Source: <url>]\n
  #   3. The strip step below removes whatever chrome the scraper captured.
  # -------------------------------------------------------------------------
  echo "fetch: not implemented (stub). See comments in $0." >&2
  if ! timeout 15 curl -fsSL --max-time 10 -o /dev/null "$SITEMAP_URL" 2>/dev/null; then
    echo "fetch: $SITEMAP_URL unreachable from here anyway." >&2
  fi
  return 0
}

main() {
  local do_fetch=0
  for arg in "$@"; do
    case "$arg" in
      --fetch) do_fetch=1 ;;
      --strip-only) ;;
      *) echo "unknown arg: $arg" >&2; exit 2 ;;
    esac
  done

  [ "$do_fetch" -eq 1 ] && fetch_docs

  echo "== strip chrome + regenerate INDEX.md =="
  python3 "$PLUGIN_ROOT/scripts/strip-chrome.py" --index

  echo "== actual reference sizes (update the table in $SKILL_MD if drifted) =="
  du -k "$REF_DIR"/*.md | sort -rn | awk '{printf "%5dK  %s\n", $1, $2}'
}

main "$@"
