import { describe, test, expect } from 'claude-code/testing'
import { world, bandProps, SLOW } from './world'
import { drive } from './drive'
import {
  IMPLEMENTER_DONE,
  LEDGER_FIX2,
  LEDGER_TASK1,
  PLAN,
  PLAN_3_TASKS,
  PLAN_REL,
  ROOT,
  SERVER_INFO,
  SPEC_REL,
  WS,
} from './fixtures/superpowers'

const NOW = 1_760_000_000_000
const H = 3_600_000

const midExec = (base = ROOT, ledgerAge = 3 * H) => ({
  files: {
    [`${base}/${PLAN_REL}`]: PLAN_3_TASKS,
    [`${base}/.superpowers/sdd/2026-10-05-retry-policy/plan-path`]: `${PLAN_REL}\n`,
    [`${base}/.superpowers/sdd/2026-10-05-retry-policy/progress.md`]: LEDGER_FIX2,
  },
  mtimes: { [`${base}/.superpowers/sdd/2026-10-05-retry-policy/progress.md`]: NOW - ledgerAge, [`${base}/${PLAN_REL}`]: NOW - 4 * H },
})

describe('startup scan', () => {
  test('a mid-execution ledger in the checkout: resume capsule, toast, suggestion', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, ...midExec() })
    const d = drive($, w)
    await d.start()
    await d.flush()
    const vm = await d.band()
    expect(vm?.kind).toBe('resume')
    expect(vm?.resume).toMatchObject({ title: 'Retry Policy', kind: 'mid-exec', done: 1, total: 3, current: '2', fixRound: 2, ago: '3h ago' })
    expect(w.toasts).toContain('● Found unfinished plan · Retry Policy · 1 of 3 tasks done')
    expect(w.suggested[0]).toBe(`Continue executing ${PLAN_REL} with superpowers:subagent-driven-development. The ledger shows Task 1 complete and Task 2 at fix round 2/5.`)
  })

  test('a mid-execution ledger inside a .worktrees/ worktree is found from the main checkout', SLOW, async ($, on) => {
    const tree = `${ROOT}/.worktrees/feature-x`
    const w = world(on, { installed: true, now: NOW, worktrees: [tree], ...midExec(tree) })
    const d = drive($, w)
    await d.start()
    const scan = await d.sp('scan')
    expect(scan).toContain('mid-exec · Retry Policy · 1/3')
    expect(scan).toContain(`in ${tree}`)
  })

  test('an orphaned workspace is shown dimmed', SLOW, async ($, on) => {
    const w = world(on, {
      installed: true,
      now: NOW,
      files: { [`${ROOT}/.superpowers/sdd/gone/plan-path`]: 'docs/superpowers/plans/gone.md\n', [`${ROOT}/.superpowers/sdd/gone/progress.md`]: LEDGER_TASK1 },
      mtimes: { [`${ROOT}/.superpowers/sdd/gone/progress.md`]: NOW - 2 * H },
    })
    const d = drive($, w)
    await d.start()
    expect(await d.sp('scan')).toContain('orphan · gone')
  })

  test('a plan written but never executed, and a spec with no plan', SLOW, async ($, on) => {
    const w = world(on, {
      installed: true,
      now: NOW,
      files: { [PLAN]: PLAN_3_TASKS.replace(SPEC_REL, 'docs/superpowers/specs/other-design.md'), [`${ROOT}/${SPEC_REL}`]: '# spec' },
      mtimes: { [PLAN]: NOW - 2 * H, [`${ROOT}/${SPEC_REL}`]: NOW - 5 * H },
    })
    const d = drive($, w)
    await d.start()
    const scan = await d.sp('scan')
    expect(scan).toContain('planned · Retry Policy')
    expect(scan).toContain('spec · retry-policy')
    expect(scan.indexOf('planned')).toBeLessThan(scan.indexOf('spec ·'))
    const vm = await d.band()
    expect(vm?.resume?.more).toBe(1)
  })

  test('a live companion shows its URL; a dead one is stale', SLOW, async ($, on) => {
    // The folder is named for the launcher's pid, which exits once the
    // server is in the background: the server's own pid is in state/server.pid.
    const live = `${ROOT}/.superpowers/brainstorm/7777-1706000000/state`
    const dead = `${ROOT}/.superpowers/brainstorm/9999-1706000000/state`
    const w = world(on, { installed: true, now: NOW, files: { [`${live}/server-info`]: SERVER_INFO, [`${live}/server.pid`]: '4242\n', [`${dead}/server-info`]: SERVER_INFO, [`${dead}/server.pid`]: '5555\n' } })
    const d = drive($, w)
    await d.start()
    const scan = await d.sp('scan')
    expect(scan).toContain('companion · visual companion ')
    expect(scan).toContain('visual companion (stale)')
    expect(scan).toContain('http://localhost:52341/?key=ab12')
  })

  test('a ledger that keeps moving is followed read-only, and strict never denies because of it', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, ...midExec(ROOT, 30_000) })
    const d = drive($, w)
    await d.start()
    let vm = await d.band()
    expect(vm?.resume?.label).toBe('◐ live in another session (likely)')
    await d.ledger(`${WS}/progress.md`, `${LEDGER_FIX2}Task 2: complete (commits d4e5f6a..c0ffee1, review clean)\n`)
    vm = await d.band()
    expect(vm?.resume?.done).toBe(2)
    await d.sp('mode strict')
    const spawn = await d.spawn('Implement Task 1: Backoff calculator', { model: 'haiku' })
    expect(spawn.deny).toBeUndefined()
  })

  test('the scan never delays session.start, and a second start reads no file again', SLOW, async ($, on) => {
    let lists = 0
    const w = world(on, { installed: true, now: NOW, ...midExec(), listDelayMs: 5_000, onRead: path => void (path.startsWith(ROOT) && (lists += 1)) })
    const d = drive($, w)
    await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
    // session.start has resolved while the scan's first listing is still held.
    expect((await d.band())?.kind).not.toBe('resume')
    for (let i = 0; i < 40; i += 1) await w.clock.advance(5_000)
    await w.settle()
    expect((await d.band())?.kind).toBe('resume')
    const first = lists
    expect(first).toBeGreaterThan(0)
    await $.session.end({ reason: 'clear', sessionId: 'sess-1', resume: { id: 'sess-1' } })
    for (let i = 0; i < 40; i += 1) await w.clock.advance(5_000)
    await w.settle()
    // No walk: only the previewed plan and its ledger are read again.
    expect(lists - first).toBeLessThanOrEqual(2)
    expect((await d.band())?.kind).toBe('resume')
  })
})

