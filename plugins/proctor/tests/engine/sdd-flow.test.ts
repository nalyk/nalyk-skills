// An SDD run as the skills actually drive it: the skill is invoked, the
// plan is read, and the controller reports itself in the ledger
// (`progress.md`) mid-turn, working through every task in one turn. The
// older tests fed the parsed phrases straight into a turn's answer, which
// no real run ever produced — this is the path a real run takes.

import { test, describe, expect } from "claude-code/testing";
import { world } from "./world.ts";

const SDD = "proctor:sdd-state:v3";
const SESSION = "proctor:session:v3";
const noted = (r: any) => (r?.context ?? []).join("\n");
const PLAN = "docs/plans/2026-09-22-parser.md";
const PLAN_TEXT = "# Parser\n\n### Task 1: lexer\n\n### Task 2: parser\n\n### Task 3: errors\n";

const ledgerEdit = ($: any, new_string: string, path = "/repo/progress.md") =>
  $.tool.call({ tool: "Edit", file_path: path, old_string: "", new_string } as any);
const ledgerWrite = ($: any, content: string, path = "/repo/progress.md") =>
  $.tool.call({ tool: "Write", file_path: path, content } as any);

async function running($: any, on: any, skill = "proctor:subagent-driven-development") {
  const w = world($, on);
  w.files[PLAN] = PLAN_TEXT;
  await w.start();
  await w.skill(skill);
  await $.tool.call({ tool: "Read", file_path: `/repo/${PLAN}` } as any);
  return w;
}

describe("the run starts and sizes itself", () => {
  test("invoking the SDD skill starts a tracked run", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.skill("proctor:subagent-driven-development");
    const sdd = w.shelf(SDD);
    expect(sdd.active).toBe(true);
    expect(sdd.plan).toBe("unknown");
    expect(w.logText()).toContain("SDD session started");
  });

  test("so does inline execution", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.skill("executing-plans");
    expect(w.shelf(SDD).active).toBe(true);
  });

  test("and a direct read of the skill's SKILL.md", async ($, on) => {
    const w = world($, on);
    await w.start();
    await $.tool.call({ tool: "Read", file_path: "/p/skills/subagent-driven-development/SKILL.md" } as any);
    expect(w.shelf(SDD).active).toBe(true);
  });

  test("re-invoking the skill mid-run does not reset it", async ($, on) => {
    const w = await running($, on);
    await ledgerEdit($, "Task 1: complete (review clean)");
    await w.skill("proctor:subagent-driven-development");
    expect(w.shelf(SDD).completedTasks).toEqual([1]);
  });

  test("reading the plan names it and counts its tasks", async ($, on) => {
    const w = await running($, on);
    const sdd = w.shelf(SDD);
    expect(sdd.plan).toBe(`/repo/${PLAN}`);
    expect(sdd.totalTasks).toBe(3);
  });

  test("a document that is not the plan does not resize the run", async ($, on) => {
    const w = await running($, on);
    w.files["docs/briefs/task-7.md"] = "### Task 7: other\n";
    await $.tool.call({ tool: "Read", file_path: "/repo/docs/briefs/task-7.md" } as any);
    expect(w.shelf(SDD).totalTasks).toBe(3);
  });

  test("an unnamed run ignores markdown that is not a plan", async ($, on) => {
    const w = world($, on);
    w.files["README.md"] = "### Task 9: nope\n";
    await w.start();
    await w.skill("proctor:subagent-driven-development");
    await $.tool.call({ tool: "Read", file_path: "/repo/README.md" } as any);
    expect(w.shelf(SDD).totalTasks).toBe(0);
  });

  test("the ledger header sizes a run whose plan was not read", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.skill("proctor:subagent-driven-development");
    await ledgerWrite($, "# Progress\nPlan: docs/plans/x.md — 4 tasks\n");
    const sdd = w.shelf(SDD);
    expect(sdd.plan).toBe("docs/plans/x.md");
    expect(sdd.totalTasks).toBe(4);
  });

  test("Task N: added in the ledger grows the run", async ($, on) => {
    const w = await running($, on);
    const r = await ledgerEdit($, "Task 4: added — split out of task 2");
    expect(w.shelf(SDD).totalTasks).toBe(4);
    expect(noted(r)).toContain("SDD scope expanded to 4 tasks");
  });
});

