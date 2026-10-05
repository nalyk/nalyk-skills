// Drives a session the way the engine would: skills, tool calls, spawns,
// turns. Reads back through what the person sees: the band, /sp status.

import type { Engine } from 'claude-code/testing'
import type { Recorder } from './world'
import { bandProps } from './world'
import { ROOT } from './fixtures/superpowers'
import type { BandVM } from '../../hooks/ui/viewModel'

let seq = 0
const id = (p: string) => `${p}_${++seq}`

export const drive = ($: Engine, w: Recorder) => ({
  start: async () => {
    await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
    await w.settle()
  },
  skill: async (name: string) => {
    await $.skill.prompt({ skill: name, text: `skill ${name}` })
    await w.settle()
  },
  write: async (path: string, content = 'x') => {
    await $.tool.call({ tool: 'Write', file_path: path.startsWith('/') ? path : `${ROOT}/${path}`, content } as never)
    await w.settle()
  },
  edit: async (path: string, agentId?: string) => {
    await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/${path}`, old_string: 'a', new_string: 'b', ...(agentId ? { agentId } : {}) } as never)
    await w.settle()
  },
  bash: async (command: string) => {
    const r = await $.tool.call({ tool: 'Bash', command } as never)
    await w.settle()
    return r
  },
  spawn: async (description: string, opts: { model?: string; parentAgentId?: string; prompt?: string } = {}) => {
    const tool_use_id = id('toolu')
    const r = await $.agent.spawn({
      tool_use_id,
      prompt: opts.prompt ?? description,
      description,
      subagentType: 'general-purpose',
      provider: { plugin: 'engine', tier: 'core' },
      parentModel: 'claude-opus-5-5',
      background: false,
      fork: false,
      ...(opts.model ? { model: opts.model } : {}),
      ...(opts.parentAgentId ? { parentAgentId: opts.parentAgentId } : {}),
    })
    await w.settle()
    return { ...r, tool_use_id }
  },
  agentDone: async (agentId: string, answer: string) => {
    await $.turn.complete({ answer, durationMs: 1000, isAborted: false, turnId: id('turn'), agentId, reason: 'answer' })
    await w.settle()
  },
  turn: async (answer: string, prompt = 'go on') => {
    const sub = await $.prompt.submit({ text: prompt, wait: false, origin: { kind: 'composer' } })
    await w.settle()
    await $.turn.complete({ answer, durationMs: 1000, isAborted: false, turnId: id('turn'), reason: 'answer' })
    await w.settle()
    return sub
  },
  compact: async () => {
    await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'earlier work', toolUses: [] }] })
    await w.settle()
  },
  ledger: async (path: string, text: string) => {
    w.files[path] = text
    w.mtimes[path] = w.clock.now() + 1
    await w.clock.advance(2100)
    await w.settle()
  },
  flush: async () => {
    await w.clock.advance(1100)
    await w.settle()
  },
  sp: async (args: string) => (await $.command.run({ command: 'sp', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })).text ?? '',
  band: async (columns = 120, extra: { isWorking?: boolean; hasSurvey?: boolean } = {}): Promise<BandVM | undefined> => {
    const ui = await $.ui.mount({ plugin: 'superpowers-tracker', surface: 'terminal', component: 'AbovePrompt', props: bandProps(columns, extra) })
    const client = await ui.find({ type: 'Client' })
    await ui.unmount()
    return client ? ((client.props as { props: BandVM }).props) : undefined
  },
})
