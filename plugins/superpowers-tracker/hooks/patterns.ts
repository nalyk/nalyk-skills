// Every pattern the tracker depends on in obra/superpowers, in one place.
// Built against superpowers 7.0.2, and still reading what 6.4 wrote: a
// pattern that changed between them accepts both forms. A new superpowers
// release that changes a format means editing this file alone.

import { TASK_ID } from './taskid'

export const BUILT_AGAINST = '7.0.2'

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

/** `superpowers:brainstorming` → `brainstorming`; undefined for a skill not
 *  ours. Another plugin's skill of the same name (`proctor:brainstorming`)
 *  is not superpowers; a bare name is taken as ours. */
export const normalizeSkill = (raw: string | undefined): SkillName | undefined => {
  if (!raw) return undefined
  const bare = raw.trim().replace(/^\//, '').split(/\s+/)[0] ?? ''
  const cut = bare.lastIndexOf(':')
  if (cut >= 0 && !/^superpowers(?:[-@][^:]*)?$/.test(bare.slice(0, cut))) return undefined
  const name = cut >= 0 ? bare.slice(cut + 1) : bare
  return SKILL_SET.has(name) ? (name as SkillName) : undefined
}

/** A Read of a SKILL.md under a superpowers install. */
export const SKILL_FILE = /superpowers[^\s]*\/skills\/([a-z-]+)\/SKILL\.md$/

// Bootstrap: hooks/session-start wraps using-superpowers in this block.
export const BOOTSTRAP = /<EXTREMELY_IMPORTANT>\s*You have superpowers\./

// The size brainstorming announces. 6.x said "this looks bounded /
// architectural / a spike"; 7.x says it in plain words: "a quick, clear
// task", "a small change", "a project" (with a written design). The three
// path names stay: spike = quick task, bounded = small change,
// architectural = project.
// "a project" needs its article and nothing between ("a TypeScript
// project", "the project root" say nothing of size).
const SAYS = String.raw`\b(?:this|it|that)(?:'s|\s+(?:looks|is|seems|reads|feels))\s+(?:to be\s+|like\s+)?(?:really\s+|just\s+)?`
export const PATH_ANNOUNCE: readonly [RegExp, 'spike' | 'bounded' | 'architectural'][] = [
  [new RegExp(`${SAYS}(?:(?:an?\\s+)?architectural\\b|a\\s+(?:(?:real|full|proper|big(?:ger)?|larger?|whole)\\s+)?project\\b)`, 'i'), 'architectural'],
  [/\b(?:full|whole)\s+written design\b|\bI(?:'ll| will)\s+write\s+(?:it|this|that)\s+up\s+as\s+a\s+(?:full\s+)?design\b/i, 'architectural'],
  [new RegExp(`${SAYS}(?:(?:a\\s+)?bounded\\b|a\\s+small(?:ish)?\\s+change\\b)`, 'i'), 'bounded'],
  [/\ba\s+short\s+design\s+doc(?:ument)?\b/i, 'bounded'],
  [new RegExp(`${SAYS}(?:(?:a\\s+)?spike\\b|a\\s+quick,?\\s+(?:and\\s+)?clear\\s+task\\b)`, 'i'), 'spike'],
  [/\b(?:classif(?:y|ied|ying)\s+(?:this|it)\s+as|taking the)\s+(architectural|bounded|spike)\b/i, 'architectural'],
]

// The design put in front of the person (6.x: in chat; 7.x: played back, ending "what's wrong or missing").
export const DESIGN_SHOWN = /design|approach|files? touched|I'?d change|what(?:'s| is) (?:wrong|missing)|anything (?:wrong|missing)/i
// The person opting out of the questions: the skill is done and its gate goes with it.
// Only words that name the questions, or a bare "just build it" that ends
// the sentence: "just make sure…" and "no questions on that, but…" are answers.
export const OPT_OUT = /\bskip (?:the |all (?:the )?|your )?questions\b|\bno more questions\b|\bdon'?t ask (?:me )?(?:any(?: more)?|more) questions\b|\bjust (?:(?:build|do|ship|make|implement|write) it|start(?: (?:building|coding|implementing))?|go ahead)\s*(?:[.!]|$)/i

// Artifacts.
// A design doc: any Markdown file in the spec folder. The dated
// `-design.md` name is the default, and the person's own naming overrides it.
export const specFile = (specDir: string): RegExp =>
  new RegExp(`(^|/)${escape(specDir)}/([^/]+\\.md)$`)
export const planFile = (planDir: string): RegExp =>
  new RegExp(`(^|/)${escape(planDir)}/([^/]+\\.md)$`)
export const SUPERPOWERS_DOCS = /(^|\/)docs\/superpowers\//
export const DOC_FILE = /\.(md|mdx|txt|rst|adoc)$/i
export const SP_PRIVATE = /(^|\/)\.superpowers\//

// SDD workspace and scripts.
export const WORKSPACE_DIR = /(\/[^\s'"]*\/\.superpowers\/sdd\/[^/\s'"]+)/
export const LEDGER_NAME = 'progress.md'
export const SCRIPT = /\b(sdd-workspace|task-brief|review-package|task-start|task-done)\b/
// A script actually run: its name ends a path through a `scripts/` folder
// (`scripts/task-brief`, `"$SP/skills/…/scripts/task-done"`) or a folder
// held in a variable (`S=…/scripts && bash $S/review-package`), never a
// bare word in a grep or an echo, nor the tail of a URL. The second group
// is the rest of that one command, up to `;`, `&`, `|`, `)`.
export const SCRIPT_CALL = /(?:^|[\s;&|(`"'=])(?![^\s;&|()`'"=]*:\/\/)[^\s;&|()`'"=]*(?:\bscripts|\$\{?[A-Za-z_][A-Za-z0-9_]*\}?)\/(sdd-workspace|task-brief|review-package|task-start|task-done)["']?(?=\s|$|[;&|)])([^\n;&|)]*)/
export const OUT_TASK_BRIEF = /^wrote (.+\/task-([A-Za-z0-9.]+)-brief\.md): \d+ lines$/m
export const OUT_REVIEW_PKG = /^wrote (.+\/review-([0-9a-f]+)\.\.([0-9a-f]+)\.diff): (\d+) commit\(s\)/m
export const OUT_TASK_START_BRIEF = /^brief: (.+)$/m
export const OUT_TASK_START_BASE = /^base: ([0-9a-f]{7,40})$/m
export const OUT_TASK_DONE_LEDGER = /^ledger: (.+)$/m
export const OUT_TASK_DONE_FAIL = /task-done: test command exited (\d+); Task ([A-Za-z0-9.]+) NOT recorded/
export const TASK_REPORT = /\/task-([A-Za-z0-9.]+)-report\.md/

// Plan structure. task-brief accepts any heading depth: /^#+[ \t]+Task[ \t]+N/.
export const FENCE = /^(```|~~~)/
// A task heading is `Task` and an ID: a whole number, or 7.0.2's 6b, 2.1,
// A1 (taskid.ts). The digit in the ID keeps "## Task Overview" out.
export const TASK_HEADING = new RegExp(String.raw`^#+[ \t]+Task[ \t]+(${TASK_ID})\s*[:.\-–—]?\s*(.*)$`)
export const PLAN_TITLE = /^#\s+(.+?)\s*$/
export const PLAN_GOAL = /^\*\*Goal:\*\*\s*(.+)$/
export const PLAN_SPEC = /^\*\*Spec:\*\*.*?([\w@~./-]+\.md)\b/
export const REVIEW_FOCUS = /^##\s+Review Focus\b/
export const STEP_OPEN = /^\s*[-*]\s+\[ \]/
export const STEP_DONE = /^\s*[-*]\s+\[[xX]\]/

// Ledger lines (progress.md). Unknown lines are kept, never fatal.
const taskLine = (rest: string, flags = ''): RegExp => new RegExp(String.raw`^Task\s+(${TASK_ID}):\s*` + rest, flags)
export const L = {
  title: /^#\s*SDD ledger\s*[—–-]\s*plan:\s*(.+)$/,
  preflight: /^Pre-flight:\s*(.+)$/,
  table: /^\|.*\|\s*$/,
  // The scripts write `(commits a..b, review clean)`; a controller writing
  // the line by hand lists hashes, or leaves the parentheses out.
  complete: taskLine(String.raw`complete\b\s*(?:\((?:commits\s+)?([0-9a-f]{4,40}\.\.[0-9a-f]{4,40})?,?\s*(.*)\))?\s*$`),
  fixRound: taskLine(String.raw`fix round\s+(\d+)\s*\/\s*5\s*\((\d+)\s+addressed,\s*(\d+)\s+open(.*)\)\s*$`),
  minor: taskLine(String.raw`minor \(deferred\):\s*(.+)$`, 'i'),
  // Written under its task with no `Task N:` of its own.
  bareMinor: /^minor \(deferred\):\s*(.+)$/i,
  parked: taskLine(String.raw`parked\s*[—–-]\s*(.+)$`),
  taskRuling: taskLine(String.raw`Ruling:\s*(.+)$`),
  anyTask: taskLine(''),
  ruling: /^Ruling:\s*(.+)$/,
  finalMinor: /^Final:\s*minor \(deferred\):\s*(.+)$/i,
  finalFixed: /^Final:\s*fixed\s+(.+)$/,
  finalRuling: /^Final:\s*Ruling:\s*(.+)$/,
  finalReview: /^Final review:\s*(.+)$/,
} as const

// Subagent roles, from the dispatch description and prompt.
export const ROLE: readonly [RegExp, 'implementer' | 'task-reviewer' | 're-reviewer' | 'final-reviewer' | 'investigator' | 'analyst' | 'spec-reviewer'][] = [
  [/^Re-review\b|scoped re-review|re-reviewing one task's fix round/i, 're-reviewer'],
  [/^Review Task\s+[A-Za-z0-9.]*\d|reviewing one task's implementation/i, 'task-reviewer'],
  [/^Implement Task\s+[A-Za-z0-9.]*\d|You are implementing Task\s+[A-Za-z0-9.]*\d/i, 'implementer'],
  // The one fix subagent after the final review names the review; it is no reviewer.
  [/^Fix\b|^Address\b|fix (?:wave|pass|subagent)\b/i, 'implementer'],
  [/^(?:Final|Whole[- ]branch)\b.*\breview|whole[- ]branch review|final (?:code )?review of|Senior Code Reviewer|^Review code changes/i, 'final-reviewer'],
  [/analyst-common|skill-timeline|plan-adherence|repeated-work|quality-evidence|cost-and-time|request-conflicts|stumbles|similar-session|scrub(?:-audit)?\b|You are an analyst subagent|diagnosing-superpowers/i, 'analyst'],
  // 6.x: the spec document reviewer. 7.x: the builder check on the design doc.
  [/spec[- ]document[- ]reviewer|review (?:the|this) spec|builder[- ]check|You(?:'ve| have) been handed a design document/i, 'spec-reviewer'],
  [/\binvestigat|independent (?:problem )?domain|in parallel\b/i, 'investigator'],
]
export const IMPLEMENT_TASK = /^Implement Task\s+[A-Za-z0-9.]*\d|You are implementing Task\s+[A-Za-z0-9.]*\d/i
export const TASK_N = new RegExp(String.raw`\bTask\s+(${TASK_ID})`)
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
// receiving-code-review forbids these; "Good catch - <issue>. Fixed in <place>." is its own good example.
export const PERFORMATIVE = /^\s*(?:You'?re absolutely right|Absolutely right|Great point|Excellent (?:feedback|point|catch)|Thanks for (?:catching|the|pointing))\b/i
export const KEEP_BRANCH = /\bKeeping branch\b|\bKeep(?:ing)? (?:the )?branch as-is\b/i
export const BUILDER_CLEAN = /nothing important left/i
export const RULINGS_LIST = /Rulings I made/i
export const MINORS_LIST = /Deferred minors/i
export const DIAGNOSE_PHRASE = 'figure out what went wrong with superpowers in this session'

// Git and worktree commands seen in Bash.
export const G = {
  worktreeAdd: /\bgit\s+worktree\s+add\b/,
  worktreeRemove: /\bgit\s+worktree\s+remove\b/,
  commit: /\bgit\s+commit\b/,
  merge: /\bgit\s+merge(?![-\w])/,
  push: /\bgit\s+push\b[^\n]*\s-u\b|\bgit\s+push\s+-u\b|\bgit\s+push\b/,
  pushForPr: /\bgit\s+push\s+(?:-u|--set-upstream)\b|\bgit\s+push\s+\S+\s+HEAD:refs\/heads\//,
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
