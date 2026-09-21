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
}

interface SessionState {
  startedAt: number;
  skillInvoked: boolean;
  lastSkillName: string | null;
  watchdogNudgeSent: boolean;
  testCommand: string | null;
  branch: string | null;
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
}

interface SessionHistory {
  lastTestCommand: string | null;
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

const KEYS = {
  session: "proctor:session",
  test: "proctor:test-evidence",
  sdd: "proctor:sdd-state",
  history: "proctor:history",
  trace: "proctor:trace",
} as const;

const DEFAULT_HISTORY: SessionHistory = {
  lastTestCommand: null,
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

/**
 * SessionHistory with every field the current code expects, merged over
 * whatever the store holds. `load` returns a stored object verbatim, so a
 * history written by an older version is missing fields added since — and
 * `hist.qualityMetrics.x++` on it throws. A throwing hook is skipped
 * entirely, which silently disabled every gate it contained, because only
 * the DENIAL paths mutate those counters outside a try.
 */
async function loadHistory($: any): Promise<SessionHistory> {
  const stored = await load<Partial<SessionHistory> | null>(
    $,
    KEYS.history,
    null,
  );

  return {
    ...structuredClone(DEFAULT_HISTORY),
    ...(stored ?? {}),
    skillUsage: { ...(stored?.skillUsage ?? {}) },
    recentRulings: [...(stored?.recentRulings ?? [])],
    qualityMetrics: {
      ...DEFAULT_HISTORY.qualityMetrics,
      ...(stored?.qualityMetrics ?? {}),
    },
  };
}

// One in-flight write per key. Every hook did load-whole-object, mutate
// one field, save-whole-object, so two hooks running for the same
// assistant message (three parallel Edits, or a Bash and a Read) both read
// the same snapshot and the second write erased the first. Lost that way:
// step-budget increments, a branch change, and planningMode being set.
const writeQueues = new Map<string, Promise<unknown>>();

/**
 * Read, mutate and write a key with no other mutation interleaved.
 * `fn` may mutate its argument in place or return a replacement.
 */
async function mutate<T>(
  $: any,
  key: string,
  fallback: T,
  fn: (value: T) => T | void,
): Promise<T> {
  const queued = (writeQueues.get(key) ?? Promise.resolve()).then(async () => {
    const current = await load<T>($, key, fallback);
    const updated = (fn(current) ?? current) as T;
    await save($, key, updated);
    return updated;
  });

  // Keep the chain alive even if one link rejects.
  writeQueues.set(key, queued.catch(() => undefined));
  return queued;
}

async function save($: any, key: string, value: unknown): Promise<void> {
  await $.store.set(key, JSON.stringify(value));
}

async function trace(
  $: any,
  kind: string,
  detail: string,
): Promise<void> {
  try {
    const log = await load<TraceEvent[]>($, KEYS.trace, []);
    log.push({ ts: Date.now(), kind, detail });
    if (log.length > TRACE_CAP) log.splice(0, log.length - TRACE_CAP);
    await save($, KEYS.trace, log);
  } catch {
    // Tracing is best-effort — never block the hook chain
  }
}

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

const GIT_COMMIT_PUSH_RE = new RegExp(
  String.raw`\bgit\s+` + GIT_OPTS + String.raw`(commit|push|merge)\b`,
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
 * A shell command with its heredoc bodies and quoted literals blanked out,
 * so the command regexes match commands actually being run rather than text
 * that merely mentions one. Without this, a commit whose message says
 * "make test" is recorded as passing test evidence, and editing a document
 * that quotes a git subcommand is treated as running it.
 */
function commandSkeleton(cmd: string): string {
  let out = cmd;

  // Heredoc bodies: <<EOF / <<-'EOF' / <<"EOF" up to the terminator.
  out = out.replace(
    /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[\s\S]*?^\s*\2\s*$/gm,
    "<<HEREDOC",
  );
  // An unterminated heredoc still hides everything after it — but only
  // when its delimiter ends the line. Without that anchor, a `<<` inside a
  // quoted string ("a << b") erased the rest of the command, and every git
  // gate downstream went quiet.
  out = out.replace(
    /<<-?[ \t]*(['"]?)[A-Za-z_][A-Za-z0-9_]*\1[ \t]*$[\s\S]*$/m,
    "<<HEREDOC",
  );
  // A shell's -c payload is a command, not a literal: unwrap it so what
  // it runs is still seen. Only shells — `python3 -c "..."` stays opaque.
  out = out.replace(
    /\b(?:(?:ba|z|k|da)?sh|fish)\s+(?:-[a-zA-Z]+\s+)*-c\s+('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g,
    (_m: string, q: string) => ` ${q.slice(1, -1)} `,
  );

  // Quoted literals, escapes respected.
  out = out.replace(/'(?:[^'\\]|\\.)*'/g, "''");
  out = out.replace(/"(?:[^"\\]|\\.)*"/g, '""');

  return out;
}

const GIT_COMMIT_RE = new RegExp(
  String.raw`\bgit\s+` + GIT_OPTS + String.raw`commit\b`,
);

const GIT_BRANCH_SWITCH_RE = new RegExp(
  String.raw`\bgit\s+` + GIT_OPTS + String.raw`(checkout|switch)\b`,
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

// Shell forms that write a file: a redirection, or an in-place edit.
const SHELL_WRITE_RE =
  /(?:>>?\s*(['"]?[\w./~@-]+['"]?)|\b(?:sed|perl|ruby)\s+(?:-\S+\s+)*-i\S*\s+(?:-\S+\s+)*(?:'[^']*'|"[^"]*"|\S+)\s+(['"]?[\w./~@-]+['"]?)|\btee\s+(?:-\S+\s+)*(['"]?[\w./~@-]+['"]?))/;

const MAX_UNTRACKED_SCAN = 50;

const GIT_DESTRUCTIVE_RE = new RegExp(
  String.raw`\bgit\s+` +
    GIT_OPTS +
    String.raw`(?:(commit|push|merge|rebase|force-push)\b|reset\s+--hard\b|(?:checkout|restore)\s+(?:--\s+)?[.*]|checkout\s+--\s)`,
);

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

const SDD_START_RE =
  /\b(subagent[- ]driven[- ]development|proctor:subagent|sdd\s+session)\b/i;

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
const RULING_SEPARATOR_RE = /\s+(?:--|\u2014|\u2013)\s+/;
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

// ─────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h${mins % 60}m`;
}

function buildSDDInjection(sdd: SDDState, stepBudget: number, timeBudgetMs: number = 0): string {
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
  ]
    .filter(Boolean)
    .join("\n");
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
    .map(globToRegExp);

  const TEST_FRESHNESS_MS =
    ((options?.testFreshnessMinutes as number) ?? 5) * 60_000;
  const WATCHDOG_TURN_THRESHOLD =
    (options?.watchdogTurnThreshold as number) ?? 4;
  const FIX_ROUND_CAP = (options?.fixRoundCap as number) ?? 5;
  const STEP_BUDGET_PER_TASK =
    (options?.stepBudgetPerTask as number) ?? 100;
  const TIME_BUDGET_PER_TASK_MS =
    ((options?.timeBudgetPerTaskMinutes as number) ?? 30) * 60_000;

  // ───────────────────────────────────────────────────────────────────
  //  1. SESSION START — detect environment, initialize state
  // ───────────────────────────────────────────────────────────────────

  on("session.start", async ($: any, e: any, next: any) => {
    let testCommand: string | null = null;

    // Try package.json scripts.test first for accuracy
    try {
      if (await $.fs.exists("package.json")) {
        const raw = await $.fs.read("package.json");
        const pkg = JSON.parse(raw);
        if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
          testCommand = "npm test";
        }
      }
    } catch {
      // Fall through to pattern detection
    }

    // Fall back to file-based detection
    if (!testCommand) {
      for (const pattern of TEST_PATTERNS) {
        if (await $.fs.exists(pattern.file)) {
          testCommand = pattern.command;
          break;
        }
      }
    }

    // Cross-session learning: use remembered test command if file
    // heuristics didn't find one
    const history = await loadHistory($);
    try {
      const cwd = await $.session.cwd();
      if (!testCommand && history.lastTestCommand && history.projectPath === cwd) {
        testCommand = history.lastTestCommand;
      }
      history.projectPath = cwd;
      history.sessionsCount++;
      await save($, KEYS.history, history);
    } catch {
      // Non-critical — cwd detection failed
    }

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

    const session: SessionState = {
      startedAt: Date.now(),
      skillInvoked: false,
      lastSkillName: null,
      watchdogNudgeSent: false,
      testCommand,
      branch,
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
    };

    await save($, KEYS.session, session);

    // Initialize trace log for this session
    await save($, KEYS.trace, []);

    // Test evidence is session-scoped — the denial text says as much.
    // It lived in a store that outlives the session, so a run from a
    // previous session (or another project) kept satisfying the gate.
    await save($, KEYS.test, null);

    // SDD session recovery — resume if active state survives restart
    const existingSDD = await load<SDDState | null>($, KEYS.sdd, null);

    // A run belonging to another project is not this project's business.
    let here: string | null = null;
    try {
      here = await $.session.cwd();
    } catch {
      here = null;
    }

    if (existingSDD?.active && existingSDD.cwd && here && existingSDD.cwd !== here) {
      await trace($, "sdd-foreign", existingSDD.cwd.substring(0, 60));
      existingSDD.active = false;
      await save($, KEYS.sdd, existingSDD);
    } else if (existingSDD?.active) {
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
      existingSDD.taskStartedAt = Date.now();
      existingSDD.timeWarned80 = false;
      existingSDD.timeWarned100 = false;
      existingSDD.toolCallsThisTask = 0;
      existingSDD.stepWarned80 = false;
      existingSDD.stepWarned100 = false;
      await save($, KEYS.sdd, existingSDD);
      await trace($, "sdd-recovery", `task=${existingSDD.currentTask}/${existingSDD.totalTasks}`);
    }

    const env: string[] = [];
    if (testCommand) env.push(`tests: ${testCommand}`);
    if (branch) env.push(`branch: ${branch}`);
    if (isWorktree) env.push("worktree");
    env.push(`protected: ${PROTECTED_BRANCHES.join(",")}`);
    $.ui.log(`Proctor active (${env.join(" | ")})`);

    await trace($, "session-start", `branch=${branch} test=${testCommand}`);

    return next(e);
  });

  // ───────────────────────────────────────────────────────────────────
  //  2. COMPACTION-PROOF STATE — inject SDD state into context
  //     Uses prompt.section to survive compaction automatically.
  // ───────────────────────────────────────────────────────────────────

  on(
    "prompt.section",
    { section: "context" },
    async ($: any, e: any, next: any) => {
      const lines: string[] = [];

      const sdd = await load<SDDState | null>($, KEYS.sdd, null);
      if (sdd?.active) lines.push(buildSDDInjection(sdd, STEP_BUDGET_PER_TASK, TIME_BUDGET_PER_TASK_MS));

      const test = await load<TestEvidence | null>($, KEYS.test, null);
      const session = await load<SessionState | null>($, KEYS.session, null);

      if (test) {
        const age = Date.now() - test.timestamp;
        const fresh = age < TEST_FRESHNESS_MS;
        lines.push(
          `Tests: ${fresh ? "✓ fresh" : "✗ STALE"} · ` +
            `exit ${test.exitCode} · ` +
            `${Math.round(age / 60_000)}m ago · ` +
            `cmd: ${test.command}`,
        );
        if (test.exitCode !== 0 && test.tailOutput) {
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

      if (session?.testCommand && !test) {
        lines.push(
          `No tests run — \`${session.testCommand}\` required before commit`,
        );
      }

      if (lines.length === 0) return next(e);

      const block = `[PROCTOR]\n${lines.join("\n")}`;
      return next({ ...e, text: e.text + "\n\n" + block });
    },
  );

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
      const session = await load<SessionState | null>($, KEYS.session, null);

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
          !EXECUTABLE_DOC_PATTERNS.some((re) => re.test(f));

        const paths = await changedPaths($);
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

      const storedEvidence = steppedAside
        ? null
        : await load<TestEvidence | null>($, KEYS.test, null);

      // Evidence produced in another project proves nothing about this
      // one. The store is global and the record used to carry no project,
      // so a passing run in repo A unblocked a commit in repo B.
      let evidence = storedEvidence;
      if (storedEvidence) {
        let here: string | null = null;
        try {
          here = await $.session.cwd();
        } catch {
          here = null;
        }
        if (storedEvidence.cwd && here && storedEvidence.cwd !== here) {
          await trace(
            $,
            "evidence-foreign",
            `from ${storedEvidence.cwd.substring(0, 60)}`,
          );
          evidence = null;
        }
      }

      if (!evidence && !steppedAside) {
        await trace($, "gate-deny", `git-no-evidence: ${cmd.substring(0, 80)}`);
        await mutate($, KEYS.history, DEFAULT_HISTORY, (h: SessionHistory) => {
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
        await mutate($, KEYS.history, DEFAULT_HISTORY, (h: SessionHistory) => {
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

      if (evidence && evidence.exitCode !== 0) {
        await trace($, "gate-deny", `git-failing-tests: exit ${evidence.exitCode}`);
        await mutate($, KEYS.history, DEFAULT_HISTORY, (h: SessionHistory) => {
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
          await mutate($, KEYS.history, DEFAULT_HISTORY, (h: SessionHistory) => {
            h.qualityMetrics.gatesPassed++;
          });
        } catch { /* non-critical */ }
      }
    }

    // ── GATE: Planning mode also covers writes made through Bash ───
    // The gate was registered for Write/Edit/NotebookEdit only, so
    // `cat > src/x.ts <<EOF` and `sed -i` wrote implementation files
    // during a design phase while the identical Write call was blocked.
    const shellWrite = skel.match(SHELL_WRITE_RE);
    if (shellWrite) {
      const target = (shellWrite[1] ?? shellWrite[2] ?? "").replace(/^['"]|['"]$/g, "");
      if (target && !isDesignDoc(target)) {
        const sess = await load<SessionState | null>($, KEYS.session, null);
        if (sess?.planningMode) {
          await trace($, "gate-deny", `planning-mode-bash: ${target}`);
          await mutate($, KEYS.history, DEFAULT_HISTORY, (h: SessionHistory) => {
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
      const session = await load<SessionState | null>($, KEYS.session, null);

      // Read the branch now rather than trusting the session's copy: the
      // same command line may have switched onto a protected branch a
      // moment ago, and the tracker that refreshed the cache was itself
      // unreachable until S25 was fixed.
      const branch = await currentBranch($, session?.branch ?? null);

      if (session && branch && branch !== session.branch) {
        session.branch = branch;
        await save($, KEYS.session, session);
      }

      if (branch && PROTECTED_BRANCHES.includes(branch)) {
        const hasConsent = session?.branchConsents?.[branch];
        if (!hasConsent) {
          await trace($, "gate-deny", `branch-protection: ${branch}`);
          await mutate($, KEYS.history, DEFAULT_HISTORY, (h: SessionHistory) => {
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
    }

    // ── GATE: Secret/credential detection before git commit ────────
    if (GIT_COMMIT_RE.test(skel)) {
      try {
        const chunks: string[] = [];

        const cached = await $.process.run(["git", "diff", "--cached", "-U0"]);
        chunks.push(cached.stdout ?? "");

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
          chunks.push(tracked.stdout ?? "");

          const untracked = await $.process.run([
            "git",
            "ls-files",
            "--others",
            "--exclude-standard",
          ]);
          const files = (untracked.stdout ?? "")
            .split("\n")
            .map((f: string) => f.trim())
            .filter(Boolean)
            .slice(0, MAX_UNTRACKED_SCAN);

          for (const f of files) {
            try {
              chunks.push(await $.fs.read(f));
            } catch {
              // Binary or unreadable — nothing to scan.
            }
          }
        }

        const diffText: string = chunks.join("\n");
        const hit = containsSecret(diffText);
        if (hit) {
          await trace($, "gate-deny", `secret-detected: ${hit.source.substring(0, 30)}`);
          await mutate($, KEYS.history, DEFAULT_HISTORY, (h: SessionHistory) => {
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
      } catch {
        // Diff unavailable — skip secret scan, other gates still apply
      }
    }

    // ── SOFT: Destructive bash command awareness ──────────────────
    if (DESTRUCTIVE_BASH_RE.test(skel)) {
      const sess = await load<SessionState | null>($, KEYS.session, null);
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
          const sess = await load<SessionState | null>($, KEYS.session, null);
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
    // README has always documented "warn 80%, block 100%". Only the
    // warning existed: at 100% the turn-complete handler appended a
    // sentence to the next turn's context and nothing stopped.
    const sdd = await load<SDDState | null>($, KEYS.sdd, null);
    if (sdd?.active) {
      const overSteps =
        STEP_BUDGET_PER_TASK > 0 && sdd.toolCallsThisTask >= STEP_BUDGET_PER_TASK;
      const overTime =
        TIME_BUDGET_PER_TASK_MS > 0 &&
        sdd.taskStartedAt > 0 &&
        Date.now() - sdd.taskStartedAt >= TIME_BUDGET_PER_TASK_MS;

      if (overSteps || overTime) {
        const which = overSteps
          ? `step budget (${sdd.toolCallsThisTask}/${STEP_BUDGET_PER_TASK} tool calls)`
          : `time budget (${formatElapsed(Date.now() - sdd.taskStartedAt)}/` +
            `${formatElapsed(TIME_BUDGET_PER_TASK_MS)})`;

        await trace($, "gate-deny", `budget-exhausted: ${which}`);
        await mutate($, KEYS.history, DEFAULT_HISTORY, (h: SessionHistory) => {
          h.qualityMetrics.gateDenials++;
        });

        return {
          deny:
            `Proctor gate: Task ${sdd.currentTask} has exhausted its ` +
            `${which}.\n` +
            `Adjudicate before spending more:\n` +
            `  1. State what is done and what remains\n` +
            `  2. Decide: finish, split the task, or stop\n` +
            `  3. Then one of:\n` +
            `     \`Task ${sdd.currentTask}: complete\` — resets the budget ` +
            `and moves on\n` +
            `     \`proctor: budget extend\` — one more full budget for ` +
            `this task\n` +
            `     \`proctor: sdd stop\` — leave SDD mode entirely`,
        };
      }

      await mutate<SDDState | null>($, KEYS.sdd, null, (live) => {
        if (!live?.active) return;
        live.toolCallsThisTask++;
        live.totalToolCalls++;
      });
    }

    // ── Execute the command ─────────────────────────────────────────
    const result = await next(e);

    // ── POST: Track test runs ───────────────────────────────────────
    if (isTestRun(skel)) {
      const output = toolOutput(result);
      const tail = output.substring(Math.max(0, output.length - 1200));
      const testExit: number = toolFailed(result) ? 1 : 0;

      let evidenceCwd: string | null = null;
      try {
        evidenceCwd = await $.session.cwd();
      } catch {
        // Unknown project — the gate treats that as unusable evidence.
      }

      const evidence: TestEvidence = {
        command: cmd.substring(0, 200),
        timestamp: Date.now(),
        exitCode: testExit,
        tailOutput: tail,
        cwd: evidenceCwd,
      };
      await save($, KEYS.test, evidence);
      await trace(
        $,
        "test-run",
        `exit=${evidence.exitCode} cmd=${evidence.command.substring(0, 60)}`,
      );

      // Success signal — proactive readiness notification
      if (evidence.exitCode === 0) {
        $.ui.log("Proctor: ✓ tests passing — git commit is unblocked.");
      } else {
        $.ui.log(
          `Proctor: ✗ tests failing (exit ${evidence.exitCode}) — ` +
            `git commit blocked until fixed.`,
        );
      }

      // Cross-session learning: remember working test commands
      if (evidence.exitCode === 0) {
        try {
          const hist = await loadHistory($);
          hist.lastTestCommand = evidence.command;
          await save($, KEYS.history, hist);
        } catch {
          // Non-critical
        }
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
        const session = await load<SessionState | null>(
          $,
          KEYS.session,
          null,
        );
        if (session) {
          session.branch = branchResult.stdout.trim() || null;
          await save($, KEYS.session, session);
          await trace($, "branch-change", `to=${session.branch}`);
        }
      } catch {
        // Non-critical
      }
    }

    // ── POST: Quality metrics after successful commit ──────────────
    if (GIT_COMMIT_RE.test(skel) && !toolFailed(result)) {
      try {
        await mutate($, KEYS.history, DEFAULT_HISTORY, (h: SessionHistory) => {
          h.qualityMetrics.totalCommits++;
        });
      } catch {
        // Non-critical
      }
    }

    // ── POST: Track test run count for quality metrics ─────────────
    if (isTestRun(skel)) {
      try {
        await mutate($, KEYS.history, DEFAULT_HISTORY, (h: SessionHistory) => {
          h.qualityMetrics.testsRun++;
        });
      } catch {
        // Non-critical
      }
    }

    return result;
  });

  // ───────────────────────────────────────────────────────────────────
  //  4. PLANNING MODE GATE — block Write/Edit during design phases
  //     Mechanical enforcement of brainstorming's <HARD-GATE>.
  //     Blocks Write, Edit, and NotebookEdit tool calls when a
  //     planning-phase skill is active. Cleared when an implementation
  //     skill is invoked or the user says "proctor: approve design".
  // ───────────────────────────────────────────────────────────────────

  on("tool.call", { tool: "Write" }, async ($: any, e: any, next: any) => {
    const session = await load<SessionState | null>($, KEYS.session, null);
    if (session?.planningMode) {
      const path: string = e.file_path ?? "";
      // Allow writing design docs and plan files during planning
      if (!isDesignDoc(path)) {
        await trace($, "gate-deny", `planning-mode-write: ${path}`);
        await mutate($, KEYS.history, DEFAULT_HISTORY, (h: SessionHistory) => {
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
    // SDD step budget
    const sdd = await load<SDDState | null>($, KEYS.sdd, null);
    if (sdd?.active) {
      await mutate<SDDState | null>($, KEYS.sdd, null, (live) => {
        if (!live?.active) return;
        live.toolCallsThisTask++;
        live.totalToolCalls++;
      });
    }
    return next(e);
  });

  on("tool.call", { tool: "Edit" }, async ($: any, e: any, next: any) => {
    const session = await load<SessionState | null>($, KEYS.session, null);
    if (session?.planningMode) {
      const path: string = e.file_path ?? "";
      if (!isDesignDoc(path)) {
        await trace($, "gate-deny", `planning-mode-edit: ${path}`);
        await mutate($, KEYS.history, DEFAULT_HISTORY, (h: SessionHistory) => {
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
    // SDD step budget
    const sdd = await load<SDDState | null>($, KEYS.sdd, null);
    if (sdd?.active) {
      await mutate<SDDState | null>($, KEYS.sdd, null, (live) => {
        if (!live?.active) return;
        live.toolCallsThisTask++;
        live.totalToolCalls++;
      });
    }
    return next(e);
  });

  on("tool.call", { tool: "NotebookEdit" }, async ($: any, e: any, next: any) => {
    const session = await load<SessionState | null>($, KEYS.session, null);
    if (session?.planningMode) {
      await trace($, "gate-deny", "planning-mode-notebook");
      await mutate($, KEYS.history, DEFAULT_HISTORY, (h: SessionHistory) => {
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
    return next(e);
  });

  // ───────────────────────────────────────────────────────────────────
  //  5. SKILL INVOCATION TRACKING — via skill.prompt event
  //     Also manages planning mode transitions and injects live
  //     discipline state into every skill prompt.
  // ───────────────────────────────────────────────────────────────────

  on("skill.prompt", async ($: any, e: any, next: any) => {
    const skillName: string = e.skill ?? "";
    const session = await load<SessionState | null>($, KEYS.session, null);

    if (session) {
      session.skillInvoked = true;
      session.turnsSinceSkill = 0;
      session.watchdogNudgeSent = false;
      session.lastSkillName = skillName;

      // Planning mode transitions
      if (PLANNING_SKILLS.has(skillName)) {
        session.planningMode = true;
        session.planningSkill = skillName;
        await trace($, "planning-mode-enter", `skill=${skillName}`);
      } else if (IMPLEMENTATION_SKILLS.has(skillName)) {
        if (session.planningMode) {
          await trace($, "planning-mode-exit", `skill=${skillName}`);
        }
        session.planningMode = false;
        session.planningSkill = null;
      }

      // Phase lifecycle tracking
      const phase = SKILL_PHASE_MAP[skillName];
      if (phase && session.currentPhase !== phase) {
        const prev = session.currentPhase;
        session.currentPhase = phase;
        await trace($, "phase-transition", `${prev} → ${phase} (${skillName})`);
      }

      await save($, KEYS.session, session);
    }

    // Cross-session skill usage tracking
    try {
      const hist = await loadHistory($);
      const name = skillName || "unknown";
      hist.skillUsage[name] = (hist.skillUsage[name] ?? 0) + 1;
      await save($, KEYS.history, hist);
    } catch {
      // Non-critical
    }

    await trace($, "skill-invoke", skillName);

    // ── REWRITE: inject live discipline state into every skill ──
    const sdd = await load<SDDState | null>($, KEYS.sdd, null);
    const test = await load<TestEvidence | null>($, KEYS.test, null);

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
      const status = test.exitCode === 0 ? "passing" : "FAILING";
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
      const guarded = PROTECTED_BRANCHES.includes(session.branch);
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

    if (lines.length > 0) {
      const prompt: string = e.prompt ?? "";
      return next({ ...e, prompt: prompt + "\n\n" + lines.join("\n") });
    }

    return next(e);
  });

  // Also track via Read as fallback for direct SKILL.md reads
  on("tool.call", { tool: "Read" }, async ($: any, e: any, next: any) => {
    const result = await next(e);
    const path: string = e.file_path ?? "";
    if (/\/skills\/[^/]+\/SKILL\.md$/.test(path)) {
      const session = await load<SessionState | null>($, KEYS.session, null);
      if (session) {
        session.skillInvoked = true;
        session.turnsSinceSkill = 0;
        await save($, KEYS.session, session);
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
    const answer: string = e.answer ?? "";

    // Load state once
    const session = await load<SessionState | null>($, KEYS.session, null);
    let sdd = await load<SDDState | null>($, KEYS.sdd, null);

    const contextAdditions: string[] = [];
    let sessionChanged = false;
    let sddChanged = false;

    // ── Turn counting + skill watchdog ──────────────────────────────
    if (session && e.reason === "answer") {
      session.turnCount++;
      session.turnsSinceSkill++;
      sessionChanged = true;

      if (
        !session.watchdogNudgeSent &&
        session.turnsSinceSkill >= WATCHDOG_TURN_THRESHOLD
      ) {
        session.watchdogNudgeSent = true;
        if (!session.quietMode) {
          contextAdditions.push(
            `Proctor: ${session.turnsSinceSkill} turns without a skill. ` +
              `Check if brainstorming, TDD, debugging, or review applies.`,
          );
        }
        await trace($, "watchdog-nudge", `turns=${session.turnsSinceSkill}`);
      }
    }

    // ── SDD state machine ──────────────────────────────────────────
    if (answer) {
      // Detect SDD session start
      if (!sdd?.active && SDD_START_RE.test(answer)) {
        const planMatch = answer.match(
          /plan[:\s]+[`"']?([^\s`"']+\.md)[`"']?/i,
        );
        const taskCountMatch = answer.match(
          /(\d+)\s*(?:tasks?|todos?)/i,
        );

        let sddCwd: string | null = null;
        try {
          sddCwd = await $.session.cwd();
        } catch {
          sddCwd = null;
        }

        sdd = {
          active: true,
          cwd: sddCwd,
          plan: planMatch?.[1] ?? "unknown",
          startedAt: Date.now(),
          totalTasks: taskCountMatch ? parseInt(taskCountMatch[1], 10) : 0,
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
        };
        sddChanged = true;
        $.ui.log("Proctor: SDD session started — state tracking active");
        await trace($, "sdd-start", `tasks=${sdd.totalTasks} plan=${sdd.plan}`);
      }

      if (sdd?.active) {
        // Detect task completions
        for (const completeMatch of allMatches(TASK_COMPLETE_RE, answer)) {
          const taskNum = parseInt(completeMatch[1], 10);
          if (!sdd.completedTasks.includes(taskNum)) {
            sdd.completedTasks.push(taskNum);
            sdd.completedTasks.sort((a, b) => a - b);
            // Clamp: after the last task of five, `currentTask` used to
            // read 6, and that number reached the dashboard, the injected
            // banner, `proctor: status` and every commit message.
            sdd.currentTask =
              sdd.totalTasks > 0
                ? Math.min(taskNum + 1, sdd.totalTasks)
                : taskNum + 1;
            sdd.currentFixRound = 0;
            sdd.toolCallsThisTask = 0;
            sdd.taskStartedAt = Date.now();
            // Every task done means the run is over. Nothing used to
            // clear `active`, so the dashboard, the injected banner and
            // every later commit message kept reporting a finished run.
            if (
              sdd.totalTasks > 0 &&
              sdd.completedTasks.length >= sdd.totalTasks
            ) {
              sdd.active = false;
              await trace($, "sdd-complete", `${sdd.totalTasks} tasks`);
              if (!session?.quietMode) {
                $.ui.log(
                  `Proctor: SDD run complete — ${sdd.totalTasks} tasks, ` +
                    `${formatElapsed(Date.now() - sdd.startedAt)} elapsed.`,
                );
              }
            }

            sdd.stepWarned80 = false;
            sdd.stepWarned100 = false;
            sdd.timeWarned80 = false;
            sdd.timeWarned100 = false;
            sddChanged = true;
            await trace($, "sdd-task-complete", `task=${taskNum}`);

            const evidenceMatch = answer.match(/(?:evidence|result|outcome|completed):\s*(.{10,150})/i);
            sdd.completedEvidence[taskNum] = evidenceMatch?.[1]?.trim() ?? "marked complete";

            if (taskNum < sdd.totalTasks) {
              contextAdditions.push(
                `Proctor: Task ${taskNum} complete ` +
                  `(${sdd.completedTasks.length}/${sdd.totalTasks}). ` +
                  `Next: Task ${taskNum + 1}. ` +
                  `Budget reset — ${STEP_BUDGET_PER_TASK} steps available.`,
              );
            } else {
              contextAdditions.push(
                `Proctor: Task ${taskNum} complete — ` +
                  `all ${sdd.totalTasks} tasks done. ` +
                  `Next: run tests, then invoke finishing-a-development-branch.`,
              );
            }
          }
        }

        // Detect fix rounds — capture failed approach for compaction resilience
        for (const fixMatch of allMatches(FIX_ROUND_RE, answer)) {
          const round = parseInt(fixMatch[2], 10);
          // The task the agent named, not whatever currentTask happens to
          // be: a failed approach filed under the wrong task is injected
          // as "DO NOT REDO" against work that never tried it.
          const fixTask = parseInt(fixMatch[1], 10) || sdd.currentTask;
          if (round === sdd.currentFixRound && fixTask === sdd.currentTask) continue;
          sdd.currentFixRound = round;
          sdd.totalFixRounds++;
          sddChanged = true;
          await trace($, "sdd-fix-round", `task=${fixTask} round=${round}`);

          const approachMatch = answer.match(/(?:approach|tried|attempted|fix):\s*(.{10,120})/i);
          if (approachMatch) {
            sdd.failedApproaches.push(`Task ${fixTask} R${round}: ${approachMatch[1].trim()}`);
          } else {
            sdd.failedApproaches.push(`Task ${fixTask} R${round}: fix attempt failed`);
          }

          try {
            await mutate($, KEYS.history, DEFAULT_HISTORY, (h: SessionHistory) => {
              h.qualityMetrics.fixRounds++;
            });
          } catch { /* non-critical */ }

          if (round >= FIX_ROUND_CAP) {
            contextAdditions.push(
              `Proctor: fix-round limit reached (${round}/${FIX_ROUND_CAP}). ` +
                `Decide on each open finding — skip debatable ones, ` +
                `resolve the critical ones. No more fix rounds.`,
            );
          }
        }

        // ── Step budget enforcement (fires once per threshold) ────
        if (STEP_BUDGET_PER_TASK > 0) {
          const pct = Math.round(
            (sdd.toolCallsThisTask / STEP_BUDGET_PER_TASK) * 100,
          );
          if (pct >= 100 && !sdd.stepWarned100) {
            sdd.stepWarned100 = true;
            sddChanged = true;
            contextAdditions.push(
              `Proctor: step budget exhausted for Task ${sdd.currentTask} ` +
                `(${sdd.toolCallsThisTask}/${STEP_BUDGET_PER_TASK}). ` +
                `Wrap up: finish with current state, note your decision ` +
                `if more steps are needed, or ask your human partner.`,
            );
            await trace(
              $,
              "budget-exhausted",
              `task=${sdd.currentTask} steps=${sdd.toolCallsThisTask}`,
            );
          } else if (pct >= 80 && pct < 100 && !sdd.stepWarned80) {
            sdd.stepWarned80 = true;
            sddChanged = true;
            contextAdditions.push(
              `Proctor: step budget at ${pct}% for Task ${sdd.currentTask} ` +
                `(${sdd.toolCallsThisTask}/${STEP_BUDGET_PER_TASK}). ` +
                `Start wrapping up.`,
            );
            await trace(
              $,
              "budget-warning",
              `task=${sdd.currentTask} pct=${pct}`,
            );
          }
        }

        // ── Time budget enforcement (fires once per threshold) ───
        if (TIME_BUDGET_PER_TASK_MS > 0 && sdd.taskStartedAt > 0) {
          const taskElapsed = Date.now() - sdd.taskStartedAt;
          const timePct = Math.round(
            (taskElapsed / TIME_BUDGET_PER_TASK_MS) * 100,
          );
          if (timePct >= 100 && !sdd.timeWarned100) {
            sdd.timeWarned100 = true;
            sddChanged = true;
            contextAdditions.push(
              `Proctor: time budget exhausted for Task ${sdd.currentTask} ` +
                `(${formatElapsed(taskElapsed)} / ` +
                `${formatElapsed(TIME_BUDGET_PER_TASK_MS)}). ` +
                `Wrap up: finish with current state, note your decision ` +
                `if more time is needed, or ask your human partner.`,
            );
            await trace(
              $,
              "time-budget-exhausted",
              `task=${sdd.currentTask} elapsed=${formatElapsed(taskElapsed)}`,
            );
          } else if (timePct >= 80 && timePct < 100 && !sdd.timeWarned80) {
            sdd.timeWarned80 = true;
            sddChanged = true;
            contextAdditions.push(
              `Proctor: time budget at ${timePct}% for Task ${sdd.currentTask} ` +
                `(${formatElapsed(taskElapsed)} / ` +
                `${formatElapsed(TIME_BUDGET_PER_TASK_MS)}). ` +
                `Start wrapping up.`,
            );
            await trace(
              $,
              "time-budget-warning",
              `task=${sdd.currentTask} pct=${timePct}`,
            );
          }
        }

        // ── Rationalization detection via $.model.fork ─────────────
        if (
          sdd.currentFixRound >= 3 &&
          sdd.currentFixRound < FIX_ROUND_CAP &&
          answer.length > 100
        ) {
          try {
            const raw = await $.model.fork({
              prompt:
                "You are Proctor, a discipline enforcement system. " +
                "Based on the conversation, is the agent in a " +
                "guess-and-check loop — trying fixes without " +
                "root-cause investigation? Answer ONLY with JSON: " +
                '{"looping":true,"signal":"one sentence"} or ' +
                '{"looping":false}',
              maxTokens: 80,
            });
            const parsed = JSON.parse(raw);
            if (parsed.looping) {
              contextAdditions.push(
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

        // Detect rulings
        for (const rulingMatch of allMatches(RULING_RE, answer)) {
          const segments = (rulingMatch[1] ?? "")
            .split(RULING_SEPARATOR_RE)
            .map((seg) => seg.trim())
            .filter(Boolean);

          // The cost is the segment that says so, wherever it sits; the
          // last segment otherwise, when there is more than one.
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
                : sdd.completedTasks.length === sdd.totalTasks
                  ? "final"
                  : "preflight",
          });
          sddChanged = true;
          await trace($, "ruling", rulingMatch[1]?.trim() ?? "");

          // Persist ruling to cross-session history
          try {
            const hist = await loadHistory($);
            hist.recentRulings.push({
              text: rulingMatch[1]?.trim() ?? "",
              ts: Date.now(),
            });
            if (hist.recentRulings.length > 20) {
              hist.recentRulings = hist.recentRulings.slice(-20);
            }
            await save($, KEYS.history, hist);
          } catch {}
        }

        // Detect deferred minors — every one in the turn, not the first.
        for (const minorMatch of allMatches(MINOR_DEFERRED_RE, answer)) {
          sdd.deferredMinors.push({
            task: sdd.currentTask,
            finding: minorMatch[1].trim(),
          });
          sddChanged = true;
        }
      }
    }

    // ── Context pressure warning ────────────────────────────────────
    if (session && sdd?.active && !session.quietMode) {
      const tc = session.turnCount;
      if (tc === 50 || tc === 70 || tc === 90) {
        contextAdditions.push(
          `Proctor: turn ${tc} — long session. Your progress is ` +
            `preserved automatically. Focus on finishing the current ` +
            `task before starting new ones.`,
        );
      }
    }

    // ── SDD done-condition validation ───────────────────────────────
    if (sdd?.active && sdd.rulings.length >= 0) {
      const isFinishing =
        /\b(finishing-a-development-branch|all\s+tasks?\s+complete|sdd\s+done|sdd\s+finished)\b/i.test(
          answer,
        );

      if (isFinishing) {
        const issues: string[] = [];

        // Validate all tasks completed
        if (
          sdd.totalTasks > 0 &&
          sdd.completedTasks.length < sdd.totalTasks
        ) {
          issues.push(
            `${sdd.totalTasks - sdd.completedTasks.length} tasks not marked complete`,
          );
        }

        // Validate no open fix rounds
        if (sdd.currentFixRound > 0) {
          issues.push(
            `fix round ${sdd.currentFixRound} still open on Task ${sdd.currentTask}`,
          );
        }

        // Validate test evidence
        const evidence = await load<TestEvidence | null>($, KEYS.test, null);
        if (!evidence) {
          issues.push("no test evidence — run the test suite");
        } else if (evidence.exitCode !== 0) {
          issues.push(`tests failing (exit ${evidence.exitCode})`);
        } else {
          const age = Date.now() - evidence.timestamp;
          if (age > TEST_FRESHNESS_MS) {
            issues.push(
              `test evidence stale (${Math.round(age / 60_000)}m ago)`,
            );
          }
        }

        if (issues.length > 0) {
          contextAdditions.push(
            `Proctor SDD done-check FAILED — resolve before finishing:\n` +
              issues.map((i) => `  • ${i}`).join("\n"),
          );
          await trace($, "sdd-done-check-fail", issues.join("; "));
        }

        // Ruling aggregation
        if (sdd.rulings.length > 0) {
          const rulingList = sdd.rulings
            .map(
              (r, i) =>
                `${i + 1}. [Task ${r.task}, ${r.phase}] ${r.text}` +
                (r.costIfWrong !== "unknown"
                  ? ` — cost: ${r.costIfWrong}`
                  : ""),
            )
            .join("\n");

          const minorList =
            sdd.deferredMinors.length > 0
              ? sdd.deferredMinors
                  .map((m) => `- [Task ${m.task}] ${m.finding}`)
                  .join("\n")
              : "none";

          contextAdditions.push(
            `Proctor ruling aggregation — include in your final message:\n\n` +
              `RULINGS MADE (${sdd.rulings.length}):\n${rulingList}\n\n` +
              `DEFERRED MINORS (${sdd.deferredMinors.length}):\n${minorList}`,
          );
        }

        if (issues.length === 0) {
          await trace($, "sdd-done-check-pass", "all conditions met");
        }
      }
    }

    // Save state once
    if (sessionChanged) await save($, KEYS.session, session);
    if (sddChanged) await save($, KEYS.sdd, sdd);

    if (contextAdditions.length > 0) {
      return {
        ...result,
        context: [...(result.context ?? []), ...contextAdditions],
      };
    }

    return result;
  });

  // ───────────────────────────────────────────────────────────────────
  //  7. AGENT SPAWN ENFORCEMENT — model selection + cost tracking
  // ───────────────────────────────────────────────────────────────────

  on("agent.spawn", async ($: any, e: any, next: any) => {
    const sdd = await load<SDDState | null>($, KEYS.sdd, null);
    const session = await load<SessionState | null>($, KEYS.session, null);

    if (session) {
      session.agentsSpawned++;
      await save($, KEYS.session, session);
    }
    if (sdd?.active) {
      sdd.totalAgents++;
      sdd.toolCallsThisTask++;
      sdd.totalToolCalls++;

      if (e.model) {
        sdd.lastImplementerModel = e.model;
      }
      await save($, KEYS.sdd, sdd);
    }

    await trace($, "agent-spawn", `model=${e.model ?? "inherited"}`);

    const contextAdditions: string[] = [];

    // Model selection nudge during SDD
    if (!e.model && sdd?.active && !session?.quietMode) {
      try {
        const sessionModel = await $.session.model();
        contextAdditions.push(
          `Proctor: subagent inheriting session model (${sessionModel}). ` +
            `Consider a cheaper model for mechanical tasks.`,
        );
      } catch {
        contextAdditions.push(
          `Proctor: no model specified for subagent — specify explicitly.`,
        );
      }
    }

    // Fix-loop escalation enforcement
    if (sdd?.active && sdd.currentFixRound >= 4 && e.model && !session?.quietMode) {
      const lastModel = sdd.lastImplementerModel;
      if (lastModel && e.model === lastModel) {
        contextAdditions.push(
          `Proctor: fix round ${sdd.currentFixRound}/${FIX_ROUND_CAP} ` +
            `with same model (${lastModel}). Try a more capable model.`,
        );
      }
    }

    if (contextAdditions.length > 0) {
      return next({
        ...e,
        context: [...(e.context ?? []), ...contextAdditions],
      });
    }

    return next(e);
  });

  // ───────────────────────────────────────────────────────────────────
  //  8. SDD PROGRESS DASHBOARD — rendered above prompt
  // ───────────────────────────────────────────────────────────────────

  on(
    "ui.render",
    { component: "AbovePrompt" },
    async ($: any, e: any, next: any) => {
      const sdd = await load<SDDState | null>($, KEYS.sdd, null);
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
    const sdd = await load<SDDState | null>($, KEYS.sdd, null);

    if (!sdd?.active) return result;

    const evidence = await load<TestEvidence | null>($, KEYS.test, null);
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
      const branch = consentMatch[1];
      const session = await load<SessionState | null>($, KEYS.session, null);
      if (session && session.protectedBranches.includes(branch)) {
        session.branchConsents[branch] = true;
        await save($, KEYS.session, session);
        $.ui.log(`Proctor: consent recorded for branch '${branch}'`);
        await trace($, "branch-consent", branch);
      }
    }

    // Design approval: exit planning mode
    if (/\bproctor:\s*approve\s+design\b/i.test(text)) {
      const session = await load<SessionState | null>($, KEYS.session, null);
      if (session?.planningMode) {
        session.planningMode = false;
        session.planningSkill = null;
        await save($, KEYS.session, session);
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
      const sdd = await load<SDDState | null>($, KEYS.sdd, null);
      if (sdd?.active) {
        sdd.active = false;
        await save($, KEYS.sdd, sdd);
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
      const sdd = await load<SDDState | null>($, KEYS.sdd, null);
      if (sdd?.active) {
        sdd.toolCallsThisTask = 0;
        sdd.taskStartedAt = Date.now();
        sdd.stepWarned80 = false;
        sdd.stepWarned100 = false;
        sdd.timeWarned80 = false;
        sdd.timeWarned100 = false;
        await save($, KEYS.sdd, sdd);
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
      const session = await load<SessionState | null>($, KEYS.session, null);
      if (session) {
        session.testsAcknowledgedAbsent = true;
        await save($, KEYS.session, session);
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
      const session = await load<SessionState | null>($, KEYS.session, null);
      if (session) {
        const quietOn = quietMatch[1].toLowerCase() === "on";
        session.quietMode = quietOn;
        await save($, KEYS.session, session);
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
        const events = await load<TraceEvent[]>($, KEYS.trace, []);
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
        const session = await load<SessionState | null>($, KEYS.session, null);
        const test = await load<TestEvidence | null>($, KEYS.test, null);
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
            parts.push(`✗ Tests: FAILING (exit ${test.exitCode}) — commit will be blocked`);
            parts.push("  → Fix failures and re-run tests");
          } else if (!fresh) {
            parts.push(`✗ Tests: STALE (${Math.round(age / 60_000)}m ago) — commit will be blocked`);
            parts.push(`  → Re-run \`${test.command}\``);
          } else {
            parts.push(`✓ Tests: passing, fresh (${Math.round(age / 60_000)}m ago)`);
          }
        }

        // Branch protection gate
        if (session?.branch) {
          if (PROTECTED_BRANCHES.includes(session.branch)) {
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
          const secretFound = containsSecret(diffText) !== null;
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
      const sdd = await load<SDDState | null>($, KEYS.sdd, null);
      if (sdd?.active) {
        const oldTotal = sdd.totalTasks;
        sdd.totalTasks = newTotal;
        await save($, KEYS.sdd, sdd);
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
      const sdd = await load<SDDState | null>($, KEYS.sdd, null);
      if (sdd?.active && addedTask > sdd.totalTasks) {
        sdd.totalTasks = addedTask;
        await save($, KEYS.sdd, sdd);
        $.ui.log(`Proctor: SDD scope expanded to ${addedTask} tasks`);
        await trace($, "sdd-scope-expand", `new total=${addedTask}`);
      }
    }

    // Self-diagnosis: "proctor: diagnose"
    if (/\bproctor:\s*diagnose\b/i.test(text)) {
      try {
        const events = await load<TraceEvent[]>($, KEYS.trace, []);
        const hist = await loadHistory($);
        const session = await load<SessionState | null>($, KEYS.session, null);
        const sdd = await load<SDDState | null>($, KEYS.sdd, null);

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
              `(${passes} passed / ${denials.length} denied)`,
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
        if (denials.length > 3) {
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
        const session = await load<SessionState | null>($, KEYS.session, null);
        const sdd = await load<SDDState | null>($, KEYS.sdd, null);
        const test = await load<TestEvidence | null>($, KEYS.test, null);
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
            `Tests: ${test.exitCode === 0 ? "passing" : "FAILING"} · ` +
              `${fresh ? "fresh" : "STALE"} · ${age}m ago`,
          );
        } else {
          parts.push("Tests: no evidence");
        }

        const qm = hist.qualityMetrics;
        const totalGateEvents = (qm.gatesPassed ?? 0) + qm.gateDenials;
        const autonomyRate = totalGateEvents > 0
          ? Math.round(((qm.gatesPassed ?? 0) / totalGateEvents) * 100)
          : 100;
        parts.push(
          `Quality: ${qm.totalCommits} commits · ` +
            `${qm.gateDenials} denials · ` +
            `${qm.gatesPassed ?? 0} passed · ` +
            `${qm.fixRounds} fix rounds · ` +
            `${qm.testsRun} test runs`,
        );
        parts.push(`Autonomy rate: ${autonomyRate}%`);

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

    return next(e);
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
