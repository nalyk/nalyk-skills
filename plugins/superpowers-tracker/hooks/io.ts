// The one seam between the tracker's logic and the engine. register.tsx
// builds an Io from `$` (the validator lets `$` cross no import); every
// other module takes an Io, so it can be driven by the engine or by a test.

import type {
  Agent,
  DemoState,
  Env,
  Ledger,
  ResumeState,
  Run,
  Settings,
  SkillHit,
  TestRun,
  TimelineRow,
  UiState,
  Warning,
} from '../types'

export type Cell<T> = {
  get: () => Promise<T>
  set: (fn: (value: T) => T) => Promise<T>
}

export type Cells = {
  run: Cell<Run>
  timeline: Cell<TimelineRow[]>
  skills: Cell<SkillHit[]>
  agents: Cell<Agent[]>
  ledger: Cell<Ledger>
  tests: Cell<TestRun[]>
  warnings: Cell<Warning[]>
  env: Cell<Env>
  ui: Cell<UiState>
  resume: Cell<ResumeState>
  settings: Cell<Settings>
  demo: Cell<DemoState>
}

export type Entry = { name: string; kind: 'file' | 'dir' | 'other'; size: number; mtimeMs: number }
export type Stat = { kind: 'file' | 'dir' | 'other'; size: number; mtimeMs: number }
export type Ran = { code: number; out: string; err: string }
export type Message = {
  role: 'user' | 'assistant'
  text: string
  toolUses: { tool_use_id: string; tool: string; input: Record<string, unknown>; text?: string; isError?: true; agentId?: string; durationMs?: number }[]
}

export type Io = {
  state: Cells
  now: () => Promise<number>
  fs: {
    read: (path: string) => Promise<string>
    list: (path: string) => Promise<Entry[]>
    stat: (path: string) => Promise<Stat>
    exists: (path: string) => Promise<boolean>
    write: (path: string, text: string) => Promise<void>
  }
  run: (argv: readonly string[], cwd?: string) => Promise<Ran>
  store: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<void>
    del: (key: string) => Promise<void>
    keys: () => Promise<string[]>
  }
  ui: {
    toast: (text: string, timeoutMs?: number) => void
    status: (text: string | undefined) => void
    notice: (toolUseId: string, text: string | undefined) => void
    log: (text: string) => void
    redraw: () => void
  }
  session: {
    id: () => Promise<string>
    cwd: () => Promise<string>
    messages: () => Promise<Message[]>
    contextPercent: () => Promise<number | undefined>
    costUsd: () => Promise<number | undefined>
  }
  settingsFile: () => Promise<Record<string, unknown>>
  home: () => Promise<string | undefined>
  env: (name: 'NO_COLOR' | 'COLORTERM' | 'TERM') => Promise<string | undefined>
}

/** Swallows a failure, answering the fallback: every IO in the tracker is best effort. */
export const safe = async <T>(work: Promise<T> | (() => Promise<T>), fallback: T): Promise<T> => {
  try {
    return await (typeof work === 'function' ? work() : work)
  } catch {
    return fallback
  }
}
