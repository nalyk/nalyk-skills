// The startup scan: unfinished superpowers work in this project and every
// worktree of it. Cached in $.store by repo root and directory mtimes.

import { taskLabel } from './taskid'
import type { Candidate, Executor, Settings } from '../types'
import type { Io } from './io'
import { safe } from './io'
import { BRAINSTORM_DIR, LEDGER_NAME } from './patterns'
import { parseLedger, parsePlan, progressOf, rulingCount } from './parsers'
import { ranges } from './modes'
import { basename, joinPath, relTo } from './core'

export const LIVE_WINDOW_MS = 5 * 60 * 1000

const RANK: Record<Candidate['kind'], number> = {
  'live-elsewhere': 0,
  'mid-exec': 1,
  planned: 2,
  spec: 3,
  companion: 4,
  orphan: 5,
}

export const rankCandidates = (list: readonly Candidate[]): Candidate[] =>
  [...list].sort((a, b) => RANK[a.kind] - RANK[b.kind] || b.mtime - a.mtime)

export const executorOf = (ledgerText: string): Executor =>
  /\btests:\s/.test(ledgerText) && !/review clean|fix round/.test(ledgerText) ? 'inline' : 'sdd'

/** The prompt suggestion built from evidence: never typed, never sent. */
export const suggestionFor = (c: Omit<Candidate, 'suggest'>, doneList: number[] = []): string => {
  switch (c.kind) {
    case 'live-elsewhere':
    case 'mid-exec': {
      const skill = c.executor === 'inline' ? 'superpowers:executing-plans' : 'superpowers:subagent-driven-development'
      const done = doneList.length ? `Task${doneList.length > 1 ? 's' : ''} ${ranges(doneList)} complete` : 'no task complete yet'
      const at = c.current !== undefined ? ` and Task ${taskLabel(c.current)}${c.fixRound ? ` at fix round ${c.fixRound}/5` : ' next'}` : ''
      return `Continue executing ${c.planPath ?? c.title} with ${skill}. The ledger shows ${done}${at}.`
    }
    case 'planned':
      return `Review ${c.planPath ?? c.title} and choose an execution method: superpowers:subagent-driven-development or superpowers:executing-plans.`
    case 'spec':
      return `Continue from the spec ${c.specPath ?? c.title}: once it is approved, use superpowers:writing-plans to turn it into an implementation plan.`
    case 'companion':
      return `Continue brainstorming with the visual companion${c.url ? ` at ${c.url}` : ''}.`
    case 'orphan':
      return `The SDD workspace ${c.workspace ?? c.title} names a plan that no longer exists (${c.planPath ?? '?'}). Review its ledger, then remove the workspace if the work is done.`
  }
}

type DirSig = { path: string; mtime: number }

export type ScanResult = { candidates: Candidate[]; fromCache: boolean; roots: string[]; ms: number }

export const worktreeRoots = async (io: Io, root: string): Promise<string[]> => {
  const r = await safe(io.run(['git', 'worktree', 'list', '--porcelain'], root), undefined)
  if (!r || r.code !== 0) return [root]
  const roots = r.out.split('\n').filter(l => l.startsWith('worktree ')).map(l => l.slice(9).trim())
  return roots.length ? [...new Set([root, ...roots])] : [root]
}

/** The cache key: every relevant file's name and mtime, by listing and
 *  stat alone; a changed plan, spec or ledger misses the cache, nothing is read. */
const sigOf = async (io: Io, roots: readonly string[], s: Settings): Promise<DirSig[]> => {
  const out: DirSig[] = []
  for (const r of roots) {
    for (const dir of [joinPath(r, s.planDir), joinPath(r, s.specDir), joinPath(r, BRAINSTORM_DIR)]) {
      for (const e of await safe(io.fs.list(dir), [])) out.push({ path: joinPath(dir, e.name), mtime: e.mtimeMs })
    }
    const sdd = joinPath(r, '.superpowers/sdd')
    for (const e of await safe(io.fs.list(sdd), [])) {
      if (e.kind !== 'dir') continue
      const st = await safe(io.fs.stat(joinPath(sdd, e.name, LEDGER_NAME)), undefined)
      out.push({ path: joinPath(sdd, e.name), mtime: st?.mtimeMs ?? 0 })
    }
  }
  return out
}

