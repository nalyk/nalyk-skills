// What outlives the session in $.store: tracker snapshots per repo and plan,
// the "left off at" record, and candidates dismissed for good.

import type { Agent, Env, Ledger, Run, SkillHit, TestRun, TimelineRow, UiState, Warning } from '../types'
import type { Io, Message } from './io'
import { safe } from './io'
import { normalizeSkill } from './patterns'
import { onSkill } from './signals/skills'
import { onToolResult } from './signals/tools'
import { assessSpawn, onAgentDone, recordSpawn } from './signals/agents'
import { onMainAnswer, onPromptSubmitted } from './signals/answers'
import { refreshPlan } from './signals/plan'
import type { Toaster } from './core'
import { FRESH_ENV, FRESH_LEDGER, FRESH_UI, freshRun } from './state'
import { indexKey, leftOffKey, snapKey, type LeftOff } from './archive'

export { SNAPSHOT_CAP_BYTES, PLANS_PER_REPO, fitSnapshot, saveSnapshot, loadSnapshot, leftOffKey, dismissKey, type Snapshot, type LeftOff } from './archive'
import type { Snapshot } from './archive'

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
  if (run.lifecycle === 'shipped' || run.stage === 'finish') {
    await safe(io.store.del(leftOffKey(root)), undefined)
    return undefined
  }
  if (!run.planPath || run.spectator || (run.stage !== 'execute' && run.stage !== 'review') || !ledger.path) return undefined
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
      if (m.text && !/^<|^\[Request interrupted/.test(m.text)) await onPromptSubmitted(io, true, m.text)
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


// ── The session checkpoint ──────────────────────────────────────────────
// Everything the tracker holds for one session, written every few seconds
// while it works. A crash, a closed terminal or a killed process fires no
// session.end, so the checkpoint is what the next start restores from.

export const CHECKPOINT_CAP_BYTES = 120_000
export const CHECKPOINTS_KEPT = 8
const CK_INDEX = 'ckidx'
const ckKey = (sessionId: string) => `ck:${sessionId}`

export type Checkpoint = {
  v: 1
  savedAt: number
  sessionId: string
  root: string
  lastRef?: string
  pendingAssist: boolean
  run: Run
  timeline: TimelineRow[]
  skills: SkillHit[]
  agents: Agent[]
  ledger: Ledger
  tests: TestRun[]
  warnings: Warning[]
  env: Env
  ui: UiState
  dismissed: string[]
  toasted: string[]
}

type CkIndexRow = { id: string; root: string; savedAt: number }

const fitCheckpoint = (c: Checkpoint, cap = CHECKPOINT_CAP_BYTES): Checkpoint => {
  let out = c
  for (let i = 0; i < 12 && JSON.stringify(out).length > cap; i += 1) {
    out = {
      ...out,
      timeline: out.timeline.slice(Math.floor(out.timeline.length / 2)),
      tests: out.tests.slice(Math.floor(out.tests.length / 2)),
      skills: out.skills.slice(Math.floor(out.skills.length / 2)),
      agents: out.agents.slice(Math.floor(out.agents.length / 3)),
      warnings: out.warnings.slice(-50),
      ledger: { ...out.ledger, unknown: out.ledger.unknown.slice(-10) },
    }
  }
  return out
}

/** A checkpoint holds this session's own work. A session that only looked
 *  at a resumable plan (its rows came from the plan's snapshot) has none,
 *  and must not write over, or push out, the checkpoint of one that did. */
const worthKeeping = (run: Run, skills: readonly SkillHit[]): boolean =>
  !run.spectator && (run.lifecycle === 'live' || run.lifecycle === 'shipped' || skills.length > 0)

export const saveCheckpoint = async (
  io: Io,
  m: { sessionId: string; root: string; lastRef?: string; pendingAssist: boolean },
): Promise<boolean> => {
  if (!m.sessionId) return false
  const [run, timeline, skills, agents, ledger, tests, warnings, env, ui, resume, now] = await Promise.all([
    io.state.run.get(),
    io.state.timeline.get(),
    io.state.skills.get(),
    io.state.agents.get(),
    io.state.ledger.get(),
    io.state.tests.get(),
    io.state.warnings.get(),
    io.state.env.get(),
    io.state.ui.get(),
    io.state.resume.get(),
    io.now(),
  ])
  if (!worthKeeping(run, skills)) return false
  const ck = fitCheckpoint({
    v: 1,
    savedAt: now,
    sessionId: m.sessionId,
    root: m.root,
    pendingAssist: m.pendingAssist,
    run,
    timeline,
    skills,
    agents,
    ledger,
    tests,
    warnings,
    env,
    ui,
    dismissed: resume.dismissed,
    toasted: resume.toasted,
    ...(m.lastRef ? { lastRef: m.lastRef } : {}),
  })
  await io.store.set(ckKey(m.sessionId), ck)
  // The index orders checkpoints for eviction: written only when this
  // session is not already its newest row, so a save is one store write.
  const all = (((await safe(io.store.get(CK_INDEX), [])) ?? []) as CkIndexRow[]).filter(r => r && typeof r.id === 'string')
  if (all.at(-1)?.id === m.sessionId) return true
  const index = all.filter(r => r.id !== m.sessionId)
  index.push({ id: m.sessionId, root: m.root, savedAt: now })
  while (index.length > CHECKPOINTS_KEPT) {
    const drop = index.shift()
    if (drop) await safe(io.store.del(ckKey(drop.id)), undefined)
  }
  await io.store.set(CK_INDEX, index)
  return true
}

const validCheckpoint = (v: unknown): v is Checkpoint => {
  const c = v as Partial<Checkpoint> | undefined
  return !!c && c.v === 1 && typeof c.sessionId === 'string' && !!c.run && Array.isArray(c.run.tasks) && Array.isArray(c.timeline)
}

/** This session's checkpoint: under its own id, else (a resume that was
 *  given a new id) the newest one whose last tool call is in the transcript. */
export const findCheckpoint = async (io: Io, sessionId: string, messages: readonly Message[]): Promise<Checkpoint | undefined> => {
  const own = sessionId ? await safe(io.store.get(ckKey(sessionId)), undefined) : undefined
  if (validCheckpoint(own)) return own
  if (messages.length === 0) return undefined
  const refs = new Set<string>()
  for (const m of messages) for (const u of m.toolUses ?? []) refs.add(u.tool_use_id)
  const index = (((await safe(io.store.get(CK_INDEX), [])) ?? []) as CkIndexRow[]).filter(r => r && typeof r.id === 'string')
  for (const row of index.reverse()) {
    const ck = await safe(io.store.get(ckKey(row.id)), undefined)
    if (validCheckpoint(ck) && ck.lastRef && refs.has(ck.lastRef)) return ck
  }
  return undefined
}

/** Puts a checkpoint back. Values a later version added take their fresh
 *  default; a subagent that was running when the process died is over. */
export const restoreCheckpoint = async (io: Io, ck: Checkpoint, now: number): Promise<void> => {
  await io.state.run.set(() => ({ ...freshRun(ck.run.startedAt || now), ...ck.run, tasks: ck.run.tasks ?? [] }))
  await io.state.timeline.set(() => ck.timeline ?? [])
  await io.state.skills.set(() => ck.skills ?? [])
  await io.state.agents.set(() =>
    (ck.agents ?? []).map(a => (a.status === 'running' ? { ...a, status: 'failed' as const, endedAt: ck.savedAt, summary: a.summary ?? 'interrupted: the session ended while it ran' } : a)),
  )
  await io.state.ledger.set(() => ({ ...FRESH_LEDGER, ...(ck.ledger ?? {}) }))
  await io.state.tests.set(() => ck.tests ?? [])
  await io.state.warnings.set(() => ck.warnings ?? [])
  await io.state.env.set(env => ({ ...FRESH_ENV, ...(ck.env ?? {}), installed: env.installed, ...(env.pluginVersion ? { pluginVersion: env.pluginVersion } : {}), ...(env.surface ? { surface: env.surface } : {}) }))
  await io.state.ui.set(() => ({ ...FRESH_UI, ...(ck.ui ?? {}) }))
  await io.state.resume.set(r => ({ ...r, dismissed: ck.dismissed ?? [], toasted: ck.toasted ?? [] }))
}

/** The transcript after the checkpoint's last tool call: what happened in
 *  the seconds between the last save and the end. Empty when it is unknown. */
export const tailAfter = (messages: readonly Message[], lastRef: string | undefined): Message[] => {
  if (!lastRef) return []
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]!
    const at = (m.toolUses ?? []).findIndex(u => u.tool_use_id === lastRef)
    if (at < 0) continue
    const rest = m.toolUses.slice(at + 1)
    return [...(rest.length ? [{ ...m, text: '', toolUses: rest }] : []), ...messages.slice(i + 1)]
  }
  return []
}

