// superpowers-tracker: the one module that holds `$`. It builds the Io every
// other module works through, owns the $.state atoms, and registers the hooks.
// An observer first: every hook runs next(e), records, and returns the result.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { Candidate, Settings } from '../types'
import type { Io, Message } from './io'
import { safe } from './io'
import {
  DEFAULT_SETTINGS,
  FRESH_DEMO,
  FRESH_ENV,
  FRESH_LEDGER,
  FRESH_RESUME,
  FRESH_UI,
  freshRun,
} from './state'
import { BOOTSTRAP, BUILT_AGAINST, DOC_FILE, SP_PRIVATE, normalizeSkill, planFile, specFile } from './patterns'
import { isTestFile, joinPath, note, relTo, warn, type Toaster } from './core'
import { onSkill } from './signals/skills'
import { onToolResult, refreshGit } from './signals/tools'
import { assessSpawn, onAgentDone, recordSpawn } from './signals/agents'
import { checkBootstrap, maybeShip, onMainAnswer, onPromptSubmitted } from './signals/answers'
import { ledgerFor, refreshLedger, refreshPlan } from './signals/plan'
import { guardWrite, ledgerNote, ledgerDone } from './modes'
import { LIVE_WINDOW_MS, projectDirName, scan } from './scan'
import { dismissKey, findCheckpoint, leftOffKey, loadSnapshot, mergeSnapshot, pruneStore, rehydrate, restoreCheckpoint, saveCheckpoint, saveLeftOff, saveSnapshot, tailAfter, type LeftOff } from './persist'
import { parseLedger, progressOf } from './parsers'
import { applyConfig, configText, diagnoseText, exportMarkdown, ledgerText, parseSp } from './commands'
import { buildBand, statusText, visibleCandidates, SHIP_SPARK_MS, SHIP_HOLD_MS, type World } from './ui/viewModel'
import { pickTheme, arcRamp, type Tokens } from './ui/theme'
import { PaneView } from './ui/pane/Pane'
import type { PaneActions, PaneCtx } from './ui/pane/kit'
import { BandText } from './ui/band/BandText'
import { actionsWidth, bandActions, type BandAction } from './ui/band/actions'
import { ThemePreview } from './ui/themePreview'
import { railSvg, flowSvg } from './ui/desktop/svg'
import { encodeCells, sparkFrame } from './ui/raster'
import { demoWorld, DEMO_MS } from './ui/demo'

const PANE = 'superpowers-tracker'
const THEME_PANE = 'sp-theme'

const runA = atom({ plugin: 'superpowers-tracker', key: 'run' } as const, freshRun(0))
const timelineA = atom({ plugin: 'superpowers-tracker', key: 'timeline' } as const, [])
const skillsA = atom({ plugin: 'superpowers-tracker', key: 'skills' } as const, [])
const agentsA = atom({ plugin: 'superpowers-tracker', key: 'agents' } as const, [])
const ledgerA = atom({ plugin: 'superpowers-tracker', key: 'ledger' } as const, FRESH_LEDGER)
const testsA = atom({ plugin: 'superpowers-tracker', key: 'tests' } as const, [])
const warningsA = atom({ plugin: 'superpowers-tracker', key: 'warnings' } as const, [])
const envA = atom({ plugin: 'superpowers-tracker', key: 'env' } as const, FRESH_ENV)
const uiA = atom({ plugin: 'superpowers-tracker', key: 'ui' } as const, FRESH_UI)
const resumeA = atom({ plugin: 'superpowers-tracker', key: 'resume' } as const, FRESH_RESUME)
const settingsA = atom({ plugin: 'superpowers-tracker', key: 'settings' } as const, DEFAULT_SETTINGS)
const demoA = atom({ plugin: 'superpowers-tracker', key: 'demo' } as const, FRESH_DEMO)

/** The Io over `$`: the only place the tracker's logic touches the engine. */
function makeIo($: EngineInterface): Io {
  return {
    state: {
      run: { get: () => read($, runA), set: fn => update($, runA, fn) },
      timeline: { get: () => read($, timelineA), set: fn => update($, timelineA, fn) },
      skills: { get: () => read($, skillsA), set: fn => update($, skillsA, fn) },
      agents: { get: () => read($, agentsA), set: fn => update($, agentsA, fn) },
      ledger: { get: () => read($, ledgerA), set: fn => update($, ledgerA, fn) },
      tests: { get: () => read($, testsA), set: fn => update($, testsA, fn) },
      warnings: { get: () => read($, warningsA), set: fn => update($, warningsA, fn) },
      env: { get: () => read($, envA), set: fn => update($, envA, fn) },
      ui: { get: () => read($, uiA), set: fn => update($, uiA, fn) },
      resume: { get: () => read($, resumeA), set: fn => update($, resumeA, fn) },
      settings: { get: () => read($, settingsA), set: fn => update($, settingsA, fn) },
      demo: { get: () => read($, demoA), set: fn => update($, demoA, fn) },
    },
    now: () => $.clock.now(),
    fs: {
      read: p => $.fs.read(p),
      list: async p => (await $.fs.list(p)).map(e => ({ name: e.name, kind: e.kind, size: e.size, mtimeMs: e.mtimeMs })),
      stat: async p => {
        const s = await $.fs.stat(p)
        return { kind: s.kind, size: s.size, mtimeMs: s.mtimeMs }
      },
      exists: p => $.fs.exists(p),
      write: (p, t) => $.fs.write(p, t),
    },
    run: async (argv, cwd) => {
      const r = await $.process.run(argv, { timeoutMs: 5000, ...(cwd ? { cwd } : {}) })
      return { code: r.exitCode, out: r.stdout, err: r.stderr }
    },
    store: {
      get: k => $.store.get(k),
      set: (k, v) => $.store.set(k, v),
      del: k => $.store.delete(k),
      keys: () => $.store.keys(),
    },
    ui: {
      toast: (t, ms) => $.ui.toast(t, ms ? { timeoutMs: ms } : undefined),
      status: t => $.ui.status(t),
      notice: (id, t) => {
        try {
          $.ui.notice(id, t)
        } catch {
          // The call's dialog may already be closed.
        }
      },
      log: t => $.ui.log(t, { to: 'debug' }),
      redraw: () => $.ui.invalidate('ui.render'),
    },
    session: {
      id: () => $.session.id(),
      cwd: () => $.session.cwd(),
      messages: async () => (await $.session.messages()) as unknown as Message[],
      contextPercent: async () => (await $.session.usage()).context.percent,
      costUsd: async () => (await $.session.usage()).cost?.usd,
    },
    settingsFile: () => $.settings.read() as Promise<Record<string, unknown>>,
    home: () => $.env.get('HOME'),
    env: name => (name === 'NO_COLOR' ? $.env.get('NO_COLOR') : name === 'COLORTERM' ? $.env.get('COLORTERM') : $.env.get('TERM')),
  }
}

