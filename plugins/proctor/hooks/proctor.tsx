// Proctor — Hook-enforced development discipline for Claude Code
// EARLY ACCESS: requires CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
//
// Skills teach methodology. Hooks enforce compliance. Store survives compaction.
//
// Four layers:
//   Teaching       (skills)  → prose methodology the agent reads and follows
//   Enforcement    (hooks)   → TypeScript middleware that gates or nudges
//   Infrastructure ($)       → persistent state that survives compaction
//   Observability  (tracing) → structured event log for audit trail
//
// Run /plugin-types to regenerate the declarations for your build.

import type { Register } from "claude-code";

// ─────────────────────────────────────────────────────────────────────
//  State schemas
// ─────────────────────────────────────────────────────────────────────

interface TestEvidence {
  command: string;
  timestamp: number;
  exitCode: number;
  tailOutput: string;
  /** The run reported success without proving the suite passed: its
   *  exit status was hidden by what followed it on the command line
   *  (`| tail`, `; echo`, `|| true`, `&`), or it had not finished — sent
   *  to the background, timed out into it, or interrupted. Recorded with
   *  exitCode -1, and `unproven` says which. */
  masked?: boolean;
  unproven?: string;
  /** Project the run happened in. Evidence from another project must not
   *  unblock this one's commit gate. */
  cwd: string | null;
}

interface Ruling {
  task: number;
  text: string;
  costIfWrong: string;
  phase: "preflight" | "fix-loop" | "final";
}

interface DeferredMinor {
  task: number;
  finding: string;
}

interface SDDState {
  active: boolean;
  /** Project the run belongs to. A run does not follow the store into
   *  another repo. */
  cwd: string | null;
  plan: string;
  startedAt: number;
  totalTasks: number;
  currentTask: number;
  completedTasks: number[];
  currentFixRound: number;
  totalFixRounds: number;
  totalAgents: number;
  lastImplementerModel: string | null;
  rulings: Ruling[];
  deferredMinors: DeferredMinor[];
  toolCallsThisTask: number;
  totalToolCalls: number;
  taskStartedAt: number;
  stepWarned80: boolean;
  stepWarned100: boolean;
  timeWarned80: boolean;
  timeWarned100: boolean;
  failedApproaches: string[];
  completedEvidence: Record<number, string>;
  /** Signals already absorbed, by key. The ledger is rewritten whole and
   *  repeated in the final answer, so every signal arrives more than once;
   *  a fix round or ruling must still be counted once. */
  seen?: string[];
  /** The last task completed and the run ended itself, but nothing has
   *  checked it against the finish conditions yet — the finishing skill,
   *  a finishing answer or a merge still has to. */
  pendingDoneCheck?: boolean;
}

interface SessionState {
  startedAt: number;
  skillInvoked: boolean;
  lastSkillName: string | null;
  watchdogNudgeSent: boolean;
  testCommand: string | null;
  branch: string | null;
  /** The remote's default branch (origin/HEAD), protected alongside the
   *  configured list: a repo whose trunk is `develop` or `trunk` is not
   *  left unguarded because it is not called main. */
  defaultBranch?: string | null;
  isWorktree: boolean;
  protectedBranches: string[];
  branchConsents: Record<string, boolean>;
  turnsSinceSkill: number;
  agentsSpawned: number;
  turnCount: number;
  planningMode: boolean;
  planningSkill: string | null;
  hasTestInfrastructure: boolean;
  testsAcknowledgedAbsent: boolean;
  executableDocs: boolean;
  currentPhase:
    | "idle"
    | "brainstorming"
    | "planning"
    | "implementing"
    | "reviewing"
    | "finishing";
  quietMode: boolean;
  /** Notes for the model produced after its turn ended — the watchdog,
   *  task progress, budget warnings, the done-check. `turn.complete`
   *  cannot reach the model, so they wait here for the next prompt. */
  pendingNotes?: string[];
}

interface SessionHistory {
  lastTestCommand: string | null;
  /** The last passing test command per project root. `lastTestCommand`
   *  was one value for the whole machine, so a command learned in one repo
   *  became another repo's required suite. */
  learnedTestCommands: Record<string, string>;
  projectPath: string | null;
  skillUsage: Record<string, number>;
  sessionsCount: number;
  recentRulings: Array<{ text: string; ts: number }>;
  qualityMetrics: {
    totalCommits: number;
    gateDenials: number;
    gatesPassed: number;
    fixRounds: number;
    testsRun: number;
  };
}

interface TraceEvent {
  ts: number;
  kind: string;
  detail: string;
}

// ─────────────────────────────────────────────────────────────────────
//  Store helpers — $.store is JSON-backed KV under
//  ~/.claude/plugins/store/, persisting across sessions.
//  Module-level variables are session-scoped.
// ─────────────────────────────────────────────────────────────────────

// The per-project keys carry a version suffix: their shape changed from a
// bare record to a book keyed by project root, and a stale record read as
// a book would be read as an empty one anyway. History stays unversioned —
// `loadHistory` migrates it field by field, and its counters are the one
// thing worth carrying forward.
const KEYS = {
  session: "proctor:session:v3",
  test: "proctor:test-evidence:v3",
  sdd: "proctor:sdd-state:v3",
  history: "proctor:history",
  trace: "proctor:trace:v3",
} as const;

const DEFAULT_HISTORY: SessionHistory = {
  lastTestCommand: null,
  learnedTestCommands: {},
  projectPath: null,
  skillUsage: {},
  sessionsCount: 0,
  recentRulings: [],
  qualityMetrics: {
    totalCommits: 0,
    gateDenials: 0,
    gatesPassed: 0,
    fixRounds: 0,
    testsRun: 0,
  },
};

const TRACE_CAP = 50;

