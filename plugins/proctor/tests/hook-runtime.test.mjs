// Runtime behaviour: the hooks themselves, driven against a fake engine.
//
// command-matching.test.mjs exercises the pure helpers; feature-inventory
// ratchets that features exist. Neither runs a hook, so every bug that
// lives in a hook's control flow — a counter write that throws and takes
// the gate down with it, a capture group nobody reads, a step budget only
// one tool checks — shipped green.
//
// This file loads the real module and fires real events at it.

import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "..", "hooks", "proctor.tsx");
const src = readFileSync(SRC, "utf8");

// Node strips TypeScript from a .ts file but not JSX, and the module's one
// JSX tree is the SDD dashboard. Swapping it for the data it would draw
// lets every other line run here exactly as it ships. Loud if the block
// moves, so this cannot rot into testing a different file.
const JSX_RE = /return \(\s*<Box>[\s\S]*?<\/Box>\s*\);/;
if (!JSX_RE.test(src)) {
  throw new Error("dashboard JSX block not found in proctor.tsx");
}
const stripped = src.replace(
  JSX_RE,
  'return { element: "Box", text: parts.join(" │ ") };',
);

let tmpFile;
try {
  tmpFile = join(tmpdir(), `proctor-hooks-${process.pid}.ts`);
  writeFileSync(tmpFile, stripped);
} catch {
  tmpFile = join(here, `.proctor-hooks-${process.pid}.ts`);
  writeFileSync(tmpFile, stripped);
}
const tmpUrl = pathToFileURL(tmpFile).href;

// A fresh module instance per group: module-level state (the write queues,
// and anything a bug leaks into a module constant) must not travel between
// tests, or a leak looks like a pass.
let instance = 0;
const freshModule = () => import(`${tmpUrl}?n=${++instance}`);

// ─────────────────────────────────────────────────────────────────────
//  Fake engine
// ─────────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS = {
  protectedBranches: ["main", "master", "production", "release"],
  executableDocPatterns: [],
  testFreshnessMinutes: 5,
  watchdogTurnThreshold: 4,
  fixRoundCap: 5,
  stepBudgetPerTask: 100,
  timeBudgetPerTaskMinutes: 30,
};

function makeEngine({
  cwd = "/repo",
  cwdThrows = false,
  files = { "package.json": JSON.stringify({ scripts: { test: "vitest" } }) },
  git = {},
  store = new Map(),
  fork = null,
} = {}) {
  const log = [];
  const ran = [];

  const gitTable = {
    "git branch --show-current": { stdout: "feature\n" },
    "git rev-parse --git-dir": { stdout: ".git\n" },
    "git rev-parse --git-common-dir": { stdout: ".git\n" },
    "git rev-parse --show-toplevel": { stdout: `${cwd}\n` },
    "git status --porcelain": { stdout: "" },
    "git diff --cached -U0": { stdout: "" },
    "git diff --cached --stat": { stdout: "" },
    "git diff HEAD -U0": { stdout: "" },
    "git ls-files --others --exclude-standard": { stdout: "" },
    ...git,
  };

  const $ = {
    store: {
      get: async (k) => (store.has(k) ? store.get(k) : null),
      set: async (k, v) => {
        store.set(k, v);
      },
    },
    fs: {
      exists: async (p) => Object.prototype.hasOwnProperty.call(files, p),
      read: async (p) => {
        if (!Object.prototype.hasOwnProperty.call(files, p)) {
          throw new Error(`ENOENT ${p}`);
        }
        return files[p];
      },
    },
    process: {
      run: async (argv) => {
        const key = argv.join(" ");
        ran.push(key);
        const hit = gitTable[key];
        if (hit?.throws) throw new Error(`git failed: ${key}`);
        if (hit) {
          return { stdout: hit.stdout ?? "", stderr: "", exitCode: hit.exitCode ?? 0 };
        }
        // Unknown command: the engine would report a failure, and every
        // caller must cope with "could not tell".
        return { stdout: "", stderr: "not mocked", exitCode: 1 };
      },
    },
    session: {
      cwd: async () => {
        if (cwdThrows) throw new Error("no cwd");
        return cwd;
      },
      model: async () => "claude-opus-5",
    },
    ui: {
      log: (m) => log.push(String(m)),
      resolve: async () => ({ Box: "Box", Text: "Text" }),
    },
    model: {
      fork: async (...a) => {
        if (!fork) throw new Error("no fork");
        return fork(...a);
      },
    },
  };

  return { $, log, ran, store, files, gitTable };
}