/** Every value the drawing reads, in one World. Called while drawing, so it subscribes. */
async function readWorld($: EngineInterface): Promise<World> {
  const [run, timeline, skills, agents, ledger, tests, warnings, env, ui, resume, settings, demo] = await Promise.all([
    read($, runA),
    read($, timelineA),
    read($, skillsA),
    read($, agentsA),
    read($, ledgerA),
    read($, testsA),
    read($, warningsA),
    read($, envA),
    read($, uiA),
    read($, resumeA),
    read($, settingsA),
    read($, demoA),
  ])
  return { run, timeline, skills, agents, ledger: ledgerFor(run, ledger), tests, warnings, env, ui, resume, settings, demo }
}


/** Working memory of one load of the module, created in register(): timers,
 *  the toast batch, what is followed. Never module-level; a reload starts it over. */
type Mem = {
  theme: Tokens
  version: string
  root: string
  poll: { cancel: () => void } | undefined
  snapTimer: { cancel: () => void } | undefined
  toastTimer: { cancel: () => void } | undefined
  toastBuf: { line: string; sev?: string }[]
  bandRequestId: string | undefined
  sparkTimer: { cancel: () => void } | undefined
  demoTimer: { cancel: () => void } | undefined
  pendingAssist: boolean
  spectating: { id: string; workspace: string; lastMtime: number; quietSince: number } | undefined
  redispatched: Set<string>
  /** The session the tracked state belongs to; empty until startup has put it in place. */
  sessionId: string
  /** The restore in flight: hooks that record wait for it, so nothing lands under it. */
  starting: Promise<void> | undefined
  /** The last tool call recorded: where a restore picks the transcript up again. */
  lastRef: string | undefined
  ckTimer: { cancel: () => void } | undefined
  /** What the left-off record was last written from: rewritten only when it moves. */
  leftSig: string
  /** Counts startups: one that a later one overtook changes nothing more. */
  gen: number
  /** A session this process just left, and when: its id is not taken for the next one's. */
  left: { id: string; at: number } | undefined
}

const newMem = (): Mem => ({
  theme: pickTheme('auto', undefined, false),
  version: BUILT_AGAINST,
  root: '',
  poll: undefined,
  snapTimer: undefined,
  toastTimer: undefined,
  toastBuf: [],
  bandRequestId: undefined,
  sparkTimer: undefined,
  demoTimer: undefined,
  pendingAssist: false,
  spectating: undefined,
  redispatched: new Set(),
  sessionId: '',
  starting: undefined,
  lastRef: undefined,
  ckTimer: undefined,
  leftSig: '',
  gen: 0,
  left: undefined,
})

const stopTimers = (m: Mem) => {
  for (const t of [m.poll, m.snapTimer, m.toastTimer, m.sparkTimer, m.demoTimer, m.ckTimer]) t?.cancel()
  m.poll = m.snapTimer = m.toastTimer = m.sparkTimer = m.demoTimer = m.ckTimer = undefined
}

const CHECKPOINT_MS = 4000

/** Writes the session's checkpoint and its left-off record now. */
const checkpointNow = async ($: EngineInterface, m: Mem) => {
  if (!m.sessionId) return
  const io = makeIo($)
  await safe(saveCheckpoint(io, { sessionId: m.sessionId, root: m.root, pendingAssist: m.pendingAssist, ...(m.lastRef ? { lastRef: m.lastRef } : {}) }), false)
  if (!m.root) return
  const run = await read($, runA)
  const sig = `${m.sessionId}|${run.planPath ?? ''}|${run.stage}|${run.lifecycle}|${run.currentTask ?? ''}|${run.tasks.find(t => t.status === 'fixing')?.fixRound ?? ''}`
  if (sig === m.leftSig) return
  m.leftSig = sig
  await safe(saveLeftOff(io, m.root, m.sessionId), undefined)
}

/** Something was recorded: a checkpoint follows within 4 s. A crash fires no
 *  session.end, so this, not the exit, is what keeps the run. */
const touch = ($: EngineInterface, m: Mem) => {
  if (m.ckTimer || !m.sessionId) return
  m.ckTimer = $.clock.after(CHECKPOINT_MS, () => {
    m.ckTimer = undefined
    void checkpointNow($, m)
  })
}

/** Every tracked value back to its start: the state of a session that is over. */
const resetTracked = async ($: EngineInterface) => {
  const now = await safe($.clock.now(), 0)
  await update($, runA, () => freshRun(now))
  await update($, timelineA, () => [])
  await update($, skillsA, () => [])
  await update($, agentsA, () => [])
  await update($, ledgerA, () => FRESH_LEDGER)
  await update($, testsA, () => [])
  await update($, warningsA, () => [])
  await update($, resumeA, () => FRESH_RESUME)
  await update($, envA, () => FRESH_ENV)
}

/** One-line toasts; several within 1 s fold into one summary. */
const makeToaster = ($: EngineInterface, m: Mem): Toaster => (glyph, subject, detail, sev) => {
  m.toastBuf.push({ line: `${glyph} ${subject}${detail ? ` · ${detail}` : ''}`, ...(sev ? { sev } : {}) })
  if (m.toastTimer) return
  m.toastTimer = $.clock.after(1000, () => {
    m.toastTimer = undefined
    const batch = m.toastBuf
    m.toastBuf = []
    void (async () => {
      const s = await read($, settingsA)
      if (!s.toasts || batch.length === 0) return
      const critical = batch.filter(b => b.sev === 'critical')
      if (critical.length) for (const c of critical) $.ui.toast(c.line, { timeoutMs: 8000 })
      const rest = batch.filter(b => b.sev !== 'critical')
      if (rest.length === 1) $.ui.toast(rest[0]!.line)
      else if (rest.length > 1) $.ui.toast(`● ${rest.length} updates · ${rest.map(r => r.line.slice(2)).join(' · ').slice(0, 160)}`, { timeoutMs: 6000 })
    })()
  })
}


const refreshTheme = async ($: EngineInterface, m: Mem) => {
  const s = await read($, settingsA)
  const rows = await safe($.config.list(), [])
  const engineTheme = rows.find(r => r.key === 'theme')?.value
  const noColor = (await safe($.env.get('NO_COLOR'), undefined)) !== undefined
  m.theme = pickTheme(s.theme, typeof engineTheme === 'string' ? engineTheme : undefined, noColor)
}


