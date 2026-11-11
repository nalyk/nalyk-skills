// The plan file and its ledger: parsed on change, folded into task rows.
// The ledger is the source of truth for progress.

import { taskLabel } from '../taskid'
import type { LedgerEntry, Run, TaskRow } from '../../types'
import type { Io } from '../io'
import { safe } from '../io'
import { LEDGER_NAME } from '../patterns'
import { parseLedger, parsePlan, progressOf } from '../parsers'
import { basename, blankTask, dirname, fmtDuration, joinPath, note, type Toaster } from '../core'
import { advance } from '../stages'
import { FRESH_LEDGER, freshRun } from '../state'
import { saveSnapshot } from '../archive'
import type { Ledger } from '../../types'

/** The ledger as far as it is this run's: one read for another workspace
 *  (a plan since shipped or replaced) says nothing about the tasks here. */
export const ledgerFor = (run: Pick<Run, 'workspace'>, ledger: Ledger): Ledger =>
  run.workspace && ledger.path === joinPath(run.workspace, LEDGER_NAME) ? ledger : FRESH_LEDGER

/** Two spellings of one plan: the same file, or the same dated name in another checkout or worktree. */
export const samePlan = (a: string, b: string): boolean => a === b || basename(a) === basename(b)

/** Files the old run's story under its plan, then starts the run over:
 *  its tests, finished agents and timeline go with it, so nothing of the
 *  old plan's Task N shows under the new plan's Task N. A replay files
 *  nothing: what it rebuilds is thinner than what the live session stored. */
export const archiveAndRestart = async (io: Io, stage: 'brainstorm' | 'plan', replay = false): Promise<void> => {
  const env = await io.state.env.get()
  const root = env.repoRoot ?? (await safe(io.session.cwd(), ''))
  if (root && !replay) await safe(saveSnapshot(io, root), false)
  const now = await io.now()
  await io.state.tests.set(() => [])
  await io.state.agents.set(list => list.filter(a => a.status === 'running'))
  await io.state.timeline.set(() => [])
  await io.state.run.set(r => ({
    ...freshRun(now),
    lifecycle: 'live',
    stage,
    stageInferred: false,
    pulseAt: now,
    turn: r.turn,
    turnHadVerification: r.turnHadVerification,
    debuggingActive: r.debuggingActive,
  }))
  await io.state.ledger.set(() => FRESH_LEDGER)
}

/** Takes a plan file as the run's plan. Answers false, changing nothing,
 *  when the file cannot be read. A different plan than the one the run
 *  holds starts a new run: no task row, workspace or review carries over. */
export const adoptPlan = async (io: Io, planPath: string, replay = false): Promise<boolean> => {
  const text = await safe(io.fs.read(planPath), undefined as string | undefined)
  if (text === undefined) return false
  const run = await io.state.run.get()
  const hasTasks = parsePlan(text).tasks.length > 0
  const another = !!run.planPath && !samePlan(run.planPath, planPath)
  // Another plan, or any plan at all once the run shipped with none of its own.
  if (hasTasks && !run.spectator && (another || (run.lifecycle === 'shipped' && !run.planPath))) {
    await archiveAndRestart(io, 'plan', replay)
  }
  await refreshPlan(io, planPath, text)
  return true
}

/** The first of the candidate folders under which a relative path exists. */
export const resolveExisting = async (io: Io, path: string, bases: readonly (string | undefined)[]): Promise<string | undefined> => {
  const tries = path.startsWith('/') ? [path] : [...new Set(bases.filter((b): b is string => !!b).map(b => joinPath(b, path)))]
  for (const p of tries) if (await safe(io.fs.exists(p), false)) return p
  return undefined
}

/** The plan a workspace was made for, from its plan-path marker. */
export const planOfWorkspace = async (io: Io, workspace: string): Promise<string | undefined> => {
  const marker = (await safe(io.fs.read(joinPath(workspace, 'plan-path')), '')).trim()
  if (!marker) return undefined
  const root = workspace.replace(/\/\.superpowers\/.*$/, '')
  return resolveExisting(io, marker, [root])
}

/** Reads the plan, keeping every task's live status; a parse failure keeps the last good read. */
export const refreshPlan = async (io: Io, planPath: string, known?: string): Promise<void> => {
  const text = known ?? (await safe(io.fs.read(planPath), undefined as string | undefined))
  if (text === undefined) return
  const parsed = parsePlan(text)
  await io.state.run.set(run => {
    if (parsed.tasks.length === 0) {
      // A file with no task is not taken in place of a plan that has them.
      if (run.planPath && !samePlan(run.planPath, planPath)) return run
      return { ...run, planPath, planParseError: parsed.error ?? 'no tasks' }
    }
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
    toast('●', `Task ${taskLabel(n)} complete`, `${detail}${took}`)
    await note(io, { kind: 'ledger', label: `Task ${taskLabel(n)} complete`, ok: true, detail: how?.commits ?? '' })
  }
  for (const f of change.fixRounds) {
    await note(io, { kind: 'ledger', label: `Task ${taskLabel(f.n)} fix round ${f.round}/5`, ok: false })
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
