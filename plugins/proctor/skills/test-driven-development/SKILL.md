---
name: test-driven-development
description: Use when implementing any feature or bugfix, before writing implementation code
---

# Test-Driven Development (TDD)

## Overview

Write the test first. Watch it fail. Write minimal code to pass.

**Core principle:** If you didn't watch the test fail, you don't know if
it tests the right thing.

**Hook enforcement:** Proctor's git gate blocks commit and push when the
last test run failed or no tests have run in this session. TDD violations
that reach a commit are mechanically stopped.

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write code before the test? Delete it. Start over.

No exceptions:
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Delete means delete

## Red-Green-Refactor

### RED — Write Failing Test

Write one minimal test showing what should happen.

Requirements:
- One behavior per test
- Clear name that describes behavior
- Real code, not mocks (unless unavoidable)

### Verify RED — Watch It Fail

**MANDATORY. Never skip.**

Confirm:
- Test fails (not errors)
- Failure message is expected
- Fails because feature missing (not typos)

Test passes? You're testing existing behavior. Fix test.
Test errors? Fix error, re-run until it fails correctly.

### GREEN — Minimal Code

Write the simplest code to pass the test.

Don't add features, refactor other code, or "improve" beyond the test.

### Verify GREEN — Watch It Pass

**MANDATORY.**

Confirm:
- Test passes
- Other tests still pass
- Output pristine (no errors, warnings)

Test fails? Fix code, not test.
Other tests fail? Fix now.

**"Other tests" means the project's suite, not just your file.** Run the
project's test command even when your task named only one test file.

### REFACTOR — Clean Up

After green only: remove duplication, improve names, extract helpers.
Keep tests green. Don't add behavior.

## Exceptions (Ask Your Human Partner)

- Throwaway prototypes
- Generated code
- Configuration files

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests written after pass immediately — proves nothing. |
| "Already manually tested" | Manual testing is ad-hoc, no record, no re-run. |
| "Deleting X hours is wasteful" | Sunk cost fallacy. Keeping untrusted code is the waste. |
| "TDD will slow me down" | TDD catches bugs before commit. "Shortcuts" mean debugging in production. |
| "This is different because..." | No it isn't. Delete code. Start over with TDD. |

## Cross-References

- **When tests fail unexpectedly:** proctor:systematic-debugging
- **Before claiming tests pass:** proctor:verification-before-completion
- **When implementing a plan:** proctor:executing-plans loads this skill first

## Quick Reference

| Phase | Action | Success Criteria |
|-------|--------|-----------------|
| RED | Write failing test | Fails for expected reason |
| Verify RED | Run it | Failure confirmed |
| GREEN | Minimal code | Test passes |
| Verify GREEN | Run suite | All green |
| REFACTOR | Clean up | Still green |