/** Is superpowers installed and enabled? Version from the installed record. */
const detectInstall = async ($: EngineInterface, m: Mem, io: Io): Promise<{ installed: boolean; version?: string }> => {
  const settings = await safe(io.settingsFile(), {} as Record<string, unknown>)
  const enabled = Object.entries((settings.enabledPlugins ?? {}) as Record<string, unknown>).some(([k, v]) => k.startsWith('superpowers@') && v === true)
  const home = await safe(io.home(), undefined)
  if (!home) return { installed: enabled }
  const record = await safe($.fs.read(`${home}/.claude/plugins/installed_plugins.json`), '')
  const hit = /"superpowers@[^"]+"\s*:\s*\[\s*\{[^\]]*?"version"\s*:\s*"([^"]+)"/.exec(record)
  return { installed: enabled || !!hit, ...(hit?.[1] ? { version: hit[1] } : {}) }
}


const loadSettings = async ($: EngineInterface, m: Mem) => {
  const saved = (await safe($.store.get('settings'), undefined)) as Partial<Settings> | undefined
  if (saved) await update($, settingsA, s => ({ ...s, ...saved }))
}

const saveSettings = async ($: EngineInterface, m: Mem) => safe($.store.set('settings', await read($, settingsA)), undefined)


/** The ledger poll: only while a plan is active or another session is followed, and only on change. */
const ensurePoll = async ($: EngineInterface, m: Mem) => {
  const io = makeIo($)
  const run = await read($, runA)
  const s = await read($, settingsA)
  const wanted = (run.lifecycle === 'live' && !!run.workspace && (run.stage === 'execute' || run.stage === 'review')) || !!m.spectating
  if (wanted && !m.poll) {
    m.poll = $.clock.every(Math.max(500, s.pollMs), () => void tickPoll($, m, io))
  } else if (!wanted && m.poll) {
    m.poll.cancel()
    m.poll = undefined
  }
}


const tickPoll = async ($: EngineInterface, m: Mem, io: Io) => {
  const toast = makeToaster($, m)
  const change = await safe(refreshLedger(io, toast), undefined)
  if (change && (change.completed.length || change.finalReview)) scheduleSnapshot($, m)
  if (change) touch($, m)
  await safe(maybeShip(io, toast), undefined)
  if (m.spectating) await followElsewhere($, m, io)
  await ensurePoll($, m)
}


/** Spectator mode: another session is probably executing; read its ledger, never act on it. */
const followElsewhere = async ($: EngineInterface, m: Mem, io: Io) => {
  if (!m.spectating) return
  const path = joinPath(m.spectating.workspace, 'progress.md')
  const st = await safe(io.fs.stat(path), undefined)
  const now = await io.now()
  if (!st) {
    m.spectating = undefined
    return
  }
  if (st.mtimeMs === m.spectating.lastMtime) {
    if (now - m.spectating.quietSince > LIVE_WINDOW_MS * 2) m.spectating = undefined
    return
  }
  const text = await safe(io.fs.read(path), '')
  const p = progressOf(parseLedger(text).entries)
  const id = m.spectating.id
  m.spectating = { ...m.spectating, lastMtime: st.mtimeMs, quietSince: now }
  await update($, resumeA, r => ({
    ...r,
    candidates: r.candidates.map(c =>
      c.id === id
        ? { ...c, kind: 'live-elsewhere' as const, done: p.done.length, mtime: st.mtimeMs, ...(p.fixing.size ? { current: [...p.fixing.keys()][0]!, fixRound: [...p.fixing.values()][0]! } : {}) }
        : c,
    ),
  }))
}


const scheduleSnapshot = ($: EngineInterface, m: Mem) => {
  if (m.snapTimer || !m.root) return
  m.snapTimer = $.clock.after(30_000, () => {
    m.snapTimer = undefined
    void safe(saveSnapshot(makeIo($), m.root), false)
  })
}


/** The startup scan, in the background: never delays the session. */
const runScan = async ($: EngineInterface, m: Mem, force = false) => {
  const io = makeIo($)
  const toast = makeToaster($, m)
  if (!m.root) return
  await update($, resumeA, r => ({ ...r, scanning: true }))
  const settings = await read($, settingsA)
  const result = await safe(scan(io, m.root, settings, { force }), undefined)
  if (!result) {
    await update($, resumeA, r => ({ ...r, scanning: false }))
    return
  }
  const forgotten = ((await safe($.store.get(dismissKey(m.root)), [])) as { id: string; mtime: number }[]) ?? []
  let candidates = result.candidates.filter(c => !forgotten.some(f => f.id === c.id && f.mtime >= c.mtime))
  const left = (await safe($.store.get(leftOffKey(m.root)), undefined)) as LeftOff | undefined
  if (left) candidates = candidates.map(c => (c.planPath && left.planPath.endsWith(c.planPath) ? { ...c, resumeCmd: left.resume } : c))
  const now = await io.now()
  await update($, resumeA, r => ({ ...r, candidates, scannedAt: now, scanning: false }))
  const top = candidates[0]
  const run = await read($, runA)
  if (top && run.lifecycle !== 'live') {
    await update($, runA, r => (r.lifecycle === 'live' ? r : { ...r, lifecycle: 'resumable' as const, pulseAt: now }))
    const resume = await read($, resumeA)
    if (!resume.toasted.includes(top.id)) {
      await update($, resumeA, r => ({ ...r, toasted: [...r.toasted, top.id] }))
      const what = top.kind === 'planned' ? 'Found a plan not yet executed' : top.kind === 'spec' ? 'Found a spec awaiting a plan' : top.kind === 'companion' ? 'Visual companion still up' : top.kind === 'live-elsewhere' ? 'Plan running in another session (likely)' : 'Found unfinished plan'
      toast('●', what, `${top.title}${top.total ? ` · ${top.done} of ${top.total} tasks done` : ''}`)
    }
    void safe($.prompt.suggest({ text: top.suggest }), { isShown: false })
    const s = await read($, settingsA)
    if (s.mode === 'assist' && (top.kind === 'mid-exec')) m.pendingAssist = true
    if (s.autoOpenPane === 'resumable') void safe($.ui.open({ id: PANE, title: 'superpowers' }), { isPlaced: false, reason: '' })
    if (top.kind === 'live-elsewhere' && top.workspace) {
      m.spectating = { id: top.id, workspace: top.workspace, lastMtime: top.mtime, quietSince: now }
      await ensurePoll($, m)
    }
    // The pane opens on the candidate's plan and ledger, read-only, so a
    // re-dispatch of a completed task is caught from the first turn on.
    if ((top.kind === 'mid-exec' || top.kind === 'live-elsewhere') && top.workspace && top.planPath && !run.planPath) {
      const planAbs = joinPath(top.worktree ?? m.root, top.planPath)
      await update($, runA, r => ({ ...r, workspace: top.workspace!, spectator: top.kind === 'live-elsewhere' }))
      await safe(refreshPlan(io, planAbs), undefined)
      await safe(refreshLedger(io, toast, { quiet: true }), undefined)
    }
    if (top.planPath) {
      const snap = (await safe(loadSnapshot(io, m.root, joinPath(top.worktree ?? m.root, top.planPath)), undefined)) ?? (await safe(loadSnapshot(io, m.root, joinPath(m.root, top.planPath)), undefined))
      if (snap) await safe(mergeSnapshot(io, snap), undefined)
    }
  }
  await lastSuperpowersSession($, m, io)
}


/** The last session in this project that used superpowers: tails of transcripts only. */
const lastSuperpowersSession = async ($: EngineInterface, m: Mem, io: Io) => {
  const home = await safe(io.home(), undefined)
  const cwd = await safe(io.session.cwd(), '')
  const me = await safe(io.session.id(), '')
  if (!home || !cwd) return
  const dir = `${home}/.claude/projects/${projectDirName(cwd)}`
  const files = (await safe(io.fs.list(dir), [])).filter(f => f.kind === 'file' && f.name.endsWith('.jsonl') && !f.name.startsWith(me)).sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, 5)
  const now = await io.now()
  for (const f of files) {
    const tail = await safe(io.run(['tail', '-c', '65536', joinPath(dir, f.name)]), undefined)
    const skill = tail ? [...tail.out.matchAll(/superpowers:([a-z-]+)/g)].map(m => normalizeSkill(m[1])).filter(Boolean).at(-1) : undefined
    if (skill) {
      const id = f.name.replace(/\.jsonl$/, '')
      await update($, resumeA, r => ({ ...r, lastSession: { id, ago: now - f.mtimeMs, skill } }))
      return
    }
  }
}


