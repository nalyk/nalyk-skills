// Proctor — Hook-enforced development discipline for Claude Code
// EARLY ACCESS: requires CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
//
// Skills teach methodology. Hooks enforce compliance. Store survives compaction.
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
  watchdogNudgeSent: boolean;
  testCommand: string | null;
  branch: string | null;
  isWorktree: boolean;
  protectedBranches: string[];
  branchConsents: Record<string, boolean>;
  turnsSinceSkill: number;
  agentsSpawned: number;
}

// ─────────────────────────────────────────────────────────────────────
//  Store helpers
// ─────────────────────────────────────────────────────────────────────

const KEYS = {
  session: "proctor:session",
  test: "proctor:test-evidence",
  sdd: "proctor:sdd-state",
} as const;

async function load<T>(
  $: any,
  key: string,
  fallback: T
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
//  Test command detection
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
  { file: "pom.xml", command: "mvn test" },
];

const TEST_RUN_RE =
  /\b(npm\s+test|npx\s+(jest|vitest|mocha|playwright)|yarn\s+test|pnpm\s+test|pytest|py\.test|cargo\s+test|go\s+test|bundle\s+exec\s+rspec|mix\s+test|make\s+test|gradle\w*\s+test|mvn\s+test|dotnet\s+test|swift\s+test|jest|vitest|mocha)\b/;

const GIT_GATE_RE = /\bgit\s+(commit|push|merge)\b/;

const GIT_DESTRUCTIVE_RE =
  /\bgit\s+(commit|push|merge|rebase|reset\s+--hard|force-push)\b/;

// ─────────────────────────────────────────────────────────────────────
//  SDD signal detection
// ─────────────────────────────────────────────────────────────────────

const SDD_START_RE =
  /\b(subagent[- ]driven[- ]development|proctor:subagent|sdd)\b/i;

const TASK_COMPLETE_RE =
  /Task\s+(\d+)\s*:\s*complete\b/i;

const FIX_ROUND_RE =
  /Task\s+(\d+)\s*:\s*fix\s+round\s+(\d+)/i;

const RULING_RE =
  /Ruling:\s*(.+?)(?:\s*—\s*(.+?))?(?:\s*—\s*cost\s+if\s+wrong:\s*(.+))?$/im;

// ─────────────────────────────────────────────────────────────────────
//  REGISTRATION
// ─────────────────────────────────────────────────────────────────────

