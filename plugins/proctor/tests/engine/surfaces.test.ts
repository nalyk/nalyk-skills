// What Proctor draws and writes where the person and the model see it:
// the dashboard, the commit line, the status block, the compaction block,
// and the state a skill's prompt carries.

import { test, describe, expect } from "claude-code/testing";
import { world } from "./world.ts";

const SDD = "proctor:sdd-state:v3";
const EVIDENCE = "proctor:test-evidence:v3";
const noted = (r: any) => (r?.context ?? []).join("\n");
const SDD_START = "Starting subagent-driven-development for 5 tasks";

// Cells, independently of the plugin's own measure: the East Asian wide
// ranges and the emoji-presentation glyphs Proctor draws.
const wide = (c: number) =>
  c === 0x26a1 || (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) ||
  (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xff00 && c <= 0xff60) || (c >= 0x1f300 && c <= 0x1faff);
const cells = (s: string) => [...s].reduce((n, ch) => n + (wide(ch.codePointAt(0)!) ? 2 : 1), 0);

const textOf = (node: any): string =>
  typeof node === "string" ? node : (node?.children ?? []).map(textOf).join("");

async function dashboard($: any, surface: "terminal" | "desktop", bodyColumns: number) {
  const m = await $.ui.mount({
    plugin: "proctor",
    surface,
    component: "AbovePrompt",
    props: { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns, scroll: { offset: 0, bodyRows: 3 } },
  } as any);
  const line = textOf(await m.drawn());
  await m.unmount();
  return line;
}

describe("the dashboard", () => {
  for (const surface of ["terminal", "desktop"] as const) {
    test(`${surface}: every segment when there is room`, async ($, on) => {
      const w = world($, on);
      await w.start();
      await w.turn(SDD_START);
      await w.turn(
        "Task 1: complete\nTask 2: fix round 2 — approach: x\nRuling: a — b — c\nminor (deferred): d",
      );
      await $.agent.spawn({
        tool_use_id: "t", prompt: "p", description: "d", subagentType: "g",
        provider: { kind: "engine" }, parentModel: "m", model: "haiku",
      } as any);
      const line = await dashboard($, surface, 200);
      expect(line).toMatch(/^⚡ SDD 20% │ T2\/5 \(1✓\) │ fix 2\/5 │ steps 1% │ 1 agents │ 1 rulings │ 1 deferred │ \d+m$/);
    });

    test(`${surface}: fits its box in cells at every width`, async ($, on) => {
      const w = world($, on);
      await w.start();
      await w.turn(SDD_START);
      for (const width of [120, 53, 40, 30, 20, 12, 8, 5, 3, 2, 1]) {
        const line = await dashboard($, surface, width);
        expect(cells(line), `width ${width}: "${line}"`).toBeLessThanOrEqual(width);
        if (width >= 8) expect(line).toContain("SDD");
      }
    });
  }

  test("no run, nothing of Proctor's drawn", async ($, on) => {
    const w = world($, on);
    await w.start();
    let line = "";
    try {
      line = await dashboard($, "terminal", 80);
    } catch {
      line = "";
    }
    expect(line).not.toContain("SDD");
  });
});

describe("the commit line", () => {
  test("names the task, fresh passing tests and the rulings", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn(SDD_START);
    await w.turn("Ruling: a — b — c");
    await w.sh("npm test");
    const r = await $.attribution.text({ kind: "commit", text: "Co-Authored-By: x" });
    expect(r.text).toBe("Co-Authored-By: x\n[SDD Task 1/5] [Tests: ✓] [1 rulings]");
  });

  test("claims no test pass that is stale, failing or unproven", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn(SDD_START);
    await w.sh("npm test");
    w.reshelve(EVIDENCE, (ev) => ({ ...ev, timestamp: Date.now() - 6 * 60_000 }));
    expect((await $.attribution.text({ kind: "commit", text: "x" })).text).toBe("x\n[SDD Task 1/5]");
    w.bash = () => ({ fail: "Exit code 1" });
    await w.sh("npm test");
    expect((await $.attribution.text({ kind: "commit", text: "x" })).text).not.toContain("Tests");
    w.bash = () => ({ ok: "" });
    await w.sh("npm test | cat");
    expect((await $.attribution.text({ kind: "commit", text: "x" })).text).not.toContain("Tests");
  });
});

