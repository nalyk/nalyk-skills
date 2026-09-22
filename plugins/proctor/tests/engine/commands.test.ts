// Every operator command and every branch of what it reports.

import { test, describe, expect } from "claude-code/testing";
import { world } from "./world.ts";

const SDD = "proctor:sdd-state:v3";
const SESSION = "proctor:session:v3";
const EVIDENCE = "proctor:test-evidence:v3";
const KEY = "AKIA" + "ABCDEFGHIJKLMNOP";
const SDD_START = "Starting subagent-driven-development for 3 tasks";

describe("commands ride along with the prompt", () => {
  test("the prompt text is untouched and commands work mid-sentence", async ($, on) => {
    const w = world($, on);
    await w.start();
    const r = await w.say("before we go on, proctor: status please");
    expect(r.text).toBe("before we go on, proctor: status please");
    expect(w.logText()).toContain("─── Proctor Status ───");
  });

  test("commands are case-insensitive", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.say("Proctor: Quiet ON");
    expect(w.shelf(SESSION).quietMode).toBe(true);
  });

  test("no command, no log line", async ($, on) => {
    const w = world($, on);
    await w.start();
    const before = w.logs.length;
    await w.say("just a question about proctor");
    expect(w.logs.length).toBe(before);
  });
});

describe("proctor: status", () => {
  test("reports every section", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.skill("proctor:test-driven-development");
    await w.skill("proctor:test-driven-development");
    await w.sh("npm test");
    await w.sh("git commit -m x");
    await w.turn(SDD_START);
    await w.turn("Ruling: ship it — tests green — cost if wrong: a revert");
    await w.say("proctor: status");
    const out = w.logText();
    for (const line of [
      "Phase: implementing",
      "Branch: feature",
      "Turn: 2",
      "Planning mode: off",
      "Quiet mode: off",
      "Last skill: proctor:test-driven-development",
      "SDD: Task 1/3 · 0 complete · Fix 0/5 · Steps ",
      "1 rulings",
      "Tests: passing · fresh · 0m ago",
      "Quality: 1 commits · 0 denials · 1 passed · 0 fix rounds · 1 test runs",
      "Autonomy rate: 100%",
      "Sessions: 1",
      "Agents spawned: 0",
      "Most used skills: test-driven-development ×2",
      'Rulings remembered: 1 · latest "ship it — tests green — cost if wrong: a revert"',
    ])
      expect(out).toContain(line);
    expect(out).not.toContain("undefined");
    expect(out).not.toContain("NaN");
  });

  test("before anything has happened", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.say("proctor: status");
    const out = w.logText();
    expect(out).toContain("SDD: inactive");
    expect(out).toContain("Tests: no evidence");
    expect(out).toContain("Autonomy rate: n/a (no gate events yet)");
    expect(out).toContain("Last skill: none");
  });

  test("stale and unproven evidence are named", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test | tail");
    await w.say("proctor: status");
    expect(w.logText()).toContain("Tests: UNPROVEN (exit status hidden) · fresh");
    await w.sh("npm test");
    w.reshelve(EVIDENCE, (ev) => ({ ...ev, timestamp: Date.now() - 20 * 60_000 }));
    await w.say("proctor: status");
    expect(w.logText()).toContain("Tests: passing · STALE · 20m ago");
  });
});

