// What session.start learns about the project, and what it resets.

import { test, describe, expect } from "claude-code/testing";
import { world } from "./world.ts";

const SESSION = "proctor:session:v3";

const MARKERS: Array<[string, string]> = [
  ["Cargo.toml", "cargo test"],
  ["pyproject.toml", "pytest"],
  ["setup.py", "pytest"],
  ["go.mod", "go test ./..."],
  ["Makefile", "make test"],
  ["Gemfile", "bundle exec rspec"],
  ["mix.exs", "mix test"],
  ["build.gradle", "./gradlew test"],
  ["build.gradle.kts", "./gradlew test"],
  ["pom.xml", "mvn test"],
  ["CMakeLists.txt", "ctest"],
  ["Rakefile", "rake test"],
  ["deno.json", "deno test"],
  ["bun.lockb", "bun test"],
  ["composer.json", "vendor/bin/phpunit"],
  ["phpunit.xml", "vendor/bin/phpunit"],
  ["phpunit.xml.dist", "vendor/bin/phpunit"],
  ["Package.swift", "swift test"],
  ["pubspec.yaml", "dart test"],
  ["build.zig", "zig build test"],
  ["project.clj", "lein test"],
  ["build.sbt", "sbt test"],
  ["stack.yaml", "stack test"],
  ["cabal.project", "cabal test"],
];

describe("the test command", () => {
  for (const [file, command] of MARKERS) {
    test(`${file} means \`${command}\``, async ($, on) => {
      const w = world($, on, { files: { [file]: "" } });
      await w.start();
      expect(w.logText()).toContain(`tests: ${command}`);
      expect((await w.sh("git commit -m x")).deny).toContain(`Run \`${command}\``);
      expect((await w.skill("proctor:test-driven-development")).text).toContain("Test evidence: ✗ NONE");
    });
  }

  test("package.json with a test script means npm test", async ($, on) => {
    const w = world($, on, { files: { "package.json": '{"scripts":{"test":"vitest"}}', Makefile: "" } });
    await w.start();
    expect(w.logText()).toContain("tests: npm test");
  });

  test("the npm init stub is not a test suite", async ($, on) => {
    const stub = JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1' } });
    const w = world($, on, { files: { "package.json": stub } });
    await w.start();
    expect(w.shelf(SESSION).hasTestInfrastructure).toBe(false);
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
    expect(w.logText()).toContain("no test suite detected");
  });

  test("a package.json with no scripts defers to the next marker", async ($, on) => {
    const w = world($, on, { files: { "package.json": '{"name":"x"}', Makefile: "" } });
    await w.start();
    expect(w.logText()).toContain("tests: make test");
  });

  test("an unreadable package.json still counts as a marker", async ($, on) => {
    const w = world($, on, { files: { "package.json": "{ not json" } });
    await w.start();
    expect(w.logText()).toContain("tests: npm test");
  });

  test("a passing command is learned for this project's next session", async ($, on) => {
    const w = world($, on, { files: { "README.md": "" } });
    await w.start();
    expect(w.shelf(SESSION).hasTestInfrastructure).toBe(false);
    await w.sh("pytest -q tests/");
    await w.start();
    expect(w.logText()).toContain("tests: pytest -q tests/");
    expect((await w.sh("git commit -m x")).deny).toContain("Run `pytest -q tests/`");
  });

  test("a command learned in one project is not another's suite", async ($, on) => {
    const w = world($, on, { files: { "README.md": "" } });
    await w.start();
    await w.sh("pytest -q");
    w.cwd = "/docs";
    w.git["git rev-parse --show-toplevel"] = { stdout: "/docs\n" };
    await w.start();
    await w.start();
    expect(w.shelf(SESSION, "/docs").hasTestInfrastructure).toBe(false);
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
  });

  test("a failing or masked run is not learned", async ($, on) => {
    const w = world($, on, { files: { "README.md": "" } });
    w.bash = (c) => (c.startsWith("pytest") ? { fail: "Exit code 1" } : { ok: "" });
    await w.start();
    await w.sh("pytest -q");
    w.bash = () => ({ ok: "" });
    await w.sh("pytest -x | tail");
    await w.start();
    expect(w.shelf(SESSION).hasTestInfrastructure).toBe(false);
  });
});