describe("the ledger drives the run, mid-turn", () => {
  test("a completion line advances the task and says so on the result", async ($, on) => {
    const w = await running($, on);
    await w.sh("ls");
    await w.sh("ls");
    const r = await ledgerEdit($, "Task 1: complete (commits abc1234..def5678, review clean)");
    expect(noted(r)).toContain("Task 1 complete (1/3). Next: Task 2. Budget reset — 100 steps available.");
    const sdd = w.shelf(SDD);
    expect(sdd.completedTasks).toEqual([1]);
    expect(sdd.currentTask).toBe(2);
    expect(sdd.toolCallsThisTask).toBe(0);
    expect(sdd.completedEvidence["1"]).toBe("commits abc1234..def5678, review clean");
  });

  test("a line appended through the shell counts the same", async ($, on) => {
    const w = await running($, on);
    const r = await w.sh(
      "cat >> progress.md <<'EOF'\n" +
        "Task 1: fix round 1 — approach: widen the lock window\n" +
        "minor (deferred): rename the helper\n" +
        "Ruling: keep the cache — halves latency — cost if wrong: stale reads\n" +
        "EOF",
    );
    expect(r.deny).toBeUndefined();
    const sdd = w.shelf(SDD);
    expect(sdd.currentFixRound).toBe(1);
    expect(sdd.failedApproaches).toEqual(["Task 1 R1: widen the lock window"]);
    expect(sdd.deferredMinors).toEqual([{ task: 1, finding: "rename the helper" }]);
    expect(sdd.rulings[0]).toMatchObject({ text: "keep the cache", costIfWrong: "stale reads", phase: "fix-loop" });
  });

  test("the whole ledger rewritten, and repeated in the answer, counts once", async ($, on) => {
    const w = await running($, on);
    const lines = [
      "Plan: docs/plans/2026-09-22-parser.md — 3 tasks",
      "Ruling: lex eagerly — simpler — cost if wrong: memory",
      "Task 1: complete (review clean)",
      "Task 2: fix round 1 — approach: memoise the lookahead",
      "minor (deferred): tighten the error text",
    ];
    await ledgerWrite($, lines.join("\n"));
    await ledgerWrite($, lines.join("\n") + "\nTask 2: complete (review clean)");
    await w.turn(lines.join("\n") + "\nTask 2: complete");
    const sdd = w.shelf(SDD);
    expect(sdd.completedTasks).toEqual([1, 2]);
    expect(sdd.rulings.length).toBe(1);
    expect(sdd.totalFixRounds).toBe(1);
    expect(sdd.failedApproaches.length).toBe(1);
    expect(sdd.deferredMinors.length).toBe(1);
    await w.say("proctor: status");
    expect(w.logText()).toContain("1 fix rounds");
    expect(w.logText()).toContain("Rulings remembered: 1");
  });

  test("the skills' template lines are not signals", async ($, on) => {
    const w = await running($, on);
    await ledgerWrite(
      $,
      "Record as `Ruling: <what you decided> — <why> — <cost if wrong>`\nminor (deferred): <finding>\n",
    );
    const sdd = w.shelf(SDD);
    expect(sdd.rulings.length).toBe(0);
    expect(sdd.deferredMinors.length).toBe(0);
  });

  test("only the ledger is read: code that quotes the phrases is not", async ($, on) => {
    const w = await running($, on);
    await ledgerWrite($, 'const s = "Task 1: complete";', "/repo/src/fixture.ts");
    await $.tool.call({ tool: "Edit", file_path: "/repo/tests/a.test.ts", old_string: "", new_string: "Task 1: complete" } as any);
    await w.sh("echo 'Task 1: complete' > src/log.txt");
    expect(w.shelf(SDD).completedTasks).toEqual([]);
    await ledgerWrite($, "Task 1: complete", "/repo/docs/plans/progress.md");
    expect(w.shelf(SDD).completedTasks).toEqual([1]);
  });

  test("the last task ends the run and aggregates the rulings on the spot", async ($, on) => {
    const w = await running($, on);
    await ledgerEdit($, "Ruling: one parser — less code — cost if wrong: slower builds\nTask 1: complete");
    await ledgerEdit($, "Task 2: complete");
    const r = await ledgerEdit($, "minor (deferred): doc the grammar\nTask 3: complete (review clean)");
    const n = noted(r);
    expect(n).toContain("all 3 tasks done. Next: run tests, then invoke finishing-a-development-branch.");
    expect(n).toContain("RULINGS MADE (1):\n1. [Task 1, preflight] one parser — cost: slower builds");
    expect(n).toContain("DEFERRED MINORS (1):\n- [Task 3] doc the grammar");
    const sdd = w.shelf(SDD);
    expect(sdd.active).toBe(false);
    expect(sdd.pendingDoneCheck).toBe(true);
    expect(sdd.currentTask).toBe(3);
    expect(w.logText()).toContain("SDD run complete — 3 tasks");
  });

  test("a finished run is not restarted by the summary that mentions it", async ($, on) => {
    const w = await running($, on);
    await ledgerWrite($, "Task 1: complete\nTask 2: complete\nTask 3: complete");
    await w.turn("The subagent-driven-development run is done: all three tasks shipped.");
    expect(w.shelf(SDD).active).toBe(false);
    await w.turn("Using proctor:subagent-driven-development to execute the next plan (2 tasks)");
    expect(w.shelf(SDD)).toMatchObject({ active: true, totalTasks: 2, completedTasks: [] });
  });
});

