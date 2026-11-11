import { describe, test, expect } from 'claude-code/testing'
import { world, SLOW } from './world'
import { drive } from './drive'
import {
  FINAL_REVIEW,
  IMPLEMENTER_BLOCKED,
  IMPLEMENTER_DONE,
  LEDGER_BREAKER,
  LEDGER_HEAD,
  LEDGER_TASK1,
  PLAN,
  PLAN_3_TASKS,
  PLAN_REL,
  REVIEW_CLEAN,
  SPEC_REL,
  WS,
} from './fixtures/superpowers'

const LEDGER = `${WS}/progress.md`
const sddOut = (tool: string, input: Record<string, unknown>) =>
  tool === 'Bash' && String(input.command).includes('sdd-workspace') ? { text: `${WS}\n` } : { text: '' }

describe('the happy path', () => {
  test('brainstorming → spec → writing-plans → SDD → 3 tasks → final review → finishing', SLOW, async ($, on) => {
    const w = world(on, { installed: true, toolText: sddOut })
    const d = drive($, w)
    await d.start()
    expect((await d.band())?.kind).toBe('armed')

    await d.skill('superpowers:brainstorming')
    await d.turn('This looks architectural, so I will write a spec.')
    let vm = await d.band()
    expect(vm?.kind).toBe('live')
    expect(vm?.path).toBe('ARCH')
    expect(vm?.pathInferred).toBe(true)
    expect(vm?.rail.find(s => s.state === 'current')?.id).toBe('brainstorm')

    await d.write(SPEC_REL, '# Retry policy design')
    await d.bash(`git add ${SPEC_REL} && git commit -m "spec"`)
    expect((await d.band())?.rail.find(s => s.state === 'current')?.id).toBe('spec')

    await d.skill('writing-plans')
    await d.write(PLAN_REL, PLAN_3_TASKS)
    vm = await d.band()
    expect(vm?.rail.find(s => s.state === 'current')?.id).toBe('plan')
    await d.flush()
    expect(w.toasts.join('\n')).toContain('Plan written · 3 tasks')

    await d.skill('superpowers:subagent-driven-development')
    w.files[LEDGER] = LEDGER_HEAD
    await d.bash(`bash scripts/sdd-workspace ${PLAN_REL}`)
    vm = await d.band()
    expect(vm?.rail.find(s => s.state === 'current')?.id).toBe('execute')
    expect(vm?.progress).toEqual({ done: 0, total: 3, fraction: 0 })

    let ledger = LEDGER_HEAD
    for (const n of [1, 2, 3]) {
      const impl = await d.spawn(`Implement Task ${n}: step ${n}`, { model: 'haiku' })
      expect(w.notices.at(-1)).toBe(`implementer · Task ${n} · haiku`)
      const running = await d.band()
      expect(running?.agents[0]).toMatchObject({ role: 'implementer', task: n, model: 'haiku', glyph: '◇' })
      await d.agentDone(impl.agentId!, IMPLEMENTER_DONE)
      const rev = await d.spawn(`Review Task ${n} (spec + quality)`, { model: 'sonnet' })
      await d.agentDone(rev.agentId!, REVIEW_CLEAN)
      ledger += `Task ${n}: complete (commits a1b2c3${n}..d4e5f6${n}, review clean)\n`
      await d.ledger(LEDGER, ledger)
      vm = await d.band()
      expect(vm?.progress?.done).toBe(n)
      expect(vm?.idle).toContain(`Task ${n} ✓`)
    }
    await d.flush()
    expect(w.toasts.join('\n')).toContain('Task 3 complete')
    expect(vm?.rail.find(s => s.state === 'current')?.id).toBe('review')

    const fin = await d.spawn('Final whole-branch review', { model: 'opus' })
    await d.agentDone(fin.agentId!, FINAL_REVIEW)
    await d.skill('finishing-a-development-branch')
    await d.turn('Rulings I made:\n- none\n\nImplementation complete. What would you like to do?')
    vm = await d.band()
    expect(vm?.kind).toBe('shipped')
    expect(vm?.shipped).toContain('3 tasks')
    await d.flush()
    expect(w.toasts.join('\n')).toContain('Shipped!')

    const status = await d.sp('status')
    expect(status).toContain('tasks: 3/3 done')
    expect(status).toContain('executor subagent-driven-development')
  })
})

describe('fix loop and breaker', () => {
  test('round 5 with findings open trips the breaker and shows it', SLOW, async ($, on) => {
    const w = world(on, { installed: true, files: { [PLAN]: PLAN_3_TASKS }, toolText: sddOut })
    const d = drive($, w)
    await d.start()
    await d.skill('subagent-driven-development')
    await d.write(PLAN_REL, PLAN_3_TASKS)
    w.files[LEDGER] = LEDGER_BREAKER
    await d.bash(`bash scripts/sdd-workspace ${PLAN_REL}`)
    await d.spawn('Implement Task 1: Backoff calculator', { model: 'opus' })
    const vm = await d.band()
    expect(vm?.fix).toEqual({ round: 5, breaker: true, task: 1 })
    const status = await d.sp('status')
    expect(status).toContain('fix 5/5')
  })
  test('a blocked implementer toasts and marks the task', SLOW, async ($, on) => {
    const w = world(on, { installed: true, toolText: sddOut })
    const d = drive($, w)
    await d.start()
    await d.skill('subagent-driven-development')
    await d.write(PLAN_REL, PLAN_3_TASKS)
    const impl = await d.spawn('Implement Task 2: Retry policy', { model: 'haiku' })
    await d.agentDone(impl.agentId!, IMPLEMENTER_BLOCKED)
    await w.clock.advance(1100)
    expect(w.toasts.join('\n')).toContain('Implementer blocked · Task 2 · the controller will re-dispatch')
  })
})

