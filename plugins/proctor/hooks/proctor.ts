// Proctor — Hook-enforced development discipline for Claude Code
// EARLY ACCESS: requires CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
//
// Skills teach methodology. Hooks enforce compliance. Store survives compaction.
//
// Three layers:
//   Teaching  (skills)  → prose methodology the agent reads and follows
//   Enforcement (hooks) → TypeScript middleware that gates or nudges
//   Infrastructure ($)  → persistent state that survives compaction
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
}

interface SessionHistory {
  lastTestCommand: string | null;
  projectPath: string | null;
  skillUsage: Record<string, number>;
  sessionsCount: number;
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
} as const;

const DEFAULT_HISTORY: SessionHistory = {
  lastTestCommand: null,
  projectPath: null,
  skillUsage: {},
  sessionsCount: 0,
};

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

async function save($: any, key: string, value: unknown): Promise<void> {
  await $.store.set(key, JSON.stringify(value));
}

// ─────────────────────────────────────────────────────────────────────
//  Test command detection — file-based heuristics + npm scripts field
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
];

const TEST_RUN_RE =
  /\b(npm\s+test|npx\s+(jest|vitest|mocha|playwright|cypress)|yarn\s+test|pnpm\s+test|bun\s+test|deno\s+test|pytest|py\.test|python\s+-m\s+pytest|cargo\s+test|go\s+test|bundle\s+exec\s+rspec|mix\s+test|make\s+test|gradle\w*\s+test|mvn\s+test|dotnet\s+test|swift\s+test|ctest|rake\s+test|jest|vitest|mocha)\b/;

const GIT_COMMIT_PUSH_RE = /\bgit\s+(commit|push|merge)\b/;

const GIT_DESTRUCTIVE_RE =
  /\bgit\s+(commit|push|merge|rebase|reset\s+--hard|force-push|checkout\s+--\s)\b/;

// ─────────────────────────────────────────────────────────────────────
//  SDD signal detection
// ─────────────────────────────────────────────────────────────────────

const SDD_START_RE =
  /\b(subagent[- ]driven[- ]development|proctor:subagent|sdd\s+session)\b/i;

const TASK_COMPLETE_RE = /Task\s+(\d+)\s*:\s*complete\b/i;

const FIX_ROUND_RE = /Task\s+(\d+)\s*:\s*fix\s+round\s+(\d+)/i;

const RULING_RE =
  /Ruling:\s*(.+?)(?:\s*--\s*(.+?))?(?:\s*--\s*cost\s+if\s+wrong:\s*(.+))?$/im;

// ─────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h${mins % 60}m`;
}

