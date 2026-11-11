// What a crash, a restart, a /resume and a second plan must not lose.

import { describe, test, expect } from 'claude-code/testing'
import { world, SLOW } from './world'
import { drive } from './drive'
import {
  FINAL_REVIEW,
  IMPLEMENTER_DONE,
  LEDGER_HEAD,
  LEDGER_TASK1,
  PLAN,
  PLAN_3_TASKS,
  PLAN_REL,
  ROOT,
  WS,
} from './fixtures/superpowers'

const NOW = 1_760_000_000_000
const LEDGER = `${WS}/progress.md`
const sddOut = (tool: string, input: Record<string, unknown>) =>
  tool === 'Bash' && /scripts\/sdd-workspace/.test(String(input.command)) ? { text: `${WS}\n` } : { text: '' }

const START = { cwd: ROOT, surface: 'terminal' as const, isInteractive: true }

/** A session that reached Task 2 of 3 under SDD, with one warning on record. */
const midRun = async (d: ReturnType<typeof drive>, w: ReturnType<typeof world>) => {
  await d.start()
  await d.skill('superpowers:brainstorming')
  await d.skill('writing-plans')
  await d.write(PLAN_REL, PLAN_3_TASKS)
  await d.skill('superpowers:subagent-driven-development')
  w.files[LEDGER] = LEDGER_HEAD
  await d.bash(`bash scripts/sdd-workspace ${PLAN_REL}`)
  const impl = await d.spawn('Implement Task 1: Backoff calculator')
  await d.agentDone(impl.agentId!, IMPLEMENTER_DONE)
  await d.ledger(LEDGER, LEDGER_TASK1)
  const second = await d.spawn('Implement Task 2: Retry policy', { model: 'haiku' })
  await d.flush()
  return second.agentId!
}

describe('a crash', () => {
  test('the terminal dies mid-task with no session.end: the next start has the whole run back', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, durable: true, toolText: sddOut })
    const d = drive($, w)
    await midRun(d, w)
    await w.clock.advance(6000)
    await w.settle()
    const before = await d.sp('status')
    expect(before).toContain('tasks: 1/3 done')

    w.restart()
    await $.session.start(START)
    await w.settle()

    const vm = await d.band()
    expect(vm?.kind).toBe('live')
    expect(vm?.progress).toMatchObject({ done: 1, total: 3 })
    expect(vm?.rail.find(s => s.state === 'current')?.id).toBe('execute')
    const status = await d.sp('status')
    expect(status).toContain('executor subagent-driven-development')
    expect(status).toContain('tasks: 1/3 done')
    // The warning recorded before the crash is still on record.
    expect(status).toContain('no explicit model')
  })

  test('an implementer running when the process died is not left running forever', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, durable: true, toolText: sddOut })
    const d = drive($, w)
    await midRun(d, w)
    await w.clock.advance(6000)
    await w.settle()
    expect((await d.band())?.agents.length).toBe(1)
    w.restart()
    await $.session.start(START)
    await w.settle()
    expect((await d.band())?.agents.length).toBe(0)
  })

  test('work the ledger recorded while the tracker was away shows on restart', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, durable: true, toolText: sddOut })
    const d = drive($, w)
    await midRun(d, w)
    await w.clock.advance(6000)
    await w.settle()
    w.restart()
    w.files[LEDGER] = `${LEDGER_TASK1}Task 2: complete (commits b1b2c3d..e4e5f6a, review clean)\n`
    w.mtimes[LEDGER] = w.clock.now() + 5
    await $.session.start(START)
    await w.settle()
    expect((await d.band())?.progress).toMatchObject({ done: 2, total: 3 })
  })

  test('before any plan exists, a brainstorm in progress survives too', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, durable: true })
    const d = drive($, w)
    await d.start()
    await d.skill('superpowers:brainstorming')
    await d.turn('This looks architectural, so I will write a spec.')
    await w.clock.advance(6000)
    await w.settle()
    w.restart()
    await $.session.start(START)
    await w.settle()
    const vm = await d.band()
    expect(vm?.kind).toBe('live')
    expect(vm?.path).toBe('ARCH')
  })

  test('a reload with the state still held replays nothing twice', SLOW, async ($, on) => {
    const messages = [
      { role: 'user', text: 'go', toolUses: [] },
      { role: 'assistant', text: 'ok', toolUses: [{ tool_use_id: 't1', tool: 'Skill', input: { skill: 'superpowers:brainstorming' }, text: 'Launching skill' }] },
    ]
    const w = world(on, { installed: true, now: NOW, durable: true, messages })
    const d = drive($, w)
    await d.start()
    await d.bash('npm test')
    await d.bash('npm test')
    const one = await d.sp('status')
    await $.session.start(START)
    await w.settle()
    expect(await d.sp('status')).toBe(one)
  })
})

