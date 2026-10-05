// Subagents: classified at spawn, verdicts parsed from their final answers.

import type { Agent, Role } from '../../types'
import type { Io } from '../io'
import { tierOf } from '../patterns'
import {
  classifyRole,
  fixRoundOf,
  parseFinalReview,
  parseImplementer,
  parseReReview,
  parseTaskReview,
  taskOf,
} from '../parsers'
import { CAP, capTail } from '../state'
import { advance, goLive } from '../stages'
import { fmtDuration, note, patchTask, warn, type Toaster } from '../core'
import { guardSpawn, isSddRole, ledgerDone } from '../modes'

export type SpawnInput = {
  tool_use_id: string
  prompt: string
  description: string
  subagentType: string
  model?: string
  parentModel?: string
  parentAgentId?: string
}

export type SpawnAssessment = { role: Role; task?: number; deny?: string; shaped: boolean }

const ROLE_LABEL: Record<Role, string> = {
  implementer: 'implementer',
  'task-reviewer': 'task reviewer',
  're-reviewer': 're-reviewer',
  'final-reviewer': 'final reviewer',
  investigator: 'investigator',
  analyst: 'analyst',
  'spec-reviewer': 'spec reviewer',
  other: 'subagent',
}
export const roleLabel = (r: Role): string => ROLE_LABEL[r]

/** Before the spawn runs: role, warnings, and a strict-mode denial. */
export const assessSpawn = async (io: Io, toast: Toaster, e: SpawnInput, replay = false): Promise<SpawnAssessment> => {
  const role = classifyRole(e.description, e.prompt)
  const task = taskOf(e.description, role === 'other' ? '' : e.prompt)
  const shaped = role !== 'other'
  if (!shaped) return { role, ...(task !== undefined ? { task } : {}), shaped }

  const [run, ledger, agents, settings, env] = await Promise.all([
    io.state.run.get(),
    io.state.ledger.get(),
    io.state.agents.get(),
    io.state.settings.get(),
    io.state.env.get(),
  ])
  const done = ledgerDone(ledger)
  const running = agents.filter(a => a.role === 'implementer' && a.status === 'running')
  const parent = e.parentAgentId ? agents.find(a => a.agentId === e.parentAgentId) : undefined
  const modelOmitted = e.model === undefined || e.model === ''
  const round = fixRoundOf(e.description)
  const ev = `${e.description} (${e.tool_use_id})`

  if (!replay) {
    if (role === 'implementer' && task !== undefined && done.includes(task) && round === undefined) {
      await warn(io, toast, 'redispatch-complete', `Task ${task} re-dispatched after it completed`, `ledger: Task ${task}: complete · ${ev}`)
    }
    if (role === 'implementer' && running.length > 0) {
      await warn(io, toast, 'parallel-implementers', 'Two implementers running at once', ev)
    }
    if (isSddRole(role) && modelOmitted) {
      await warn(io, toast, 'model-omitted', `${roleLabel(role)} dispatched with no explicit model`, ev)
    }
    if (parent && (parent.role === 'implementer' || parent.role.endsWith('reviewer'))) {
      await warn(io, toast, 'nested-subagent', `A ${roleLabel(parent.role)} spawned a subagent`, ev)
    }
    if (role === 'implementer' && /^(main|master)$/.test(env.branch ?? '') && !env.isLinkedWorktree) {
      await warn(io, toast, 'impl-on-main', `Implementation dispatched on ${env.branch} with no worktree`, ev)
    }
    if (role === 'implementer' && task !== undefined && round !== undefined && round > 5) {
      await warn(io, toast, 'fix-loop-overrun', `Task ${task} fix loop past round 5`, ev)
    }
  }

  const deny = replay || run.spectator
    ? undefined
    : guardSpawn({
        mode: settings.mode,
        role,
        modelOmitted,
        ledgerDone: done,
        runningImplementers: running.length,
        ...(task !== undefined ? { task } : {}),
        ...(round !== undefined ? { fixRound: round } : {}),
      })
  if (deny) await warn(io, toast, 'strict-deny', `Strict mode denied a ${roleLabel(role)} spawn`, ev)
  return { role, shaped, ...(task !== undefined ? { task } : {}), ...(deny ? { deny } : {}) }
}

