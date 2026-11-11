// Tracker snapshots per repo and plan in $.store: the story of one plan,
// kept when a session ends, when another plan takes its place, and on a timer.
// No signal module is imported here, so every one of them may archive.

import type { Agent, Run, TestRun, TimelineRow, Warning } from '../types'
import type { Io } from './io'
import { safe } from './io'

export const SNAPSHOT_CAP_BYTES = 200_000
export const PLANS_PER_REPO = 10

export type Snapshot = {
  savedAt: number
  sessionId?: string
  run: Run
  timeline: TimelineRow[]
  agents: Agent[]
  warnings: Warning[]
  tests: TestRun[]
  ledgerPath?: string
}

export type LeftOff = {
  planPath: string
  task?: number
  fixRound?: number
  sessionId: string
  resume: string
  at: number
}

export const snapKey = (root: string, plan: string) => `snap:${root}::${plan}`
export const indexKey = (root: string) => `snapidx:${root}`
export const leftOffKey = (root: string) => `leftoff:${root}`
export const dismissKey = (root: string) => `dismiss:${root}`

/** Trims the oldest rows until the snapshot fits its cap. */
export const fitSnapshot = (s: Snapshot, cap = SNAPSHOT_CAP_BYTES): Snapshot => {
  let out = s
  for (let i = 0; i < 12 && JSON.stringify(out).length > cap; i += 1) {
    out = {
      ...out,
      timeline: out.timeline.slice(Math.floor(out.timeline.length / 2)),
      tests: out.tests.slice(Math.floor(out.tests.length / 2)),
      agents: out.agents.slice(Math.floor(out.agents.length / 3)),
      warnings: out.warnings.slice(-50),
    }
  }
  return out
}

export const saveSnapshot = async (io: Io, root: string): Promise<boolean> => {
  const run = await io.state.run.get()
  if (!run.planPath || !/\.md$/.test(run.planPath) || run.lifecycle === 'dormant' || run.spectator) return false
  const [timeline, agents, warnings, tests, ledger, sessionId, now] = await Promise.all([
    io.state.timeline.get(),
    io.state.agents.get(),
    io.state.warnings.get(),
    io.state.tests.get(),
    io.state.ledger.get(),
    safe(io.session.id(), ''),
    io.now(),
  ])
  const snap = fitSnapshot({
    savedAt: now,
    run,
    timeline,
    agents,
    warnings,
    tests,
    ...(sessionId ? { sessionId } : {}),
    ...(ledger.path ? { ledgerPath: ledger.path } : {}),
  })
  await io.store.set(snapKey(root, run.planPath), snap)
  const index = (((await safe(io.store.get(indexKey(root)), [])) ?? []) as string[]).filter(p => p !== run.planPath)
  index.push(run.planPath)
  while (index.length > PLANS_PER_REPO) {
    const drop = index.shift()
    if (drop) await safe(io.store.del(snapKey(root, drop)), undefined)
  }
  await io.store.set(indexKey(root), index)
  return true
}

export const loadSnapshot = async (io: Io, root: string, plan: string): Promise<Snapshot | undefined> =>
  (await safe(io.store.get(snapKey(root, plan)), undefined)) as Snapshot | undefined

