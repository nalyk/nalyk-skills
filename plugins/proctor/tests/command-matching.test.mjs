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
const gitOpts = pick(/const GIT_OPTS = (.*);/, "GIT_OPTS");
const gitRe = pick(/const GIT_COMMIT_PUSH_RE = new RegExp\(\n([\s\S]*?)\n\);/, "GIT_COMMIT_PUSH_RE");
const destrRe = pick(/const GIT_DESTRUCTIVE_RE = new RegExp\(\n([\s\S]*?)\n\);/, "GIT_DESTRUCTIVE_RE");
const proseRe = pick(/const PROSE_FILE_RE =\n([\s\S]*?);\n/, "PROSE_FILE_RE").trim();

const {
  commandSkeleton,
  TEST_RUN_RE,
  GIT_COMMIT_PUSH_RE,
  GIT_DESTRUCTIVE_RE,
  PROSE_FILE_RE,
} = await import(
  "data:text/javascript," +
    encodeURIComponent(
      fn.replace(/:\s*string/g, "") +
        `\nconst GIT_OPTS = ${gitOpts};` +
        `\nexport const TEST_RUN_RE = ${testRe};` +
        `\nexport const GIT_COMMIT_PUSH_RE = new RegExp(${gitRe});` +
        `\nexport const GIT_DESTRUCTIVE_RE = new RegExp(${destrRe});` +
        `\nexport const PROSE_FILE_RE = ${proseRe};` +
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
}

// Harmless git must stay ungated.
for (const c of ["git status", "git add -A", "git log --oneline", "git diff --stat"])
  check(`not gated: ${c}`, GIT_COMMIT_PUSH_RE.test(commandSkeleton(c)), false);

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

// Prose classification drives the docs-only skip.
for (const f of [
  "README.md",
  "docs/guide.rst",
  "LICENSE",
  "notes.txt",
  "img/logo.png",
  "CHANGELOG.md",
])
  check(`prose: ${f}`, PROSE_FILE_RE.test(f), true);

for (const f of [
  "src/index.ts",
  "Makefile",
  "package.json",
  "hooks/proctor.tsx",
  "build.zig",
])
  check(`code: ${f}`, PROSE_FILE_RE.test(f), false);

process.exit(failed === 0 ? 0 : 1);