describe("the status block on each prompt", () => {
  test("carries the run, the tests, planning and phase", async ($, on) => {
    const w = world($, on);
    w.bash = (c) => (c === "npm test" ? { fail: "Exit code 1\nAssertionError: 2 !== 3" } : { ok: "" });
    await w.start();
    await w.skill("proctor:writing-plans");
    await w.turn(SDD_START);
    await w.sh("npm test");
    const n = noted(await w.say("go"));
    expect(n).toContain("[PROCTOR]");
    expect(n).toContain("SDD: Task 1/5 · 0 complete · fix round 0/5 · steps 1%");
    expect(n).toMatch(/Tests: ✓ fresh · FAILING \(exit 1\) · 0m ago · cmd: npm test/);
    expect(n).toContain("Failure: Exit code 1\nAssertionError: 2 !== 3");
    expect(n).toContain("Planning: ON (proctor:writing-plans) — Write/Edit/NotebookEdit BLOCKED");
    expect(n).toContain("Phase: planning (proctor:writing-plans)");
  });

  test("no hint where no suite exists or the human said so", async ($, on) => {
    const w = world($, on, { files: { "README.md": "" } });
    await w.start();
    expect(noted(await w.say("hi"))).not.toContain("required before commit");
  });

  test("nor once the human has said there are no tests", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.say("proctor: no tests");
    expect(noted(await w.say("hi"))).not.toContain("required before commit");
  });

  test("notes come before the status, after another plugin's context", async ($, on) => {
    const w = world($, on);
    await w.start();
    for (let i = 0; i < 4; i++) await w.turn("x");
    const r = await $.prompt.submit({ text: "go", context: ["theirs"] } as any);
    expect(r.context[0]).toBe("theirs");
    expect(r.context[1]).toContain("turns without a skill");
    expect(r.context[2]).toContain("[PROCTOR]");
  });
});

describe("the compaction block", () => {
  test("carries everything a resumed run needs", async ($, on) => {
    const w = world($, on);
    w.bash = (c) => (c === "npm test" ? { fail: "Exit code 1\nTypeError: x is undefined" } : { ok: "" });
    await w.start();
    await w.turn("Using subagent-driven-development on plan: docs/p.md with 5 tasks");
    await w.turn(
      "Ruling: keep v1 — compat — cost if wrong: a migration\n" +
        "Task 1: complete — evidence: 12 tests green\n" +
        "Task 2: fix round 1 — approach: patched the parser\n" +
        "minor (deferred): rename x",
    );
    await w.sh("npm test");
    const r = await $.prompt.context({ blocks: [{ name: "proctor", text: "stale copy" }] } as any);
    const blocks = r.blocks.filter((b: any) => b.name === "proctor");
    expect(blocks.length).toBe(1);
    const t = blocks[0].text;
    for (const line of [
      "[PROCTOR — SDD STATE — survives compaction]",
      "Plan: docs/p.md",
      "Tasks: 1/5 complete",
      "Completed: 1",
      "Current: Task 2",
      "Resume from: Task 2",
      "Fix rounds this task: 1 | total: 1",
      "Step budget: 1/100 (1%)",
      "Time budget: 0m/30m (0%)",
      "Rulings made (1):\n  Task 1 [preflight]: keep v1 (cost: a migration)",
      "Deferred minors: [Task 2] rename x",
      "DO NOT REDO — these approaches failed:\n  1. Task 2 R1: patched the parser",
      "Completed task evidence:\n  Task 1: 12 tests green",
      "Last test run: FAILING (exit 1) · 0m ago · npm test",
      "Failure output:\nExit code 1\nTypeError: x is undefined",
    ])
      expect(t).toContain(line);
  });
});

describe("what a skill's prompt carries", () => {
  test("the run, its rulings, the tests, the branch and planning", async ($, on) => {
    const w = world($, on, { branch: "master" });
    await w.start();
    await w.turn(SDD_START);
    await w.turn("Ruling: keep it — fine — cost if wrong: none");
    await w.sh("npm test | tail");
    await w.skill("proctor:brainstorming");
    const r = await w.skill("proctor:receiving-code-review", "BODY");
    expect(r.text.startsWith("BODY\n\n[PROCTOR — LIVE STATE]")).toBe(true);
    expect(r.text).toMatch(/Task 1\/5 · 0 complete · Fix round 0\/5 · Steps \d+\/100 \(\d+%\) · 0 agents · \d+m elapsed/);
    expect(r.text).toContain("Active rulings: keep it");
    expect(r.text).toContain("Test evidence: ✓ fresh · UNPROVEN (exit status hidden) · 0m ago");
    expect(r.text).toContain("Branch: master ⚠ PROTECTED");
    expect(r.text).toContain("Planning mode: ACTIVE (proctor:brainstorming)");
  });

  test("stale evidence is called stale", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    w.reshelve(EVIDENCE, (ev) => ({ ...ev, timestamp: Date.now() - 8 * 60_000 }));
    expect((await w.skill("x")).text).toContain("Test evidence: ✗ STALE · passing · 8m ago");
  });
});