describe("finishing", () => {
  test("the finishing skill carries the done-check and every ruling", async ($, on) => {
    const w = await running($, on);
    await ledgerWrite($, "Ruling: no cache — simpler — cost if wrong: latency\nTask 1: complete\nTask 2: complete\nTask 3: complete");
    const early = await w.skill("proctor:finishing-a-development-branch", "FINISH");
    expect(early.text).toContain("FINISH");
    expect(early.text).toContain("done-check FAILED");
    expect(early.text).toContain("no test evidence — run the test suite");
    expect(early.text).toContain("RULINGS MADE (1)");
    expect(w.shelf(SDD).pendingDoneCheck).toBe(true);

    await w.sh("npm test");
    const ready = await w.skill("proctor:finishing-a-development-branch", "FINISH");
    expect(ready.text).toContain("done-check passed");
    expect(ready.text).toContain("RULINGS MADE (1)");
    expect(w.shelf(SDD).pendingDoneCheck).toBe(false);

    const later = await w.skill("proctor:finishing-a-development-branch", "FINISH");
    expect(later.text).not.toContain("done-check");
  });

  test("a finish claimed early lists what is missing", async ($, on) => {
    const w = await running($, on);
    await ledgerEdit($, "Task 1: complete\nTask 2: fix round 2 — approach: retry the parse");
    w.bash = (c) => (c === "npm test" ? { fail: "Exit code 1\n1 failing" } : { ok: "" });
    await w.sh("npm test");
    await w.turn("All tasks complete — invoking finishing-a-development-branch.");
    const n = noted(await w.say("ok"));
    expect(n).toContain("Proctor SDD done-check FAILED — resolve before finishing:");
    expect(n).toContain("• 2 tasks not marked complete");
    expect(n).toContain("• fix round 2 still open on Task 2");
    expect(n).toContain("• tests failing (exit 1)");
  });

  test("stale and unproven evidence fail the check", async ($, on) => {
    const w = await running($, on);
    await ledgerWrite($, "Task 1: complete\nTask 2: complete\nTask 3: complete");
    await w.sh("npm test | tail -5");
    expect((await w.skill("finishing-a-development-branch")).text).toContain("tests unproven (exit status hidden)");
    await w.sh("npm test");
    w.reshelve("proctor:test-evidence:v3", (ev) => ({ ...ev, timestamp: Date.now() - 9 * 60_000 }));
    expect((await w.skill("finishing-a-development-branch")).text).toContain("test evidence stale (9m ago)");
  });

  test("a merge waits for the run to be done", async ($, on) => {
    const w = await running($, on);
    await w.sh("npm test");
    await ledgerEdit($, "Task 1: complete\nTask 2: fix round 1 — approach: new grammar");
    const r = await w.sh("git merge feat");
    expect(r.deny).toContain("the SDD run is not done — merge blocked");
    expect(r.deny).toContain("2 tasks not marked complete");
    expect(r.deny).toContain("fix round 1 still open on Task 2");
    expect((await w.sh("git commit -m wip")).deny).toBeUndefined();
    await ledgerEdit($, "Task 2: complete\nTask 3: complete");
    expect((await w.sh("git merge feat")).deny).toBeUndefined();
  });

  test("an abandoned run can be merged after sdd stop", async ($, on) => {
    const w = await running($, on);
    await w.sh("npm test");
    expect((await w.sh("git merge feat")).deny).toContain("not done");
    await w.say("proctor: sdd stop");
    expect((await w.sh("git merge feat")).deny).toBeUndefined();
    expect(w.shelf(SDD).pendingDoneCheck).toBe(false);
  });
});

