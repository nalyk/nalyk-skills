---
name: requesting-code-review
description: Use when completing tasks, implementing features, or before merging to verify work
---

# Requesting Code Review

## Overview

Dispatch a code reviewer subagent to catch issues before they cascade.

**Core principle:** Review early, review often. A review you didn't
request is a review that found nothing — or a defect that shipped.

**Hook enforcement:** Proctor's SDD hooks track review dispatch and
fix-round counts. Past the fix-round cap (default 5) any further
dispatch is denied, forcing adjudication. The git gate blocks commits without fresh,
passing test evidence, so the reviewer always sees tested code.

## When to Use

**Mandatory:**
- After each task in proctor:subagent-driven-development
- After completing a major feature
- Before merge to the default branch (detected dynamically — never
  assume `main`)
- At the end of proctor:executing-plans (final review)

**Optional but valuable:**
- When stuck (fresh perspective from a different model)
- Before refactoring (baseline check)
- After fixing a complex bug
- When context is too polluted to self-review

## Process

### 1. Detect the base branch

Never hardcode `main` or `master`. Detect the default branch:

```bash
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null \
  | sed 's@^refs/remotes/origin/@@' || echo main)
```

### 2. Get git SHAs

```bash
BASE_SHA=$(git merge-base "origin/$DEFAULT_BRANCH" HEAD)
HEAD_SHA=$(git rev-parse HEAD)
```

### 3. Generate the review package

Write to a timestamped file, not a fixed name:

```bash
REVIEW_PKG="review-$(date +%Y%m%d-%H%M%S).md"
git log --oneline "$BASE_SHA".."$HEAD_SHA" > "$REVIEW_PKG"
git diff --stat "$BASE_SHA".."$HEAD_SHA" >> "$REVIEW_PKG"
git diff -U10 "$BASE_SHA".."$HEAD_SHA" >> "$REVIEW_PKG"
```

### 4. Compose the dispatch

The reviewer subagent receives:

1. **The review package path** — the file from step 3
2. **The spec/plan paths** — the brief or design doc the work was built
   against, so the reviewer checks spec compliance, not just code quality
3. **Global constraints** — naming conventions, test patterns, API shapes
4. **Deferred/parked findings** — anything from the ledger the reviewer
   should re-examine
5. **Reviewer instructions** — what to focus on (e.g., "check error
   handling at every boundary" or "verify the new endpoint matches the
   OpenAPI spec")

### 5. Select the model

Specify the model explicitly. The final review is a judgment task and
takes the most capable model. Per-task reviews during SDD may use a
standard model. Never omit the model — an omitted model inherits the
session's default, often the most expensive.

### 6. Dispatch the reviewer

Use proctor:receiving-code-review as the skill the reviewer follows.
The reviewer is a consumer of review feedback — its skill governs how
it classifies and responds to findings.

## Handling Results

Sort findings before acting:

- **Critical/Important:** Enter the fix loop. Each fix verified by TDD.
  Re-review after the fix pass.
- **Minor:** Ledger as deferred. Surface in the final message. Never
  enter the fix loop for minors alone.
- **Declined to judge:** Your ruling — weigh against the spec. Record
  as `Ruling: <what> — <why> — <cost if wrong>`.

Every ruling is a ledger entry. Silent discards are forbidden.

## Cross-Skill References

- **proctor:receiving-code-review** — the reviewer's skill; governs how
  findings are classified and responded to
- **proctor:subagent-driven-development** — per-task review dispatch
  happens inside the SDD task loop (step 3)
- **proctor:executing-plans** — final review dispatch at end of inline
  execution
- **proctor:verification-before-completion** — run before claiming the
  review is addressed

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Code is simple, doesn't need review" | Simple code breaks in integration. Review is fast for simple code. |
| "I'll review it myself" | Self-review misses what your context normalized. Fresh eyes catch it. |
| "Tests pass, that's enough" | Tests verify behavior. Review verifies design, readability, spec compliance. |
| "One more fix, then I'll request review" | Unbounded fix loops without review compound errors. Request review now. |
| "Review will slow us down" | Review catches issues before merge. Debugging in production is slower. |
| "I'll skip the spec paths, reviewer can figure it out" | A reviewer without the spec checks style, not correctness. Always include the spec. |

## Checklist

1. Detect default branch dynamically
2. Compute BASE_SHA and HEAD_SHA
3. Generate timestamped review package
4. Compose dispatch with spec paths, constraints, deferred findings, and
   reviewer instructions
5. Select model explicitly (most capable for final, standard for per-task)
6. Dispatch the reviewer
7. Sort findings: Critical/Important into fix loop, Minor into ledger
8. Record every ruling — no silent discards
9. Re-review after fix pass if Critical/Important findings were addressed
