// /sp demo: a scripted 60-second run through every state, computed purely
// from elapsed time. It never touches the real tracker state.

import type { Agent, LedgerEntry, Run, StageId, TaskRow, TimelineRow, Warning } from '../../types'
import type { World } from './viewModel'
import { DEFAULT_SETTINGS, FRESH_ENV, FRESH_RESUME, FRESH_UI, freshRun } from '../state'
import { blankTask } from '../core'

export const DEMO_MS = 60_000

const NAMES = [
  'Retry policy types',
  'Backoff calculator',
  'Jitter strategies',
  'Circuit breaker state',
  'HTTP client wrapper',
  'Idempotency keys',
  'Metrics and tracing',
  'Config loader',
  'Docs and examples',
]

// Each task's window inside the execute phase (14 s → 48 s).
const EXEC_START = 14_000
const SLOT = 3_700

export const demoWorld = (elapsed: number, start: number, mode: World['settings']['mode'] = 'observe'): World => {
  const t = Math.max(0, Math.min(DEMO_MS, elapsed))
  const at = (ms: number) => start + ms
  const now = at(t)
  const timeline: TimelineRow[] = []
  const agents: Agent[] = []
  const entries: LedgerEntry[] = [{ kind: 'title', text: 'docs/superpowers/plans/2026-10-05-retry-policy.md', line: 1 }]
  const warnings: Warning[] = []
  const push = (ms: number, kind: TimelineRow['kind'], label: string, stage: StageId, extra: Partial<TimelineRow> = {}) => {
    if (t >= ms) timeline.push({ at: at(ms), kind, label, stage, ...extra })
  }

  let stage: StageId = 'brainstorm'
  if (t >= 6_000) stage = 'spec'
  if (t >= 10_000) stage = 'plan'
  if (t >= EXEC_START) stage = 'execute'
  if (t >= 48_000) stage = 'review'
  if (t >= 54_000) stage = 'finish'

  push(0, 'skill', 'brainstorming', 'brainstorm')
  push(2_000, 'note', 'path: architectural?', 'brainstorm', { detail: 'announced' })
  push(6_000, 'artifact', 'spec retry-policy-design.md', 'spec', { ok: true })
  push(10_000, 'skill', 'writing-plans', 'plan')
  push(12_000, 'artifact', 'plan 2026-10-05-retry-policy.md', 'plan', { ok: true })
  push(13_000, 'skill', 'using-git-worktrees', 'execute')
  push(14_000, 'skill', 'subagent-driven-development', 'execute')

  const tasks: TaskRow[] = NAMES.map((name, i) => ({ ...blankTask(i + 1, name), steps: 5 }))
  let current: number | undefined
  tasks.forEach((task, i) => {
    const s = EXEC_START + i * SLOT
    const e = s + SLOT
    if (t < s) return
    const n = i + 1
    const doneAt = n === 3 ? e + 0 : e
    const running = t < doneAt
    task.startedAt = at(s)
    task.stepsDone = running ? Math.min(5, Math.floor(((t - s) / SLOT) * 5)) : 5
    task.tdd = [{ ok: false, at: at(s + 600) }, ...(t > s + 1200 ? [{ ok: true, at: at(s + 1200) }] : [])]
    task.agents = 2
    if (n === 3) {
      const round = Math.min(5, Math.max(0, Math.floor((t - s - 800) / 500)))
      task.fixRound = round
      task.breaker = round >= 5 && t > s + 3_300
      if (round > 0) entries.push({ kind: 'fix-round', task: 3, round, addressed: 1, open: round >= 5 ? 1 : 2, text: 'jitter bound off by one', line: 5 })
      if (task.breaker) entries.push({ kind: 'parked', task: 3, text: 'jitter upper bound — Ruling: spec allows inclusive bound', line: 7 })
    }
    if (n === 6 && t > s + 800 && t < s + 1_900) task.status = 'blocked'
    const implEnd = s + SLOT * 0.55
    agents.push({
      id: `demo-impl-${n}`,
      agentId: `demo-impl-${n}`,
      description: `Implement Task ${n}: ${task.name}`,
      subagentType: 'general-purpose',
      modelOmitted: false,
      model: n % 3 === 0 ? 'sonnet' : 'haiku',
      tier: n % 3 === 0 ? 'mid' : 'cheap',
      role: 'implementer',
      task: n,
      status: t < implEnd ? 'running' : n === 6 && t < s + 1_900 ? 'failed' : 'done',
      startedAt: at(s),
      ...(t >= implEnd ? { endedAt: at(implEnd), verdict: n === 6 ? 'NEEDS_CONTEXT' : 'DONE' } : {}),
    })
    if (t >= implEnd) {
      agents.push({
        id: `demo-rev-${n}`,
        agentId: `demo-rev-${n}`,
        description: `Review Task ${n} (spec + quality)`,
        subagentType: 'general-purpose',
        modelOmitted: false,
        model: 'sonnet',
        tier: 'mid',
        role: 'task-reviewer',
        task: n,
        status: t < e ? 'running' : 'done',
        startedAt: at(implEnd),
        ...(t >= e ? { endedAt: at(e), verdict: n === 3 ? 'Spec ✓ · Needs fixes' : 'Spec ✓ · Approved' } : {}),
      })
    }
    push(s, 'agent-start', `implementer · Task ${n}`, 'execute', { detail: n % 3 === 0 ? 'sonnet' : 'haiku' })
    push(implEnd, 'agent-end', `implementer · Task ${n} ✓`, 'execute', { ok: true })
    push(e, 'ledger', `Task ${n} complete`, 'execute', { ok: true })
    if (running) {
      current = n
      task.status = task.status === 'blocked' ? 'blocked' : n === 3 && task.fixRound > 0 ? 'fixing' : 'running'
    } else {
      task.status = n === 3 ? 'parked' : 'done'
      task.doneAt = at(e)
      task.commits = `${(0xa1b2c3d + n * 4099).toString(16).slice(0, 7)}..${(0xd4e5f6a + n * 7919).toString(16).slice(0, 7)}`
      entries.push({ kind: 'complete', task: n, text: n === 3 ? '1 parked' : 'review clean', line: 10 + n, ...(n === 3 ? { parked: 1 } : { clean: true }) })
    }
  })
  if (t >= 20_000) entries.push({ kind: 'ruling', text: 'Use exponential backoff with full jitter — the spec names AWS guidance — one more test if wrong', line: 3 })
  if (t >= 36_000) entries.push({ kind: 'minor', task: 5, text: 'client wrapper could expose timeout', line: 20 })
  if (t >= 40_000) {
    warnings.push({ id: 'demo:redispatch', code: 'redispatch-complete', sev: 'critical', text: 'Task 2 re-dispatched after it completed', evidence: 'ledger: Task 2: complete · Implement Task 2 (toolu_demo)', at: at(40_000), acked: t > 45_000 })
  }
  if (t >= 30_000) warnings.push({ id: 'demo:model', code: 'model-omitted', sev: 'warn', text: 'task reviewer dispatched with no explicit model', evidence: 'Review Task 5 (toolu_demo5)', at: at(30_000), acked: false })
  if (t >= 48_000) {
    agents.push({ id: 'demo-final', agentId: 'demo-final', description: 'Final whole-branch review', subagentType: 'general-purpose', modelOmitted: false, model: 'opus', tier: 'top', role: 'final-reviewer', status: t < 53_000 ? 'running' : 'done', startedAt: at(48_000), ...(t >= 53_000 ? { endedAt: at(53_000), verdict: 'Ready: Yes' } : {}) })
    push(48_000, 'agent-start', 'final reviewer', 'review', { detail: 'opus' })
  }
  if (t >= 53_000) push(53_000, 'agent-end', 'final reviewer ✓', 'review', { ok: true, detail: 'Ready: Yes' })
  if (t >= 54_000) push(54_000, 'skill', 'finishing-a-development-branch', 'finish')

  const run: Run = {
    ...freshRun(start),
    lifecycle: t >= 54_000 ? 'shipped' : 'live',
    stage,
    stageInferred: false,
    path: 'architectural',
    pathInferred: t < 6_000,
    approvalSeen: t >= 10_000,
    brainstormActive: t < 10_000,
    specPath: 'docs/superpowers/specs/2026-10-05-retry-policy-design.md',
    specCommitted: t >= 7_000,
    ...(t >= 10_000 ? { planPath: '/repo/docs/superpowers/plans/2026-10-05-retry-policy.md', planTitle: 'Retry Policy', planGoal: 'Retries with backoff, jitter and a circuit breaker for the HTTP client.' } : {}),
    hasReviewFocus: true,
    tasks: t >= 10_000 ? tasks : [],
    executor: 'sdd',
    workspace: '/repo/.superpowers/sdd/2026-10-05-retry-policy',
    ...(current !== undefined ? { currentTask: current } : {}),
    pulseAt: pulseTime(t, start),
    ...(t >= 54_000 ? { shippedAt: at(54_000), shipSummary: '9 tasks · 47m · 0 critical' } : {}),
    ...(t >= 53_000 ? { finalReview: { verdict: 'Yes', critical: 0, important: 0, minor: 2, at: at(53_000) } } : {}),
    turn: Math.floor(t / 4000),
  }
  const last = tasks.filter(x => x.doneAt).at(-1)
  if (last?.doneAt) run.lastDone = { n: last.n, at: last.doneAt }
  void now
  return {
    run,
    timeline,
    skills: [],
    agents,
    ledger: { path: `${run.workspace}/progress.md`, mtime: now, size: 1, entries, unknown: [], readAt: now },
    tests: tasks.flatMap(x => x.tdd.map(d => ({ at: d.at, command: `npm test -- task${x.n}`, ok: d.ok, ref: `demo-${x.n}-${d.at}`, task: x.n }))),
    warnings,
    env: { ...FRESH_ENV, pluginVersion: '6.4.2', installed: true, branch: 'feature/retry-policy', isLinkedWorktree: true, repoRoot: '/repo', context: [12, 18, 24, 31, 38, 44, 52, 58].slice(0, 1 + Math.floor(t / 7500)), bootstrap: [{ at: start, ok: true, why: 'startup' }], costUsd: t / 20_000 },
    ui: FRESH_UI,
    resume: FRESH_RESUME,
    settings: { ...DEFAULT_SETTINGS, mode },
    demo: { active: true, startedAt: start, step: Math.floor(t / 1000) },
  }
}

/** The moments a node lands (stage changes and task completions). */
const pulseTime = (t: number, start: number): number => {
  const marks = [0, 6_000, 10_000, EXEC_START, ...NAMES.map((_, i) => EXEC_START + (i + 1) * SLOT), 48_000, 54_000]
  const last = marks.filter(m => m <= t).at(-1) ?? 0
  return start + last
}
