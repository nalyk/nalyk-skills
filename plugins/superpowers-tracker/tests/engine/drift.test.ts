// superpowers 7.x beside 6.x: what the rebuilt brainstorming says, the
// builder check, the scripts' -C, and the reads that were wrong in both.

import { describe, test, expect } from 'claude-code/testing'
import { world, SLOW } from './world'
import { drive } from './drive'
import { G, OPT_OUT, PERFORMATIVE, normalizeSkill } from '../../hooks/patterns'
import { classifyRole, detectPath, parseLedger, parsePlan, rulingCount, scriptCall, taskOf } from '../../hooks/parsers'
import { FINAL_REVIEW, IMPLEMENTER_DONE, LEDGER_HEAD, PLAN_3_TASKS, PLAN_REL, ROOT, WS } from './fixtures/superpowers'

const DESIGN_REL = 'docs/superpowers/specs/2026-11-10-rate-limit-design.md'

describe('the size brainstorming announces', () => {
  test('7.x plain words map onto the three paths; 6.x words still do', () => {
    expect(detectPath('This is a small change, so a short design doc will do.')).toBe('bounded')
    expect(detectPath("That's a small change.")).toBe('bounded')
    expect(detectPath('This looks like a project: I will write the full design.')).toBe('architectural')
    expect(detectPath('It is really a project, with a few moving parts.')).toBe('architectural')
    expect(detectPath('This is a quick, clear task. Done: the icon is cornflower blue.')).toBe('spike')
    expect(detectPath('This looks bounded, so I will present a short design here.')).toBe('bounded')
    expect(detectPath('This is architectural: a new subsystem.')).toBe('architectural')
    expect(detectPath('Sure, here is the code.')).toBeUndefined()
  })
  test('talk about the project, or an answer that starts with "just", is no size and no opt-out', () => {
    expect(detectPath('It looks like the project uses pnpm.')).toBeUndefined()
    expect(detectPath('This is a TypeScript project.')).toBeUndefined()
    expect(detectPath('That is the project root.')).toBeUndefined()
    for (const said of ["I'd just go with option B", 'just make sure the retry cap is configurable', 'I have no questions on that, but use Postgres', "don't ask about the DB, ask me about the UI", 'just do the design first']) {
      expect(OPT_OUT.test(said)).toBe(false)
    }
    for (const said of ['skip the questions, just build it', 'no more questions', 'Just start.', "don't ask me any more questions"]) {
      expect(OPT_OUT.test(said)).toBe(true)
    }
  })
})

describe('roles', () => {
  test('the builder check is the design reviewer; the final fix subagent is no reviewer', () => {
    expect(classifyRole('Builder check on the design', '')).toBe('spec-reviewer')
    expect(classifyRole('Plan the build', "You are a talented backend engineer. You've been handed a design document and asked to put together a plan")).toBe('spec-reviewer')
    expect(classifyRole('Fix final review findings', 'the whole-branch review found')).toBe('implementer')
    expect(classifyRole('Final whole-branch review', '')).toBe('final-reviewer')
    expect(classifyRole('Stumbles analyst', 'You are an analyst subagent')).toBe('analyst')
  })
  test('Task 6b and Task 2.1 are not Task 6 and Task 2', () => {
    expect(taskOf('Implement Task 6b: retry')).toBeUndefined()
    expect(taskOf('Implement Task 2.1: retry')).toBeUndefined()
    expect(taskOf('Implement Task 6: retry.')).toBe(6)
    const plan = parsePlan('# P\n\n### Task 1: a\n\n### Task 1b: side\n\n### Task 2.1: sub\n\n### Task 2: b\n')
    expect(plan.tasks.map(t => t.n)).toEqual([1, 2])
    expect(plan.tasks[0]?.name).toBe('a')
  })
  test("a same-named skill of another plugin is not superpowers'", () => {
    expect(normalizeSkill('proctor:brainstorming')).toBeUndefined()
    expect(normalizeSkill('superpowers:brainstorming')).toBe('brainstorming')
  })
})

describe('reads that were wrong', () => {
  test('"Good catch" with the fix named is how the skill says to answer', () => {
    expect(PERFORMATIVE.test('Good catch - the bound was off by one. Fixed in backoff.ts.')).toBe(false)
    expect(PERFORMATIVE.test("You're absolutely right!")).toBe(true)
    expect(PERFORMATIVE.test('Thanks for catching that')).toBe(true)
  })
  test('git merge-base is not a merge', () => {
    expect(G.merge.test('git merge-base main HEAD')).toBe(false)
    expect(G.merge.test('git merge --no-ff feature/retry')).toBe(true)
    expect(G.pushForPr.test('git push origin HEAD:refs/heads/retry-policy')).toBe(true)
  })
  test('a complete line written by hand still completes the task', () => {
    const led = parseLedger(`${LEDGER_HEAD}Task 3: complete (ba7374c, db8b6f8; re-review approved; minors fixed)\nTask 4: complete\nTask 5: complete (c21c923; review PASS)\n`)
    expect(led.entries.filter(e => e.kind === 'complete').map(e => e.task)).toEqual([3, 4, 5])
    expect(led.unknown).toHaveLength(0)
  })
  test('a deferred minor listed under its task belongs to that task', () => {
    const led = parseLedger(`${LEDGER_HEAD}Task 2: complete (commits a..b, review clean)\n- Minor (deferred): report line-count typo\n`)
    expect(led.entries.find(e => e.kind === 'minor')).toMatchObject({ task: 2, text: 'report line-count typo' })
  })
  test('a ruling written beside its pre-flight row counts', () => {
    const led = parseLedger(`${LEDGER_HEAD}| Task 1 | Task 2 | shared type | Ruling: keep both - cheap to merge later |\n`)
    expect(rulingCount(led.entries)).toBe(1)
  })
})

