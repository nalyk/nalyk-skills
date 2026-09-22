// Planning mode, the SDD run and its budgets, the commands, the tool
// descriptions, the dashboard and the commit attribution — through the
// real engine.

import { test, describe, expect } from "claude-code/testing";
import { world } from "./world.ts";

const SDD = "proctor:sdd-state:v3";
const SESSION = "proctor:session:v3";

describe("planning mode", () => {
  test("brainstorming blocks code writes and allows design docs", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.skill("proctor:brainstorming");
    expect((await w.write("Write", "/repo/src/a.ts")).deny).toContain("Write blocked");
    expect((await w.write("Edit", "/repo/src/Plan.tsx")).deny).toContain("Edit blocked");
    expect((await w.write("NotebookEdit", "/repo/n.ipynb")).deny).toContain("NotebookEdit blocked");
    expect((await w.write("Write", "/repo/docs/design/x.md")).deny).toBeUndefined();
    expect((await w.write("Write", "/repo/design/PLAN")).deny).toBeUndefined();
  });

  test("Bash writes are held to the same rule", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.skill("proctor:writing-plans");
    expect((await w.sh("cat > src/x.ts <<EOF\nx\nEOF")).deny).toContain("Bash write to 'src/x.ts'");
    expect((await w.sh("echo hi | tee -a lib/y.py")).deny).toContain("lib/y.py");
    expect((await w.sh("sed -i 's/a/b/' src/z.go")).deny).toContain("src/z.go");
    expect((await w.sh("ls > /dev/null")).deny).toBeUndefined();
    expect((await w.sh("echo a > notes.md")).deny).toBeUndefined();
    expect((await w.sh('echo "x > src/q.ts"')).deny).toBeUndefined();
  });

  test("approval lifts it", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.skill("proctor:brainstorming");
    await w.say("proctor: approve design");
    expect((await w.write("Write", "/repo/src/a.ts")).deny).toBeUndefined();
  });

  test("an implementation skill lifts it", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.skill("proctor:brainstorming");
    await w.skill("proctor:test-driven-development");
    expect((await w.write("Write", "/repo/src/a.ts")).deny).toBeUndefined();
    expect(w.shelf(SESSION).currentPhase).toBe("implementing");
  });

  test("reading a SKILL.md counts as invoking it", async ($, on) => {
    const w = world($, on);
    await w.start();
    await $.tool.call({ tool: "Read", file_path: "/x/skills/brainstorming/SKILL.md" } as any);
    expect(w.shelf(SESSION).lastSkillName).toBe("brainstorming");
    expect((await w.write("Write", "/repo/src/a.ts")).deny).toContain("planning mode");
  });
});

describe("an SDD run", () => {
  test("starts from the controller's announcement and parses the plan", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("Using subagent-driven-development on plan: docs/plan.md with 3 tasks");
    const sdd = w.shelf(SDD);
    expect(sdd.active).toBe(true);
    expect(sdd.totalTasks).toBe(3);
    expect(sdd.plan).toBe("docs/plan.md");
  });

  test("completes tasks, files evidence, and ends after the last", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("Starting subagent-driven-development for 2 tasks");
    await w.turn("Task 1: complete — evidence: 14 tests green\nTask 2 — done. result: shipped the parser");
    const sdd = w.shelf(SDD);
    expect(sdd.completedTasks).toEqual([1, 2]);
    expect(sdd.completedEvidence["1"]).toContain("14 tests green");
    expect(sdd.completedEvidence["2"]).toContain("shipped the parser");
    expect(sdd.active).toBe(false);
  });

  test("the step budget blocks every tool at 100%", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("Starting subagent-driven-development for 3 tasks");
    w.reshelve(SDD, (s) => ({ ...s, toolCallsThisTask: 100 }));
    expect((await w.sh("ls")).deny).toContain("has exhausted its step budget");
    expect((await w.write("Write", "/repo/src/a.ts")).deny).toContain("has exhausted");
    expect((await w.write("Edit", "/repo/src/a.ts")).deny).toContain("has exhausted");
  });

  test("the time budget blocks too", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("Starting subagent-driven-development for 3 tasks");
    w.reshelve(SDD, (s) => ({ ...s, taskStartedAt: Date.now() - 31 * 60_000 }));
    expect((await w.sh("ls")).deny).toContain("time budget");
  });

  test("budget extend and task completion reset it", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("Starting subagent-driven-development for 3 tasks");
    w.reshelve(SDD, (s) => ({ ...s, toolCallsThisTask: 100 }));
    await w.say("proctor: budget extend");
    expect((await w.sh("ls")).deny).toBeUndefined();
    w.reshelve(SDD, (s) => ({ ...s, toolCallsThisTask: 100 }));
    await w.turn("Task 1: complete");
    expect((await w.sh("ls")).deny).toBeUndefined();
  });

  test("each tool call is counted against the task", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("Starting subagent-driven-development for 3 tasks");
    await w.sh("ls");
    await w.write("Write", "/repo/src/a.ts");
    await w.write("Edit", "/repo/src/a.ts");
    expect(w.shelf(SDD).toolCallsThisTask).toBe(3);
  });

  test("rulings, deferred minors and fix rounds are recorded", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("Starting subagent-driven-development for 3 tasks");
    await w.turn(
      "Ruling: keep the cache — it halves latency — cost if wrong: stale reads\n" +
        "minor (deferred): rename the helper\n" +
        "Task 1: fix round 1 — approach: retry on 503",
    );
    const sdd = w.shelf(SDD);
    expect(sdd.rulings[0].text).toBe("keep the cache");
    expect(sdd.rulings[0].costIfWrong).toBe("stale reads");
    expect(sdd.deferredMinors[0].finding).toBe("rename the helper");
    expect(sdd.currentFixRound).toBe(1);
    expect(sdd.failedApproaches[0]).toContain("retry on 503");
  });

  test("tasks N and sdd stop", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("Starting subagent-driven-development for 3 tasks");
    await w.say("proctor: tasks 5");
    expect(w.shelf(SDD).totalTasks).toBe(5);
    await w.say("proctor: sdd stop");
    expect(w.shelf(SDD).active).toBe(false);
  });

  test("a resumed run gets a fresh task clock", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("Starting subagent-driven-development for 3 tasks");
    w.reshelve(SDD, (s) => ({ ...s, taskStartedAt: Date.now() - 15 * 3600_000, toolCallsThisTask: 99 }));
    await w.start();
    const sdd = w.shelf(SDD);
    expect(Date.now() - sdd.taskStartedAt).toBeLessThan(60_000);
    expect(sdd.toolCallsThisTask).toBe(0);
    expect(w.logText()).toContain("recovering SDD session");
  });
});

