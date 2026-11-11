// Fixtures in superpowers' real formats: 6.4.2's, which 7.0.2 still writes
// for plans, ledgers, scripts and subagent reports. What 7.x changed (the
// brainstorming sizes, the builder check) is covered in drift.test.ts. Tests have no file system,
// so each fixture is a module exporting the file's text.

export const ROOT = '/repo'
export const PLAN_REL = 'docs/superpowers/plans/2026-10-05-retry-policy.md'
export const PLAN = `${ROOT}/${PLAN_REL}`
export const SPEC_REL = 'docs/superpowers/specs/2026-10-04-retry-policy-design.md'
export const WS = `${ROOT}/.superpowers/sdd/2026-10-05-retry-policy`

export const PLAN_3_TASKS = `# Retry Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Retries with exponential backoff for the HTTP client.

**Architecture:** A pure backoff calculator, a policy object, and a wrapper.

**Tech Stack:** TypeScript, vitest

**Spec:** \`${SPEC_REL}\`

## Global Constraints

- Max 5 attempts.

## Review Focus

- A server that never answers.

---

### Task 1: Backoff calculator

**Files:**
- Create: \`src/backoff.ts\`

- [ ] **Step 1: Write the failing test**

\`\`\`ts
// ### Task 99: this heading is inside a fence and must be ignored
test('doubles', () => expect(backoff(2)).toBe(400))
\`\`\`

- [ ] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement \`backoff(n: number): number\`**

### Task 2: Retry policy

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Implement**

## Task 3: HTTP wrapper

- [ ] **Step 1: Write the failing test**
`

export const LEDGER_HEAD = `# SDD ledger — plan: ${PLAN_REL}
Pre-flight: no shared interfaces
`

export const LEDGER_TASK1 = `${LEDGER_HEAD}Task 1: complete (commits a1b2c3d..d4e5f6a, review clean)
`

export const LEDGER_FIX2 = `${LEDGER_TASK1}Task 2: fix round 1/5 (1 addressed, 1 open — jitter bound off by one; commits d4e5f6a..b7c8d9e)
Task 2: fix round 2/5 (0 addressed, 1 open; commits b7c8d9e..c0ffee1)
`

export const LEDGER_ALL_FORMS = `# SDD ledger — plan: ${PLAN_REL}
Pre-flight: no shared interfaces
| Tasks | Produces | Consumes | Found |
|-------|----------|----------|-------|
| 1→2 | backoff() | backoff() | ok |
Task 1: complete (commits a1b2c3d..d4e5f6a, review clean)
Task 2: complete (commits d4e5f6a..b7c8d9e, 2 parked)
Task 3: complete (commits b7c8d9e..c0ffee1, tests: npm test -- wrapper → 12 passed)
Task 4: fix round 3/5 (2 addressed, 1 open — timeout leak; commits c0ffee1..deadbee)
Task 4: minor (deferred): rename helper
Task 2: parked — jitter upper bound — Ruling: spec allows an inclusive bound
Task 4: Ruling: timeout leak — fixed by the wrapper owning the timer
Ruling: use full jitter — the spec cites it — one more test if wrong
Final: minor (deferred): README example
Final: fixed missing retry header — test_retry_header RED→GREEN, suite 40/40
Final: Ruling: declined: config hot reload — out of scope — a follow-up plan
Final review: self-review (no subagent tool)
something the tracker has never seen
`

export const LEDGER_BREAKER = `${LEDGER_HEAD}Task 1: fix round 5/5 (0 addressed, 2 open — still flaky; commits a1b2c3d..d4e5f6a)
`

export const IMPLEMENTER_DONE = `**Status:** DONE

- a1b2c3d feat: backoff calculator
- One-line test summary: 14/14 passing, output pristine
- Report: ${WS}/task-1-report.md`

export const IMPLEMENTER_BLOCKED = `**Status:** BLOCKED

I cannot find the HTTP client's interface. Report: ${WS}/task-2-report.md`

export const REVIEW_CLEAN = `### Spec Compliance

- ✅ Spec compliant

### Strengths
- Tight tests (src/backoff.test.ts:4)

### Issues

#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
1. src/backoff.ts:3 — magic number

### Assessment

**Task quality:** Approved

**Reasoning:** Clean.`

export const REVIEW_FIXES = `### Spec Compliance

- ❌ Issues found: missing jitter (src/policy.ts:10)

### Issues

#### Critical (Must Fix)
1. src/policy.ts:12 — infinite retry

#### Important (Should Fix)
1. src/policy.ts:20 — swallowed error
2. src/policy.ts:30 — no cap

#### Minor (Nice to Have)

### Assessment

**Task quality:** Needs fixes`

export const RE_REVIEW = `### Finding Verdicts
- **infinite retry** — ADDRESSED (src/policy.ts:12)
- **swallowed error** — NOT ADDRESSED (src/policy.ts:20)

### New Breakage in the Fix Diff
None

### Verdict

**Fix round:** Findings remain open — swallowed error`

export const FINAL_REVIEW = `### Strengths
- Good.

### Issues

#### Critical (Must Fix)

#### Important (Should Fix)

#### Minor (Nice to Have)
1. README lacks an example

### Recommendations
- none

### Assessment

**Ready to merge?** Yes

**Reasoning:** Solid.`

export const SERVER_INFO = `{"type":"server-started","port":52341,"url":"http://localhost:52341/?key=ab12","screen_dir":"${ROOT}/.superpowers/brainstorm/4242-1706000000/content","state_dir":"${ROOT}/.superpowers/brainstorm/4242-1706000000/state"}`

export const BOOTSTRAP_TEXT = `<EXTREMELY_IMPORTANT>
You have superpowers.

**Below is the full content of your 'superpowers:using-superpowers' skill**
</EXTREMELY_IMPORTANT>`