const resumeText = async ($: EngineInterface, m: Mem, n: number): Promise<Candidate | undefined> => visibleCandidates(await read($, resumeA))[n - 1]


const doResume = async ($: EngineInterface, m: Mem, n: number): Promise<string> => {
  const c = await resumeText($, m, n)
  if (!c) return 'No resume candidate. Run /sp scan to look again.'
  const r = await safe($.prompt.fill({ text: c.suggest, mode: 'replace' }), { isFilled: false, text: '', cursor: 0 })
  return r.isFilled ? `Prompt filled for "${c.title}". Press Enter to send it.` : `Couldn't fill the prompt box. The text:\n${c.suggest}`
}


const doDismiss = async ($: EngineInterface, m: Mem, n: number, forget: boolean): Promise<string> => {
  const c = await resumeText($, m, n)
  if (!c) return 'Nothing to dismiss.'
  await update($, resumeA, r => ({ ...r, dismissed: [...r.dismissed, c.id] }))
  if (forget && m.root) {
    const list = (((await safe($.store.get(dismissKey(m.root)), [])) ?? []) as { id: string; mtime: number }[]).filter(x => x.id !== c.id)
    await $.store.set(dismissKey(m.root), [...list, { id: c.id, mtime: c.mtime }].slice(-100))
  }
  const left = visibleCandidates(await read($, resumeA))
  if (!left.length) await update($, runA, r => (r.lifecycle === 'resumable' ? { ...r, lifecycle: 'armed' as const } : r))
  return forget ? `Dismissed "${c.title}" for good; it returns if its ledger changes.` : `Dismissed "${c.title}" for this session.`
}


const ack = async ($: EngineInterface, m: Mem, target: string): Promise<number> => {
  let n = 0
  await update($, warningsA, list =>
    list.map(w => {
      if (w.acked || (target !== 'all' && w.id !== target && w.code !== target)) return w
      n += 1
      return { ...w, acked: true }
    }),
  )
  return n
}


const openPane = async ($: EngineInterface, m: Mem, tab?: number) => {
  if (tab) await update($, uiA, u => ({ ...u, tab, selection: 0, expanded: -1 }))
  return safe($.ui.open({ id: PANE, title: 'superpowers', focus: true }), { isPlaced: false, reason: 'unavailable' })
}


const exportRun = async ($: EngineInterface, m: Mem): Promise<string> => {
  const w = await readWorld($)
  const id = await safe($.session.id(), 'session')
  const cwd = await safe($.session.cwd(), '')
  const base = joinPath(m.root || cwd, '.superpowers/tracker')
  const path = joinPath(base, `${id}.md`)
  await $.fs.write(joinPath(base, '.gitignore'), '*\n')
  await $.fs.write(path, exportMarkdown(w, await $.clock.now(), id))
  return path
}


/** The ship moment: braille particles in the arc gradient, blitted at ≤12 fps for 1.5 s. */
const playSpark = ($: EngineInterface, m: Mem, columns: number) => {
  if (m.sparkTimer || !m.bandRequestId) return
  const frames = Math.round(SHIP_SPARK_MS / 83)
  let f = 0
  const ramp = arcRamp(m.theme, 24)
  const requestId = m.bandRequestId
  m.sparkTimer = $.clock.every(83, () => {
    f += 1
    if (f >= frames) {
      m.sparkTimer?.cancel()
      m.sparkTimer = undefined
      $.ui.invalidate('ui.render')
      return
    }
    void safe($.ui.blit({ requestId, key: 'spark', cells: encodeCells(sparkFrame(columns, 2, f, frames, ramp), columns, 2) }), {})
  })
  $.clock.after(SHIP_HOLD_MS + 50, () => $.ui.invalidate('ui.render'))
}


const paneActions = ($: EngineInterface, m: Mem): PaneActions => ({
  tab: n => void update($, uiA, u => ({ ...u, tab: n, selection: 0, expanded: -1 })),
  select: i => void update($, uiA, u => ({ ...u, selection: Math.max(0, i) })),
  expand: i => void update($, uiA, u => ({ ...u, expanded: i })),
  ack: id => void ack($, m, id),
  ackAll: () => void ack($, m, 'all'),
  exportRun: () => void exportRun($, m).then(p => $.ui.toast(`● Exported · ${p}`)),
  close: () => void $.ui.close({ id: PANE }),
  resume: n => void doResume($, m, n).then(t => $.ui.toast(t)),
  dismiss: n => void doDismiss($, m, n, false),
  openEvidence: id => void (async () => {
    const w = (await read($, warningsA)).find(x => x.id === id)
    if (w) $.ui.toast(`⚠ ${w.evidence}`, { timeoutMs: 8000 })
  })(),
})


/** Session start, and the start of whatever session this process moves to
 *  (/clear, /resume): put the tracked state in place, then scan.
 *
 *  The state comes from, in order: what $.state still holds for this session
 *  (a reload: nothing is replayed), this session's checkpoint plus the
 *  transcript after it (a crash, a restart, a resume), the transcript alone
 *  (a session from before checkpoints), or nothing (a new session). */
