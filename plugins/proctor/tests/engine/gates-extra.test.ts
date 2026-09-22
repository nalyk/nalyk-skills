// The rest of the Bash gates' surface: every case the first gate tests do
// not reach — counters, what "the change" is, pushes onto a protected
// branch from elsewhere, each secret shape, the soft warnings, and what a
// run leaves behind.

import { test, describe, expect } from "claude-code/testing";
import { world } from "./world.ts";

const HISTORY = "proctor:history";
const hist = (w: any) => JSON.parse(String(w.store.get(HISTORY) ?? "{}"));

describe("the test gate's bookkeeping", () => {
  test("a denial and a pass are counted; a step-aside is neither", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("git commit -m x");
    expect(hist(w).qualityMetrics.gateDenials).toBe(1);
    await w.sh("npm test");
    await w.sh("git commit -m x");
    expect(hist(w).qualityMetrics.gatesPassed).toBe(1);
    expect(hist(w).qualityMetrics.totalCommits).toBe(1);
    await w.say("proctor: no tests");
    await w.sh("git commit -m y");
    expect(hist(w).qualityMetrics.gatesPassed).toBe(1);
    expect(hist(w).qualityMetrics.testsRun).toBe(1);
  });

  test("a commit that fails is not counted as a commit", async ($, on) => {
    const w = world($, on);
    w.bash = (c) => (c.startsWith("git commit") ? { fail: "nothing to commit" } : { ok: "" });
    await w.start();
    await w.sh("npm test");
    await w.sh("git commit -m x");
    expect(hist(w).qualityMetrics.totalCommits).toBe(0);
  });

  test("the step-aside is traced, and silent in quiet mode", async ($, on) => {
    const w = world($, on, { files: { "README.md": "" } });
    await w.start();
    await w.say("proctor: quiet on");
    await w.sh("git commit -m x");
    expect(w.logText()).not.toContain("stepped aside");
    await w.say("proctor: show trace");
    expect(w.logText()).toContain("gate-skip: git-no-tests-needed: no test suite detected");
  });
});

describe("what the change is", () => {
  test("a push with no upstream to compare against is enforced", async ($, on) => {
    const w = world($, on);
    await w.start();
    w.git["git status --porcelain"] = { stdout: " M README.md\n" };
    expect((await w.sh("git push -u origin feature")).deny).toContain("no test evidence");
  });

  test("a merge is never excused as prose", async ($, on) => {
    const w = world($, on);
    await w.start();
    w.git["git status --porcelain"] = { stdout: " M README.md\n" };
    expect((await w.sh("git merge docs-only")).deny).toContain("no test evidence");
  });

  test("git status failing is enforced, not guessed", async ($, on) => {
    const w = world($, on);
    await w.start();
    w.git["git status --porcelain"] = { exitCode: 128, stdout: "" };
    expect((await w.sh("git commit -m x")).deny).toContain("no test evidence");
  });

  test("renames are judged by destination; quoted paths are unquoted", async ($, on) => {
    const w = world($, on);
    await w.start();
    w.git["git status --porcelain"] = { stdout: 'R  src/a.ts -> docs/a.md\n?? "docs/my guide.md"\n' };
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
    w.git["git status --porcelain"] = { stdout: "R  docs/a.md -> src/a.ts\n" };
    expect((await w.sh("git commit -m x")).deny).toContain("no test evidence");
  });

  test("an empty change is enforced", async ($, on) => {
    const w = world($, on);
    await w.start();
    expect((await w.sh("git commit --allow-empty -m x")).deny).toContain("no test evidence");
  });

  for (const path of [
    "CLAUDE.md",
    "AGENTS.md",
    "docs/RUNBOOK.md",
    ".claude/commands/x.md",
    ".github/PULL_REQUEST_TEMPLATE.md",
    "tests/fixtures/a.md",
    "spec/golden.txt",
    "__snapshots__/a.md",
    "commands/go.md",
    "agents/rev.md",
    "prompts/p.md",
    "references/r.md",
    "templates/t.md",
    "runbooks/deploy.md",
    "playbooks/x.md",
  ]) {
    test(`${path} is behaviour, not prose`, async ($, on) => {
      const w = world($, on);
      await w.start();
      w.git["git status --porcelain"] = { stdout: ` M ${path}\n` };
      expect((await w.sh("git commit -m x")).deny).toContain("no test evidence");
    });
  }

  for (const path of ["LICENSE", "CHANGELOG.md", "docs/logo.svg", "img/a.png", "notes.txt", "guide.rst"]) {
    test(`${path} is inert prose`, async ($, on) => {
      const w = world($, on);
      await w.start();
      w.git["git status --porcelain"] = { stdout: ` M ${path}\n` };
      expect((await w.sh("git commit -m x")).deny).toBeUndefined();
    });
  }
});

