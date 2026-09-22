// Everything Proctor tells the model has to travel on a field the engine
// actually carries to the model. Each test here reads the result the
// engine hands back, so a note written to a field the event does not
// have (the fate of every nudge in 2.8) fails loudly.

import { test, describe, expect } from "claude-code/testing";
import { world } from "./world.ts";

const noted = (r: any) => (r?.context ?? []).join("\n");

describe("the status block", () => {
  test("rides on the next prompt", async ($, on) => {
    const w = world($, on);
    w.bash = (c) => (c === "npm test" ? { fail: "Exit code 1\n2 failing" } : { ok: "" });
    await w.start();
    await w.sh("npm test");
    const r = await w.say("carry on");
    expect(r.text).toBe("carry on");
    expect(noted(r)).toContain("[PROCTOR]");
    expect(noted(r)).toContain("FAILING");
  });

  test("says when no test has run", async ($, on) => {
    const w = world($, on);
    await w.start();
    expect(noted(await w.say("hi"))).toContain("`npm test` required before commit");
  });

  test("keeps what another plugin attached", async ($, on) => {
    const w = world($, on);
    await w.start();
    const r = await $.prompt.submit({ text: "hi", context: ["mine"] } as any);
    expect(r.context?.[0]).toBe("mine");
  });

  test("is not a system prompt section", async ($, on) => {
    const w = world($, on);
    await w.start();
    const r = await $.prompt.section({ name: "env_info_simple", text: "env" });
    expect(r.text).toBe("env");
  });
});

describe("skills", () => {
  test("a skill's prompt carries the live state", async ($, on) => {
    const w = world($, on);
    await w.start();
    const r = await w.skill("proctor:test-driven-development", "TDD body");
    expect(r.text).toContain("TDD body");
    expect(r.text).toContain("Test evidence: ✗ NONE");
  });
});

describe("turn-end notes reach the model", () => {
  test("the watchdog nudge arrives with the next prompt", async ($, on) => {
    const w = world($, on);
    await w.start();
    for (let i = 0; i < 4; i++) await w.turn("did a thing");
    expect(noted(await w.say("next"))).toContain("4 turns without a skill");
  });

  test("a note is delivered once", async ($, on) => {
    const w = world($, on);
    await w.start();
    for (let i = 0; i < 4; i++) await w.turn("did a thing");
    await w.say("next");
    expect(noted(await w.say("again"))).not.toContain("turns without a skill");
  });

  test("a subagent's turns are not the session's", async ($, on) => {
    const w = world($, on);
    await w.start();
    for (let i = 0; i < 6; i++) await w.turn("Task 1: complete", "agent-7");
    expect(noted(await w.say("next"))).not.toContain("turns without a skill");
    expect(w.shelf("proctor:session:v3").turnCount).toBe(0);
    expect(w.shelf("proctor:sdd-state:v3")).toBeNull();
  });

  test("the fix-round cap reaches the model", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("Starting subagent-driven-development for 3 tasks");
    await w.turn("Task 1: fix round 5 — approach: widened the retry window");
    expect(noted(await w.say("go"))).toContain("fix-round limit reached (5/5)");
  });

  test("a loop the fork detects is reported", async ($, on) => {
    const w = world($, on);
    w.fork = () => ({ text: '{"looping":true,"signal":"same patch three times"}' });
    await w.start();
    await w.turn("Starting subagent-driven-development for 3 tasks");
    await w.turn("Task 1: fix round 3 — approach: bumped the timeout again. " + "x".repeat(120));
    expect(noted(await w.say("go"))).toContain("same patch three times");
  });
});

describe("subagent dispatch", () => {
  test("an unspecified model is flagged on the Agent result", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("Starting subagent-driven-development for 3 tasks");
    const r = await $.tool.call({
      tool: "Agent",
      description: "impl",
      prompt: "do task 1",
      subagent_type: "general-purpose",
    } as any);
    expect(noted(r)).toContain("subagent inheriting session model");
  });

  test("a named model draws no note", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("Starting subagent-driven-development for 3 tasks");
    const r = await $.tool.call({
      tool: "Agent",
      description: "impl",
      prompt: "do task 1",
      subagent_type: "general-purpose",
      model: "haiku",
    } as any);
    expect(noted(r)).not.toContain("inheriting");
  });
});

describe("compaction", () => {
  test("the SDD state is in the conversation's context blocks", async ($, on) => {
    const w = world($, on);
    await w.start();
    await w.turn("Starting subagent-driven-development for 4 tasks");
    await w.turn("Task 1: complete — evidence: 12 tests green");
    const r = await $.prompt.context({ blocks: [{ name: "currentDate", text: "today" }] } as any);
    const block = r.blocks.find((b: any) => b.name === "proctor");
    expect(r.blocks[0].name).toBe("currentDate");
    expect(block?.text).toContain("Tasks: 1/4 complete");
    expect(block?.text).toContain("Resume from: Task 2");
  });

  test("no SDD run, no block", async ($, on) => {
    const w = world($, on);
    await w.start();
    const r = await $.prompt.context({ blocks: [] } as any);
    expect(r.blocks.length).toBe(0);
  });
});
