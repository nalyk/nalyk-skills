// The superpowers-tracker contract: every value it keeps in $.state.

export type StageId = 'brainstorm' | 'spec' | 'plan' | 'execute' | 'review' | 'finish'
export type Lifecycle = 'dormant' | 'armed' | 'resumable' | 'live' | 'shipped'
export type BrainstormPath = 'spike' | 'bounded' | 'architectural'
export type Severity = 'info' | 'warn' | 'critical'
export type Mode = 'observe' | 'assist' | 'strict'
export type BandMode = 'auto' | 'always' | 'compact' | 'off'
export type ThemeChoice = 'auto' | 'dark' | 'light' | 'daltonized' | 'ansi'
export type AutoOpen = 'never' | 'resumable' | 'live'
export type Executor = 'sdd' | 'inline'
export type Tier = 'cheap' | 'mid' | 'top' | 'unknown'
export type Role =
  | 'implementer'
  | 'task-reviewer'
  | 're-reviewer'
  | 'final-reviewer'
  | 'investigator'
  | 'analyst'
  | 'spec-reviewer'
  | 'other'

export type TaskStatus = 'pending' | 'running' | 'fixing' | 'done' | 'parked' | 'blocked'

export type TestDot = { ok: boolean; at: number }

export type TaskRow = {
  n: number
  name: string
  steps: number
  stepsDone: number
  status: TaskStatus
  fixRound: number
  breaker: boolean
  commits?: string
  startedAt?: number
  doneAt?: number
  agents: number
  tdd: TestDot[]
  implFirst: boolean
  sawTestEdit: boolean
  ledger: string[]
  brief?: string
  report?: string
  verdict?: string
}

export type FinalReview = {
  verdict: string
  critical: number
  important: number
  minor: number
  at: number
}

export type Finishing = {
  option?: 'merge' | 'pr' | 'keep' | 'discard'
  worktreeRemoved: boolean
  branchDeleted: boolean
  workspaceDeleted: boolean
  rulingsListed: boolean
  minorsListed: boolean
}

export type Run = {
  lifecycle: Lifecycle
  stage: StageId
  stageInferred: boolean
  path?: BrainstormPath
  pathInferred: boolean
  approvalSeen: boolean
  brainstormActive: boolean
  debuggingActive: boolean
  specPath?: string
  specCommitted: boolean
  planPath?: string
  planTitle?: string
  planGoal?: string
  planSpec?: string
  hasReviewFocus: boolean
  planParseError?: string
  tasks: TaskRow[]
  executor?: Executor
  workspace?: string
  currentTask?: number
  base?: string
  finalReview?: FinalReview
  finishing?: Finishing
  pulseAt: number
  shippedAt?: number
  shipSummary?: string
  startedAt: number
  lastDone?: { n: number; at: number }
  turn: number
  turnHadVerification: boolean
  debugEditPending: boolean
  boundedDesignShown: boolean
  spectator: boolean
}

export type TimelineRow = {
  at: number
  kind: 'skill' | 'agent-start' | 'agent-end' | 'compact' | 'artifact' | 'ledger' | 'test' | 'warning' | 'note'
  label: string
  stage: StageId
  agentId?: string
  ok?: boolean
  detail?: string
}

export type SkillHit = {
  skill: string
  at: number
  turn: number
  agentId?: string
  args?: string
  via: 'prompt' | 'tool' | 'read' | 'replay'
}

export type Agent = {
  id: string
  agentId?: string
  parentAgentId?: string
  description: string
  subagentType: string
  model?: string
  modelOmitted: boolean
  parentModel?: string
  tier: Tier
  role: Role
  task?: number
  status: 'running' | 'done' | 'failed'
  startedAt: number
  endedAt?: number
  verdict?: string
  summary?: string
}

export type LedgerKind =
  | 'title'
  | 'preflight'
  | 'complete'
  | 'fix-round'
  | 'minor'
  | 'parked'
  | 'task-ruling'
  | 'ruling'
  | 'final-minor'
  | 'final-fixed'
  | 'final-ruling'
  | 'final-review'
  | 'table'

export type LedgerEntry = {
  kind: LedgerKind
  task?: number
  text: string
  line: number
  commits?: string
  round?: number
  addressed?: number
  open?: number
  parked?: number
  clean?: boolean
  tests?: string
}

export type Ledger = {
  path?: string
  mtime: number
  size: number
  planRef?: string
  entries: LedgerEntry[]
  unknown: string[]
  parseError?: string
  readAt: number
}

export type TestRun = {
  at: number
  command: string
  ok: boolean
  passed?: number
  failed?: number
  task?: number
  agentId?: string
  ref: string
}

export type Warning = {
  id: string
  code: string
  sev: Severity
  text: string
  evidence: string
  at: number
  acked: boolean
}

export type Companion = {
  dir: string
  url?: string
  port?: number
  pid?: number
  alive: boolean
  stopped: boolean
  clicks: number
}

export type Env = {
  pluginVersion?: string
  installed: boolean
  bootstrap: { at: number; ok: boolean; why: string }[]
  compactions: number[]
  branch?: string
  isLinkedWorktree: boolean
  repoRoot?: string
  worktreeEvents: number
  companion?: Companion
  sessionId?: string
  context: number[]
  costUsd?: number
  debugFixes: number
  surface?: string
}

export type Candidate = {
  id: string
  kind: 'live-elsewhere' | 'mid-exec' | 'planned' | 'spec' | 'companion' | 'orphan'
  title: string
  stage: StageId
  planPath?: string
  specPath?: string
  workspace?: string
  worktree?: string
  done: number
  total: number
  current?: number
  fixRound?: number
  rulings: number
  mtime: number
  executor?: Executor
  suggest: string
  resumeCmd?: string
  url?: string
  dim: boolean
}

export type ResumeState = {
  candidates: Candidate[]
  dismissed: string[]
  scannedAt: number
  scanning: boolean
  toasted: string[]
  lastSession?: { id: string; ago: number; skill?: string }
}

export type UiState = {
  tab: number
  selection: number
  expanded: number
  filter: string
}

export type Settings = {
  mode: Mode
  band: BandMode
  motion: boolean
  theme: ThemeChoice
  toasts: boolean
  testRunners: string[]
  testFiles: string[]
  specDir: string
  planDir: string
  pollMs: number
  windowDays: number
  autoOpenPane: AutoOpen
}

export type DemoState = {
  active: boolean
  startedAt: number
  step: number
}

// Aliases: inside `declare module 'claude-code'` a bare name resolves to the
// engine's own type first (it has a `Settings`), so the contract names these.
export type SpRun = Run
export type SpTimeline = TimelineRow[]
export type SpSkills = SkillHit[]
export type SpAgents = Agent[]
export type SpLedger = Ledger
export type SpTests = TestRun[]
export type SpWarnings = Warning[]
export type SpEnv = Env
export type SpUi = UiState
export type SpResume = ResumeState
export type SpSettings = Settings
export type SpDemo = DemoState

declare module 'claude-code' {
  interface PluginState {
    'superpowers-tracker': {
      run: SpRun
      timeline: SpTimeline
      skills: SpSkills
      agents: SpAgents
      ledger: SpLedger
      tests: SpTests
      warnings: SpWarnings
      env: SpEnv
      ui: SpUi
      resume: SpResume
      settings: SpSettings
      demo: SpDemo
    }
  }
}