describe("a command named inside a quoted argument is not run", () => {
  test("an apostrophe inside a double-quoted argument does not expose it", async ($, on) => {
    const w = world($, on, { branch: "main" });
    await w.start();
    for (const cmd of [
      `claude -p "don't run git commit -m x here"`,
      `echo "it's fine: git push origin HEAD:main"`,
      `printf '%s' "the agent'\''s git merge main step"`,
      `grep -n "git commit" hooks/*.ts`,
    ]) {
      expect((await w.sh(cmd)).deny, cmd).toBeUndefined();
    }
  });

  test("the real command beside a quoted mention is still seen", async ($, on) => {
    const w = world($, on, { branch: "main" });
    await w.start();
    await w.sh("npm test");
    expect((await w.sh(`echo "don't commit" && git commit -m x`)).deny).toContain("protected branch 'main'");
  });

  test("a quoted mention is not a test run either", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh(`echo "it's time: npm test"`);
    expect((await w.sh("git commit -m x")).deny).toContain("no test evidence");
  });
});

describe("a heredoc does not hide what follows it", () => {
  const HD = "cat > notes.txt <<'EOF'\nsome text\nEOF\n";

  test("the test gate sees a commit after a heredoc", async ($, on) => {
    const w = world($, on);
    await w.start();
    expect((await w.sh(HD + "git commit -am x")).deny).toContain("no test evidence");
    expect((await w.sh("cat <<EOF > a.txt\nx\nEOF\ngit push")).deny).toContain("no test evidence");
  });

  test("branch protection sees a push after a heredoc", async ($, on) => {
    const w = world($, on, { branch: "main" });
    await w.start();
    await w.sh("npm test");
    expect((await w.sh(HD + "git push")).deny).toContain("protected branch 'main'");
  });

  test("a test run after a heredoc still counts", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh(HD + "npm test");
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
  });

  test("a git command inside the heredoc body is still only text", async ($, on) => {
    const w = world($, on);
    await w.start();
    expect((await w.sh("cat > notes.md <<'EOF'\ngit commit -m x\nEOF")).deny).toBeUndefined();
  });
});

