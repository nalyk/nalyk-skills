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
const unquotedFn = pick(/function unquotedSkeleton[\s\S]*?\n}\n/, "unquotedSkeleton");
const heredocFn = pick(/function stripHeredocs[\s\S]*?\n}\n/, "stripHeredocs");
const spansFn = pick(/function quotedSpans[\s\S]*?\n}\n/, "quotedSpans");
const writeTargetsFn = pick(/function shellWriteTargets[\s\S]*?\n}\n/, "shellWriteTargets");
const addedFn = pick(/function addedLines[\s\S]*?\n}\n/, "addedLines");
const writePath = pick(/const WRITE_PATH = (.*);/, "WRITE_PATH");
const devSinkRe = pick(/const DEV_SINK_RE = (.*);/, "DEV_SINK_RE");
const verbEnd = pick(/const GIT_VERB_END = (.*);/, "GIT_VERB_END");
const testRe = pick(/const TEST_RUN_RE = new RegExp\(\n([\s\S]*?)\n\);/, "TEST_RUN_RE");
const isTestRunFn = pick(/function isTestRun[\s\S]*?\n}\n/, "isTestRun");
const testPatternsBlock = pick(/const TEST_PATTERNS[\s\S]*?\n\];/, "TEST_PATTERNS");
const designFn = pick(/function isDesignDoc[\s\S]*?\n}\n/, "isDesignDoc");
const allMatchesFn = pick(/function allMatches[\s\S]*?\n}\n/, "allMatches");
const taskRe = pick(/const TASK_COMPLETE_RE =\n([\s\S]*?);\n/, "TASK_COMPLETE_RE");
const rulingRe = pick(/const RULING_RE = (.*);/, "RULING_RE");
const rulingSepRe = pick(/const RULING_SEPARATOR_RE = (.*);/, "RULING_SEPARATOR_RE");
const rulingCostRe = pick(/const RULING_COST_RE = (.*);/, "RULING_COST_RE");
const shellWriteRe = pick(/const SHELL_WRITE_RE = new RegExp\(\n([\s\S]*?)\n\);/, "SHELL_WRITE_RE");
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
  isDesignDoc,
  allMatches,
  shellWriteTargets,
  addedLines,
  TASK_COMPLETE_RE,
  RULING_RE,
  RULING_SEPARATOR_RE,
  RULING_COST_RE,
  SHELL_WRITE_RE,
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
        `\n${unquotedFn.replace(/:\s*string/g, "")}` +
        `\n${heredocFn.replace(/:\s*string/g, "")}` +
        `\n${spansFn.replace(/:\s*string/g, "").replace(/:\s*Array<\[number, number\]>/g, "").replace(/const spans[^=]*=/, "const spans =")}` +
        `\nconst WRITE_PATH = ${writePath};` +
        `\nconst DEV_SINK_RE = ${devSinkRe};` +
        `\nexport const SHELL_WRITE_RE = new RegExp(${shellWriteRe});` +
        `\n${writeTargetsFn.replace(/:\s*string\[\]/g, "").replace(/:\s*string/g, "").replace(/const targets[^=]*=/, "const targets =").replace(/\(at: number\)/, "(at)")}` +
        `\n${addedFn.replace(/:\s*string/g, "")}` +
        `\nexport { shellWriteTargets, addedLines };` +
        `\nconst GIT_VERB_END = ${verbEnd};` +
        `\nconst GIT_OPTS = ${gitOpts};` +
        `\nexport const TEST_RUN_RE = new RegExp(${testRe});` +
        `\n${isTestRunFn.replace(/:\s*string/g, "").replace(/:\s*boolean/g, "")}` +
        `\n${secretsBlock.replace(/:\s*RegExp\[\]/g, "").replace(/\(text: string\)/g, "(text)").replace(/:\s*RegExp \| null/g, "")}` +
        `\n${toolFns.replace(/result: any/g, "result").replace(/:\s*boolean/g, "").replace(/:\s*string/g, "")}` +
        `\n${designFn.replace(/:\s*string/g, "").replace(/:\s*boolean/g, "")}` +
        `\n${allMatchesFn.replace(/re: RegExp/g, "re").replace(/text: string/g, "text").replace(/:\s*RegExpMatchArray\[\]/g, "")}` +
        `\nexport const TASK_COMPLETE_RE = ${taskRe.trim()};` +
        `\nexport const RULING_RE = ${rulingRe};` +
        `\nexport const RULING_SEPARATOR_RE = ${rulingSepRe};` +
        `\nexport const RULING_COST_RE = ${rulingCostRe};` +
        `\nexport { isTestRun, containsSecret, toolFailed, toolOutput, isDesignDoc, allMatches };` +
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

// ── Silent-bug regressions (audit tiers 2 and 3) ──────────────────────

// S8: the planning exemption is about the file, not its ancestors.
for (const f of ["docs/design.md", "PLAN.md", "notes.txt", "rfc/0001-x.md"])
  check(`S8 design doc: ${f}`, isDesignDoc(f), true);
for (const f of [
  "design-system/src/index.ts",
  "src/api-spec/handler.go",
  "/data/repo/rfc/lib.rs",
  "src/components/Plan.tsx",
])
  check(`S8 not a design doc: ${f}`, isDesignDoc(f), false);

// S10: discard-everything is destructive; switching branches is not.
for (const c of ["git checkout -- .", "git checkout .", "git restore .", "git checkout -- src/a.ts"])
  check(`S10 destructive: ${c}`, GIT_DESTRUCTIVE_RE.test(commandSkeleton(c)), true);
for (const c of ["git checkout -b feat", "git checkout main", "git status"])
  check(`S10 not destructive: ${c}`, GIT_DESTRUCTIVE_RE.test(commandSkeleton(c)), false);

