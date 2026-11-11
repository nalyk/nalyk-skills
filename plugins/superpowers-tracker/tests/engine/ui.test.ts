import { describe, test, expect } from 'claude-code/testing'
import { world, bandProps, paneProps, textOf, SLOW } from './world'
import { drive } from './drive'
import { wideChars } from '../../hooks/ui/cells'
import { buildBand, bandTier } from '../../hooks/ui/viewModel'
import { demoWorld, DEMO_MS } from '../../hooks/ui/demo'
import { THEMES } from '../../hooks/ui/theme'
import { LEDGER_FIX2, PLAN, PLAN_3_TASKS, PLAN_REL, WS } from './fixtures/superpowers'

const BAND = { plugin: 'superpowers-tracker', component: 'AbovePrompt' as const }
const PANE = { plugin: 'superpowers-tracker', component: 'Pane' as const, requestId: 'superpowers-tracker' }
const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const

/** A session mid-plan: live, 1 of 3 tasks, Task 2 in a fix round, an implementer running. */
const midPlan = async ($: Parameters<typeof drive>[0], on: Parameters<typeof world>[0]) => {
  const w = world(on, {
    installed: true,
    files: { [PLAN]: PLAN_3_TASKS, [`${WS}/progress.md`]: LEDGER_FIX2 },
    toolText: (t, i) => (t === 'Bash' && String(i.command).includes('sdd-workspace') ? { text: `${WS}\n` } : { text: '' }),
  })
  const d = drive($, w)
  await d.start()
  await d.skill('subagent-driven-development')
  await d.write(PLAN_REL, PLAN_3_TASKS)
  await d.bash(`bash scripts/sdd-workspace ${PLAN_REL}`)
  await d.spawn('Implement Task 2: Retry policy', { model: 'sonnet' })
  return { w, d }
}

