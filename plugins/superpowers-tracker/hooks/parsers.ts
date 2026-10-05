// Pure, defensive parsers over superpowers' observable formats. None of
// them throws: a malformed input yields a partial result and an `error`.

import type { BrainstormPath, LedgerEntry, Role } from '../types'
import {
  A,
  FENCE,
  FIX_ROUND_N,
  L,
  PATH_ANNOUNCE,
  PLAN_GOAL,
  PLAN_SPEC,
  PLAN_TITLE,
  REVIEW_FOCUS,
  ROLE,
  STEP_DONE,
  STEP_OPEN,
  TASK_HEADING,
  TASK_N,
} from './patterns'

export type PlanTask = { n: number; name: string; steps: number; stepsDone: number }
export type ParsedPlan = {
  title?: string
  goal?: string
  spec?: string
  hasReviewFocus: boolean
  tasks: PlanTask[]
  error?: string
}

/** A plan file: title, Goal, Spec, Review Focus and its `Task N` headings
 *  outside code fences (as task-brief reads them), with step checkboxes. */
export const parsePlan = (text: string): ParsedPlan => {
  const out: ParsedPlan = { hasReviewFocus: false, tasks: [] }
  try {
    let inFence = false
    let current: PlanTask | undefined
    for (const line of text.split(/\r?\n/)) {
      if (FENCE.test(line)) {
        inFence = !inFence
        continue
      }
      if (inFence) continue
      const heading = TASK_HEADING.exec(line)
      if (heading) {
        current = { n: Number(heading[1]), name: (heading[2] ?? '').trim() || `Task ${heading[1]}`, steps: 0, stepsDone: 0 }
        if (!out.tasks.some(t => t.n === current!.n)) out.tasks.push(current)
        continue
      }
      if (/^#{1,2}\s/.test(line) && !/^#\s/.test(line)) current = undefined
      if (out.title === undefined) {
        const t = PLAN_TITLE.exec(line)
        if (t) out.title = (t[1] ?? '').replace(/\s+Implementation Plan$/i, '')
      }
      const goal = PLAN_GOAL.exec(line)
      if (goal && out.goal === undefined) out.goal = goal[1]
      const spec = PLAN_SPEC.exec(line)
      if (spec && out.spec === undefined) out.spec = spec[1]
      if (REVIEW_FOCUS.test(line)) out.hasReviewFocus = true
      if (current) {
        if (STEP_OPEN.test(line)) current.steps += 1
        else if (STEP_DONE.test(line)) {
          current.steps += 1
          current.stepsDone += 1
        }
      }
    }
    if (out.tasks.length === 0) out.error = 'no "Task N" headings found'
  } catch (err) {
    out.error = String(err)
  }
  return out
}

export type ParsedLedger = { planRef?: string; entries: LedgerEntry[]; unknown: string[]; error?: string }

/** progress.md, every line form SDD and executing-plans write. */
export const parseLedger = (text: string): ParsedLedger => {
  const out: ParsedLedger = { entries: [], unknown: [] }
  try {
    const lines = text.split(/\r?\n/)
    lines.forEach((raw, i) => {
      const line = raw.trim().replace(/^[-*]\s+/, '')
      if (line === '') return
      const at = i + 1
      let m: RegExpExecArray | null
      if ((m = L.title.exec(line))) {
        out.planRef = (m[1] ?? '').trim()
        out.entries.push({ kind: 'title', text: out.planRef, line: at })
      } else if ((m = L.preflight.exec(line))) out.entries.push({ kind: 'preflight', text: m[1] ?? '', line: at })
      else if (L.table.test(line)) out.entries.push({ kind: 'table', text: line, line: at })
      else if ((m = L.fixRound.exec(line))) {
        const tail = (m[5] ?? '').replace(/^\s*[—–-]\s*/, '')
        const commits = /commits\s+([0-9a-f]+\.\.[0-9a-f]+)/.exec(tail)?.[1]
        out.entries.push({
          kind: 'fix-round',
          task: Number(m[1]),
          round: Number(m[2]),
          addressed: Number(m[3]),
          open: Number(m[4]),
          text: tail.replace(/;?\s*commits\s+[0-9a-f]+\.\.[0-9a-f]+/, '').replace(/^;\s*/, '').trim(),
          line: at,
          ...(commits ? { commits } : {}),
        })
      } else if ((m = L.complete.exec(line))) {
        const rest = (m[3] ?? '').trim()
        const parked = /(\d+)\s+parked/.exec(rest)
        const tests = /^tests:\s*(.+)$/.exec(rest)?.[1]
        out.entries.push({
          kind: 'complete',
          task: Number(m[1]),
          text: rest,
          line: at,
          clean: /review clean/.test(rest),
          ...(m[2] ? { commits: m[2] } : {}),
          ...(parked ? { parked: Number(parked[1]) } : {}),
          ...(tests ? { tests } : {}),
        })
      } else if ((m = L.minor.exec(line))) out.entries.push({ kind: 'minor', task: Number(m[1]), text: m[2] ?? '', line: at })
      else if ((m = L.parked.exec(line))) out.entries.push({ kind: 'parked', task: Number(m[1]), text: m[2] ?? '', line: at })
      else if ((m = L.taskRuling.exec(line))) out.entries.push({ kind: 'task-ruling', task: Number(m[1]), text: m[2] ?? '', line: at })
      else if ((m = L.finalMinor.exec(line))) out.entries.push({ kind: 'final-minor', text: m[1] ?? '', line: at })
      else if ((m = L.finalRuling.exec(line))) out.entries.push({ kind: 'final-ruling', text: m[1] ?? '', line: at })
      else if ((m = L.finalFixed.exec(line))) out.entries.push({ kind: 'final-fixed', text: m[1] ?? '', line: at })
      else if ((m = L.finalReview.exec(line))) out.entries.push({ kind: 'final-review', text: m[1] ?? '', line: at })
      else if ((m = L.ruling.exec(line))) out.entries.push({ kind: 'ruling', text: m[1] ?? '', line: at })
      else if (/Ruling:/.test(line)) out.entries.push({ kind: 'ruling', text: line.slice(line.indexOf('Ruling:') + 7).trim(), line: at })
      else out.unknown.push(raw)
    })
  } catch (err) {
    out.error = String(err)
  }
  return out
}

/** How many ledger lines carry a ruling (every `Ruling:` the final message must list). */
export const rulingCount = (entries: readonly LedgerEntry[]): number =>
  entries.filter(e => e.kind === 'ruling' || e.kind === 'task-ruling' || e.kind === 'final-ruling' || e.kind === 'parked').length

/** The ledger split as ruling cards: what, why, cost if wrong. */
export const splitRuling = (text: string): { what: string; why?: string; cost?: string } => {
  const parts = text.split(/\s+[—–]\s+|\s+-{1,2}\s+/).map(p => p.trim()).filter(Boolean)
  const [what = text, why, ...rest] = parts
  const cost = rest.join(' — ') || undefined
  return { what, ...(why ? { why } : {}), ...(cost ? { cost } : {}) }
}

export type Progress = {
  done: number[]
  fixing: Map<number, number>
  parked: Map<number, number>
  breaker: Set<number>
  rulings: number
  minors: number
  last?: LedgerEntry
}

/** Folds ledger entries into per-task progress. */
export const progressOf = (entries: readonly LedgerEntry[]): Progress => {
  const p: Progress = { done: [], fixing: new Map(), parked: new Map(), breaker: new Set(), rulings: rulingCount(entries), minors: 0 }
  for (const e of entries) {
    if (e.kind === 'complete' && e.task !== undefined) {
      if (!p.done.includes(e.task)) p.done.push(e.task)
      p.fixing.delete(e.task)
      if (e.parked) p.parked.set(e.task, e.parked)
    } else if (e.kind === 'fix-round' && e.task !== undefined && !p.done.includes(e.task)) {
      p.fixing.set(e.task, e.round ?? 0)
      if ((e.round ?? 0) >= 5 && (e.open ?? 0) > 0) p.breaker.add(e.task)
    } else if (e.kind === 'minor' || e.kind === 'final-minor') p.minors += 1
    if (e.kind !== 'title' && e.kind !== 'table') p.last = e
  }
  return p
}

export const classifyRole = (description: string, prompt: string): Role => {
  for (const [re, role] of ROLE) if (re.test(description)) return role
  for (const [re, role] of ROLE) if (re.test(prompt.slice(0, 4000))) return role
  return 'other'
}

export const taskOf = (description: string, prompt = ''): number | undefined => {
  const m = TASK_N.exec(description) ?? TASK_N.exec(prompt.slice(0, 2000))
  return m ? Number(m[1]) : undefined
}

export const fixRoundOf = (description: string): number | undefined => {
  const m = FIX_ROUND_N.exec(description)
  return m ? Number(m[1]) : undefined
}

export type ImplementerAnswer = { status?: string; commits: string[]; tests?: string; report?: string }
export const parseImplementer = (text: string): ImplementerAnswer => {
  const status = A.status.exec(text)?.[1]
  const commits = [...text.matchAll(/(?:^|\n)\s*[-*]?\s*`?([0-9a-f]{7,12})`?\s+[-—:]?\s*[A-Za-z]/g)].map(m => m[1] ?? '').filter(Boolean)
  const tests = A.testLine.exec(text)?.[1]?.trim()
  const report = A.reportPath.exec(text)?.[1]?.replace(/[`*]/g, '')
  return { ...(status ? { status } : {}), commits, ...(tests ? { tests } : {}), ...(report ? { report } : {}) }
}

export type Severities = { critical: number; important: number; minor: number }
/** Counts findings under the Critical / Important / Minor headings. A heading
 *  followed by "None" counts zero. */
export const countSeverities = (text: string): Severities => {
  const counts: Severities = { critical: 0, important: 0, minor: 0 }
  let current: keyof Severities | undefined
  for (const line of text.split(/\r?\n/)) {
    const s = A.section.exec(line)
    if (s) {
      current = (s[1] ?? '').toLowerCase() as keyof Severities
      continue
    }
    if (/^#{1,3}\s/.test(line)) {
      current = undefined
      continue
    }
    if (current && /^\s*(?:[-*]|\d+\.)\s+\S/.test(line) && !/^\s*(?:[-*]|\d+\.)\s+none\b/i.test(line) && !/^\s{2,}/.test(line)) {
      counts[current] += 1
    }
  }
  return counts
}

export type TaskReview = Severities & { spec?: 'ok' | 'bad' | 'warn'; quality?: string }
export const parseTaskReview = (text: string): TaskReview => {
  const spec = A.specBad.test(text) ? 'bad' : A.specOk.test(text) ? (A.specWarn.test(text) ? 'warn' : 'ok') : A.specWarn.test(text) ? 'warn' : undefined
  const quality = A.quality.exec(text)?.[1]
  return { ...countSeverities(text), ...(spec ? { spec } : {}), ...(quality ? { quality } : {}) }
}

export type ReReview = { addressed: number; notAddressed: number; verdict?: string; clean: boolean }
export const parseReReview = (text: string): ReReview => {
  const notAddressed = [...text.matchAll(A.notAddressed)].length
  const all = [...text.matchAll(A.addressed)].length
  const verdict = A.roundVerdict.exec(text)?.[1]?.trim()
  return { addressed: all, notAddressed, ...(verdict ? { verdict } : {}), clean: notAddressed === 0 && !/remain open/i.test(verdict ?? '') }
}

export type FinalReviewAnswer = Severities & { ready?: string }
export const parseFinalReview = (text: string): FinalReviewAnswer => {
  const ready = A.readyToMerge.exec(text)?.[1]
  return { ...countSeverities(text), ...(ready ? { ready } : {}) }
}

export type TestOutcome = { passed?: number; failed?: number }
/** "12 passed, 1 failed", "Tests: 3 failed, 9 passed", "14/14 passing", "ok 7". */
export const parseTestOutput = (text: string): TestOutcome => {
  const tail = text.slice(-8000)
  const out: TestOutcome = {}
  const passed = [...tail.matchAll(/(\d+)\s+(?:passed|passing|pass\b|tests? passed)/gi)].at(-1)
  const failed = [...tail.matchAll(/(\d+)\s+(?:failed|failing|failures?|fail\b)/gi)].at(-1)
  const ratio = [...tail.matchAll(/(\d+)\s*\/\s*(\d+)\s+(?:passing|passed|tests? pass)/gi)].at(-1)
  if (ratio) {
    out.passed = Number(ratio[1])
    out.failed = Number(ratio[2]) - Number(ratio[1])
  }
  if (passed) out.passed = Number(passed[1])
  if (failed) out.failed = Number(failed[1])
  return out
}

/** The brainstorming path the agent announced, from its answer. */
export const detectPath = (answer: string): BrainstormPath | undefined => {
  for (const [re, path] of PATH_ANNOUNCE) {
    const m = re.exec(answer)
    if (!m) continue
    const named = (m[1] ?? '').toLowerCase()
    if (named === 'bounded' || named === 'spike' || named === 'architectural') return named
    return path
  }
  return undefined
}

/** The "Rulings I made" list's entries in a final message. */
export const listedRulings = (answer: string): number => {
  const at = answer.search(/Rulings I made/i)
  if (at < 0) return -1
  const after = answer.slice(at).split(/\r?\n/).slice(1)
  let n = 0
  for (const line of after) {
    if (/^\s*(?:[-*]|\d+\.)\s+\S/.test(line)) n += 1
    else if (/^\s*#|^\s*[A-Z][^:]{0,40}:\s*$/.test(line) && n > 0) break
  }
  return n
}
