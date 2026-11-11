import { describe, test, expect } from 'claude-code/testing'
import { normalizeSkill, SKILLS } from '../../hooks/patterns'
import {
  classifyRole,
  detectPath,
  parseFinalReview,
  parseImplementer,
  parseLedger,
  parsePlan,
  parseReReview,
  parseTaskReview,
  parseTestOutput,
  progressOf,
  rulingCount,
  splitRuling,
  taskOf,
} from '../../hooks/parsers'
import {
  FINAL_REVIEW,
  IMPLEMENTER_BLOCKED,
  IMPLEMENTER_DONE,
  LEDGER_ALL_FORMS,
  LEDGER_BREAKER,
  LEDGER_FIX2,
  PLAN_3_TASKS,
  RE_REVIEW,
  REVIEW_CLEAN,
  REVIEW_FIXES,
  SPEC_REL,
} from './fixtures/superpowers'

describe('skill names', () => {
  test('strips a plugin prefix and keeps only the 15 superpowers skills', () => {
    expect(SKILLS).toHaveLength(15)
    expect(normalizeSkill('superpowers:subagent-driven-development')).toBe('subagent-driven-development')
    expect(normalizeSkill('subagent-driven-development')).toBe('subagent-driven-development')
    expect(normalizeSkill('/superpowers:writing-plans')).toBe('writing-plans')
    // Another plugin's skill of the same name is not superpowers.
    expect(normalizeSkill('other:brainstorming')).toBeUndefined()
    expect(normalizeSkill('proctor:subagent-driven-development')).toBeUndefined()
    expect(normalizeSkill('frontend-design')).toBeUndefined()
    expect(normalizeSkill(undefined)).toBeUndefined()
  })
})

describe('plan parser', () => {
  test('reads title, goal, spec, review focus and tasks, ignoring headings in fences', () => {
    const p = parsePlan(PLAN_3_TASKS)
    expect(p.title).toBe('Retry Policy')
    expect(p.goal).toBe('Retries with exponential backoff for the HTTP client.')
    expect(p.spec).toBe(SPEC_REL)
    expect(p.hasReviewFocus).toBe(true)
    expect(p.tasks.map(t => t.n)).toEqual([1, 2, 3])
    expect(p.tasks.some(t => t.n === 99)).toBe(false)
    expect(p.tasks[0]).toMatchObject({ name: 'Backoff calculator', steps: 3, stepsDone: 1 })
    expect(p.tasks[2]?.name).toBe('HTTP wrapper')
  })
  test('a plan with no tasks reports an error instead of throwing', () => {
    expect(parsePlan('# Nothing here').error).toBeDefined()
  })
})

describe('ledger parser', () => {
  test('every line form, and unknown lines kept', () => {
    const l = parseLedger(LEDGER_ALL_FORMS)
    const kinds = l.entries.map(e => e.kind)
    for (const k of ['title', 'preflight', 'table', 'complete', 'fix-round', 'minor', 'parked', 'task-ruling', 'ruling', 'final-minor', 'final-fixed', 'final-ruling', 'final-review'] as const) {
      expect(kinds).toContain(k)
    }
    expect(l.unknown).toEqual(['something the tracker has never seen'])
    const t2 = l.entries.find(e => e.kind === 'complete' && e.task === 2)
    expect(t2).toMatchObject({ commits: 'd4e5f6a..b7c8d9e', parked: 2 })
    const t3 = l.entries.find(e => e.kind === 'complete' && e.task === 3)
    expect(t3?.tests).toBe('npm test -- wrapper → 12 passed')
    const fix = l.entries.find(e => e.kind === 'fix-round')
    expect(fix).toMatchObject({ task: 4, round: 3, addressed: 2, open: 1, commits: 'c0ffee1..deadbee', text: 'timeout leak' })
    expect(rulingCount(l.entries)).toBe(4)
  })
  test('progress folds completions, fix rounds and the breaker', () => {
    expect(progressOf(parseLedger(LEDGER_FIX2).entries)).toMatchObject({ done: [1] })
    expect(progressOf(parseLedger(LEDGER_FIX2).entries).fixing.get(2)).toBe(2)
    expect(progressOf(parseLedger(LEDGER_BREAKER).entries).breaker.has(1)).toBe(true)
  })
  test('a fix round without one-liners parses (the SKILL.md example form)', () => {
    const l = parseLedger('Task 2: fix round 1/5 (2 addressed, 0 open; commits d4e5f6a..b7c8d9e)')
    expect(l.entries[0]).toMatchObject({ kind: 'fix-round', task: 2, round: 1, open: 0, commits: 'd4e5f6a..b7c8d9e' })
  })
  test('rulings split into what, why and cost', () => {
    expect(splitRuling('use full jitter — the spec cites it — one more test if wrong')).toEqual({ what: 'use full jitter', why: 'the spec cites it', cost: 'one more test if wrong' })
  })
})