describe('the script a command runs', () => {
  test('the plan is a Markdown file, variables filled in, -C taken as the folder', () => {
    expect(scriptCall('bash scripts/sdd-workspace docs/superpowers/plans/p.md')).toMatchObject({ name: 'sdd-workspace', plan: 'docs/superpowers/plans/p.md' })
    expect(scriptCall('P=docs/p.md; bash "$SP/scripts/task-brief" "$P" 3')).toMatchObject({ name: 'task-brief', plan: 'docs/p.md', n: 3 })
    expect(scriptCall('"$SP/scripts/task-brief" "$P" 3')).toMatchObject({ name: 'task-brief', n: 3 })
    expect(scriptCall('"$SP/scripts/task-brief" "$P" 3')?.plan).toBeUndefined()
    expect(scriptCall('bash /x/scripts/task-brief -C /repo/wt docs/p.md 2')).toMatchObject({ dir: '/repo/wt', plan: 'docs/p.md', n: 2 })
    expect(scriptCall('WS=$(bash /x/scripts/sdd-workspace docs/p.md); echo ok')).toMatchObject({ plan: 'docs/p.md' })
    expect(scriptCall('bash /x/scripts/task-done docs/p.md 4 a1b2c3d npm test')).toMatchObject({ plan: 'docs/p.md', n: 4, base: 'a1b2c3d' })
    expect(scriptCall('S=/p/skills/subagent-driven-development/scripts && bash $S/review-package docs/p.md 5bc3080 d81d9ef')).toMatchObject({ name: 'review-package', plan: 'docs/p.md' })
    expect(scriptCall('curl -X POST "https://example.test/task-start" -d x.md')).toBeUndefined()
    // What follows task-done's BASE, or `--`, is the test command, not arguments.
    expect(scriptCall('bash /x/scripts/task-done docs/p.md 6 abc1234 -- go test ./... -count 1')).toMatchObject({ n: 6, base: 'abc1234' })
    expect(scriptCall('bash /x/scripts/task-done docs/p.md 6 abc1234 go test -count 1')?.n).toBe(6)
    expect(scriptCall('grep -n task-done only | head')).toBeUndefined()
    expect(scriptCall('echo "see task-start (card 3)"')).toBeUndefined()
  })
})

describe('7.x brainstorming, end to end', () => {
  test('small change: size, design doc, then the gate holds until the person answers', SLOW, async ($, on) => {
    const w = world(on, { installed: true })
    const d = drive($, w)
    await d.start()
    await d.sp('mode strict')
    await d.skill('superpowers:brainstorming')
    await d.turn('This is a small change. I will write a short design doc.')
    expect((await d.band())?.path).toBe('BOUNDED')
    await d.write(DESIGN_REL, '# Rate limit design')
    expect((await d.band())?.rail.find(s => s.state === 'current')?.id).toBe('spec')
    const early = await $.tool.call({ tool: 'Write', file_path: `${ROOT}/src/limit.ts`, content: 'x' } as never)
    expect(early.deny).toContain('has not been approved yet')
    await d.turn('Writing the plan now.', 'looks good, go ahead')
    const later = await $.tool.call({ tool: 'Write', file_path: `${ROOT}/src/limit.ts`, content: 'x' } as never)
    expect(later.deny).toBeUndefined()
  })

  test('opting out of the questions lifts the gate', SLOW, async ($, on) => {
    const w = world(on, { installed: true })
    const d = drive($, w)
    await d.start()
    await d.sp('mode strict')
    await d.skill('superpowers:brainstorming')
    await d.turn('This looks like a project. A few questions first.')
    await d.turn('Starting.', 'skip the questions, just build it')
    const r = await $.tool.call({ tool: 'Write', file_path: `${ROOT}/src/limit.ts`, content: 'x' } as never)
    expect(r.deny).toBeUndefined()
  })

  test('the fix subagent after a final review does not ship the run with an unread verdict', SLOW, async ($, on) => {
    const sddOut = (tool: string, input: Record<string, unknown>) =>
      tool === 'Bash' && /scripts\/sdd-workspace/.test(String(input.command)) ? { text: `${WS}\n` } : { text: '' }
    const w = world(on, { installed: true, toolText: sddOut })
    const d = drive($, w)
    await d.start()
    await d.skill('superpowers:subagent-driven-development')
    await d.write(PLAN_REL, PLAN_3_TASKS)
    w.files[`${WS}/progress.md`] = LEDGER_HEAD
    await d.bash(`bash scripts/sdd-workspace ${PLAN_REL}`)
    await d.ledger(`${WS}/progress.md`, `${LEDGER_HEAD}Task 1: complete (commits a..b, review clean)\nTask 2: complete (commits a..b, review clean)\nTask 3: complete (commits a..b, review clean)\n`)
    const fin = await d.spawn('Final whole-branch review', { model: 'opus' })
    await d.agentDone(fin.agentId!, FINAL_REVIEW.replace('Yes', 'With fixes').replace(/#### Important[\s\S]*?(?=####|$)/, '#### Important\n- one thing to fix\n\n'))
    const fix = await d.spawn('Fix final review findings', { model: 'sonnet' })
    await d.agentDone(fix.agentId!, IMPLEMENTER_DONE)
    expect((await d.band())?.kind).not.toBe('shipped')
  })
})
