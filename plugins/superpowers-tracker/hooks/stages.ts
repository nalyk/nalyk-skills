// The stage machine: it only moves on evidence (a skill, an artifact, a
// ledger line, a command seen). An inferred move is flagged and drawn with `?`.

import type { Run, StageId } from '../types'
import type { SkillName } from './patterns'

export const STAGES: readonly StageId[] = ['brainstorm', 'spec', 'plan', 'execute', 'review', 'finish']

export const STAGE_LABEL: Record<StageId, string> = {
  brainstorm: 'Brainstorm',
  spec: 'Spec',
  plan: 'Plan',
  execute: 'Execute',
  review: 'Review',
  finish: 'Finish',
}

export const STAGE_INITIAL: Record<StageId, string> = {
  brainstorm: 'B',
  spec: 'S',
  plan: 'P',
  execute: 'E',
  review: 'R',
  finish: 'F',
}

export const stageIndex = (s: StageId): number => STAGES.indexOf(s)

/** The stage a skill invocation is evidence of, when it is one. */
export const stageForSkill = (skill: SkillName): StageId | undefined => {
  switch (skill) {
    case 'brainstorming':
      return 'brainstorm'
    case 'writing-plans':
      return 'plan'
    case 'subagent-driven-development':
    case 'executing-plans':
    case 'using-git-worktrees':
      return 'execute'
    case 'requesting-code-review':
      return 'review'
    case 'finishing-a-development-branch':
      return 'finish'
    default:
      return undefined
  }
}

/** Moves the run forward to `to` (never back), pulsing the node it lands on. */
export const advance = (run: Run, to: StageId, now: number, inferred = false): Run => {
  if (stageIndex(to) <= stageIndex(run.stage)) {
    // Same stage seen again on firmer evidence clears the `?`.
    return to === run.stage && run.stageInferred && !inferred ? { ...run, stageInferred: false } : run
  }
  return { ...run, stage: to, stageInferred: inferred, pulseAt: now }
}

/** Fraction of the execute segment filled: done tasks, plus a share for the one running. */
export const executeProgress = (run: Run): { done: number; total: number; fraction: number } => {
  const total = run.tasks.length
  if (total === 0) return { done: 0, total: 0, fraction: 0 }
  const done = run.tasks.filter(t => t.status === 'done' || t.status === 'parked').length
  const running = run.tasks.find(t => t.status === 'running' || t.status === 'fixing')
  const partial = running && running.steps > 0 ? running.stepsDone / running.steps : running ? 0.5 : 0
  return { done, total, fraction: Math.min(1, (done + partial * 0.999) / total) }
}

/** Lifecycle moves: dormant → armed → resumable/live → shipped. A shipped
 *  run stays shipped through its own tail (the finishing skill, a last
 *  review-package, cleanup): only evidence of new work (brainstorming, a new
 *  spec or plan) starts another run, and the signals that see it do that. */
export const goLive = (run: Run, now: number): Run =>
  run.lifecycle === 'live' || run.lifecycle === 'shipped' ? run : { ...run, lifecycle: 'live', pulseAt: now }
