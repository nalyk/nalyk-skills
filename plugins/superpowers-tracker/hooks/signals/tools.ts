// Tool calls as evidence: Write/Edit to superpowers paths, Bash (SDD
// scripts, tests, git, the companion), Read of a SKILL.md, the worktree tools.

import type { Companion, TestRun } from '../../types'
import type { Io } from '../io'
import { safe } from '../io'
import {
  DOC_FILE,
  G,
  OUT_TASK_BRIEF,
  OUT_TASK_DONE_FAIL,
  OUT_TASK_DONE_LEDGER,
  OUT_TASK_START_BASE,
  OUT_TASK_START_BRIEF,
  SCRIPT_ARGS,
  SKILL_FILE,
  SP_PRIVATE,
  VERIFY_HINT,
  WORKSPACE_DIR,
  normalizeSkill,
  planFile,
  specFile,
} from '../patterns'
import { parseTestOutput } from '../parsers'
import { CAP, capTail } from '../state'
import { advance, goLive } from '../stages'
import {
  dirname,
  isTestCommand,
  isTestFile,
  joinPath,
  note,
  patchTask,
  relTo,
  warn,
  type Toaster,
} from '../core'
import { onSkill } from './skills'
import { refreshLedger, refreshPlan, resolveWorkspace } from './plan'

export type ToolEvent = {
  tool: string
  id: string
  input: Record<string, unknown>
  agentId?: string
  text: string
  isError: boolean
  replay?: boolean
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Branch, linked-worktree flag and repo root, through git with argv arrays. */
export const refreshGit = async (io: Io): Promise<void> => {
  const cwd = await safe(io.session.cwd(), '')
  const top = await safe(io.run(['git', 'rev-parse', '--show-toplevel'], cwd), undefined)
  if (!top || top.code !== 0) return
  const [branch, gitDir, common] = await Promise.all([
    safe(io.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], cwd), undefined),
    safe(io.run(['git', 'rev-parse', '--absolute-git-dir'], cwd), undefined),
    safe(io.run(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], cwd), undefined),
  ])
  const root = top.out.trim()
  await io.state.env.set(env => ({
    ...env,
    repoRoot: root,
    isLinkedWorktree: !!gitDir && !!common && gitDir.out.trim() !== common.out.trim(),
    ...(branch && branch.code === 0 ? { branch: branch.out.trim() } : {}),
  }))
}

const absolute = (cwd: string, p: string): string => (p.startsWith('/') ? p : joinPath(cwd, p))

export const onToolResult = async (io: Io, toast: Toaster, ev: ToolEvent): Promise<void> => {
  switch (ev.tool) {
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return onWrite(io, toast, ev)
    case 'Bash':
      return onBash(io, toast, ev)
    case 'Read': {
      const m = SKILL_FILE.exec(str(ev.input.file_path))
      const skill = normalizeSkill(m?.[1])
      if (skill) await onSkill(io, skill, { via: 'read', ...(ev.agentId ? { agentId: ev.agentId } : {}) })
      return
    }
    case 'Skill': {
      const skill = normalizeSkill(str(ev.input.skill))
      if (skill) await onSkill(io, skill, { via: 'tool', ...(ev.agentId ? { agentId: ev.agentId } : {}), ...(str(ev.input.args) ? { args: str(ev.input.args) } : {}) })
      return
    }
    case 'Agent':
      if (str(ev.input.isolation) === 'worktree') await io.state.env.set(env => ({ ...env, worktreeEvents: env.worktreeEvents + 1 }))
      return
    case 'EnterWorktree':
    case 'ExitWorktree':
      await io.state.env.set(env => ({ ...env, worktreeEvents: env.worktreeEvents + 1 }))
      if (ev.tool === 'ExitWorktree' && str(ev.input.action) === 'remove') {
        await io.state.run.set(r => (r.finishing ? { ...r, finishing: { ...r.finishing, worktreeRemoved: true } } : r))
      }
      if (!ev.replay) await refreshGit(io)
      return
    default:
      return
  }
}