describe("proctor: check", () => {
  test("everything clear", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    w.git["git diff --cached -U0"] = { stdout: "+++ b/a.ts\n+const a = 1;\n" };
    await w.say("proctor: check");
    const out = w.logText();
    expect(out).toContain("✓ Tests: passing, fresh (0m ago)");
    expect(out).toContain("✓ Branch: feature (not protected)");
    expect(out).toContain("✓ Planning mode: off");
    expect(out).toContain("✓ Staged diff: no secrets detected");
  });

  test("everything blocked", async ($, on) => {
    const w = world($, on, { branch: "main" });
    await w.start();
    await w.skill("proctor:brainstorming");
    w.git["git diff --cached -U0"] = { stdout: `+++ b/a.ts\n+k = "${KEY}"\n` };
    await w.say("proctor: check");
    const out = w.logText();
    expect(out).toContain("✗ Test evidence: NONE — commit will be blocked");
    expect(out).toContain("→ Run `npm test`");
    expect(out).toContain("✗ Branch: main — PROTECTED, destructive ops blocked");
    expect(out).toContain('→ Create a feature branch or "proctor: allow main"');
    expect(out).toContain("✗ Planning mode: ON — code writes blocked");
    expect(out).toContain("✗ Staged diff: potential secret detected — commit will be blocked");
  });

  test("a removed key is not reported as a leak — the gate agrees", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    w.git["git diff --cached -U0"] = { stdout: `--- a/a.ts\n-k = "${KEY}"\n+k = process.env.K\n` };
    await w.say("proctor: check");
    expect(w.logText()).toContain("✓ Staged diff: no secrets detected");
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
  });

  test("failing, unproven, stale; consent; nothing staged", async ($, on) => {
    const w = world($, on, { branch: "main" });
    w.bash = (c) => (c === "npm test" ? { fail: "Exit code 1" } : { ok: "" });
    await w.start();
    await w.say("proctor: allow main");
    await w.sh("npm test");
    await w.say("proctor: check");
    expect(w.logText()).toContain("✗ Tests: FAILING (exit 1) — commit will be blocked");
    expect(w.logText()).toContain("→ Fix failures and re-run tests");
    expect(w.logText()).toContain("✓ Branch: main (protected, consent granted)");
    expect(w.logText()).toContain("· Staged diff: nothing staged");
    w.bash = () => ({ ok: "" });
    await w.sh("npm test &");
    await w.say("proctor: check");
    expect(w.logText()).toContain("→ Not proven: it was followed by a pipe");
    await w.sh("npm test");
    w.reshelve(EVIDENCE, (ev) => ({ ...ev, timestamp: Date.now() - 7 * 60_000 }));
    await w.say("proctor: check");
    expect(w.logText()).toContain("✗ Tests: STALE (7m ago) — commit will be blocked");
  });
});

describe("proctor: diagnose", () => {
  test("low autonomy, fix rounds, loops, idle skills, SDD health", async ($, on) => {
    const w = world($, on);
    w.fork = () => ({ text: '{"looping":true,"signal":"same retry"}' });
    await w.start();
    for (let i = 0; i < 4; i++) await w.sh("git commit -m x");
    for (let i = 0; i < 4; i++) await w.turn("working on it");
    await w.turn(SDD_START);
    for (let r = 1; r <= 6; r++) await w.turn(`Task 1: fix round ${r} — approach: attempt number ${r} ` + "x".repeat(100));
    await w.say("proctor: diagnose");
    const out = w.logText();
    expect(out).toContain("Gate autonomy: 0% (0 passed / 4 denied)");
    expect(out).toContain("→ Low autonomy — run tests more frequently");
    expect(out).toContain("Fix rounds this session: 6");
    expect(out).toContain("→ High fix rate — consider invoking systematic-debugging");
    expect(out).toContain("Rationalization warnings: 2");
    expect(out).toMatch(/No skill invoked in \d+ turns/);
    expect(out).toContain("SDD avg steps/task: 0");
    expect(out).toContain("Failed approaches tracked: 6");
    expect(out).toContain("1. Run tests before every commit attempt");
    expect(out).toContain("2. Check available skills before starting work");
    expect(out).toContain("3. Use systematic-debugging instead of more fix rounds");
  });

  test("a healthy session has nothing to recommend", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.skill("proctor:test-driven-development");
    await w.sh("npm test");
    await w.sh("git commit -m x");
    await w.say("proctor: diagnose");
    const out = w.logText();
    expect(out).toContain("Gate autonomy: 100% (1 passed / 0 denied)");
    expect(out).not.toContain("Recommendations");
  });
});

