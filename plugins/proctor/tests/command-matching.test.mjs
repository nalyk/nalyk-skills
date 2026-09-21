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
const testRe = pick(/const TEST_RUN_RE = new RegExp\(\n([\s\S]*?)\n\);/, "TEST_RUN_RE");
const isTestRunFn = pick(/function isTestRun[\s\S]*?\n}\n/, "isTestRun");
const testPatternsBlock = pick(/const TEST_PATTERNS[\s\S]*?\n\];/, "TEST_PATTERNS");
const toolFns = pick(/function toolFailed[\s\S]*?\nfunction toolOutput[\s\S]*?\n}\n/, "tool result helpers");
const secretsBlock = pick(/const SECRET_PLACEHOLDER_RE =[\s\S]*?\nfunction containsSecret[\s\S]*?\n}\n/, "containsSecret");
const gitOpts = pick(/const GIT_OPTS =\s([\s\S]*?);\n/, "GIT_OPTS");
const gitRe = pick(/const GIT_COMMIT_PUSH_RE = new RegExp\(\n([\s\S]*?)\n\);/, "GIT_COMMIT_PUSH_RE");
const destrRe = pick(/const GIT_DESTRUCTIVE_RE = new RegExp\(\n([\s\S]*?)\n\);/, "GIT_DESTRUCTIVE_RE");
const commitRe = pick(/const GIT_COMMIT_RE = new RegExp\(\n([\s\S]*?)\n\);/, "GIT_COMMIT_RE");
const stagingRe = pick(/const GIT_STAGING_RE = new RegExp\(\n([\s\S]*?)\n\);/, "GIT_STAGING_RE");
const switchRe = pick(/const GIT_BRANCH_SWITCH_RE = new RegExp\(\n([\s\S]*?)\n\);/, "GIT_BRANCH_SWITCH_RE");
const proseRe = pick(/const PROSE_FILE_RE =\n([\s\S]*?);\n/, "PROSE_FILE_RE").trim();
const behavRe = pick(/const BEHAVIORAL_DOC_RE = new RegExp\(\n([\s\S]*?)\n\);/, "BEHAVIORAL_DOC_RE");
const execExtRe = pick(/const EXECUTABLE_DOC_EXT_RE = (.*);/, "EXECUTABLE_DOC_EXT_RE");