const reDispatch = async (mode: 'observe' | 'assist' | 'strict', $: Parameters<typeof drive>[0], on: Parameters<typeof world>[0]) => {
  const w = world(on, { installed: true, files: { [PLAN]: PLAN_3_TASKS }, toolText: sddOut })
  const d = drive($, w)
  await d.start()
  await d.sp(`mode ${mode}`)
  await d.skill('subagent-driven-development')
  await d.write(PLAN_REL, PLAN_3_TASKS)
  w.files[LEDGER] = LEDGER_TASK1
  await d.bash(`bash scripts/sdd-workspace ${PLAN_REL}`)
  await d.compact()
  const sub = await d.turn('Continuing.', 'continue')
  const spawn = await d.spawn('Implement Task 1: Backoff calculator', { model: 'haiku' })
  return { w, d, sub, spawn }
}

describe('re-dispatch of a completed task after compaction', () => {
  test('observe records a critical warning and lets it run', SLOW, async ($, on) => {
    const { d, sub, spawn } = await reDispatch('observe', $, on)
    expect(spawn.deny).toBeUndefined()
    expect(sub.context ?? []).toEqual([])
    const vm = await d.band()
    expect(vm?.critical?.text).toBe('Task 1 re-dispatched after it completed')
  })
  test('assist injects the ledger note before the next turn', SLOW, async ($, on) => {
    const { sub, spawn } = await reDispatch('assist', $, on)
    expect(spawn.deny).toBeUndefined()
    const note = (sub.context ?? []).join('\n')
    expect(note).toContain(`ledger ${LEDGER} shows Task 1 complete`)
    expect(note.split('\n').length).toBeLessThanOrEqual(3)
  })
  test('strict denies the spawn, naming the evidence', SLOW, async ($, on) => {
    const { spawn } = await reDispatch('strict', $, on)
    expect(spawn.deny).toContain('Task 1 is already complete in the ledger')
  })
})

describe('missing model and parallel implementers', () => {
  test('observe warns on both', SLOW, async ($, on) => {
    const w = world(on, { installed: true })
    const d = drive($, w)
    await d.start()
    await d.skill('subagent-driven-development')
    await d.spawn('Implement Task 1: A')
    await d.spawn('Implement Task 2: B', { model: 'haiku' })
    const status = await d.sp('status')
    expect(status).toContain('implementer dispatched with no explicit model')
    expect(status).toContain('Two implementers running at once')
  })
  test('strict denies both', SLOW, async ($, on) => {
    const w = world(on, { installed: true })
    const d = drive($, w)
    await d.start()
    await d.sp('mode strict')
    await d.skill('subagent-driven-development')
    const noModel = await d.spawn('Implement Task 1: A')
    expect(noModel.deny).toContain('names no model')
    await d.spawn('Implement Task 1: A', { model: 'haiku' })
    const second = await d.spawn('Implement Task 2: B', { model: 'haiku' })
    expect(second.deny).toContain('forbids parallel implementers')
  })
})

describe('other warnings', () => {
  test('a success claim with no verification in the turn', SLOW, async ($, on) => {
    const w = world(on, { installed: true })
    const d = drive($, w)
    await d.start()
    await d.skill('verification-before-completion')
    await d.turn('All tests pass and it is ready to merge.')
    expect(await d.sp('status')).toContain('claimed with no verification run this turn')
  })
  test('the same claim after a test run in the turn is fine', SLOW, async ($, on) => {
    const w = world(on, { installed: true, toolText: (t, i) => (t === 'Bash' && String(i.command).startsWith('npm test') ? { text: '9 passed' } : { text: '' }) })
    const d = drive($, w)
    await d.start()
    await d.skill('test-driven-development')
    await $.prompt.submit({ text: 'run it', wait: false, origin: { kind: 'composer' } })
    await d.bash('npm test')
    await $.turn.complete({ answer: 'All tests pass.', durationMs: 5, isAborted: false, turnId: 't9', reason: 'answer' })
    await w.settle()
    expect(await d.sp('status')).not.toContain('claimed with no verification')
  })
  test('strict denies source writes before bounded approval, never docs', SLOW, async ($, on) => {
    const w = world(on, { installed: true })
    const d = drive($, w)
    await d.start()
    await d.sp('mode strict')
    await d.skill('brainstorming')
    await d.turn('This looks bounded, so I will present a short design here.')
    const src = await $.tool.call({ tool: 'Write', file_path: '/repo/src/a.ts', content: 'x' } as never)
    expect(src.deny).toContain('has not been approved yet')
    const doc = await $.tool.call({ tool: 'Write', file_path: '/repo/docs/notes.md', content: 'x' } as never)
    expect(doc.deny).toBeUndefined()
    const sub = await d.bash('npm test')
    expect(sub.deny).toBeUndefined()
  })
  test('subagent turns never count as main-loop claims', SLOW, async ($, on) => {
    const w = world(on, { installed: true })
    const d = drive($, w)
    await d.start()
    await d.skill('subagent-driven-development')
    const impl = await d.spawn('Implement Task 1: A', { model: 'haiku' })
    await d.agentDone(impl.agentId!, 'All tests pass. **Status:** DONE')
    expect(await d.sp('status')).not.toContain('claimed with no verification')
  })
})