const DAY = 24 * 3_600_000

/** Sweeps what the store no longer needs: scan caches of folders not seen
 *  for a month, snapshots under a name that is no plan file or older than 90
 *  days, checkpoints older than a month, stale left-off records. */
export const pruneStore = async (io: Io, now: number): Promise<number> => {
  const keys = await safe(io.store.keys(), [] as string[])
  let dropped = 0
  const drop = async (k: string) => {
    await safe(io.store.del(k), undefined)
    dropped += 1
  }
  const deadSnaps = new Set<string>()
  for (const k of keys) {
    if (k.startsWith('scan:')) {
      const v = (await safe(io.store.get(k), undefined)) as { at?: number } | undefined
      if (!v || typeof v.at !== 'number' || now - v.at > 30 * DAY) await drop(k)
    } else if (k.startsWith('snap:')) {
      const plan = k.slice(k.indexOf('::') + 2)
      const v = (await safe(io.store.get(k), undefined)) as { savedAt?: number } | undefined
      if (!/\.md$/.test(plan) || !v || typeof v.savedAt !== 'number' || now - v.savedAt > 90 * DAY) {
        deadSnaps.add(k)
        await drop(k)
      }
    } else if (k.startsWith('ck:')) {
      const v = (await safe(io.store.get(k), undefined)) as { savedAt?: number } | undefined
      if (!v || typeof v.savedAt !== 'number' || now - v.savedAt > 30 * DAY) await drop(k)
    } else if (k.startsWith('leftoff:')) {
      const v = (await safe(io.store.get(k), undefined)) as { at?: number } | undefined
      if (!v || typeof v.at !== 'number' || now - v.at > 60 * DAY) await drop(k)
    }
  }
  for (const k of keys) {
    if (!k.startsWith('snapidx:')) continue
    const root = k.slice('snapidx:'.length)
    const list = (((await safe(io.store.get(k), [])) ?? []) as string[]).filter(p => typeof p === 'string')
    const kept = list.filter(p => !deadSnaps.has(snapKey(root, p)) && /\.md$/.test(p))
    if (kept.length === list.length) continue
    if (kept.length) await safe(io.store.set(indexKey(root), kept), undefined)
    else await drop(k)
  }
  const left = new Set(await safe(io.store.keys(), [] as string[]))
  const index = (((await safe(io.store.get(CK_INDEX), [])) ?? []) as CkIndexRow[]).filter(r => r && left.has(ckKey(r.id)))
  if (left.has(CK_INDEX)) await safe(io.store.set(CK_INDEX, index), undefined)
  return dropped
}
