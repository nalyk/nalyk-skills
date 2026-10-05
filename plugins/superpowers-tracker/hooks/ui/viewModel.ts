// State to plain view data, shared by every surface; renderers only draw.

import type {
  Agent,
  DemoState,
  Env,
  Ledger,
  ResumeState,
  Run,
  Settings,
  SkillHit,
  StageId,
  TestRun,
  TimelineRow,
  UiState,
  Warning,
} from '../../types'
import { STAGE_INITIAL, STAGE_LABEL, STAGES, executeProgress, stageIndex } from '../stages'
import { openWarnings, topSeverity } from '../warnings'
import { rulingCount } from '../parsers'
import { fmtAgo } from '../core'
import { GLYPH, SEV_COLOR, brandRamp, tintOf, type Tokens } from './theme'
import { sparkline } from './cells'
import { roleLabel } from '../signals/agents'

export type World = {
  run: Run
  timeline: TimelineRow[]
  skills: SkillHit[]
  agents: Agent[]
  ledger: Ledger
  tests: TestRun[]
  warnings: Warning[]
  env: Env
  ui: UiState
  resume: ResumeState
  settings: Settings
  demo: DemoState
}

export type Tier = 'xs' | 'sm' | 'md' | 'lg'
export const bandTier = (columns: number): Tier => (columns < 50 ? 'xs' : columns < 90 ? 'sm' : columns < 140 ? 'md' : 'lg')

export const SHIP_HOLD_MS = 30_000
export const SHIP_SPARK_MS = 1_500

export type RailStop = { id: StageId; label: string; initial: string; hue: string; state: 'done' | 'current' | 'future'; inferred: boolean }
export type AgentChip = { role: string; glyph: string; model: string; task?: number; title: string; startedAt: number }

export type BandVM = {
  kind: 'armed' | 'resume' | 'live' | 'shipped'
  tier: Tier
  columns: number
  motion: boolean
  working: boolean
  now: number
  pulseAt: number
  version: string
  mode: 'observe' | 'assist' | 'strict'
  c: { muted: string; text: string; ok: string; warn: string; critical: string; hue: string; tint: string | null; brand: string[]; ansi: boolean }
  rail: RailStop[]
  path: string | null
  pathInferred: boolean
  progress: { done: number; total: number; fraction: number } | null
  title: string | null
  pills: { rulings: number; agents: number; warnings: number; warnColor: string }
  agents: AgentChip[]
  fix: { round: number; breaker: boolean; task: number } | null
  tdd: { dots: boolean[]; green: boolean } | null
  spark: string
  idle: string
  critical: { id: string; text: string; evidence: string } | null
  resume: { title: string; kind: string; label: string; done: number; total: number; current: number | null; fixRound: number | null; ago: string; rulings: number; more: number; hue: string } | null
  shipped: string | null
}

const PATH_TAG = { architectural: 'ARCH', bounded: 'BOUNDED', spike: 'SPIKE' } as const

export const visibleCandidates = (r: ResumeState) => r.candidates.filter(c => !r.dismissed.includes(c.id))