/** The full walk. `now` and the window decide what counts as recent. */
export const scan = async (io: Io, root: string, settings: Settings, opts: { force?: boolean } = {}): Promise<ScanResult> => {
  const t0 = await io.now()
  const roots = await worktreeRoots(io, root)
  const sig = await sigOf(io, roots, settings)
  const cacheKey = `scan:${root}`
  const cached = (await safe(io.store.get(cacheKey), undefined)) as { sig: DirSig[]; candidates: Candidate[] } | undefined
  if (!opts.force && cached && JSON.stringify(cached.sig) === JSON.stringify(sig)) {
    // Directories unchanged: refresh only each ledger's mtime (liveness).
    const now = await io.now()
    const candidates = await Promise.all(
      cached.candidates.map(async c => {
        if (!c.workspace) return c
        const st = await safe(io.fs.stat(joinPath(c.workspace, LEDGER_NAME)), undefined)
        if (!st) return c
        const kind = c.kind === 'orphan' ? 'orphan' : now - st.mtimeMs < LIVE_WINDOW_MS ? 'live-elsewhere' : 'mid-exec'
        return { ...c, mtime: st.mtimeMs, kind } as Candidate
      }),
    )
    // Keep the cache's own date moving, a day at a time, so the sweep knows the folder is in use.
    const stamped = cached as { at?: number }
    if (candidates.length && (typeof stamped.at !== 'number' || now - stamped.at > 24 * 3_600_000)) await safe(io.store.set(cacheKey, { ...cached, at: now }), undefined)
    return { candidates: rankCandidates(candidates), fromCache: true, roots, ms: (await io.now()) - t0 }
  }

  const now = await io.now()
  const windowMs = settings.windowDays * 24 * 3600 * 1000
  const found: Candidate[] = []
  const executedPlans = new Set<string>()
  const plannedSpecs = new Set<string>()

  for (const tree of roots) {
    const isOther = tree !== root
    // 1. SDD workspaces.
    const sddDir = joinPath(tree, '.superpowers/sdd')
    for (const ent of await safe(io.fs.list(sddDir), [])) {
      if (ent.kind !== 'dir') continue
      const ws = joinPath(sddDir, ent.name)
      const marker = (await safe(io.fs.read(joinPath(ws, 'plan-path')), '')).trim()
      const st = await safe(io.fs.stat(joinPath(ws, LEDGER_NAME)), undefined)
      if (!marker || !st) continue
      const planAbs = marker.startsWith('/') ? marker : joinPath(tree, marker)
      executedPlans.add(planAbs)
      executedPlans.add(joinPath(root, marker))
      const ledgerText = await safe(io.fs.read(joinPath(ws, LEDGER_NAME)), '')
      const parsed = parseLedger(ledgerText)
      const p = progressOf(parsed.entries)
      const planText = await safe(io.fs.read(planAbs), undefined as string | undefined)
      const plan = planText !== undefined ? parsePlan(planText) : undefined
      const total = plan?.tasks.length ?? Math.max(0, ...p.done, ...p.fixing.keys())
      const current = [...p.fixing.keys()][0] ?? plan?.tasks.find(t => !p.done.includes(t.n))?.n
      const executor = executorOf(ledgerText)
      const kind: Candidate['kind'] = plan === undefined ? 'orphan' : now - st.mtimeMs < LIVE_WINDOW_MS ? 'live-elsewhere' : 'mid-exec'
      const base = {
        id: `ws:${ws}`,
        kind,
        title: plan?.title ?? basename(marker).replace(/\.md$/, ''),
        stage: 'execute' as const,
        planPath: relTo(tree, planAbs),
        workspace: ws,
        done: p.done.length,
        total,
        rulings: rulingCount(parsed.entries),
        mtime: st.mtimeMs,
        executor,
        dim: kind === 'orphan',
        ...(isOther ? { worktree: tree } : {}),
        ...(current !== undefined ? { current } : {}),
        ...(current !== undefined && p.fixing.get(current) ? { fixRound: p.fixing.get(current)! } : {}),
      }
      found.push({ ...base, suggest: suggestionFor(base, p.done) })
    }

    // 3. Plans written but never executed.
    const planDir = joinPath(tree, settings.planDir)
    for (const ent of await safe(io.fs.list(planDir), [])) {
      if (ent.kind !== 'file' || !ent.name.endsWith('.md')) continue
      const abs = joinPath(planDir, ent.name)
      const text = await safe(io.fs.read(abs), '')
      const plan = parsePlan(text)
      if (plan.spec) plannedSpecs.add(basename(plan.spec))
      if (executedPlans.has(abs)) continue
      // A checkout's mtime is when it was cloned: date the plan by its name,
      // else by the commit that added it, else by mtime.
      const committed = await commitTime(io, tree, abs)
      const written = dateFromName(ent.name) ?? committed ?? ent.mtimeMs
      if (now - written > windowMs) continue
      if (await completedInGit(io, tree, abs, committed ?? written, plan.tasks.length)) continue
      const base = {
        id: `plan:${abs}`,
        kind: 'planned' as const,
        title: plan.title ?? ent.name.replace(/\.md$/, ''),
        stage: 'plan' as const,
        planPath: relTo(tree, abs),
        done: 0,
        total: plan.tasks.length,
        rulings: 0,
        mtime: written,
        dim: false,
        ...(isOther ? { worktree: tree } : {}),
      }
      found.push({ ...base, suggest: suggestionFor(base) })
    }
  }

  for (const tree of roots) {
    // 4. Specs with no plan naming them.
    const specDir = joinPath(tree, settings.specDir)
    for (const ent of await safe(io.fs.list(specDir), [])) {
      if (ent.kind !== 'file' || !/\.md$/.test(ent.name)) continue
      const specWritten = dateFromName(ent.name) ?? (await commitTime(io, tree, joinPath(specDir, ent.name))) ?? ent.mtimeMs
      if (plannedSpecs.has(ent.name) || now - specWritten > windowMs) continue
      const base = {
        id: `spec:${joinPath(specDir, ent.name)}`,
        kind: 'spec' as const,
        title: ent.name.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/(?:-design)?\.md$/, ''),
        stage: 'spec' as const,
        specPath: relTo(tree, joinPath(specDir, ent.name)),
        done: 0,
        total: 0,
        rulings: 0,
        mtime: specWritten,
        dim: false,
        ...(tree !== root ? { worktree: tree } : {}),
      }
      found.push({ ...base, suggest: suggestionFor(base) })
    }
    // 5. A visual companion still up.
    const bdir = joinPath(tree, BRAINSTORM_DIR)
    for (const ent of await safe(io.fs.list(bdir), [])) {
      if (ent.kind !== 'dir') continue
      const state = joinPath(bdir, ent.name, 'state')
      const info = await safe(io.fs.read(joinPath(state, 'server-info')), '')
      if (!info || (await safe(io.fs.exists(joinPath(state, 'server-stopped')), true))) continue
      // The folder's number is the launcher's pid, gone once it backgrounds
      // the server; the server's own is in state/server.pid.
      const pid = /^\s*(\d+)\s*$/.exec(await safe(io.fs.read(joinPath(state, 'server.pid')), ''))?.[1] ?? /^(\d+)-/.exec(ent.name)?.[1]
      const alive = pid ? (await safe(io.run(['kill', '-0', pid]), { code: 1, out: '', err: '' })).code === 0 : false
      const url = /"url"\s*:\s*"([^"]+)"/.exec(info)?.[1]
      const st = await safe(io.fs.stat(joinPath(state, 'server-info')), undefined)
      const base = {
        id: `companion:${joinPath(bdir, ent.name)}`,
        kind: 'companion' as const,
        title: alive ? 'visual companion' : 'visual companion (stale)',
        stage: 'brainstorm' as const,
        done: 0,
        total: 0,
        rulings: 0,
        mtime: st?.mtimeMs ?? 0,
        dim: !alive,
        ...(alive && url ? { url } : {}),
      }
      found.push({ ...base, suggest: suggestionFor(base) })
    }
  }

  const candidates = rankCandidates(found)
  if (candidates.length || sig.length) await safe(io.store.set(cacheKey, { sig, candidates, at: now }), undefined)
  else if (cached) await safe(io.store.del(cacheKey), undefined)
  return { candidates, fromCache: false, roots, ms: (await io.now()) - t0 }
}

