// Process warnings derived from the signals: a code, a severity, words.

import type { Severity, Warning } from '../types'

export type WarningCode =
  | 'code-before-approval'
  | 'impl-on-main'
  | 'model-omitted'
  | 'parallel-implementers'
  | 'nested-subagent'
  | 'redispatch-complete'
  | 'fix-loop-overrun'
  | 'breaker-unruled'
  | 'controller-edit'
  | 'bootstrap-missing'
  | 'debug-three-fixes'
  | 'unverified-claim'
  | 'performative-agreement'
  | 'rulings-lost'
  | 'impl-before-test'
  | 'strict-deny'

export const SEVERITY: Record<WarningCode, Severity> = {
  'code-before-approval': 'warn',
  'impl-on-main': 'warn',
  'model-omitted': 'warn',
  'parallel-implementers': 'warn',
  'nested-subagent': 'warn',
  'redispatch-complete': 'critical',
  'fix-loop-overrun': 'warn',
  'breaker-unruled': 'warn',
  'controller-edit': 'warn',
  'bootstrap-missing': 'warn',
  'debug-three-fixes': 'warn',
  'unverified-claim': 'info',
  'performative-agreement': 'info',
  'rulings-lost': 'warn',
  'impl-before-test': 'info',
  'strict-deny': 'warn',
}

export const SEV_RANK: Record<Severity, number> = { info: 0, warn: 1, critical: 2 }

export const makeWarning = (code: WarningCode, text: string, evidence: string, at: number, sev = SEVERITY[code]): Warning => ({
  id: `${code}:${evidence}`,
  code,
  sev,
  text,
  evidence,
  at,
  acked: false,
})

/** Adds a warning unless one with the same id stands; sorted by severity then time. */
export const addWarning = (list: readonly Warning[], w: Warning, cap: number): Warning[] => {
  if (list.some(x => x.id === w.id)) return [...list]
  const next = [...list, w]
  return next.length > cap ? next.slice(next.length - cap) : next
}

export const openWarnings = (list: readonly Warning[]): Warning[] =>
  list.filter(w => !w.acked).sort((a, b) => SEV_RANK[b.sev] - SEV_RANK[a.sev] || b.at - a.at)

export const topSeverity = (list: readonly Warning[]): Severity | undefined => openWarnings(list)[0]?.sev
