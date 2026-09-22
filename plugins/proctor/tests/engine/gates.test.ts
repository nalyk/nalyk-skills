// The hard gates on git, driven through the real engine: every deny here
// is the engine's own tool.call result, not a value a fake handed back.

import { test, describe, expect } from "claude-code/testing";
import { world } from "./world.ts";

const EVIDENCE = "proctor:test-evidence:v3";
const SESSION = "proctor:session:v3";

describe("test evidence", () => {
  test("no run this session blocks a commit", async ($, on) => {
    const w = world($, on);
    await w.start();
    const r = await w.sh("git commit -m x");
    expect(r.deny).toContain("no test evidence this session");
    expect(r.deny).toContain("npm test");
  });

  test("a passing run lets the commit through", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    const r = await w.sh("git commit -m x");
    expect(r.deny).toBeUndefined();
    expect(w.logText()).toContain("tests passing");
  });

  test("a failing run blocks, with its output", async ($, on) => {
    const w = world($, on);
    w.bash = (c) => (c === "npm test" ? { fail: "Exit code 1\n3 failing" } : { ok: "" });
    await w.start();
    await w.sh("npm test");
    const r = await w.sh("git commit -m x");
    expect(r.deny).toContain("tests are failing");
    expect(r.deny).toContain("3 failing");
  });

  test("a fixed suite unblocks again", async ($, on) => {
    const w = world($, on);
    let broken = true;
    w.bash = (c) => (c === "npm test" && broken ? { fail: "Exit code 1" } : { ok: "" });
    await w.start();
    await w.sh("npm test");
    broken = false;
    await w.sh("npm test");
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
  });

  test("evidence older than the window is stale", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    w.reshelve(EVIDENCE, (ev) => ({ ...ev, timestamp: Date.now() - 6 * 60_000 }));
    const r = await w.sh("git commit -m x");
    expect(r.deny).toContain("test evidence is stale (6m ago");
  });

  test("push and merge are gated like commit", async ($, on) => {
    const w = world($, on);
    await w.start();
    expect((await w.sh("git push")).deny).toContain("no test evidence");
    expect((await w.sh("git merge feat")).deny).toContain("no test evidence");
    expect((await w.sh("git -C /repo commit -m x")).deny).toContain("no test evidence");
  });

  test("plumbing and mentions are not commits", async ($, on) => {
    const w = world($, on);
    await w.start();
    expect((await w.sh("git commit-tree abc")).deny).toBeUndefined();
    expect((await w.sh('echo "git commit -m x"')).deny).toBeUndefined();
    expect((await w.sh("git log --grep commit")).deny).toBeUndefined();
  });

  test("a masked run proves nothing", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test | tail -20");
    const r = await w.sh("git commit -m x");
    expect(r.deny).toContain("hid its exit status");
  });

  test("a run with pipefail counts", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("set -o pipefail; npm test | tail -20");
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
  });

  test("a run sent to the background proves nothing", async ($, on) => {
    const w = world($, on);
    w.bash = (c) => (c === "npm test" ? { background: "" } : { ok: "" });
    await w.start();
    await w.sh("npm test", { run_in_background: true });
    const r = await w.sh("git commit -m x");
    expect(r.deny).toBeDefined();
  });

  test("a run that timed out into the background proves nothing", async ($, on) => {
    const w = world($, on);
    w.bash = (c) => (c === "npm test" ? { timedOut: "" } : { ok: "" });
    await w.start();
    await w.sh("npm test");
    const r = await w.sh("git commit -m x");
    expect(r.deny).toBeDefined();
  });

  test("an interrupted run proves nothing", async ($, on) => {
    const w = world($, on);
    w.bash = (c) => (c === "npm test" ? { interrupted: "partial" } : { ok: "" });
    await w.start();
    await w.sh("npm test");
    const r = await w.sh("git commit -m x");
    expect(r.deny).toBeDefined();
  });

  test("a new session does not inherit the last one's evidence", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    await w.start();
    expect(w.shelf(EVIDENCE)).toBeNull();
    expect((await w.sh("git commit -m x")).deny).toContain("no test evidence this session");
  });

  test("a test command in a commit message is not a run", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh('git commit -m "run npm test"');
    expect((await w.sh("git commit -m x")).deny).toContain("no test evidence");
  });
});

