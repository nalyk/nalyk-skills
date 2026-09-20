// Feature inventory: a ratchet, not a description.
//
// Every hook, gate, command, pattern set and config key Proctor ships is
// listed here. Removing one fails this test. Adding one is expected — the
// counts are floors, so new work passes while lost work does not.
//
// When a feature is deliberately retired, delete its line here in the same
// commit, so the removal is visible in review rather than silent.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const src = readFileSync(join(root, "hooks", "proctor.tsx"), "utf8");
const manifest = JSON.parse(
  readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8"),
);

let failed = 0;
const check = (name, ok) => {
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}`);
};
const has = (name, needle) =>
  check(name, typeof needle === "string" ? src.includes(needle) : needle.test(src));

console.log("feature-inventory:");

// ── Hooked events ──────────────────────────────────────────────────────
// Every event the module answers. Losing one silently disables a feature.
for (const ev of [
  "session.start",
  "prompt.section",
  "prompt.submit",
  "tool.call",
  "tool.describe",
  "skill.prompt",
  "turn.complete",
  "agent.spawn",
  "ui.render",
  "attribution.text",
])
  has(`hooks ${ev}`, new RegExp(String.raw`on\(\s*\n?\s*"${ev.replace(".", "\\.")}"`));

// Tool matchers the gates depend on.
for (const tool of ["Bash", "Write", "Edit", "NotebookEdit", "Read", "Agent"])
  has(`matches tool ${tool}`, `tool: "${tool}"`);

// ── Hard gates ─────────────────────────────────────────────────────────
for (const gate of [
  "Proctor gate: no test evidence this session",
  "Proctor gate: test evidence is stale",
  "Proctor gate: tests are failing",
  "Proctor gate: destructive git operation blocked on",
  "Proctor gate: potential credential/secret detected in staged changes",
  "Proctor gate: Write blocked — planning mode active",
  "Proctor gate: Edit blocked — planning mode active",
  "Proctor gate: NotebookEdit blocked — planning mode active",
])
  has(`gate: ${gate.replace("Proctor gate: ", "")}`, gate);

// ── Operator commands ──────────────────────────────────────────────────
// Matched as the literal source text of each command's regex, so a
// command that is deleted or renamed fails here.
for (const [label, literal] of [
  ["status", String.raw`proctor:\s*status\b`],
  ["show trace", String.raw`proctor:\s*show\s+trace\b`],
  ["check", String.raw`proctor:\s*check\b`],
  ["diagnose", String.raw`proctor:\s*diagnose\b`],
  ["approve design", String.raw`proctor:\s*approve\s+design\b`],
  ["quiet on/off", String.raw`proctor:\s*quiet\s+(on|off)\b`],
  ["allow <branch>", String.raw`proctor:\s*allow\s+(\S+)\b`],
  ["tasks N", String.raw`proctor:\s*tasks\s+(\d+)\b`],
  ["sdd stop", String.raw`proctor:\s*sdd\s+stop`],
  ["no tests", String.raw`proctor:\s*no\s+tests\b`],
])
  check(`command: proctor: ${label}`, src.includes(literal));

// ── Pattern sets: floors, so additions pass and losses fail ────────────
const block = (name) =>
  (src.match(new RegExp(String.raw`const ${name}[\s\S]*?\n\];`)) || [""])[0];

const secrets = (block("SECRET_PATTERNS").match(/^\s+\//gm) || []).length;
const testMarkers = (block("TEST_PATTERNS").match(/file:/g) || []).length;
const runners =
  (((src.match(/const TEST_RUN_RE =\n([\s\S]*?);\n/) || ["", ""])[1].match(/\|/g) || [])
    .length) + 1;

check(`SECRET_PATTERNS >= 8 (have ${secrets})`, secrets >= 8);
check(`TEST_PATTERNS >= 26 (have ${testMarkers})`, testMarkers >= 26);
check(`TEST_RUN_RE runners >= 30 (have ${runners})`, runners >= 30);

// ── Observability and state ────────────────────────────────────────────
for (const key of [
  "sdd",
  "session",
  "test",
  "history",
  "trace",
])
  has(`store key: ${key}`, new RegExp(String.raw`${key}:\s*"proctor:`));

for (const metric of [
  "totalCommits",
  "gateDenials",
  "gatesPassed",
  "fixRounds",
  "testsRun",
])
  has(`metric: ${metric}`, metric);

// ── Config surface ─────────────────────────────────────────────────────
for (const key of [
  "protectedBranches",
  "testFreshnessMinutes",
  "watchdogTurnThreshold",
  "fixRoundCap",
  "stepBudgetPerTask",
  "timeBudgetPerTaskMinutes",
  "executableDocPatterns",
]) {
  check(`userConfig: ${key}`, key in manifest.userConfig);
  has(`register reads ${key}`, key);
}

// ── Skills ─────────────────────────────────────────────────────────────
const skills = readdirSync(join(root, "skills"));
check(`skills >= 14 (${skills.length})`, skills.length >= 14);
for (const s of skills)
  check(`skill has SKILL.md: ${s}`, existsSync(join(root, "skills", s, "SKILL.md")));

// ── The hooks module is loadable at all ────────────────────────────────
const hooksJson = JSON.parse(readFileSync(join(root, "hooks", "hooks.json"), "utf8"));
check("hooks.json points at an existing module", existsSync(join(root, "hooks", hooksJson.modules[0])));
check(
  "module carrying JSX is named .tsx",
  !/<[A-Z]|<[a-z]+\.[A-Z]/.test(src) || hooksJson.modules[0].endsWith(".tsx"),
);

process.exit(failed === 0 ? 0 : 1);