async function load<T>(
  $: any,
  key: string,
  fallback: T,
): Promise<T> {
  const raw = await $.store.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** A stored counter that is usable as a number, whatever the store holds.
 *  `undefined++` wrote NaN, which JSON stores as null, which the next
 *  read had to cope with in turn. */
function counter(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * SessionHistory with every field the current code expects, merged over
 * whatever the store holds. `load` returns a stored object verbatim, so a
 * history written by an older version is missing fields added since — and
 * `hist.qualityMetrics.x++` on it throws. A throwing hook is skipped
 * entirely, which silently disabled every gate it contained, because only
 * the DENIAL paths mutate those counters outside a try.
 *
 * Every write goes through `mutateHistory`, so this is the only door.
 */
async function loadHistory($: any): Promise<SessionHistory> {
  const stored = await load<Partial<SessionHistory> | null>(
    $,
    KEYS.history,
    null,
  );
  const metrics = (stored?.qualityMetrics ?? {}) as Partial<
    SessionHistory["qualityMetrics"]
  >;

  return {
    ...structuredClone(DEFAULT_HISTORY),
    ...(stored ?? {}),
    skillUsage: { ...(stored?.skillUsage ?? {}) },
    learnedTestCommands: { ...(stored?.learnedTestCommands ?? {}) },
    recentRulings: [...(stored?.recentRulings ?? [])],
    qualityMetrics: {
      totalCommits: counter(metrics.totalCommits),
      gateDenials: counter(metrics.gateDenials),
      gatesPassed: counter(metrics.gatesPassed),
      fixRounds: counter(metrics.fixRounds),
      testsRun: counter(metrics.testsRun),
    },
  };
}

// One in-flight write per key. Every hook did load-whole-object, mutate
// one field, save-whole-object, so two hooks running for the same
// assistant message (three parallel Edits, or a Bash and a Read) both read
// the same snapshot and the second write erased the first. Lost that way:
// step-budget increments, a branch change, and planningMode being set.
//
// A queue only helps if every writer uses it: `agent.spawn`, `skill.prompt`,
// `turn.complete`, `trace` and the branch tracker each did their own raw
// load+save straight past it, so the increments they raced with were lost
// exactly as before. Nothing below calls `save` outside this chain.
const writeQueues = new Map<string, Promise<unknown>>();

/** Run `job` with no other write to `key` interleaved. */
function enqueue<T>(key: string, job: () => Promise<T>): Promise<T> {
  const queued = (writeQueues.get(key) ?? Promise.resolve()).then(job);
  // Keep the chain alive even if one link rejects.
  writeQueues.set(key, queued.catch(() => undefined));
  return queued;
}

/**
 * Read, mutate and write a key with no other mutation interleaved.
 * `fn` may mutate its argument in place (return nothing) or return a
 * replacement — `null` included. `fn(x) ?? x` read a returned null as
 * "mutated in place", so every `put…(null)` was a no-op: session.start's
 * reset of the test evidence kept the last session's run standing.
 *
 * The fallback is cloned before `fn` sees it: `load` returns the fallback
 * itself when the key is empty, so a shared constant handed in here
 * (DEFAULT_HISTORY was) gets mutated in place and every later reader
 * inherits the mutation for the life of the module.
 */
async function mutate<T>(
  $: any,
  key: string,
  fallback: T,
  fn: (value: T) => T | void,
): Promise<T> {
  return enqueue(key, async () => {
    const current = await load<T>($, key, structuredClone(fallback));
    const out = fn(current);
    const updated = (out === undefined ? current : out) as T;
    await save($, key, updated);
    return updated;
  });
}

/**
 * Counters are telemetry. A gate must never fail to fire because a number
 * could not be written, so this swallows its own errors and reads through
 * `loadHistory` rather than `load` — the two halves of the bug that let a
 * stale stored history throw inside a denial path and skip the denial.
 */
async function mutateHistory(
  $: any,
  fn: (history: SessionHistory) => void,
): Promise<void> {
  try {
    await enqueue(KEYS.history, async () => {
      const history = await loadHistory($);
      fn(history);
      await save($, KEYS.history, history);
    });
  } catch {
    // Best-effort by design — see above.
  }
}

async function save($: any, key: string, value: unknown): Promise<void> {
  await $.store.set(key, JSON.stringify(value));
}

// ─────────────────────────────────────────────────────────────────────
//  Project scoping — $.store is one global namespace shared by every
//  session on the machine. Session state, test evidence, the SDD run and
//  the trace log all belong to ONE project and ONE session; keeping them
//  under a bare key meant a second pane's session.start overwrote them,
//  taking this session's branch consents, quiet mode and test evidence
//  with it. Each is now a book keyed by project root.
// ─────────────────────────────────────────────────────────────────────

interface Shelf<T> {
  at: number;
  value: T;
}
type Book<T> = Record<string, Shelf<T>>;

const BOOK_CAP = 12;

// The repo root, not the cwd: a session that cds into a subdirectory is
// still the same project, and evidence recorded before the cd must not
// turn foreign. Re-read only when the cwd moves.
let rootCache: { cwd: string | null; root: string } | null = null;

async function projectRoot($: any): Promise<string> {
  let cwd: string | null = null;
  try {
    cwd = (await $.session.cwd()) ?? null;
  } catch {
    cwd = null;
  }

  if (rootCache && rootCache.cwd === cwd) return rootCache.root;

  let root: string | null = null;
  try {
    const res = await $.process.run(["git", "rev-parse", "--show-toplevel"]);
    const top = (res.stdout ?? "").trim();
    if (res.exitCode === 0 && top) root = top;
  } catch {
    // Not a repo, or git is unavailable — fall back to the cwd.
  }

  const resolved = root ?? cwd ?? "unknown";
  rootCache = { cwd, root: resolved };
  return resolved;
}

async function loadScoped<T>($: any, key: string, fallback: T): Promise<T> {
  const book = await load<Book<T>>($, key, {});
  const root = await projectRoot($);
  const shelf = book?.[root];
  return shelf && "value" in shelf ? shelf.value : fallback;
}

async function mutateScoped<T>(
  $: any,
  key: string,
  fallback: T,
  fn: (value: T) => T | void,
): Promise<T> {
  const root = await projectRoot($);
  let result = fallback;

  await mutate<Book<T>>($, key, {}, (book) => {
    const shelf = book[root];
    const current =
      shelf && "value" in shelf ? shelf.value : structuredClone(fallback);
    const out = fn(current);
    result = (out === undefined ? current : out) as T;
    book[root] = { at: Date.now(), value: result };

    // Projects come and go; the book must not grow forever.
    const roots = Object.keys(book);
    if (roots.length > BOOK_CAP) {
      roots
        .sort((a, b) => (book[a]?.at ?? 0) - (book[b]?.at ?? 0))
        .slice(0, roots.length - BOOK_CAP)
        .forEach((stale) => {
          delete book[stale];
        });
    }
  });

  return result;
}

async function trace(
  $: any,
  kind: string,
  detail: string,
): Promise<void> {
  try {
    await mutateScoped<TraceEvent[]>($, KEYS.trace, [], (log) => {
      log.push({ ts: Date.now(), kind, detail });
      if (log.length > TRACE_CAP) log.splice(0, log.length - TRACE_CAP);
    });
  } catch {
    // Tracing is best-effort — never block the hook chain
  }
}

// The three per-project records, always read and written through the book.
const loadSession = ($: any) =>
  loadScoped<SessionState | null>($, KEYS.session, null);

const mutateSession = ($: any, fn: (session: SessionState) => void) =>
  mutateScoped<SessionState | null>($, KEYS.session, null, (session) => {
    if (session) fn(session);
  });

const putSession = ($: any, session: SessionState | null) =>
  mutateScoped<SessionState | null>($, KEYS.session, null, () => session);

/** Hold notes for the model until the next prompt carries them. */
const queueNotes = ($: any, notes: string[]) =>
  mutateSession($, (session) => {
    session.pendingNotes = [...(session.pendingNotes ?? []), ...notes];
  });

/** Take the held notes, leaving none behind. */
async function drainNotes($: any): Promise<string[]> {
  let notes: string[] = [];
  await mutateSession($, (session) => {
    notes = session.pendingNotes ?? [];
    session.pendingNotes = [];
  });
  return notes;
}

const loadSDD = ($: any) => loadScoped<SDDState | null>($, KEYS.sdd, null);

const mutateSDD = ($: any, fn: (sdd: SDDState) => void) =>
  mutateScoped<SDDState | null>($, KEYS.sdd, null, (sdd) => {
    if (sdd) fn(sdd);
  });

const putSDD = ($: any, sdd: SDDState | null) =>
  mutateScoped<SDDState | null>($, KEYS.sdd, null, () => sdd);

const loadEvidence = ($: any) =>
  loadScoped<TestEvidence | null>($, KEYS.test, null);

const putEvidence = ($: any, evidence: TestEvidence | null) =>
  mutateScoped<TestEvidence | null>($, KEYS.test, null, () => evidence);

// ─────────────────────────────────────────────────────────────────────
//  Test command detection — language-agnostic file heuristics
// ─────────────────────────────────────────────────────────────────────

const TEST_PATTERNS: Array<{ file: string; command: string }> = [
  { file: "package.json", command: "npm test" },
  { file: "Cargo.toml", command: "cargo test" },
  { file: "pyproject.toml", command: "pytest" },
  { file: "setup.py", command: "pytest" },
  { file: "go.mod", command: "go test ./..." },
  { file: "Makefile", command: "make test" },
  { file: "Gemfile", command: "bundle exec rspec" },
  { file: "mix.exs", command: "mix test" },
  { file: "build.gradle", command: "./gradlew test" },
  { file: "build.gradle.kts", command: "./gradlew test" },
  { file: "pom.xml", command: "mvn test" },
  { file: "CMakeLists.txt", command: "ctest" },
  { file: "Rakefile", command: "rake test" },
  { file: "deno.json", command: "deno test" },
  { file: "bun.lockb", command: "bun test" },
  { file: "composer.json", command: "vendor/bin/phpunit" },
  { file: "phpunit.xml", command: "vendor/bin/phpunit" },
  { file: "phpunit.xml.dist", command: "vendor/bin/phpunit" },
  { file: "Package.swift", command: "swift test" },
  { file: "pubspec.yaml", command: "dart test" },
  { file: "build.zig", command: "zig build test" },
  { file: "project.clj", command: "lein test" },
  { file: "build.sbt", command: "sbt test" },
  { file: "stack.yaml", command: "stack test" },
  { file: "cabal.project", command: "cabal test" },
];

// Runners anchored to the START of a command segment. The old pattern
// matched a bare `pytest|jest|vitest|...` anywhere, so `pip install
// pytest`, `cat jest.config.js` or `echo pytest` were all recorded as
// passing test runs and satisfied the commit gate with nothing run.
const TEST_RUN_RE = new RegExp(
  "^(?:" +
    [
      String.raw`npm\s+(?:run\s+[\w:.-]*test[\w:.-]*|test|t)\b`,
      String.raw`(?:yarn|pnpm|bun)\s+(?:run\s+[\w:.-]*test[\w:.-]*|test)\b`,
      String.raw`npx\s+(?:jest|vitest|mocha|playwright|cypress|ava|tap)\b`,
      String.raw`(?:jest|vitest|mocha|ava|tap|cypress|playwright)\b`,
      String.raw`deno\s+test\b`,
      String.raw`(?:pytest|py\.test)\b`,
      String.raw`python[0-9.]*\s+-m\s+(?:pytest|unittest)\b`,
      String.raw`(?:poetry|uv|pipenv|hatch|rye|pdm)\s+run\s+\S*(?:pytest|test)\S*\b`,
      String.raw`tox\b`,
      String.raw`cargo\s+(?:test|nextest\s+run)\b`,
      String.raw`go\s+test\b`,
      String.raw`(?:bundle\s+exec\s+)?rspec\b`,
      String.raw`rake\s+[\w:]*test[\w:]*\b`,
      String.raw`(?:elixir\s+-S\s+)?mix\s+test\b`,
      String.raw`make\s+[\w-]*test[\w-]*\b`,
      String.raw`(?:\./)?gradlew?\s+[\w:]*test\b`,
      String.raw`gradle\w*\s+[\w:]*test\b`,
      String.raw`mvn\s+(?:-\S+\s+)*test\b`,
      String.raw`dotnet\s+test\b`,
      String.raw`swift\s+test\b`,
      String.raw`ctest\b`,
      String.raw`(?:vendor/bin/)?phpunit\b`,
      String.raw`(?:dart|flutter)\s+test\b`,
      String.raw`zig\s+build\s+test\b`,
      String.raw`(?:lein|sbt|stack|cabal)\s+test\b`,
      String.raw`nimble\s+test\b`,
      String.raw`nim\s+c\s+-r\b`,
      String.raw`busted\b`,
      String.raw`bazel\s+test\b`,
      // Node's built-in runner, and Claude Code's own plugin test runner.
      String.raw`node\s+(?:-[-\w]+(?:=\S+)?\s+)*--test\b`,
      String.raw`claude\s+plugin\s+test\b`,
    ].join("|") +
    ")",
);

/**
 * True when the command actually runs a test suite. Splits on shell
 * separators and checks each segment's FIRST word, after stripping
 * leading env assignments and wrappers, so `cd x && npm test` counts and
 * `grep -rn vitest src/` does not.
 */
function isTestRun(skel: string): boolean {
  return skel
    .split(/(?:&&|\|\||[;|&\n])+/)
    .map((seg) =>
      seg
        .trim()
        .replace(/^\(+\s*/, "")
        .replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*/, "")
        .replace(/^(?:time|command|exec|nice|stdbuf\s+\S+)\s+/, ""),
    )
    .some((seg) => TEST_RUN_RE.test(seg));
}

/**
 * True when the test run's own exit status cannot reach the tool result.
 * The result carries one status for the whole line, so in `npm test |
 * tail`, `npm test; echo done`, `npm test || true` or `npm test &` it is
 * the last command's, and a failing suite reads as a pass. `&&` after the
 * test is fine: a failure stops the chain and the line fails with it.
 */
function testStatusMasked(skel: string): boolean {
  // Redirections carry an `&` that is not a separator: 2>&1, &>, >&2, |&.
  const s = skel.replace(/\d*>&\d*|&>>?|<&\d*/g, " ").trim();
  const parts = s.split(/(&&|\|\||\|&?|[;&\n])/);

  let test = -1;
  for (let i = 0; i < parts.length; i += 2) {
    if (isTestRun(parts[i])) test = i;
  }
  if (test < 0) return false;

  const before = parts.slice(0, test).join("");
  const pipefail = /\bset\s+-[A-Za-z]*o\s+pipefail\b/.test(before);
  const errexit =
    /\bset\s+-[A-Za-z]*e[A-Za-z]*\b/.test(before) ||
    /\bset\s+-o\s+errexit\b/.test(before);

  let piped = true; // still inside the test's own pipeline
  for (let j = test + 1; j < parts.length; j += 2) {
    const sep = parts[j];
    const rest = parts.slice(j + 1).join("").trim();
    if (sep === "&") return true;
    if (sep === "||") return true;
    if (sep === "|" || sep === "|&") {
      if (piped && !pipefail) return true;
      continue;
    }
    piped = false;
    if ((sep === ";" || sep === "\n") && rest && !errexit) return true;
  }
  return false;
}

/**
 * Why a Bash result that reads as success proves nothing about the suite,
 * or null when it does prove it. The status is one for the whole line, and
 * a command that has not finished reports none of its own: Bash answers at
 * once for `run_in_background`, and moves a command that hits its timeout
 * to the background and answers then — on a slow machine, the usual fate
 * of a full suite.
 */
function unprovenBy(e: any, record: any, skel: string): string | null {
  if (e?.run_in_background === true || record?.backgroundTaskId) {
    return record?.timedOutAfterMs
      ? "it hit the Bash timeout and was moved to the background, so it had not finished"
      : "it was sent to the background, so it had not finished";
  }
  if (record?.interrupted === true) return "it was interrupted before it finished";
  if (testStatusMasked(skel)) {
    return "it was followed by a pipe, `;`, `||` or `&`, so the result reported that command's status, not the tests'";
  }
  return null;
}

/** How a status line names a test run: a hidden status is not a failure. */
function testVerdict(t: TestEvidence): string {
  if (t.masked) return "UNPROVEN (exit status hidden)";
  return t.exitCode === 0 ? "passing" : `FAILING (exit ${t.exitCode})`;
}

// Global options sit between `git` and its subcommand: `git -c k=v commit`,
// `git -C dir push`, `git --git-dir=... merge`. Matching `git\s+commit`
// alone lets every one of those slip past the gates untouched.
const GIT_OPTS = String.raw`(?:` +
  [
    String.raw`-[cC]\s+\S+\s+`,
    String.raw`--(?:git-dir|work-tree|namespace|exec-path|config-env|attr-source|super-prefix)(?:=\S+|\s+\S+)\s+`,
    String.raw`--(?:paginate|no-pager|bare|no-replace-objects|no-lazy-fetch|no-optional-locks|literal-pathspecs|glob-pathspecs|noglob-pathspecs|icase-pathspecs|no-advice)\s+`,
    String.raw`-[pP]\s+`,
  ].join("|") +
  String.raw`)*`;

// `\b` after the verb matches before a hyphen too, so `git commit-tree` and
// `git checkout-index` — plumbing that commits nothing — tripped every gate
// keyed off these. A verb is the verb only when nothing word-like follows.
const GIT_VERB_END = String.raw`(?![\w-])`;

const GIT_COMMIT_PUSH_RE = new RegExp(
  String.raw`\bgit\s+` + GIT_OPTS + String.raw`(commit|push|merge)` + GIT_VERB_END,
);

const GIT_PUSH_RE = new RegExp(
  String.raw`\bgit\s+` + GIT_OPTS + String.raw`push` + GIT_VERB_END,
);

const GIT_MERGE_RE = new RegExp(
  String.raw`\bgit\s+` + GIT_OPTS + String.raw`merge` + GIT_VERB_END,
);

// Files that normally carry no behaviour: prose, assets and licences.
// Extension alone is not enough to conclude that, so BEHAVIORAL_DOC_RE and
// the executable-doc checks below can each take a file back out of this set.
const PROSE_FILE_RE =
  /(\.(md|markdown|mdx|txt|rst|adoc|asciidoc|org|tex|svg|png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|otf)$|^(LICENSE|COPYING|NOTICE|AUTHORS|CONTRIBUTORS|CHANGELOG|CODEOWNERS)([.\-](?:md|markdown|txt|rst|adoc))?$)/i;

// Prose-shaped files that are nothing of the sort: a runbook something
// runs, instructions an agent reads as its prompt, a fixture or snapshot a
// test compares against. Editing one changes behaviour, so the commit gate
// keeps enforcing even though the extension says prose.
const BEHAVIORAL_DOC_RE = new RegExp(
  [
    // Read by tools and agents as instructions, not by people as prose.
    String.raw`(^|/)(SKILL|CLAUDE|AGENTS?|GEMINI|CURSOR|COPILOT[-_]INSTRUCTIONS|WARP|RUNBOOK|PLAYBOOK)\.[^/]*$`,
    // A plugin's own behaviour lives in these folders as markdown.
    String.raw`(^|/)(commands|agents|skills|prompts|references|templates)/`,
    // A tool's own directory: its contents are configuration.
    String.raw`(^|/)\.(claude|cursor|github|gitlab|gemini|aider|continue|devcontainer)/`,
    // Anything a test can read: fixtures, snapshots, golden files.
    String.raw`(^|/)(tests?|spec|specs|fixtures?|testdata|__tests__|__snapshots__|__fixtures__|e2e|integration|golden|snapshots?)/`,
    // Runbooks and playbooks kept together by folder.
    String.raw`(^|/)(runbooks?|playbooks?)/`,
  ].join("|"),
  "i",
);

// Prose formats a documentation toolchain executes or compiles rather than
// merely renders. Only treated as behaviour when the repo actually has such
// a toolchain — see EXECUTABLE_DOC_MARKERS.
const EXECUTABLE_DOC_EXT_RE = /\.(md|markdown|mdx|rst|adoc|asciidoc|org|qmd|ipynb)$/i;

// A repo holding one of these runs, tests or builds its prose, so a change
// to that prose can break the build the same way code can.
const EXECUTABLE_DOC_MARKERS = [
  "book.toml",
  "_quarto.yml",
  "_quarto.yaml",
  "quarto.yml",
  "runme.yaml",
  "runme.yml",
  "jupytext.toml",
  "mkdocs.yml",
  "mkdocs.yaml",
  "docusaurus.config.js",
  "docusaurus.config.ts",
];

/**
 * Paths git reports as changed, staged or not, plus untracked files.
 * Returns null when git cannot be read, so callers can tell "nothing
 * changed" apart from "could not tell".
 */
async function changedPaths($: any): Promise<string[] | null> {
  try {
    const res = await $.process.run(["git", "status", "--porcelain"]);
    if (res.exitCode !== 0) return null;
    return res.stdout
      .split("\n")
      .map((l: string) => l.slice(3).trim())
      .filter(Boolean)
      .map((p: string) => {
        // Renames read "old -> new"; the destination is what matters.
        const arrow = p.indexOf(" -> ");
        return arrow === -1 ? p : p.slice(arrow + 4);
      })
      // git quotes any path needing it (spaces, non-ASCII under
      // core.quotepath). Unquote so extension matching still works.
      .map((p: string) =>
        p.startsWith('"') && p.endsWith('"') ? p.slice(1, -1) : p,
      );
  } catch {
    return null;
  }
}

/**
 * The paths a push would send: what HEAD has that its upstream does not.
 * Returns null when there is no upstream to compare against, or git
 * cannot be read — "could not tell", which the gate treats as "enforce".
 */
async function pushedPaths($: any): Promise<string[] | null> {
  try {
    const res = await $.process.run([
      "git",
      "diff",
      "--name-only",
      "@{u}..HEAD",
    ]);
    if (res.exitCode !== 0) return null;
    return res.stdout
      .split("\n")
      .map((l: string) => l.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

/**
 * The added lines of a diff. `containsSecret` is documented as reading
 * what a change ADDS, and was handed the whole diff — so the commit that
 * removes a leaked key was the one that got blocked, with remediation
 * text telling you to remove it.
 */
function addedLines(diff: string): string {
  return diff
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .join("\n");
}

/**
 * A shell command with its heredoc bodies and quoted literals blanked out,
 * so the command regexes match commands actually being run rather than text
 * that merely mentions one. Without this, a commit whose message says
 * "make test" is recorded as passing test evidence, and editing a document
 * that quotes a git subcommand is treated as running it.
 */
function commandSkeleton(cmd: string): string {
  const text = unquotedSkeleton(cmd);
  let out = "";
  let at = 0;
  for (const [start, end] of quotedSpans(text)) {
    out += text.slice(at, start) + text.slice(start, start + 1).repeat(2);
    at = end;
  }
  return out + text.slice(at);
}

/**
 * The command with each heredoc's body removed, and nothing else.
 *
 * Two regexes used to do this. The first replaced a whole heredoc with a
 * `<<HEREDOC` token at the end of its line — which the second then read
 * as an unterminated heredoc and erased everything after it, so a
 * `git commit` or `git push` on the lines after any heredoc passed every
 * gate unseen. The first also ate the rest of the delimiter line, so
 * `cat <<EOF > src/x.ts` lost its write target.
 *
 * Now: the delimiter line is kept (`<<` itself replaced), the body up to
 * the terminator is dropped, and scanning resumes after the terminator. A
 * `<<` inside quotes on its own line is a mention, not a heredoc. With no
 * terminator, the rest of the command is body.
 */
function stripHeredocs(cmd: string): string {
  const re = /<<(-?)[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2([^\n]*)/g;
  let out = "";
  let at = 0;
  for (const m of cmd.matchAll(re)) {
    const start = m.index ?? 0;
    if (start < at) continue; // inside a body already dropped

    // Quoted on its own line — "a << b" — is text, not a heredoc.
    const lineStart = cmd.lastIndexOf("\n", start - 1) + 1;
    const before = cmd.slice(lineStart, start).replace(/\\./g, "");
    const quotes = (q: string) => before.split(q).length - 1;
    if (quotes("'") % 2 === 1 || quotes('"') % 2 === 1) continue;

    const delimiter = m[3];
    const lineEnd = start + m[0].length;
    const bodyStart = cmd.indexOf("\n", lineEnd);
    out += cmd.slice(at, start) + " HEREDOC " + m[4];
    if (bodyStart === -1) {
      at = lineEnd;
      continue;
    }
    const terminator = new RegExp(String.raw`^[ \t]*${delimiter}[ \t]*$`, "m");
    const rest = cmd.slice(bodyStart + 1);
    const end = rest.search(terminator);
    if (end === -1) {
      at = cmd.length;
      break;
    }
    const afterTerminator = rest.indexOf("\n", end);
    out += "\n";
    at = afterTerminator === -1 ? cmd.length : bodyStart + 1 + afterTerminator + 1;
  }
  return out + cmd.slice(at);
}

/**
 * The same command with heredoc bodies removed and shell `-c` payloads
 * unwrapped, but quoted literals left standing. Write-target detection
 * needs this: blanking quotes first erased the path in `> 'src/x.ts'`
 * along with the mention it was meant to erase.
 */
function unquotedSkeleton(cmd: string): string {
  let out = cmd;

  out = stripHeredocs(out);
  // A shell's -c payload is a command, not a literal: unwrap it so what
  // it runs is still seen. Only shells — `python3 -c "..."` stays opaque.
  out = out.replace(
    /\b(?:(?:ba|z|k|da)?sh|fish)\s+(?:-[a-zA-Z]+\s+)*-c\s+('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g,
    (_m: string, q: string) => ` ${q.slice(1, -1)} `,
  );

  return out;
}

/**
 * The character spans covered by quoted literals, scanned left to right.
 *
 * Two passes used to do this, every single-quoted span first and then
 * every double-quoted one. A double-quoted string holding an apostrophe
 * (`claude -p "don't commit"`) mis-paired: the apostrophe opened a span
 * that ran on to the next one, and the quoted text between them stayed
 * bare — so a command merely NAMED inside a quoted argument was read as a
 * command being run, and the git gates fired on it.
 */
function quotedSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c !== "'" && c !== '"') continue;
    let j = i + 1;
    for (; j < text.length; j++) {
      if (c === '"' && text[j] === "\\") {
        j++;
        continue;
      }
      if (text[j] === c) break;
    }
    // An unclosed quote runs to the end of the command.
    spans.push([i, Math.min(j + 1, text.length)]);
    i = j;
  }
  return spans;
}

const GIT_COMMIT_RE = new RegExp(
  String.raw`\bgit\s+` + GIT_OPTS + String.raw`commit` + GIT_VERB_END,
);

const GIT_BRANCH_SWITCH_RE = new RegExp(
  String.raw`\bgit\s+` + GIT_OPTS + String.raw`(checkout|switch)` + GIT_VERB_END,
);

// Commands that stage as they go: `git add -A && git commit`, or
// `git commit -am`. The hook runs before any of it, so at scan time the
// index does not yet hold what is about to be committed.
const GIT_STAGING_RE = new RegExp(
  String.raw`\bgit\s+` +
    GIT_OPTS +
    String.raw`(?:add|stage)\b|\bgit\s+` +
    GIT_OPTS +
    String.raw`commit\b[^\n;&|]*(?:\s-[a-zA-Z]*a[a-zA-Z]*\b|\s--(?:all|include|only)\b)`,
);

// Untracked files read per scan, so a large working tree cannot stall a
// commit while the gate reads it.
/**
 * A path glob as a RegExp, built in one pass. A chain of .replace() calls
 * lets a later pass rewrite regex syntax an earlier one emitted: the `?`
 * rule corrupted the non-capturing group the double-star rule had just
 * produced, so a declared pattern silently matched nothing.
 *
 * A single star stays inside one segment, a double star followed by a
 * slash spans any number of directories, and a trailing double star takes
 * the rest of the path.
 */
function globToRegExp(glob: string): RegExp {
  let out = "";

  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];

    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          out += "(?:.*/)?";
        } else {
          out += ".*";
        }
      } else {
        out += "[^/]*";
      }
    } else if (c === "?") {
      out += "[^/]";
    } else if (".+^${}()|[]\\/".includes(c)) {
      out += "\\" + c;
    } else {
      out += c;
    }
  }

  return new RegExp("^" + out + "$", "i");
}

/**
 * A design document, which planning mode allows writing. Matched against
 * the BASENAME: matching the whole path meant one ancestor directory
 * named design/, plan/, spec/, proposal/ or rfc/ exempted every file in
 * the repo and switched the planning hard-gate off wholesale.
 */
function isDesignDoc(path: string): boolean {
  const base = path.split("/").pop() ?? path;

  // A prose extension is a design doc outright.
  if (/\.(md|markdown|mdx|rst|adoc|txt)$/i.test(base)) return true;

  // Any other extension is code or data, whatever the name says —
  // `Plan.tsx` and `api-spec.go` are implementation files.
  if (/\.[A-Za-z0-9]+$/.test(base)) return false;

  // Extensionless, so judge by name: DESIGN, rfc-0001, SPEC.
  return /\b(design|plan|spec|proposal|rfc)\b/i.test(base);
}

/**
 * The branch HEAD is on right now. The gate used to trust the branch
 * cached at session start, which a `git checkout main && git merge feat`
 * in one command line has not updated yet — and which was never updated
 * at all while the post-hook that maintained it was unreachable (S25).
 * Falls back to the cached value when git cannot be read.
 */
async function currentBranch($: any, cached: string | null): Promise<string | null> {
  try {
    const res = await $.process.run(["git", "branch", "--show-current"]);
    const live = (res.stdout ?? "").trim();
    return live || cached;
  } catch {
    return cached;
  }
}

/**
 * A tool.call result reports failure through `isError` and carries its
 * output as text. It has no exitCode, stdout or stderr — those belong to
 * `$.process.run`, which is a different shape. Reading them here recorded
 * every failing test run as a pass (`exitCode ?? 0`), left the failure
 * output empty, and made the `result.exitCode === 0` trackers unreachable,
 * so a branch switch was never noticed and commits were never counted.
 *
 * A numeric exitCode is still honoured if a future build supplies one.
 */
function toolFailed(result: any): boolean {
  if (typeof result?.exitCode === "number") return result.exitCode !== 0;
  return result?.isError === true;
}

function toolOutput(result: any): string {
  if (typeof result?.stdout === "string" || typeof result?.stderr === "string") {
    return `${result.stdout ?? ""}${result.stderr ?? ""}`;
  }
  return String(result?.text ?? result?.result ?? "");
}

// Shell forms that write a file: a redirection, an in-place edit, a tee.
// A path may be quoted, so the alternatives accept a quoted literal —
// `> 'src/x.ts'` is a write to src/x.ts, and matching against a skeleton
// with the quotes blanked out saw no path at all.
const WRITE_PATH = String.raw`'[^']+'|"[^"]+"|[\w./~@+=-]+`;

const SHELL_WRITE_RE = new RegExp(
  String.raw`>>?\s*(?!&)(` +
    WRITE_PATH +
    String.raw`)|\b(?:sed|perl|ruby)\s+(?:-\S+\s+)*-i\S*\s+(?:-\S+\s+)*(?:'[^']*'|"[^"]*"|\S+)\s+(` +
    WRITE_PATH +
    String.raw`)|\btee\s+(?:-\S+\s+)*(` +
    WRITE_PATH +
    String.raw`)`,
  "g",
);

// A redirection to one of these writes nothing a planning gate cares
// about; `ls > /dev/null` was being denied as an implementation write.
const DEV_SINK_RE = /^\/dev\/(?:null|stdout|stderr|tty|fd\/\d+)$/;

/**
 * Every file the command writes.
 *
 * Three bugs lived in the single-match version this replaces: `tee` is the
 * third capture group and only the first two were read; a quoted path was
 * erased before the match; and `String.match` without /g returned one
 * target, so `echo a > notes.md && echo b > src/x.ts` was judged entirely
 * by notes.md. A write named inside a quoted string is still only a
 * mention — the operator itself has to be outside the quotes.
 */
