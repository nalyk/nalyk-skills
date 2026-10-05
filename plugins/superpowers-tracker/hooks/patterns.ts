// Every pattern the tracker depends on in obra/superpowers, in one place.
// Built against superpowers 6.4.2 (commit 8ca22db). A new superpowers
// release that changes a format means editing this file alone.

export const BUILT_AGAINST = '6.4.2'

export const SKILLS = [
  'using-superpowers',
  'brainstorming',
  'using-git-worktrees',
  'writing-plans',
  'subagent-driven-development',
  'executing-plans',
  'test-driven-development',
  'systematic-debugging',
  'verification-before-completion',
  'requesting-code-review',
  'receiving-code-review',
  'dispatching-parallel-agents',
  'finishing-a-development-branch',
  'writing-skills',
  'diagnosing-superpowers',
] as const
export type SkillName = (typeof SKILLS)[number]

const SKILL_SET: ReadonlySet<string> = new Set(SKILLS)

/** `superpowers:brainstorming` → `brainstorming`; undefined for a skill not ours. */
export const normalizeSkill = (raw: string | undefined): SkillName | undefined => {
  if (!raw) return undefined
  const bare = raw.trim().replace(/^\//, '').split(/\s+/)[0] ?? ''
  const name = bare.includes(':') ? bare.slice(bare.lastIndexOf(':') + 1) : bare
  return SKILL_SET.has(name) ? (name as SkillName) : undefined
}

/** A Read of a SKILL.md under a superpowers install. */
export const SKILL_FILE = /superpowers[^\s]*\/skills\/([a-z-]+)\/SKILL\.md$/

// Bootstrap: hooks/session-start wraps using-superpowers in this block.
export const BOOTSTRAP = /<EXTREMELY_IMPORTANT>\s*You have superpowers\./

// Brainstorming path announcement ("this looks bounded, so I'll ...").
export const PATH_ANNOUNCE: readonly [RegExp, 'spike' | 'bounded' | 'architectural'][] = [
  [/\b(?:this|it)\s+(?:looks|is|seems|reads)\s+(?:like\s+)?(?:an?\s+)?architectural\b/i, 'architectural'],
  [/\b(?:this|it)\s+(?:looks|is|seems|reads)\s+(?:like\s+)?(?:a\s+)?bounded\b/i, 'bounded'],
  [/\b(?:this|it)\s+(?:looks|is|seems|reads)\s+(?:like\s+)?(?:a\s+)?spike\b/i, 'spike'],
  [/\b(?:classif(?:y|ied|ying)\s+(?:this|it)\s+as|taking the)\s+(architectural|bounded|spike)\b/i, 'architectural'],
]

// Artifacts.
export const specFile = (specDir: string): RegExp =>
  new RegExp(`(^|/)${escape(specDir)}/(\\d{4}-\\d{2}-\\d{2}-[^/]+-design\\.md)$`)
export const planFile = (planDir: string): RegExp =>
  new RegExp(`(^|/)${escape(planDir)}/([^/]+\\.md)$`)
export const SUPERPOWERS_DOCS = /(^|\/)docs\/superpowers\//
export const DOC_FILE = /\.(md|mdx|txt|rst|adoc)$/i
export const SP_PRIVATE = /(^|\/)\.superpowers\//

// SDD workspace and scripts.
export const WORKSPACE_DIR = /(\/[^\s'"]*\/\.superpowers\/sdd\/[^/\s'"]+)/
export const LEDGER_NAME = 'progress.md'
export const SCRIPT = /\b(sdd-workspace|task-brief|review-package|task-start|task-done)\b/
export const SCRIPT_ARGS = /\b(sdd-workspace|task-brief|review-package|task-start|task-done)\s+("[^"]+"|'[^']+'|\S+)(?:\s+(\d+))?(?:\s+([0-9a-f]{7,40}))?/
export const OUT_TASK_BRIEF = /^wrote (.+\/task-(\d+)-brief\.md): \d+ lines$/m
export const OUT_REVIEW_PKG = /^wrote (.+\/review-([0-9a-f]+)\.\.([0-9a-f]+)\.diff): (\d+) commit\(s\)/m
export const OUT_TASK_START_BRIEF = /^brief: (.+)$/m
export const OUT_TASK_START_BASE = /^base: ([0-9a-f]{7,40})$/m
export const OUT_TASK_DONE_LEDGER = /^ledger: (.+)$/m
export const OUT_TASK_DONE_FAIL = /task-done: test command exited (\d+); Task (\d+) NOT recorded/
export const TASK_REPORT = /\/task-(\d+)-report\.md/

// Plan structure. task-brief accepts any heading depth: /^#+[ \t]+Task[ \t]+N/.
export const FENCE = /^(```|~~~)/
export const TASK_HEADING = /^#+[ \t]+Task[ \t]+(\d+)\s*[:.\-–—]?\s*(.*)$/
export const PLAN_TITLE = /^#\s+(.+?)\s*$/
export const PLAN_GOAL = /^\*\*Goal:\*\*\s*(.+)$/
export const PLAN_SPEC = /^\*\*Spec:\*\*\s*`?([^`]+?)`?\s*$/
export const REVIEW_FOCUS = /^##\s+Review Focus\b/
export const STEP_OPEN = /^\s*[-*]\s+\[ \]/
export const STEP_DONE = /^\s*[-*]\s+\[[xX]\]/

// Ledger lines (progress.md). Unknown lines are kept, never fatal.
export const L = {
  title: /^#\s*SDD ledger\s*[—–-]\s*plan:\s*(.+)$/,
  preflight: /^Pre-flight:\s*(.+)$/,
  table: /^\|.*\|\s*$/,
  complete: /^Task\s+(\d+):\s*complete\s*\((?:commits\s+)?([0-9a-f]{4,40}\.\.[0-9a-f]{4,40})?,?\s*(.*)\)\s*$/,
  fixRound: /^Task\s+(\d+):\s*fix round\s+(\d+)\s*\/\s*5\s*\((\d+)\s+addressed,\s*(\d+)\s+open(.*)\)\s*$/,
  minor: /^Task\s+(\d+):\s*minor \(deferred\):\s*(.+)$/,
  parked: /^Task\s+(\d+):\s*parked\s*[—–-]\s*(.+)$/,
  taskRuling: /^Task\s+(\d+):\s*Ruling:\s*(.+)$/,
  ruling: /^Ruling:\s*(.+)$/,
  finalMinor: /^Final:\s*minor \(deferred\):\s*(.+)$/,
  finalFixed: /^Final:\s*fixed\s+(.+)$/,
  finalRuling: /^Final:\s*Ruling:\s*(.+)$/,
  finalReview: /^Final review:\s*(.+)$/,
} as const

// Subagent roles, from the dispatch description and prompt.
export const ROLE: readonly [RegExp, 'implementer' | 'task-reviewer' | 're-reviewer' | 'final-reviewer' | 'investigator' | 'analyst' | 'spec-reviewer'][] = [
  [/^Re-review\b|scoped re-review|re-reviewing one task's fix round/i, 're-reviewer'],
  [/^Review Task\s+\d+|reviewing one task's implementation/i, 'task-reviewer'],
  [/^Implement Task\s+\d+|You are implementing Task\s+\d+/i, 'implementer'],
  [/whole[- ]branch|final (?:code )?review|Senior Code Reviewer|^Review code changes/i, 'final-reviewer'],
  [/analyst-common|skill-timeline|plan-adherence|repeated-work|quality-evidence|cost-and-time|request-conflicts|diagnosing-superpowers/i, 'analyst'],
  [/spec[- ]document[- ]reviewer|review (?:the|this) spec/i, 'spec-reviewer'],
  [/\binvestigat|independent (?:problem )?domain|in parallel\b/i, 'investigator'],
]
export const TASK_N = /\bTask\s+(\d+)\b/
export const FIX_ROUND_N = /fix round\s+(\d+)/i

// Subagent answers.
export const A = {
  status: /\*\*Status:\*\*\s*(DONE_WITH_CONCERNS|DONE|BLOCKED|NEEDS_CONTEXT)/,
  commit: /\b([0-9a-f]{7,12})\b\s+[-—:]?\s*\S/g,
  testLine: /(\d+\s*\/\s*\d+\s+passing[^\n]*|\d+\s+passed[^\n]*|\d+\s+tests?[^\n]*(?:pass|fail)[^\n]*)/i,
  reportPath: /(\S+\/task-\d+-report\.md)/,
  specOk: /✅\s*Spec compliant/,
  specBad: /❌\s*Issues found/,
  specWarn: /⚠️\s*Cannot verify/,
  quality: /\*\*Task quality:\*\*\s*\[?\s*(Approved|Needs fixes)/i,
  section: /^#{3,4}\s+(Critical|Important|Minor)\b/i,
  addressed: /[—–-]\s*ADDRESSED\b/g,
  notAddressed: /[—–-]\s*NOT ADDRESSED\b/g,
  roundVerdict: /\*\*Fix round:\*\*\s*\[?\s*(All findings addressed[^\]\n]*|Findings remain open[^\]\n]*)/i,
  readyToMerge: /\*\*Ready to merge(?:\?\*\*|:)\s*\[?\s*(Yes|No|With fixes)/i,
} as const

// Main-loop answers.
export const SUCCESS_CLAIM = /\b(all (?:the )?tests? (?:are )?pass(?:ing|es)?|tests? (?:now )?pass|(?:is|are|now) fixed|it'?s fixed|fixed it|(?:is |are |everything is )?(?:done|complete)\b|ready to merge|works now)\b/i
export const PERFORMATIVE = /^\s*(?:You'?re absolutely right|Absolutely right|Great point|Excellent (?:feedback|point|catch)|Good catch|Thanks for catching)\b/i
export const RULINGS_LIST = /Rulings I made/i
export const MINORS_LIST = /Deferred minors/i
export const DIAGNOSE_PHRASE = 'figure out what went wrong with superpowers in this session'

// Git and worktree commands seen in Bash.
export const G = {
  worktreeAdd: /\bgit\s+worktree\s+add\b/,
  worktreeRemove: /\bgit\s+worktree\s+remove\b/,
  commit: /\bgit\s+commit\b/,
  merge: /\bgit\s+merge\b/,
  push: /\bgit\s+push\b[^\n]*\s-u\b|\bgit\s+push\s+-u\b|\bgit\s+push\b/,
  prCreate: /\bgh\s+pr\s+create\b|\bglab\s+mr\s+create\b/,
  branchDelete: /\bgit\s+branch\s+-[dD]\b/,
  workspaceDelete: /\brm\s+-r?f?r?\s+[^\n]*\.superpowers\/sdd\//,
  startServer: /\bstart-server\.sh\b/,
} as const

// Visual companion.
export const BRAINSTORM_DIR = '.superpowers/brainstorm'

// Model tiers.
export const tierOf = (model: string | undefined): 'cheap' | 'mid' | 'top' | 'unknown' => {
  if (!model) return 'unknown'
  if (/haiku/i.test(model)) return 'cheap'
  if (/sonnet/i.test(model)) return 'mid'
  if (/opus|fable/i.test(model)) return 'top'
  return 'unknown'
}

// Verification commands that back a success claim in the same turn.
export const VERIFY_HINT = /\b(test|tests|pytest|jest|vitest|cargo|go test|rspec|lint|tsc|typecheck|build|check|verify|validate|curl)\b/i

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/^\/+|\/+$/g, '')
}