const startup = async ($: EngineInterface, m: Mem) => {
  const io = makeIo($)
  const toast = makeToaster($, m)
  const quiet: Toaster = () => undefined
  m.sessionId = ''
  const gen = (m.gen += 1)
  let sid = ''
  let resolveStarting: () => void = () => undefined
  const mine = new Promise<void>(res => (resolveStarting = res))
  m.starting = mine
  try {
    await loadSettings($, m)
    await refreshTheme($, m)
    const cwd = await safe(io.session.cwd(), '')
    const sessionId = await safe(io.session.id(), '')
    sid = sessionId
    const install = await detectInstall($, m, io)
    m.version = install.version ?? BUILT_AGAINST
    const messages = await safe(io.session.messages(), [] as Message[])
    const surfaces = await safe($.session.surfaces(), [])
    const now = await io.now()

    const held = await read($, envA)
    const heldRun = await read($, runA)
    if (held.sessionId && sessionId && held.sessionId !== sessionId) await resetTracked($)
    const isHeld = !!sessionId && held.sessionId === sessionId && heldRun.lifecycle !== 'dormant'
    // Right after a /clear the engine may still answer the id it is leaving:
    // an empty transcript under that id is the cleared session, not a resume.
    const cleared = !!m.left && m.left.id === sessionId && messages.length === 0
    const ck = cleared ? undefined : await safe(findCheckpoint(io, sessionId, messages), undefined)
    // A later startup (a /clear or /resume while this one read) owns the state now.
    if (gen !== m.gen) return
    if (ck && !isHeld) await safe(restoreCheckpoint(io, ck, now), undefined)

    await update($, envA, env => ({
      ...env,
      installed: install.installed,
      ...(install.version ? { pluginVersion: install.version } : {}),
      ...(sessionId ? { sessionId } : {}),
      ...(surfaces[0] ? { surface: surfaces[0] } : {}),
    }))
    const bootstrapped = await checkBootstrap(io, toast, 'startup', false)
    // Dormant fast path: nothing of superpowers here, one stat and done.
    const traces = (await safe(io.fs.exists(joinPath(cwd, '.superpowers')), false)) || (await safe(io.fs.exists(joinPath(cwd, 'docs/superpowers')), false))
    if (!install.installed && !bootstrapped && !traces && !ck && !isHeld) {
      m.sessionId = sessionId
      return
    }
    if (install.installed || bootstrapped) await update($, runA, r => (r.lifecycle === 'dormant' ? { ...r, lifecycle: 'armed' as const } : r))
    // A superpowers of another major version may write what this build cannot read.
    const major = (v: string) => v.split('.')[0]
    if (install.version && major(install.version) !== major(BUILT_AGAINST)) {
      await warn(io, quiet, 'version-drift', `superpowers ${install.version} is installed; this tracker reads ${BUILT_AGAINST}'s formats`, `installed ${install.version}, built against ${BUILT_AGAINST}`)
    }
    await refreshGit(io)
    m.root = (await read($, envA)).repoRoot ?? cwd

    if (ck) {
      m.lastRef = ck.lastRef
      m.pendingAssist = ck.pendingAssist === true
    }
    if (isHeld) {
      io.ui.log('state held for this session: nothing replayed')
    } else if (ck) {
      const tail = tailAfter(messages, ck.lastRef)
      const n = tail.length ? await safe(rehydrate(io, tail), 0) : 0
      io.ui.log(`restored the checkpoint of ${new Date(ck.savedAt).toISOString()}${n ? `, then replayed ${n} tool uses after it` : ''}`)
    } else if (messages.some(x => x.role === 'assistant' && x.toolUses.length > 0)) {
      const n = await safe(rehydrate(io, messages), 0)
      if (n > 0) io.ui.log(`rehydrated ${n} tool uses from the resumed transcript`)
      // A transcript that was compacted has lost its beginning: the plan's snapshot has it.
      const run = await read($, runA)
      const snap = run.planPath ? await safe(loadSnapshot(io, m.root, run.planPath), undefined) : undefined
      if (snap) await safe(mergeSnapshot(io, snap), undefined)
    }
    // Everything in the transcript is in the state now, held or restored.
    const last = messages.flatMap(x => x.toolUses ?? []).at(-1)?.tool_use_id
    if (last) m.lastRef = last
    if (!isHeld) {
      // The disk is the truth for what happened while the tracker was away.
      const run = await read($, runA)
      if (run.planPath) await safe(refreshPlan(io, run.planPath), undefined)
      await safe(refreshLedger(io, quiet, { force: true, quiet: true }), undefined)
      await safe(maybeShip(io, quiet, true), undefined)
    }
    m.sessionId = sessionId
  } finally {
    if (gen === m.gen) {
      // Whatever failed, this session counts as started: no start loop.
      if (!m.sessionId) m.sessionId = sid
      if (m.starting === mine) m.starting = undefined
    }
    resolveStarting()
  }
  if (gen !== m.gen) return
  await runScan($, m)
  await ensurePoll($, m)
  touch($, m)
  void safe(pruneStore(io, await io.now()), 0)
}


/** The process moved to another session with no session.start (/clear,
 *  /resume): what was tracked belonged to the one it left. */
const switchSession = async ($: EngineInterface, m: Mem) => {
  stopTimers(m)
  m.spectating = undefined
  m.pendingAssist = false
  m.lastRef = undefined
  m.redispatched.clear()
  m.toastBuf = []
  m.sessionId = ''
  // Held from before the first await, so a second caller waits instead of switching again.
  let release: () => void = () => undefined
  const guard = new Promise<void>(res => (release = res))
  m.starting = guard
  try {
    await resetTracked($)
    await startup($, m)
  } finally {
    if (m.starting === guard) m.starting = undefined
    release()
  }
}

/** Called where a session begins to act (a prompt, a skill): if the id the
 *  engine answers is not the one tracked, the tracker moves with it. */
const ensureSession = async ($: EngineInterface, m: Mem) => {
  if (m.starting) {
    await m.starting
    return
  }
  const id = await safe($.session.id(), '')
  if (!id || id === m.sessionId) return
  if (m.left && id === m.left.id && (await safe($.clock.now(), 0)) - m.left.at < 3000) return
  await switchSession($, m)
}


const handleSkill = async ($: EngineInterface, m: Mem, skill: NonNullable<ReturnType<typeof normalizeSkill>>, via: 'prompt' | 'tool', args?: string) => {
  const io = makeIo($)
  const before = await read($, runA)
  const fresh = await onSkill(io, skill, { via, ...(args ? { args } : {}) })
  if (!fresh) return
  if (before.lifecycle !== 'live') {
    // This session now does the work: whatever it followed becomes its own.
    if (m.spectating) m.spectating = undefined
    await update($, runA, r => ({ ...r, spectator: false }))
    const s = await read($, settingsA)
    if (s.autoOpenPane === 'live') void safe($.ui.open({ id: PANE, title: 'superpowers' }), { isPlaced: false, reason: '' })
    if (!m.root) {
      await refreshGit(io)
      m.root = (await read($, envA)).repoRoot ?? (await safe(io.session.cwd(), ''))
    }
  }
  await ensurePoll($, m)
  scheduleSnapshot($, m)
  touch($, m)
}