describe('switching sessions in one process', () => {
  test('/clear does not bring the cleared run back from its own checkpoint', async ($, on) => {
    const w = world(on, { installed: true, now: NOW, durable: true, toolText: sddOut })
    const d = drive($, w)
    await midRun(d, w)
    await w.clock.advance(6000)
    await w.settle()
    // The engine still answers the old id for a moment, with nothing in the transcript.
    await $.session.end({ reason: 'clear', sessionId: 'sess-1', resume: { id: 'sess-1' } })
    await w.settle()
    const status = await d.sp('status')
    expect(status).not.toContain('executor subagent-driven-development')
    expect(status).not.toContain('no explicit model')
  })

  test('/resume into another session drops the old run and restores the other one', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, durable: true, toolText: sddOut })
    const d = drive($, w)
    await midRun(d, w)
    await w.clock.advance(6000)
    await w.settle()
    await $.session.end({ reason: 'resume', sessionId: 'sess-1', resume: { id: 'sess-1' } })
    w.sessionId = 'sess-2'
    w.messages = []
    await w.clock.advance(1000)
    await w.settle()
    await d.turn('hello', 'hi')
    // The other session did none of this work: the plan on disk is offered
    // for resuming, and nothing of the first session's run is shown as its own.
    const status = await d.sp('status')
    expect(status).toContain('resumable')
    expect(status).not.toContain('executor subagent-driven-development')
    expect(status).not.toContain('no explicit model')

    // And back again: the first session's run returns from its checkpoint.
    await $.session.end({ reason: 'resume', sessionId: 'sess-2', resume: { id: 'sess-2' } })
    w.sessionId = 'sess-1'
    await w.clock.advance(1000)
    await w.settle()
    await d.turn('back', 'continue')
    const back = await d.sp('status')
    expect(back).toContain('tasks: 1/3 done')
    expect(back).toContain('executor subagent-driven-development')
    expect(back).toContain('no explicit model')
  })
})

describe('the plan a script names', () => {
  test('a shell variable, a quoted path with punctuation, or a mention is never taken as the plan', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, durable: true, toolText: sddOut })
    const d = drive($, w)
    await d.start()
    await d.skill('superpowers:subagent-driven-development')
    await d.write(PLAN_REL, PLAN_3_TASKS)
    await d.bash(`P=${PLAN_REL}; WS=$(bash scripts/sdd-workspace "$P"); echo $WS`)
    await d.bash('grep -n task-done only | head')
    await d.bash(`(cd ${ROOT} && bash scripts/task-brief ${PLAN_REL}) 2>&1`)
    await d.bash(`echo "see task-start (card 3) for details"`)
    await w.clock.advance(40_000)
    await w.settle()
    const keys = Object.keys(w.store).filter(k => k.startsWith('snap:'))
    expect(keys).toEqual([`snap:${ROOT}::${PLAN}`])
    expect(await d.sp('status')).toContain('Retry Policy')
  })

  test('a relative plan path is found from the repo root when the shell sits elsewhere', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, durable: true, toolText: sddOut, cwd: `${ROOT}/packages/api` })
    const d = drive($, w)
    await d.start()
    await d.skill('superpowers:subagent-driven-development')
    w.files[PLAN] = PLAN_3_TASKS
    await d.bash(`bash scripts/sdd-workspace ${PLAN_REL}`)
    expect((await d.band())?.progress).toMatchObject({ total: 3 })
  })
})