function buildSDDInjection(sdd: SDDState): string {
  const completed = sdd.completedTasks;
  const rulingsSummary = sdd.rulings
    .map(
      (r) =>
        `  Task ${r.task} [${r.phase}]: ${r.text} (cost: ${r.costIfWrong})`,
    )
    .join("\n");

  return [
    `[PROCTOR — SDD STATE — survives compaction]`,
    `Plan: ${sdd.plan}`,
    `Tasks: ${completed.length}/${sdd.totalTasks} complete`,
    `Completed: ${completed.length > 0 ? completed.join(", ") : "none"}`,
    `Current: Task ${sdd.currentTask}`,
    `Resume from: Task ${completed.length > 0 ? Math.max(...completed) + 1 : 1}`,
    `Fix rounds this task: ${sdd.currentFixRound} | total: ${sdd.totalFixRounds}`,
    `Agents spawned: ${sdd.totalAgents}`,
    sdd.rulings.length > 0
      ? `Rulings made (${sdd.rulings.length}):\n${rulingsSummary}`
      : "Rulings: none yet",
    sdd.deferredMinors.length > 0
      ? `Deferred minors: ${sdd.deferredMinors.map((m) => `[Task ${m.task}] ${m.finding}`).join("; ")}`
      : "",
    `Last implementer model: ${sdd.lastImplementerModel ?? "none"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ─────────────────────────────────────────────────────────────────────
//  REGISTRATION
// ─────────────────────────────────────────────────────────────────────

export const register: Register = (on, options) => {
  const PROTECTED_BRANCHES = (options?.protectedBranches as string[]) ?? [
    "main",
    "master",
    "production",
    "release",
  ];
  const TEST_FRESHNESS_MS =
    ((options?.testFreshnessMinutes as number) ?? 5) * 60_000;
  const WATCHDOG_TURN_THRESHOLD =
    (options?.watchdogTurnThreshold as number) ?? 4;
  const FIX_ROUND_CAP = (options?.fixRoundCap as number) ?? 5;

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
    // heuristics didn't find one, or validate the remembered one
    const history = await load<SessionHistory>(
      $,
      KEYS.history,
      DEFAULT_HISTORY,
    );
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
    };

    await save($, KEYS.session, session);

    const env: string[] = [];
    if (testCommand) env.push(`tests: ${testCommand}`);
    if (branch) env.push(`branch: ${branch}`);
    if (isWorktree) env.push("worktree");
    env.push(`protected: ${PROTECTED_BRANCHES.join(",")}`);
    $.ui.log(`Proctor active (${env.join(" | ")})`);

    return next(e);
  });

  // ───────────────────────────────────────────────────────────────────
  //  2. COMPACTION-PROOF STATE — inject SDD state into context
  //     Uses prompt.section to survive compaction automatically.
  //     The store persists across sessions; this hook ensures the
  //     agent sees state even after context is compressed.
  // ───────────────────────────────────────────────────────────────────

  on(
    "prompt.section",
    { section: "context" },
    async ($: any, e: any, next: any) => {
      const blocks: string[] = [];

      const sdd = await load<SDDState | null>($, KEYS.sdd, null);
      if (sdd?.active) blocks.push(buildSDDInjection(sdd));

      const test = await load<TestEvidence | null>($, KEYS.test, null);
      if (test) {
        const age = Date.now() - test.timestamp;
        const fresh = age < TEST_FRESHNESS_MS;
        blocks.push(
          `[PROCTOR — TEST STATE] ` +
            `${fresh ? "✓ fresh" : "✗ STALE"} · ` +
            `exit ${test.exitCode} · ` +
            `${Math.round(age / 60_000)}m ago · ` +
            `cmd: ${test.command}`,
        );
      }

      if (blocks.length === 0) return next(e);
      return next({ ...e, text: e.text + "\n\n" + blocks.join("\n\n") });
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
  //     These are HARD DENIALS — the agent cannot proceed.
  //     This is what distinguishes proctor from prose-only plugins.
  // ───────────────────────────────────────────────────────────────────

  on("tool.call", { tool: "Bash" }, async ($: any, e: any, next: any) => {
    const cmd: string = e.command ?? "";

    // ── GATE: Git commit/push requires fresh passing test evidence ──
    if (GIT_COMMIT_PUSH_RE.test(cmd)) {
      const evidence = await load<TestEvidence | null>($, KEYS.test, null);

      if (!evidence) {
        return {
          deny:
            "Proctor gate: no test evidence in this session. " +
            "Run the project's test suite before committing. " +
            "This is a mechanical gate — no override exists without tests.",
        };
      }

      const age = Date.now() - evidence.timestamp;
      if (age > TEST_FRESHNESS_MS) {
        const mins = Math.round(age / 60_000);
        return {
          deny:
            `Proctor gate: last test run was ${mins}m ago ` +
            `(freshness window: ${TEST_FRESHNESS_MS / 60_000}m). ` +
            `Run the test suite again before committing.`,
        };
      }

      if (evidence.exitCode !== 0) {
        return {
          deny:
            `Proctor gate: last test run failed (exit ${evidence.exitCode}). ` +
            `Fix the failures before committing.\n` +
            `Last output:\n${evidence.tailOutput}`,
        };
      }
    }

    // ── GATE: Protected branch enforcement ─────────────────────────
    if (GIT_DESTRUCTIVE_RE.test(cmd)) {
      const session = await load<SessionState | null>($, KEYS.session, null);
      if (session?.branch && PROTECTED_BRANCHES.includes(session.branch)) {
        const hasConsent = session.branchConsents?.[session.branch];
        if (!hasConsent) {
          return {
            deny:
              `Proctor gate: destructive git operation blocked on ` +
              `protected branch '${session.branch}'. ` +
              `Create a feature branch first: git checkout -b <name>. ` +
              `Your human partner can grant explicit consent for this ` +
              `branch if needed ("proctor: allow ${session.branch}").`,
          };
        }
      }
    }

    // ── Execute the command ─────────────────────────────────────────
    const result = await next(e);

    // ── POST: Track test runs ───────────────────────────────────────
    if (TEST_RUN_RE.test(cmd)) {
      const stdout: string = result.stdout ?? "";
      const stderr: string = result.stderr ?? "";
      const output = stdout + stderr;
      const tail = output.substring(Math.max(0, output.length - 1200));
      const evidence: TestEvidence = {
        command: cmd.substring(0, 200),
        timestamp: Date.now(),
        exitCode: result.exitCode ?? 0,
        tailOutput: tail,
      };
      await save($, KEYS.test, evidence);

      // Cross-session learning: remember working test commands
      if (evidence.exitCode === 0) {
        try {
          const hist = await load<SessionHistory>(
            $,
            KEYS.history,
            DEFAULT_HISTORY,
          );
          hist.lastTestCommand = evidence.command;
          await save($, KEYS.history, hist);
        } catch {
          // Non-critical
        }
      }
    }

    // ── POST: Track branch changes ──────────────────────────────────
    if (/\bgit\s+(checkout|switch)\b/.test(cmd) && result.exitCode === 0) {
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
        }
      } catch {
        // Non-critical
      }
    }

    return result;
  });

  // ───────────────────────────────────────────────────────────────────
  //  4. SKILL INVOCATION TRACKING — via skill.prompt event
  //     This fires when the Skill tool is actually invoked,
  //     far more reliable than detecting SKILL.md file reads.
  // ───────────────────────────────────────────────────────────────────

  on("skill.prompt", async ($: any, e: any, next: any) => {
    const session = await load<SessionState | null>($, KEYS.session, null);
    if (session) {
      session.skillInvoked = true;
      session.turnsSinceSkill = 0;
      session.lastSkillName = e.skill ?? null;
      await save($, KEYS.session, session);
    }

    // Cross-session skill usage tracking
    try {
      const hist = await load<SessionHistory>(
        $,
        KEYS.history,
        DEFAULT_HISTORY,
      );
      const name = e.skill ?? "unknown";
      hist.skillUsage[name] = (hist.skillUsage[name] ?? 0) + 1;
      await save($, KEYS.history, hist);
    } catch {
      // Non-critical
    }

    // ── REWRITE: inject live discipline state into every skill ──
    // This is the universal architecture enforcer pattern — every
    // skill becomes context-aware without modifying the skill itself.
    const sdd = await load<SDDState | null>($, KEYS.sdd, null);
    const test = await load<TestEvidence | null>($, KEYS.test, null);

    const lines: string[] = [];

    if (sdd?.active) {
      lines.push(
        `[PROCTOR — LIVE STATE]`,
        `Task ${sdd.currentTask}/${sdd.totalTasks} · ` +
          `${sdd.completedTasks.length} complete · ` +
          `Fix round ${sdd.currentFixRound}/${FIX_ROUND_CAP} · ` +
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
  //  5. TURN LIFECYCLE — consolidated handler
  //     Combines: watchdog nudge, SDD state tracking, context
  //     pressure warning, and ruling aggregation into ONE handler
  //     to avoid redundant store round-trips.
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
        !session.skillInvoked &&
        !session.watchdogNudgeSent &&
        session.turnsSinceSkill >= WATCHDOG_TURN_THRESHOLD
      ) {
        session.watchdogNudgeSent = true;
        contextAdditions.push(
          "Proctor watchdog: you have worked for several turns " +
            "without invoking a skill. If brainstorming, TDD, debugging, " +
            "or another proctor skill applies, invoke it now. " +
            "If you have considered and rejected all skills, carry on.",
        );
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

        sdd = {
          active: true,
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
        };
        sddChanged = true;
        $.ui.log("Proctor: SDD session started — state tracking active");
      }

      if (sdd?.active) {
        // Detect task completions
        const completeMatch = answer.match(TASK_COMPLETE_RE);
        if (completeMatch) {
          const taskNum = parseInt(completeMatch[1], 10);
          if (!sdd.completedTasks.includes(taskNum)) {
            sdd.completedTasks.push(taskNum);
            sdd.completedTasks.sort((a, b) => a - b);
            sdd.currentTask = taskNum + 1;
            sdd.currentFixRound = 0;
            sddChanged = true;
          }
        }

        // Detect fix rounds
        const fixMatch = answer.match(FIX_ROUND_RE);
        if (fixMatch) {
          const round = parseInt(fixMatch[2], 10);
          sdd.currentFixRound = round;
          sdd.totalFixRounds++;
          sddChanged = true;

          if (round >= FIX_ROUND_CAP) {
            contextAdditions.push(
              `Proctor: fix-round cap reached (${round}/${FIX_ROUND_CAP}). ` +
                `Adjudicate each open finding — park contestable ones, ` +
                `rule on load-bearing ones. Do not dispatch another fix round.`,
            );
          }
        }

        // ── Rationalization detection via $.model.fork ─────────────
        // At fix round >= 3, cheaply analyze the conversation for
        // guess-and-check loops. Fork shares the session prompt cache
        // so this is nearly free. Catches rationalizing agents 2
        // rounds before the hard cap — coach, not bouncer.
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
                `Proctor: guess-and-check loop detected — ` +
                  `"${parsed.signal}". STOP fixing. Return to ` +
                  `proctor:systematic-debugging Phase 1 (root cause ` +
                  `investigation). Fix-round: ${sdd.currentFixRound}` +
                  `/${FIX_ROUND_CAP}.`,
              );
            }
          } catch {
            // Fork unavailable or unparseable — rely on hard cap
          }
        }

        // Detect rulings
        const rulingMatch = answer.match(RULING_RE);
        if (rulingMatch) {
          sdd.rulings.push({
            task: sdd.currentTask,
            text: rulingMatch[1]?.trim() ?? "",
            costIfWrong: rulingMatch[3]?.trim() ?? "unknown",
            phase:
              sdd.currentFixRound > 0
                ? "fix-loop"
                : sdd.completedTasks.length === sdd.totalTasks
                  ? "final"
                  : "preflight",
          });
          sddChanged = true;
        }

        // Detect deferred minors
        const minorMatch = answer.match(
          /minor\s*\(deferred\):\s*(.+)/i,
        );
        if (minorMatch) {
          sdd.deferredMinors.push({
            task: sdd.currentTask,
            finding: minorMatch[1].trim(),
          });
          sddChanged = true;
        }
      }
    }

    // ── Context pressure warning ────────────────────────────────────
    if (session && sdd?.active) {
      const tc = session.turnCount;
      if (tc === 50 || tc === 70 || tc === 90) {
        contextAdditions.push(
          `Proctor: turn ${tc} — context pressure increasing. ` +
            `SDD state is persisted in $.store and survives compaction. ` +
            `Verify the ledger file is current. After compaction, the ` +
            `[PROCTOR — SDD STATE] block shows your recovery point.`,
        );
      }
    }

    // ── Ruling aggregation at session end ────────────────────────────
    if (sdd?.active && sdd.rulings.length > 0) {
      const isFinishing =
        /\b(finishing-a-development-branch|all\s+tasks?\s+complete|sdd\s+done|sdd\s+finished)\b/i.test(
          answer,
        );

      if (isFinishing) {
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
  //  6. AGENT SPAWN ENFORCEMENT — model selection + cost tracking
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

      // Track the implementer model
      if (e.model) {
        sdd.lastImplementerModel = e.model;
      }
      await save($, KEYS.sdd, sdd);
    }

    const contextAdditions: string[] = [];

    // Model selection nudge during SDD
    if (!e.model && sdd?.active) {
      try {
        const sessionModel = await $.session.model();
        contextAdditions.push(
          `Proctor SDD: no model specified for this subagent — it will ` +
            `inherit the session model (${sessionModel}). For mechanical ` +
            `implementation tasks, specify a cheaper model explicitly. ` +
            `Reserve the session model for judgment-heavy work.`,
        );
      } catch {
        contextAdditions.push(
          `Proctor SDD: no model specified for this subagent. ` +
            `Specify the model explicitly for cost control.`,
        );
      }
    }

    // Fix-loop escalation enforcement
    if (sdd?.active && sdd.currentFixRound >= 4 && e.model) {
      const lastModel = sdd.lastImplementerModel;
      if (lastModel && e.model === lastModel) {
        contextAdditions.push(
          `Proctor SDD: fix-loop round ${sdd.currentFixRound}/` +
            `${FIX_ROUND_CAP}. Dispatching with the same model ` +
            `(${lastModel}) that got stuck. Escalate to a more capable ` +
            `model for rounds 4-5.`,
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
  //  7. SDD PROGRESS DASHBOARD — rendered above prompt
  // ───────────────────────────────────────────────────────────────────

  on(
    "ui.render",
    { component: "AbovePrompt" },
    async ($: any, e: any, next: any) => {
      const sdd = await load<SDDState | null>($, KEYS.sdd, null);
      if (!sdd?.active) return next(e);

      const t = await $.ui.resolve(e);
      const elapsed = formatElapsed(Date.now() - sdd.startedAt);
      const pct =
        sdd.totalTasks > 0
          ? Math.round(
              (sdd.completedTasks.length / sdd.totalTasks) * 100,
            )
          : 0;

      const parts: string[] = [
        `⚡ SDD ${pct}%`,
        `T${sdd.currentTask}/${sdd.totalTasks} (${sdd.completedTasks.length}✓)`,
      ];

      if (sdd.currentFixRound > 0)
        parts.push(`fix ${sdd.currentFixRound}/${FIX_ROUND_CAP}`);

      parts.push(`${sdd.totalAgents} agents`);

      if (sdd.rulings.length > 0)
        parts.push(`${sdd.rulings.length} rulings`);

      if (sdd.deferredMinors.length > 0)
        parts.push(`${sdd.deferredMinors.length} deferred`);

      parts.push(elapsed);

      return (
        <t.Box>
          <t.Text>{parts.join(" │ ")}</t.Text>
        </t.Box>
      );
    },
  );

  // ───────────────────────────────────────────────────────────────────
  //  8. ATTRIBUTION — enhanced commit messages with task + test info
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
    if (evidence && evidence.exitCode === 0) {
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
  //  9. BRANCH CONSENT HANDLER — explicit consent for protected
  //     branches. Requires the exact phrase "proctor: allow <branch>"
  //     to prevent accidental consent from natural language.
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
        $.ui.log("Proctor: SDD session ended");
      }
    }

    return next(e);
  });

  // ───────────────────────────────────────────────────────────────────
  //  10. TOOL DESCRIPTIONS — inject gate awareness so the model
  //      knows about enforcement before hitting it
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

  // ───────────────────────────────────────────────────────────────────
  //  11. TOOL DESCRIPTIONS — Agent tool awareness
  //      Cached per session — use for static discipline awareness,
  //      not dynamic state (dynamic state goes through skill.prompt
  //      and agent.spawn hooks instead).
  // ───────────────────────────────────────────────────────────────────

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
};