/** After the spawn started: the agent row, the task row, the transcript label. */
export const recordSpawn = async (
  io: Io,
  e: SpawnInput,
  a: SpawnAssessment,
  started: { agentId?: string; model?: string },
): Promise<string | undefined> => {
  const now = await io.now()
  const model = e.model || started.model
  const agent: Agent = {
    id: e.tool_use_id,
    description: e.description.slice(0, 160),
    subagentType: e.subagentType,
    modelOmitted: !e.model,
    tier: tierOf(model ?? e.parentModel),
    role: a.role,
    status: 'running',
    startedAt: now,
    ...(started.agentId ? { agentId: started.agentId } : {}),
    ...(e.parentAgentId ? { parentAgentId: e.parentAgentId } : {}),
    ...(model ? { model } : {}),
    ...(e.parentModel ? { parentModel: e.parentModel } : {}),
    ...(a.task !== undefined ? { task: a.task } : {}),
  }
  await io.state.agents.set(list => capTail([...list.filter(x => x.id !== agent.id), agent], CAP.agents))
  if (!a.shaped) return undefined
  await io.state.run.set(r => {
    let next = goLive(r, now)
    if (a.role === 'implementer' || a.role === 'task-reviewer' || a.role === 're-reviewer') next = advance(next, 'execute', now)
    if (a.role === 'final-reviewer') next = advance(next, 'review', now)
    if (a.role === 'implementer' && a.task !== undefined) next = { ...next, currentTask: a.task }
    return next
  })
  if (a.task !== undefined && a.role !== 'final-reviewer') {
    await patchTask(io, a.task, t => ({
      ...t,
      agents: t.agents + 1,
      startedAt: t.startedAt ?? now,
      status: t.status === 'done' || t.status === 'parked' ? t.status : t.status === 'fixing' ? 'fixing' : 'running',
    }))
  }
  await note(io, {
    kind: 'agent-start',
    label: `${roleLabel(a.role)}${a.task !== undefined ? ` · Task ${a.task}` : ''}`,
    ...(started.agentId ? { agentId: started.agentId } : {}),
    detail: model ?? 'model inherited',
  })
  const tier = model ? model.replace(/^claude-/, '').split('-')[0] : 'inherits'
  return [roleLabel(a.role), a.task !== undefined ? `Task ${a.task}` : undefined, tier].filter(Boolean).join(' · ')
}

/** A subagent's turn.complete: duration and the verdict its answer carries. */
export const onAgentDone = async (io: Io, toast: Toaster, agentId: string, answer: string, failed: boolean, replay = false): Promise<void> => {
  const now = await io.now()
  const agents = await io.state.agents.get()
  const agent = agents.find(a => a.agentId === agentId)
  if (!agent) return
  let verdict: string | undefined
  let summary: string | undefined
  const n = agent.task
  switch (agent.role) {
    case 'implementer': {
      const r = parseImplementer(answer)
      verdict = r.status
      summary = [r.commits.slice(0, 2).join(' '), r.tests].filter(Boolean).join(' · ')
      if (n !== undefined) {
        await patchTask(io, n, t => ({
          ...t,
          ...(r.status === 'BLOCKED' || r.status === 'NEEDS_CONTEXT' ? { status: 'blocked' as const } : {}),
          ...(r.report ? { report: r.report } : {}),
        }))
        if (!replay && (r.status === 'BLOCKED' || r.status === 'NEEDS_CONTEXT')) {
          const why = r.status === 'BLOCKED' ? 'blocked' : 'needs context'
          toast('✗', `Implementer ${why}`, `Task ${n} · the controller will re-dispatch`, 'warn')
        }
      }
      break
    }
    case 'task-reviewer': {
      const r = parseTaskReview(answer)
      verdict = `${r.spec === 'ok' ? 'Spec ✓' : r.spec === 'bad' ? 'Spec ✗' : r.spec === 'warn' ? 'Spec ⚠' : 'Spec ?'} · ${r.quality ?? '?'}`
      summary = `${r.critical} critical · ${r.important} important · ${r.minor} minor`
      if (n !== undefined) await patchTask(io, n, t => ({ ...t, verdict }))
      if (!replay && n !== undefined) {
        const clean = r.spec !== 'bad' && /approved/i.test(r.quality ?? '') && r.critical + r.important === 0
        toast(clean ? '●' : '◐', `Task ${n} review`, clean ? 'clean' : summary)
      }
      break
    }
    case 're-reviewer': {
      const r = parseReReview(answer)
      verdict = r.clean ? 'all addressed' : `${r.notAddressed} open`
      summary = `${r.addressed} addressed · ${r.notAddressed} not addressed`
      break
    }
    case 'final-reviewer': {
      const r = parseFinalReview(answer)
      verdict = `Ready: ${r.ready ?? '?'}`
      summary = `${r.critical} critical · ${r.important} important · ${r.minor} minor`
      await io.state.run.set(run => ({
        ...advance(run, 'review', now),
        finalReview: { verdict: r.ready ?? '?', critical: r.critical, important: r.important, minor: r.minor, at: now },
      }))
      if (!replay) toast(r.ready === 'Yes' ? '●' : '◐', 'Final review', `${verdict} · ${summary}`)
      break
    }
    default:
      break
  }
  await io.state.agents.set(list =>
    list.map(a =>
      a.agentId === agentId
        ? { ...a, status: failed ? 'failed' : 'done', endedAt: now, ...(verdict ? { verdict } : {}), ...(summary ? { summary } : {}) }
        : a,
    ),
  )
  await note(io, {
    kind: 'agent-end',
    label: `${roleLabel(agent.role)}${n !== undefined ? ` · Task ${n}` : ''} ${failed ? '✗' : '✓'}`,
    agentId,
    ok: !failed,
    detail: [verdict, fmtDuration(now - agent.startedAt)].filter(Boolean).join(' · '),
  })
}