function shellWriteTargets(cmd: string): string[] {
  const text = unquotedSkeleton(cmd);
  const spans = quotedSpans(text);
  const mention = (at: number) => spans.some(([a, b]) => at > a && at < b);

  const targets: string[] = [];
  for (const m of text.matchAll(SHELL_WRITE_RE)) {
    if (m.index !== undefined && mention(m.index)) continue;
    const path = (m[1] ?? m[2] ?? m[3] ?? "")
      .replace(/^['"]|['"]$/g, "")
      .trim();
    if (!path || DEV_SINK_RE.test(path)) continue;
    targets.push(path);
  }
  return targets;
}

/**
 * The untracked files a command line would stage, as pathspecs: "all" for
 * `git add -A|.|-u`, a list for named paths, and null when the line stages
 * no untracked file at all (`git commit -a` takes tracked changes only).
 *
 * Scanning every untracked file instead denied a commit over a key in a
 * stray log the line never touched.
 */
function stagedPathspecs(skel: string): string[] | "all" | null {
  const add = new RegExp(
    String.raw`\bgit\s+` + GIT_OPTS + String.raw`(?:add|stage)` + GIT_VERB_END + String.raw`([^;&|\n]*)`,
    "g",
  );
  const specs: string[] = [];
  let staging = false;
  for (const m of skel.matchAll(add)) {
    staging = true;
    for (const arg of (m[1] ?? "").trim().split(/\s+/).filter(Boolean)) {
      if (/^(?:-A|--all|-u|--update|--|\.)$/.test(arg)) return "all";
      if (arg.startsWith("-")) continue;
      specs.push(arg.replace(/^['"]|['"]$/g, ""));
    }
  }
  if (staging) return specs.length > 0 ? specs : "all";

  // No `git add`: a commit's own pathspecs, or none for `-a`.
  const commit = new RegExp(
    String.raw`\bgit\s+` + GIT_OPTS + String.raw`commit` + GIT_VERB_END + String.raw`([^;&|\n]*)`,
  ).exec(skel);
  if (!commit) return null;
  const args = (commit[1] ?? "").trim().split(/\s+/).filter(Boolean);
  const paths: string[] = [];
  let all = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (/^-[a-zA-Z]*a[a-zA-Z]*$/.test(a) || a === "--all") all = true;
    if (/^(?:-m|--message|-c|-C|--reuse-message|--reedit-message|--author|--date|--file|-F)$/.test(a)) {
      i++;
      continue;
    }
    if (a.startsWith("-")) continue;
    paths.push(a.replace(/^['"]|['"]$/g, ""));
  }
  if (paths.length > 0) return paths;
  return all ? null : "all";
}

const MAX_UNTRACKED_SCAN = 50;

const GIT_DESTRUCTIVE_RE = new RegExp(
  String.raw`\bgit\s+` +
    GIT_OPTS +
    String.raw`(?:(commit|push|merge|rebase|force-push)\b|reset\s+--hard\b|(?:checkout|restore)\s+(?:--\s+)?[.*]|checkout\s+--\s)`,
);

/**
 * The branch a destructive git command in this line will run on, when the
 * line switches branch first: `git checkout main && git merge feat`. The
 * gate runs before the line does, when git still reports the branch it
 * started on — so without this, one line walked onto a protected branch
 * and merged there unchecked. The last switch before the destructive
 * command wins; a path checkout (`checkout main -- file`) is not a switch.
 */
function lineSwitchTarget(skel: string): string | null {
  const at = skel.search(GIT_DESTRUCTIVE_RE);
  if (at <= 0) return null;
  const switchRe = new RegExp(
    String.raw`\bgit\s+` + GIT_OPTS + String.raw`(?:checkout|switch)` + GIT_VERB_END + String.raw`([^;&|\n]*)`,
    "g",
  );
  let target: string | null = null;
  for (const m of skel.slice(0, at).matchAll(switchRe)) {
    const args = (m[1] ?? "").trim().split(/\s+/).filter(Boolean);
    if (args.includes("--")) continue;
    const named = args.findIndex((a) => /^-[bBcC]$/.test(a) || a === "--orphan");
    const name = named >= 0 ? args[named + 1] : args.find((a) => !a.startsWith("-"));
    if (name) target = name;
  }
  return target;
}

// Destructive non-git bash commands — soft warning
const DESTRUCTIVE_BASH_RE =
  /(?:rm\s+(?:-[^\s]*r[^\s]*\s|--recursive\s)|chmod\s+(?:-R\s+)?777\s|curl\s[^|]*\|\s*(?:sudo\s+)?(?:bash|sh|zsh)|wget\s[^|]*\|\s*(?:sudo\s+)?(?:bash|sh|zsh)|dd\s+if=|mkfs\.|>\s*\/dev\/sd)/;

// Secret/credential patterns — hard gate on git commit
// Values that are obviously not a real credential, so an unquoted
// assignment carrying one is not treated as a leak.
const SECRET_PLACEHOLDER_RE =
  /^(?:[*x.]{3,}|<[^>]*>|\$\{?[A-Za-z_]|\{\{|%[A-Za-z_]|your[-_]?|changeme|example|placeholder|redacted|dummy|sample|test|fake|none|null|true|false)/i;

// A value that reads a secret rather than being one: `process.env.X`,
// `os.environ["X"]`, `getenv(...)`, `config.token`. Any dotted identifier
// or call is code, not a credential.
const SECRET_REFERENCE_RE = /^[A-Za-z_$][\w$]*(?:\.[\w$]+|\[|\()/;

const SECRET_PATTERNS: RegExp[] = [
  // AWS long-lived, temporary (ASIA) and the other documented prefixes.
  /(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}/,
  // OpenAI legacy and project keys. `+` is in the lead-in class because
  // this runs against diff output, where every added line starts with one.
  /(?:^|[\s'"=:+])sk-[a-zA-Z0-9]{20,}/m,
  /(?:^|[\s'"=:+])sk-proj-[a-zA-Z0-9_-]{20,}/m,
  /gh[pousr]_[a-zA-Z0-9]{36}/,
  /github_pat_[a-zA-Z0-9_]{22,}/,
  /glpat-[a-zA-Z0-9\-_]{20,}/,
  /xox[abprs]-[a-zA-Z0-9-]{10,}/,
  /-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+|ENCRYPTED\s+|PGP\s+)?PRIVATE\s+KEY/,
  // Quoted assignments.
  /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/i,
  /(?:api[_-]?key|apikey|secret[_-]?key|auth[_-]?token)\s*[:=]\s*['"][^'"]{12,}['"]/i,
];

// Unquoted assignments — the shape a committed `.env` has, which the
// quoted patterns above could never match. Checked separately so the
// value can be tested against SECRET_PLACEHOLDER_RE first.
const BARE_SECRET_ASSIGN_RE =
  /(?:^|[\s+])(?:[A-Za-z_][A-Za-z0-9_]*_)?(?:password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?key|auth[_-]?token|token|credential)s?\s*[:=]\s*([^\s'"#]{8,})/gim;

/**
 * True when the added lines of a diff carry something credential-shaped.
 * Kept as a function so the unquoted-assignment case can discount
 * placeholders without that logic living inside a regex.
 */
function containsSecret(text: string): RegExp | null {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(text)) return pattern;
  }

  BARE_SECRET_ASSIGN_RE.lastIndex = 0;
  for (const m of text.matchAll(BARE_SECRET_ASSIGN_RE)) {
    const value = m[1];
    if (SECRET_PLACEHOLDER_RE.test(value)) continue;
    if (SECRET_REFERENCE_RE.test(value)) continue;
    return BARE_SECRET_ASSIGN_RE;
  }

  return null;
}

// Skill → lifecycle phase mapping
const SKILL_PHASE_MAP: Record<string, SessionState["currentPhase"]> = {
  brainstorming: "brainstorming",
  "proctor:brainstorming": "brainstorming",
  "writing-plans": "planning",
  "proctor:writing-plans": "planning",
  "test-driven-development": "implementing",
  "proctor:test-driven-development": "implementing",
  "subagent-driven-development": "implementing",
  "proctor:subagent-driven-development": "implementing",
  "executing-plans": "implementing",
  "proctor:executing-plans": "implementing",
  "systematic-debugging": "implementing",
  "proctor:systematic-debugging": "implementing",
  "requesting-code-review": "reviewing",
  "proctor:requesting-code-review": "reviewing",
  "receiving-code-review": "reviewing",
  "proctor:receiving-code-review": "reviewing",
  "finishing-a-development-branch": "finishing",
  "proctor:finishing-a-development-branch": "finishing",
};

// Planning-mode skills — these block implementation
const PLANNING_SKILLS = new Set([
  "brainstorming",
  "proctor:brainstorming",
  "writing-plans",
  "proctor:writing-plans",
]);

// Skills that end planning mode (implementation skills)
const IMPLEMENTATION_SKILLS = new Set([
  "test-driven-development",
  "proctor:test-driven-development",
  "subagent-driven-development",
  "proctor:subagent-driven-development",
  "executing-plans",
  "proctor:executing-plans",
  "systematic-debugging",
  "proctor:systematic-debugging",
]);

// ─────────────────────────────────────────────────────────────────────
//  SDD signal detection
// ─────────────────────────────────────────────────────────────────────

// An announcement that a run is starting, not any later mention of the
// skill: matching the bare name restarted a finished run the moment the
// final summary said "the subagent-driven-development run is done".
const SDD_START_RE =
  /\b(?:using|starting|started|start|beginning|begin|running|launching|resuming|executing)\s+(?:the\s+)?(?:proctor:)?(?:subagent[- ]driven[- ]development|executing[- ]plans)\b|\bsdd\s+session\s+(?:start|begin)/i;

// Invoking one of these starts a tracked run. The skills never ask the
// controller to announce the run, and it works through the whole plan in
// one turn — so waiting for the turn's answer meant a real run was never
// tracked at all.
const SDD_SKILLS = new Set([
  "subagent-driven-development",
  "proctor:subagent-driven-development",
  "executing-plans",
  "proctor:executing-plans",
]);

const FINISHING_SKILLS = new Set([
  "finishing-a-development-branch",
  "proctor:finishing-a-development-branch",
]);

// The ledger the SDD and inline skills keep (`progress.md`). Its lines are
// where the run reports itself — task completions, fix rounds, rulings,
// deferred minors — and they are written mid-turn, as they happen.
const LEDGER_PATH_RE = /(^|\/)(?:progress|ledger)[^/]*\.(?:md|markdown|txt)$/i;

// `Plan: docs/plans/x.md — 6 tasks`, the ledger's first line.
const PLAN_HEADER_RE =
  /\bPlan:\s*[`"']?([^\s`"']+\.md)[`"']?(?:[^\n]*?\b(\d+)\s+tasks?\b)?/i;

const TASK_ADDED_RE = /\bTask\s+(\d+)\s*:\s*added\b/gi;

// A plan's task headings, as writing-plans lays them out.
const PLAN_TASK_HEADING_RE = /^#{1,6}\s*Task\s+(\d+)\b/gim;

const TASK_COMPLETE_RE =
  /Task\s+(\d+)\s*(?::|\u2014|\u2013|-|\s)\s*(?:is\s+)?(?:complete|completed|done|finished)\b/gi;

const FIX_ROUND_RE =
  /Task\s+(\d+)\s*(?::|\u2014|\u2013|-|\s)\s*fix[\s-]*round\s*(\d+)/gi;

// The separator the skills actually instruct is an EM DASH
// (`Ruling: <what> — <why> — <cost if wrong>`); the parser only split on
// ASCII `--`, so group 1 swallowed the whole line and every ruling was
// stored with `costIfWrong: "unknown"`. Segments are now split after the
// match, which also fixes the two-part form putting the cost in a group
// nothing read.
// A model writing the ruling line types whatever dash it has to hand:
// the skills show an em dash, real runs use `-` as often as not.
const RULING_SEPARATOR_RE = /\s+(?:--|-|\u2014|\u2013)\s+/;
const RULING_RE = /^.*?\bRuling:\s*(.+?)\s*$/gim;
const RULING_COST_RE = /^cost\s+if\s+wrong:\s*(.+)$/i;

const MINOR_DEFERRED_RE = /\bminor\s*\(deferred\):\s*(.+)/gi;

/**
 * Every match of a sticky pattern, with its lastIndex reset first. The
 * SDD signals used `String.match()` on non-global patterns, so only the
 * FIRST `Task N: complete`, fix round, ruling or deferred minor in a turn
 * was ever recorded — completedTasks then trailed forever and the
 * done-check could never pass.
 */
function allMatches(re: RegExp, text: string): RegExpMatchArray[] {
  re.lastIndex = 0;
  return [...text.matchAll(re)];
}

function newSDD(root: string, plan: string, totalTasks: number): SDDState {
  return {
    active: true,
    cwd: root,
    plan,
    startedAt: Date.now(),
    totalTasks,
    currentTask: 1,
    completedTasks: [],
    currentFixRound: 0,
    totalFixRounds: 0,
    totalAgents: 0,
    lastImplementerModel: null,
    rulings: [],
    deferredMinors: [],
    toolCallsThisTask: 0,
    totalToolCalls: 0,
    taskStartedAt: Date.now(),
    stepWarned80: false,
    stepWarned100: false,
    timeWarned80: false,
    timeWarned100: false,
    failedApproaches: [],
    completedEvidence: {},
    seen: [],
    pendingDoneCheck: false,
  };
}

interface Absorbed {
  notes: string[];
  events: Array<[string, string]>;
  fixRounds: number;
  rulings: string[];
  changed: boolean;
}

/**
 * Take in the SDD signals a piece of text carries — task completions, fix
 * rounds, rulings, deferred minors, scope changes, the plan header — and
 * return what the model should be told and what to trace. Pure: it only
 * mutates `sdd`, so a caller can run it inside the store's write queue and
 * no concurrent step count is lost.
 *
 * The same text arrives more than once (the ledger is rewritten whole, the
 * final answer repeats it), so every signal is keyed and counted once.
 */
function absorbSignals(
  sdd: SDDState,
  text: string,
  cfg: { stepBudget: number; fixRoundCap: number },
): Absorbed {
  const out: Absorbed = { notes: [], events: [], fixRounds: 0, rulings: [], changed: false };
  if (!sdd.active || !text) return out;
  let finishedNow = false;

  if (!Array.isArray(sdd.seen)) sdd.seen = [];
  const seen = new Set(sdd.seen);
  const first = (key: string) => {
    if (seen.has(key)) return false;
    seen.add(key);
    sdd.seen!.push(key);
    out.changed = true;
    return true;
  };

  // ── The plan header and scope changes ──────────────────────────────
  const header = text.match(PLAN_HEADER_RE);
  if (header) {
    if (sdd.plan === "unknown" && header[1]) {
      sdd.plan = header[1];
      out.changed = true;
    }
    const total = header[2] ? parseInt(header[2], 10) : 0;
    if (total > sdd.totalTasks) {
      out.events.push(["sdd-scope-update", `${sdd.totalTasks} → ${total}`]);
      sdd.totalTasks = total;
      out.changed = true;
    }
  }
  for (const m of allMatches(TASK_ADDED_RE, text)) {
    const added = parseInt(m[1], 10);
    if (added > sdd.totalTasks) {
      out.events.push(["sdd-scope-expand", `new total=${added}`]);
      out.notes.push(`Proctor: SDD scope expanded to ${added} tasks.`);
      sdd.totalTasks = added;
      out.changed = true;
    }
  }

  // ── Task completions ───────────────────────────────────────────────
  function absorbCompletion(completeMatch: RegExpMatchArray) {
    const taskNum = parseInt(completeMatch[1], 10);
    if (sdd.completedTasks.includes(taskNum)) return;

    sdd.completedTasks.push(taskNum);
    sdd.completedTasks.sort((a, b) => a - b);
    // Clamp: after the last task of five, `currentTask` used to read 6,
    // and that number reached the dashboard, the banner and every commit.
    sdd.currentTask =
      sdd.totalTasks > 0 ? Math.min(taskNum + 1, sdd.totalTasks) : taskNum + 1;
    sdd.currentFixRound = 0;
    sdd.toolCallsThisTask = 0;
    sdd.taskStartedAt = Date.now();
    sdd.stepWarned80 = false;
    sdd.stepWarned100 = false;
    sdd.timeWarned80 = false;
    sdd.timeWarned100 = false;
    out.changed = true;
    out.events.push(["sdd-task-complete", `task=${taskNum}`]);

    // Evidence from this completion's own line: three tasks finished in
    // one message all used to be filed with the first one's evidence.
    const line = text.slice(completeMatch.index ?? 0).split("\n")[0];
    const labelled = line.match(/(?:evidence|result|outcome|completed):\s*(.{10,150})/i);
    const bracketed = line.match(/\(([^)]{3,150})\)/);
    sdd.completedEvidence[taskNum] =
      labelled?.[1]?.trim() ?? bracketed?.[1]?.trim() ?? "marked complete";

    const allDone =
      sdd.totalTasks > 0 && sdd.completedTasks.length >= sdd.totalTasks;
    if (allDone) {
      // Every task done means the run is over — but not yet checked
      // against the finish conditions, which is what the finishing skill,
      // a finishing answer or the merge gate still does.
      sdd.active = false;
      sdd.pendingDoneCheck = true;
      out.events.push(["sdd-complete", `${sdd.totalTasks} tasks`]);
      out.notes.push(
        `Proctor: Task ${taskNum} complete — all ${sdd.totalTasks} tasks done. ` +
          `Next: run tests, then invoke finishing-a-development-branch.`,
      );
      finishedNow = true;
      return;
    }
    out.notes.push(
      `Proctor: Task ${taskNum} complete ` +
        `(${sdd.completedTasks.length}/${sdd.totalTasks || "?"}). ` +
        `Next: Task ${sdd.currentTask}. ` +
        `Budget reset — ${cfg.stepBudget} steps available.`,
    );
  }

  // ── Fix rounds — the failed approach survives compaction ──────────
  function absorbFixRound(fixMatch: RegExpMatchArray) {
    const round = parseInt(fixMatch[2], 10);
    // The task the agent named, not whatever currentTask is: an approach
    // filed under the wrong task is "DO NOT REDO" against the wrong work.
    const fixTask = parseInt(fixMatch[1], 10) || sdd.currentTask;
    if (!first(`fix:${fixTask}:${round}`)) return;

    // Another task's round is still a round, but not this task's counter.
    if (fixTask === sdd.currentTask && round > sdd.currentFixRound) {
      sdd.currentFixRound = round;
    }
    sdd.totalFixRounds++;
    out.fixRounds++;
    out.events.push(["sdd-fix-round", `task=${fixTask} round=${round}`]);

    const line = text.slice(fixMatch.index ?? 0).split("\n")[0];
    const approach = line.match(/(?:approach|tried|attempted|fix):\s*(.{10,120})/i);
    sdd.failedApproaches.push(
      `Task ${fixTask} R${round}: ${approach ? approach[1].trim() : "fix attempt failed"}`,
    );

    if (round >= cfg.fixRoundCap) {
      out.notes.push(
        `Proctor: fix-round limit reached (${round}/${cfg.fixRoundCap}). ` +
          `Decide on each open finding — skip debatable ones, ` +
          `resolve the critical ones. No more fix rounds.`,
      );
    }
  }

  // ── Rulings ────────────────────────────────────────────────────────
  function absorbRuling(rulingMatch: RegExpMatchArray) {
    const raw = (rulingMatch[1] ?? "").trim().replace(/`+$/, "").trim();
    // The skills' own template line is not a ruling.
    if (!raw || /^<[^>]*>/.test(raw)) return;
    if (!first(`ruling:${raw}`)) return;

    const segments = raw
      .split(RULING_SEPARATOR_RE)
      .map((seg) => seg.trim())
      .filter(Boolean);
    // The cost is the segment that says so, wherever it sits; the last
    // segment otherwise, when there are three or more.
    const costSegment =
      segments.find((seg) => RULING_COST_RE.test(seg)) ??
      (segments.length > 2 ? segments[segments.length - 1] : undefined);
    const costText = costSegment
      ? (costSegment.match(RULING_COST_RE)?.[1] ?? costSegment).trim()
      : "unknown";

    sdd.rulings.push({
      task: sdd.currentTask,
      text: segments[0] ?? "",
      costIfWrong: costText,
      phase:
        sdd.currentFixRound > 0
          ? "fix-loop"
          : sdd.totalTasks > 0 && sdd.completedTasks.length >= sdd.totalTasks
            ? "final"
            : "preflight",
    });
    out.rulings.push(raw);
    out.events.push(["ruling", raw]);
  }

  // ── Deferred minors — every one, once ──────────────────────────────
  function absorbMinor(minorMatch: RegExpMatchArray) {
    const finding = minorMatch[1].trim().replace(/`+$/, "").trim();
    if (!finding || /^<[^>]*>$/.test(finding)) return;
    if (!first(`minor:${finding}`)) return;
    sdd.deferredMinors.push({ task: sdd.currentTask, finding });
  }

  // Every signal, in the order the text gives them: a ruling written
  // above `Task 1: complete` belongs to Task 1, not to the task after it.
  type Signal = { at: number; kind: "complete" | "fix" | "ruling" | "minor"; m: RegExpMatchArray };
  const signals: Signal[] = [
    ...allMatches(TASK_COMPLETE_RE, text).map((m) => ({ at: m.index ?? 0, kind: "complete" as const, m })),
    ...allMatches(FIX_ROUND_RE, text).map((m) => ({ at: m.index ?? 0, kind: "fix" as const, m })),
    ...allMatches(RULING_RE, text).map((m) => ({ at: (m.index ?? 0) + m[0].indexOf("Ruling:"), kind: "ruling" as const, m })),
    ...allMatches(MINOR_DEFERRED_RE, text).map((m) => ({ at: m.index ?? 0, kind: "minor" as const, m })),
  ].sort((x, y) => x.at - y.at);

  for (const { kind, m } of signals) {
    if (finishedNow && kind !== "ruling" && kind !== "minor") continue;
    if (kind === "complete") absorbCompletion(m);
    else if (kind === "fix") absorbFixRound(m);
    else if (kind === "ruling") absorbRuling(m);
    else absorbMinor(m);
  }

  // Last, so the rulings and minors this same text carried are in it.
  if (finishedNow) {
    const aggregation = rulingAggregation(sdd);
    if (aggregation) out.notes.push(aggregation);
  }

  return out;
}

/** What still stands between an SDD run and its finish, if anything. */
function doneCheckIssues(
  sdd: SDDState,
  evidence: TestEvidence | null,
  freshnessMs: number,
  { tests = true }: { tests?: boolean } = {},
): string[] {
  const issues: string[] = [];
  if (sdd.totalTasks > 0 && sdd.completedTasks.length < sdd.totalTasks) {
    issues.push(
      `${sdd.totalTasks - sdd.completedTasks.length} tasks not marked complete`,
    );
  }
  if (sdd.currentFixRound > 0) {
    issues.push(
      `fix round ${sdd.currentFixRound} still open on Task ${sdd.currentTask}`,
    );
  }
  if (!tests) return issues;
  if (!evidence) {
    issues.push("no test evidence — run the test suite");
  } else if (evidence.exitCode !== 0) {
    issues.push(`tests ${testVerdict(evidence).toLowerCase()}`);
  } else if (Date.now() - evidence.timestamp > freshnessMs) {
    issues.push(
      `test evidence stale (${Math.round((Date.now() - evidence.timestamp) / 60_000)}m ago)`,
    );
  }
  return issues;
}

/** Every ruling and deferred minor of the run, for the final message. */
function rulingAggregation(sdd: SDDState): string | null {
  if (sdd.rulings.length === 0 && sdd.deferredMinors.length === 0) return null;
  const rulingList =
    sdd.rulings.length > 0
      ? sdd.rulings
          .map(
            (r, i) =>
              `${i + 1}. [Task ${r.task}, ${r.phase}] ${r.text}` +
              (r.costIfWrong !== "unknown" ? ` — cost: ${r.costIfWrong}` : ""),
          )
          .join("\n")
      : "none";
  const minorList =
    sdd.deferredMinors.length > 0
      ? sdd.deferredMinors.map((m) => `- [Task ${m.task}] ${m.finding}`).join("\n")
      : "none";
  return (
    `Proctor ruling aggregation — include in your final message:\n\n` +
    `RULINGS MADE (${sdd.rulings.length}):\n${rulingList}\n\n` +
    `DEFERRED MINORS (${sdd.deferredMinors.length}):\n${minorList}`
  );
}

/** The finish conditions and the run's rulings, as notes; a pass
 *  settles a run that ended itself. */
async function runDoneCheck($: any, sdd: SDDState, freshnessMs: number): Promise<string[]> {
  const out: string[] = [];
  const issues = doneCheckIssues(sdd, await loadEvidence($), freshnessMs);
  if (issues.length > 0) {
    out.push(
      `Proctor SDD done-check FAILED — resolve before finishing:\n` +
        issues.map((i) => `  • ${i}`).join("\n"),
    );
    await trace($, "sdd-done-check-fail", issues.join("; "));
  } else {
    out.push("Proctor SDD done-check passed — every task complete, no fix round open, tests fresh and passing.");
    await trace($, "sdd-done-check-pass", "all conditions met");
    await mutateSDD($, (live) => {
      live.pendingDoneCheck = false;
    });
  }
  const aggregation = rulingAggregation(sdd);
  if (aggregation) out.push(aggregation);
  return out;
}

/**
 * The branches a push writes on the remote, beyond the one HEAD is on:
 * `git push origin HEAD:main`, `git push origin main`, `+x:refs/heads/main`,
 * `:main` (a deletion). Judging a push only by the branch checked out let
 * any feature branch write straight onto a protected one. `--all`,
 * `--branches` and `--mirror` write every local branch: "all".
 */
function pushTargets(skel: string): string[] | "all" {
  const re = new RegExp(
    String.raw`\bgit\s+` + GIT_OPTS + String.raw`push` + GIT_VERB_END + String.raw`([^;&|\n]*)`,
    "g",
  );
  const out: string[] = [];
  for (const m of skel.matchAll(re)) {
    const args = (m[1] ?? "").trim().split(/\s+/).filter(Boolean);
    const positional: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "--all" || a === "--mirror" || a === "--branches") return "all";
      if (/^(?:-o|--push-option|--repo|--receive-pack|--exec)$/.test(a)) {
        i++;
        continue;
      }
      if (a.startsWith("-")) continue;
      positional.push(a);
    }
    for (const spec of positional.slice(1)) {
      const bare = spec.replace(/^\+/, "");
      const dest = bare.includes(":") ? bare.slice(bare.indexOf(":") + 1) : bare;
      const name = dest.replace(/^refs\/heads\//, "");
      if (name && name !== "HEAD") out.push(name);
    }
  }
  return out;
}

/**
 * Terminal cells a string takes. `.length` counts UTF-16 units, and the
 * dashboard's ⚡ is one unit but two cells — so a line "fitted" to its box
 * was a cell too wide and wrapped into the prompt on a narrow pane.
 */
function isWideCodePoint(c: number): boolean {
  return (
    (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x231a && c <= 0x231b) ||
    (c >= 0x23e9 && c <= 0x23ec) ||
    c === 0x23f0 ||
    c === 0x23f3 ||
    (c >= 0x25fd && c <= 0x25fe) ||
    (c >= 0x2614 && c <= 0x2615) ||
    (c >= 0x2648 && c <= 0x2653) ||
    c === 0x267f ||
    c === 0x2693 ||
    c === 0x26a1 ||
    (c >= 0x26aa && c <= 0x26ab) ||
    (c >= 0x26bd && c <= 0x26be) ||
    (c >= 0x26c4 && c <= 0x26c5) ||
    c === 0x26ce ||
    c === 0x26d4 ||
    c === 0x26ea ||
    (c >= 0x26f2 && c <= 0x26f3) ||
    c === 0x26f5 ||
    c === 0x26fa ||
    c === 0x26fd ||
    c === 0x2705 ||
    (c >= 0x270a && c <= 0x270b) ||
    c === 0x2728 ||
    c === 0x274c ||
    c === 0x274e ||
    (c >= 0x2753 && c <= 0x2755) ||
    c === 0x2757 ||
    (c >= 0x2795 && c <= 0x2797) ||
    c === 0x27b0 ||
    c === 0x27bf ||
    (c >= 0x2b1b && c <= 0x2b1c) ||
    c === 0x2b50 ||
    c === 0x2b55 ||
    (c >= 0x2e80 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe4f) ||
    (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6) ||
    (c >= 0x1f300 && c <= 0x1faff) ||
    (c >= 0x20000 && c <= 0x3fffd)
  );
}

function cellWidth(text: string): number {
  let cells = 0;
  for (const ch of text) cells += isWideCodePoint(ch.codePointAt(0) ?? 0) ? 2 : 1;
  return cells;
}

/** The longest prefix of `text` that fits in `cells`. */
function fitCells(text: string, cells: number): string {
  let out = "";
  let used = 0;
  for (const ch of text) {
    const w = isWideCodePoint(ch.codePointAt(0) ?? 0) ? 2 : 1;
    if (used + w > cells) break;
    out += ch;
    used += w;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h${mins % 60}m`;
}

function buildSDDInjection(
  sdd: SDDState,
  stepBudget: number,
  timeBudgetMs: number = 0,
  evidence: TestEvidence | null = null,
): string {
  const completed = sdd.completedTasks;
  const rulingsSummary = sdd.rulings
    .map(
      (r) =>
        `  Task ${r.task} [${r.phase}]: ${r.text} (cost: ${r.costIfWrong})`,
    )
    .join("\n");

  const budgetPct =
    stepBudget > 0
      ? Math.round((sdd.toolCallsThisTask / stepBudget) * 100)
      : 0;

  return [
    `[PROCTOR — SDD STATE — survives compaction]`,
    `Plan: ${sdd.plan}`,
    `Tasks: ${completed.length}/${sdd.totalTasks} complete`,
    `Completed: ${completed.length > 0 ? completed.join(", ") : "none"}`,
    `Current: Task ${sdd.currentTask}`,
    `Resume from: Task ${completed.length > 0 ? Math.max(...completed) + 1 : 1}`,
    `Fix rounds this task: ${sdd.currentFixRound} | total: ${sdd.totalFixRounds}`,
    `Step budget: ${sdd.toolCallsThisTask}/${stepBudget} (${budgetPct}%)`,
    timeBudgetMs > 0 && sdd.taskStartedAt > 0
      ? `Time budget: ${formatElapsed(Date.now() - sdd.taskStartedAt)}/${formatElapsed(timeBudgetMs)} (${Math.round(((Date.now() - sdd.taskStartedAt) / timeBudgetMs) * 100)}%)`
      : "",
    `Agents spawned: ${sdd.totalAgents}`,
    sdd.rulings.length > 0
      ? `Rulings made (${sdd.rulings.length}):\n${rulingsSummary}`
      : "Rulings: none yet",
    sdd.deferredMinors.length > 0
      ? `Deferred minors: ${sdd.deferredMinors.map((m) => `[Task ${m.task}] ${m.finding}`).join("; ")}`
      : "",
    `Last implementer model: ${sdd.lastImplementerModel ?? "none"}`,
    sdd.failedApproaches.length > 0
      ? `DO NOT REDO — these approaches failed:\n${sdd.failedApproaches.map((a, i) => `  ${i + 1}. ${a}`).join("\n")}`
      : "",
    Object.keys(sdd.completedEvidence).length > 0
      ? `Completed task evidence:\n${Object.entries(sdd.completedEvidence).map(([t, e]) => `  Task ${t}: ${e}`).join("\n")}`
      : "",
    // The failure itself, so a resumed run can diagnose without re-running.
    evidence
      ? `Last test run: ${testVerdict(evidence)} · ${Math.round((Date.now() - evidence.timestamp) / 60_000)}m ago · ${evidence.command}` +
        (evidence.exitCode > 0 && evidence.tailOutput
          ? `\nFailure output:\n${evidence.tailOutput.slice(-600).trim()}`
          : "")
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Charge one tool call to the current SDD task, or deny when the task
 * has already spent its budget. Crossing 80% (or reaching 100%) of either
 * budget returns a note for this call's result: a run works through the
 * whole plan in one turn, so a warning held for the turn's end arrived
 * after the run it was warning about.
 *
 * Every tool that counts a step checks the same ceiling — the ceiling once
 * lived in the Bash hook alone, and a task working through Write and Edit
 * counted past 100% without ever being asked to adjudicate.
 */
async function spendStep(
  $: any,
  stepBudget: number,
  timeBudgetMs: number,
): Promise<{ deny?: string; notes: string[] }> {
  const sdd = await loadSDD($);
  if (!sdd?.active) return { notes: [] };

  const overSteps = stepBudget > 0 && sdd.toolCallsThisTask >= stepBudget;
  const overTime =
    timeBudgetMs > 0 &&
    sdd.taskStartedAt > 0 &&
    Date.now() - sdd.taskStartedAt >= timeBudgetMs;

  if (!overSteps && !overTime) {
    const notes: string[] = [];
    const events: Array<[string, string]> = [];
    await mutateSDD($, (live) => {
      if (!live.active) return;
      live.toolCallsThisTask++;
      live.totalToolCalls++;

      if (stepBudget > 0) {
        const pct = Math.round((live.toolCallsThisTask / stepBudget) * 100);
        if (pct >= 100 && !live.stepWarned100) {
          live.stepWarned100 = true;
          live.stepWarned80 = true;
          notes.push(
            `Proctor: step budget exhausted for Task ${live.currentTask} ` +
              `(${live.toolCallsThisTask}/${stepBudget}). The next tool call ` +
              `is blocked. Wrap up: \`Task ${live.currentTask}: complete\`, ` +
              `or ask your human partner for \`proctor: budget extend\`.`,
          );
          events.push(["budget-exhausted", `task=${live.currentTask} steps=${live.toolCallsThisTask}`]);
        } else if (pct >= 80 && pct < 100 && !live.stepWarned80) {
          live.stepWarned80 = true;
          notes.push(
            `Proctor: step budget at ${pct}% for Task ${live.currentTask} ` +
              `(${live.toolCallsThisTask}/${stepBudget}). Start wrapping up.`,
          );
          events.push(["budget-warning", `task=${live.currentTask} pct=${pct}`]);
        }
      }

      if (timeBudgetMs > 0 && live.taskStartedAt > 0) {
        const elapsed = Date.now() - live.taskStartedAt;
        const pct = Math.round((elapsed / timeBudgetMs) * 100);
        if (pct >= 80 && pct < 100 && !live.timeWarned80) {
          live.timeWarned80 = true;
          notes.push(
            `Proctor: time budget at ${pct}% for Task ${live.currentTask} ` +
              `(${formatElapsed(elapsed)} / ${formatElapsed(timeBudgetMs)}). ` +
              `Start wrapping up.`,
          );
          events.push(["time-budget-warning", `task=${live.currentTask} pct=${pct}`]);
        }
      }
    });
    for (const [kind, detail] of events) await trace($, kind, detail);
    return { notes };
  }

  const which = overSteps
    ? `step budget (${sdd.toolCallsThisTask}/${stepBudget} tool calls)`
    : `time budget (${formatElapsed(Date.now() - sdd.taskStartedAt)}/` +
      `${formatElapsed(timeBudgetMs)})`;

  // The deny says it all; the turn-end backstop must not say it again.
  await mutateSDD($, (live) => {
    if (overSteps) live.stepWarned100 = true;
    else live.timeWarned100 = true;
  });
  await trace($, "gate-deny", `budget-exhausted: ${which}`);
  await mutateHistory($, (h: SessionHistory) => {
    h.qualityMetrics.gateDenials++;
  });

  return {
    notes: [],
    deny:
      `Proctor gate: Task ${sdd.currentTask} has exhausted its ` +
      `${which}.\n` +
      `Adjudicate before spending more:\n` +
      `  1. State what is done and what remains\n` +
      `  2. Decide: finish, split the task, or stop\n` +
      `  3. Then one of:\n` +
      `     \`Task ${sdd.currentTask}: complete\` — in the ledger or your ` +
      `answer; resets the budget and moves on\n` +
      `     \`proctor: budget extend\` — one more full budget for ` +
      `this task (your human partner says it)\n` +
      `     \`proctor: sdd stop\` — leave SDD mode entirely`,
  };
}

/** Attach notes for the model to a tool result, which carries `context`. */
function withNotes(result: any, notes: string[]): any {
  if (notes.length === 0 || !result || result.deny) return result;
  return { ...result, context: [...(result.context ?? []), ...notes] };
}

/**
 * Absorb a text's SDD signals into the stored run, inside the write
 * queue, then trace them and count them. Returns the notes for the model.
 */
async function ingestSignals(
  $: any,
  text: string,
  cfg: { stepBudget: number; fixRoundCap: number },
): Promise<string[]> {
  let absorbed: Absorbed | null = null;
  await mutateSDD($, (sdd) => {
    absorbed = absorbSignals(sdd, text, cfg);
  });
  const got = absorbed as Absorbed | null;
  if (!got) return [];

  for (const [kind, detail] of got.events) await trace($, kind, detail);
  if (got.fixRounds > 0 || got.rulings.length > 0) {
    await mutateHistory($, (h) => {
      h.qualityMetrics.fixRounds += got.fixRounds;
      for (const text of got.rulings) h.recentRulings.push({ text, ts: Date.now() });
      if (h.recentRulings.length > 20) h.recentRulings = h.recentRulings.slice(-20);
    });
  }
  if (got.events.some(([kind]) => kind === "sdd-complete")) {
    const session = await loadSession($);
    const sdd = await loadSDD($);
    if (!session?.quietMode && sdd) {
      $.ui.log(
        `Proctor: SDD run complete — ${sdd.totalTasks} tasks, ` +
          `${formatElapsed(Date.now() - sdd.startedAt)} elapsed.`,
      );
    }
  }
  return got.notes;
}

/** Start a tracked run, unless one is already under way. */
async function startSDD($: any, plan: string, totalTasks: number, why: string): Promise<boolean> {
  const current = await loadSDD($);
  if (current?.active) return false;
  const root = await projectRoot($);
  await putSDD($, newSDD(root, plan, totalTasks));
  $.ui.log("Proctor: SDD session started — state tracking active");
  await trace($, "sdd-start", `tasks=${totalTasks} plan=${plan} via=${why}`);
  return true;
}

// A skill was invoked, however it reached us. Shared so that the Read
// fallback below registers the same thing the event does: it used to set
// two of the six fields, leaving the watchdog armed, the phase behind
// and `lastSkillName` empty after a direct SKILL.md read.
async function noteSkill($: any, skillName: string): Promise<void> {
  const transitions: Array<[string, string]> = [];

  await mutateSession($, (session) => {
    session.skillInvoked = true;
    session.turnsSinceSkill = 0;
    session.watchdogNudgeSent = false;
    session.lastSkillName = skillName;

    // Planning mode transitions
    if (PLANNING_SKILLS.has(skillName)) {
      session.planningMode = true;
      session.planningSkill = skillName;
      transitions.push(["planning-mode-enter", `skill=${skillName}`]);
    } else if (IMPLEMENTATION_SKILLS.has(skillName)) {
      if (session.planningMode) {
        transitions.push(["planning-mode-exit", `skill=${skillName}`]);
      }
      session.planningMode = false;
      session.planningSkill = null;
    }

    // Phase lifecycle tracking
    const phase = SKILL_PHASE_MAP[skillName];
    if (phase && session.currentPhase !== phase) {
      transitions.push([
        "phase-transition",
        `${session.currentPhase} → ${phase} (${skillName})`,
      ]);
      session.currentPhase = phase;
    }
  });

  for (const [kind, detail] of transitions) await trace($, kind, detail);

  // Invoking the SDD or inline-execution skill is the run starting.
  if (SDD_SKILLS.has(skillName)) await startSDD($, "unknown", 0, `skill=${skillName}`);

  // Cross-session skill usage tracking
  await mutateHistory($, (hist) => {
    const name = skillName || "unknown";
    hist.skillUsage[name] = (hist.skillUsage[name] ?? 0) + 1;
  });

  await trace($, "skill-invoke", skillName);
}

/** The live state the model needs on every prompt, or null if none. */
async function statusBlock(
  $: any,
  cfg: { stepBudget: number; fixRoundCap: number; freshnessMs: number },
): Promise<string | null> {
  const lines: string[] = [];

  const sdd = await loadSDD($);
  if (sdd?.active) {
    const budgetPct =
      cfg.stepBudget > 0
        ? Math.round((sdd.toolCallsThisTask / cfg.stepBudget) * 100)
        : 0;
    lines.push(
      `SDD: Task ${sdd.currentTask}/${sdd.totalTasks} · ` +
        `${sdd.completedTasks.length} complete · ` +
        `fix round ${sdd.currentFixRound}/${cfg.fixRoundCap} · ` +
        `steps ${budgetPct}%`,
    );
  }

  const test = await loadEvidence($);
  const session = await loadSession($);

  if (test) {
    const age = Date.now() - test.timestamp;
    const fresh = age < cfg.freshnessMs;
    lines.push(
      `Tests: ${fresh ? "✓ fresh" : "✗ STALE"} · ` +
        `${testVerdict(test)} · ` +
        `${Math.round(age / 60_000)}m ago · ` +
        `cmd: ${test.command}`,
    );
    if (test.exitCode !== 0 && !test.masked && test.tailOutput) {
      const summary = test.tailOutput.substring(0, 300).trim();
      lines.push(`Failure: ${summary}`);
    }
  }

  if (session?.planningMode) {
    lines.push(
      `Planning: ON (${session.planningSkill ?? "unknown"}) — ` +
        `Write/Edit/NotebookEdit BLOCKED until design approved`,
    );
  }

  if (session && session.currentPhase !== "idle") {
    lines.push(
      `Phase: ${session.currentPhase}` +
        (session.lastSkillName ? ` (${session.lastSkillName})` : ""),
    );
  }

  if (session?.testCommand && !test && session.hasTestInfrastructure && !session.testsAcknowledgedAbsent) {
    lines.push(
      `No tests run — \`${session.testCommand}\` required before commit`,
    );
  }

  return lines.length > 0 ? `[PROCTOR]\n${lines.join("\n")}` : null;
}

// ─────────────────────────────────────────────────────────────────────
//  REGISTRATION
// ─────────────────────────────────────────────────────────────────────

export const register: Register = (on, options) => {
  // A `multiple` userConfig field arrives as a string when one value is
  // stored (and the manifest default is a plain string), as an array when
  // several are. Normalise both, plus comma/space separated input.
  const configuredBranches = (
    Array.isArray(options?.protectedBranches)
      ? (options.protectedBranches as unknown[])
      : String(options?.protectedBranches ?? "").split(/[,\s]+/)
  )
    .map((b) => String(b).trim())
    .filter(Boolean);

  const PROTECTED_BRANCHES = configuredBranches.length
    ? configuredBranches
    : ["main", "master", "production", "release"];
  // Paths the human declares behavioural whatever their extension, as
  // globs against the repo-relative path: `runbooks/**`, `*.runbook.md`.
  const EXECUTABLE_DOC_PATTERNS = (
    Array.isArray(options?.executableDocPatterns)
      ? (options.executableDocPatterns as unknown[])
      : String(options?.executableDocPatterns ?? "").split(/[,\s]+/)
  )
    .map((g) => String(g).trim())
    .filter(Boolean)
    // A glob with no slash names a file at any depth, as in .gitignore:
    // `*.runbook.md` matched only top-level files, so the same file one
    // folder down was waved through as inert prose.
    .map((g) => ({ re: globToRegExp(g), anyDepth: !g.includes("/") }));

  const declaredExecutable = (path: string) =>
    EXECUTABLE_DOC_PATTERNS.some(({ re, anyDepth }) =>
      re.test(anyDepth ? (path.split("/").pop() ?? path) : path),
    );

  /** Configured, or the remote's default branch. */
  const isProtected = (session: SessionState | null, branch: string | null) =>
    !!branch &&
    (PROTECTED_BRANCHES.includes(branch) || session?.defaultBranch === branch);

  const protectedList = (session: SessionState | null) =>
    session?.defaultBranch && !PROTECTED_BRANCHES.includes(session.defaultBranch)
      ? [...PROTECTED_BRANCHES, session.defaultBranch]
      : PROTECTED_BRANCHES;

  const SIGNAL_CFG = { stepBudget: 0, fixRoundCap: 0 };

  const TEST_FRESHNESS_MS =
    ((options?.testFreshnessMinutes as number) ?? 5) * 60_000;
  const WATCHDOG_TURN_THRESHOLD =
    (options?.watchdogTurnThreshold as number) ?? 4;
  const FIX_ROUND_CAP = (options?.fixRoundCap as number) ?? 5;
  const STEP_BUDGET_PER_TASK =
    (options?.stepBudgetPerTask as number) ?? 100;
  const TIME_BUDGET_PER_TASK_MS =
    ((options?.timeBudgetPerTaskMinutes as number) ?? 30) * 60_000;
  SIGNAL_CFG.stepBudget = STEP_BUDGET_PER_TASK;
  SIGNAL_CFG.fixRoundCap = FIX_ROUND_CAP;

  // ───────────────────────────────────────────────────────────────────
  //  1. SESSION START — detect environment, initialize state
  // ───────────────────────────────────────────────────────────────────

  on("session.start", async ($: any, e: any, next: any) => {
    let testCommand: string | null = null;

    // Try package.json scripts.test first for accuracy. A package.json
    // that parses and has no real test script is not a test suite: the
    // file fallback below used to find it again as a marker and demand an
    // `npm test` that could only fail.
    let packageWithoutTests = false;
    try {
      if (await $.fs.exists("package.json")) {
        const raw = await $.fs.read("package.json");
        const pkg = JSON.parse(raw);
        const script = pkg?.scripts?.test;
        if (typeof script === "string" && script.trim() && !/no test specified/i.test(script)) {
          testCommand = "npm test";
        } else {
          packageWithoutTests = true;
        }
      }
    } catch {
      // Unreadable or not JSON — let the marker below decide.
    }

    // Fall back to file-based detection
    if (!testCommand) {
      for (const pattern of TEST_PATTERNS) {
        if (pattern.file === "package.json" && packageWithoutTests) continue;
        if (await $.fs.exists(pattern.file)) {
          testCommand = pattern.command;
          break;
        }
      }
    }

    // Cross-session learning: use remembered test command if file
    // heuristics didn't find one
    const history = await loadHistory($);
    const root = await projectRoot($);
    if (!testCommand && history.learnedTestCommands[root]) {
      testCommand = history.learnedTestCommands[root];
    }
    await mutateHistory($, (hist) => {
      hist.projectPath = root;
      hist.sessionsCount++;
    });

    // No marker file and nothing remembered means this project has no test
    // suite to run — a docs, notes or config repo. The commit gate steps
    // aside there rather than demanding a suite that cannot exist.
    const hasTestInfrastructure = testCommand !== null;

    // Does this repo run, test or build its prose? If so, a change to a
    // .md is a change to behaviour and the commit gate keeps enforcing.
    let executableDocs = false;
    for (const marker of EXECUTABLE_DOC_MARKERS) {
      try {
        if (await $.fs.exists(marker)) {
          executableDocs = true;
          break;
        }
      } catch {
        // Unreadable path — keep looking.
      }
    }

    let branch: string | null = null;
    let isWorktree = false;
    try {
      const branchResult = await $.process.run([
        "git",
        "branch",
        "--show-current",
      ]);
      branch = branchResult.stdout.trim() || null;

      const gitDir = await $.process.run([
        "git",
        "rev-parse",
        "--git-dir",
      ]);
      const gitCommon = await $.process.run([
        "git",
        "rev-parse",
        "--git-common-dir",
      ]);

      const dirNorm = gitDir.stdout.trim();
      const commonNorm = gitCommon.stdout.trim();
      isWorktree = dirNorm !== commonNorm;
    } catch {
      // Not a git repo — gates won't fire
    }

    // The remote's default branch, whatever it is called.
    let defaultBranch: string | null = null;
    try {
      const head = await $.process.run([
        "git",
        "symbolic-ref",
        "--quiet",
        "--short",
        "refs/remotes/origin/HEAD",
      ]);
      const ref = (head.stdout ?? "").trim();
      if (head.exitCode === 0 && ref) defaultBranch = ref.replace(/^[^/]+\//, "") || null;
    } catch {
      // No remote HEAD — the configured list stands alone.
    }

    const session: SessionState = {
      startedAt: Date.now(),
      skillInvoked: false,
      lastSkillName: null,
      watchdogNudgeSent: false,
      testCommand,
      branch,
      defaultBranch,
      isWorktree,
      protectedBranches: PROTECTED_BRANCHES,
      branchConsents: {},
      turnsSinceSkill: 0,
      agentsSpawned: 0,
      turnCount: 0,
      planningMode: false,
      planningSkill: null,
      hasTestInfrastructure,
      testsAcknowledgedAbsent: false,
      executableDocs,
      currentPhase: "idle",
      quietMode: false,
      pendingNotes: [],
    };

    await putSession($, session);

    // Trace and evidence are this project's, and this session's. Both used
    // to live under a bare key, so starting a session in one pane wiped
    // the other pane's audit trail and its test evidence mid-run.
    await mutateScoped<TraceEvent[]>($, KEYS.trace, [], () => []);

    // Test evidence is session-scoped — the denial text says as much.
    // It lived in a store that outlives the session, so a run from a
    // previous session (or another project) kept satisfying the gate.
    await putEvidence($, null);

    // SDD session recovery — resume if active state survives restart.
    // The record is already scoped to this project, so a run started in
    // another repo is never in hand here to begin with.
    const existingSDD = await loadSDD($);

    if (existingSDD?.active) {
      $.ui.log(
        `Proctor: recovering SDD session — ` +
          `Task ${existingSDD.currentTask}/${existingSDD.totalTasks}, ` +
          `${existingSDD.completedTasks.length} complete, ` +
          `${formatElapsed(Date.now() - existingSDD.startedAt)} elapsed`,
      );

      // The task clock was left running across the closed session, so a
      // task resumed the next morning reported "15h0m / 30m" and blew its
      // time budget before any work happened. Restart it, and clear the
      // one-shot warnings it already spent, so the resumed task gets a
      // budget rather than an instant verdict.
      await mutateSDD($, (sdd) => {
        sdd.taskStartedAt = Date.now();
        sdd.timeWarned80 = false;
        sdd.timeWarned100 = false;
        sdd.toolCallsThisTask = 0;
        sdd.stepWarned80 = false;
        sdd.stepWarned100 = false;
      });
      await trace($, "sdd-recovery", `task=${existingSDD.currentTask}/${existingSDD.totalTasks}`);
    }

    const env: string[] = [];
    if (testCommand) env.push(`tests: ${testCommand}`);
    if (branch) env.push(`branch: ${branch}`);
    if (isWorktree) env.push("worktree");
    env.push(`protected: ${protectedList(session).join(",")}`);
    $.ui.log(`Proctor active (${env.join(" | ")})`);

    await trace($, "session-start", `branch=${branch} test=${testCommand}`);

    return next(e);
  });

  // ───────────────────────────────────────────────────────────────────
  //  2. WHAT THE MODEL KNOWS — live state, delivered where it is read
  //
  //     This used to be a `prompt.section` hook matched on a section
  //     named "context" by a key named `section`. The engine names
  //     sections by `name`, has none called "context", and caches every
  //     section for the whole session — so the block never reached the
  //     model, and could not have stayed current if it had. Now:
  //       · the status rides on each prompt, as its context
  //       · notes a turn produced wait for the next prompt, the one
  //         channel that reaches the model after a turn has ended
  //       · the SDD state is a context block of the conversation, which
  //         the engine re-reads at compaction — the part that must
  //         survive it
  // ───────────────────────────────────────────────────────────────────

  on("prompt.context", async ($: any, e: any, next: any) => {
    const result = await next(e);
    const sdd = await loadSDD($);
    if (!sdd?.active) return result;
    return {
      ...result,
      blocks: [
        ...(result.blocks ?? []).filter((b: any) => b.name !== "proctor"),
        {
          name: "proctor",
          text: buildSDDInjection(
            sdd,
            STEP_BUDGET_PER_TASK,
            TIME_BUDGET_PER_TASK_MS,
            await loadEvidence($),
          ),
        },
      ],
    };
  });

  // ───────────────────────────────────────────────────────────────────
  //  3. GIT GATES — hard enforcement on Bash tool calls
  //
  //     Three gates:
  //     a) Test evidence required before commit/push/merge
  //     b) Test freshness window (configurable, default 5 min)
  //     c) Protected branch enforcement
  //
  //     Also: step budget tracking during SDD, test run tracking,
  //     branch change tracking, cross-session test command learning.
  // ───────────────────────────────────────────────────────────────────

  on("tool.call", { tool: "Bash" }, async ($: any, e: any, next: any) => {
    const cmd: string = e.command ?? "";
    const skel = commandSkeleton(cmd);

    // ── GATE: Git commit/push requires fresh passing test evidence ──
    if (GIT_COMMIT_PUSH_RE.test(skel)) {
      const session = await loadSession($);

      // The gate exists to stop code shipping untested. Three cases are not
      // that, and enforcing against them only deadlocks the commit:
      //   1. the human said this project has no tests
      //   2. no test marker file anywhere — a docs, notes or config repo
      //   3. the change touches only prose and assets
      // Checked before the evidence itself, so a README fix is not held up
      // by evidence that went stale either.
      let steppedAside: string | null = null;

      if (session?.testsAcknowledgedAbsent) {
        steppedAside = "acknowledged: no test suite in this project";
      } else if (session && !session.hasTestInfrastructure) {
        steppedAside = "no test suite detected in this project";
      } else {
        // Inert prose: prose-shaped, and not behavioural by name, path,
        // repo toolchain or the human's own declaration.
        const isInertProse = (f: string) =>
          PROSE_FILE_RE.test(f) &&
          !BEHAVIORAL_DOC_RE.test(f) &&
          !(session?.executableDocs && EXECUTABLE_DOC_EXT_RE.test(f)) &&
          !declaredExecutable(f);

        // What "the change" is depends on the operation. A commit sends
        // the working tree; a push sends the commits the upstream lacks,
        // which `git status` says nothing about — one uncommitted README
        // edit used to make a push of untested code "prose-only". A merge
        // is neither, so it is never excused on these grounds.
        const paths = GIT_COMMIT_RE.test(skel)
          ? await changedPaths($)
          : GIT_PUSH_RE.test(skel)
            ? await pushedPaths($)
            : null;

        if (paths && paths.length > 0 && paths.every(isInertProse)) {
          steppedAside = `prose-only change (${paths.length} file${paths.length === 1 ? "" : "s"})`;
        }
      }

      if (steppedAside) {
        await trace($, "gate-skip", `git-no-tests-needed: ${steppedAside}`);
        if (!session?.quietMode) {
          $.ui.log(`Proctor: test gate stepped aside — ${steppedAside}.`);
        }
      }

      // Evidence produced in another project proves nothing about this
      // one. It used to be one global record with a cwd stamped on it,
      // compared against the cwd of the moment — so a run in repo A
      // unblocked a commit in repo B whenever either cwd was unknown, and
      // a session that cd'd into a subdirectory disowned its own run. The
      // record is now filed under the project root; another project's is
      // simply not in hand.
      const evidence = steppedAside ? null : await loadEvidence($);

      if (!evidence && !steppedAside) {
        await trace($, "gate-deny", `git-no-evidence: ${cmd.substring(0, 80)}`);
        await mutateHistory($, (h: SessionHistory) => {
          h.qualityMetrics.gateDenials++;
        });
        const testCmd = session?.testCommand ?? "the project's test suite";
        return {
          deny:
            `Proctor gate: no test evidence this session.\n` +
            `Next steps:\n` +
            `  1. Run \`${testCmd}\`\n` +
            `  2. Fix any failures\n` +
            `  3. Re-run until passing, then retry this command\n` +
            `If this project genuinely has no test suite, say ` +
            `\`proctor: no tests\` and the gate will stand down for the session.`,
        };
      }

      const age = evidence ? Date.now() - evidence.timestamp : 0;
      if (evidence && age > TEST_FRESHNESS_MS) {
        const mins = Math.round(age / 60_000);
        await trace($, "gate-deny", `git-stale-evidence: ${mins}m old`);
        await mutateHistory($, (h: SessionHistory) => {
          h.qualityMetrics.gateDenials++;
        });
        return {
          deny:
            `Proctor gate: test evidence is stale (${mins}m ago, ` +
            `limit: ${TEST_FRESHNESS_MS / 60_000}m).\n` +
            `Next steps:\n` +
            `  1. Re-run \`${evidence.command}\`\n` +
            `  2. Verify tests pass\n` +
            `  3. Retry this command immediately (within ${TEST_FRESHNESS_MS / 60_000}m)`,
        };
      }

      if (evidence?.masked) {
        await trace($, "gate-deny", "git-masked-test-status");
        await mutateHistory($, (h: SessionHistory) => {
          h.qualityMetrics.gateDenials++;
        });
        return {
          deny:
            `Proctor gate: the last test run hid its exit status.\n` +
            `\`${evidence.command}\`: ` +
            `${evidence.unproven ?? "it was followed by a pipe, `;`, `||` or `&`"}.\n` +
            `Next steps:\n` +
            `  1. Re-run the tests in the foreground, alone or redirected: ` +
            `\`cmd > log 2>&1\` (raise the Bash timeout for a slow suite)\n` +
            `  2. To keep a pipe, prefix \`set -o pipefail;\`\n` +
            `  3. Retry this command`,
        };
      }

      if (evidence && evidence.exitCode !== 0) {
        await trace($, "gate-deny", `git-failing-tests: exit ${evidence.exitCode}`);
        await mutateHistory($, (h: SessionHistory) => {
          h.qualityMetrics.gateDenials++;
        });
        return {
          deny:
            `Proctor gate: tests are failing (exit ${evidence.exitCode}).\n` +
            `Last output:\n${evidence.tailOutput}\n` +
            `Next steps:\n` +
            `  1. Diagnose failures from the output above\n` +
            `  2. Fix the root cause\n` +
            `  3. Re-run \`${evidence.command}\` until passing`,
        };
      }

      // Gate satisfied by real evidence — track it. A gate that stepped
      // aside was not satisfied, so it is not counted as passed.
      if (evidence) {
        try {
          await mutateHistory($, (h: SessionHistory) => {
            h.qualityMetrics.gatesPassed++;
          });
        } catch { /* non-critical */ }
      }
    }

    // ── GATE: an SDD run is not merged before it is done ──────────
    // The finishing skill promises this: every task marked complete and
    // no fix round open before the merge. The test half is the gate above.
    if (GIT_MERGE_RE.test(skel)) {
      const sdd = await loadSDD($);
      if (sdd?.active) {
        const issues = doneCheckIssues(sdd, null, TEST_FRESHNESS_MS, { tests: false });
        if (issues.length > 0) {
          await trace($, "gate-deny", `sdd-not-done: ${issues.join("; ")}`);
          await mutateHistory($, (h: SessionHistory) => {
            h.qualityMetrics.gateDenials++;
          });
          return {
            deny:
              `Proctor gate: the SDD run is not done — merge blocked.\n` +
              issues.map((i) => `  • ${i}`).join("\n") +
              `\nNext steps:\n` +
              `  1. Finish the open work and mark it (\`Task N: complete\` in the ledger)\n` +
              `  2. Adjudicate an open fix round with \`Ruling:\` lines, then complete the task\n` +
              `  3. OR, if the run is abandoned: \`proctor: sdd stop\``,
          };
        }
      }
    }

    // ── GATE: Planning mode also covers writes made through Bash ───
    // The gate was registered for Write/Edit/NotebookEdit only, so
    // `cat > src/x.ts <<EOF` and `sed -i` wrote implementation files
    // during a design phase while the identical Write call was blocked.
    {
      const target = shellWriteTargets(cmd).find((path) => !isDesignDoc(path));
      if (target) {
        const sess = await loadSession($);
        if (sess?.planningMode) {
          await trace($, "gate-deny", `planning-mode-bash: ${target}`);
          await mutateHistory($, (h: SessionHistory) => {
            h.qualityMetrics.gateDenials++;
          });
          return {
            deny:
              `Proctor gate: Bash write to '${target}' blocked — planning ` +
              `mode active (${sess.planningSkill ?? "design phase"}).\n` +
              `Only design docs may be written while planning.\n` +
              `Next steps:\n` +
              `  1. Finish the design\n` +
              `  2. Invoke an implementation skill, or say ` +
              `"proctor: approve design"`,
          };
        }
      }
    }

    // ── GATE: Protected branch enforcement ─────────────────────────
    if (GIT_DESTRUCTIVE_RE.test(skel)) {
      const session = await loadSession($);

      // Read the branch now rather than trusting the session's copy: the
      // same command line may have switched onto a protected branch a
      // moment ago, and the tracker that refreshed the cache was itself
      // unreachable until S25 was fixed.
      const live = await currentBranch($, session?.branch ?? null);

      if (session && live && live !== session.branch) {
        session.branch = live;
        await mutateSession($, (state) => {
          state.branch = live;
        });
      }

      // The branch the line lands on, and every branch a push writes.
      const onBranch = lineSwitchTarget(skel) ?? live;
      const pushed = GIT_PUSH_RE.test(skel) ? pushTargets(skel) : [];
      const touched = [
        onBranch,
        ...(pushed === "all" ? protectedList(session) : pushed),
      ].filter((b): b is string => !!b);
      const branch =
        touched.find((b) => isProtected(session, b) && !session?.branchConsents?.[b]) ?? null;

      if (branch) {
        await trace($, "gate-deny", `branch-protection: ${branch}`);
        await mutateHistory($, (h: SessionHistory) => {
          h.qualityMetrics.gateDenials++;
        });
        return {
          deny:
            `Proctor gate: destructive git operation blocked on ` +
            `protected branch '${branch}'.\n` +
            `Next steps:\n` +
            `  1. Create a feature branch: \`git checkout -b <name>\`\n` +
            `  2. Make your changes on the feature branch\n` +
            `  OR: ask your human partner to grant consent ` +
            `("proctor: allow ${branch}")`,
        };
      }
    }

    // ── GATE: Secret/credential detection before git commit ────────
    if (GIT_COMMIT_RE.test(skel)) {
      // Only the GATHERING is guarded. The decision used to sit inside
      // this try as well, so anything that threw after the diff was read
      // — a counter write, most of all — landed in a catch that means
      // "skip the scan", and the credential shipped. A gate whose failure
      // mode is "allow" must not be able to fail quietly.
      const chunks: string[] = [];
      let scanned = false;

      // A line that writes a file and commits it (`printf 'K=…' > .env &&
      // git add .env && git commit`) runs after this hook: the file does
      // not exist yet, so no diff or read can see it. What it will write
      // is in the line itself — scan that, the commit message aside.
      if (shellWriteTargets(cmd).length > 0) {
        // Quotes unwrapped: `echo "token=…"` writes `token=…`.
        const written = cmd.replace(/\s-m\s*(?:"(?:[^"\\]|\\.)*"|'[^']*'|\S+)/g, " ");
        chunks.push(written, written.replace(/["']/g, " "));
      }

      try {
        const cached = await $.process.run(["git", "diff", "--cached", "-U0"]);
        chunks.push(addedLines(cached.stdout ?? ""));
        // Enough in hand to judge. What the widening scan below adds is a
        // bonus; losing it must not turn the whole gate off.
        scanned = true;

        // `git add -A && git commit` is a single tool call: nothing is
        // staged yet when this runs, so the staged diff is empty and a
        // secret would sail through. Scan what is about to be staged too.
        // An empty staged diff in front of a commit means the content is
        // coming from somewhere else — `git commit <pathspec>`, or a stage
        // step later in this same command line. Scan the working tree too
        // rather than declaring the commit clean on an empty diff.
        const nothingStaged = (cached.stdout ?? "").trim() === "";

        if (GIT_STAGING_RE.test(skel) || nothingStaged) {
          const tracked = await $.process.run(["git", "diff", "HEAD", "-U0"]);
          chunks.push(addedLines(tracked.stdout ?? ""));

          const untracked = await $.process.run([
            "git",
            "ls-files",
            "--others",
            "--exclude-standard",
          ]);
          const specs = stagedPathspecs(skel);
          const staged = (f: string) =>
            specs === "all" ||
            (Array.isArray(specs) &&
              specs.some((p) => {
                const base = p.replace(/\/+$/, "");
                return f === base || f.startsWith(`${base}/`);
              }));

          const files =
            specs === null
              ? []
              : (untracked.stdout ?? "")
                  .split("\n")
                  .map((f: string) => f.trim())
                  .filter(Boolean)
                  .filter(staged)
                  .slice(0, MAX_UNTRACKED_SCAN);

          for (const f of files) {
            try {
              chunks.push(await $.fs.read(f));
            } catch {
              // Binary or unreadable — nothing to scan.
            }
          }
        }
      } catch {
        // Diff unavailable — nothing to scan, other gates still apply.
        await trace($, "secret-scan-unavailable", cmd.substring(0, 60));
      }

      const hit = scanned || chunks.length > 0 ? containsSecret(chunks.join("\n")) : null;
      if (hit) {
        await trace($, "gate-deny", `secret-detected: ${hit.source.substring(0, 30)}`);
        await mutateHistory($, (h: SessionHistory) => {
          h.qualityMetrics.gateDenials++;
        });
        return {
          deny:
            `Proctor gate: potential credential/secret detected in staged changes. ` +
            `Pattern: ${hit.source.substring(0, 40)}...\n` +
            `Next steps:\n` +
            `  1. Run \`git diff --cached\` to identify the secret\n` +
            `  2. Remove or replace with an environment variable\n` +
            `  3. Unstage the file: \`git reset HEAD <file>\`\n` +
            `  4. Re-stage clean version and retry commit`,
        };
      }
    }

    // ── SOFT: Destructive bash command awareness ──────────────────
    if (DESTRUCTIVE_BASH_RE.test(skel)) {
      const sess = await loadSession($);
      if (!sess?.quietMode) {
        const snippet = cmd.length > 80 ? cmd.substring(0, 77) + "..." : cmd;
        $.ui.log(
          `Proctor: destructive command — \`${snippet}\`. Verify this is intentional.`,
        );
      }
      await trace($, "destructive-cmd-warn", cmd.substring(0, 80));
    }

    // ── SOFT: Diff size awareness BEFORE commit ───────────────────
    if (GIT_COMMIT_RE.test(skel)) {
      try {
        const stat = await $.process.run(["git", "diff", "--cached", "--stat"]);
        const lines = (stat.stdout ?? "").split("\n");
        const summary = lines[lines.length - 2] ?? "";
        const insMatch = summary.match(/(\d+)\s+insertion/);
        const delMatch = summary.match(/(\d+)\s+deletion/);
        const total =
          parseInt(insMatch?.[1] ?? "0", 10) +
          parseInt(delMatch?.[1] ?? "0", 10);
        if (total > 500) {
          const sess = await loadSession($);
          if (!sess?.quietMode) {
            $.ui.log(
              `Proctor: ${total} lines staged — consider splitting into ` +
                `smaller commits for easier review. Proceeding with commit.`,
            );
          }
          await trace($, "large-commit-warn", `${total} lines staged`);
        }
      } catch {
        // Non-critical
      }
    }

    // ── SDD budgets: warn on the way up, block at the ceiling ──────
    const spent = await spendStep($, STEP_BUDGET_PER_TASK, TIME_BUDGET_PER_TASK_MS);
    if (spent.deny) return { deny: spent.deny };
    const notes = [...spent.notes];

    // ── Execute the command ─────────────────────────────────────────
    const result = await next(e);

    // ── POST: a ledger line written through the shell ──────────────
    if (!toolFailed(result) && shellWriteTargets(cmd).some((t) => LEDGER_PATH_RE.test(t))) {
      notes.push(...(await ingestSignals($, cmd, SIGNAL_CFG)));
    }

    // ── POST: Track test runs ───────────────────────────────────────
    if (isTestRun(skel)) {
      const output = toolOutput(result);
      const tail = output.substring(Math.max(0, output.length - 1200));
      const failed = toolFailed(result);
      const unproven = failed ? null : unprovenBy(e, result?.result, skel);
      const masked = unproven !== null;
      const testExit: number = failed ? 1 : masked ? -1 : 0;

      const evidenceCwd = await projectRoot($);

      const evidence: TestEvidence = {
        command: cmd.substring(0, 200),
        timestamp: Date.now(),
        exitCode: testExit,
        tailOutput: tail,
        cwd: evidenceCwd,
        ...(masked ? { masked: true, unproven: unproven ?? undefined } : {}),
      };
      await putEvidence($, evidence);
      await trace(
        $,
        "test-run",
        `exit=${evidence.exitCode} cmd=${evidence.command.substring(0, 60)}`,
      );

      // Success signal — proactive readiness notification
      if (evidence.exitCode === 0) {
        $.ui.log("Proctor: ✓ tests passing — git commit is unblocked.");
      } else if (masked) {
        $.ui.log(
          `Proctor: test run not counted as a pass — ${unproven}.`,
        );
      } else {
        $.ui.log(
          `Proctor: ✗ tests failing (exit ${evidence.exitCode}) — ` +
            `git commit blocked until fixed.`,
        );
      }

      // Cross-session learning: remember working test commands, per
      // project — one machine-wide value became every repo's suite.
      if (evidence.exitCode === 0) {
        await mutateHistory($, (hist) => {
          hist.lastTestCommand = evidence.command;
          hist.learnedTestCommands[evidenceCwd] = evidence.command;
          const roots = Object.keys(hist.learnedTestCommands);
          if (roots.length > 50) delete hist.learnedTestCommands[roots[0]];
        });
      }
    }

    // ── POST: Track branch changes ──────────────────────────────────
    if (GIT_BRANCH_SWITCH_RE.test(skel) && !toolFailed(result)) {
      try {
        const branchResult = await $.process.run([
          "git",
          "branch",
          "--show-current",
        ]);
        const moved = branchResult.stdout.trim() || null;
        await mutateSession($, (live) => {
          live.branch = moved;
        });
        await trace($, "branch-change", `to=${moved}`);
      } catch {
        // Non-critical
      }
    }

    // ── POST: Quality metrics after successful commit ──────────────
    if (GIT_COMMIT_RE.test(skel) && !toolFailed(result)) {
      try {
        await mutateHistory($, (h: SessionHistory) => {
          h.qualityMetrics.totalCommits++;
        });
      } catch {
        // Non-critical
      }
    }

    // ── POST: Track test run count for quality metrics ─────────────
    if (isTestRun(skel)) {
      try {
        await mutateHistory($, (h: SessionHistory) => {
          h.qualityMetrics.testsRun++;
        });
      } catch {
        // Non-critical
      }
    }

    return withNotes(result, notes);
  });

  // ───────────────────────────────────────────────────────────────────
  //  4. PLANNING MODE GATE — block Write/Edit during design phases
  //     Mechanical enforcement of brainstorming's <HARD-GATE>.
  //     Blocks Write, Edit, and NotebookEdit tool calls when a
  //     planning-phase skill is active. Cleared when an implementation
  //     skill is invoked or the user says "proctor: approve design".
  // ───────────────────────────────────────────────────────────────────

  on("tool.call", { tool: "Write" }, async ($: any, e: any, next: any) => {
    const session = await loadSession($);
    if (session?.planningMode) {
      const path: string = e.file_path ?? "";
      // Allow writing design docs and plan files during planning
      if (!isDesignDoc(path)) {
        await trace($, "gate-deny", `planning-mode-write: ${path}`);
        await mutateHistory($, (h: SessionHistory) => {
          h.qualityMetrics.gateDenials++;
        });
        return {
          deny:
            `Proctor gate: Write blocked — planning mode active ` +
            `(skill: ${session.planningSkill}).\n` +
            `Next steps:\n` +
            `  1. Finish the design document (.md files are allowed)\n` +
            `  2. Get approval: say "proctor: approve design"\n` +
            `  3. OR invoke an implementation skill (TDD, SDD, etc.)`,
        };
      }
    }
    // SDD step budget — the same ceiling the Bash hook enforces.
    const spent = await spendStep($, STEP_BUDGET_PER_TASK, TIME_BUDGET_PER_TASK_MS);
    if (spent.deny) return { deny: spent.deny };

    const result = await next(e);
    const notes = [...spent.notes];
    if (!toolFailed(result) && LEDGER_PATH_RE.test(e.file_path ?? "")) {
      notes.push(...(await ingestSignals($, String(e.content ?? ""), SIGNAL_CFG)));
    }
    return withNotes(result, notes);
  });

  on("tool.call", { tool: "Edit" }, async ($: any, e: any, next: any) => {
    const session = await loadSession($);
    if (session?.planningMode) {
      const path: string = e.file_path ?? "";
      if (!isDesignDoc(path)) {
        await trace($, "gate-deny", `planning-mode-edit: ${path}`);
        await mutateHistory($, (h: SessionHistory) => {
          h.qualityMetrics.gateDenials++;
        });
        return {
          deny:
            `Proctor gate: Edit blocked — planning mode active ` +
            `(skill: ${session.planningSkill}).\n` +
            `Next steps:\n` +
            `  1. Finish the design document (.md files are allowed)\n` +
            `  2. Get approval: say "proctor: approve design"\n` +
            `  3. OR invoke an implementation skill (TDD, SDD, etc.)`,
        };
      }
    }
    // SDD step budget — the same ceiling the Bash hook enforces.
    const spent = await spendStep($, STEP_BUDGET_PER_TASK, TIME_BUDGET_PER_TASK_MS);
    if (spent.deny) return { deny: spent.deny };

    const result = await next(e);
    const notes = [...spent.notes];
    if (!toolFailed(result) && LEDGER_PATH_RE.test(e.file_path ?? "")) {
      notes.push(...(await ingestSignals($, String(e.new_string ?? ""), SIGNAL_CFG)));
    }
    return withNotes(result, notes);
  });

  on("tool.call", { tool: "NotebookEdit" }, async ($: any, e: any, next: any) => {
    const session = await loadSession($);
    if (session?.planningMode) {
      await trace($, "gate-deny", "planning-mode-notebook");
      await mutateHistory($, (h: SessionHistory) => {
        h.qualityMetrics.gateDenials++;
      });
      return {
        deny:
          `Proctor gate: NotebookEdit blocked — planning mode active ` +
          `(skill: ${session.planningSkill}).\n` +
          `Next steps:\n` +
          `  1. Finish the design document\n` +
          `  2. Get approval: say "proctor: approve design"\n` +
          `  3. OR invoke an implementation skill (TDD, SDD, etc.)`,
      };
    }

    const spent = await spendStep($, STEP_BUDGET_PER_TASK, TIME_BUDGET_PER_TASK_MS);
    if (spent.deny) return { deny: spent.deny };

    return withNotes(await next(e), spent.notes);
  });

  // ───────────────────────────────────────────────────────────────────
  //  5. SKILL INVOCATION TRACKING — via skill.prompt event
  //     Also manages planning mode transitions and injects live
  //     discipline state into every skill prompt.
  // ───────────────────────────────────────────────────────────────────

  on("skill.prompt", async ($: any, e: any, next: any) => {
    const skillName: string = e.skill ?? "";
    await noteSkill($, skillName);
    const session = await loadSession($);

    // ── REWRITE: inject live discipline state into every skill ──
    const sdd = await loadSDD($);
    const test = await loadEvidence($);

    const lines: string[] = [];

    if (sdd?.active) {
      const budgetPct =
        STEP_BUDGET_PER_TASK > 0
          ? Math.round((sdd.toolCallsThisTask / STEP_BUDGET_PER_TASK) * 100)
          : 0;
      lines.push(
        `[PROCTOR — LIVE STATE]`,
        `Task ${sdd.currentTask}/${sdd.totalTasks} · ` +
          `${sdd.completedTasks.length} complete · ` +
          `Fix round ${sdd.currentFixRound}/${FIX_ROUND_CAP} · ` +
          `Steps ${sdd.toolCallsThisTask}/${STEP_BUDGET_PER_TASK} (${budgetPct}%) · ` +
          `${sdd.totalAgents} agents · ` +
          `${formatElapsed(Date.now() - sdd.startedAt)} elapsed`,
      );
      if (sdd.rulings.length > 0) {
        lines.push(
          `Active rulings: ${sdd.rulings.map((r) => r.text).join("; ")}`,
        );
      }
    }

    if (test) {
      const age = Date.now() - test.timestamp;
      const fresh = age < TEST_FRESHNESS_MS;
      const status = testVerdict(test);
      lines.push(
        `Test evidence: ${fresh ? "✓ fresh" : "✗ STALE"} · ` +
          `${status} · ${Math.round(age / 60_000)}m ago`,
      );
    } else {
      lines.push(
        `Test evidence: ✗ NONE — git gate will block commits`,
      );
    }

    if (session?.branch) {
      const guarded = isProtected(session, session.branch);
      lines.push(
        `Branch: ${session.branch}${guarded ? " ⚠ PROTECTED" : ""}`,
      );
    }

    if (session?.planningMode) {
      lines.push(
        `Planning mode: ACTIVE (${session.planningSkill}) — ` +
          `code writes blocked until design approval`,
      );
    }

    // Finishing an SDD run: the done-check and every ruling, where the
    // model reads them as it writes the final message.
    if (FINISHING_SKILLS.has(skillName) && sdd && (sdd.active || sdd.pendingDoneCheck)) {
      lines.push(...(await runDoneCheck($, sdd, TEST_FRESHNESS_MS)));
    }

    // The skill's prompt is `text`. Writing a `prompt` field added a key
    // the event does not have, and the skill loaded without the state.
    if (lines.length > 0) {
      const text: string = e.text ?? "";
      return next({ ...e, text: text + "\n\n" + lines.join("\n") });
    }

    return next(e);
  });

  // Also track via Read as fallback for direct SKILL.md reads
  on("tool.call", { tool: "Read" }, async ($: any, e: any, next: any) => {
    const result = await next(e);
    const path: string = e.file_path ?? "";
    const direct = path.match(/\/skills\/([^/]+)\/SKILL\.md$/);
    if (direct) {
      await noteSkill($, direct[1]);
      return result;
    }

    // The plan, read at the start of a run, says how many tasks it has:
    // writing-plans heads each `### Task N`. A run started from the skill
    // knows neither its plan nor its size until then.
    if (/\.(?:md|markdown)$/i.test(path) && !toolFailed(result)) {
      const sdd = await loadSDD($);
      const isPlan =
        sdd?.active &&
        (sdd.plan === "unknown"
          ? /plan/i.test(path.split("/").pop() ?? "") || /\/plans?\//i.test(path)
          : path === sdd.plan || path.endsWith(`/${sdd.plan}`));
      if (isPlan) {
        let text = "";
        try {
          text = String(await $.fs.read(path));
        } catch {
          text = "";
        }
        const tasks = allMatches(PLAN_TASK_HEADING_RE, text).map((m) => parseInt(m[1], 10));
        if (tasks.length > 0) {
          const total = Math.max(...tasks);
          let changed = false;
          await mutateSDD($, (live) => {
            if (live.plan === "unknown") {
              live.plan = path;
              changed = true;
            }
            if (total > live.totalTasks) {
              live.totalTasks = total;
              changed = true;
            }
          });
          if (changed) await trace($, "sdd-plan", `${path} tasks=${total}`);
        }
      }
    }
    return result;
  });

  // ───────────────────────────────────────────────────────────────────
  //  6. TURN LIFECYCLE — consolidated handler
  //     Combines: watchdog nudge, SDD state tracking, step budget
  //     warnings, context pressure, rationalization detection,
  //     SDD done-condition validation, and ruling aggregation.
  // ───────────────────────────────────────────────────────────────────

  on("turn.complete", async ($: any, e: any, next: any) => {
    const result = await next(e);

    // A subagent's turn is not the session's: every run of its loop is a
    // turn, so an implementer counted toward the watchdog, and its report
    // ("Task 3: complete", before any review) moved the controller's run.
    if (e.agentId) return result;

    const answer: string = e.answer ?? "";
    const session = await loadSession($);
    const notes: string[] = [];

    // ── Turn counting + skill watchdog ──────────────────────────────
    if (session && e.reason === "answer") {
      let nudge = 0;
      await mutateSession($, (live) => {
        live.turnCount++;
        live.turnsSinceSkill++;
        if (!live.watchdogNudgeSent && live.turnsSinceSkill >= WATCHDOG_TURN_THRESHOLD) {
          live.watchdogNudgeSent = true;
          nudge = live.turnsSinceSkill;
        }
        session.turnCount = live.turnCount;
      });
      if (nudge > 0) {
        if (!session.quietMode) {
          notes.push(
            `Proctor: ${nudge} turns without a skill. ` +
              `Check if brainstorming, TDD, debugging, or review applies.`,
          );
        }
        await trace($, "watchdog-nudge", `turns=${nudge}`);
      }
    }

    // ── SDD: an announced start, then every signal in the answer ────
    if (answer && SDD_START_RE.test(answer)) {
      const plan = answer.match(/plan[:\s]+[`"']?([^\s`"']+\.md)[`"']?/i)?.[1] ?? "unknown";
      const count = answer.match(/(\d+)\s*(?:tasks?|todos?)\b/i);
      await startSDD($, plan, count ? parseInt(count[1], 10) : 0, "announcement");
    }
    if (answer) notes.push(...(await ingestSignals($, answer, SIGNAL_CFG)));

    const sdd = await loadSDD($);

    if (sdd?.active) {
      // ── Budgets: the backstop for a turn that crossed a threshold
      //    without a tool call to carry the note (flags keep it once) ──
      const warnings: string[] = [];
      await mutateSDD($, (live) => {
        if (!live.active) return;
        if (STEP_BUDGET_PER_TASK > 0) {
          const pct = Math.round((live.toolCallsThisTask / STEP_BUDGET_PER_TASK) * 100);
          if (pct >= 100 && !live.stepWarned100) {
            live.stepWarned100 = true;
            live.stepWarned80 = true;
            warnings.push(
              `Proctor: step budget exhausted for Task ${live.currentTask} ` +
                `(${live.toolCallsThisTask}/${STEP_BUDGET_PER_TASK}). ` +
                `Wrap up: finish with current state, note your decision ` +
                `if more steps are needed, or ask your human partner.`,
            );
          } else if (pct >= 80 && pct < 100 && !live.stepWarned80) {
            live.stepWarned80 = true;
            warnings.push(
              `Proctor: step budget at ${pct}% for Task ${live.currentTask} ` +
                `(${live.toolCallsThisTask}/${STEP_BUDGET_PER_TASK}). Start wrapping up.`,
            );
          }
        }
        if (TIME_BUDGET_PER_TASK_MS > 0 && live.taskStartedAt > 0) {
          const elapsed = Date.now() - live.taskStartedAt;
          const pct = Math.round((elapsed / TIME_BUDGET_PER_TASK_MS) * 100);
          if (pct >= 100 && !live.timeWarned100) {
            live.timeWarned100 = true;
            live.timeWarned80 = true;
            warnings.push(
              `Proctor: time budget exhausted for Task ${live.currentTask} ` +
                `(${formatElapsed(elapsed)} / ${formatElapsed(TIME_BUDGET_PER_TASK_MS)}). ` +
                `Wrap up: finish with current state, note your decision ` +
                `if more time is needed, or ask your human partner.`,
            );
          } else if (pct >= 80 && pct < 100 && !live.timeWarned80) {
            live.timeWarned80 = true;
            warnings.push(
              `Proctor: time budget at ${pct}% for Task ${live.currentTask} ` +
                `(${formatElapsed(elapsed)} / ${formatElapsed(TIME_BUDGET_PER_TASK_MS)}). ` +
                `Start wrapping up.`,
            );
          }
        }
      });
      notes.push(...warnings);

      // ── Rationalization detection via $.model.fork ─────────────
      if (
        sdd.currentFixRound >= 3 &&
        sdd.currentFixRound < FIX_ROUND_CAP &&
        answer.length > 100
      ) {
        try {
          const fork = await $.model.fork({
            prompt:
              "You are Proctor, a discipline enforcement system. " +
              "Based on the conversation, is the agent in a " +
              "guess-and-check loop — trying fixes without " +
              "root-cause investigation? Answer ONLY with JSON: " +
              '{"looping":true,"signal":"one sentence"} or ' +
              '{"looping":false}',
          });
          // The fork answers { text, usage }, or null on an API error.
          const reply = String(fork?.text ?? "");
          const parsed = JSON.parse(reply.slice(reply.indexOf("{"), reply.lastIndexOf("}") + 1));
          if (parsed.looping) {
            notes.push(
              `Proctor: repeated fix pattern detected — ` +
                `"${parsed.signal}". Stop guessing. Investigate the ` +
                `root cause first (proctor:systematic-debugging). ` +
                `Fix round ${sdd.currentFixRound}/${FIX_ROUND_CAP}.`,
            );
            await trace($, "rationalization-detected", parsed.signal);
          }
        } catch {
          // Fork unavailable or unparseable — rely on hard cap
        }
      }

      // ── Context pressure warning ──────────────────────────────────
      if (session && !session.quietMode) {
        const tc = session.turnCount;
        if (tc === 50 || tc === 70 || tc === 90) {
          notes.push(
            `Proctor: turn ${tc} — long session. Your progress is ` +
              `preserved automatically. Focus on finishing the current ` +
              `task before starting new ones.`,
          );
        }
      }
    }

    // ── SDD done-condition validation ───────────────────────────────
    if (sdd && (sdd.active || sdd.pendingDoneCheck)) {
      const isFinishing =
        /\b(finishing-a-development-branch|all\s+tasks?\s+(?:are\s+)?(?:complete|completed|done)|sdd\s+done|sdd\s+finished)\b/i.test(
          answer,
        );
      if (isFinishing) notes.push(...(await runDoneCheck($, sdd, TEST_FRESHNESS_MS)));
    }

    // A turn's result has no field the model reads — a different `text`
    // is shown to the person under the answer — so these wait for the
    // next prompt.
    if (notes.length > 0) await queueNotes($, notes);

    return result;
  });

  // ───────────────────────────────────────────────────────────────────
  //  7. AGENT SPAWN ENFORCEMENT — model selection + cost tracking
  // ───────────────────────────────────────────────────────────────────

  on("agent.spawn", async ($: any, e: any, next: any) => {
    const sdd = await loadSDD($);

    await mutateSession($, (live) => {
      live.agentsSpawned++;
    });

    if (sdd?.active) {
      // Through the queue, like every other writer: a raw save here raced
      // the Bash hook's step-budget increment and one of the two was lost.
      await mutateSDD($, (live) => {
        if (!live.active) return;
        live.totalAgents++;
        live.toolCallsThisTask++;
        live.totalToolCalls++;
        if (e.model) live.lastImplementerModel = e.model;
      });
    }

    await trace($, "agent-spawn", `model=${e.model ?? "inherited"}`);

    return next(e);
  });

  // The advice about a dispatch goes back on the Agent tool's result,
  // which carries `context` to the model. It was written onto the
  // spawn's input, which has no such field, and never arrived. Judged
  // on the state before the spawn: agent.spawn, inside this call,
  // records the model this dispatch uses as the last one.
  on("tool.call", { tool: "Agent" }, async ($: any, e: any, next: any) => {
    const sdd = await loadSDD($);
    const session = await loadSession($);
    const model: string | undefined = e.model || undefined;
    const notes: string[] = [];

    // ── GATE: no dispatch past the fix-round cap ────────────────────
    // The skills promise the cap "blocks further dispatch and forces
    // adjudication". A round past the cap is one the ledger recorded, or
    // one this dispatch's own prompt names for the current task.
    if (sdd?.active && FIX_ROUND_CAP > 0) {
      const prompt = String(e.prompt ?? "");
      let round = sdd.currentFixRound;
      for (const m of allMatches(FIX_ROUND_RE, prompt)) {
        if (parseInt(m[1], 10) === sdd.currentTask) round = Math.max(round, parseInt(m[2], 10));
      }
      for (const m of prompt.matchAll(/(?:^|[^\w])fix[\s-]*round\s*(\d+)/gi)) {
        const before = prompt.slice(Math.max(0, (m.index ?? 0) - 12), m.index ?? 0);
        if (!/Task\s+\d+\s*\W*$/i.test(before)) round = Math.max(round, parseInt(m[1], 10));
      }
      if (round > FIX_ROUND_CAP) {
        await trace($, "gate-deny", `fix-round-cap: task=${sdd.currentTask} round=${round}`);
        await mutateHistory($, (h: SessionHistory) => {
          h.qualityMetrics.gateDenials++;
        });
        return {
          deny:
            `Proctor gate: Task ${sdd.currentTask} is past its fix-round cap ` +
            `(round ${round} of ${FIX_ROUND_CAP}) — no further dispatch.\n` +
            `Adjudicate each open finding instead:\n` +
            `  • contestable, or real but not load-bearing → park it with a \`Ruling:\`\n` +
            `  • real and load-bearing → rule on the smallest unblocking change\n` +
            `Then mark \`Task ${sdd.currentTask}: complete\` in the ledger, or stop with \`proctor: sdd stop\`.`,
        };
      }
    }

    if (sdd?.active && !session?.quietMode) {
      if (!model) {
        let sessionModel = "the session's";
        try {
          sessionModel = await $.session.model();
        } catch {
          // Name it generically.
        }
        notes.push(
          `Proctor: subagent inheriting session model (${sessionModel}). ` +
            `Consider a cheaper model for mechanical tasks.`,
        );
      } else if (
        // The last two rounds escalate: 4-5 of the default 5.
        sdd.currentFixRound >= Math.max(1, FIX_ROUND_CAP - 1) &&
        sdd.lastImplementerModel &&
        model === sdd.lastImplementerModel
      ) {
        notes.push(
          `Proctor: fix round ${sdd.currentFixRound}/${FIX_ROUND_CAP} ` +
            `with same model (${model}). Try a more capable model.`,
        );
      }
    }

    const result = await next(e);
    if (notes.length === 0 || result?.deny) return result;
    return { ...result, context: [...(result.context ?? []), ...notes] };
  });

  // ───────────────────────────────────────────────────────────────────
  //  8. SDD PROGRESS DASHBOARD — rendered above prompt
  // ───────────────────────────────────────────────────────────────────

  on(
    "ui.render",
    { component: "AbovePrompt" },
    async ($: any, e: any, next: any) => {
      const sdd = await loadSDD($);
      if (!sdd?.active) return next(e);

      const { Box, Text } = await $.ui.resolve(e);
      const elapsed = formatElapsed(Date.now() - sdd.startedAt);
      const pct =
        sdd.totalTasks > 0
          ? Math.round(
              (sdd.completedTasks.length / sdd.totalTasks) * 100,
            )
          : 0;
      const budgetPct =
        STEP_BUDGET_PER_TASK > 0
          ? Math.round(
              (sdd.toolCallsThisTask / STEP_BUDGET_PER_TASK) * 100,
            )
          : 0;

      const parts: string[] = [
        `⚡ SDD ${pct}%`,
        `T${sdd.currentTask}/${sdd.totalTasks} (${sdd.completedTasks.length}✓)`,
      ];

      if (sdd.currentFixRound > 0)
        parts.push(`fix ${sdd.currentFixRound}/${FIX_ROUND_CAP}`);

      parts.push(`steps ${budgetPct}%`);
      parts.push(`${sdd.totalAgents} agents`);

      if (sdd.rulings.length > 0)
        parts.push(`${sdd.rulings.length} rulings`);

      if (sdd.deferredMinors.length > 0)
        parts.push(`${sdd.deferredMinors.length} deferred`);

      parts.push(elapsed);

      // An AbovePrompt tree sizes itself to the box it draws into, which
      // is narrower than the viewport while a pane is docked. Nothing read
      // it, so on a narrow terminal the dashboard wrapped into the prompt.
      // Segments are in priority order: drop from the end until it fits.
      // Measured in cells, not UTF-16 units: ⚡ is one unit and two cells.
      const width = Number(e.props?.bodyColumns);
      if (Number.isFinite(width) && width > 0) {
        const SEP = " │ ";
        while (parts.length > 1 && cellWidth(parts.join(SEP)) > width) parts.pop();
        if (cellWidth(parts.join(SEP)) > width) {
          parts.splice(0, parts.length, fitCells(parts[0], width));
        }
      }

      return (
        <Box>
          <Text>{parts.join(" │ ")}</Text>
        </Box>
      );
    },
  );

  // ───────────────────────────────────────────────────────────────────
  //  9. ATTRIBUTION — enhanced commit messages with task + test info
  // ───────────────────────────────────────────────────────────────────

  on("attribution.text", async ($: any, e: any, next: any) => {
    const result = await next(e);
    const sdd = await loadSDD($);

    if (!sdd?.active) return result;

    const evidence = await loadEvidence($);
    const additions: string[] = [];

    if (sdd.currentTask > 0) {
      additions.push(`[SDD Task ${sdd.currentTask}/${sdd.totalTasks}]`);
    }

    // Every other consumer of the evidence checks its age; this one did
    // not, so a commit could be stamped "[Tests: ✓]" from a run hours
    // earlier — or, before the record carried a project, from a different
    // repo. A commit message is a claim; only make it if it is true now.
    const fresh =
      evidence !== null &&
      evidence.exitCode === 0 &&
      Date.now() - evidence.timestamp <= TEST_FRESHNESS_MS;

    if (fresh) {
      additions.push(`[Tests: ✓]`);
    }
    if (sdd.rulings.length > 0) {
      additions.push(`[${sdd.rulings.length} rulings]`);
    }

    if (additions.length > 0) {
      const text: string = result.text ?? "";
      return { ...result, text: text + "\n" + additions.join(" ") };
    }

    return result;
  });

  // ───────────────────────────────────────────────────────────────────
  //  10. BRANCH CONSENT + PLANNING APPROVAL — prompt.submit handler
  //      Strict patterns prevent accidental consent from natural
  //      language. Also handles SDD deactivation and design approval.
  // ───────────────────────────────────────────────────────────────────

  on("prompt.submit", async ($: any, e: any, next: any) => {
    const text: string = e.text ?? "";

    // Strict consent pattern: "proctor: allow <branch>"
    const consentMatch = text.match(
      /\bproctor:\s*allow\s+(\S+)\b/i,
    );
    if (consentMatch) {
      // `\S+` takes the sentence's punctuation with it, so "proctor: allow
      // master." asked for a branch named "master." and matched nothing.
      const branch = consentMatch[1].replace(/[.,;:!?)\]}'"]+$/, "");
      const consentSession = await loadSession($);
      const guarded = isProtected(consentSession, branch);

      if (guarded) {
        await mutateSession($, (session) => {
          session.branchConsents[branch] = true;
        });
        $.ui.log(`Proctor: consent recorded for branch '${branch}'`);
        await trace($, "branch-consent", branch);
      } else {
        // Silence here read as consent granted: the next destructive
        // command was blocked anyway, with no hint why.
        $.ui.log(
          `Proctor: '${branch}' is not a protected branch — nothing to ` +
            `consent to. Protected: ${protectedList(consentSession).join(", ")}.`,
        );
        await trace($, "branch-consent-noop", branch);
      }
    }

    // Design approval: exit planning mode
    if (/\bproctor:\s*approve\s+design\b/i.test(text)) {
      let approved = false;
      await mutateSession($, (session) => {
        if (!session.planningMode) return;
        session.planningMode = false;
        session.planningSkill = null;
        approved = true;
      });
      if (approved) {
        $.ui.log("Proctor: design approved — planning mode deactivated");
        await trace($, "planning-mode-exit", "design-approved");
      }
    }

    // SDD deactivation
    if (
      /\b(?:sdd\s+(?:done|finished|complete)|proctor:\s*sdd\s+stop)\b/i.test(
        text,
      )
    ) {
      let ended: SDDState | null = null;
      await mutateSDD($, (live) => {
        if (live.active) ended = structuredClone(live);
        live.active = false;
        live.pendingDoneCheck = false;
      });
      const sdd = ended as SDDState | null;
      if (sdd) {
        const elapsed = formatElapsed(Date.now() - sdd.startedAt);
        $.ui.log(
          `Proctor: SDD session complete.\n` +
            `  Tasks: ${sdd.completedTasks.length}/${sdd.totalTasks} done\n` +
            `  Time: ${elapsed}\n` +
            `  Fix rounds: ${sdd.totalFixRounds}\n` +
            `  Agents: ${sdd.totalAgents}\n` +
            `  Rulings: ${sdd.rulings.length}\n` +
            `  Deferred: ${sdd.deferredMinors.length}`,
        );
        await trace($, "sdd-end", `tasks=${sdd.completedTasks.length}/${sdd.totalTasks}`);
      }
    }

    // Grant one more budget for the current task: "proctor: budget extend"
    // The budget gate blocks at 100%; without an escape the only ways out
    // were completing the task or leaving SDD entirely.
    if (/\bproctor:\s*budget\s+extend\b/i.test(text)) {
      let extended: number | null = null;
      await mutateSDD($, (live) => {
        if (!live.active) return;
        live.toolCallsThisTask = 0;
        live.taskStartedAt = Date.now();
        live.stepWarned80 = false;
        live.stepWarned100 = false;
        live.timeWarned80 = false;
        live.timeWarned100 = false;
        extended = live.currentTask;
      });
      const sdd = extended === null ? null : { currentTask: extended as number };
      if (sdd) {
        $.ui.log(
          `Proctor: budget extended for Task ${sdd.currentTask} — ` +
            `steps and clock reset.`,
        );
        await trace($, "budget-extend", `task=${sdd.currentTask}`);
      } else {
        $.ui.log("Proctor: no active SDD task to extend.");
      }
    }

    // Declare the project test-free: "proctor: no tests"
    if (/\bproctor:\s*no\s+tests\b/i.test(text)) {
      let acknowledged = false;
      await mutateSession($, (session) => {
        session.testsAcknowledgedAbsent = true;
        acknowledged = true;
      });
      if (acknowledged) {
        $.ui.log(
          "Proctor: test gate stood down for this session — " +
            "no test suite in this project. Other gates still enforce.",
        );
        await trace($, "tests-absent-ack", "human");
      }
    }

    // Quiet mode toggle: "proctor: quiet on/off"
    const quietMatch = text.match(/\bproctor:\s*quiet\s+(on|off)\b/i);
    if (quietMatch) {
      const quietOn = quietMatch[1].toLowerCase() === "on";
      let toggled = false;
      await mutateSession($, (session) => {
        session.quietMode = quietOn;
        toggled = true;
      });
      if (toggled) {
        $.ui.log(
          quietOn
            ? "Proctor: quiet mode ON — soft warnings suppressed, hard gates still enforce."
            : "Proctor: quiet mode OFF — all warnings active.",
        );
        await trace($, "quiet-mode", quietOn ? "on" : "off");
      }
    }

    // Trace visibility: "proctor: show trace"
    if (/\bproctor:\s*show\s+trace\b/i.test(text)) {
      try {
        const events = await loadScoped<TraceEvent[]>($, KEYS.trace, []);
        const recent = events.slice(-25);
        if (recent.length === 0) {
          $.ui.log("Proctor trace: no events recorded yet.");
        } else {
          const lines = recent.map(
            (ev) =>
              `[${new Date(ev.ts).toISOString().substring(11, 19)}] ${ev.kind}: ${ev.detail}`,
          );
          $.ui.log(`Proctor trace (last ${recent.length}):\n${lines.join("\n")}`);
        }
      } catch {
        $.ui.log("Proctor trace: unable to read trace log.");
      }
    }

    // Pre-flight gate check: "proctor: check"
    if (/\bproctor:\s*check\b/i.test(text)) {
      try {
        const session = await loadSession($);
        const test = await loadEvidence($);
        const parts: string[] = ["─── Proctor Pre-flight Check ───"];

        // Test evidence gate
        if (!test) {
          parts.push("✗ Test evidence: NONE — commit will be blocked");
          if (session?.testCommand) {
            parts.push(`  → Run \`${session.testCommand}\``);
          }
        } else {
          const age = Date.now() - test.timestamp;
          const fresh = age < TEST_FRESHNESS_MS;
          if (test.exitCode !== 0) {
            parts.push(`✗ Tests: ${testVerdict(test)} — commit will be blocked`);
            parts.push(test.masked
              ? `  → Not proven: ${test.unproven ?? "exit status hidden"}. Re-run in the foreground`
              : "  → Fix failures and re-run tests");
          } else if (!fresh) {
            parts.push(`✗ Tests: STALE (${Math.round(age / 60_000)}m ago) — commit will be blocked`);
            parts.push(`  → Re-run \`${test.command}\``);
          } else {
            parts.push(`✓ Tests: passing, fresh (${Math.round(age / 60_000)}m ago)`);
          }
        }

        // Branch protection gate
        if (session?.branch) {
          if (isProtected(session, session.branch)) {
            const consent = session.branchConsents?.[session.branch];
            if (consent) {
              parts.push(`✓ Branch: ${session.branch} (protected, consent granted)`);
            } else {
              parts.push(`✗ Branch: ${session.branch} — PROTECTED, destructive ops blocked`);
              parts.push(`  → Create a feature branch or "proctor: allow ${session.branch}"`);
            }
          } else {
            parts.push(`✓ Branch: ${session.branch} (not protected)`);
          }
        }

        // Planning mode gate
        if (session?.planningMode) {
          parts.push(`✗ Planning mode: ON — code writes blocked`);
          parts.push(`  → "proctor: approve design" or invoke implementation skill`);
        } else {
          parts.push("✓ Planning mode: off");
        }

        // Secret scan (quick staged diff check)
        try {
          const diff = await $.process.run(["git", "diff", "--cached", "-U0"]);
          const diffText: string = diff.stdout ?? "";
          // Only what the commit adds, as the gate judges it: a commit
          // that removes a leaked key is not reported as leaking one.
          const secretFound = containsSecret(addedLines(diffText)) !== null;
          if (diffText.length > 0) {
            parts.push(secretFound
              ? "✗ Staged diff: potential secret detected — commit will be blocked"
              : "✓ Staged diff: no secrets detected");
          } else {
            parts.push("· Staged diff: nothing staged");
          }
        } catch {
          parts.push("· Staged diff: unable to check");
        }

        $.ui.log(parts.join("\n"));
        await trace($, "preflight-check", "user requested");
      } catch {
        $.ui.log("Proctor: unable to run pre-flight check.");
      }
    }

    // SDD scope update: "proctor: tasks N"
    const tasksMatch = text.match(/\bproctor:\s*tasks\s+(\d+)\b/i);
    if (tasksMatch) {
      const newTotal = parseInt(tasksMatch[1], 10);
      let oldTotal: number | null = null;
      await mutateSDD($, (live) => {
        if (!live.active) return;
        oldTotal = live.totalTasks;
        live.totalTasks = newTotal;
      });
      if (oldTotal !== null) {
        $.ui.log(`Proctor: SDD task count updated ${oldTotal} → ${newTotal}`);
        await trace($, "sdd-scope-update", `${oldTotal} → ${newTotal}`);
      } else {
        $.ui.log("Proctor: no active SDD session — nothing to update.");
      }
    }

    // Also detect "Task N: added" in user input for scope updates
    const taskAddedMatch = text.match(/Task\s+(\d+)\s*:\s*added\b/i);
    if (taskAddedMatch) {
      const addedTask = parseInt(taskAddedMatch[1], 10);
      let grew = false;
      await mutateSDD($, (live) => {
        if (!live.active || addedTask <= live.totalTasks) return;
        live.totalTasks = addedTask;
        grew = true;
      });
      if (grew) {
        $.ui.log(`Proctor: SDD scope expanded to ${addedTask} tasks`);
        await trace($, "sdd-scope-expand", `new total=${addedTask}`);
      }
    }

    // Self-diagnosis: "proctor: diagnose"
    if (/\bproctor:\s*diagnose\b/i.test(text)) {
      try {
        const events = await loadScoped<TraceEvent[]>($, KEYS.trace, []);
        const hist = await loadHistory($);
        const session = await loadSession($);
        const sdd = await loadSDD($);

        const parts: string[] = ["─── Proctor Diagnosis ───"];

        // Gate denial analysis. Both numbers come from the lifetime
        // counters: `denials` used to be counted from the trace log, which
        // session.start wipes and TRACE_CAP trims to 50, while `passes`
        // was cumulative — so autonomy converged on 100% and the advice
        // below could never fire.
        const denials = hist.qualityMetrics.gateDenials;
        const passes = hist.qualityMetrics.gatesPassed;
        const totalGateEvents = denials + passes;
        if (totalGateEvents > 0) {
          const autonomyRate = Math.round((passes / totalGateEvents) * 100);
          parts.push(
            `Gate autonomy: ${autonomyRate}% ` +
              `(${passes} passed / ${denials} denied)`,
          );
          if (autonomyRate < 70) {
            parts.push("  → Low autonomy — run tests more frequently before commit attempts");
          }
        }

        // Fix round analysis
        const fixEvents = events.filter((ev) => ev.kind === "sdd-fix-round");
        if (fixEvents.length > 0) {
          parts.push(`Fix rounds this session: ${fixEvents.length}`);
          if (fixEvents.length > 5) {
            parts.push("  → High fix rate — consider invoking systematic-debugging");
          }
        }

        // Rationalization detection history
        const ratEvents = events.filter((ev) => ev.kind === "rationalization-detected");
        if (ratEvents.length > 0) {
          parts.push(`Rationalization warnings: ${ratEvents.length}`);
          parts.push("  → Agent may be in guess-and-check loops");
        }

        // Skill usage pattern
        if (session && !session.skillInvoked && session.turnCount > 3) {
          parts.push(`No skill invoked in ${session.turnCount} turns`);
          parts.push("  → Invoke a relevant skill for structured approach");
        }

        // SDD health
        if (sdd?.active) {
          const avgStepsPerCompleted = sdd.completedTasks.length > 0
            ? Math.round(sdd.totalToolCalls / sdd.completedTasks.length)
            : sdd.totalToolCalls;
          parts.push(`SDD avg steps/task: ${avgStepsPerCompleted}`);
          if (avgStepsPerCompleted > STEP_BUDGET_PER_TASK * 0.8) {
            parts.push("  → Tasks are using most of the step budget — break into smaller tasks");
          }

          if (sdd.failedApproaches.length > 0) {
            parts.push(`Failed approaches tracked: ${sdd.failedApproaches.length}`);
          }
        }

        // Recommendations
        const recommendations: string[] = [];
        if (denials > 3) {
          recommendations.push("Run tests before every commit attempt");
        }
        if (!session?.skillInvoked) {
          recommendations.push("Check available skills before starting work");
        }
        if (sdd?.active && sdd.currentFixRound >= 3) {
          recommendations.push("Use systematic-debugging instead of more fix rounds");
        }

        if (recommendations.length > 0) {
          parts.push(`\nRecommendations:`);
          recommendations.forEach((r, i) => parts.push(`  ${i + 1}. ${r}`));
        }

        $.ui.log(parts.join("\n"));
        await trace($, "self-diagnosis", "user requested");
      } catch {
        $.ui.log("Proctor: unable to run diagnosis.");
      }
    }

    // Status dashboard: "proctor: status"
    if (/\bproctor:\s*status\b/i.test(text)) {
      try {
        const session = await loadSession($);
        const sdd = await loadSDD($);
        const test = await loadEvidence($);
        const hist = await loadHistory($);

        const parts: string[] = ["─── Proctor Status ───"];

        if (session) {
          parts.push(`Phase: ${session.currentPhase}`);
          parts.push(`Branch: ${session.branch ?? "unknown"}`);
          parts.push(`Turn: ${session.turnCount}`);
          parts.push(`Planning mode: ${session.planningMode ? "ON" : "off"}`);
          parts.push(`Quiet mode: ${session.quietMode ? "ON" : "off"}`);
          parts.push(`Last skill: ${session.lastSkillName ?? "none"}`);
        }

        if (sdd?.active) {
          const budgetPct = STEP_BUDGET_PER_TASK > 0
            ? Math.round((sdd.toolCallsThisTask / STEP_BUDGET_PER_TASK) * 100)
            : 0;
          parts.push(
            `SDD: Task ${sdd.currentTask}/${sdd.totalTasks} · ` +
              `${sdd.completedTasks.length} complete · ` +
              `Fix ${sdd.currentFixRound}/${FIX_ROUND_CAP} · ` +
              `Steps ${budgetPct}% · ${sdd.totalAgents} agents · ` +
              `${sdd.rulings.length} rulings · ` +
              `${formatElapsed(Date.now() - sdd.startedAt)} elapsed`,
          );
        } else {
          parts.push("SDD: inactive");
        }

        if (test) {
          const age = Math.round((Date.now() - test.timestamp) / 60_000);
          const fresh = (Date.now() - test.timestamp) < TEST_FRESHNESS_MS;
          parts.push(
            `Tests: ${testVerdict(test)} · ` +
              `${fresh ? "fresh" : "STALE"} · ${age}m ago`,
          );
        } else {
          parts.push("Tests: no evidence");
        }

        const qm = hist.qualityMetrics;
        const totalGateEvents = (qm.gatesPassed ?? 0) + qm.gateDenials;
        const autonomyRate =
          totalGateEvents > 0
            ? `${Math.round(((qm.gatesPassed ?? 0) / totalGateEvents) * 100)}%`
            : "n/a (no gate events yet)";
        parts.push(
          `Quality: ${qm.totalCommits} commits · ` +
            `${qm.gateDenials} denials · ` +
            `${qm.gatesPassed ?? 0} passed · ` +
            `${qm.fixRounds} fix rounds · ` +
            `${qm.testsRun} test runs`,
        );
        parts.push(`Autonomy rate: ${autonomyRate}`);

        parts.push(`Sessions: ${hist.sessionsCount}`);

        // State that was written every session and read by nothing:
        // agentsSpawned, isWorktree, skillUsage and recentRulings were all
        // maintained and then silently dropped. Surfacing them is the
        // smaller change — and the cross-session ruling memory was the
        // point of keeping them.
        if (session) {
          parts.push(
            `Agents spawned: ${session.agentsSpawned}` +
              (session.isWorktree ? " · in a git worktree" : ""),
          );
        }

        const topSkills = Object.entries(hist.skillUsage)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, n]) => `${name.replace(/^proctor:/, "")} ×${n}`);
        if (topSkills.length > 0) {
          parts.push(`Most used skills: ${topSkills.join(", ")}`);
        }

        if (hist.recentRulings.length > 0) {
          const recent = hist.recentRulings[hist.recentRulings.length - 1];
          parts.push(
            `Rulings remembered: ${hist.recentRulings.length} · ` +
              `latest "${recent.text.substring(0, 50)}"`,
          );
        }

        $.ui.log(parts.join("\n"));
      } catch {
        $.ui.log("Proctor: unable to read status.");
      }
    }

    // What the model reads beside this prompt: the notes the last turn
    // left, then the live state. Another plugin's context stays first.
    const notes = await drainNotes($);
    const status = await statusBlock($, {
      stepBudget: STEP_BUDGET_PER_TASK,
      fixRoundCap: FIX_ROUND_CAP,
      freshnessMs: TEST_FRESHNESS_MS,
    });
    const mine = [...notes, ...(status ? [status] : [])];
    if (mine.length === 0) return next(e);
    return next({ ...e, context: [...(e.context ?? []), ...mine] });
  });

  // ───────────────────────────────────────────────────────────────────
  //  11. TOOL DESCRIPTIONS — inject gate awareness so the model
  //      knows about enforcement BEFORE hitting it
  // ───────────────────────────────────────────────────────────────────

  on(
    "tool.describe",
    { tool: "Bash" },
    async ($: any, e: any, next: any) => {
      const result = await next(e);
      const description: string = result.description ?? "";

      const gateNotice =
        "\n[Proctor] Git commit/push/merge requires fresh passing " +
        "test evidence. Protected branches require explicit consent " +
        '("proctor: allow <branch>").';

      return {
        ...result,
        description: description + gateNotice,
      };
    },
  );

  on(
    "tool.describe",
    { tool: "Agent" },
    async ($: any, e: any, next: any) => {
      const result = await next(e);

      const notice =
        "\n[Proctor] When dispatching subagents, always specify " +
        "`model` explicitly — cheap models for mechanical " +
        "implementation, capable models for judgment tasks. " +
        "Proctor tracks agent count, model selection, and " +
        "fix-round state. During SDD sessions, each dispatch " +
        "is counted and reflected in the progress dashboard.";

      return {
        ...result,
        description: (result.description ?? "") + notice,
      };
    },
  );

  on(
    "tool.describe",
    { tool: "Write" },
    async ($: any, e: any, next: any) => {
      const result = await next(e);

      const notice =
        "\n[Proctor] During planning mode (brainstorming/writing-plans), " +
        "Write is blocked for implementation files. Only design docs " +
        '(.md files) are allowed. Exit planning mode by invoking an ' +
        'implementation skill or "proctor: approve design".';

      return {
        ...result,
        description: (result.description ?? "") + notice,
      };
    },
  );

  on(
    "tool.describe",
    { tool: "Edit" },
    async ($: any, e: any, next: any) => {
      const result = await next(e);

      const notice =
        "\n[Proctor] During planning mode (brainstorming/writing-plans), " +
        "Edit is blocked for implementation files. Only design docs " +
        '(.md files) are allowed. Exit planning mode by invoking an ' +
        'implementation skill or "proctor: approve design".';

      return {
        ...result,
        description: (result.description ?? "") + notice,
      };
    },
  );
};
