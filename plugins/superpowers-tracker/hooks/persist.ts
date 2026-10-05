// What outlives the session in $.store: tracker snapshots per repo and plan,
// the "left off at" record, and candidates dismissed for good.

import type { Agent, Ledger, Run, TestRun, TimelineRow, Warning } from '../types'
import type { Io, Message } from './io'
import { safe } from './io'
import { normalizeSkill } from './patterns'
import { onSkill } from './signals/skills'
import { onToolResult } from './signals/tools'
import { assessSpawn, onAgentDone, recordSpawn } from './signals/agents'
import { onMainAnswer, onPromptSubmitted } from './signals/answers'
import { refreshPlan } from './signals/plan'
import type { Toaster } from './core'

export const SNAPSHOT_CAP_BYTES = 200_000
export const PLANS_PER_REPO = 10

export type Snapshot = {
  savedAt: number
  sessionId?: string
  run: Run
  timeline: TimelineRow[]
  agents: Agent[]
  warnings: Warning[]
  tests: TestRun[]
  ledgerPath?: string
}

export type LeftOff = {
  planPath: string
  task?: number
  fixRound?: number
  sessionId: string
  resume: string
  at: number
}

const snapKey = (root: string, plan: string) => `snap:${root}::${plan}`
const indexKey = (root: string) => `snapidx:${root}`
export const leftOffKey = (root: string) => `leftoff:${root}`
export const dismissKey = (root: string) => `dismiss:${root}`

/** Trims the oldest rows until the snapshot fits its cap. */
export const fitSnapshot = (s: Snapshot, cap = SNAPSHOT_CAP_BYTES): Snapshot => {
  let out = s
  for (let i = 0; i < 12 && JSON.stringify(out).length > cap; i += 1) {
    out = {
      ...out,
      timeline: out.timeline.slice(Math.floor(out.timeline.length / 2)),
      tests: out.tests.slice(Math.floor(out.tests.length / 2)),
      agents: out.agents.slice(Math.floor(out.agents.length / 3)),
      warnings: out.warnings.slice(-50),
    }
  }
  return out
}

export const saveSnapshot = async (io: Io, root: string): Promise<boolean> => {
  const run = await io.state.run.get()
  if (!run.planPath || run.lifecycle === 'dormant') return false
  const [timeline, agents, warnings, tests, ledger, sessionId, now] = await Promise.all([
    io.state.timeline.get(),
    io.state.agents.get(),
    io.state.warnings.get(),
    io.state.tests.get(),
    io.state.ledger.get(),
    safe(io.session.id(), ''),
    io.now(),
  ])
  const snap = fitSnapshot({
    savedAt: now,
    run,
    timeline,
    agents,
    warnings,
    tests,
    ...(sessionId ? { sessionId } : {}),
    ...(ledger.path ? { ledgerPath: ledger.path } : {}),
  })
  await io.store.set(snapKey(root, run.planPath), snap)
  const index = (((await safe(io.store.get(indexKey(root)), [])) ?? []) as string[]).filter(p => p !== run.planPath)
  index.push(run.planPath)
  while (index.length > PLANS_PER_REPO) {
    const drop = index.shift()
    if (drop) await safe(io.store.del(snapKey(root, drop)), undefined)
  }
  await io.store.set(indexKey(root), index)
  return true
}

export const loadSnapshot = async (io: Io, root: string, plan: string): Promise<Snapshot | undefined> =>
  (await safe(io.store.get(snapKey(root, plan)), undefined)) as Snapshot | undefined

/** Brings an earlier session's story into this one: rows before ours, deduped by time. */
export const mergeSnapshot = async (io: Io, snap: Snapshot): Promise<void> => {
  await io.state.timeline.set(list => {
    const first = list[0]?.at ?? Infinity
    const earlier = snap.timeline.filter(r => r.at < first)
    return [...earlier, ...list].slice(-500)
  })
  await io.state.agents.set(list => [...snap.agents.filter(a => !list.some(b => b.id === a.id)).map(a => (a.status === 'running' ? { ...a, status: 'failed' as const } : a)), ...list].slice(-200))
  await io.state.tests.set(list => [...snap.tests.filter(t => !list.some(u => u.ref === t.ref)), ...list].slice(-400))
  await io.state.run.set(run => ({
    ...run,
    tasks: run.tasks.length ? run.tasks.map(t => {
      const old = snap.run.tasks.find(o => o.n === t.n)
      return old ? { ...t, startedAt: t.startedAt ?? old.startedAt, agents: Math.max(t.agents, old.agents), tdd: t.tdd.length ? t.tdd : old.tdd } : t
    }) : snap.run.tasks,
    startedAt: Math.min(run.startedAt || Infinity, snap.run.startedAt || Infinity),
  }))
}

export const saveLeftOff = async (io: Io, root: string, sessionId: string): Promise<LeftOff | undefined> => {
  const run = await io.state.run.get()
  const ledger: Ledger = await io.state.ledger.get()
  if (!run.planPath || run.stage !== 'execute' || !ledger.path) return undefined
  const fixing = run.tasks.find(t => t.status === 'fixing')
  const rec: LeftOff = {
    planPath: run.planPath,
    sessionId,
    resume: `claude --resume ${sessionId}`,
    at: await io.now(),
    ...(run.currentTask !== undefined ? { task: run.currentTask } : {}),
    ...(fixing ? { fixRound: fixing.fixRound } : {}),
  }
  await io.store.set(leftOffKey(root), rec)
  return rec
}

/** Rebuilds this session's state from a resumed transcript, through the
 *  same parsers a live session uses. Bodies over 64 KB are skipped. */
export const rehydrate = async (io: Io, messages: readonly Message[]): Promise<number> => {
  const MAX = 64 * 1024
  const quiet: Toaster = () => undefined
  let replayed = 0
  for (const m of messages) {
    if (m.role === 'user') {
      const typed = /<command-name>\/?([\w:-]+)<\/command-name>/.exec(m.text)?.[1]
      const skill = normalizeSkill(typed)
      if (skill) {
        await onSkill(io, skill, { via: 'replay' })
        replayed += 1
      }
      if (m.text && !/^<|^\[Request interrupted/.test(m.text)) await onPromptSubmitted(io, true)
      continue
    }
    for (const use of m.toolUses) {
      const text = (use.text ?? '').length > MAX ? '' : use.text ?? ''
      const input = use.input ?? {}
      if (use.tool === 'Agent' || use.tool === 'Task') {
        const e = {
          tool_use_id: use.tool_use_id,
          prompt: typeof input.prompt === 'string' ? input.prompt : '',
          description: typeof input.description === 'string' ? input.description : '',
          subagentType: typeof input.subagent_type === 'string' ? input.subagent_type : 'general-purpose',
          ...(typeof input.model === 'string' ? { model: input.model } : {}),
        }
        const a = await assessSpawn(io, quiet, e, true)
        await recordSpawn(io, e, a, use.agentId ? { agentId: use.agentId } : {})
        if (use.agentId && use.text !== undefined) await onAgentDone(io, quiet, use.agentId, text, use.isError === true, true)
        replayed += 1
        continue
      }
      await onToolResult(io, quiet, { tool: use.tool, id: use.tool_use_id, input, text, isError: use.isError === true, replay: true })
      replayed += 1
    }
    if (m.text) await onMainAnswer(io, quiet, m.text.slice(0, MAX), 'replay', true)
  }
  const run = await io.state.run.get()
  if (run.planPath) await refreshPlan(io, run.planPath)
  return replayed
}