/** What the band shows now, or null for nothing (dormant, off, compact while idle). */
export const buildBand = (
  w: World,
  t: Tokens,
  o: { columns: number; now: number; working: boolean; version: string },
): BandVM | null => {
  const { run, settings } = w
  if (settings.band === 'off' || run.lifecycle === 'dormant') return null
  const shippedRecently = run.shippedAt !== undefined && o.now - run.shippedAt < SHIP_HOLD_MS
  const candidates = visibleCandidates(w.resume)
  const top = candidates[0]
  const isLive = run.lifecycle === 'live' || (run.lifecycle === 'shipped' && !shippedRecently && run.stage !== 'finish')
  const kind: BandVM['kind'] = shippedRecently
    ? 'shipped'
    : isLive && run.lifecycle === 'live'
      ? 'live'
      : top
        ? 'resume'
        : 'armed'
  if (kind === 'armed' && settings.band === 'compact') return null

  const stage = kind === 'resume' && top ? top.stage : run.stage
  const hue = kind === 'shipped' ? t.stage.finish : t.stage[stage]
  const rail: RailStop[] = STAGES.map(id => ({
    id,
    label: STAGE_LABEL[id],
    initial: STAGE_INITIAL[id],
    hue: t.stage[id],
    state: stageIndex(id) < stageIndex(stage) ? 'done' : id === stage ? 'current' : 'future',
    inferred: id === stage && run.stageInferred,
  }))
  const prog = kind === 'resume' && top ? { done: top.done, total: top.total, fraction: top.total ? top.done / top.total : 0 } : executeProgress(run)
  const open = openWarnings(w.warnings)
  const sev = topSeverity(w.warnings)
  const running = w.agents.filter(a => a.status === 'running')
  const crit = open.find(x => x.sev === 'critical')
  const current = run.tasks.find(x => x.n === run.currentTask)
  const rulings = kind === 'resume' && top ? top.rulings : rulingCount(w.ledger.entries)
  const lastDone = run.lastDone
  const idle = lastDone ? `last: Task ${lastDone.n} ${GLYPH.check} ${fmtAgo(o.now - lastDone.at)}` : run.planTitle ? `plan: ${run.planTitle}` : 'ready'
  const label =
    top?.kind === 'live-elsewhere'
      ? '◐ live in another session (likely)'
      : top?.kind === 'planned'
        ? 'planned, not executed'
        : top?.kind === 'spec'
          ? 'spec awaiting a plan'
          : top?.kind === 'companion'
            ? 'companion'
            : top?.kind === 'orphan'
              ? 'orphaned workspace'
              : 'resumable'

  return {
    kind,
    tier: bandTier(o.columns),
    columns: o.columns,
    motion: settings.motion && !t.ansi,
    working: o.working,
    now: o.now,
    pulseAt: run.pulseAt,
    version: o.version,
    mode: settings.mode,
    c: {
      muted: t.muted,
      text: t.text,
      ok: t.ok,
      warn: t.warn,
      critical: t.critical,
      hue,
      tint: tintOf(t, hue) ?? null,
      brand: brandRamp(t, 13),
      ansi: t.ansi,
    },
    rail,
    path: run.path ? PATH_TAG[run.path] : null,
    pathInferred: run.pathInferred,
    progress: prog.total > 0 ? prog : null,
    title: kind === 'resume' && top ? top.title : run.planTitle ?? null,
    pills: {
      rulings,
      agents: running.length,
      warnings: open.length,
      warnColor: sev ? SEV_COLOR(t, sev) : t.muted,
    },
    agents: running.slice(0, 3).map(a => ({
      role: roleLabel(a.role),
      glyph: GLYPH.tier[a.tier],
      model: a.model ? a.model.replace(/^claude-/, '').split('-')[0] ?? a.model : 'inherits',
      title: run.tasks.find(x => x.n === a.task)?.name ?? a.description,
      startedAt: a.startedAt,
      ...(a.task !== undefined ? { task: a.task } : {}),
    })),
    fix: current && current.fixRound > 0 ? { round: current.fixRound, breaker: current.breaker, task: current.n } : null,
    tdd: current && current.tdd.length ? { dots: current.tdd.slice(-6).map(d => d.ok), green: current.tdd.some(d => !d.ok) && current.tdd.at(-1)?.ok === true } : null,
    spark: sparkline(w.env.context, 8),
    idle,
    critical: crit ? { id: crit.id, text: crit.text, evidence: crit.evidence } : null,
    resume:
      kind === 'resume' && top
        ? {
            title: top.title,
            kind: top.kind,
            label,
            done: top.done,
            total: top.total,
            current: top.current ?? null,
            fixRound: top.fixRound ?? null,
            ago: fmtAgo(o.now - top.mtime),
            rulings: top.rulings,
            more: candidates.length - 1,
            hue: t.stage[top.stage],
          }
        : null,
    shipped: kind === 'shipped' ? run.shipSummary ?? 'shipped' : null,
  }
}

/** The breadcrumb `plan › <basename> › Task 5`. */
export const breadcrumb = (run: Run): string[] => {
  const parts: string[] = [STAGE_LABEL[run.stage].toLowerCase()]
  if (run.planPath) parts.push((run.planPath.split('/').at(-1) ?? '').replace(/\.md$/, ''))
  if (run.currentTask !== undefined) parts.push(`Task ${run.currentTask}`)
  return parts
}

/** Plain-text status for `/sp status`. */
export const statusText = (w: World, now: number): string => {
  const { run } = w
  const p = executeProgress(run)
  const open = openWarnings(w.warnings)
  const lines = [
    `ϟ superpowers-tracker · ${run.lifecycle} · stage ${STAGE_LABEL[run.stage]}${run.stageInferred ? '?' : ''}${run.path ? ` · path ${run.path}${run.pathInferred ? '?' : ''}` : ''}`,
  ]
  if (run.planPath) lines.push(`plan: ${run.planTitle ?? run.planPath} (${run.planPath})`)
  if (p.total) lines.push(`tasks: ${p.done}/${p.total} done${run.currentTask !== undefined ? ` · current Task ${run.currentTask}` : ''}${run.executor ? ` · executor ${run.executor === 'sdd' ? 'subagent-driven-development' : 'executing-plans'}` : ''}`)
  for (const t of run.tasks) {
    const g = t.status === 'done' ? '●' : t.status === 'parked' ? '⚠' : t.status === 'blocked' ? '✗' : t.status === 'pending' ? '○' : '◐'
    lines.push(`  ${g} ${String(t.n).padStart(2)} ${t.name}${t.fixRound ? ` · fix ${t.fixRound}/5` : ''}${t.commits ? ` · ${t.commits}` : ''}`)
  }
  const minors = w.ledger.entries.filter(e => e.kind === 'minor' || e.kind === 'final-minor').length
  lines.push(`rulings: ${rulingCount(w.ledger.entries)} · deferred minors: ${minors}`)
  lines.push(open.length ? `open warnings (${open.length}):` : 'open warnings: none')
  for (const x of open.slice(0, 8)) lines.push(`  ${x.sev === 'critical' ? '✗' : x.sev === 'warn' ? '⚠' : '·'} ${x.text} — ${x.evidence}`)
  if (run.lastDone) lines.push(`last completion: Task ${run.lastDone.n}, ${fmtAgo(now - run.lastDone.at)}`)
  return lines.join('\n')
}