/** `2026-10-05-retry-policy.md` → that day's end, local time; undefined without a date. */
export const dateFromName = (name: string): number | undefined => {
  const m = /^(\d{4})-(\d{2})-(\d{2})-/.exec(name)
  if (!m) return undefined
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59).getTime()
  return Number.isNaN(t) ? undefined : t
}

/** When git first saw the file, in ms; undefined when it is not committed. */
const commitTime = async (io: Io, tree: string, file: string): Promise<number | undefined> => {
  const r = await safe(io.run(['git', 'log', '--diff-filter=A', '--format=%ct', '-1', '--', relTo(tree, file)], tree), undefined)
  const sec = r && r.code === 0 ? Number(r.out.trim().split('\n')[0]) : NaN
  return Number.isFinite(sec) && sec > 0 ? sec * 1000 : undefined
}

/** Completion evidence in git: at least as many commits since the plan was
 *  written as it has tasks, touching more than docs. */
const completedInGit = async (io: Io, tree: string, plan: string, mtimeMs: number, tasks: number): Promise<boolean> => {
  if (tasks === 0) return false
  const since = `@${Math.floor(mtimeMs / 1000)}`
  const r = await safe(io.run(['git', 'log', `--since=${since}`, '--format=%h', '--', '.', `:(exclude)${relTo(tree, plan)}`, ':(exclude)docs/'], tree), undefined)
  if (!r || r.code !== 0) return false
  return r.out.trim().split('\n').filter(Boolean).length >= tasks
}

/** The Claude Code transcript folder for a project path. */
export const projectDirName = (cwd: string): string => cwd.replace(/[^A-Za-z0-9]/g, '-')