describe('a second plan in the same session', () => {
  const PLAN2_REL = 'docs/superpowers/plans/2026-10-09-rate-limit.md'
  const PLAN2 = `# Rate Limit Implementation Plan\n\n**Goal:** Limit.\n\n### Task 1: Bucket\n\n- [ ] **Step 1: test**\n\n### Task 2: Wire\n\n- [ ] **Step 1: test**\n`

  test('starts clean: no task of the first plan is carried over as done', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, durable: true, toolText: sddOut })
    const d = drive($, w)
    await midRun(d, w)
    expect((await d.band())?.progress).toMatchObject({ done: 1, total: 3 })
    await d.skill('writing-plans')
    await d.write(PLAN2_REL, PLAN2)
    const vm = await d.band()
    expect(vm?.progress).toMatchObject({ done: 0, total: 2 })
    expect(vm?.rail.find(s => s.state === 'current')?.id).toBe('plan')
    expect(await d.sp('status')).toContain('Rate Limit')
    // The first plan's story was kept under its own key.
    await w.clock.advance(40_000)
    await w.settle()
    expect(Object.keys(w.store)).toContain(`snap:${ROOT}::${PLAN}`)
    const first = w.store[`snap:${ROOT}::${PLAN}`] as { run: { tasks: { status: string }[] } }
    expect(first.run.tasks.filter(t => t.status === 'done')).toHaveLength(1)
  })

  test('strict mode does not deny Task 1 of the new plan because the old ledger had it complete', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, durable: true, toolText: sddOut })
    const d = drive($, w)
    const running = await midRun(d, w)
    await d.agentDone(running, IMPLEMENTER_DONE)
    await d.sp('mode strict')
    await d.skill('writing-plans')
    await d.write(PLAN2_REL, PLAN2)
    const r = await d.spawn('Implement Task 1: Bucket', { model: 'haiku' })
    expect(r.deny).toBeUndefined()
  })
})

describe('the store', () => {
  test('stale scan caches and snapshots under names that are no plan are swept at start', SLOW, async ($, on) => {
    const old = NOW - 90 * 24 * 3_600_000
    const store: Record<string, unknown> = {
      'scan:/tmp/tmp123': { sig: [], candidates: [] },
      'scan:/gone/repo': { sig: [], candidates: [], at: old },
      [`snap:${ROOT}::${ROOT}/$P`]: { savedAt: NOW - 1000, run: { tasks: [] }, timeline: [], agents: [], warnings: [], tests: [] },
      [`snapidx:${ROOT}`]: [`${ROOT}/$P`],
      settings: { mode: 'assist' },
    }
    const w = world(on, { installed: true, now: NOW, durable: true, store })
    const d = drive($, w)
    await d.start()
    await w.clock.advance(5000)
    await w.settle()
    const keys = Object.keys(w.store)
    expect(keys).not.toContain('scan:/tmp/tmp123')
    expect(keys).not.toContain('scan:/gone/repo')
    expect(keys).not.toContain(`snap:${ROOT}::${ROOT}/$P`)
    expect(keys).toContain('settings')
  })
})

