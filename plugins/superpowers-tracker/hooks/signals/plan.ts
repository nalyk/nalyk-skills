// The plan file and its ledger: parsed on change, folded into task rows.
// The ledger is the source of truth for progress.

import type { LedgerEntry, Run, TaskRow } from '../../types'
import type { Io } from '../io'
import { safe } from '../io'
import { LEDGER_NAME } from '../patterns'
import { parseLedger, parsePlan, progressOf } from '../parsers'
import { basename, blankTask, dirname, fmtDuration, joinPath, note, type Toaster } from '../core'
import { advance } from '../stages'

/** Reads the plan, keeping every task's live status; a parse failure keeps the last good read. */
export const refreshPlan = async (io: Io, planPath: string): Promise<void> => {
  const text = await safe(io.fs.read(planPath), undefined as string | undefined)
  if (text === undefined) return
  const parsed = parsePlan(text)
  await io.state.run.set(run => {
    if (parsed.tasks.length === 0) return { ...run, planPath, planParseError: parsed.error ?? 'no tasks' }
    const tasks: TaskRow[] = parsed.tasks.map(pt => {
      const had = run.tasks.find(t => t.n === pt.n) ?? blankTask(pt.n, pt.name)
      return { ...had, name: pt.name, steps: pt.steps, stepsDone: pt.stepsDone }
    })
    for (const extra of run.tasks) if (!tasks.some(t => t.n === extra.n)) tasks.push(extra)
    tasks.sort((a, b) => a.n - b.n)
    const { planParseError: _e, ...rest } = run
    return {
      ...rest,
      planPath,
      tasks,
      hasReviewFocus: parsed.hasReviewFocus,
      ...(parsed.title ? { planTitle: parsed.title } : {}),
      ...(parsed.goal ? { planGoal: parsed.goal } : {}),
      ...(parsed.spec ? { planSpec: parsed.spec } : {}),
    }
  })
}

/** sdd-workspace's resolution: <root>/.superpowers/sdd/<slug>[-<parent>[-N]] whose plan-path marker names the plan. */
export const resolveWorkspace = async (io: Io, root: string, planPath: string): Promise<string | undefined> => {
  const planId = planPath.startsWith(root + '/') ? planPath.slice(root.length + 1) : planPath
  const slug = basename(planPath).replace(/\.md$/, '')
  const parent = basename(dirname(planId.startsWith('/') ? planId : joinPath(root, planId)))
  const base = joinPath(root, '.superpowers/sdd')
  const candidates = [joinPath(base, slug), joinPath(base, `${slug}-${parent}`)]
  for (let n = 2; n < 10; n += 1) candidates.push(joinPath(base, `${slug}-${parent}-${n}`))
  for (const dir of candidates) {
    const marker = await safe(io.fs.read(joinPath(dir, 'plan-path')), undefined as string | undefined)
    if (marker === undefined) {
      if (!(await safe(io.fs.exists(dir), false))) return undefined
      continue
    }
    if (marker.trim() === planId || marker.trim() === planPath) return dir
  }
  return undefined
}

export type LedgerChange = { completed: number[]; fixRounds: { n: number; round: number }[]; finalReview: boolean }

