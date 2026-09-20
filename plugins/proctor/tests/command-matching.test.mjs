// Gate matching: the command regexes must fire on commands actually being
// run and stay quiet on text that merely mentions one, and PROSE_FILE_RE
// must tell prose from code. Both are load-bearing for the commit gate.
//
// The subjects are pulled out of proctor.tsx at run time so this exercises
// what ships rather than a copy that can drift.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "hooks", "proctor.tsx"), "utf8");

const pick = (re, what) => {
  const m = src.match(re);
  if (!m) throw new Error(`could not find ${what} in proctor.tsx`);
  return m[1] ?? m[0];
};

const fn = pick(/function commandSkeleton[\s\S]*?\n}\n/, "commandSkeleton");
const testRe = pick(/const TEST_RUN_RE =\n([\s\S]*?);\n/, "TEST_RUN_RE").trim();
const gitOpts = pick(/const GIT_OPTS =\s([\s\S]*?);\n/, "GIT_OPTS");
const gitRe = pick(/const GIT_COMMIT_PUSH_RE = new RegExp\(\n([\s\S]*?)\n\);/, "GIT_COMMIT_PUSH_RE");
const destrRe = pick(/const GIT_DESTRUCTIVE_RE = new RegExp\(\n([\s\S]*?)\n\);/, "GIT_DESTRUCTIVE_RE");
const commitRe = pick(/const GIT_COMMIT_RE = new RegExp\(\n([\s\S]*?)\n\);/, "GIT_COMMIT_RE");
const switchRe = pick(/const GIT_BRANCH_SWITCH_RE = new RegExp\(\n([\s\S]*?)\n\);/, "GIT_BRANCH_SWITCH_RE");
const proseRe = pick(/const PROSE_FILE_RE =\n([\s\S]*?);\n/, "PROSE_FILE_RE").trim();
const behavRe = pick(/const BEHAVIORAL_DOC_RE = new RegExp\(\n([\s\S]*?)\n\);/, "BEHAVIORAL_DOC_RE");
const execExtRe = pick(/const EXECUTABLE_DOC_EXT_RE = (.*);/, "EXECUTABLE_DOC_EXT_RE");

const {
  commandSkeleton,
  TEST_RUN_RE,
  GIT_COMMIT_PUSH_RE,
  GIT_DESTRUCTIVE_RE,
  GIT_COMMIT_RE,
  GIT_BRANCH_SWITCH_RE,
  PROSE_FILE_RE,
  BEHAVIORAL_DOC_RE,
  EXECUTABLE_DOC_EXT_RE,
} = await import(
  "data:text/javascript," +
    encodeURIComponent(
      fn.replace(/:\s*string/g, "") +
        `\nconst GIT_OPTS = ${gitOpts};` +
        `\nexport const TEST_RUN_RE = ${testRe};` +
        `\nexport const GIT_COMMIT_PUSH_RE = new RegExp(${gitRe});` +
        `\nexport const GIT_DESTRUCTIVE_RE = new RegExp(${destrRe});` +
        `\nexport const GIT_COMMIT_RE = new RegExp(${commitRe});` +
        `\nexport const GIT_BRANCH_SWITCH_RE = new RegExp(${switchRe});` +
        `\nexport const PROSE_FILE_RE = ${proseRe};` +
        `\nexport const BEHAVIORAL_DOC_RE = new RegExp(${behavRe});` +
        `\nexport const EXECUTABLE_DOC_EXT_RE = ${execExtRe};` +
        `\nexport { commandSkeleton };`,
    )
);

