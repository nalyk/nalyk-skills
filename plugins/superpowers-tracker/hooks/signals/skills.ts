// Skill invocations: skill.prompt (/name, the Skill tool, preloads), the
// Skill tool's args, and a Read of a SKILL.md as the fallback.

import type { SkillHit } from '../../types'
import type { Io } from '../io'
import type { SkillName } from '../patterns'
import { CAP, capTail } from '../state'
import { stageForSkill, goLive, advance } from '../stages'
import { note } from '../core'
import { archiveAndRestart } from './plan'

export type SkillContext = { agentId?: string; args?: string; via: SkillHit['via'] }

/** Records one invocation; skill.prompt and the Skill tool both report the
 *  same call, so a repeat within 5 s merges into the first. */
export const onSkill = async (io: Io, skill: SkillName, ctx: SkillContext): Promise<boolean> => {
  const now = await io.now()
  const run = await io.state.run.get()
  let isNew = true
  await io.state.skills.set(list => {
    const twin = [...list].reverse().find(h => h.skill === skill && h.agentId === ctx.agentId && now - h.at < 5000)
    if (twin) {
      isNew = false
      if (!ctx.args || twin.args) return list
      return list.map(h => (h === twin ? { ...h, args: ctx.args! } : h))
    }
    const hit: SkillHit = {
      skill,
      at: now,
      turn: run.turn,
      via: ctx.via,
      ...(ctx.agentId ? { agentId: ctx.agentId } : {}),
      ...(ctx.args ? { args: ctx.args } : {}),
    }
    return capTail([...list, hit], CAP.skills)
  })
  if (!isNew) return false

  const isMain = ctx.agentId === undefined
  // Brainstorming again once a plan is through (every task done, or past
  // review) is new work: the finished plan is filed and the rail starts over.
  if (isMain && skill === 'brainstorming' && !run.spectator) {
    const through = run.tasks.length > 0 && run.tasks.every(t => t.status === 'done' || t.status === 'parked')
    if (run.lifecycle === 'shipped' || (run.planPath && (through || run.stage === 'review' || run.stage === 'finish'))) {
      await archiveAndRestart(io, 'brainstorm', ctx.via === 'replay')
    }
  }
  await io.state.run.set(r => {
    let next = goLive(r, now)
    if (!isMain) return next
    const stage = stageForSkill(skill)
    if (stage) next = advance(next, stage, now)
    switch (skill) {
      case 'brainstorming':
        // A brainstorm starts with no size, no design shown and no design doc
        // of its own: the last one's must not count as this one's approval.
        {
          const { path: _p, specPath: _s, ...rest } = next
          next = { ...rest, brainstormActive: true, approvalSeen: false, pathInferred: true, boundedDesignShown: false, specCommitted: false }
        }
        break
      case 'writing-plans':
        // Architectural approval: the written spec was approved and writing-plans invoked.
        next = { ...next, brainstormActive: false, approvalSeen: true }
        break
      case 'subagent-driven-development':
        next = { ...next, brainstormActive: false, executor: 'sdd' }
        break
      case 'executing-plans':
        next = { ...next, brainstormActive: false, executor: 'inline' }
        break
      case 'systematic-debugging':
        next = { ...next, debuggingActive: true }
        break
      case 'finishing-a-development-branch':
        next = {
          ...next,
          finishing: next.finishing ?? { worktreeRemoved: false, branchDeleted: false, workspaceDeleted: false, rulingsListed: false, minorsListed: false },
        }
        break
      default:
        break
    }
    return next
  })
  await note(io, {
    kind: 'skill',
    label: skill,
    ...(ctx.agentId ? { agentId: ctx.agentId } : {}),
    ...(ctx.args ? { detail: ctx.args.slice(0, 120) } : {}),
  })
  return true
}