const {
  commandSkeleton,
  isTestRun,
  containsSecret,
  toolFailed,
  toolOutput,
  TEST_RUN_RE,
  GIT_COMMIT_PUSH_RE,
  GIT_DESTRUCTIVE_RE,
  GIT_COMMIT_RE,
  GIT_BRANCH_SWITCH_RE,
  GIT_STAGING_RE,
  PROSE_FILE_RE,
  BEHAVIORAL_DOC_RE,
  EXECUTABLE_DOC_EXT_RE,
} = await import(
  "data:text/javascript," +
    encodeURIComponent(
      fn.replace(/:\s*string/g, "") +
        `\nconst GIT_OPTS = ${gitOpts};` +
        `\nexport const TEST_RUN_RE = new RegExp(${testRe});` +
        `\n${isTestRunFn.replace(/:\s*string/g, "").replace(/:\s*boolean/g, "")}` +
        `\n${secretsBlock.replace(/:\s*RegExp\[\]/g, "").replace(/\(text: string\)/g, "(text)").replace(/:\s*RegExp \| null/g, "")}` +
        `\n${toolFns.replace(/result: any/g, "result").replace(/:\s*boolean/g, "").replace(/:\s*string/g, "")}` +
        `\nexport { isTestRun, containsSecret, toolFailed, toolOutput };` +
        `\nexport const GIT_COMMIT_PUSH_RE = new RegExp(${gitRe});` +
        `\nexport const GIT_DESTRUCTIVE_RE = new RegExp(${destrRe});` +
        `\nexport const GIT_COMMIT_RE = new RegExp(${commitRe});` +
        `\nexport const GIT_BRANCH_SWITCH_RE = new RegExp(${switchRe});` +
        `\nexport const GIT_STAGING_RE = new RegExp(${stagingRe});` +
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
check("a test run is evidence", isTestRun((commandSkeleton(MAKETEST))), true);

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
  isTestRun((commandSkeleton(`sh -c '${MAKETEST}'`))),
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
  isTestRun((commandSkeleton(`${GIT} -m "ran ${MAKETEST} and it passed"`))),
  false,
);
check(
  "heredoc commit body naming a test run is not evidence",
  isTestRun((commandSkeleton(`${GIT} -F - <<'EOF'\nVerified: ${MAKETEST} passes\nEOF`))),
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

// ── Silent-bug regressions (audit tier 1) ─────────────────────────────

// S1: naming a test tool is not running one.
for (const c of [
  "pip install pytest",
  "cat jest.config.js",
  "ls pytest.ini",
  "grep -rn vitest src/",
  "echo pytest",
  "npm install --save-dev jest",
  "git log --grep=pytest",
])
  check(`S1 mention is not a run: ${c}`, isTestRun(commandSkeleton(c)), false);

// S1: real runs, including the forms the old pattern missed.
for (const c of [
  "npm test",
  "npm run test",
  "npm run test:unit",
  "npm t",
  "yarn test",
  "pnpm run test",
  "cargo test",
  "cargo nextest run",
  "go test ./...",
  "pytest -q",
  "python3 -m pytest",
  "make test",
  "./gradlew test",
  "mvn test",
  "bundle exec rspec",
  "vitest run",
  "npx jest --ci",
  "cd packages/api && npm test",
  "CI=1 npm test",
  "poetry run pytest",
  "dotnet test",
  "bazel test //...",
])
  check(`S1 real run detected: ${c}`, isTestRun(commandSkeleton(c)), true);

// S4: `<<` inside a quoted string must not blank the rest of the command.
check(
  "S4 quoted << does not blind the gate",
  GIT_COMMIT_PUSH_RE.test(commandSkeleton(`echo "a << b" && ${GIT} -m wip`)),
  true,
);
check(
  "S4 a real heredoc still hides its body",
  GIT_COMMIT_PUSH_RE.test(commandSkeleton(`cat <<'EOF'\n${GIT} -m x`)),
  false,
);

// S5: unquoted and modern credential shapes.
//
// Every fixture below is assembled at run time. Written out literally,
// this file would be a diff full of credential-shaped strings and
// Proctor's own secret gate would block any commit touching it — which
// is the gate working, not a reason to weaken it.
const K = (...parts) => parts.join("");
const A16 = "IOSFODNN7EXAMPLE";

for (const line of [
  K("+DB_", "PASSWORD=supersecret123"),
  K("+API_", "KEY=abcdef1234567890abcdef"),
  K("+sk", "-T3BlbkFJT3BlbkFJT3BlbkFJT3BlbkFJT3BlbkFJ"),
  K("+OPENAI_API_", "KEY=sk", "-proj-aB3xY9zQ1wKmN7pQ4rS8tU2vW6xZ0yA1bC5dE9fG3hJ7kL"),
  K("+GH=github", "_pat_11AAAAAAA0abcdefghijklmnopqrstuvwxyz012345"),
  K("+AWS_ACCESS_KEY_ID=", "ASIA", A16),
  K("+-----BEGIN ", "ENCRYPTED PRIVATE KEY", "-----"),
  K("+", "AKIA", A16),
  K("+-----BEGIN ", "RSA PRIVATE KEY", "-----"),
  K('+password: "', 'hunter2hunter2"'),
])
  check(`S5 secret caught: ${line.slice(0, 40)}`, containsSecret(line) !== null, true);

// S5: placeholders and templating must not block a legitimate commit.
for (const line of [
  K("+", "PASSWORD=${DB_PASSWORD}"),
  K("+api_", "key=<your-key-here>"),
  K("+", "password=changeme"),
  K("+SECRET_", "KEY=********"),
  K("+", "token={{ vault_token }}"),
  K("+# ", "password=... see the runbook"),
  K("+const ", "password = process.env.PASSWORD;"),
])
  check(`S5 not a secret: ${line.slice(0, 40)}`, containsSecret(line) !== null, false);

// S6: every staging form widens the scan.
for (const c of [
  "git commit -a -m x",
  "git commit -am x",
  "git commit --all -m x",
  "git commit --include src/a.ts -m x",
  "git commit --only src/a.ts -m x",
  "git add -A && git commit -m x",
])
  check(`S6 staging recognised: ${c}`, GIT_STAGING_RE.test(commandSkeleton(c)), true);

// A plain commit does not widen the scan by flag. `git commit <pathspec>`
// does not either — it is caught at run time instead, by the gate scanning
// the working tree whenever the staged diff is empty, which no regex over
// the command line can tell apart from a flagless commit.
for (const c of ["git commit -m x", "git commit secrets.env -m add"])
  check(`S6 not flagged as staging: ${c}`, GIT_STAGING_RE.test(commandSkeleton(c)), false);

// Coverage ratchet: the gate names a command in its denial text, taken
// from TEST_PATTERNS. If isTestRun cannot recognise that same command, the
// user runs what they were told to and the gate denies again — an
// unbreakable loop. Every entry must round-trip.
const advertised = [...testPatternsBlock.matchAll(/command:\s*"([^"]+)"/g)].map((m) => m[1]);
check(`TEST_PATTERNS has entries (${advertised.length})`, advertised.length >= 25, true);
for (const cmd of [...new Set(advertised)])
  check(`advertised command round-trips: ${cmd}`, isTestRun(commandSkeleton(cmd)), true);

// S25: the tool.call result shape. Verified against this build with a
// probe plugin: { ref, result, text, isError } — no exitCode, no stdout,
// no stderr. Reading those recorded every failing run as a pass.
check("S25 isError=true is a failure", toolFailed({ isError: true, text: "boom" }), true);
check("S25 isError=false is a pass", toolFailed({ isError: false, text: "ok" }), false);
check("S25 absent isError is a pass", toolFailed({ text: "ok" }), false);
check("S25 a numeric exitCode still wins", toolFailed({ exitCode: 2, isError: false }), true);
check("S25 exitCode 0 still wins", toolFailed({ exitCode: 0, isError: true }), false);
check("S25 output comes from text", toolOutput({ text: "1 failing", isError: true }), "1 failing");
check("S25 output falls back to result", toolOutput({ result: "done" }), "done");
check("S25 stdout/stderr still honoured", toolOutput({ stdout: "a", stderr: "b" }), "ab");
check("S25 missing output is empty", toolOutput({}), "");

process.exit(failed === 0 ? 0 : 1);