describe("skills move the phase", () => {
  for (const [skill, phase, planning] of [
    ["brainstorming", "brainstorming", true],
    ["proctor:writing-plans", "planning", true],
    ["test-driven-development", "implementing", false],
    ["proctor:subagent-driven-development", "implementing", false],
    ["executing-plans", "implementing", false],
    ["proctor:systematic-debugging", "implementing", false],
    ["requesting-code-review", "reviewing", false],
    ["proctor:receiving-code-review", "reviewing", false],
    ["finishing-a-development-branch", "finishing", false],
  ] as const) {
    test(`${skill} → ${phase}`, async ($, on) => {
      const w = world($, on);
      await w.start();
      await w.skill(skill);
      const s = w.shelf("proctor:session:v3");
      expect(s.currentPhase).toBe(phase);
      expect(s.planningMode).toBe(planning);
      expect(s.lastSkillName).toBe(skill);
      await w.say("proctor: show trace");
      expect(w.logText()).toContain(`phase-transition: idle → ${phase} (${skill})`);
    });
  }

  test("a skill outside the lifecycle leaves the phase where it was", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.skill("proctor:test-driven-development");
    await w.skill("proctor:writing-skills");
    const s = w.shelf("proctor:session:v3");
    expect(s.currentPhase).toBe("implementing");
    expect(s.lastSkillName).toBe("proctor:writing-skills");
  });

  test("any skill resets the watchdog", async ($, on) => {
    const w = world($, on);
    await w.start();
    for (let i = 0; i < 3; i++) await w.turn("x");
    await w.skill("proctor:writing-skills");
    for (let i = 0; i < 3; i++) await w.turn("x");
    expect(noted(await w.say("go"))).not.toContain("without a skill");
  });
});

describe("planning mode's edges", () => {
  test("a design folder does not exempt the code inside it", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.skill("brainstorming");
    expect((await w.write("Write", "/repo/design/src/app.ts")).deny).toContain("Write blocked");
    expect((await w.write("Write", "/repo/docs/plan/impl.py")).deny).toContain("Write blocked");
    expect((await w.write("Write", "/repo/Makefile")).deny).toContain("Write blocked");
    expect((await w.write("Write", "/repo/docs/RFC-0001")).deny).toBeUndefined();
    expect((await w.write("Edit", "/repo/docs/spec.rst")).deny).toBeUndefined();
  });

  test("every shell write in the line is judged", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.skill("brainstorming");
    expect((await w.sh("echo a > notes.md && echo b > src/x.ts")).deny).toContain("'src/x.ts'");
    expect((await w.sh("printf x > 'src/q y.ts'")).deny).toContain("src/q y.ts");
    expect((await w.sh("perl -i -pe 's/a/b/' lib/m.pm")).deny).toContain("lib/m.pm");
    expect((await w.sh("bash -c 'echo x > src/z.ts'")).deny).toContain("src/z.ts");
    expect((await w.sh("cat log 2>&1 > /dev/null")).deny).toBeUndefined();
    expect((await w.sh("cat <<EOF > src/h.ts\nexport {}\nEOF")).deny).toContain("src/h.ts");
    expect((await w.sh("cat <<'EOF' > notes.md\nx > src/not-a-write.ts\nEOF")).deny).toBeUndefined();
  });

  test("denials are counted and traced", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.skill("brainstorming");
    await w.write("Write", "/repo/src/a.ts");
    await w.say("proctor: status");
    expect(w.logText()).toContain("1 denials");
  });
});

describe("the watchdog and quiet mode", () => {
  test("quiet mode keeps the watchdog to itself", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.say("proctor: quiet on");
    for (let i = 0; i < 5; i++) await w.turn("x");
    expect(noted(await w.say("go"))).not.toContain("without a skill");
    await w.say("proctor: show trace");
    expect(w.logText()).toContain("watchdog-nudge: turns=4");
  });

  test("an interrupted turn is not a turn", async ($, on) => {
    const w = world($, on);
    await w.start();
    for (let i = 0; i < 6; i++)
      await $.turn.complete({ answer: "", durationMs: 1, isAborted: true, turnId: `a${i}`, reason: "aborted" } as any);
    expect(w.shelf("proctor:session:v3").turnCount).toBe(0);
  });

  test("the model-selection note is quiet in quiet mode, and absent outside a run", async ($, on) => {
    const w = world($, on);
    await w.start();
    const call = () => $.tool.call({ tool: "Agent", description: "d", prompt: "p", subagent_type: "g" } as any);
    expect(noted(await call())).not.toContain("inheriting");
    await w.turn(SDD_START);
    await w.say("proctor: quiet on");
    expect(noted(await call())).not.toContain("inheriting");
  });

  test("context pressure at turns 50, 70 and 90 of a run", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn(SDD_START);
    w.reshelve("proctor:session:v3", (s) => ({ ...s, turnCount: 49 }));
    await w.turn("x");
    expect(noted(await w.say("go"))).toContain("turn 50 — long session");
    await w.turn("x");
    expect(noted(await w.say("go"))).not.toContain("long session");
    w.reshelve("proctor:session:v3", (s) => ({ ...s, turnCount: 69 }));
    await w.turn("x");
    expect(noted(await w.say("go"))).toContain("turn 70");
    w.reshelve("proctor:session:v3", (s) => ({ ...s, turnCount: 89 }));
    await w.turn("x");
    expect(noted(await w.say("go"))).toContain("turn 90");
  });
});

