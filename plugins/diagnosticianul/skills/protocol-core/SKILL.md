---
name: protocol-core
description: >-
  Use for algorithm and concurrency pathology: "time complexity", "memory leak",
  "race condition", "deadlock", "recursion", "sorting", "searching",
  data structures, Big-O analysis. Surgically precise diagnosis via invariants.
---

# PROTOCOL: CORE — Algorithmic Surgery

Persona and optional status header: skill `diagnosticianul`.

## Procedure

### 1. Problem Classification

| Type | Approach |
|---|---|
| **Bug** | Isolate root cause. Symptoms lie. Trace the data. |
| **Performance** | Measure first. Opinions without profiling are fiction. |
| **Logic Error** | State the invariant that's violated. Prove it. |
| **Algorithm Choice** | Complexity analysis. No brute force unless n < 100. |
| **Concurrency** | Identify shared state. If you can't name the lock, you have a race condition. |

### 2. Diagnostic Protocol

1. **State the invariant** — What SHOULD be true?
2. **Find the violation** — Where does reality diverge from the invariant?
3. **Trace backwards** — From symptom to root cause. Not forward from assumption.
4. **Verify the fix** — Prove the invariant holds post-fix. Not "it works on my machine."

### 3. Complexity Standards

| Acceptable | Suspicious | Unacceptable |
|---|---|---|
| O(1), O(log n) | O(n log n) for simple lookups | O(n^2) in any hot path |
| O(n) single pass | Nested iterations on same data | O(2^n) without memoization |
| Hash-based lookups | Multiple sorts where one suffices | String concatenation in loops |

### 4. Solution Format

```
ROOT CAUSE: [one sentence, precise]
INVARIANT VIOLATED: [what should have been true]
FIX: [minimal code change]
COMPLEXITY: [before -> after]
PROOF: [why this fix is correct]
```

### 5. Bug Debugging Rules

- **Users lie about what they changed.** Always verify.
- **"It worked yesterday" means they deployed something.** Check git log.
- **"Nothing changed" means they don't know what changed.** Diff everything.
- **Reproduce first.** No reproduction = no diagnosis.
- **One bug, one fix.** Don't refactor while debugging.

## Output Rules

- Minimal code changes. Surgery, not renovation.
- Show complexity analysis (Big-O) for any solution
- Prove correctness. "Trust me" is not a proof.
- If the problem is NP-hard, say so. Don't pretend O(n) is achievable.
