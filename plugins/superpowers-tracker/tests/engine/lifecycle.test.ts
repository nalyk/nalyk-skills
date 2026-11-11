import { test, expect } from 'claude-code/testing'
import { world, bandProps, textOf, SLOW } from './world'
import { BOOTSTRAP_TEXT, ROOT } from './fixtures/superpowers'

const BAND = { plugin: 'superpowers-tracker', component: 'AbovePrompt' as const }

test('dormant: no superpowers anywhere draws nothing and starts no poll', SLOW, async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await w.settle()
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: bandProps(100) })
  expect(textOf(await ui.drawn())).toBe('ENGINE')
  expect(w.toasts).toHaveLength(0)
})

test('armed: the bootstrap at start shows the quiet brand capsule', SLOW, async ($, on) => {
  const w = world(on, { messages: [{ role: 'user', text: BOOTSTRAP_TEXT, toolUses: [] }] })
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await w.settle()
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: bandProps(100) })
  const client = await ui.find({ type: 'Client' })
  expect(client).toBeDefined()
  expect(JSON.stringify(client?.props)).toContain('"kind":"armed"')
})

test('live: the first skill.prompt turns the tracker on with a pulse, no command', SLOW, async ($, on) => {
  const w = world(on, { installed: true })
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await w.settle()
  await $.skill.prompt({ skill: 'superpowers:brainstorming', text: 'x' })
  await w.settle()
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: bandProps(120) })
  const props = (await ui.find({ type: 'Client' }))?.props as { props: { kind: string; pulseAt: number; rail: { state: string; id: string }[] } }
  expect(props.props.kind).toBe('live')
  expect(props.props.pulseAt).toBeGreaterThan(0)
  expect(props.props.rail.find(s => s.state === 'current')?.id).toBe('brainstorm')
})
