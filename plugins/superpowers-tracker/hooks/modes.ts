// observe records; assist adds a ledger note to context; strict also denies.
// Every decision here is pure: the hooks gather the facts and act on the answer.

import { taskLabel } from './taskid'
import type { Ledger, Mode, Role, Run } from '../types'
import { progressOf } from './parsers'

const SDD_ROLES: ReadonlySet<Role> = new Set(['implementer', 'task-reviewer', 're-reviewer', 'final-reviewer'])
export const isSddRole = (role: Role): boolean => SDD_ROLES.has(role)

export type SpawnFacts = {
  mode: Mode
  role: Role
  task?: number
  modelOmitted: boolean
  ledgerDone: readonly number[]
  runningImplementers: number
  fixRound?: number
}

/** Strict-mode denial for a subagent spawn, naming the evidence; undefined lets it run. */
export const guardSpawn = (f: SpawnFacts): string | undefined => {
  if (f.mode !== 'strict') return undefined
  if (f.role === 'implementer' && f.task !== undefined && f.ledgerDone.includes(f.task) && f.fixRound === undefined) {
    return `superpowers-tracker (strict): Task ${taskLabel(f.task)} is already complete in the ledger (\`Task ${taskLabel(f.task)}: complete\`). Do not re-dispatch it; resume at the first task without a complete line.`
  }
  if (f.role === 'implementer' && f.runningImplementers > 0) {
    return 'superpowers-tracker (strict): an implementer subagent is still running. subagent-driven-development forbids parallel implementers; wait for its report.'
  }
  if (isSddRole(f.role) && f.modelOmitted) {
    return 'superpowers-tracker (strict): this SDD subagent names no model, so it would inherit the session model. Pick one explicitly per the skill\'s Model Selection section and dispatch again.'
  }
  return undefined
}

export type WriteFacts = {
  mode: Mode
  isMain: boolean
  isSource: boolean
  run: Pick<Run, 'brainstormActive' | 'approvalSeen' | 'path'>
}

/** Strict-mode denial for a main-loop write of source before brainstorming approval. */
export const guardWrite = (f: WriteFacts): string | undefined => {
  if (f.mode !== 'strict' || !f.isMain || !f.isSource) return undefined
  if (!f.run.brainstormActive || f.run.approvalSeen) return undefined
  if (f.run.path !== 'bounded' && f.run.path !== 'architectural') return undefined
  return `superpowers-tracker (strict): brainstorming is on the ${f.run.path} path and its design has not been approved yet. Present the ${f.run.path === 'bounded' ? 'in-chat design' : 'written spec'} and wait for approval before writing code.`
}

/** "1-4, 6" from [1,2,3,4,6]. */
export const ranges = (ns: readonly number[]): string => {
  const sorted = [...new Set(ns)].sort((a, b) => a - b)
  const parts: string[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === (sorted[j] ?? 0) + 1) j += 1
    parts.push(i === j ? taskLabel(sorted[i] ?? 0) : `${taskLabel(sorted[i] ?? 0)}–${taskLabel(sorted[j] ?? 0)}`)
    i = j + 1
  }
  return parts.join(', ')
}

/** The assist nudge: at most 3 lines, quoting the ledger, never guessing. */
export const ledgerNote = (ledger: Ledger, run: Pick<Run, 'tasks'>): string | undefined => {
  if (!ledger.path || ledger.entries.length === 0) return undefined
  const p = progressOf(ledger.entries)
  const doneText = p.done.length ? `Task${p.done.length > 1 ? 's' : ''} ${ranges(p.done)} complete` : 'no task complete yet'
  const fixing = [...p.fixing.entries()].map(([n, r]) => `Task ${taskLabel(n)} mid fix round ${r}/5`)
  const next = run.tasks.find(t => !p.done.includes(t.n) && !p.fixing.has(t.n))?.n
  const resume = fixing.length ? fixing.join(', ') : next !== undefined ? `next is Task ${taskLabel(next)}` : 'all listed tasks complete'
  const lines = [
    `superpowers-tracker: ledger ${ledger.path} shows ${doneText}; ${resume}.`,
    `Trust the ledger and git log over memory: do not re-dispatch a task with a complete line.`,
  ]
  if (p.rulings > 0) lines.push(`${p.rulings} Ruling: line(s) must reach the final "Rulings I made" list.`)
  return lines.slice(0, 3).join('\n')
}

export const ledgerDone = (ledger: Ledger): number[] => progressOf(ledger.entries).done
