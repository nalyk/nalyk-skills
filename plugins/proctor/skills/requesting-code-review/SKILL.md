---
name: requesting-code-review
description: Use when completing tasks, implementing features, or before merging to verify work
---

# Requesting Code Review

Dispatch a code reviewer subagent to catch issues before they cascade.

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:**
- After each task in subagent-driven development
- After completing a major feature
- Before merge to main

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Request

1. Get git SHAs:
```bash
BASE_SHA=$(git merge-base origin/main HEAD)
HEAD_SHA=$(git rev-parse HEAD)
```

2. Generate review package:
```bash
git log --oneline $BASE_SHA..$HEAD_SHA > review.md
git diff --stat $BASE_SHA..$HEAD_SHA >> review.md
git diff -U10 $BASE_SHA..$HEAD_SHA >> review.md
```

3. Dispatch reviewer with:
   - The review package path
   - The spec/plan paths
   - Global constraints
   - Any deferred/parked findings from the ledger

4. Specify the model explicitly — the final review is a judgment task
   and takes the most capable model.

## Handling Results

Sort findings before acting:
- **Critical/Important:** Enter fix pass
- **Minor:** Ledger as deferred, surface in final message
- **Declined to judge:** Your ruling — weigh against the spec

Every ruling is a ledger entry. Silent discards are forbidden.
