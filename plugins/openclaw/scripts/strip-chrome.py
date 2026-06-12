#!/usr/bin/env python3
"""Strip scraped-site chrome from openclaw-expert reference files.

Each scraped section starts with a '[Source: <url>]' anchor followed by
nav/sidebar/TOC chrome before the real page content. This script:

1. Removes the chrome block after each [Source:] anchor. A leading line is
   chrome if it is a known nav pattern, appears >FREQ_THRESHOLD times across
   the whole corpus (sidebar lines repeat once per scraped page), or is a
   short heading that re-appears later in the same section (TOC entry).
   Consumption stops at the first line that is none of these.
2. Drops standalone 'Copy' lines (code-block copy-button artifacts).
3. Unescapes HTML entities (&quot; &amp; &#39; ...) and NBSPs.
4. Optionally regenerates reference/INDEX.md (--index): per file, the list
   of [Source:] page anchors with their section headings.

Safety invariant (verified, fails loudly): the '[Source:' count per file is
identical before and after.

Usage:
  strip-chrome.py [--check] [--index] [FILE ...]
  (no FILE args: all *.md in the skill's reference/ dir, INDEX.md excluded)
"""

import argparse
import html
import re
import sys
from collections import Counter
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
REFERENCE_DIR = PLUGIN_ROOT / "skills" / "openclaw-expert" / "reference"

FREQ_THRESHOLD = 50  # global sidebar lines repeat ~245-285x across the corpus
# Section-specific sidebar subtrees only repeat once per page of that area,
# so also flag lines appearing in >=70% of a file's own sections (min 5).
FILE_FREQ_RATIO = 0.7
FILE_FREQ_MIN = 5

KNOWN_CHROME = {
    "OpenClaw",
    "home page",
    "English",
    "GitHub",
    "Releases",
    "Copy",
    "Ask AI",
    "Ask or search...",
    "Search...",
    "Navigation",
    "On this page",
    "Was this page helpful?",
}

SOURCE_RE = re.compile(r"^\[Source: \S+\]\s*$")


NUMBERED_RE = re.compile(r"^\d+[.)]\s+")


def heading_like(line: str) -> bool:
    """Short nav/TOC-style line: no sentence punctuation, not code-ish.
    Numbered TOC entries ('3. Quality Assurance Workflows') count too."""
    core = NUMBERED_RE.sub("", line)
    return (
        0 < len(line) <= 60
        and not core.endswith((".", ":", ";", ","))
        and ". " not in core
        and not core.startswith(("```", "#", "{", "}", "[", "$", "-", "|", ">", "<"))
    )


def build_corpus_freq(paths):
    freq = Counter()
    for p in paths:
        for line in p.read_text(encoding="utf-8").splitlines():
            s = line.strip()
            if s:
                freq[s] += 1
    return freq


LOOKAHEAD = 8  # bridge short runs of low-freq sidebar entries


def strip_section_chrome(lines, start, freq, file_freq, file_thresh):
    """Return index of first real-content line at/after `start` (which is the
    line right after a [Source:] anchor). Lines in [start, result) are chrome."""
    # Find section end (next [Source:] anchor or EOF) for the TOC look-ahead.
    sec_end = len(lines)
    for j in range(start, len(lines)):
        if SOURCE_RE.match(lines[j]):
            sec_end = j
            break

    sec = [lines[j].strip() for j in range(start, sec_end)]

    def primary(k):
        """Line k of `sec` is definite chrome."""
        s = sec[k]
        return bool(s) and (
            s in KNOWN_CHROME
            or s.endswith(" - OpenClaw")
            or freq[s] > FREQ_THRESHOLD
            or (heading_like(s) and file_freq[s] >= file_thresh)
            or (heading_like(s) and s in sec[k + 1 :])  # TOC entry repeated below
        )

    i = 0
    while i < len(sec):
        s = sec[i]
        if not s or primary(i):
            i += 1
            continue
        # Sidebar entries unique to a few pages: consume heading-like lines
        # while definite chrome still appears within the lookahead window.
        if heading_like(s) and any(
            primary(k) for k in range(i + 1, min(i + 1 + LOOKAHEAD, len(sec)))
        ):
            i += 1
            continue
        break
    return start + i


def process_text(text, freq):
    lines = text.splitlines()
    file_freq = Counter(l.strip() for l in lines if l.strip())
    n_sections = sum(1 for l in lines if SOURCE_RE.match(l))
    file_thresh = max(FILE_FREQ_MIN, int(FILE_FREQ_RATIO * n_sections))
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        out.append(line)
        i += 1
        if SOURCE_RE.match(line):
            i = strip_section_chrome(lines, i, freq, file_freq, file_thresh)
            out.append("")  # one blank line between anchor and content
    # Drop standalone 'Copy' lines, unescape entities, collapse blank runs.
    cleaned = []
    for line in out:
        if line.strip() == "Copy":
            continue
        line = html.unescape(line).replace(" ", " ")
        if line.strip() == "" and cleaned and cleaned[-1] == "":
            continue
        cleaned.append(line.rstrip())
    return "\n".join(cleaned).rstrip() + "\n"


def section_title_for(lines, anchor_idx):
    """Nearest preceding markdown '## ' heading for a [Source:] anchor."""
    for j in range(anchor_idx - 1, -1, -1):
        if lines[j].startswith("## "):
            return lines[j][3:].strip()
        if SOURCE_RE.match(lines[j]):
            break
    return ""


def write_index(paths):
    out = [
        "# Reference Section Index",
        "",
        "Generated by scripts/strip-chrome.py --index. Maps each reference",
        "file to its `[Source:]` page anchors. Grep the target file for the",
        "anchor URL, then Read with offset/limit around the hit.",
        "",
    ]
    for p in sorted(paths, key=lambda p: p.name):
        lines = p.read_text(encoding="utf-8").splitlines()
        out.append(f"## {p.name}")
        for idx, line in enumerate(lines):
            m = SOURCE_RE.match(line)
            if m:
                url = line.strip()[len("[Source: ") : -1]
                title = section_title_for(lines, idx)
                out.append(f"- {title} — {url}")
        out.append("")
    (REFERENCE_DIR / "INDEX.md").write_text("\n".join(out), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("files", nargs="*", type=Path)
    ap.add_argument("--check", action="store_true", help="dry run, print stats only")
    ap.add_argument("--index", action="store_true", help="regenerate reference/INDEX.md")
    args = ap.parse_args()

    paths = args.files or sorted(
        p for p in REFERENCE_DIR.glob("*.md") if p.name != "INDEX.md"
    )
    if not paths:
        sys.exit("no reference files found")

    freq = build_corpus_freq(paths)
    failed = False
    for p in paths:
        before = p.read_text(encoding="utf-8")
        after = process_text(before, freq)
        n_before = before.count("[Source:")
        n_after = after.count("[Source:")
        if n_before != n_after:
            print(f"FAIL {p.name}: [Source:] count {n_before} -> {n_after}", file=sys.stderr)
            failed = True
            continue
        pct = 100 * (1 - len(after) / len(before)) if before else 0
        print(f"{p.name}: {len(before)} -> {len(after)} bytes (-{pct:.1f}%), {n_before} sections")
        if not args.check:
            p.write_text(after, encoding="utf-8")
    if failed:
        sys.exit(1)
    if args.index:
        write_index(paths)
        print(f"wrote {REFERENCE_DIR / 'INDEX.md'}")


if __name__ == "__main__":
    main()