describe("commands", () => {
  test("status, check, diagnose and show trace report", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    await w.say("proctor: status");
    await w.say("proctor: check");
    await w.say("proctor: diagnose");
    await w.say("proctor: show trace");
    const out = w.logText();
    expect(out).toContain("─── Proctor Status ───");
    expect(out).toContain("Tests: passing");
    expect(out).toContain("─── Proctor Pre-flight Check ───");
    expect(out).toContain("✓ Tests: passing, fresh");
    expect(out).toContain("─── Proctor Diagnosis ───");
    expect(out).toContain("Proctor trace (last");
    expect(out).toContain("test-run: exit=0");
    expect(out).not.toContain("undefined");
  });

  test("quiet mode silences soft warnings, not gates", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.say("proctor: quiet on");
    await w.sh("rm -rf build/");
    expect(w.logText()).not.toContain("destructive command");
    expect((await w.sh("git commit -m x")).deny).toContain("no test evidence");
    await w.say("proctor: quiet off");
    await w.sh("rm -rf build/");
    expect(w.logText()).toContain("destructive command");
  });
});

describe("what the model is told up front", () => {
  test("the gated tools' descriptions name the gates", async ($, on) => {
    world($, on);
    for (const [tool, words] of [
      ["Bash", "fresh passing test evidence"],
      ["Agent", "specify `model` explicitly"],
      ["Write", "planning mode"],
      ["Edit", "planning mode"],
    ] as const) {
      const r = await $.tool.describe({ tool, description: "base" } as any);
      expect(r.description.startsWith("base")).toBe(true);
      expect(r.description).toContain(words);
    }
  });
});

describe("the dashboard and the commit line", () => {
  test("an SDD run draws above the prompt, within its box", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("Starting subagent-driven-development for 5 tasks");
    for (const bodyColumns of [120, 30]) {
      const m = await $.ui.mount({
        plugin: "proctor",
        surface: "terminal",
        component: "AbovePrompt",
        props: {
          hasSurvey: false,
          isWorking: false,
          maxRows: 3,
          bodyColumns,
          scroll: { offset: 0, bodyRows: 3 },
        },
      } as any);
      const drawn: any = await m.drawn();
      const line = drawn.children.map((t: any) => t.children.join("")).join("");
      expect(line).toContain("SDD");
      expect(line.length).toBeLessThanOrEqual(bodyColumns);
      await m.unmount();
    }
  });

  test("commit attribution names the task during a run", async ($, on) => {
    const w = world($, on);
    await w.start();
    const before = await $.attribution.text({ kind: "commit", text: "Co-Authored-By: x" });
    expect(before.text).toBe("Co-Authored-By: x");
    await w.turn("Starting subagent-driven-development for 3 tasks");
    await w.sh("npm test");
    const during = await $.attribution.text({ kind: "commit", text: "Co-Authored-By: x" });
    expect(during.text).toContain("[SDD Task 1/3]");
    expect(during.text).toContain("[Tests: ✓]");
  });
});
