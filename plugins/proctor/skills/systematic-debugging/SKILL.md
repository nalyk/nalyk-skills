---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes
---

# Systematic Debugging

## Overview

**Core principle:** ALWAYS find root cause before attempting fixes.
Symptom fixes are failure.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.

## The Four Phases

Complete each phase before proceeding to the next.

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read error messages carefully.** Don't skip past errors or warnings.
   Read stack traces completely. Note line numbers, file paths, error
   codes.

2. **Reproduce consistently.** Can you trigger it reliably? What are the
   exact steps? If not reproducible, gather more data — don't guess.

3. **Check recent changes.** Git diff, recent commits, new dependencies,
   config changes, environmental differences.

4. **Gather evidence in multi-component systems.** Before proposing fixes,
   add diagnostic instrumentation at each component boundary. Log what
   enters, what exits, verify environment propagation. Run once to gather
   evidence showing WHERE it breaks. Then analyze.

5. **Trace data flow.** Where does the bad value originate? What called
   this with the bad value? Keep tracing up until you find the source.
   Fix at source, not at symptom.

### Phase 2: Pattern Analysis

1. **Find working examples.** Locate similar working code in the same
   codebase.
2. **Compare against references.** Read reference implementations
   COMPLETELY. Don't skim.
3. **Identify differences.** List every difference, however small.
4. **Understand dependencies.** What other components does this need?
   What assumptions does it make?

### Phase 3: Hypothesis and Testing

1. **Form single hypothesis.** "I think X is the root cause because Y."
   Write it down. Be specific.
2. **Test minimally.** SMALLEST possible change. One variable at a time.
3. **Verify.** Did it work? → Phase 4. Didn't work? → new hypothesis.
   DON'T add more fixes on top.
4. **When you don't know.** Say "I don't understand X." Don't pretend.

### Phase 4: Implementation

1. **Create failing test case** reproducing the bug. MUST have before
   fixing. Use proctor:test-driven-development.
2. **Implement single fix.** Address root cause. ONE change at a time.
3. **Verify fix.** Test passes? No other tests broken? Use
   proctor:verification-before-completion before claiming success.
4. **If 3+ fixes failed: question the architecture.** Each fix revealing
   new problems in different places indicates architectural problems, not
   bugs. STOP and discuss with your human partner.

## Red Flags — STOP and Return to Phase 1

- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- Proposing solutions before tracing data flow
- "One more fix attempt" (when already tried 2+)
- Each fix reveals new problem in different place

## Hook Enforcement

Proctor's hooks reinforce this discipline mechanically:

- **Fix-round cap:** The hook tracks how many fix attempts you've made
  in an SDD cycle. Past the configured cap (default 5), it refuses
  further dispatch and forces adjudication. This prevents infinite guess-and-check
  loops.
- **Test gate:** The git gate blocks commits without fresh, passing test
  evidence. You cannot skip Phase 4's "create failing test case" step —
  the gate enforces it at commit time.
- **Test freshness:** Evidence expires after a configurable window
  (default 5 minutes). Stale evidence from before your fix attempt
  doesn't count.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Issue is simple" | Simple issues have root causes. Process is fast for simple bugs. |
| "Emergency, no time" | Systematic debugging is FASTER than guess-and-check. |
| "Just try this first" | First fix sets the pattern. Do it right from the start. |
| "I see the problem" | Seeing symptoms ≠ understanding root cause. |
| "One more fix attempt" (after 2+) | 3+ failures = architectural problem. Question pattern. |
