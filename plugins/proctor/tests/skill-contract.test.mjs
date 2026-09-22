// The contract between the teaching layer and the enforcement layer.
//
// The hooks read what the skills tell the model to write. When the two
// drift, nothing fails: SDD tracking once parsed phrases no skill ever
// asked for, so a real run was never tracked while every test that fed
// those phrases in by hand passed. This file checks the two against each
// other, from the files themselves.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const src = readFileSync(join(root, "hooks", "proctor.tsx"), "utf8");
const readme = readFileSync(join(root, "README.md"), "utf8");
const skillDirs = readdirSync(join(root, "skills")).sort();
const skillText = Object.fromEntries(
  skillDirs.map((d) => [d, readFileSync(join(root, "skills", d, "SKILL.md"), "utf8")]),
);

let failed = 0;
const check = (name, ok, detail) => {
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
};

/** A regex literal declared in the source, as a live RegExp. */
function literal(name) {
  const m = src.match(new RegExp(String.raw`^const ${name}\s*=\s*\n?\s*(\/.+\/[gimsuy]*);\s*$`, "m"));
  if (!m) throw new Error(`regex ${name} not found in proctor.tsx`);
  return new Function(`return ${m[1]};`)();
}

/** A Set or Record of skill names declared in the source. */
function names(name) {
  const m = src.match(new RegExp(String.raw`const ${name}[^=]*=\s*(new Set\(\[|\{)([\s\S]*?)(?:\]\)|\});`));
  if (!m) throw new Error(`${name} not found in proctor.tsx`);
  // A Record's names are its keys; a Set's are its members.
  const key = m[1] === "{" ? /"([^"]+)"\s*:/g : /"([^"]+)"/g;
  return [...m[2].matchAll(key)].map((x) => x[1]);
}

/** A skill's template, placeholders filled the way a model fills them. */
const fill = (t) =>
  t
    .replace(/<N>/g, "3")
    .replace(/<M>/g, "2")
    .replace(/<plan path>/g, "docs/plans/2026-09-22-x.md")
    .replace(/<[^>]+>/g, "a concrete value here");

console.log("skill-contract:");

// ── Every skill is loadable ────────────────────────────────────────────
for (const d of skillDirs) {
  const t = skillText[d];
  const fm = t.match(/^---\n([\s\S]*?)\n---\n/);
  check(`${d}: has frontmatter`, !!fm);
  const name = fm?.[1].match(/^name:\s*(.+)$/m)?.[1].trim();
  const desc = fm?.[1].match(/^description:\s*(.+)$/m)?.[1].trim();
  check(`${d}: name matches its folder`, name === d, name);
  check(`${d}: has a description`, !!desc && desc.length > 20, desc);
}

// ── Every skill the hooks name exists ──────────────────────────────────
for (const set of ["SKILL_PHASE_MAP", "PLANNING_SKILLS", "IMPLEMENTATION_SKILLS", "SDD_SKILLS", "FINISHING_SKILLS"]) {
  for (const n of names(set)) {
    const bare = n.replace(/^proctor:/, "");
    check(`${set} names a real skill: ${n}`, existsSync(join(root, "skills", bare, "SKILL.md")));
  }
}

// ── Every command the docs teach is one the hooks answer ───────────────
const commandRes = [...src.matchAll(/\\bproctor:\\s\*([a-z\\s+()|]+?)(?:\\b|\()/g)].map((m) => m[1]);
const known = [
  "status", "show trace", "check", "diagnose", "approve design", "quiet on", "quiet off",
  "tasks N", "sdd stop", "no tests", "budget extend", "allow <branch>",
];
const taught = new Set();
for (const text of [readme, ...Object.values(skillText)]) {
  for (const m of text.matchAll(/`proctor: ([a-z][a-z <>N]*[a-zN>])`/g)) taught.add(m[1]);
}
for (const cmd of taught) {
  const probe = `proctor: ${cmd.replace(/<branch>/, "main").replace(/\bN\b/, "4")}`;
  const answered = [
    /\bproctor:\s*status\b/i, /\bproctor:\s*show\s+trace\b/i, /\bproctor:\s*check\b/i,
    /\bproctor:\s*diagnose\b/i, /\bproctor:\s*approve\s+design\b/i, /\bproctor:\s*quiet\s+(on|off)\b/i,
    /\bproctor:\s*tasks\s+(\d+)\b/i, /\bproctor:\s*sdd\s+stop\b/i, /\bproctor:\s*no\s+tests\b/i,
    /\bproctor:\s*budget\s+extend\b/i, /\bproctor:\s*allow\s+(\S+)\b/i,
  ].some((re) => re.test(probe));
  check(`taught command is answered: proctor: ${cmd}`, answered);
}
check("the hooks answer every command the README documents", known.every((k) => taught.has(k)), [...taught]);
check("command regexes are present in the source", commandRes.length >= 8, commandRes.length);

// ── The ledger lines the skills teach parse as the hooks read them ─────
const TASK_COMPLETE_RE = literal("TASK_COMPLETE_RE");
const FIX_ROUND_RE = literal("FIX_ROUND_RE");
const RULING_RE = literal("RULING_RE");
const RULING_SEPARATOR_RE = literal("RULING_SEPARATOR_RE");
const MINOR_DEFERRED_RE = literal("MINOR_DEFERRED_RE");
const PLAN_HEADER_RE = literal("PLAN_HEADER_RE");
const TASK_ADDED_RE = literal("TASK_ADDED_RE");
const PLAN_TASK_HEADING_RE = literal("PLAN_TASK_HEADING_RE");
const LEDGER_PATH_RE = literal("LEDGER_PATH_RE");

const reset = (re) => ((re.lastIndex = 0), re);
const templates = (skill) => [...skillText[skill].matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);

for (const skill of ["subagent-driven-development", "executing-plans"]) {
  const t = templates(skill);
  const find = (re) => t.find((x) => reset(re).test(fill(x)));

  check(`${skill}: keeps its ledger at a path the hooks read`, LEDGER_PATH_RE.test("docs/plans/progress.md") && /`progress\.md`/.test(skillText[skill]));

  const done = find(TASK_COMPLETE_RE);
  check(`${skill}: teaches a completion line the hooks parse`, !!done, t.filter((x) => /Task/.test(x)));

  const header = find(PLAN_HEADER_RE);
  const h = header && fill(header).match(PLAN_HEADER_RE);
  check(`${skill}: teaches a ledger header that names the plan and its size`, !!h && !!h[1] && h[2] === "3", header);

  const ruling = t.find((x) => /^Ruling:/.test(x));
  const r = ruling && reset(RULING_RE).exec(fill(ruling));
  check(`${skill}: teaches a three-part ruling`, !!r && r[1].split(RULING_SEPARATOR_RE).length === 3, ruling);

  const minor = find(MINOR_DEFERRED_RE);
  check(`${skill}: teaches the deferred-minor line`, !!minor, t.filter((x) => /minor/i.test(x)));
}

{
  const t = templates("subagent-driven-development");
  const fix = t.find((x) => reset(FIX_ROUND_RE).test(fill(x)));
  const m = fix && reset(FIX_ROUND_RE).exec(fill(fix));
  check("SDD: teaches the fix-round line, task and round both read", !!m && m[1] === "3" && m[2] === "2", fix);
  check("SDD: the fix-round line carries the approach", !!fix && /approach:/.test(fix), fix);
  const added = t.find((x) => reset(TASK_ADDED_RE).test(fill(x)));
  check("SDD: teaches the scope line", !!added);
}

{
  const t = templates("writing-plans");
  const heading = t.find((x) => /^###/.test(x));
  const n = heading ? [...fill(heading).matchAll(reset(PLAN_TASK_HEADING_RE))].length : 0;
  check("writing-plans: teaches a task heading the hooks count", n === 1, heading);
}

// ── Every hook claim a skill makes names a mechanism that exists ───────
const claims = [
  ["finishing-a-development-branch", /git merge` is denied/, /the SDD run is not done — merge blocked/],
  ["subagent-driven-development", /round 6 is\s+denied/, /is past its fix-round cap/],
  ["requesting-code-review", /any further\s+dispatch is denied/, /is past its fix-round cap/],
  ["using-git-worktrees", /detects\s+the default branch dynamically/, /refs\/remotes\/origin\/HEAD/],
  ["using-proctor", /Test failure context/, /Failure output:/],
  ["using-proctor", /Auto-detects "Task N: added"|auto-detects "Task N: added"/i, /TASK_ADDED_RE/],
  ["dispatching-parallel-agents", /spend[s]? one step/, /live\.toolCallsThisTask\+\+/],
];
for (const [skill, claim, mechanism] of claims) {
  const said = claim.test(skillText[skill]);
  check(`${skill}: claim ${claim} has its mechanism`, said && mechanism.test(src), { said });
}

process.exit(failed === 0 ? 0 : 1);