describe("the repository", () => {
  test("a worktree is noticed", async ($, on) => {
    const w = world($, on, {
      git: {
        "git rev-parse --git-dir": { stdout: "/repo/.git/worktrees/fix\n" },
        "git rev-parse --git-common-dir": { stdout: "/repo/.git\n" },
      },
    });
    await w.start();
    expect(w.logText()).toContain("| worktree |");
    await w.say("proctor: status");
    expect(w.logText()).toContain("Agents spawned: 0 · in a git worktree");
  });

  test("the remote's default branch is protected whatever it is called", async ($, on) => {
    const w = world($, on, {
      branch: "develop",
      git: { "git symbolic-ref --quiet --short refs/remotes/origin/HEAD": { stdout: "origin/develop\n" } },
    });
    await w.start();
    expect(w.logText()).toContain("protected: main,master,production,release,develop");
    await w.sh("npm test");
    expect((await w.sh("git commit -m x")).deny).toContain("protected branch 'develop'");
    expect((await w.skill("proctor:test-driven-development")).text).toContain("Branch: develop ⚠ PROTECTED");
    await w.say("proctor: allow develop");
    expect(w.logText()).toContain("consent recorded for branch 'develop'");
    expect((await w.sh("git commit -m x")).deny).toBeUndefined();
  });

  test("no remote HEAD leaves the configured list alone", async ($, on) => {
    const w = world($, on);
    await w.start();
    expect(w.logText()).toContain("protected: main,master,production,release)");
  });

  test("not a git repository: the session still starts", async ($, on) => {
    const w = world($, on, {
      git: {
        "git branch --show-current": { exitCode: 128, stdout: "" },
        "git rev-parse --show-toplevel": { exitCode: 128, stdout: "" },
      },
    });
    await w.start();
    expect(w.logText()).toContain("Proctor active (tests: npm test | protected:");
  });

  for (const marker of [
    "book.toml",
    "_quarto.yml",
    "_quarto.yaml",
    "quarto.yml",
    "runme.yaml",
    "runme.yml",
    "jupytext.toml",
    "mkdocs.yml",
    "mkdocs.yaml",
    "docusaurus.config.js",
    "docusaurus.config.ts",
  ]) {
    test(`${marker} makes the repo's markdown behaviour`, async ($, on) => {
      const w = world($, on, { files: { "package.json": '{"scripts":{"test":"t"}}', [marker]: "" } });
      await w.start();
      w.git["git status --porcelain"] = { stdout: " M docs/page.md\n" };
      expect((await w.sh("git commit -m x")).deny).toContain("no test evidence");
    });
  }
});

describe("a new session starts clean", () => {
  test("consent, quiet mode, planning mode and notes do not carry over", async ($, on) => {
    const w = world($, on, { branch: "main" });
    await w.start();
    await w.say("proctor: allow main");
    await w.say("proctor: quiet on");
    await w.skill("proctor:brainstorming");
    for (let i = 0; i < 4; i++) await w.turn("x");
    await w.start();
    const s = w.shelf(SESSION);
    expect(s.branchConsents).toEqual({});
    expect(s.quietMode).toBe(false);
    expect(s.planningMode).toBe(false);
    expect(s.pendingNotes).toEqual([]);
    expect(s.currentPhase).toBe("idle");
    await w.sh("npm test");
    expect((await w.sh("git commit -m x")).deny).toContain("protected branch 'main'");
  });

  test("the trace restarts; the session count grows", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.sh("npm test");
    await w.start();
    await w.say("proctor: show trace");
    expect(w.logText()).toContain("Proctor trace (last 1):");
    expect(w.logText()).not.toContain("test-run:");
    await w.say("proctor: status");
    expect(w.logText()).toContain("Sessions: 2");
  });
});