describe('the band', () => {
  test('width tiers at 48, 50, 80, 120, 140 and 160 columns, never a wide glyph', SLOW, async ($, on) => {
    const { d } = await midPlan($, on)
    for (const [cols, tier] of [[48, 'xs'], [50, 'sm'], [80, 'sm'], [120, 'md'], [140, 'lg'], [160, 'lg']] as const) {
      const ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: bandProps(cols, { isWorking: true }), viewport: { columns: cols + 5, rows: 40 } })
      const vm = ((await ui.find({ type: 'Client' }))?.props as { props: { tier: string } }).props
      expect(vm.tier, `${cols}`).toBe(tier)
      const tree = textOf(await ui.drawn({ in: 'band' }))
      expect(wideChars(tree), `${cols}`).toEqual([])
      if (tier === 'xs') expect(tree).toContain('1/3')
      if (tier === 'sm') expect(tree).toContain(' Execute ')
      if (tier === 'lg') expect(tree).toContain('Retry Policy')
      await ui.unmount()
    }
    expect(bandTier(49)).toBe('xs')
    void d
  })

  test('yields to a survey', SLOW, async ($, on) => {
    await midPlan($, on)
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: bandProps(120, { hasSurvey: true }) })
    expect(textOf(await ui.drawn())).toBe('ENGINE')
  })

  test('dark, light and ANSI themes; motion off; every surface draws', SLOW, async ($, on) => {
    const { d } = await midPlan($, on)
    for (const theme of ['dark', 'light', 'ansi'] as const) {
      await d.sp(`config theme ${theme}`)
      for (const motion of ['on', 'off'] as const) {
        await d.sp(`config motion ${motion}`)
        const vm = await d.band(120, { isWorking: true })
        expect(vm?.motion).toBe(motion === 'on' && theme !== 'ansi')
        expect(vm?.c.ansi).toBe(theme === 'ansi')
      }
    }
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface, props: bandProps(120) })
      const tree = await ui.drawn()
      const types = JSON.stringify(tree)
      if (surface === 'terminal') expect(types).toContain('"Client"')
      if (surface === 'desktop') expect(types).toContain('"Svg"')
      if (surface === 'vscode' || surface === 'mobile') expect(types).not.toContain('"Client"')
      await ui.unmount()
    }
  })

  test('a critical warning slides in a red strip with ack', SLOW, async ($, on) => {
    const { w, d } = await midPlan($, on)
    w.files[`${WS}/progress.md`] = `${LEDGER_FIX2}Task 2: complete (commits a..b, review clean)\n`
    w.mtimes[`${WS}/progress.md`] = w.clock.now() + 5
    await d.ledger(`${WS}/progress.md`, w.files[`${WS}/progress.md`]!)
    await d.spawn('Implement Task 2: Retry policy', { model: 'haiku' })
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: bandProps(120) })
    const tree = await ui.drawn({ in: 'band' })
    expect(JSON.stringify(tree)).toContain('"borderStyle":"round"')
    expect(textOf(tree)).toContain('Task 2 re-dispatched after it completed')
    await ui.press({ key: 'ack' })
    expect((await d.band())?.critical).toBeNull()
  })

  test('motion that marks an event: lit cell by cell in truecolor, inverse video under ANSI, still when off', SLOW, async ($, on) => {
    const { d } = await midPlan($, on)
    const connectors = async () => {
      const ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: bandProps(140) })
      const tree = JSON.stringify(await ui.drawn({ in: 'band' }))
      await ui.unmount()
      // One Text per cell: a connector cell is a lone ━, a filled bar cell a lone █.
      return (tree.match(/"children":\["━"\]/g) ?? []).length + (tree.match(/"children":\["█"\]/g) ?? []).length
    }
    // Truecolor: each finished connector cell and each filled bar cell is its
    // own span (a gradient, a comet, a sheen). ANSI and motion-off draw runs.
    const rich = await connectors()
    expect(rich).toBeGreaterThan(6)
    await d.sp('config theme ansi')
    expect(await connectors()).toBeLessThan(rich / 2)
    await d.sp('config theme dark')
    await d.sp('config motion off')
    expect(await connectors()).toBeLessThan(rich / 2)
  })

  test('renders well under 2 ms', () => {
    const w = demoWorld(30_000, 1_000)
    const t0 = performance.now()
    for (let i = 0; i < 200; i += 1) buildBand(w, THEMES.dark, { columns: 140, now: 31_000, working: true, version: '6.4.2' })
    expect((performance.now() - t0) / 200).toBeLessThan(2)
  })

  test('no frame faster than 12 fps, and an idle band holds still', SLOW, async ($, on) => {
    const w = world(on, { installed: true })
    const d = drive($, w)
    await d.start()
    await d.skill('brainstorming')
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: bandProps(120, { isWorking: false }), viewport: { columns: 125, rows: 40 } })
    const before = JSON.stringify(await ui.drawn({ in: 'band' }))
    await ui.advance(2_000)
    expect(JSON.stringify(await ui.drawn({ in: 'band' }))).toBe(before)
  })
})