// S13: the phrasings that used to stall the SDD machine.
for (const t of [
  "Task 3: complete",
  "Task 3 complete",
  "Task 3: completed",
  "Task 3 — done",
  "**Task 12: complete**",
  "Task 4 is finished",
])
  check(`S13 completion recognised: ${t}`, allMatches(TASK_COMPLETE_RE, t).length, 1);

// S15: every signal in a turn, not just the first.
check(
  "S15 two completions in one answer",
  allMatches(TASK_COMPLETE_RE, "Task 3: complete\nThen Task 4: complete").map((m) => m[1]).join(","),
  "3,4",
);

// S14: rulings written with an em dash, as three skills instruct.
const parseRuling = (line) => {
  const m = allMatches(RULING_RE, line)[0];
  const segments = (m?.[1] ?? "").split(RULING_SEPARATOR_RE).map((x) => x.trim()).filter(Boolean);
  const costSeg =
    segments.find((x) => RULING_COST_RE.test(x)) ??
    (segments.length > 2 ? segments[segments.length - 1] : undefined);
  return {
    text: segments[0] ?? "",
    cost: costSeg ? (costSeg.match(RULING_COST_RE)?.[1] ?? costSeg).trim() : "unknown",
  };
};

const emDash = parseRuling("Ruling: use cache \u2014 simpler \u2014 cost if wrong: perf");
check("S14 em-dash ruling text", emDash.text, "use cache");
check("S14 em-dash ruling cost", emDash.cost, "perf");

const ascii = parseRuling("Ruling: use cache -- simpler -- cost if wrong: perf");
check("S14 ascii ruling cost", ascii.cost, "perf");

const twoPart = parseRuling("Ruling: use cache -- cost if wrong: perf");
check("S14 two-part ruling cost", twoPart.cost, "perf");

check(
  "S15 two rulings in one answer",
  allMatches(RULING_RE, "Ruling: A -- cost if wrong: x\nRuling: B -- cost if wrong: y").length,
  2,
);

// S9: shell writes the planning gate must see.
for (const [c, target] of [
  ["cat > src/index.ts <<EOF", "src/index.ts"],
  ["echo x >> src/app.js", "src/app.js"],
  ["sed -i 's/a/b/' src/app.ts", "src/app.ts"],
  ["tee src/out.ts", "src/out.ts"],
  // tee is the third capture group; the gate read only the first two.
  ["echo x | tee -a src/out.ts", "src/out.ts"],
  // A quoted path was blanked out of the skeleton before the match ran.
  ["echo hi > 'src/impl.ts'", "src/impl.ts"],
  ['cat foo > "src/impl.ts"', "src/impl.ts"],
])
  check(`S9 shell write target: ${c}`, shellWriteTargets(c)[0], target);

check("S9 a read is not a write", shellWriteTargets("cat src/index.ts").length, 0);

// Every write in the line, not just the first: judging the whole command
// by `notes.md` let the .ts write through the planning gate.
check(
  "S9 both writes in a chain",
  shellWriteTargets("echo a > notes.md && echo b > src/impl.ts").join(","),
  "notes.md,src/impl.ts",
);

// Redirections that write nothing a planning gate cares about.
for (const c of ["ls -la > /dev/null", "npm run build 2>&1", "cmd > /dev/stderr"])
  check(`S9 not an implementation write: ${c}`, shellWriteTargets(c).length, 0);

// A write named inside a string is still only a mention.
for (const c of [`echo "redirect > out.ts"`, `git log --grep 'x > y.ts'`])
  check(`S9 a mention is not a write: ${c}`, shellWriteTargets(c).length, 0);

// S15: the secret scan reads what a change adds. Scanning the whole diff
// blocked the commit that removes a leaked key.
{
  const key = "AWS_ACCESS_KEY_ID=" + "AKIA" + "IOSFODNN7EXAMPLE";
  const diff = `--- a/.env\n+++ b/.env\n@@ -1 +1 @@\n-${key}\n+${key.split("=")[0]}=\${AWS_KEY}\n`;
  check("S15 a removed secret is not an added one", containsSecret(addedLines(diff)) !== null, false);
  check("S15 an added secret still is", containsSecret(addedLines(`+${key}`)) !== null, true);
}

// S23: `\b` after the verb matched before a hyphen, so plumbing that
// commits nothing tripped the commit gate and the secret scan.
for (const c of ["git commit-tree $t -m x", "git checkout-index -a"])
  check(`S23 plumbing is not the verb: ${c}`, GIT_COMMIT_PUSH_RE.test(commandSkeleton(c)), false);
check("S23 the verb itself still matches", GIT_COMMIT_RE.test(commandSkeleton(`${GIT} -m x`)), true);
check(
  "S23 checkout-index does not read as a branch switch",
  GIT_BRANCH_SWITCH_RE.test(commandSkeleton("git checkout-index -a")),
  false,
);

// S22: classification gaps closed.
for (const f of [
  "plugins/proctor/commands/ship.md",
  "plugins/debate/agents/reviewer.md",
  "plugins/debate/references/x.md",
  "plugins/debate/templates/y.md",
])
  check(`S22 plugin behaviour, not prose: ${f}`, PROSE_FILE_RE.test(f) && !BEHAVIORAL_DOC_RE.test(f), false);

for (const f of ["changelog.py", "license.js", "notice.ts"])
  check(`S22 code, not prose: ${f}`, PROSE_FILE_RE.test(f), false);

for (const f of ["CHANGELOG.md", "LICENSE", "LICENSE.txt", "COPYING"])
  check(`S22 still prose: ${f}`, PROSE_FILE_RE.test(f) && !BEHAVIORAL_DOC_RE.test(f), true);

process.exit(failed === 0 ? 0 : 1);
