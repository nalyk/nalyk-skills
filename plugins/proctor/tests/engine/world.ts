// The world beneath Proctor for `claude plugin test`: the engine is real,
// and these hooks answer what the engine would ask of the host — git,
// the filesystem, the store, the tools themselves — from tables a test
// sets. Nothing here reimplements an event's shape; every answer is
// checked by the engine against its own contract.

export type Outcome =
  | { ok: string }
  | { fail: string }
  | { background: string }
  | { interrupted: string }
  | { timedOut: string };

export type World = {
  logs: string[];
  ran: string[];
  git: Record<string, { stdout?: string; exitCode?: number }>;
  files: Record<string, string>;
  /** What the next Bash call reports; `ok` when unset. */
  bash: (cmd: string) => Outcome;
  start: () => Promise<void>;
  sh: (command: string, extra?: Record<string, unknown>) => Promise<any>;
  write: (tool: "Write" | "Edit" | "NotebookEdit", path: string) => Promise<any>;
  say: (text: string) => Promise<any>;
  turn: (answer: string, agentId?: string) => Promise<any>;
  skill: (name: string, text?: string) => Promise<any>;
  logText: () => string;
  /** The plugin's store, as the engine keeps it: key to stored value. */
  store: Map<string, unknown>;
  /** This project's record under a per-project key. */
  shelf: (key: string) => any;
  /** Rewrite this project's record under a per-project key. */
  reshelve: (key: string, fn: (value: any) => any) => void;
  /** What `$.model.fork` answers; null (an API error) when unset. */
  fork: (prompt: string) => { text: string } | null;
};

export const ROOT = "/repo";