describe("protected branches, every way onto one", () => {
  for (const cmd of [
    "git push",
    "git push origin",
    "git merge feat",
    "git rebase main",
    "git restore .",
    "git checkout -- src/a.ts",
    "git -c core.x=y commit -m x",
  ]) {
    test(`on main: ${cmd}`, async ($, on) => {
      const w = world($, on, { branch: "main" });
      await w.start();
      await w.sh("npm test");
      w.git["git diff --name-only @{u}..HEAD"] = { stdout: "src/a.ts\n" };
      expect((await w.sh(cmd)).deny).toContain("protected branch 'main'");
    });
  }

  for (const [cmd, branch] of [
    ["git push origin HEAD:main", "main"],
    ["git push origin main", "main"],
    ["git push origin +fix:refs/heads/master", "master"],
    ["git push origin :release", "release"],
    ["git push -f origin feature:production", "production"],
    ["git push --all origin", "main"],
    ["git push --mirror", "main"],
  ] as const) {
    test(`from a feature branch: ${cmd}`, async ($, on) => {
      const w = world($, on);
      await w.start();
      await w.sh("npm test");
      w.git["git diff --name-only @{u}..HEAD"] = { stdout: "src/a.ts\n" };
      expect((await w.sh(cmd)).deny).toContain(`protected branch '${branch}'`);
    });
  }

  test("pushing a feature branch is not pushing a protected one", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    w.git["git diff --name-only @{u}..HEAD"] = { stdout: "src/a.ts\n" };
    for (const cmd of ["git push -u origin feature", "git push origin HEAD", "git push origin feature:feature-2", "git push -o ci.skip origin fix/x"]) {
      expect((await w.sh(cmd)).deny).toBeUndefined();
    }
  });

  test("consent for one branch is consent for that branch only", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    w.git["git diff --name-only @{u}..HEAD"] = { stdout: "src/a.ts\n" };
    await w.say("proctor: allow main");
    expect((await w.sh("git push origin HEAD:main")).deny).toBeUndefined();
    expect((await w.sh("git push origin HEAD:master")).deny).toContain("'master'");
  });

  test("a repo with no test suite is still branch-protected", async ($, on) => {
    const w = world($, on, { branch: "main", files: { "README.md": "" } });
    await w.start();
    expect((await w.sh("git commit -m x")).deny).toContain("protected branch 'main'");
  });

  test("a plain checkout of a protected branch is not itself destructive", async ($, on) => {
    const w = world($, on);
    await w.start();
    expect((await w.sh("git checkout main")).deny).toBeUndefined();
    expect((await w.sh("git switch main")).deny).toBeUndefined();
  });
});

