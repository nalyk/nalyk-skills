// Every userConfig option, set away from its default, through the real
// options pipeline: this fixture's manifest declares Proctor's userConfig
// with other defaults, the engine fills `options` from it, and the module
// under test is a byte-for-byte copy of plugins/proctor/hooks/proctor.tsx
// that `make test` refreshes (and compares) before every run.
//
//   protectedBranches        trunk, prod
//   executableDocPatterns    handbook/**, *.run.md
//   testFreshnessMinutes     2
//   watchdogTurnThreshold    2
//   fixRoundCap              3
//   stepBudgetPerTask        20
//   timeBudgetPerTaskMinutes 5

import { test, describe, expect } from "claude-code/testing";
import { world } from "./world.ts";

const EVIDENCE = "proctor:test-evidence:v3";
const SDD = "proctor:sdd-state:v3";
const noted = (r: any) => (r?.context ?? []).join("\n");
const SDD_START = "Starting subagent-driven-development for 3 tasks";

describe("protectedBranches", () => {
  test("the configured branches are the protected ones", async ($, on) => {
    const w = world($, on, { branch: "trunk" });
    await w.start();
    expect(w.logText()).toContain("protected: trunk,prod");
    await w.sh("npm test");
    expect((await w.sh("git commit -m x")).deny).toContain("protected branch 'trunk'");
  });

  test("the defaults are no longer protected", async ($, on) => {
    const w = world($, on, { branch: "main" });
    await w.start();
    await w.sh("npm test");
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
    expect((await w.sh("git reset --hard HEAD~1")).deny).toBeUndefined();
  });

  test("consent follows the configured list", async ($, on) => {
    const w = world($, on, { branch: "prod" });
    await w.start();
    await w.sh("npm test");
    await w.say("proctor: allow main");
    expect(w.logText()).toContain("Protected: trunk, prod.");
    expect((await w.sh("git commit -m x")).deny).toContain("'prod'");
    await w.say("proctor: allow prod");
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
  });

  test("a same-line switch onto a configured branch is judged there", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    expect((await w.sh("git checkout trunk && git merge feat")).deny).toContain("'trunk'");
  });
});

describe("executableDocPatterns", () => {
  test("a declared folder keeps the gate enforcing on its markdown", async ($, on) => {
    const w = world($, on);
    await w.start();
    w.git["git status --porcelain"] = { stdout: " M handbook/deploy.md\n" };
    expect((await w.sh("git commit -m x")).deny).toContain("no test evidence");
  });

  test("a basename glob matches at any depth, as a .gitignore glob does", async ($, on) => {
    const w = world($, on);
    await w.start();
    w.git["git status --porcelain"] = { stdout: " M ops.run.md\n" };
    expect((await w.sh("git commit -m x")).deny).toContain("no test evidence");
    w.git["git status --porcelain"] = { stdout: " M docs/deep/ops.run.md\n" };
    expect((await w.sh("git commit -m x")).deny).toContain("no test evidence");
  });

  test("undeclared prose still steps aside", async ($, on) => {
    const w = world($, on);
    await w.start();
    w.git["git status --porcelain"] = { stdout: " M docs/guide.md\n M notes.run.txt\n" };
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
    expect(w.logText()).toContain("prose-only change (2 files)");
  });
});

describe("testFreshnessMinutes", () => {
  test("evidence inside the window counts", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    w.reshelve(EVIDENCE, (ev) => ({ ...ev, timestamp: Date.now() - 90_000 }));
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
  });

  test("evidence past the window is stale, and says the limit", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    w.reshelve(EVIDENCE, (ev) => ({ ...ev, timestamp: Date.now() - 3 * 60_000 }));
    const r = await w.sh("git commit -m x");
    expect(r.deny).toContain("test evidence is stale (3m ago, limit: 2m)");
    expect(r.deny).toContain("within 2m");
  });

  test("the status block and the check use the same window", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    w.reshelve(EVIDENCE, (ev) => ({ ...ev, timestamp: Date.now() - 3 * 60_000 }));
    expect(noted(await w.say("proctor: check"))).toContain("✗ STALE");
    expect(w.logText()).toContain("✗ Tests: STALE (3m ago)");
  });
});

describe("watchdogTurnThreshold", () => {
  test("the nudge fires at the configured turn", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("one");
    expect(noted(await w.say("a"))).not.toContain("without a skill");
    await w.turn("two");
    expect(noted(await w.say("b"))).toContain("2 turns without a skill");
  });
});