async function harness(opts = {}, options = {}) {
  const mod = opts.module ?? (await freshModule());
  const engine = makeEngine(opts);
  const hooks = [];
  const on = (event, a, b) =>
    hooks.push({ event, matcher: b ? a : null, fn: b ?? a });
  mod.register(on, { ...DEFAULT_OPTIONS, ...options });

  const matches = (h, m) =>
    !h.matcher ||
    Object.entries(h.matcher).every(([k, v]) => m && m[k] === v);

  const passthrough = async (ev) => ({ isError: false, text: "", __e: ev });

  async function fire(event, e, { match = null, next = passthrough } = {}) {
    const found = hooks.filter((h) => h.event === event && matches(h, match));
    if (found.length !== 1) {
      throw new Error(
        `expected 1 hook for ${event} ${JSON.stringify(match)}, got ${found.length}`,
      );
    }
    return found[0].fn(engine.$, e, next);
  }

  const bash = (command, next) =>
    fire("tool.call", { command }, { match: { tool: "Bash" }, next });
  const say = (answer, reason = "answer") =>
    fire("turn.complete", { answer, reason }, { next: async () => ({}) });
  const submit = (text) =>
    fire("prompt.submit", { text }, { next: async (ev) => ev });
  const start = () => fire("session.start", {}, { next: async (ev) => ev });
  const read = (key, fallback = null) => {
    const raw = engine.store.get(key);
    if (raw === undefined || raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  // Per-project records live in a book keyed by the repo root, which the
  // fake engine reports as the cwd.
  const root = (engine.gitTable["git rev-parse --show-toplevel"]?.stdout ?? "").trim() || "unknown";
  const readScoped = (key, fallback = null) => {
    const book = read(key, {});
    const shelf = book?.[root];
    return shelf && "value" in shelf ? shelf.value : fallback;
  };

  return { mod, ...engine, hooks, fire, bash, say, submit, start, read, readScoped, root };
}

// ─────────────────────────────────────────────────────────────────────
//  Assertions
// ─────────────────────────────────────────────────────────────────────

let failed = 0;
const check = (name, ok, detail) => {
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);
};
const eq = (name, actual, expected) =>
  check(name, actual === expected, actual);
const has = (name, hay, needle) =>
  check(name, String(hay ?? "").includes(needle), String(hay ?? "").slice(0, 120));

// A hook that throws is skipped by the engine, which is how a counter
// write took a gate down with it. Surface that as a failure, not a crash.
const attempt = async (fn) => {
  try {
    return { value: await fn() };
  } catch (e) {
    return { threw: `${e.constructor.name}: ${e.message}` };
  }
};

const GIT = "git" + " " + "commit";
const NPMTEST = "npm" + " " + "test";
const LEGACY_HISTORY = JSON.stringify({
  lastTestCommand: null,
  skillUsage: {},
  sessionsCount: 1,
});
const PARTIAL_HISTORY = JSON.stringify({
  lastTestCommand: null,
  projectPath: null,
  skillUsage: {},
  sessionsCount: 3,
  recentRulings: [],
  qualityMetrics: { totalCommits: 2, gateDenials: 1, fixRounds: 0, testsRun: 5 },
});

console.log("hook-runtime:");

// ── A. Store layer ───────────────────────────────────────────────────

// A counter write must never be able to take a gate down with it.
//
// `session.start` happens to rewrite the history record through
// `loadHistory`, so the store is usually normalised before any gate runs.
// That is an accident of an unrelated feature, and it is inside a try that
// a failing `$.session.cwd()` skips. These tests write the store the way a
// second pane running an older build leaves it — after the session is up —
// which is the state the counters must survive on their own.
const legacyAfterStart = (h, body) => {
  h.store.set("proctor:history", body);
};

// S1 A history written by an older Proctor is missing fields this one
// increments. `mutate` reads the stored object verbatim, so the ++ threw,
// the hook was skipped, and the `return { deny }` on the next line never
// ran: the gate passed the commit through in silence.
{
  const h = await harness();
  await h.start();
  legacyAfterStart(h, LEGACY_HISTORY);
  const r = await attempt(() => h.bash(`${GIT} -m x`));
  check("S1 legacy history does not throw in the gate", !r.threw, r.threw);
  has("S1 commit still denied without evidence", r.value?.deny, "no test evidence");
}

// S2 A history that has qualityMetrics but not gatesPassed does not throw
// — `undefined++` is NaN, JSON writes null, and the autonomy rate is
// garbage from then on.
{
  const h = await harness();
  await h.start();
  await h.bash(NPMTEST);
  legacyAfterStart(h, PARTIAL_HISTORY);
  await h.bash(`${GIT} -m x`);
  const passed = h.read("proctor:history")?.qualityMetrics?.gatesPassed;
  check("S2 gatesPassed stays a number", Number.isFinite(passed) && passed >= 1, passed);
}

// S3 The module constant is handed to `mutate` as its fallback and
// mutated in place, so one project's counters leak into the next.
{
  const mod = await freshModule();
  const a = await harness({ module: mod });
  await a.start();
  a.store.delete("proctor:history"); // the empty-store path uses the fallback
  await a.bash(`${GIT} -m x`); // denial: bumps gateDenials
  const b = await harness({ module: mod, store: new Map() });
  await b.start();
  await b.submit("proctor: status");
  const line = b.log.join("\n");
  has("S3 a fresh store starts at zero denials", line, "0 denials");
}

// S4 The secret scan wraps its own decision in a try whose catch means
// "skip the scan", so any error inside it ships the credential.
{
  const secret = "+AWS_ACCESS_KEY_ID=" + "AKIA" + "IOSFODNN7EXAMPLE";
  const h = await harness({
    git: { "git diff --cached -U0": { stdout: secret } },
  });
  await h.start();
  await h.bash(NPMTEST);
  legacyAfterStart(h, LEGACY_HISTORY);
  const r = await attempt(() => h.bash(`${GIT} -m x`));
  check("S4 secret gate survives a broken history", !r.threw, r.threw);
  has("S4 secret still denied", r.value?.deny, "credential");
}

// S4b The decision itself must sit outside the gathering's catch-all: a
// widening scan that cannot run is a smaller scan, not no gate.
{
  const secret = "+AWS_ACCESS_KEY_ID=" + "AKIA" + "IOSFODNN7EXAMPLE";
  const h = await harness({
    git: {
      "git diff --cached -U0": { stdout: secret },
      "git diff HEAD -U0": { throws: true },
    },
  });
  await h.start();
  await h.bash(NPMTEST);
  const r = await attempt(() => h.bash("git add -A && " + GIT + " -m x"));
  check("S4b a failed widening scan does not disable the gate", !r.threw, r.threw);
  has("S4b the staged secret is still caught", r.value?.deny, "credential");
}

// S11 The write queue only serialises writers that go through `mutate`;
// agent.spawn wrote the same key with a raw load+save, so one of the two
// increments was lost.
{
  const h = await harness();
  await h.start();
  await h.say("Starting subagent-driven-development for 3 tasks");
  await Promise.all([
    h.bash("ls"),
    h.fire("agent.spawn", { model: "haiku" }, { next: async (ev) => ev }),
  ]);
  eq("S11 both writers counted", h.readScoped("proctor:sdd-state:v3")?.toolCallsThisTask, 2);
}

// S11b trace() is a read-modify-write outside the queue: concurrent
// denials drop events from the audit trail.
{
  const h = await harness();
  await h.start();
  await Promise.all([h.bash(`${GIT} -m a`), h.bash("git push")]);
  const denials = (h.readScoped("proctor:trace:v3", []) ?? []).filter(
    (ev) => ev.kind === "gate-deny",
  );
  eq("S11b both denials traced", denials.length, 2);
}

// S12 Session state is one global record. A second session — another pane,
// another repo — overwrote it, taking this session's branch consent with it.
{
  const shared = new Map();
  const a = await harness({ store: shared, cwd: "/repoA", git: { "git branch --show-current": { stdout: "master\n" }, "git rev-parse --show-toplevel": { stdout: "/repoA\n" } } });
  await a.start();
  await a.submit("proctor: allow master");
  const b = await harness({ store: shared, cwd: "/repoB", git: { "git branch --show-current": { stdout: "main\n" }, "git rev-parse --show-toplevel": { stdout: "/repoB\n" } } });
  await b.start();
  await a.bash(NPMTEST);
  const r = await a.bash(`${GIT} -m x`);
  check("S12 a second session does not revoke consent", !r?.deny, r?.deny);
}

// S13 The comment at the write site says evidence from an unknown project
// is unusable; the gate only rejected it when both projects were known.
{
  const shared = new Map();
  const placeless = {
    "git rev-parse --show-toplevel": { stdout: "", exitCode: 1 },
  };
  const b = await harness({ store: shared, cwd: "/repoB", git: { "git rev-parse --show-toplevel": { stdout: "/repoB\n" } } });
  await b.start();
  const a = await harness({ store: shared, cwdThrows: true, git: placeless });
  await a.start();
  await a.bash(NPMTEST);
  const r = await b.bash(`${GIT} -m x`);
  has("S13 placeless evidence unblocks nothing", r?.deny, "no test evidence");
}

// ── B. Bash gates ────────────────────────────────────────────────────

const planning = async (h) => {
  await h.start();
  await h.fire(
    "skill.prompt",
    { skill: "proctor:brainstorming", prompt: "" },
    { next: async (ev) => ev },
  );
};

// S6 tee is the third capture group; the handler read only the first two.
{
  const h = await harness();
  await planning(h);
  const r = await h.bash("echo x | tee src/impl.ts");
  has("S6 tee write blocked in planning mode", r?.deny, "planning");
}

// S7 The skeleton blanks quoted literals before the write regex runs, so
// quoting the path erased it.
{
  const h = await harness();
  await planning(h);
  const r = await h.bash("echo hi > 'src/impl.ts'");
  has("S7 quoted write target blocked", r?.deny, "planning");
}

// S8 Only the first write in a command line was examined.
{
  const h = await harness();
  await planning(h);
  const r = await h.bash("echo a > notes.md && echo b > src/impl.ts");
  has("S8 second write in a chain blocked", r?.deny, "planning");
}

// S9 …and a redirect to the bit bucket is not a write at all.
{
  const h = await harness();
  await planning(h);
  const r = await h.bash("ls -la > /dev/null");
  check("S9 /dev/null is not an implementation file", !r?.deny, r?.deny);
}

// S10 The prose step-aside asks what the working tree holds, which says
// nothing about the commits a push sends.
{
  const h = await harness({
    git: { "git status --porcelain": { stdout: " M README.md\n" } },
  });
  await h.start();
  const commit = await h.bash(`${GIT} -m docs`);
  check("S10 a prose-only commit still steps aside", !commit?.deny, commit?.deny);
  const push = await h.bash("git push origin feature");
  has("S10 a push is not excused by an unrelated README edit", push?.deny, "test evidence");
}

// S15 containsSecret is documented as reading the added lines; it was
// handed the whole diff, so the commit that REMOVES a leaked key is the
// one that gets blocked.
{
  const removed = "-AWS_ACCESS_KEY_ID=" + "AKIA" + "IOSFODNN7EXAMPLE";
  const h = await harness({
    git: { "git diff --cached -U0": { stdout: `--- a/.env\n+++ b/.env\n@@\n${removed}\n` } },
  });
  await h.start();
  await h.bash(NPMTEST);
  const r = await h.bash(`${GIT} -m "remove leaked key"`);
  check("S15 removing a secret is not committing one", !r?.deny, r?.deny);
}

// S14 The budget ceiling was checked in the Bash hook alone, so a task
// that only edits files ran past it forever.
{
  const h = await harness({}, { stepBudgetPerTask: 2 });
  await h.start();
  await h.say("Starting subagent-driven-development for 3 tasks");
  await h.bash("ls");
  await h.bash("ls");
  const r = await h.fire(
    "tool.call",
    { file_path: "src/a.ts", content: "x" },
    { match: { tool: "Write" }, next: async (ev) => ev },
  );
  has("S14 Write respects the step budget", r?.deny, "budget");
}

// ── C. SDD state machine ─────────────────────────────────────────────

// S16 With no task count parsed, 0 === 0 made every ruling "final".
{
  const h = await harness();
  await h.start();
  await h.say("Beginning subagent-driven-development now");
  await h.say("Ruling: use the cache — simpler — cost if wrong: perf");
  eq("S16 ruling phase is preflight, not final", h.readScoped("proctor:sdd-state:v3")?.rulings?.[0]?.phase, "preflight");
}

// S17 A fix round announced for another task rewrote the current task's
// counter without moving the current task.
{
  const h = await harness();
  await h.start();
  await h.say("Starting subagent-driven-development for 5 tasks");
  await h.say("Task 4: fix round 2 — retrying the parser");
  const sdd = h.readScoped("proctor:sdd-state:v3");
  eq("S17 current task keeps its own fix round", sdd?.currentFixRound, 0);
  eq("S17 the round is still counted", sdd?.totalFixRounds, 1);
  has("S17 the approach is filed under its task", sdd?.failedApproaches?.[0], "Task 4 R2");
}

// S18 evidence/approach were matched once per turn, outside the loop, so
// every task completed in that turn got the first match's text.
{
  const h = await harness();
  await h.start();
  await h.say("Starting subagent-driven-development for 5 tasks");
  await h.say(
    "Task 1: complete — evidence: parser tests green\n" +
      "Task 2: complete — evidence: renderer tests green",
  );
  const ev = h.readScoped("proctor:sdd-state:v3")?.completedEvidence ?? {};
  check("S18 each task keeps its own evidence", ev["1"] !== ev["2"], ev);
}

// ── D. Reporting surfaces ────────────────────────────────────────────

// S5 `denials` is a number; `.length` on it is undefined, so the count
// printed as "undefined" and one recommendation could never fire.
{
  const h = await harness({
    store: new Map([
      [
        "proctor:history",
        JSON.stringify({
          ...JSON.parse(PARTIAL_HISTORY),
          qualityMetrics: { totalCommits: 1, gateDenials: 4, gatesPassed: 1, fixRounds: 0, testsRun: 2 },
        }),
      ],
    ]),
  });
  await h.start();
  await h.submit("proctor: diagnose");
  const out = h.log.join("\n");
  has("S5 diagnose prints the denial count", out, "4 denied");
  check("S5 diagnose prints no undefined", !out.includes("undefined"), out.slice(0, 200));
  has("S5 low autonomy is advised on", out, "Low autonomy");
  has("S5 the denial recommendation fires", out, "Run tests before every commit");
}

// S19 prompt.section concatenated e.text without a guard.
{
  const h = await harness();
  await h.start();
  await h.bash(NPMTEST);
  const out = await h.fire(
    "prompt.section",
    { section: "context" },
    { match: { section: "context" }, next: async (ev) => ev },
  );
  check("S19 no literal undefined in the injected section", !String(out?.text ?? "").includes("undefined"), out?.text);
}

// S20 Consent for a branch that is not protected was recorded nowhere and
// reported nowhere, so it read as granted.
{
  const h = await harness();
  await h.start();
  await h.submit("proctor: allow feature-x");
  has("S20 an unprotected branch says so", h.log.join("\n"), "not a protected branch");
}
{
  const h = await harness();
  await h.start();
  await h.submit("proctor: allow master.");
  has("S20 trailing punctuation still grants consent", h.log.join("\n"), "master");
}

// S21 Reading a SKILL.md registered half a skill use: the watchdog stayed
// armed and the phase never moved.
{
  const h = await harness();
  await h.start();
  await h.say("no skill here");
  await h.say("still none");
  await h.say("and none");
  await h.say("nor here");
  await h.fire(
    "tool.call",
    { file_path: "/x/skills/test-driven-development/SKILL.md" },
    { match: { tool: "Read" }, next: async (ev) => ev },
  );
  const mine = h.readScoped("proctor:session:v3");
  eq("S21 a direct SKILL.md read disarms the watchdog", mine?.watchdogNudgeSent, false);
  eq("S21 …and records which skill", mine?.lastSkillName, "test-driven-development");
}

// S24 A fresh install reported perfect autonomy from zero events.
{
  const h = await harness();
  await h.start();
  await h.submit("proctor: status");
  const out = h.log.join("\n");
  check("S24 autonomy with no gate events is not 100%", !out.includes("Autonomy rate: 100%"), out.slice(0, 300));
}

// S26 The dashboard never read the width of the box it draws into.
{
  const h = await harness();
  await h.start();
  await h.say("Starting subagent-driven-development for 5 tasks");
  await h.say("Ruling: a — b — cost if wrong: c");
  await h.say("minor (deferred): tidy the imports");
  const tree = await h.fire(
    "ui.render",
    { component: "AbovePrompt", surface: "terminal", props: { bodyColumns: 40 } },
    { match: { component: "AbovePrompt" }, next: async (ev) => ev },
  );
  check("S26 the dashboard fits its box", (tree?.text ?? "").length <= 40, tree?.text);
}

try {
  rmSync(tmpFile);
} catch {
  // best effort
}

process.exit(failed === 0 ? 0 : 1);