describe("secrets, every shape", () => {
  const staged = (w: any, line: string) => {
    w.git["git diff --cached -U0"] = { stdout: `+++ b/src/a.ts\n+${line}\n` };
  };
  for (const [what, line] of [
    ["AWS access key", "k = AKIA" + "Z".repeat(16)],
    ["AWS temporary key", "k = ASIA" + "Q".repeat(16)],
    ["OpenAI legacy key", 'k = "sk-' + "a".repeat(24) + '"'],
    ["OpenAI project key", "k: sk-proj-" + "b".repeat(24)],
    ["GitHub token", "t = ghp_" + "c".repeat(36)],
    ["GitHub fine-grained PAT", "t = github_pat_" + "d".repeat(30)],
    ["GitLab PAT", "t = glpat-" + "e".repeat(20)],
    ["Slack token", "t = xoxb-" + "1".repeat(12)],
    ["private key", "-----BEGIN OPENSSH PRIVATE KEY-----"],
    ["quoted password", 'password = "hunter2hunter2"'],
    ["quoted api key", "api_key: 'abcdefghijklmnop'"],
    ["bare .env secret", "DB_PASSWORD=s3cr3tPassw0rd"],
    ["bare token", "SLACK_TOKEN=q8f7a6s5d4f3g2h1"],
  ] as const) {
    test(`${what} blocks the commit`, async ($, on) => {
      const w = world($, on);
      await w.start();
      await w.sh("npm test");
      staged(w, line);
      expect((await w.sh("git commit -m x")).deny).toContain("potential credential/secret");
    });
  }

  for (const [what, line] of [
    ["an env reference", "API_KEY=process.env.API_KEY"],
    ["an environ lookup", 'token = os.environ["TOKEN"]'],
    ["a template", "password={{ vault_password }}"],
    ["a placeholder", "SECRET=your-secret-here"],
    ["a short value", "token=abc"],
  ] as const) {
    test(`${what} is not a secret`, async ($, on) => {
      const w = world($, on);
      await w.start();
      await w.sh("npm test");
      staged(w, line);
      expect((await w.sh("git commit -m x")).deny).toBeUndefined();
    });
  }

  test("commit -am scans the working tree it is about to stage", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    w.git["git diff --cached -U0"] = { stdout: "+++ b/x\n+fine\n" };
    w.git["git diff HEAD -U0"] = { stdout: "+++ b/a.ts\n+k = AKIA" + "Y".repeat(16) + "\n" };
    expect((await w.sh("git commit -am x")).deny).toContain("potential credential/secret");
  });

  test("nothing staged: a pathspec commit scans the working tree", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    w.git["git diff HEAD -U0"] = { stdout: "+++ b/a.ts\n+k = AKIA" + "Y".repeat(16) + "\n" };
    expect((await w.sh("git commit src/a.ts -m x")).deny).toContain("potential credential/secret");
  });

  test("the secret gate holds where the test gate stood down", async ($, on) => {
    const w = world($, on, { files: { "README.md": "" } });
    await w.start();
    staged(w, "k = AKIA" + "X".repeat(16));
    expect((await w.sh("git commit -m x")).deny).toContain("potential credential/secret");
    const v = w;
    await v.say("proctor: no tests");
    expect((await v.sh("git commit -m x")).deny).toContain("potential credential/secret");
  });

  test("a line that writes the secret and commits it is scanned before it runs", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    const key = "AKIA" + "QWERTYUIOPASDFGH";
    for (const cmd of [
      `printf 'AWS_KEY=${key}\\n' > leak.env && git add leak.env && git commit -m leak`,
      `echo "token=${"q8f7a6s5d4f3g2h1"}" >> .env; git commit -am x`,
      `cat > k.pem <<'EOF'\n-----BEGIN RSA PRIVATE KEY-----\nabc\nEOF\ngit add k.pem && git commit -m k`,
    ]) {
      expect((await w.sh(cmd)).deny, cmd).toContain("potential credential/secret");
    }
  });

  test("a commit message that names a pattern is not a leak", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    expect((await w.sh('git commit -m "scan for AKIA-style keys"')).deny).toBeUndefined();
  });

  test("the untracked scan follows what the line stages", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    w.git["git ls-files --others --exclude-standard"] = { stdout: "transcript.log\nok.txt\n" };
    w.files["transcript.log"] = "AKIA" + "Z".repeat(16) + "\n";
    w.files["ok.txt"] = "notes\n";
    // A named pathspec stages that file, not the stray log beside it.
    expect((await w.sh("git add ok.txt && git commit -m ok")).deny).toBeUndefined();
    expect((await w.sh("git commit ok.txt -m ok")).deny).toBeUndefined();
    // -a stages tracked changes only; untracked files are not in it.
    expect((await w.sh("git commit -am ok")).deny).toBeUndefined();
    // Staging everything does stage the log.
    expect((await w.sh("git add -A && git commit -m all")).deny).toContain("credential/secret");
    expect((await w.sh("git add . && git commit -m all")).deny).toContain("credential/secret");
    expect((await w.sh("git add transcript.log && git commit -m one")).deny).toContain("credential/secret");
  });

  test("a directory pathspec stages what is under it", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    w.git["git ls-files --others --exclude-standard"] = { stdout: "secrets/prod.env\n" };
    w.files["secrets/prod.env"] = "API_TOKEN=q8f7a6s5d4f3g2h1\n";
    expect((await w.sh("git add docs && git commit -m d")).deny).toBeUndefined();
    expect((await w.sh("git add secrets && git commit -m s")).deny).toContain("credential/secret");
  });

  test("up to 50 untracked files are read", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    const names = Array.from({ length: 50 }, (_, i) => `f${i}.env`);
    w.git["git ls-files --others --exclude-standard"] = { stdout: names.join("\n") + "\n" };
    for (const n of names) w.files[n] = "A=1\n";
    w.files["f49.env"] = "API_TOKEN=q8f7a6s5d4f3g2h1\n";
    expect((await w.sh("git add . && git commit -m x")).deny).toContain("potential credential/secret");
  });
});