describe('found in review', () => {
  const ALL_DONE = `${LEDGER_HEAD}Task 1: complete (commits a..b, review clean)\nTask 2: complete (commits a..b, review clean)\nTask 3: complete (commits a..b, review clean)\n`

  /** Every task done and a clean final review: the poll ships the run. */
  const shippedRun = async (d: ReturnType<typeof drive>, w: ReturnType<typeof world>) => {
    await d.start()
    await d.skill('superpowers:subagent-driven-development')
    await d.write(PLAN_REL, PLAN_3_TASKS)
    w.files[LEDGER] = LEDGER_HEAD
    await d.bash(`bash scripts/sdd-workspace ${PLAN_REL}`)
    await d.ledger(LEDGER, ALL_DONE)
    const fin = await d.spawn('Final whole-branch review', { model: 'opus' })
    await d.agentDone(fin.agentId!, FINAL_REVIEW)
    await w.clock.advance(2100)
    await w.settle()
  }

  test('the finishing skill after the ship keeps the shipped run', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, durable: true, toolText: sddOut })
    const d = drive($, w)
    await shippedRun(d, w)
    expect((await d.band())?.kind).toBe('shipped')
    await d.skill('superpowers:finishing-a-development-branch')
    await d.bash('bash scripts/review-package docs/superpowers/plans/2026-10-05-retry-policy.md a1b2c3d HEAD')
    const status = await d.sp('status')
    expect(status).toContain('tasks: 3/3 done')
    expect((await d.band())?.kind).toBe('shipped')
  })

  test('brainstorming after the ship starts a new run and files the shipped one', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, durable: true, toolText: sddOut })
    const d = drive($, w)
    await shippedRun(d, w)
    await d.skill('superpowers:brainstorming')
    const vm = await d.band()
    expect(vm?.kind).toBe('live')
    expect(vm?.rail.find(x => x.state === 'current')?.id).toBe('brainstorm')
    expect(await d.sp('status')).not.toContain('tasks: 3/3 done')
    const filed = w.store[`snap:${ROOT}::${PLAN}`] as { run: { lifecycle: string; tasks: unknown[] } }
    expect(filed.run.lifecycle).toBe('shipped')
    expect(filed.run.tasks).toHaveLength(3)
  })

  test('a second brainstorm is not approved by the first one\'s design doc', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, durable: true })
    const d = drive($, w)
    await d.start()
    await d.sp('mode strict')
    await d.skill('superpowers:brainstorming')
    await d.turn('This is a small change. I will write a short design doc.')
    await d.write('docs/superpowers/specs/2026-11-10-one-design.md', '# one')
    await d.turn('ok', 'approved')
    // Later: the same skill within 5 s would be read as one invocation reported twice.
    await w.clock.advance(60_000)
    await w.settle()
    await d.skill('superpowers:brainstorming')
    await d.turn('This is a small change too. A few things to settle first.', 'now the second feature')
    await d.turn('Still asking.', 'use the same store')
    const r = await $.tool.call({ tool: 'Write', file_path: `${ROOT}/src/two.ts`, content: 'x' } as never)
    expect(r.deny).toContain('has not been approved yet')
  })

  test('a subagent named "Fix …" outside an SDD run is nobody\'s implementer', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, durable: true })
    const d = drive($, w)
    await d.start()
    await d.sp('mode strict')
    const r = await d.spawn('Fix flaky login test')
    expect(r.deny).toBeUndefined()
    expect(await d.sp('status')).not.toContain('no explicit model')
  })

  test('the checkpoint mark is a main-thread call, never a subagent\'s', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, durable: true, toolText: sddOut })
    const d = drive($, w)
    await midRun(d, w)
    const main = await $.tool.call({ tool: 'Bash', command: 'git status', tool_use_id: 'toolu_main_9' } as never)
    void main
    await $.tool.call({ tool: 'Bash', command: 'npm test', tool_use_id: 'toolu_sub_1', agentId: 'ag-x' } as never)
    await w.clock.advance(6000)
    await w.settle()
    const ck = w.store['ck:sess-1'] as { lastRef?: string }
    expect(ck.lastRef).not.toBe('toolu_sub_1')
  })

  test('a session that only looked at a resumable plan writes no checkpoint over the one that worked', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, durable: true, toolText: sddOut })
    const d = drive($, w)
    await midRun(d, w)
    await w.clock.advance(6000)
    await w.settle()
    await $.session.end({ reason: 'clear', sessionId: 'sess-1', resume: { id: 'sess-1' } })
    await w.settle()
    await w.clock.advance(10_000)
    await w.settle()
    const ck = w.store['ck:sess-1'] as { run: { lifecycle: string; executor?: string }; skills: unknown[] }
    expect(ck.run.lifecycle).toBe('live')
    expect(ck.run.executor).toBe('sdd')
    expect(ck.skills.length).toBeGreaterThan(0)
  })
})