describe("the gate steps aside", () => {
  test("for a project with no test suite", async ($, on) => {
    const w = world($, on, { files: { "README.md": "# x" } });
    await w.start();
    const r = await w.sh("git commit -m x");
    expect(r.deny).toBeUndefined();
    expect(w.logText()).toContain("no test suite detected");
  });

  test("when the human says there are no tests", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.say("proctor: no tests");
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
  });

  test("for a prose-only commit, but not for a runbook or a skill", async ($, on) => {
    const w = world($, on);
    await w.start();
    w.git["git status --porcelain"] = { stdout: " M README.md\n M docs/guide.md\n" };
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
    w.git["git status --porcelain"] = { stdout: " M skills/tdd/SKILL.md\n" };
    expect((await w.sh("git commit -m x")).deny).toContain("no test evidence");
    w.git["git status --porcelain"] = { stdout: " M README.md\n M src/a.ts\n" };
    expect((await w.sh("git commit -m x")).deny).toContain("no test evidence");
  });

  test("a push judges what it sends, not the working tree", async ($, on) => {
    const w = world($, on);
    await w.start();
    w.git["git status --porcelain"] = { stdout: " M README.md\n" };
    w.git["git diff --name-only @{u}..HEAD"] = { stdout: "src/a.ts\n" };
    expect((await w.sh("git push")).deny).toContain("no test evidence");
    w.git["git diff --name-only @{u}..HEAD"] = { stdout: "README.md\n" };
    expect((await w.sh("git push")).deny).toBeUndefined();
  });

  test("a repo that builds its docs keeps gating markdown", async ($, on) => {
    const w = world($, on, {
      files: { "package.json": '{"scripts":{"test":"vitest"}}', "mkdocs.yml": "" },
    });
    await w.start();
    w.git["git status --porcelain"] = { stdout: " M docs/guide.md\n" };
    expect((await w.sh("git commit -m x")).deny).toContain("no test evidence");
  });
});

describe("protected branches", () => {
  test("a commit on main is blocked even with passing tests", async ($, on) => {
    const w = world($, on, { branch: "main" });
    await w.start();
    await w.sh("npm test");
    const r = await w.sh("git commit -m x");
    expect(r.deny).toContain("protected branch 'main'");
  });

  test("reset --hard and checkout . are destructive too", async ($, on) => {
    const w = world($, on, { branch: "master" });
    await w.start();
    expect((await w.sh("git reset --hard HEAD~1")).deny).toContain("protected branch");
    expect((await w.sh("git checkout -- .")).deny).toContain("protected branch");
    expect((await w.sh("git status")).deny).toBeUndefined();
  });

  test("consent in the exact phrase unblocks, punctuation and all", async ($, on) => {
    const w = world($, on, { branch: "main" });
    await w.start();
    await w.sh("npm test");
    await w.say("yes");
    expect((await w.sh("git commit -m x")).deny).toContain("protected branch");
    await w.say("proctor: allow main.");
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
  });

  test("consent for an unprotected branch says so", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.say("proctor: allow feature");
    expect(w.logText()).toContain("is not a protected branch");
  });

  test("the gate reads the branch git is on now", async ($, on) => {
    const w = world($, on, { branch: "main" });
    await w.start();
    await w.sh("npm test");
    w.git["git branch --show-current"] = { stdout: "fix/x\n" };
    await w.sh("cd /repo && git checkout -b fix/x");
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
    expect(w.shelf(SESSION).branch).toBe("fix/x");
  });
});

describe("switching onto a protected branch in the same line", () => {
  test("checkout main && merge is judged on main", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    expect((await w.sh("git checkout main && git merge feat")).deny).toContain("protected branch 'main'");
    expect((await w.sh("git switch master; git push")).deny).toContain("protected branch 'master'");
    expect((await w.sh("git -C . checkout release && git reset --hard origin/release")).deny).toContain("'release'");
  });

  test("switching away from a protected branch is not a switch onto one", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    expect((await w.sh("git checkout -b fix/y && git commit -m x")).deny).toBeUndefined();
    expect((await w.sh("git checkout main -- src/a.ts && git commit -m x")).deny).toBeUndefined();
  });
});

describe("secrets", () => {
  const KEY = "AKIA" + "ABCDEFGHIJKLMNOP";

  test("a staged key blocks the commit", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    w.git["git diff --cached -U0"] = { stdout: `+++ b/a.ts\n+const k = "${KEY}";\n` };
    const r = await w.sh("git commit -m x");
    expect(r.deny).toContain("potential credential/secret");
  });

  test("removing a key is not committing one", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    w.git["git diff --cached -U0"] = { stdout: `--- a/a.ts\n-const k = "${KEY}";\n` };
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
  });

  test("add-and-commit in one line scans the untracked file", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    w.git["git ls-files --others --exclude-standard"] = { stdout: ".env\n" };
    w.files[".env"] = "API_TOKEN=q8f7a6s5d4f3g2h1\n";
    const r = await w.sh("git add -A && git commit -m x");
    expect(r.deny).toContain("potential credential/secret");
  });

  test("a placeholder is not a secret", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    w.git["git diff --cached -U0"] = { stdout: "+API_TOKEN=${API_TOKEN}\n+password=changeme123\n" };
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
  });
});
