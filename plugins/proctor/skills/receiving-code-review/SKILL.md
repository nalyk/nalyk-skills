---
name: receiving-code-review
description: Use when receiving code review feedback — requires technical rigor and verification, not performative agreement
---

# Code Review Reception

Code review requires technical evaluation, not emotional performance.

**Core principle:** Verify before implementing. Ask before assuming.
Technical correctness over social comfort.

## The Response Pattern

1. **READ:** Complete feedback without reacting
2. **UNDERSTAND:** Restate requirement in own words (or ask)
3. **VERIFY:** Check against codebase reality
4. **EVALUATE:** Technically sound for THIS codebase?
5. **RESPOND:** Technical acknowledgment or reasoned pushback
6. **IMPLEMENT:** One item at a time, test each

## Forbidden Responses

- "You're absolutely right!" (performative, not technical)
- Implementing without understanding
- Accepting changes that break working code
- Agreeing just to avoid conflict

## When to Push Back

Push back when the suggestion would break existing tests, conflicts with
architectural decisions, or the reviewer misunderstands context. Push
back with evidence, not opinion.

## Classification Framework

Not all feedback is equal. Classify each item before acting:

| Category | Action | Example |
|----------|--------|---------|
| **Correctness** | Fix immediately, test | "This null check misses the empty-string case" |
| **Architecture** | Evaluate against codebase patterns | "Extract this into a service" |
| **Style/naming** | Accept if consistent with project | "Rename `getData` to `fetchUserProfile`" |
| **Speculative** | Push back with evidence | "What if we need X in the future?" |
| **Contradictory** | Flag the conflict, ask for resolution | Reviewer A says X, reviewer B says not-X |

## After Implementation

Run the full test suite after each change. Use
proctor:verification-before-completion before claiming the review is
addressed. The git gate blocks your commit if tests aren't fresh and
passing — this is intentional.