describe("budgets arrive when they are crossed", () => {
  test("80% and 100% of the step budget, once each, on the tool result", async ($, on) => {
    const w = await running($, on);
    w.reshelve(SDD, (s) => ({ ...s, toolCallsThisTask: 79 }));
    expect(noted(await w.sh("ls"))).toContain("step budget at 80% for Task 1 (80/100). Start wrapping up.");
    expect(noted(await w.write("Write", "/repo/src/a.ts"))).not.toContain("step budget");
    w.reshelve(SDD, (s) => ({ ...s, toolCallsThisTask: 99 }));
    expect(noted(await w.write("Edit", "/repo/src/a.ts"))).toContain("step budget exhausted for Task 1 (100/100). The next tool call is blocked.");
    expect((await w.write("NotebookEdit", "/repo/n.ipynb")).deny).toContain("step budget (100/100 tool calls)");
    await w.turn("stopped");
    expect(noted(await w.say("go"))).not.toContain("step budget exhausted");
  });

  test("80% of the time budget, on the tool result", async ($, on) => {
    const w = await running($, on);
    w.reshelve(SDD, (s) => ({ ...s, taskStartedAt: Date.now() - 25 * 60_000 }));
    expect(noted(await w.sh("ls"))).toMatch(/time budget at 8\d% for Task 1 \(25m \/ 30m\)/);
    expect(noted(await w.sh("ls"))).not.toContain("time budget");
  });

  test("a turn that crossed a threshold with no tool call still hears of it", async ($, on) => {
    const w = await running($, on);
    w.reshelve(SDD, (s) => ({ ...s, taskStartedAt: Date.now() - 31 * 60_000 }));
    await w.turn("thinking");
    expect(noted(await w.say("go"))).toContain("time budget exhausted for Task 1 (31m / 30m)");
  });

  test("the deny is not repeated as a turn-end note", async ($, on) => {
    const w = await running($, on);
    w.reshelve(SDD, (s) => ({ ...s, taskStartedAt: Date.now() - 31 * 60_000 }));
    expect((await w.sh("ls")).deny).toContain("time budget");
    await w.turn("blocked");
    expect(noted(await w.say("go"))).not.toContain("time budget exhausted");
  });
});

describe("the fix-round cap blocks dispatch past it", () => {
  const dispatch = ($: any, prompt: string, model?: string) =>
    $.tool.call({ tool: "Agent", description: "fix", prompt, subagent_type: "general-purpose", ...(model ? { model } : {}) } as any);

  test("round 5 of 5 may still dispatch; round 6 may not", async ($, on) => {
    const w = await running($, on);
    await ledgerEdit($, "Task 1: fix round 5 — approach: last structured attempt");
    expect((await dispatch($, "Re-review Task 1: fix round 5", "opus")).deny).toBeUndefined();
    const r = await dispatch($, "Implement fix round 6 for the open findings", "opus");
    expect(r.deny).toContain("Task 1 is past its fix-round cap (round 6 of 5)");
    expect(r.deny).toContain("Ruling:");
  });

  test("a sixth round in the ledger blocks every dispatch until the task closes", async ($, on) => {
    const w = await running($, on);
    await ledgerEdit($, "Task 1: fix round 6 — approach: one more try");
    expect((await dispatch($, "review the diff", "opus")).deny).toContain("past its fix-round cap");
    await ledgerEdit($, "Ruling: park the flaky finding — not load-bearing — cost if wrong: a retry\nTask 1: complete");
    expect((await dispatch($, "implement task 2", "haiku")).deny).toBeUndefined();
  });

  test("another task's round does not trip this task's cap", async ($, on) => {
    const w = await running($, on);
    expect((await dispatch($, "context: Task 3: fix round 7 happened in the old plan", "haiku")).deny).toBeUndefined();
  });

  test("the escalation rounds flag a dispatch on the same model", async ($, on) => {
    const w = await running($, on);
    await $.agent.spawn({
      tool_use_id: "t1", prompt: "impl", description: "impl", subagentType: "general-purpose",
      provider: { kind: "engine" }, parentModel: "claude-opus-5", model: "sonnet",
    } as any);
    await ledgerEdit($, "Task 1: fix round 4 — approach: rewrite the retry");
    expect(noted(await dispatch($, "fix", "sonnet"))).toContain("fix round 4/5 with same model (sonnet). Try a more capable model.");
    expect(noted(await dispatch($, "fix", "opus"))).not.toContain("same model");
  });
});

describe("agent spawns are counted", () => {
  test("in the session, and against the run and its task", async ($, on) => {
    const w = await running($, on);
    await $.agent.spawn({
      tool_use_id: "t1", prompt: "impl", description: "impl", subagentType: "general-purpose",
      provider: { kind: "engine" }, parentModel: "claude-opus-5", model: "haiku",
    } as any);
    const sdd = w.shelf(SDD);
    expect(sdd.totalAgents).toBe(1);
    expect(sdd.toolCallsThisTask).toBe(1);
    expect(sdd.lastImplementerModel).toBe("haiku");
    expect(w.shelf(SESSION).agentsSpawned).toBe(1);
    await w.say("proctor: status");
    expect(w.logText()).toContain("Agents spawned: 1");
    await w.say("proctor: show trace");
    expect(w.logText()).toContain("agent-spawn: model=haiku");
  });
});