const onWrite = async (io: Io, toast: Toaster, ev: ToolEvent): Promise<void> => {
  const cwd = await safe(io.session.cwd(), '')
  const raw = str(ev.input.file_path) || str(ev.input.notebook_path)
  if (!raw || ev.isError) return
  const path = absolute(cwd, raw)
  const env = await io.state.env.get()
  const settings = await io.state.settings.get()
  const rel = relTo(env.repoRoot ?? cwd, path)
  const now = await io.now()

  if (specFile(settings.specDir).test(rel)) {
    await io.state.run.set(r => advance(goLive({ ...r, specPath: rel }, now), 'spec', now))
    await note(io, { kind: 'artifact', label: `spec ${rel.split('/').at(-1)}`, ok: true })
    return
  }
  if (planFile(settings.planDir).test(rel)) {
    const before = await io.state.run.get()
    await io.state.run.set(r => advance(goLive(r, now), 'plan', now))
    await refreshPlan(io, path)
    const after = await io.state.run.get()
    if (before.planPath !== after.planPath && !ev.replay) {
      toast('◆', 'Plan written', `${after.tasks.length} tasks · ${after.planTitle ?? rel}`)
    }
    if (env.repoRoot && !after.workspace) {
      const ws = await resolveWorkspace(io, env.repoRoot, path)
      if (ws) await io.state.run.set(r => ({ ...r, workspace: ws }))
    }
    await note(io, { kind: 'artifact', label: `plan ${rel.split('/').at(-1)}`, ok: true })
    return
  }
  if (SP_PRIVATE.test(rel) || DOC_FILE.test(rel)) return

  const run = await io.state.run.get()
  const agents = await io.state.agents.get()
  const agent = ev.agentId ? agents.find(a => a.agentId === ev.agentId) : undefined
  const taskN = agent?.task ?? run.currentTask

  if (isTestFile(rel, settings.testFiles)) {
    if (taskN !== undefined) await patchTask(io, taskN, t => ({ ...t, sawTestEdit: true }))
    return
  }

  // Production code from here on.
  if (taskN !== undefined && run.stage === 'execute') {
    const task = run.tasks.find(t => t.n === taskN)
    const sawRed = task?.tdd.some(d => !d.ok) ?? false
    if (task && !task.sawTestEdit && !sawRed && !task.implFirst) {
      await patchTask(io, taskN, t => ({ ...t, implFirst: true }))
      if (!ev.replay) await warn(io, toast, 'impl-before-test', `Task ${taskN}: production code changed before a test or a failing run`, `${rel} (${ev.id})`)
    }
  }
  if (ev.agentId) return

  if (run.debuggingActive) await io.state.run.set(r => ({ ...r, debugEditPending: true }))
  if (run.brainstormActive && !run.approvalSeen && (run.path === 'bounded' || run.path === 'architectural')) {
    await warn(io, toast, 'code-before-approval', `Code written before ${run.path} approval`, `${rel} (${ev.id})`)
  }
  if (run.lifecycle === 'live' && run.executor === 'sdd' && run.stage === 'execute' && run.workspace) {
    await warn(io, toast, 'controller-edit', 'The controller edited code itself during SDD', `${rel} (${ev.id})`)
  }
}

