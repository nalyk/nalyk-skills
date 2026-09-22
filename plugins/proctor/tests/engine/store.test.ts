// The store layer: one namespace shared by every session on the machine,
// so records are filed per project, capped, serialised, and survive
// whatever an older version (or a crash) left behind.

import { test, describe, expect } from "claude-code/testing";
import { world } from "./world.ts";

const SESSION = "proctor:session:v3";
const EVIDENCE = "proctor:test-evidence:v3";
const SDD = "proctor:sdd-state:v3";
const HISTORY = "proctor:history";

const moveTo = (w: any, root: string) => {
  w.cwd = root;
  w.git["git rev-parse --show-toplevel"] = { stdout: `${root}\n` };
};

describe("two projects, two panes", () => {
  test("a second session elsewhere leaves this one's state alone", async ($, on) => {
    const w = world($, on, { branch: "main" });
    await w.start();
    await w.sh("npm test");
    await w.say("proctor: allow main");
    await w.say("proctor: quiet on");

    moveTo(w, "/other");
    await w.start();
    await w.sh("npm test");
    expect((await w.sh("git commit -m x")).deny).toContain("protected branch 'main'");

    moveTo(w, "/repo");
    expect(w.shelf(SESSION).branchConsents).toEqual({ main: true });
    expect(w.shelf(SESSION).quietMode).toBe(true);
    expect(w.shelf(EVIDENCE)).not.toBeNull();
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
  });

  test("evidence from one project does not unblock another", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    moveTo(w, "/other");
    await w.start();
    expect((await w.sh("git commit -m x")).deny).toContain("no test evidence");
  });

  test("an SDD run stays in its project", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("Starting subagent-driven-development for 3 tasks");
    moveTo(w, "/other");
    await w.start();
    expect(w.logText()).not.toContain("recovering SDD session");
    const r = await $.prompt.context({ blocks: [] } as any);
    expect(r.blocks.length).toBe(0);
    const a = await $.attribution.text({ kind: "commit", text: "x" });
    expect(a.text).toBe("x");
  });

  test("a subdirectory of the repo is the same project", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    w.cwd = "/repo/packages/a";
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
  });

  test("the book keeps the twelve most recent projects", async ($, on) => {
    const w = world($, on);
    for (let i = 0; i < 14; i++) {
      moveTo(w, `/p${i}`);
      await w.start();
    }
    const book = JSON.parse(String(w.store.get(SESSION)));
    const roots = Object.keys(book);
    expect(roots.length).toBe(12);
    expect(roots).not.toContain("/p0");
    expect(roots).not.toContain("/p1");
    expect(roots).toContain("/p13");
  });
});

describe("whatever the store holds", () => {
  test("a corrupt history does not take a gate down", async ($, on) => {
    const w = world($, on, { store: { [HISTORY]: "{not json" } });
    await w.start();
    expect((await w.sh("git commit -m x")).deny).toContain("no test evidence");
    await w.say("proctor: status");
    expect(w.logText()).toContain("Quality: 0 commits · 1 denials");
  });

  test("an old history's missing and null counters are migrated", async ($, on) => {
    const legacy = JSON.stringify({
      lastTestCommand: "make check",
      projectPath: "/repo",
      sessionsCount: 4,
      qualityMetrics: { gateDenials: null, totalCommits: 9 },
    });
    const w = world($, on, { store: { [HISTORY]: legacy } });
    await w.start();
    expect((await w.sh("git commit -m x")).deny).toContain("no test evidence");
    const h = JSON.parse(String(w.store.get(HISTORY)));
    expect(h.qualityMetrics).toEqual({ totalCommits: 9, gateDenials: 1, gatesPassed: 0, fixRounds: 0, testsRun: 0 });
    expect(h.sessionsCount).toBe(5);
    expect(h.learnedTestCommands).toEqual({});
  });

  test("corrupt per-project records are replaced, not trusted", async ($, on) => {
    const w = world($, on, {
      store: { [SESSION]: "][", [EVIDENCE]: '{"/repo":{"at":1,"value":{"exitCode":0}}', [SDD]: "7" },
    });
    await w.start();
    expect(w.shelf(SESSION).hasTestInfrastructure).toBe(true);
    expect((await w.sh("git commit -m x")).deny).toContain("no test evidence");
  });
});

describe("the write queue", () => {
  test("parallel tool calls lose no step", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("Starting subagent-driven-development for 3 tasks");
    await Promise.all([
      w.sh("ls"),
      w.sh("pwd"),
      w.write("Write", "/repo/src/a.ts"),
      w.write("Edit", "/repo/src/b.ts"),
      w.write("Edit", "/repo/src/c.ts"),
      w.write("NotebookEdit", "/repo/n.ipynb"),
      w.sh("date"),
    ]);
    expect(w.shelf(SDD).toolCallsThisTask).toBe(7);
    expect(w.shelf(SDD).totalToolCalls).toBe(7);
  });

  test("a ledger write racing tool calls keeps both", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("Starting subagent-driven-development for 3 tasks");
    await Promise.all([
      w.sh("ls"),
      $.tool.call({ tool: "Edit", file_path: "/repo/progress.md", old_string: "", new_string: "Ruling: a — b — c" } as any),
      w.sh("ls"),
      w.sh("ls"),
    ]);
    const sdd = w.shelf(SDD);
    expect(sdd.rulings.length).toBe(1);
    expect(sdd.toolCallsThisTask).toBe(4);
  });

  test("parallel consents and a quiet toggle all land", async ($, on) => {
    const w = world($, on, { branch: "main" });
    await w.start();
    await Promise.all([w.say("proctor: allow main"), w.say("proctor: allow master"), w.say("proctor: quiet on")]);
    const s = w.shelf(SESSION);
    expect(s.branchConsents).toEqual({ main: true, master: true });
    expect(s.quietMode).toBe(true);
  });
});