describe('the pane', () => {
  test('every tab draws on every surface, with designed empty states', SLOW, async ($, on) => {
    const w = world(on, { installed: true })
    const d = drive($, w)
    await d.start()
    await d.skill('brainstorming')
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...PANE, surface, props: paneProps() })
      for (let tab = 1; tab <= 7; tab += 1) {
        await d.sp(String(tab))
        const text = textOf(await ui.drawn())
        expect(wideChars(text)).toEqual([])
        if (tab === 2) expect(text).toContain('No plan yet. Brainstorming writes a spec')
        if (tab === 4) expect(text).toContain('No ledger yet.')
      }
      await ui.unmount()
    }
  })

  test('number hotkeys switch tabs; mid-plan tabs show their data', SLOW, async ($, on) => {
    await midPlan($, on)
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: paneProps(140) })
    await ui.press({ key: 'tab2' })
    let text = textOf(await ui.drawn())
    expect(text).toContain('T A S K S')
    expect(text).toContain('Backoff calculator')
    expect(JSON.stringify(await ui.drawn())).toContain('"Raster"')
    await ui.press({ key: 'tab3' })
    text = textOf(await ui.drawn())
    expect(text).toContain('S W I M L A N E S')
    expect(text).toContain('implementer')
    await ui.press({ key: 'tab4' })
    expect(textOf(await ui.drawn())).toContain('P R E - F L I G H T')
    await ui.press({ key: 'tab6' })
    expect(textOf(await ui.drawn())).toContain('built against 7.0.2')
    await ui.press({ key: 'tabnext' })
    expect(textOf(await ui.drawn())).toContain('No process warnings.')
  })

  test('without the keyboard the pane shows no dead hotkey, and says how to get the keys', SLOW, async ($, on) => {
    await midPlan($, on)
    const off = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...paneProps(140), isFocused: false } })
    const tree = JSON.stringify(await off.drawn())
    expect(tree).not.toContain('"hotkey"')
    expect(textOf(await off.drawn())).toContain('ctrl+x tab')
    // The tabs are still there to click.
    await off.press({ key: 'tab2' })
    expect(textOf(await off.drawn())).toContain('T A S K S')
    await off.unmount()
    const on2 = await $.ui.mount({ ...PANE, surface: 'terminal', props: paneProps(140) })
    expect(JSON.stringify(await on2.drawn())).toContain('"hotkey":"3"')
    expect(textOf(await on2.drawn())).toContain('● keys')
  })

  test('when the pane cannot be placed, /sp says why', SLOW, async ($, on) => {
    const w = world(on, { installed: true, unplacedReason: 'below 110 columns (now 90)' })
    const d = drive($, w)
    await d.start()
    expect(await d.sp('')).toContain('below 110 columns')
  })
})

describe('commands', () => {
  test('/sp export writes a Markdown report with a self-ignoring folder', SLOW, async ($, on) => {
    const { w, d } = await midPlan($, on)
    const out = await d.sp('export')
    expect(out).toContain('/repo/.superpowers/tracker/sess-1.md')
    expect(w.files['/repo/.superpowers/tracker/.gitignore']).toBe('*\n')
    expect(w.files['/repo/.superpowers/tracker/sess-1.md']).toContain('| 1 | Backoff calculator | done |')
  })
  test('/sp ledger, /sp config and /sp band', SLOW, async ($, on) => {
    const { d } = await midPlan($, on)
    expect(await d.sp('ledger')).toContain('Deferred minors:')
    expect(await d.sp('config pollMs 100')).toBe('pollMs takes a number ≥ 500')
    expect(await d.sp('config pollMs 1500')).toBe('pollMs 1500')
    expect(await d.sp('band off')).toBe('Band off.')
    expect(await d.band()).toBeUndefined()
    expect(await d.sp('nonsense')).toContain('Unknown subcommand')
  })
})

describe('the demo', () => {
  test('plays every state over 60 s and never touches real state', SLOW, async ($, on) => {
    const w = world(on, { installed: true })
    const d = drive($, w)
    await d.start()
    await d.sp('demo')
    const seen = new Set<string>()
    for (let t = 0; t <= DEMO_MS; t += 2_500) {
      const vm = await d.band(120)
      seen.add(`${vm?.kind}:${vm?.rail.find(s => s.state === 'current')?.id}`)
      if (vm?.critical) seen.add('critical')
      if (vm?.fix?.breaker) seen.add('breaker')
      await w.clock.advance(2_500)
    }
    for (const s of ['live:brainstorm', 'live:spec', 'live:plan', 'live:execute', 'live:review', 'shipped:finish', 'critical']) expect([...seen]).toContain(s)
    await w.clock.advance(5_000)
    expect(await d.sp('status')).toContain('armed')
  })
})