describe("fixRoundCap", () => {
  test("the cap note fires at the configured round", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn(SDD_START);
    await w.turn("Task 1: fix round 2 — approach: first idea");
    expect(noted(await w.say("go"))).not.toContain("fix-round limit");
    await w.turn("Task 1: fix round 3 — approach: second idea");
    const n = noted(await w.say("go"));
    expect(n).toContain("fix-round limit reached (3/3)");
    expect(n).toContain("fix round 3/3");
  });

  test("the loop detector is not consulted at or past the cap", async ($, on) => {
    const w = world($, on);
    let asked = 0;
    w.fork = () => {
      asked++;
      return { text: '{"looping":true,"signal":"x"}' };
    };
    await w.start();
    await w.turn(SDD_START);
    await w.turn("Task 1: fix round 3 — approach: third idea. " + "x".repeat(120));
    expect(asked).toBe(0);
  });
});

describe("stepBudgetPerTask", () => {
  test("warns at 80%, blocks at 100%, counted in the configured unit", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn(SDD_START);
    for (let i = 0; i < 15; i++) expect(noted(await w.sh("ls"))).not.toContain("step budget");
    expect(noted(await w.sh("ls"))).toContain("step budget at 80% for Task 1 (16/20)");
    for (let i = 0; i < 3; i++) expect((await w.sh("ls")).deny).toBeUndefined();
    expect(noted(await w.sh("ls"))).toContain("step budget exhausted for Task 1 (20/20)");
    expect((await w.sh("ls")).deny).toContain("step budget (20/20 tool calls)");
  });

  test("the task-advance note names the configured budget", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn(SDD_START);
    await w.turn("Task 1: complete");
    expect(noted(await w.say("go"))).toContain("Budget reset — 20 steps available.");
  });
});

describe("timeBudgetPerTaskMinutes", () => {
  test("warns at 80% and blocks at 100% of the configured clock", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn(SDD_START);
    w.reshelve(SDD, (s) => ({ ...s, taskStartedAt: Date.now() - 4.5 * 60_000 }));
    expect(noted(await w.sh("ls"))).toMatch(/time budget at 9\d% for Task 1 \(\d+m \/ 5m\)/);
    w.reshelve(SDD, (s) => ({ ...s, taskStartedAt: Date.now() - 5 * 60_000 - 1000 }));
    expect((await w.sh("ls")).deny).toContain("time budget (5m/5m)");
  });

  test("a turn past the clock with no tool call still hears of it", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn(SDD_START);
    w.reshelve(SDD, (s) => ({ ...s, taskStartedAt: Date.now() - 6 * 60_000 }));
    await w.turn("thinking");
    expect(noted(await w.say("go"))).toContain("time budget exhausted for Task 1 (6m / 5m)");
  });

  test("the compaction block reports the configured clock", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn(SDD_START);
    const r = await $.prompt.context({ blocks: [] } as any);
    expect(r.blocks[0].text).toContain("Step budget: 0/20 (0%)");
    expect(r.blocks[0].text).toMatch(/Time budget: 0m\/5m \(0%\)/);
  });
});

describe("fixRoundCap drives the dispatch gate and the escalation rounds", () => {
  const dispatch = ($: any, prompt: string, model: string) =>
    $.tool.call({ tool: "Agent", description: "fix", prompt, subagent_type: "general-purpose", model } as any);

  test("round 4 of a cap of 3 is not dispatched", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn(SDD_START);
    await w.turn("Task 1: fix round 3 — approach: third");
    expect((await dispatch($, "re-review Task 1: fix round 3", "opus")).deny).toBeUndefined();
    expect((await dispatch($, "Task 1: fix round 4", "opus")).deny).toContain("(round 4 of 3)");
  });

  test("the last two rounds of the cap flag a same-model dispatch", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn(SDD_START);
    await $.agent.spawn({
      tool_use_id: "t", prompt: "p", description: "d", subagentType: "g",
      provider: { kind: "engine" }, parentModel: "m", model: "sonnet",
    } as any);
    await w.turn("Task 1: fix round 1 — approach: first");
    expect(noted(await dispatch($, "fix", "sonnet"))).not.toContain("same model");
    await w.turn("Task 1: fix round 2 — approach: second");
    expect(noted(await dispatch($, "fix", "sonnet"))).toContain("fix round 2/3 with same model (sonnet)");
  });
});