/** Reads progress.md when its size or mtime moved, folding it into the run. */
export const refreshLedger = async (io: Io, toast: Toaster, opts: { force?: boolean; quiet?: boolean } = {}): Promise<LedgerChange | undefined> => {
  const run = await io.state.run.get()
  if (!run.workspace) return undefined
  const path = joinPath(run.workspace, LEDGER_NAME)
  const stat = await safe(io.fs.stat(path), undefined)
  const ledger = await io.state.ledger.get()
  if (!stat) {
    if (ledger.path === path && ledger.size > 0) {
      // The workspace is gone: superpowers deletes it after a clean final review.
      await io.state.run.set(r => ({ ...r, finishing: { ...(r.finishing ?? emptyFinishing()), workspaceDeleted: true } }))
    }
    return undefined
  }
  if (!opts.force && ledger.path === path && ledger.mtime === stat.mtimeMs && ledger.size === stat.size) return undefined
  const text = await safe(io.fs.read(path), undefined as string | undefined)
  const now = await io.now()
  if (text === undefined) {
    await io.state.ledger.set(l => ({ ...l, parseError: `couldn't read ${path}; showing last good read` }))
    return undefined
  }
  const parsed = parseLedger(text)
  const before = new Set(ledger.path === path ? ledger.entries.map(key) : [])
  const fresh = parsed.entries.filter(e => !before.has(key(e)))
  await io.state.ledger.set(() => ({
    path,
    mtime: stat.mtimeMs,
    size: stat.size,
    entries: parsed.entries,
    unknown: parsed.unknown.slice(-100),
    readAt: now,
    ...(parsed.planRef ? { planRef: parsed.planRef } : {}),
    ...(parsed.error ? { parseError: parsed.error } : {}),
  }))
  const change: LedgerChange = { completed: [], fixRounds: [], finalReview: false }
  for (const e of fresh) {
    if (e.kind === 'complete' && e.task !== undefined) change.completed.push(e.task)
    if (e.kind === 'fix-round' && e.task !== undefined) change.fixRounds.push({ n: e.task, round: e.round ?? 0 })
    if (e.kind.startsWith('final')) change.finalReview = true
  }
  await io.state.run.set(r => applyLedger(r, parsed.entries, now))
  if (opts.quiet) return change
  const after = await io.state.run.get()
  for (const n of change.completed) {
    const t = after.tasks.find(x => x.n === n)
    const took = t?.startedAt ? ` · ${fmtDuration((t.doneAt ?? now) - t.startedAt)}` : ''
    const how = fresh.find(e => e.kind === 'complete' && e.task === n)
    const detail = how?.parked ? `${how.parked} parked` : how?.clean ? 'review clean' : how?.tests ? 'tests green' : 'recorded'
    toast('●', `Task ${n} complete`, `${detail}${took}`)
    await note(io, { kind: 'ledger', label: `Task ${n} complete`, ok: true, detail: how?.commits ?? '' })
  }
  for (const f of change.fixRounds) {
    await note(io, { kind: 'ledger', label: `Task ${f.n} fix round ${f.round}/5`, ok: false })
  }
  return change
}

const key = (e: LedgerEntry): string => `${e.kind}|${e.task ?? ''}|${e.text}|${e.round ?? ''}`

const emptyFinishing = () => ({
  worktreeRemoved: false,
  branchDeleted: false,
  workspaceDeleted: false,
  rulingsListed: false,
  minorsListed: false,
})

/** Folds ledger entries into task rows and the stage. Pure. */
export const applyLedger = (run: Run, entries: readonly LedgerEntry[], now: number): Run => {
  const p = progressOf(entries)
  let tasks = run.tasks.map(t => ({ ...t, ledger: [] as string[] }))
  const ensure = (n: number) => {
    if (!tasks.some(t => t.n === n)) tasks = [...tasks, blankTask(n)].sort((a, b) => a.n - b.n)
  }
  for (const e of entries) {
    if (e.task === undefined) continue
    ensure(e.task)
    tasks = tasks.map(t => (t.n === e.task ? { ...t, ledger: [...t.ledger, `${e.kind}: ${e.text}`] } : t))
  }
  let lastDone = run.lastDone
  tasks = tasks.map(t => {
    if (p.done.includes(t.n)) {
      const entry = entries.find(e => e.kind === 'complete' && e.task === t.n)
      const wasDone = t.status === 'done' || t.status === 'parked'
      const doneAt = t.doneAt ?? now
      if (!wasDone) lastDone = { n: t.n, at: now }
      return {
        ...t,
        status: p.parked.has(t.n) ? 'parked' : 'done',
        doneAt,
        stepsDone: Math.max(t.stepsDone, t.steps),
        ...(entry?.commits ? { commits: entry.commits } : {}),
      }
    }
    const round = p.fixing.get(t.n)
    if (round !== undefined) return { ...t, status: 'fixing', fixRound: round, breaker: p.breaker.has(t.n) }
    return t
  })
  const anyWork = entries.some(e => e.task !== undefined)
  let next: Run = { ...run, tasks, ...(lastDone ? { lastDone } : {}) }
  if (anyWork) next = advance(next, 'execute', now)
  const allDone = tasks.length > 0 && tasks.every(t => t.status === 'done' || t.status === 'parked')
  if (allDone) next = advance(next, 'review', now, true)
  if (entries.some(e => e.kind.startsWith('final'))) next = advance(next, 'review', now)
  if (lastDone && lastDone !== run.lastDone) next = { ...next, pulseAt: now }
  const current = tasks.find(t => t.status === 'fixing' || t.status === 'running')?.n
  if (current !== undefined) next = { ...next, currentTask: current }
  return next
}