export const register: Register = (on, options) => {
  // User-configurable options (via plugin.json userConfig)
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
    // Detect test framework
    let testCommand: string | null = null;
    for (const pattern of TEST_PATTERNS) {
      if (await $.fs.exists(pattern.file)) {
        testCommand = pattern.command;
        break;
      }
    }

    // Detect branch
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
      const superproject = await $.process.run([
        "git",
        "rev-parse",
        "--show-superproject-working-tree",
      ]);

      const dirNorm = gitDir.stdout.trim();
      const commonNorm = gitCommon.stdout.trim();
      const superNorm = superproject.stdout.trim();

      isWorktree = dirNorm !== commonNorm && superNorm === "";
    } catch {
      // Not a git repo — gates won't fire
    }

    const session: SessionState = {
      startedAt: Date.now(),
      skillInvoked: false,
      watchdogNudgeSent: false,
      testCommand,
      branch,
      isWorktree,
      protectedBranches: PROTECTED_BRANCHES,
      branchConsents: {},
      turnsSinceSkill: 0,
      agentsSpawned: 0,
    };

    await save($, KEYS.session, session);

    // Log startup
    const env: string[] = [];
    if (testCommand) env.push(`tests: ${testCommand}`);
    if (branch) env.push(`branch: ${branch}`);
    if (isWorktree) env.push("worktree: yes");
    $.ui.log(`Proctor active${env.length ? ` (${env.join(", ")})` : ""}`);

    return next(e);
  });

  // ───────────────────────────────────────────────────────────────────
  //  2. COMPACTION-PROOF STATE — inject SDD state into context
  // ───────────────────────────────────────────────────────────────────

  on(
    "prompt.section",
    { section: "context" },
    async ($: any, e: any, next: any) => {
      const sdd = await load<SDDState | null>($, KEYS.sdd, null);
      if (!sdd?.active) return next(e);

      const completed = sdd.completedTasks;
      const rulingsSummary = sdd.rulings
        .map(
          (r) =>
            `  Task ${r.task} [${r.phase}]: ${r.text} (cost: ${r.costIfWrong})`
        )
        .join("\n");

      const injection = [
        `[PROCTOR — SDD STATE — survives compaction]`,
        `Plan: ${sdd.plan}`,
        `Tasks: ${sdd.completedTasks.length}/${sdd.totalTasks} complete`,
        `Completed: ${completed.length > 0 ? completed.join(", ") : "none"}`,
        `Current: Task ${sdd.currentTask}`,
        `Resume from: Task ${completed.length > 0 ? Math.max(...completed) + 1 : 1}`,
        `Fix rounds total: ${sdd.totalFixRounds}`,
        `Agents spawned: ${sdd.totalAgents}`,
        sdd.rulings.length > 0
          ? `Rulings made:\n${rulingsSummary}`
          : "Rulings: none",
        sdd.deferredMinors.length > 0
          ? `Deferred minors: ${sdd.deferredMinors.length}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      return next({ ...e, text: e.text + "\n\n" + injection });
    }
  );

  // ───────────────────────────────────────────────────────────────────
  //  3. GIT GATES — hard enforcement on Bash tool calls
  // ───────────────────────────────────────────────────────────────────

  on("tool.call", { tool: "Bash" }, async ($: any, e: any, next: any) => {
    const cmd: string = e.command ?? "";

    // ── GATE: Git commit/push requires fresh test evidence ─────────
    if (GIT_GATE_RE.test(cmd)) {
      const evidence = await load<TestEvidence | null>($, KEYS.test, null);

      if (!evidence) {
        return {
          deny:
            "Proctor gate: no test evidence in this session. " +
            "Run the project's test suite before committing. " +
            "This gate enforces verification-before-completion mechanically.",
        };
      }

      const age = Date.now() - evidence.timestamp;
      if (age > TEST_FRESHNESS_MS) {
        const mins = Math.round(age / 60_000);
        return {
          deny:
            `Proctor gate: last test run was ${mins} minutes ago ` +
            `(freshness window: ${TEST_FRESHNESS_MS / 60_000} min). ` +
            `Run the test suite again before committing.`,
        };
      }

      if (evidence.exitCode !== 0) {
        return {
          deny:
            `Proctor gate: last test run failed (exit ${evidence.exitCode}). ` +
            `Fix the failures before committing.\n` +
            `Last output tail: ${evidence.tailOutput}`,
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
              `Proctor gate: refusing destructive git operation on ` +
              `protected branch '${session.branch}'. ` +
              `Create a feature branch with git checkout -b <name>, or ` +
              `ask your human partner for explicit consent. ` +
              `If consent is granted, the hook will record it and allow ` +
              `subsequent operations on this branch for this session.`,
          };
        }
      }
    }

    // ── PASSTHROUGH: execute the command ────────────────────────────
    const result = await next(e);

    // ── TRACK: test runs ───────────────────────────────────────────
    if (TEST_RUN_RE.test(cmd)) {
      const stdout: string = result.stdout ?? "";
      const tail = stdout.substring(Math.max(0, stdout.length - 800));
      const evidence: TestEvidence = {
        command: cmd,
        timestamp: Date.now(),
        exitCode: result.exitCode ?? 0,
        tailOutput: tail,
      };
      await save($, KEYS.test, evidence);
    }

    // ── TRACK: branch changes ──────────────────────────────────────
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
          null
        );
        if (session) {
          session.branch = branchResult.stdout.trim() || null;
          await save($, KEYS.session, session);
        }
      } catch {
        // Ignore — non-critical tracking
      }
    }

    return result;
  });

  // ───────────────────────────────────────────────────────────────────
  //  4. SKILL INVOCATION WATCHDOG — soft nudge
  // ───────────────────────────────────────────────────────────────────

  // Track skill reads
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

  // Nudge if working without skills
  on("turn.complete", async ($: any, e: any, next: any) => {
    const result = await next(e);
    if (e.reason !== "answer") return result;

    const session = await load<SessionState | null>($, KEYS.session, null);
    if (!session) return result;

    session.turnsSinceSkill++;
    await save($, KEYS.session, session);

    if (
      !session.skillInvoked &&
      !session.watchdogNudgeSent &&
      session.turnsSinceSkill >= WATCHDOG_TURN_THRESHOLD
    ) {
      session.watchdogNudgeSent = true;
      await save($, KEYS.session, session);
      return {
        ...result,
        context: [
          ...(result.context ?? []),
          "Proctor watchdog: you have been working for several turns " +
            "without invoking a skill. If brainstorming, TDD, debugging, " +
            "or another skill applies to what you are doing, invoke it now. " +
            "If you have considered and rejected all skills, carry on.",
        ],
      };
    }

    return result;
  });

  // ───────────────────────────────────────────────────────────────────
  //  5. SDD STATE MACHINE — compaction-proof task tracking
  // ───────────────────────────────────────────────────────────────────

  // Detect SDD activation and task completions in agent output
  on("turn.complete", async ($: any, e: any, next: any) => {
    const result = await next(e);
    const answer: string = e.answer ?? "";
    if (!answer) return result;

    let sdd = await load<SDDState | null>($, KEYS.sdd, null);

    // Detect SDD session start
    if (!sdd?.active && SDD_START_RE.test(answer)) {
      // Extract plan path and task count from the turn
      const planMatch = answer.match(
        /plan[:\s]+[`"']?([^\s`"']+\.md)[`"']?/i
      );
      const taskCountMatch = answer.match(
        /(\d+)\s*(?:tasks?|todos?)/i
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
      await save($, KEYS.sdd, sdd);
      $.ui.log("Proctor: SDD session started — state tracking active");
    }

    if (!sdd?.active) return result;

    let changed = false;

    // Detect task completions
    const completeMatch = answer.match(TASK_COMPLETE_RE);
    if (completeMatch) {
      const taskNum = parseInt(completeMatch[1], 10);
      if (!sdd.completedTasks.includes(taskNum)) {
        sdd.completedTasks.push(taskNum);
        sdd.completedTasks.sort((a, b) => a - b);
        sdd.currentTask = taskNum + 1;
        sdd.currentFixRound = 0;
        changed = true;
      }
    }

    // Detect fix rounds
    const fixMatch = answer.match(FIX_ROUND_RE);
    if (fixMatch) {
      const round = parseInt(fixMatch[2], 10);
      sdd.currentFixRound = round;
      sdd.totalFixRounds++;
      changed = true;

      // Enforce fix-round cap
      if (round >= FIX_ROUND_CAP) {
        return {
          ...result,
          context: [
            ...(result.context ?? []),
            `Proctor: fix-round cap reached (${round}/${FIX_ROUND_CAP}). ` +
              `Adjudicate each open finding — park contestable ones, ` +
              `rule on load-bearing ones. Do not dispatch another fix round.`,
          ],
        };
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
      changed = true;
    }

    if (changed) {
      await save($, KEYS.sdd, sdd);
    }

    return result;
  });

  // ───────────────────────────────────────────────────────────────────
  //  6. AGENT SPAWN ENFORCEMENT — model selection + tracking
  // ───────────────────────────────────────────────────────────────────

  on("agent.spawn", async ($: any, e: any, next: any) => {
    const sdd = await load<SDDState | null>($, KEYS.sdd, null);
    const session = await load<SessionState | null>($, KEYS.session, null);

    // Track agent count
    if (session) {
      session.agentsSpawned++;
      await save($, KEYS.session, session);
    }
    if (sdd?.active) {
      sdd.totalAgents++;
      await save($, KEYS.sdd, sdd);
    }

    const contextAdditions: string[] = [];

    // Model selection nudge — warn when no model explicitly set
    if (!e.model && sdd?.active) {
      const sessionModel = await $.session.model();
      contextAdditions.push(
        `Proctor SDD: no model specified for this subagent — it will ` +
          `inherit the session model (${sessionModel}). For mechanical ` +
          `implementation tasks, a cheaper model reduces cost. Specify ` +
          `the model explicitly.`
      );
    }

    // Fix-loop escalation enforcement
    if (sdd?.active && sdd.currentFixRound >= 4 && e.model) {
      const lastModel = sdd.lastImplementerModel;
      if (lastModel && e.model === lastModel) {
        contextAdditions.push(
          `Proctor SDD: fix-loop round ${sdd.currentFixRound}/` +
            `${FIX_ROUND_CAP}. You are dispatching with the same model ` +
            `(${lastModel}) that got stuck. SDD requires escalation to a ` +
            `more capable model for rounds 4-5.`
        );
      }
    }

    // Track the implementer model
    if (sdd?.active && e.model) {
      sdd.lastImplementerModel = e.model;
      await save($, KEYS.sdd, sdd);
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
  //  7. SDD PROGRESS DASHBOARD — ui.render above prompt
  // ───────────────────────────────────────────────────────────────────

  on(
    "ui.render",
    { component: "AbovePrompt" },
    async ($: any, e: any, next: any) => {
      const sdd = await load<SDDState | null>($, KEYS.sdd, null);
      if (!sdd?.active) return next(e);

      const t = await $.ui.resolve(e);
      const elapsed = Math.round((Date.now() - sdd.startedAt) / 60_000);
      const pct =
        sdd.totalTasks > 0
          ? Math.round(
              (sdd.completedTasks.length / sdd.totalTasks) * 100
            )
          : 0;

      const fixInfo =
        sdd.currentFixRound > 0
          ? ` | fix ${sdd.currentFixRound}/${FIX_ROUND_CAP}`
          : "";

      const rulingInfo =
        sdd.rulings.length > 0 ? ` | ${sdd.rulings.length} rulings` : "";

      const bar = `⚡ SDD ${pct}% — ` +
        `Task ${sdd.currentTask}/${sdd.totalTasks} ` +
        `(${sdd.completedTasks.length} done)` +
        `${fixInfo}` +
        ` | ${sdd.totalAgents} agents` +
        `${rulingInfo}` +
        ` | ${elapsed}m`;

      return (
        <t.Box>
          <t.Text>{bar}</t.Text>
        </t.Box>
      );
    }
  );

  // ───────────────────────────────────────────────────────────────────
  //  8. ATTRIBUTION — enhanced commit messages
  // ───────────────────────────────────────────────────────────────────

  on("attribution.text", async ($: any, e: any, next: any) => {
    const result = await next(e);
    const sdd = await load<SDDState | null>($, KEYS.sdd, null);

    if (!sdd?.active) return result;

    const evidence = await load<TestEvidence | null>($, KEYS.test, null);
    const additions: string[] = [];

    if (sdd.currentTask > 0) {
      additions.push(`[SDD Task ${sdd.currentTask}]`);
    }
    if (evidence && evidence.exitCode === 0) {
      additions.push(`[Tests: ${evidence.command} ✓]`);
    }

    if (additions.length > 0) {
      const text: string = result.text ?? "";
      return { ...result, text: text + "\n\n" + additions.join(" ") };
    }

    return result;
  });

  // ───────────────────────────────────────────────────────────────────
  //  9. CONTEXT PRESSURE WARNING — approaching compaction
  // ───────────────────────────────────────────────────────────────────

  on("turn.complete", async ($: any, e: any, next: any) => {
    const result = await next(e);
    const turnCount = await $.session.turnCount();

    // Warn at configurable threshold (60 turns is a rough proxy for
    // approaching context limits in a heavy-tool session)
    if (turnCount === 60 || turnCount === 80) {
      const sdd = await load<SDDState | null>($, KEYS.sdd, null);

      if (sdd?.active) {
        return {
          ...result,
          context: [
            ...(result.context ?? []),
            `Proctor: turn ${turnCount} — context pressure increasing. ` +
              `Your SDD state is persisted in the store and will survive ` +
              `compaction. Verify the ledger file is current. After ` +
              `compaction, the injected [PROCTOR — SDD STATE] block ` +
              `shows your recovery point.`,
          ],
        };
      }
    }

    return result;
  });

  // ───────────────────────────────────────────────────────────────────
  //  10. BRANCH CONSENT HANDLER — allow override after human approval
  // ───────────────────────────────────────────────────────────────────

  on("prompt.submit", async ($: any, e: any, next: any) => {
    const text: string = e.text ?? "";

    // Detect explicit consent for protected branch work
    const consentMatch = text.match(
      /\b(?:allow|consent|approve|yes,?\s*(?:commit|work)\s*(?:on|to)?)\s+(?:on\s+)?(\w+)\b/i
    );
    if (consentMatch) {
      const branch = consentMatch[1];
      const session = await load<SessionState | null>($, KEYS.session, null);
      if (session && session.protectedBranches.includes(branch)) {
        session.branchConsents[branch] = true;
        await save($, KEYS.session, session);
        $.ui.log(`Proctor: branch '${branch}' consent recorded`);
      }
    }

    // Detect SDD deactivation
    if (/\b(?:sdd\s+(?:done|finished|complete)|finishing-a-development-branch)\b/i.test(text)) {
      const sdd = await load<SDDState | null>($, KEYS.sdd, null);
      if (sdd?.active) {
        sdd.active = false;
        await save($, KEYS.sdd, sdd);
        $.ui.log("Proctor: SDD session marked complete");
      }
    }

    return next(e);
  });

  // ───────────────────────────────────────────────────────────────────
  //  11. RULING AGGREGATION — surface all rulings at session end
  // ───────────────────────────────────────────────────────────────────

  on("turn.complete", async ($: any, e: any, next: any) => {
    const result = await next(e);
    const answer: string = e.answer ?? "";

    // Detect session completion signals
    const isFinishing =
      /\b(finishing-a-development-branch|all\s+tasks?\s+complete|sdd\s+done)\b/i.test(
        answer
      );
    if (!isFinishing) return result;

    const sdd = await load<SDDState | null>($, KEYS.sdd, null);
    if (!sdd || sdd.rulings.length === 0) return result;

    const rulingList = sdd.rulings
      .map(
        (r, i) =>
          `${i + 1}. [Task ${r.task}, ${r.phase}] ${r.text}` +
          (r.costIfWrong !== "unknown" ? ` — cost: ${r.costIfWrong}` : "")
      )
      .join("\n");

    const minorList =
      sdd.deferredMinors.length > 0
        ? sdd.deferredMinors
            .map((m) => `- [Task ${m.task}] ${m.finding}`)
            .join("\n")
        : "none";

    return {
      ...result,
      context: [
        ...(result.context ?? []),
        `Proctor ruling aggregation — include these in your final message:\n\n` +
          `RULINGS MADE (${sdd.rulings.length}):\n${rulingList}\n\n` +
          `DEFERRED MINORS (${sdd.deferredMinors.length}):\n${minorList}`,
      ],
    };
  });
};
