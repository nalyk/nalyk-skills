// Shared moves on the tracker's state: timeline rows, warnings, the pulse,
// the lifecycle and task rows. Every function takes the Io, never `$`.

import type { Run, Severity, StageId, TaskRow, TimelineRow } from '../types'
import type { Io } from './io'
import { CAP, capTail } from './state'
import { advance, goLive } from './stages'
import { makeWarning, type WarningCode } from './warnings'

export type Toaster = (glyph: string, subject: string, detail: string, sev?: Severity) => void

export const note = async (io: Io, row: Omit<TimelineRow, 'at' | 'stage'> & { stage?: StageId }): Promise<void> => {
  const at = await io.now()
  const stage = row.stage ?? (await io.state.run.get()).stage
  await io.state.timeline.set(list => capTail([...list, { ...row, at, stage }], CAP.timeline))
}

export const warn = async (
  io: Io,
  toast: Toaster,
  code: WarningCode,
  text: string,
  evidence: string,
  sev?: Severity,
): Promise<void> => {
  const at = await io.now()
  const w = makeWarning(code, text, evidence, at, sev)
  let isNew = false
  await io.state.warnings.set(list => {
    if (list.some(x => x.id === w.id)) return list
    isNew = true
    return capTail([...list, w], CAP.warnings)
  })
  if (!isNew) return
  await note(io, { kind: 'warning', label: text, ok: false, detail: evidence })
  if (w.sev === 'critical') toast('✗', text, evidence, 'critical')
  else if (w.sev === 'warn') toast('⚠', text, evidence, 'warn')
}

/** The first superpowers signal of a session: the tracker comes alive, pulsing. */
export const live = async (io: Io): Promise<Run> => {
  const now = await io.now()
  return io.state.run.set(run => goLive(run, now))
}

export const toStage = async (io: Io, stage: StageId, inferred = false): Promise<Run> => {
  const now = await io.now()
  return io.state.run.set(run => advance(goLive(run, now), stage, now, inferred))
}

export const patchTask = async (io: Io, n: number, fn: (t: TaskRow) => TaskRow): Promise<void> => {
  await io.state.run.set(run => {
    const has = run.tasks.some(t => t.n === n)
    const base: TaskRow = blankTask(n)
    const tasks = has ? run.tasks.map(t => (t.n === n ? fn(t) : t)) : [...run.tasks, fn(base)].sort((a, b) => a.n - b.n)
    return { ...run, tasks }
  })
}

export const blankTask = (n: number, name = `Task ${n}`): TaskRow => ({
  n,
  name,
  steps: 0,
  stepsDone: 0,
  status: 'pending',
  fixRound: 0,
  breaker: false,
  agents: 0,
  tdd: [],
  implFirst: false,
  sawTestEdit: false,
  ledger: [],
})

export const pulse = async (io: Io): Promise<void> => {
  const now = await io.now()
  await io.state.run.set(run => ({ ...run, pulseAt: now }))
}

export const isTestFile = (path: string, patterns: readonly string[]): boolean =>
  patterns.some(p => {
    try {
      return new RegExp(p).test(path)
    } catch {
      return false
    }
  })

export const isTestCommand = (command: string, runners: readonly string[]): boolean =>
  runners.some(r => {
    try {
      return new RegExp(`(^|[\\s;&|(])${r}(\\s|$|;)`).test(command)
    } catch {
      return false
    }
  })

export const fmtDuration = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`
}

export const fmtAgo = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export const fmtCount = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

export const basename = (p: string): string => p.replace(/\/+$/, '').split('/').at(-1) ?? p
export const dirname = (p: string): string => p.replace(/\/[^/]*$/, '') || '/'
export const joinPath = (...parts: string[]): string => parts.join('/').replace(/\/{2,}/g, '/')
export const relTo = (root: string | undefined, p: string): string =>
  root && p.startsWith(root + '/') ? p.slice(root.length + 1) : p