const onBash = async (io: Io, toast: Toaster, ev: ToolEvent): Promise<void> => {
  const command = str(ev.input.command)
  if (!command) return
  const cwd = await safe(io.session.cwd(), '')
  const settings = await io.state.settings.get()
  const now = await io.now()
  const out = ev.text
  let touchedLedger = false

  // SDD and executing-plans scripts.
  const script = SCRIPT_ARGS.exec(command)
  if (script) {
    const [, name, planArg, nArg, baseArg] = script
    const plan = planArg ? absolute(cwd, planArg.replace(/^["']|["']$/g, '')) : undefined
    const n = nArg ? Number(nArg) : undefined
    await io.state.run.set(r => goLive(r, now))
    const wsLine = WORKSPACE_DIR.exec(out)
    const brief = OUT_TASK_BRIEF.exec(out)
    const startBrief = OUT_TASK_START_BRIEF.exec(out)
    const workspace = brief?.[1] ? dirname(brief[1]) : startBrief?.[1] ? dirname(startBrief[1].trim()) : wsLine?.[1]
    await io.state.run.set(r => ({
      ...r,
      ...(workspace ? { workspace } : {}),
      ...(plan ? { planPath: plan } : {}),
      ...(name === 'task-start' || name === 'task-done' ? (r.executor ? {} : { executor: 'inline' as const }) : {}),
    }))
    if (plan) await refreshPlan(io, plan)
    if (n !== undefined && (name === 'task-brief' || name === 'task-start')) {
      const base = OUT_TASK_START_BASE.exec(out)?.[1] ?? baseArg
      await io.state.run.set(r => advance({ ...r, currentTask: n, ...(base ? { base } : {}) }, 'execute', now))
      await patchTask(io, n, t => ({
        ...t,
        status: t.status === 'done' || t.status === 'parked' ? t.status : t.status === 'fixing' ? 'fixing' : 'running',
        startedAt: t.startedAt ?? now,
        ...(brief?.[1] || startBrief?.[1] ? { brief: (brief?.[1] ?? startBrief?.[1] ?? '').trim() } : {}),
      }))
    }
    if (name === 'task-done' && n !== undefined) {
      const ok = OUT_TASK_DONE_LEDGER.test(out) && !OUT_TASK_DONE_FAIL.test(out + ev.text)
      await recordTest(io, toast, ev, `task-done ${n}`, ok, n)
    }
    touchedLedger = true
  }

  // Test runs.
  if (!script && isTestCommand(command, settings.testRunners)) {
    const failed = ev.isError || /exit(?:ed)? (?:code |with )?[1-9]\d*/i.test(out)
    await recordTest(io, toast, ev, command, !failed)
  } else if (!ev.agentId && VERIFY_HINT.test(command)) {
    await io.state.run.set(r => ({ ...r, turnHadVerification: true }))
  }

  // git.
  if (G.commit.test(command) && !ev.isError) {
    await io.state.run.set(r => (r.specPath && !r.specCommitted ? { ...r, specCommitted: true } : r))
  }
  if (G.worktreeAdd.test(command) || G.worktreeRemove.test(command)) {
    await io.state.env.set(env => ({ ...env, worktreeEvents: env.worktreeEvents + 1 }))
  }
  await io.state.run.set(r => {
    if (!r.finishing) return r
    const f = { ...r.finishing }
    if (G.worktreeRemove.test(command) && !ev.isError) f.worktreeRemoved = true
    if (G.branchDelete.test(command) && !ev.isError) {
      f.branchDeleted = true
      if (/\s-D\b/.test(command)) f.option = 'discard'
    }
    if (G.merge.test(command) && !f.option) f.option = 'merge'
    if (G.prCreate.test(command) || /\bgit\s+push\s+(?:-u|--set-upstream)\b/.test(command)) f.option = 'pr'
    if (G.workspaceDelete.test(command) && !ev.isError) f.workspaceDeleted = true
    return { ...r, finishing: f }
  })
  if (G.workspaceDelete.test(command) && !ev.isError) touchedLedger = true

  // The visual companion.
  if (G.startServer.test(command)) {
    const json = /\{"type":"server-started"[^\n]*\}/.exec(out)?.[0]
    if (json) {
      const info = safeJson(json)
      const stateDir = str(info?.state_dir)
      if (stateDir) {
        const companion: Companion = {
          dir: dirname(stateDir),
          alive: true,
          stopped: false,
          clicks: 0,
          ...(str(info?.url) ? { url: str(info?.url) } : {}),
          ...(typeof info?.port === 'number' ? { port: info.port } : {}),
        }
        await io.state.env.set(env => ({ ...env, companion }))
        if (!ev.replay) toast('◇', 'Visual companion up', companion.url ?? companion.dir)
      }
    }
  }

  if (!ev.replay) {
    if (/\bgit\b/.test(command) || touchedLedger) await refreshGit(io)
    await refreshLedger(io, toast)
  }
}

const recordTest = async (io: Io, toast: Toaster, ev: ToolEvent, command: string, ok: boolean, forcedTask?: number): Promise<void> => {
  const now = await io.now()
  const run = await io.state.run.get()
  const agents = await io.state.agents.get()
  const agent = ev.agentId ? agents.find(a => a.agentId === ev.agentId) : undefined
  const task = forcedTask ?? agent?.task ?? run.currentTask
  const counts = parseTestOutput(ev.text)
  const t: TestRun = {
    at: now,
    command: command.slice(0, 200),
    ok,
    ref: ev.id,
    ...(counts.passed !== undefined ? { passed: counts.passed } : {}),
    ...(counts.failed !== undefined ? { failed: counts.failed } : {}),
    ...(task !== undefined ? { task } : {}),
    ...(ev.agentId ? { agentId: ev.agentId } : {}),
  }
  await io.state.tests.set(list => capTail([...list, t], CAP.tests))
  if (task !== undefined) await patchTask(io, task, row => ({ ...row, tdd: capTail([...row.tdd, { ok, at: now }], 24) }))
  await note(io, { kind: 'test', label: `${ok ? 'pass' : 'fail'} · ${command.slice(0, 60)}`, ok, ...(ev.agentId ? { agentId: ev.agentId } : {}) })
  if (ev.agentId) return
  await io.state.run.set(r => ({ ...r, turnHadVerification: true }))
  // Systematic debugging: an edit followed by a failing re-run is one failed fix.
  if (run.debuggingActive && run.debugEditPending) {
    await io.state.run.set(r => ({ ...r, debugEditPending: false }))
    if (!ok) {
      const env = await io.state.env.set(e => ({ ...e, debugFixes: e.debugFixes + 1 }))
      if (env.debugFixes >= 3 && !ev.replay) {
        await warn(io, toast, 'debug-three-fixes', '3+ fixes failed: question the architecture', `${command.slice(0, 60)} (${ev.id})`)
      }
    } else {
      await io.state.env.set(e => ({ ...e, debugFixes: 0 }))
    }
  }
}

const safeJson = (s: string): Record<string, unknown> | undefined => {
  try {
    const v: unknown = JSON.parse(s)
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}