describe('resume actions', () => {
  test('the resume strip: digit Buttons in the hook\'s own tree, each one acting', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, ...midExec() })
    const d = drive($, w)
    await d.start()
    const ui = await $.ui.mount({ plugin: 'superpowers-tracker', surface: 'terminal', component: 'AbovePrompt', props: bandProps(120) })
    const tree = JSON.stringify(await ui.drawn())
    // A digit answers from an empty prompt, as a survey's does; a letter would
    // need the band focused first. And no Button sits inside the Client.
    for (const [key, digit] of [['resume', '1'], ['open', '2'], ['dismiss', '3']] as const) {
      expect(tree).toMatch(new RegExp(`"type":"Button","props":\\{[^}]*"key":"${key}"[^}]*"hotkey":"${digit}"`))
    }
    expect(JSON.stringify(await ui.drawn({ in: 'band' }))).not.toContain('"type":"Button"')
    await ui.press({ key: 'open' })
    expect(w.opened).toContain('superpowers-tracker')
    await ui.press({ key: 'resume' })
    expect(w.filled.at(-1)).toContain('replace:Continue executing')
    await ui.press({ key: 'dismiss' })
    await ui.unmount()
    expect((await d.band())?.kind).toBe('armed')
  })

  test('the band and its Buttons take exactly the row they are given, at every width', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, ...midExec() })
    const d = drive($, w)
    await d.start()
    for (const cols of [48, 60, 72, 100, 140, 200]) {
      const ui = await $.ui.mount({ plugin: 'superpowers-tracker', surface: 'terminal', component: 'AbovePrompt', props: bandProps(cols) })
      const found: { label: string; hot: boolean }[] = []
      let bandW = NaN
      const walk = (n: unknown): void => {
        if (Array.isArray(n)) return n.forEach(walk)
        if (!n || typeof n !== 'object') return
        const o = n as { type?: string; props?: Record<string, unknown>; children?: unknown }
        if (o.type === 'Button') found.push({ label: String(o.props?.label ?? ''), hot: typeof o.props?.hotkey === 'string' })
        if (o.type === 'Client') bandW = Number(o.props?.width)
        walk(o.children)
      }
      walk(await ui.drawn())
      // Each plain Button is `1: label` or the label, one cell apart, one cell from the band.
      const buttons = found.reduce((n, b) => n + [...b.label].length + (b.hot ? 3 : 0), 0) + found.length
      expect(bandW + buttons).toBe(cols)
      await ui.unmount()
    }
  })

  test('brainstorming in a session that was only offered a plan starts at Brainstorm, not at that plan\'s stage', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, ...midExec() })
    const d = drive($, w)
    await d.start()
    expect((await d.band())?.kind).toBe('resume')
    await d.skill('superpowers:brainstorming')
    const vm = await d.band()
    expect(vm?.kind).toBe('live')
    expect(vm?.rail.find(x => x.state === 'current')?.id).toBe('brainstorm')
    expect(vm?.progress).toBeNull()
    // Picking the plan up instead continues it where the ledger left it.
  })

  test('executing the offered plan continues it where the ledger left it', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, ...midExec() })
    const d = drive($, w)
    await d.start()
    await d.skill('superpowers:subagent-driven-development')
    const vm = await d.band()
    expect(vm?.rail.find(x => x.state === 'current')?.id).toBe('execute')
    expect(vm?.progress).toMatchObject({ done: 1, total: 3 })
  })

  test('/sp resume fills the prompt (replace), never submits', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, ...midExec() })
    const d = drive($, w)
    await d.start()
    const text = await d.sp('resume')
    expect(text).toContain('Press Enter to send it')
    expect(w.filled[0]).toBe(`replace:Continue executing ${PLAN_REL} with superpowers:subagent-driven-development. The ledger shows Task 1 complete and Task 2 at fix round 2/5.`)
    expect(w.submitted).toEqual([])
  })

  test('dismiss --forget survives a restart until the ledger changes', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW, ...midExec() })
    const d = drive($, w)
    await d.start()
    expect(await d.sp('dismiss --forget')).toContain('for good')
    expect((await d.band())?.kind).toBe('armed')
    await $.session.end({ reason: 'clear', sessionId: 'sess-1', resume: { id: 'sess-1' } })
    await w.settle()
    expect((await d.band())?.kind).toBe('armed')
    w.mtimes[`${WS}/progress.md`] = NOW + 1000
    w.files[`${WS}/progress.md`] = `${LEDGER_FIX2}Task 2: complete (commits a..b, review clean)\n`
    await d.sp('scan')
    expect((await d.band())?.kind).toBe('resume')
  })

  test('a --resume transcript is replayed into the state a live session would have', SLOW, async ($, on) => {
    const messages = [
      { role: 'user', text: 'execute the plan', toolUses: [] },
      {
        role: 'assistant',
        text: 'Using subagent-driven-development.',
        toolUses: [
          { tool_use_id: 't1', tool: 'Skill', input: { skill: 'superpowers:subagent-driven-development' }, text: 'Launching skill' },
          { tool_use_id: 't2', tool: 'Write', input: { file_path: PLAN, content: PLAN_3_TASKS }, text: 'ok' },
          { tool_use_id: 't3', tool: 'Bash', input: { command: `bash scripts/sdd-workspace ${PLAN_REL}` }, text: `${WS}\n` },
          { tool_use_id: 't4', tool: 'Agent', input: { description: 'Implement Task 1: Backoff calculator', prompt: 'x', model: 'haiku' }, agentId: 'a1', text: IMPLEMENTER_DONE },
        ],
      },
    ]
    const w = world(on, { installed: true, now: NOW, messages, files: { [PLAN]: PLAN_3_TASKS, [`${WS}/progress.md`]: LEDGER_TASK1 }, mtimes: { [`${WS}/progress.md`]: NOW - 30 * 60_000 } })
    const d = drive($, w)
    await d.start()
    await d.turn('Resuming at Task 2.')
    const vm = await d.band()
    expect(vm?.kind).toBe('live')
    expect(vm?.progress).toMatchObject({ done: 1, total: 3 })
    const status = await d.sp('status')
    expect(status).toContain('executor subagent-driven-development')
  })

  test('state survives the module loading again (session.start re-fires)', SLOW, async ($, on) => {
    const w = world(on, { installed: true, now: NOW })
    const d = drive($, w)
    await d.start()
    await d.skill('brainstorming')
    await d.start()
    expect((await d.band())?.kind).toBe('live')
  })
})