describe("turn-end parsing", () => {
  for (const line of ["Task 1: complete", "Task 1 — done", "Task 1 – finished", "Task 1 - completed", "Task 1 is complete", "Task 1 done"]) {
    test(`"${line}" completes task 1`, async ($, on) => {
      const w = world($, on);
      await w.start();
      await w.turn(SDD_START);
      await w.turn(line);
      expect(w.shelf(SDD).completedTasks).toEqual([1]);
    });
  }

  test("a run of unknown size moves on without ending", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("Starting subagent-driven-development now");
    await w.turn("Task 1: complete\nTask 2: complete");
    const s = w.shelf(SDD);
    expect(s.active).toBe(true);
    expect(s.currentTask).toBe(3);
    expect(noted(await w.say("go"))).toContain("Task 2 complete (2/?). Next: Task 3.");
  });

  test("a completion said twice is noted once", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn(SDD_START);
    await w.turn("Task 1: complete");
    await w.say("go");
    await w.turn("As said, Task 1: complete");
    expect(noted(await w.say("go"))).not.toContain("Task 1 complete");
  });

  test("another task's fix round is a round, not this task's", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn(SDD_START);
    await w.turn("Task 4: fix round 3 — approach: from an earlier pass");
    const s = w.shelf(SDD);
    expect(s.currentFixRound).toBe(0);
    expect(s.totalFixRounds).toBe(1);
    expect(s.failedApproaches[0]).toBe("Task 4 R3: from an earlier pass");
  });

  test("ruling forms: two parts, a cost in the middle, a final ruling", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("Starting subagent-driven-development for 1 task");
    await w.turn(
      "Ruling: skip the cache — too early\n" +
        "Ruling: pin v2 — cost if wrong: a rebuild — it is what CI runs\n" +
        "Task 1: complete\n" +
        "Ruling: ship as is -- reviewed -- a hotfix",
    );
    const r = w.shelf(SDD).rulings;
    expect(r[0]).toMatchObject({ text: "skip the cache", costIfWrong: "unknown", phase: "preflight" });
    expect(r[1]).toMatchObject({ text: "pin v2", costIfWrong: "a rebuild" });
    expect(r[2]).toMatchObject({ text: "ship as is", costIfWrong: "a hotfix", phase: "final" });
  });

  test("a ruling written with plain hyphens parses like the em-dash form", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn(SDD_START);
    await w.turn("Ruling: keep it simple - fewer moving parts - cost if wrong: a rewrite");
    expect(w.shelf(SDD).rulings[0]).toMatchObject({
      text: "keep it simple",
      costIfWrong: "a rewrite",
    });
  });

  test("the last twenty rulings are remembered across sessions", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn(SDD_START);
    await w.turn(Array.from({ length: 25 }, (_, i) => `Ruling: r${i} — why — cost`).join("\n"));
    await w.start();
    await w.say("proctor: status");
    expect(w.logText()).toContain('Rulings remembered: 20 · latest "r24 — why — cost"');
  });

  test("the loop detector: only from round 3, only with a long answer, only when it says so", async ($, on) => {
    const w = world($, on);
    let asked = 0;
    let reply: any = { text: '{"looping":false}' };
    w.fork = () => {
      asked++;
      return reply;
    };
    await w.start();
    await w.turn(SDD_START);
    await w.turn("Task 1: fix round 2 — approach: first real try " + "x".repeat(120));
    expect(asked).toBe(0);
    await w.turn("Task 1: fix round 3 — approach: short");
    expect(asked).toBe(0);
    await w.turn("still round 3, a long explanation " + "x".repeat(120));
    expect(asked).toBe(1);
    expect(noted(await w.say("go"))).not.toContain("repeated fix pattern");
    reply = null;
    await w.turn("again round 3 " + "x".repeat(120));
    reply = { text: "not json at all" };
    await w.turn("and again " + "x".repeat(120));
    expect(asked).toBe(3);
    expect(noted(await w.say("go"))).not.toContain("repeated fix pattern");
  });
});
