import type {
  DemoState,
  Env,
  Ledger,
  ResumeState,
  Run,
  Settings,
  UiState,
} from '../types'

// Caps on every list kept in $.state; the oldest entries drop first.
export const CAP = { timeline: 500, skills: 300, agents: 200, tests: 400, warnings: 200, context: 8 } as const

export const DEFAULT_SETTINGS: Settings = {
  mode: 'observe',
  band: 'auto',
  motion: true,
  theme: 'auto',
  toasts: true,
  testRunners: [
    'npm (run )?test',
    'pnpm (run )?test',
    'yarn (run )?test',
    'bun test',
    'npx (vitest|jest)',
    'vitest',
    'jest',
    'pytest',
    'python -m pytest',
    'go test',
    'cargo test',
    'rspec',
    'bundle exec rspec',
    'mix test',
    'dotnet test',
    'phpunit',
    'vendor/bin/phpunit',
    'claude plugin test',
    'task-done',
  ],
  testFiles: [
    '(^|/)(test|tests|__tests__|spec|specs)/',
    '\\.(test|spec)\\.[cm]?[jt]sx?$',
    '_test\\.(go|py|rb|exs)$',
    '(^|/)test_[^/]+\\.py$',
    'Tests?\\.cs$',
    'Test\\.php$',
  ],
  specDir: 'docs/superpowers/specs',
  planDir: 'docs/superpowers/plans',
  pollMs: 2000,
  windowDays: 14,
  autoOpenPane: 'never',
}

export const freshRun = (now: number): Run => ({
  lifecycle: 'dormant',
  stage: 'brainstorm',
  stageInferred: true,
  pathInferred: true,
  approvalSeen: false,
  brainstormActive: false,
  debuggingActive: false,
  specCommitted: false,
  hasReviewFocus: false,
  tasks: [],
  pulseAt: 0,
  startedAt: now,
  turn: 0,
  turnHadVerification: false,
  debugEditPending: false,
  boundedDesignShown: false,
  spectator: false,
})

export const FRESH_LEDGER: Ledger = { mtime: 0, size: 0, entries: [], unknown: [], readAt: 0 }

export const FRESH_ENV: Env = {
  installed: false,
  bootstrap: [],
  compactions: [],
  isLinkedWorktree: false,
  worktreeEvents: 0,
  context: [],
  debugFixes: 0,
}

export const FRESH_RESUME: ResumeState = { candidates: [], dismissed: [], scannedAt: 0, scanning: false, toasted: [] }
export const FRESH_UI: UiState = { tab: 1, selection: 0, expanded: -1, filter: '' }
export const FRESH_DEMO: DemoState = { active: false, startedAt: 0, step: 0 }

export const capTail = <T>(list: readonly T[], cap: number): T[] =>
  list.length > cap ? list.slice(list.length - cap) : [...list]
