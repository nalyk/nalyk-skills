// Skill invocations: skill.prompt (/name, the Skill tool, preloads), the
// Skill tool's args, and a Read of a SKILL.md as the fallback.

import type { SkillHit } from '../../types'
import type { Io } from '../io'
import type { SkillName } from '../patterns'
import { CAP, capTail } from '../state'
import { stageForSkill, goLive, advance } from '../stages'
import { note } from '../core'

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
  await io.state.run.set(r => {
    let next = goLive(r, now)
    if (!isMain) return next
    const stage = stageForSkill(skill)
    if (stage) next = advance(next, stage, now)
    switch (skill) {
      case 'brainstorming':
        next = { ...next, brainstormActive: true, approvalSeen: false, pathInferred: true, boundedDesignShown: false }
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