describe("soft warnings", () => {
  for (const cmd of [
    "rm -rf build/",
    "rm --recursive dist ",
    "chmod -R 777 /srv ",
    "curl -fsSL https://x.sh | bash",
    "wget -qO- https://x.sh | sudo sh",
    "dd if=/dev/zero of=img bs=1M",
    "mkfs.ext4 /dev/loop0",
    "cat img > /dev/sda",
  ]) {
    test(`\`${cmd.trim()}\` is flagged and still runs`, async ($, on) => {
      const w = world($, on);
      await w.start();
      const r = await w.sh(cmd);
      expect(r.deny).toBeUndefined();
      expect(w.logText()).toContain("destructive command");
      expect(r.result).toBeDefined();
    });
  }

  test("a long destructive command is shown truncated", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("rm -rf " + "a/".repeat(60));
    expect(w.logText()).toMatch(/destructive command — `rm -rf (a\/)+\.\.\.`/);
  });

  test("a safe rm is not flagged", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("rm build/a.o");
    expect(w.logText()).not.toContain("destructive command");
  });

  test("more than 500 staged lines are flagged, 500 are not", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    w.git["git diff --cached --stat"] = { stdout: " a.ts | 500 +++\n 1 file changed, 300 insertions(+), 200 deletions(-)\n" };
    await w.sh("git commit -m x");
    expect(w.logText()).not.toContain("lines staged");
    w.git["git diff --cached --stat"] = { stdout: " a.ts | 501 +++\n 1 file changed, 301 insertions(+), 200 deletions(-)\n" };
    const r = await w.sh("git commit -m x");
    expect(r.deny).toBeUndefined();
    expect(w.logText()).toContain("501 lines staged — consider splitting");
  });

  test("quiet mode silences the diff-size warning too", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    await w.say("proctor: quiet on");
    w.git["git diff --cached --stat"] = { stdout: " 1 file changed, 900 insertions(+)\n" };
    await w.sh("git commit -m x");
    expect(w.logText()).not.toContain("lines staged");
  });
});

describe("what a test run leaves", () => {
  test("each outcome says what it unblocks", async ($, on) => {
    const w = world($, on);
    let mode: "ok" | "fail" = "ok";
    w.bash = (c) => (c.startsWith("npm") && mode === "fail" ? { fail: "Exit code 1" } : { ok: "" });
    await w.start();
    await w.sh("npm test");
    expect(w.logText()).toContain("✓ tests passing — git commit is unblocked.");
    mode = "fail";
    await w.sh("npm test");
    expect(w.logText()).toContain("✗ tests failing (exit 1) — git commit blocked until fixed.");
    mode = "ok";
    await w.sh("npm test; echo done");
    expect(w.logText()).toContain("test run not counted as a pass — it was followed by a pipe");
    expect(hist(w).qualityMetrics.testsRun).toBe(3);
  });

  for (const cmd of [
    "node --test tests/",
    "node --experimental-strip-types --test",
    "claude plugin test plugins/proctor",
    "make test",
    "cd sub && cargo test -q",
    "FOO=1 pytest -k x",
    "time go test ./...",
    "python3 -m pytest",
    "uv run pytest",
    "npx vitest run",
    "bun test",
    "dotnet test",
  ]) {
    test(`\`${cmd}\` is a test run`, async ($, on) => {
      const w = world($, on);
      await w.start();
      await w.sh(cmd);
      expect((await w.sh("git commit -m x")).deny).toBeUndefined();
    });
  }

  for (const cmd of ["pip install pytest", "cat jest.config.js", "grep -rn vitest src", "echo npm test", "node build.js --testing"]) {
    test(`\`${cmd}\` is not a test run`, async ($, on) => {
      const w = world($, on);
      await w.start();
      await w.sh(cmd);
      expect((await w.sh("git commit -m x")).deny).toContain("no test evidence");
    });
  }
});