describe("proctor: show trace", () => {
  test("nothing recorded before a session starts", async ($, on) => {
    const w = world($, on);
    await w.say("proctor: show trace");
    expect(w.logText()).toContain("Proctor trace: no events recorded yet.");
  });

  test("the last 25 of at most 50 events, oldest first", async ($, on) => {
    const w = world($, on);
    await w.start();
    for (let i = 0; i < 60; i++) await w.skill(`s${i}`);
    await w.say("proctor: show trace");
    const out = w.logText();
    expect(out).toContain("Proctor trace (last 25):");
    expect(out).toContain("skill-invoke: s59");
    expect(out).not.toContain("skill-invoke: s34\n");
    const book = JSON.parse(String(w.store.get("proctor:trace:v3")));
    expect(book["/repo"].value.length).toBe(50);
  });
});

describe("state commands", () => {
  test("approve design outside planning mode is a no-op", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.say("proctor: approve design");
    expect(w.logText()).not.toContain("design approved");
  });

  test("budget extend and tasks N need a run", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.say("proctor: budget extend");
    expect(w.logText()).toContain("no active SDD task to extend");
    await w.say("proctor: tasks 7");
    expect(w.logText()).toContain("no active SDD session — nothing to update");
  });

  test("tasks N and Task N: added resize the run", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn(SDD_START);
    await w.say("proctor: tasks 5");
    expect(w.logText()).toContain("SDD task count updated 3 → 5");
    await w.say("Task 7: added — the migration");
    expect(w.logText()).toContain("SDD scope expanded to 7 tasks");
    expect(w.shelf(SDD).totalTasks).toBe(7);
    await w.say("Task 2: added");
    expect(w.shelf(SDD).totalTasks).toBe(7);
  });

  for (const phrase of ["sdd done", "sdd finished", "SDD complete", "proctor: sdd stop"]) {
    test(`"${phrase}" ends the run with a summary`, async ($, on) => {
      const w = world($, on);
      await w.start();
      await w.turn(SDD_START);
      await w.turn("Task 1: complete\nTask 1: fix round 1 — approach: x\nRuling: a — b — c\nminor (deferred): d");
      await w.say(phrase);
      expect(w.shelf(SDD).active).toBe(false);
      const out = w.logText();
      expect(out).toContain("SDD session complete.");
      expect(out).toContain("Tasks: 1/3 done");
      expect(out).toContain("Fix rounds: 1");
      expect(out).toContain("Rulings: 1");
      expect(out).toContain("Deferred: 1");
    });
  }

  test("budget extend resets both clocks and the warnings", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn(SDD_START);
    w.reshelve(SDD, (s) => ({ ...s, toolCallsThisTask: 90, stepWarned80: true, taskStartedAt: 1, timeWarned80: true }));
    await w.say("proctor: budget extend");
    const s = w.shelf(SDD);
    expect(s.toolCallsThisTask).toBe(0);
    expect(s.stepWarned80).toBe(false);
    expect(s.timeWarned80).toBe(false);
    expect(Date.now() - s.taskStartedAt).toBeLessThan(60_000);
    expect(w.logText()).toContain("budget extended for Task 1 — steps and clock reset.");
  });

  test("quiet off after on restores the soft warnings", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.say("proctor: quiet on");
    expect(w.logText()).toContain("quiet mode ON — soft warnings suppressed, hard gates still enforce.");
    await w.say("proctor: quiet off");
    expect(w.logText()).toContain("quiet mode OFF — all warnings active.");
    expect(w.shelf(SESSION).quietMode).toBe(false);
  });

  test("no tests is announced", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.say("proctor: no tests");
    expect(w.logText()).toContain("test gate stood down for this session");
    expect(w.shelf(SESSION).testsAcknowledgedAbsent).toBe(true);
  });
});