export function world($: any, on: any, opts: {
  branch?: string;
  files?: Record<string, string>;
  git?: Record<string, { stdout?: string; exitCode?: number }>;
  store?: Record<string, unknown>;
} = {}): World {
  const w: World = {
    store: new Map(Object.entries(opts.store ?? {})),
    shelf: (key) => {
      const raw = w.store.get(key);
      if (typeof raw !== "string") return null;
      return JSON.parse(raw)?.[ROOT]?.value ?? null;
    },
    reshelve: (key, fn) => {
      const raw = w.store.get(key);
      const book = typeof raw === "string" ? JSON.parse(raw) : {};
      book[ROOT] = { at: Date.now(), value: fn(book[ROOT]?.value ?? null) };
      w.store.set(key, JSON.stringify(book));
    },
    fork: () => null,
    logs: [],
    ran: [],
    git: {
      "git branch --show-current": { stdout: `${opts.branch ?? "feature"}\n` },
      "git rev-parse --git-dir": { stdout: ".git\n" },
      "git rev-parse --git-common-dir": { stdout: ".git\n" },
      "git rev-parse --show-toplevel": { stdout: `${ROOT}\n` },
      "git status --porcelain": { stdout: "" },
      "git diff --cached -U0": { stdout: "" },
      "git diff --cached --stat": { stdout: "" },
      "git diff --cached --name-only": { stdout: "" },
      "git diff HEAD -U0": { stdout: "" },
      "git diff --name-only": { stdout: "" },
      "git ls-files --others --exclude-standard": { stdout: "" },
      ...(opts.git ?? {}),
    },
    files: opts.files ?? {
      "package.json": JSON.stringify({ scripts: { test: "vitest" } }),
    },
    bash: () => ({ ok: "" }),
    start: async () => {
      await $.session.start({ cwd: ROOT, surface: null, isInteractive: false });
    },
    sh: (command, extra = {}) => $.tool.call({ tool: "Bash", command, ...extra }),
    write: (tool, path) =>
      tool === "Write"
        ? $.tool.call({ tool, file_path: path, content: "x" })
        : tool === "Edit"
          ? $.tool.call({ tool, file_path: path, old_string: "a", new_string: "b" })
          : $.tool.call({ tool, notebook_path: path, new_source: "x" }),
    say: (text) => $.prompt.submit({ text }),
    turn: (answer, agentId) =>
      $.turn.complete({
        answer,
        durationMs: 1,
        isAborted: false,
        turnId: `t${Math.random()}`,
        reason: "answer",
        ...(agentId ? { agentId } : {}),
      }),
    skill: (name, text = "skill body") => $.skill.prompt({ skill: name, text }),
    logText: () => w.logs.join("\n"),
  };

  on("store.get", async (_$: any, e: any) => ({ value: w.store.get(e.key) ?? null }));
  on("store.set", async (_$: any, e: any) => {
    w.store.set(e.key, e.value);
    return { value: undefined };
  });
  on("store.delete", async (_$: any, e: any) => {
    w.store.delete(e.key);
    return { value: undefined };
  });
  on("store.keys", async () => ({ value: [...w.store.keys()] }));
  on("model.fork", async (_$: any, e: any) => ({ value: w.fork(e.prompt) }));

  on("process.run", async (_$: any, e: any) => {
    const key = e.argv.join(" ");
    w.ran.push(key);
    const hit = w.git[key];
    return {
      value: hit
        ? { exitCode: hit.exitCode ?? 0, stdout: hit.stdout ?? "", stderr: "" }
        : { exitCode: 1, stdout: "", stderr: "not in the test's table" },
    };
  });
  // The engine hands fs events an absolute path, resolved before any hook
  // sees it, so a table keyed by repo-relative name matches by suffix.
  const find = (path: string) =>
    Object.keys(w.files).find((k) => path === k || path.endsWith(`/${k}`));
  on("fs.exists", async (_$: any, e: any) => ({ value: find(e.path) !== undefined }));
  on("fs.read", async (_$: any, e: any) => {
    const k = find(e.path);
    if (k === undefined) throw new Error(`ENOENT ${e.path}`);
    return { value: w.files[k] };
  });
  on("session.cwd", async () => ({ value: ROOT }));
  on("session.model", async () => ({ value: "claude-opus-5" }));
  on("ui.log", async (_$: any, e: any) => {
    w.logs.push(String(e.text ?? e.message ?? JSON.stringify(e)));
    return { value: undefined };
  });

  on("session.start", async (_$: any, e: any) => ({ cwd: e.cwd }));
  on("prompt.submit", async (_$: any, e: any) => ({
    text: e.text,
    ...(e.context ? { context: e.context } : {}),
  }));
  on("prompt.section", async (_$: any, e: any) => ({ text: e.text }));
  on("prompt.context", async (_$: any, e: any) => ({ blocks: e.blocks }));
  on("turn.complete", async (_$: any, e: any) => ({ text: e.answer }));
  on("skill.prompt", async (_$: any, e: any) => ({ text: e.text }));
  on("attribution.text", async (_$: any, e: any) => ({ text: e.text }));
  on("tool.describe", async (_$: any, e: any) => ({ description: e.description }));
  on("agent.spawn", async (_$: any, e: any) => ({
    model: e.model ?? "claude-opus-5",
    agentId: "agent-1",
  }));

  // The tools themselves. A failing command is an error result, as core
  // reports a non-zero exit. (A hook that throws is skipped, not failed.)
  on("tool.call", { tool: "Bash" }, async (_$: any, e: any) => {
    const o = w.bash(e.command);
    if ("fail" in o) return { isError: true, result: o.fail || "Exit code 1" };
    if ("background" in o)
      return { result: { stdout: "", stderr: "", interrupted: false, backgroundTaskId: "bg1" } };
    if ("interrupted" in o)
      return { result: { stdout: o.interrupted, stderr: "", interrupted: true } };
    if ("timedOut" in o)
      return {
        result: { stdout: "", stderr: "", interrupted: false, backgroundTaskId: "bg2", timedOutAfterMs: 120000 },
      };
    return { result: { stdout: o.ok, stderr: "", interrupted: false } };
  });
  on("tool.call", { tool: "Agent" }, async () => ({
    result: { status: "completed", agentId: "agent-1", content: [], totalDurationMs: 1 },
  }));
  for (const tool of ["Write", "Edit", "NotebookEdit", "Read"]) {
    on("tool.call", { tool }, async () => ({ result: { ok: true } }));
  }

  return w;
}