/** The demo replaces the world while it plays; the real state is untouched. */
const viewWorld = async ($: EngineInterface, m: Mem): Promise<{ w: World; now: number }> => {
  const w0 = await readWorld($)
  const now = await $.clock.now()
  if (!w0.demo.active) return { w: w0, now }
  const w = demoWorld(now - w0.demo.startedAt, w0.demo.startedAt, w0.settings.mode)
  return { w: { ...w, ui: w0.ui, settings: { ...w0.settings, band: 'always' } }, now }
}


export const register: Register = on => {
  const m = newMem()

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await safe(
      $.command.register({
        name: 'sp',
        description: 'superpowers-tracker: the pane, status, ledger, resume, modes, demo',
        argumentHint: '[1-7|status|ledger|export|ack|mode|band|config|reset|resume|dismiss|scan|demo|theme|diagnose]',
      }),
      { command: 'sp' },
    )
    // A fresh load of the module (the process started, a reload, a worker
    // respawn): timers of the copy before are the engine's to drop, and this
    // copy's working memory starts over. What $.state holds decides the rest.
    stopTimers(m)
    Object.assign(m, newMem())
    void safe(startup($, m), undefined)
    return r
  })

  on('skill.prompt', async ($, e, next) => {
    const r = await next(e)
    const skill = normalizeSkill(e.skill)
    if (skill) {
      await safe(ensureSession($, m), undefined)
      await safe(handleSkill($, m, skill, 'prompt'), undefined)
    }
    return r
  })

  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    const input = e as unknown as Record<string, unknown>
    const isMain = e.agentId === undefined
    if ((tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit') && typeof input.file_path === 'string') {
      const [run, settings, env] = await Promise.all([read($, runA), read($, settingsA), read($, envA)])
      if (settings.mode === 'strict' && run.lifecycle === 'live') {
        const rel = relTo(env.repoRoot, String(input.file_path))
        const isSource = !specFile(settings.specDir).test(rel) && !planFile(settings.planDir).test(rel) && !DOC_FILE.test(rel) && !SP_PRIVATE.test(rel) && !isTestFile(rel, settings.testFiles)
        const deny = guardWrite({ mode: settings.mode, isMain, isSource, run })
        if (deny) {
          await warn(makeIo($), makeToaster($, m), 'strict-deny', 'Strict mode denied a write before approval', `${rel} (${e.tool_use_id})`)
          return { deny }
        }
      }
    }
    const r = await next(e)
    if (m.starting) await m.starting
    const run = await read($, runA)
    const relevant = run.lifecycle !== 'dormant' || tool === 'Skill' || tool === 'Read' || tool === 'Write' || tool === 'Edit' || tool === 'Bash'
    if (relevant) {
      const { tool: _t, tool_use_id: _id, agentId: _a, ...args } = input
      await safe(
        onToolResult(makeIo($), makeToaster($, m), {
          tool,
          id: e.tool_use_id,
          input: args,
          text: r.deny !== undefined ? r.deny : r.text ?? '',
          isError: r.deny !== undefined || r.isError === true,
          ...(e.agentId ? { agentId: e.agentId } : {}),
        }),
        undefined,
      )
      if (tool === 'Bash' || tool === 'Write' || tool === 'Edit') await ensurePoll($, m)
      if ((await read($, runA)).lifecycle !== 'dormant') {
        // Only the main thread's calls are in the transcript a restore reads.
        if (isMain) m.lastRef = e.tool_use_id
        touch($, m)
      }
    }
    if (tool === 'Agent' && m.redispatched.has(e.tool_use_id) && r.deny === undefined) {
      m.redispatched.delete(e.tool_use_id)
      const note = ledgerNote(ledgerFor(run, await read($, ledgerA)), run)
      if (note) return { ...r, context: [...(r.context ?? []), note] }
    }
    return r
  })

  on('agent.spawn', async ($, e, next) => {
    if (m.starting) await m.starting
    const io = makeIo($)
    const toast = makeToaster($, m)
    const spawn = {
      tool_use_id: e.tool_use_id,
      prompt: e.prompt,
      description: e.description,
      subagentType: e.subagentType,
      parentModel: e.parentModel,
      ...(e.model ? { model: e.model } : {}),
      ...(e.parentAgentId ? { parentAgentId: e.parentAgentId } : {}),
    }
    const a = await safe(assessSpawn(io, toast, spawn), undefined)
    if (a?.deny) return { deny: a.deny }
    if (a && a.role === 'implementer' && a.task !== undefined) {
      const s = await read($, settingsA)
      if (s.mode !== 'observe' && ledgerDone(ledgerFor(await read($, runA), await read($, ledgerA))).includes(a.task)) m.redispatched.add(e.tool_use_id)
    }
    const r = await next(e)
    if (a && r.deny === undefined) {
      const label = await safe(recordSpawn(io, spawn, a, { ...(r.agentId ? { agentId: r.agentId } : {}), ...(r.model ? { model: r.model } : {}) }), undefined)
      if (label) io.ui.notice(e.tool_use_id, label)
      await ensurePoll($, m)
      if (!e.parentAgentId) m.lastRef = e.tool_use_id
      touch($, m)
    }
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (m.starting) await m.starting
    const run = await read($, runA)
    if (run.lifecycle === 'dormant') return r
    const io = makeIo($)
    const toast = makeToaster($, m)
    if (e.agentId) {
      await safe(onAgentDone(io, toast, e.agentId, e.answer, e.reason === 'error' || e.isAborted), undefined)
      touch($, m)
      return r
    }
    await safe(onMainAnswer(io, toast, e.answer, e.turnId), undefined)
    const [pct, cost] = await Promise.all([safe(io.session.contextPercent(), undefined), safe(io.session.costUsd(), undefined)])
    await update($, envA, env => ({
      ...env,
      ...(pct !== undefined ? { context: [...env.context, pct].slice(-8) } : {}),
      ...(cost !== undefined ? { costUsd: cost } : {}),
    }))
    await safe(refreshLedger(io, toast), undefined)
    await safe(maybeShip(io, toast), undefined)
    const s = await read($, settingsA)
    if (s.band === 'off') {
      const now = await io.now()
      const vm = buildBand(await readWorld($), m.theme, { columns: 80, now, working: false, version: m.version })
      $.ui.status(vm && vm.progress ? `ϟ ${run.stage} ${vm.progress.done}/${vm.progress.total}${vm.pills.warnings ? ` ⚠${vm.pills.warnings}` : ''}` : undefined)
    }
    await ensurePoll($, m)
    scheduleSnapshot($, m)
    // The turn is over: the quiet moment a checkpoint is cheapest and most whole.
    m.ckTimer?.cancel()
    m.ckTimer = undefined
    void checkpointNow($, m)
    return r
  })

  on('prompt.submit', async ($, e, next) => {
    await safe(ensureSession($, m), undefined)
    const run = await read($, runA)
    if (run.lifecycle === 'dormant') return next(e)
    await safe(onPromptSubmitted(makeIo($), e.origin.kind === 'composer', e.text), undefined)
    touch($, m)
    const s = await read($, settingsA)
    if (s.mode !== 'observe' && m.pendingAssist) {
      m.pendingAssist = false
      const note = ledgerNote(ledgerFor(run, await read($, ledgerA)), run)
      if (note) return next({ ...e, context: [...(e.context ?? []), note] })
    }
    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId || r.skip !== undefined) return r
    const run = await read($, runA)
    if (run.lifecycle === 'dormant') return r
    const io = makeIo($)
    const now = await io.now()
    await update($, envA, env => ({ ...env, compactions: [...env.compactions, now].slice(-50) }))
    await note(io, { kind: 'compact', label: 'compacted', detail: 'checking bootstrap' })
    if (run.planPath) m.pendingAssist = true
    touch($, m)
    const hadBootstrap = (await read($, envA)).bootstrap.some(b => b.ok)
    $.clock.after(2500, () => void safe(checkBootstrap(io, makeToaster($, m), 'compaction', hadBootstrap), false))
    return r
  })

  on('session.append', { door: ['hook-context', 'attachment'] }, async ($, e, next) => {
    const r = await next(e)
    if (e.agentId) return r
    const text = e.message.content.map(b => (typeof b.text === 'string' ? b.text : '')).join('\n')
    if (BOOTSTRAP.test(text)) {
      const now = await $.clock.now()
      await update($, envA, env => ({ ...env, bootstrap: [...env.bootstrap, { at: now, ok: true, why: 'context' }].slice(-12) }))
      await update($, runA, run => (run.lifecycle === 'dormant' ? { ...run, lifecycle: 'armed' as const } : run))
    }
    return r
  })

  on('session.end', async ($, e, next) => {
    // One short bound covers every plugin's end hook: the small records
    // first, the plan's snapshot last. A crash never gets here at all, which
    // is why the checkpoint is also written while the session runs.
    if (m.sessionId) {
      m.ckTimer?.cancel()
      m.ckTimer = undefined
      await checkpointNow($, m)
      if (m.root) await safe(saveSnapshot(makeIo($), m.root), false)
    }
    const r = await next(e)
    if (e.reason === 'clear' || e.reason === 'resume') {
      // The process goes on under another session and no session.start
      // fires: what was tracked is the old session's, kept in its checkpoint.
      stopTimers(m)
      m.spectating = undefined
      m.pendingAssist = false
      m.lastRef = undefined
      m.redispatched.clear()
      m.sessionId = ''
      m.left = { id: e.sessionId, at: await safe($.clock.now(), 0) }
      await resetTracked($)
      if (e.reason === 'clear') void safe(startup($, m), undefined)
      // A resumed session's id and transcript are in place a moment later.
      else $.clock.after(400, () => void safe(ensureSession($, m), undefined))
    }
    return r
  })

  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const r = await next(e)
    await refreshTheme($, m)
    $.ui.invalidate('ui.render')
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { w, now } = await viewWorld($, m)
    const vm = buildBand(w, m.theme, { columns: e.props.bodyColumns, now, working: e.props.isWorking, version: m.version })
    if (!vm) return next(e)
    m.bandRequestId = e.requestId
    const actions = {
      resume: () => void doResume($, m, 1).then(t => $.ui.toast(t)),
      open: (tab?: number) => void openPane($, m, tab),
      dismiss: () => void doDismiss($, m, 1, false),
      ack: (id: string) => void ack($, m, id),
    }
    if (e.surface === 'terminal') {
      const { Box, Client, Raster, Button } = $.ui.resolve(e)
      const cols = Math.max(10, e.props.bodyColumns)
      // The controls are Buttons of this tree; the Client beside them draws
      // and animates in exactly the columns that are left.
      const acts = bandActions(vm, cols)
      const actsW = actionsWidth(acts)
      const bandW = Math.max(10, cols - actsW)
      // Laid out in the columns it has; the tier (how much it says) stays the row's.
      const drawn = { ...(buildBand(w, m.theme, { columns: bandW, now, working: e.props.isWorking, version: m.version }) ?? vm), tier: vm.tier, columns: bandW }
      const press = (a: BandAction) => {
        if (a.do === 'resume') actions.resume()
        else if (a.do === 'dismiss') actions.dismiss()
        else if (a.do === 'ack') actions.ack(a.id ?? '')
        else actions.open(a.tab)
      }
      // A collapsed band has nothing on screen: no frame is blitted into it.
      const sparkOn = !e.props.isCollapsed && vm.kind === 'shipped' && vm.motion && w.run.shippedAt !== undefined && now - w.run.shippedAt < SHIP_SPARK_MS
      if (sparkOn) playSpark($, m, cols)
      return (
        <Box flexDirection="column" width={cols}>
          {sparkOn ? <Raster key="spark" columns={cols} rows={2} cells={encodeCells(sparkFrame(cols, 2, 0, 18, arcRamp(m.theme, 24)), cols, 2)} /> : null}
          <Box flexDirection="row" width={cols}>
            <Box width={bandW} flexShrink={0} overflow="hidden">
              <Client key="band" module="./ui/band/Band.tsx" props={drawn} width={bandW} />
            </Box>
            {acts.length ? (
              <Box flexDirection="row" columnGap={1} marginLeft={1} flexShrink={0}>
                {acts.map(a => (
                  <Button key={a.key} label={a.label} plain {...(a.hotkey ? { hotkey: a.hotkey } : {})} {...(a.color ? { color: a.color } : {})} {...(a.dim ? { dimColor: true } : {})} onPress={() => press(a)} />
                ))}
              </Box>
            ) : null}
          </Box>
        </Box>
      )
    }
    if (e.surface === 'desktop') {
      const els = $.ui.resolve(e)
      const svg = railSvg(vm)
      return (
        <els.Box flexDirection="column">
          <els.Svg source={svg.source} alt={svg.alt} height={svg.height} isInteractive />
          {vm.kind === 'resume' || vm.critical ? BandText(els, vm, actions) : null}
        </els.Box>
      )
    }
    return BandText($.ui.resolve(e), vm, actions)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { w, now } = await viewWorld($, m)
    const els = $.ui.resolve(e)
    const ctx: PaneCtx = {
      els,
      t: m.theme,
      w,
      now,
      cols: Math.max(30, e.props.bodyColumns - 2),
      fullscreen: e.viewport?.isFullscreen === true,
      surface: e.surface,
      focused: e.props.isFocused,
      loading: w.resume.scanning && w.run.lifecycle !== 'live' && w.timeline.length === 0,
      act: paneActions($, m),
    }
    if (e.surface === 'terminal') return PaneView(ctx)
    const remote = $.ui.resolve(e) as unknown as { Box: typeof els.Box; Svg?: (p: { source: string; alt: string; isInteractive?: boolean; height?: number }) => never }
    const vm = buildBand(w, m.theme, { columns: 120, now, working: false, version: m.version })
    const rail = vm ? railSvg(vm, 640) : undefined
    const flow = flowSvg(w.timeline, m.theme.stage)
    const Svg = remote.Svg
    return (
      <els.Box flexDirection="column">
        {Svg && rail ? <Svg source={rail.source} alt={rail.alt} height={rail.height} isInteractive /> : null}
        {Svg && w.ui.tab === 1 && w.timeline.length ? <Svg source={flow.source} alt={flow.alt} isInteractive /> : null}
        {PaneView(ctx)}
      </els.Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: THEME_PANE }, async ($, e) => {
    const s = await read($, settingsA)
    void s
    return ThemePreview($.ui.resolve(e), m.theme, choice => {
      void (async () => {
        await update($, settingsA, x => ({ ...x, theme: choice }))
        await saveSettings($, m)
        await refreshTheme($, m)
        $.ui.invalidate('ui.render')
      })()
    })
  })

  on('ui.message', async ($, e, next) => {
    const r = await next(e)
    const d = (e.data ?? {}) as { action?: string; id?: string; tab?: number }
    if (d.action === 'resume') $.ui.toast(await doResume($, m, 1))
    else if (d.action === 'open') await openPane($, m, typeof d.tab === 'number' ? d.tab : undefined)
    else if (d.action === 'dismiss') await doDismiss($, m, 1, false)
    else if (d.action === 'ack' && typeof d.id === 'string') await ack($, m, d.id)
    return r
  })

  on('command.run', { command: 'sp' }, async ($, e) => {
    const intent = parseSp(e.args)
    const io = makeIo($)
    const now = await $.clock.now()
    switch (intent.kind) {
      case 'open': {
        const opened = await openPane($, m, intent.tab)
        return opened.isPlaced ? {} : { text: `The pane waits for room: ${opened.reason}` }
      }
      case 'status':
        return { text: statusText(await readWorld($), now) }
      case 'ledger':
        return { text: ledgerText(await readWorld($)) }
      case 'export':
        return { text: `Wrote ${await exportRun($, m)}` }
      case 'ack': {
        const n = await ack($, m, intent.target)
        touch($, m)
        return { text: n ? `Acknowledged ${n} warning${n === 1 ? '' : 's'}.` : 'No open warning matched.' }
      }
      case 'mode': {
        await update($, settingsA, s => ({ ...s, mode: intent.mode }))
        await saveSettings($, m)
        const what =
          intent.mode === 'observe'
            ? 'records and displays only; never denies, rewrites or injects.'
            : intent.mode === 'assist'
              ? 'adds a ledger note (≤3 lines) after a compaction and before a re-dispatch of a completed task.'
              : 'assist, plus denies: a completed task re-dispatched, a second implementer, an SDD subagent with no model, source writes before brainstorming approval.'
        return { text: `Mode ${intent.mode}: ${what}` }
      }
      case 'band':
        await update($, settingsA, s => ({ ...s, band: intent.band }))
        await saveSettings($, m)
        if (intent.band !== 'off') $.ui.status(undefined)
        return { text: `Band ${intent.band}.` }
      case 'config': {
        const s = await read($, settingsA)
        if (!intent.key) return { text: configText(s) }
        if (intent.value === undefined) return { text: configText(s).split('\n').filter(l => l.startsWith(intent.key!)).join('\n') || `Unknown setting "${intent.key}".` }
        const res = applyConfig(s, intent.key, intent.value)
        if (res.settings) {
          await update($, settingsA, () => res.settings!)
          await saveSettings($, m)
          await refreshTheme($, m)
          m.poll?.cancel()
          m.poll = undefined
          await ensurePoll($, m)
        }
        return { text: res.text }
      }
      case 'reset': {
        m.poll?.cancel()
        m.poll = undefined
        m.spectating = undefined
        await update($, runA, () => ({ ...freshRun(now), lifecycle: 'armed' as const }))
        await update($, timelineA, () => [])
        await update($, skillsA, () => [])
        await update($, agentsA, () => [])
        await update($, ledgerA, () => FRESH_LEDGER)
        await update($, testsA, () => [])
        await update($, warningsA, () => [])
        await update($, uiA, () => FRESH_UI)
        await update($, demoA, () => FRESH_DEMO)
        m.lastRef = undefined
        touch($, m)
        return { text: 'Tracker state cleared for this session. Settings kept.' }
      }
      case 'resume':
        return { text: await doResume($, m, intent.n) }
      case 'dismiss': {
        const text = await doDismiss($, m, intent.n, intent.forget)
        touch($, m)
        return { text }
      }
      case 'scan': {
        if (!m.root) {
          await refreshGit(io)
          m.root = (await read($, envA)).repoRoot ?? (await safe(io.session.cwd(), ''))
        }
        await runScan($, m, true)
        const cands = visibleCandidates(await read($, resumeA))
        return {
          text: cands.length
            ? cands.map((c, i) => `${i + 1}. ${c.kind} · ${c.title}${c.total ? ` · ${c.done}/${c.total}` : ''}${c.worktree ? ` · in ${c.worktree}` : ''}\n   ${c.suggest}`).join('\n')
            : 'Nothing unfinished found in this project or its worktrees.',
        }
      }
      case 'demo': {
        m.demoTimer?.cancel()
        await update($, demoA, () => ({ active: true, startedAt: now, step: 0 }))
        m.demoTimer = $.clock.every(250, () => {
          void (async () => {
            const d = await read($, demoA)
            if (!d.active || (await $.clock.now()) - d.startedAt > DEMO_MS + 2000) {
              m.demoTimer?.cancel()
              m.demoTimer = undefined
              await update($, demoA, () => FRESH_DEMO)
            }
            $.ui.invalidate('ui.render')
          })()
        })
        await openPane($, m)
        return { text: 'Playing the 60-second demo in the band and the pane. Real tracking continues underneath; /sp reset does not affect it.' }
      }
      case 'theme':
        await safe($.ui.open({ id: THEME_PANE, title: 'Arc tokens', focus: true, closeOnEscape: true }), { isPlaced: false, reason: '' })
        return {}
      case 'diagnose': {
        const id = await safe($.session.id(), 'unknown')
        const text = diagnoseText(id)
        const answer = await safe($.ui.ask('Send that request to Claude now?', ['Send it', 'Not now']), 'Not now')
        if (answer === 'Send it') {
          void $.prompt.submit({ text: 'figure out what went wrong with superpowers in this session', asUser: true })
          return { text: `${text}\n\nSent.` }
        }
        return { text }
      }
      case 'error':
        return { text: intent.text }
    }
  })

}
