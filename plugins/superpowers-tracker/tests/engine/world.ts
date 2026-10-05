// The world beneath the plugin in tests: an in-memory file system, git
// answers, a transcript, and the engine events' bottoms. Records what the
// plugin did (toasts, suggestions, fills, notices) for assertions.

import { mock } from 'claude-code/testing'
import type { MockClock } from 'claude-code/testing'
import type { On, RenderElement } from 'claude-code'
import { ROOT } from './fixtures/superpowers'

export type Files = Record<string, string>

export type WorldOptions = {
  files?: Files
  mtimes?: Record<string, number>
  now?: number
  store?: Record<string, unknown>
  installed?: boolean
  messages?: unknown[]
  branch?: string
  worktrees?: string[]
  gitLog?: string
  toolText?: (tool: string, input: Record<string, unknown>) => { text: string; isError?: boolean }
  agentModel?: string
  onList?: (path: string) => void
  listDelayMs?: number
  unplacedReason?: string
  onRead?: (path: string) => void
}

export type Recorder = {
  clock: MockClock
  files: Files
  mtimes: Record<string, number>
  toasts: string[]
  suggested: string[]
  filled: string[]
  submitted: string[]
  notices: string[]
  status: (string | undefined)[]
  opened: string[]
  messages: unknown[]
  settle: (rounds?: number) => Promise<void>
}

const ENGINE_TREE: RenderElement = { type: 'Text', children: ['ENGINE'] }