describe('subagent roles and verdicts', () => {
  test('classifies every role from its dispatch description', () => {
    expect(classifyRole('Implement Task 4: Retry policy', '')).toBe('implementer')
    expect(classifyRole('Review Task 4 (spec + quality)', '')).toBe('task-reviewer')
    expect(classifyRole('Re-review Task 4 fix round 2', '')).toBe('re-reviewer')
    expect(classifyRole('Final whole-branch review', '')).toBe('final-reviewer')
    expect(classifyRole('Review code changes', 'You are a Senior Code Reviewer')).toBe('final-reviewer')
    expect(classifyRole('Timeline analyst', 'read prompts/analyst-common.md and skill-timeline.md')).toBe('analyst')
    expect(classifyRole('Investigate failing auth tests', 'independent problem domain')).toBe('investigator')
    expect(classifyRole('Review the spec document', 'spec document reviewer')).toBe('spec-reviewer')
    expect(classifyRole('Find TODOs', 'grep')).toBe('other')
    expect(taskOf('Implement Task 12: X')).toBe(12)
  })
  test('implementer answers', () => {
    expect(parseImplementer(IMPLEMENTER_DONE)).toMatchObject({ status: 'DONE', commits: ['a1b2c3d'] })
    expect(parseImplementer(IMPLEMENTER_DONE).tests).toContain('14/14 passing')
    expect(parseImplementer(IMPLEMENTER_DONE).report).toContain('task-1-report.md')
    expect(parseImplementer(IMPLEMENTER_BLOCKED).status).toBe('BLOCKED')
  })
  test('task reviewer answers', () => {
    expect(parseTaskReview(REVIEW_CLEAN)).toMatchObject({ spec: 'ok', quality: 'Approved', critical: 0, important: 0, minor: 1 })
    expect(parseTaskReview(REVIEW_FIXES)).toMatchObject({ spec: 'bad', quality: 'Needs fixes', critical: 1, important: 2, minor: 0 })
  })
  test('re-reviewer answers', () => {
    expect(parseReReview(RE_REVIEW)).toMatchObject({ addressed: 1, notAddressed: 1, clean: false })
  })
  test('final reviewer answers, both spellings', () => {
    expect(parseFinalReview(FINAL_REVIEW)).toMatchObject({ ready: 'Yes', critical: 0, important: 0, minor: 1 })
    expect(parseFinalReview('**Ready to merge: With fixes**').ready).toBe('With fixes')
  })
})

describe('other answers', () => {
  test('test output counts', () => {
    expect(parseTestOutput('Tests: 3 failed, 9 passed, 12 total')).toEqual({ passed: 9, failed: 3 })
    expect(parseTestOutput('14/14 passing')).toEqual({ passed: 14, failed: 0 })
  })
  test('the brainstorming path announced', () => {
    expect(detectPath('This looks bounded, so I will present a short design here.')).toBe('bounded')
    expect(detectPath('This is architectural: a new subsystem.')).toBe('architectural')
    expect(detectPath('It looks like a spike.')).toBe('spike')
    expect(detectPath('Sure, here is the code.')).toBeUndefined()
  })
})