let failed = 0;
const check = (name, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}`);
};

// Assembled at run time so this file does not itself trip the gate it tests.
const GIT = "git" + " " + "commit";
const MAKETEST = "make" + " " + "test";

console.log("command-matching:");

// Real commands must still be caught.
check("commit is a commit", GIT_COMMIT_PUSH_RE.test(commandSkeleton(`${GIT} -m x`)), true);
check("push is a commit-class op", GIT_COMMIT_PUSH_RE.test(commandSkeleton("git push origin master")), true);
check("chained commit is a commit", GIT_COMMIT_PUSH_RE.test(commandSkeleton(`git add -A && ${GIT} -m x`)), true);
check("a test run is evidence", TEST_RUN_RE.test(commandSkeleton(MAKETEST)), true);

// Global options between `git` and the subcommand must not smuggle a
// commit past the gate.
for (const [name, cmd] of [
  ["-c config", `git -c user.name=t -c user.email=t@t ${GIT.split(" ")[1]} -m x`],
  ["-C dir", `git -C /repo ${GIT.split(" ")[1]} -m x`],
  ["--git-dir", `git --git-dir=/r/.git ${GIT.split(" ")[1]} -m x`],
  ["--no-pager push", "git --no-pager push origin master"],
]) {
  check(`gated through ${name}`, GIT_COMMIT_PUSH_RE.test(commandSkeleton(cmd)), true);
  check(`destructive through ${name}`, GIT_DESTRUCTIVE_RE.test(commandSkeleton(cmd)), true);
  // The secret scan and the commit trackers key off GIT_COMMIT_RE; they
  // had their own inline copy of the pattern and evaded the same way.
  if (!cmd.includes("push"))
    check(`secret scan through ${name}`, GIT_COMMIT_RE.test(commandSkeleton(cmd)), true);
}

check(
  "branch switch tracked through -c",
  GIT_BRANCH_SWITCH_RE.test(commandSkeleton("git -c advice.detachedHead=false checkout main")),
  true,
);

// Harmless git must stay ungated, including when a subcommand option
// happens to be followed by a word the gate cares about.
for (const c of [
  "git status",
  "git add -A",
  "git log --oneline",
  "git diff --stat",
  "git log --oneline commit",
  "git show --stat merge",
  "git branch --list push",
])
  check(`not gated: ${c}`, GIT_COMMIT_PUSH_RE.test(commandSkeleton(c)), false);

// A shell's -c payload is a command, not a literal.
check(
  "bash -c payload is still a commit",
  GIT_COMMIT_PUSH_RE.test(commandSkeleton(`bash -c "${GIT} -m x"`)),
  true,
);
check(
  "sh -c payload is still a test run",
  TEST_RUN_RE.test(commandSkeleton(`sh -c '${MAKETEST}'`)),
  true,
);
check(
  "python -c payload stays opaque",
  GIT_COMMIT_PUSH_RE.test(commandSkeleton(`python3 -c "print('${GIT}')"`)),
  false,
);

// Mentions must not be.
check(
  "commit message naming a test run is not evidence",
  TEST_RUN_RE.test(commandSkeleton(`${GIT} -m "ran ${MAKETEST} and it passed"`)),
  false,
);
check(
  "heredoc commit body naming a test run is not evidence",
  TEST_RUN_RE.test(commandSkeleton(`${GIT} -F - <<'EOF'\nVerified: ${MAKETEST} passes\nEOF`)),
  false,
);
check(
  "grepping for the phrase is not a commit",
  GIT_COMMIT_PUSH_RE.test(commandSkeleton(`grep -n '${GIT}' README.md`)),
  false,
);
check(
  "writing docs that quote the phrase is not a commit",
  GIT_COMMIT_PUSH_RE.test(commandSkeleton(`cat > d.md <<'EOF'\nRun ${GIT} to save.\nEOF`)),
  false,
);
check(
  "an unterminated heredoc hides its body",
  GIT_COMMIT_PUSH_RE.test(commandSkeleton(`cat <<'EOF'\n${GIT} -m x`)),
  false,
);

// Prose classification drives the docs-only skip. `inert` is the gate's
// own composition: prose-shaped, and behavioural by nothing.
const inert = (f, { executableDocs = false } = {}) =>
  PROSE_FILE_RE.test(f) &&
  !BEHAVIORAL_DOC_RE.test(f) &&
  !(executableDocs && EXECUTABLE_DOC_EXT_RE.test(f));

// Genuinely inert.
for (const f of [
  "README.md",
  "docs/guide.rst",
  "LICENSE",
  "notes.txt",
  "img/logo.png",
  "CHANGELOG.md",
  "COPYING",
])
  check(`inert prose: ${f}`, inert(f), true);

// Code is never inert.
for (const f of [
  "src/index.ts",
  "Makefile",
  "package.json",
  "hooks/proctor.tsx",
  "build.zig",
  "docs/deploy.sh",
  "docs/Makefile",
  "data/seed.csv",
])
  check(`not inert, code: ${f}`, inert(f), false);

// Prose-shaped but behavioural: a runbook a tool runs, instructions an
// agent reads as its prompt, a fixture or snapshot a test compares to.
for (const f of [
  "plugins/proctor/skills/brainstorming/SKILL.md",
  "SKILL.md",
  "CLAUDE.md",
  "AGENTS.md",
  "GEMINI.md",
  ".claude/commands/deploy.md",
  ".github/pull_request_template.md",
  "runbooks/failover.md",
  "playbooks/oncall.md",
  "tests/fixtures/expected.md",
  "__snapshots__/render.md",
  "spec/golden/output.txt",
  "e2e/cases/login.md",
  "testdata/sample.txt",
  "RUNBOOK.md",
])
  check(`not inert, behavioural: ${f}`, inert(f), false);

// A repo whose toolchain executes its prose: markdown stops being inert,
// assets stay inert.
check("mdbook repo: README.md is not inert", inert("README.md", { executableDocs: true }), false);
check("mdbook repo: guide.rst is not inert", inert("docs/guide.rst", { executableDocs: true }), false);
check("mdbook repo: logo.png stays inert", inert("img/logo.png", { executableDocs: true }), true);
check("mdbook repo: LICENSE stays inert", inert("LICENSE", { executableDocs: true }), true);

process.exit(failed === 0 ? 0 : 1);