export const world = (on: On, o: WorldOptions = {}): Recorder => {
  const now = o.now ?? 1_760_000_000_000
  const clock = mock.clock(on, { now })
  mock.store(on, o.store ?? {})
  mock.env(on, { HOME: '/home/t' })
  const files: Files = { ...(o.files ?? {}) }
  const mtimes: Record<string, number> = { ...(o.mtimes ?? {}) }
  const r: Recorder = {
    clock,
    files,
    mtimes,
    toasts: [],
    suggested: [],
    filled: [],
    submitted: [],
    notices: [],
    status: [],
    opened: [],
    messages: o.messages ?? [],
    settle: async (rounds = 12) => {
      for (let i = 0; i < rounds; i += 1) await clock.settle()
    },
  }
  const norm = (p: string) => (p.startsWith('/') ? p : `${ROOT}/${p}`).replace(/\/+$/, '')
  const isDir = (p: string) => Object.keys(files).some(f => f.startsWith(norm(p) + '/'))
  const mtimeOf = (p: string) => mtimes[norm(p)] ?? now - 60_000

  // File system.
  on('fs.read', (_$, e) => (o.onRead?.(e.path), norm(e.path) in files ? { value: files[norm(e.path)]! } : { deny: `ENOENT: ${e.path}` }))
  on('fs.exists', (_$, e) => ({ value: norm(e.path) in files || isDir(e.path) }))
  on('fs.stat', (_$, e) => {
    const p = norm(e.path)
    if (p in files) return { value: { kind: 'file' as const, size: files[p]!.length, mtimeMs: mtimeOf(p), isLink: false } }
    if (isDir(p)) return { value: { kind: 'dir' as const, size: 0, mtimeMs: mtimeOf(p), isLink: false } }
    return { deny: `ENOENT: ${e.path}` }
  })
  on('fs.list', async (_$, e) => {
    o.onList?.(e.path)
    if (o.listDelayMs) await clock.sleep(o.listDelayMs)
    const base = norm(e.path) + '/'
    const names = new Map<string, 'file' | 'dir'>()
    for (const f of Object.keys(files)) {
      if (!f.startsWith(base)) continue
      const rest = f.slice(base.length)
      const [head, ...tail] = rest.split('/')
      if (head) names.set(head, tail.length ? 'dir' : 'file')
    }
    if (names.size === 0 && !isDir(e.path)) return { deny: `ENOENT: ${e.path}` }
    return { value: [...names].map(([name, kind]) => ({ name, kind, size: kind === 'file' ? files[base + name]!.length : 0, mtimeMs: kind === 'file' ? mtimeOf(base + name) : 0, isLink: false })) }
  })
  on('fs.write', (_$, e) => {
    files[norm(e.path)] = e.text
    return { value: undefined }
  })

  // git and other processes.
  on('process.run', (_$, e) => {
    const a = e.argv.join(' ')
    const ok = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (a === 'git rev-parse --show-toplevel') return ok(`${ROOT}\n`)
    if (a === 'git rev-parse --abbrev-ref HEAD') return ok(`${o.branch ?? 'feature/retry'}\n`)
    if (a === 'git rev-parse --absolute-git-dir') return ok(`${ROOT}/.git\n`)
    if (a.startsWith('git rev-parse --path-format=absolute --git-common-dir')) return ok(`${ROOT}/.git\n`)
    if (a === 'git worktree list --porcelain') return ok([ROOT, ...(o.worktrees ?? [])].map(w => `worktree ${w}\nHEAD abc\n`).join('\n'))
    if (a.startsWith('git log')) return ok(o.gitLog ?? '')
    if (a.startsWith('kill -0 4242')) return ok('')
    return { value: { exitCode: 1, stdout: '', stderr: 'no', isStdoutTruncated: false, isStderrTruncated: false } }
  })

  // The session.
  on('settings.read', () => ({ value: o.installed ? { enabledPlugins: { 'superpowers@superpowers-marketplace': true } } : {} }))
  on('session.messages', () => ({ value: r.messages as never }))
  on('session.cwd', () => ({ value: ROOT }))
  on('session.root', () => ({ value: ROOT }))
  on('session.id', () => ({ value: 'sess-1' }))
  on('session.surfaces', () => ({ value: ['terminal' as const] }))
  on('session.usage', () => ({ value: { startedAt: now, context: { window: 200_000, tokens: 40_000, percent: 20 }, rateLimits: [], cost: { usd: 0.5 } } }))
  on('config.list', () => ({ value: [] }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))

  // UI calls.
  on('ui.toast', (_$, e) => (r.toasts.push(e.text), { value: undefined }))
  on('ui.status', (_$, e) => (r.status.push(e.text), { value: undefined }))
  on('ui.notice', (_$, e) => (e.text && r.notices.push(e.text), { value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.blit', () => ({ value: {} }))
  on('ui.open', (_$, e) => (r.opened.push(e.id), o.unplacedReason ? { value: { isPlaced: false as const, reason: o.unplacedReason } } : { value: { isPlaced: true as const } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.render', () => ENGINE_TREE)

  // Engine events' bottoms.
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('prompt.submit', (_$, e) => (r.submitted.push(e.text), { text: e.text, ...(e.context ? { context: e.context } : {}) }))
  on('prompt.suggest', (_$, e) => (r.suggested.push(e.text), { isShown: true }))
  on('prompt.fill', (_$, e) => (r.filled.push(`${e.mode}:${e.text}`), { isFilled: true }))
  on('skill.prompt', (_$, e) => ({ text: e.text }))
  on('session.compact', (_$, e) => ({ messages: e.messages }))
  on('session.append', (_$, e) => ({ message: e.message, uuid: 'u-1' }))
  on('agent.spawn', (_$, e) => ({ model: e.model ?? o.agentModel ?? 'claude-opus-5-5', agentId: `ag-${e.tool_use_id}` }))
  on('tool.call', (_$, e) => {
    const input = e as unknown as Record<string, unknown>
    const out = o.toolText?.(String(e.tool), input) ?? { text: '' }
    if ((e.tool === 'Write' || e.tool === 'Edit') && typeof input.file_path === 'string' && typeof input.content === 'string') {
      files[norm(input.file_path)] = input.content
    }
    return out.isError ? { isError: true as const, result: out.text, text: out.text } : { result: {}, text: out.text }
  })
  return r
}

/** The AbovePrompt props a terminal band gets at a width. */
export const bandProps = (bodyColumns: number, extra: { isWorking?: boolean; hasSurvey?: boolean } = {}) => ({
  hasSurvey: extra.hasSurvey ?? false,
  isWorking: extra.isWorking ?? false,
  maxRows: 12,
  bodyColumns,
  scroll: { offset: 0, bodyRows: 12 },
  view: {},
})

export const paneProps = (bodyColumns = 120) => ({
  title: 'superpowers',
  isFocused: true,
  bodyColumns,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
})

/** Every string in a drawn tree, joined. */
export const textOf = (tree: unknown): string => {
  const out: string[] = []
  const walk = (n: unknown): void => {
    if (typeof n === 'string') out.push(n)
    else if (Array.isArray(n)) n.forEach(walk)
    else if (n && typeof n === 'object') {
      const o = n as Record<string, unknown>
      if (o.props && typeof o.props === 'object') {
        const p = o.props as Record<string, unknown>
        if (typeof p.label === 'string') out.push(p.label)
        if (typeof p.text === 'string') out.push(p.text)
        if (typeof p.source === 'string' && o.type !== 'Svg') out.push(p.source)
      }
      walk(o.children)
    }
  }
  walk(tree)
  return out.join('')
}
