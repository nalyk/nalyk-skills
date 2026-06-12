# OpenClaw Core Concepts Reference

Architecture, agent runtime, sessions, memory, multi-agent, streaming, context.

---
## Concepts > Agent Loop

[Source: https://docs.openclaw.ai/concepts/agent-loop]

Agent Loop (OpenClaw)
An agentic loop is the full “real” run of an agent: intake → context assembly → model inference →
tool execution → streaming replies → persistence. It’s the authoritative path that turns a message
into actions and a final reply, while keeping session state consistent.
In OpenClaw, a loop is a single, serialized run per session that emits lifecycle and stream events
as the model thinks, calls tools, and streams output. This doc explains how that authentic loop is
wired end-to-end.
Entry points
Gateway RPC:
agent
and
agent.wait
CLI:
agent
command.
How it works (high-level)
agent
RPC validates params, resolves session (sessionKey/sessionId), persists session metadata, returns
{ runId, acceptedAt }
immediately.
agentCommand
runs the agent:
resolves model + thinking/verbose defaults
loads skills snapshot
calls
runEmbeddedPiAgent
(pi-agent-core runtime)
emits
lifecycle end/error
if the embedded loop does not emit one
runEmbeddedPiAgent
serializes runs via per-session + global queues
resolves model + auth profile and builds the pi session
subscribes to pi events and streams assistant/tool deltas
enforces timeout -> aborts run if exceeded
returns payloads + usage metadata
subscribeEmbeddedPiSession
bridges pi-agent-core events to OpenClaw
agent
stream:
tool events =>
stream: "tool"
assistant deltas =>
stream: "assistant"
lifecycle events =>
stream: "lifecycle"
phase: "start" | "end" | "error"
agent.wait
uses
waitForAgentJob
waits for
lifecycle end/error
for
runId
returns
{ status: ok|error|timeout, startedAt, endedAt, error? }
Queueing + concurrency
Runs are serialized per session key (session lane) and optionally through a global lane.
This prevents tool/session races and keeps session history consistent.
Messaging channels can choose queue modes (collect/steer/followup) that feed this lane system.
See
Command Queue
Session + workspace preparation
Workspace is resolved and created; sandboxed runs may redirect to a sandbox workspace root.
Skills are loaded (or reused from a snapshot) and injected into env and prompt.
Bootstrap/context files are resolved and injected into the system prompt report.
A session write lock is acquired;
SessionManager
is opened and prepared before streaming.
Prompt assembly + system prompt
System prompt is built from OpenClaw’s base prompt, skills prompt, bootstrap context, and per-run overrides.
Model-specific limits and compaction reserve tokens are enforced.
See
System prompt
for what the model sees.
Hook points (where you can intercept)
OpenClaw has two hook systems:
Internal hooks
(Gateway hooks): event-driven scripts for commands and lifecycle events.
Plugin hooks
: extension points inside the agent/tool lifecycle and gateway pipeline.
Internal hooks (Gateway hooks)
agent:bootstrap
: runs while building bootstrap files before the system prompt is finalized.
Use this to add/remove bootstrap context files.
Command hooks
/new
/reset
/stop
, and other command events (see Hooks doc).
See
Hooks
for setup and examples.
Plugin hooks (agent + gateway lifecycle)
These run inside the agent loop or gateway pipeline:
before_agent_start
: inject context or override system prompt before the run starts.
agent_end
: inspect the final message list and run metadata after completion.
before_compaction
after_compaction
: observe or annotate compaction cycles.
before_tool_call
after_tool_call
: intercept tool params/results.
tool_result_persist
: synchronously transform tool results before they are written to the session transcript.
message_received
message_sending
message_sent
: inbound + outbound message hooks.
session_start
session_end
: session lifecycle boundaries.
gateway_start
gateway_stop
: gateway lifecycle events.
See
Plugins
for the hook API and registration details.
Streaming + partial replies
Assistant deltas are streamed from pi-agent-core and emitted as
assistant
events.
Block streaming can emit partial replies either on
text_end
message_end
Reasoning streaming can be emitted as a separate stream or as block replies.
See
Streaming
for chunking and block reply behavior.
Tool execution + messaging tools
Tool start/update/end events are emitted on the
tool
stream.
Tool results are sanitized for size and image payloads before logging/emitting.
Messaging tool sends are tracked to suppress duplicate assistant confirmations.
Reply shaping + suppression
Final payloads are assembled from:
assistant text (and optional reasoning)
inline tool summaries (when verbose + allowed)
assistant error text when the model errors
NO_REPLY
is treated as a silent token and filtered from outgoing payloads.
Messaging tool duplicates are removed from the final payload list.
If no renderable payloads remain and a tool errored, a fallback tool error reply is emitted
(unless a messaging tool already sent a user-visible reply).
Compaction + retries
Auto-compaction emits
compaction
stream events and can trigger a retry.
On retry, in-memory buffers and tool summaries are reset to avoid duplicate output.
See
Compaction
for the compaction pipeline.
Event streams (today)
lifecycle
: emitted by
subscribeEmbeddedPiSession
(and as a fallback by
agentCommand
assistant
: streamed deltas from pi-agent-core
tool
: streamed tool events from pi-agent-core
Chat channel handling
Assistant deltas are buffered into chat
delta
messages.
A chat
final
is emitted on
lifecycle end/error
Timeouts
agent.wait
default: 30s (just the wait).
timeoutMs
param overrides.
Agent runtime:
agents.defaults.timeoutSeconds
default 600s; enforced in
runEmbeddedPiAgent
abort timer.
Where things can end early
Agent timeout (abort)
AbortSignal (cancel)
Gateway disconnect or RPC timeout
agent.wait
timeout (wait-only, does not stop agent)
Agent Runtime
System Prompt

---
## Concepts > Agent Workspace

[Source: https://docs.openclaw.ai/concepts/agent-workspace]

The workspace is the agent’s home. It is the only working directory used for
file tools and for workspace context. Keep it private and treat it as memory.
This is separate from
~/.openclaw/
, which stores config, credentials, and
sessions.
Important:
the workspace is the
default cwd
, not a hard sandbox. Tools
resolve relative paths against the workspace, but absolute paths can still reach
elsewhere on the host unless sandboxing is enabled. If you need isolation, use
agents.defaults.sandbox
(and/or per‑agent sandbox config).
When sandboxing is enabled and
workspaceAccess
is not
"rw"
, tools operate
inside a sandbox workspace under
~/.openclaw/sandboxes
, not your host workspace.
Default location
Default:
~/.openclaw/workspace
OPENCLAW_PROFILE
is set and not
"default"
, the default becomes
~/.openclaw/workspace-<profile>
Override in
~/.openclaw/openclaw.json
agent
workspace
"~/.openclaw/workspace"
openclaw onboard
openclaw configure
, or
openclaw setup
will create the
workspace and seed the bootstrap files if they are missing.
If you already manage the workspace files yourself, you can disable bootstrap
file creation:
agent
skipBootstrap
true
} }
Extra workspace folders
Older installs may have created
~/openclaw
. Keeping multiple workspace
directories around can cause confusing auth or state drift, because only one
workspace is active at a time.
Recommendation:
keep a single active workspace. If you no longer use the
extra folders, archive or move them to Trash (for example
trash ~/openclaw
If you intentionally keep multiple workspaces, make sure
agents.defaults.workspace
points to the active one.
openclaw doctor
warns when it detects extra workspace directories.
Workspace file map (what each file means)
These are the standard files OpenClaw expects inside the workspace:
AGENTS.md
Operating instructions for the agent and how it should use memory.
Loaded at the start of every session.
Good place for rules, priorities, and “how to behave” details.
SOUL.md
Persona, tone, and boundaries.
Loaded every session.
USER.md
Who the user is and how to address them.
Loaded every session.
IDENTITY.md
The agent’s name, vibe, and emoji.
Created/updated during the bootstrap ritual.
TOOLS.md
Notes about your local tools and conventions.
Does not control tool availability; it is only guidance.
HEARTBEAT.md
Optional tiny checklist for heartbeat runs.
Keep it short to avoid token burn.
BOOT.md
Optional startup checklist executed on gateway restart when internal hooks are enabled.
Keep it short; use the message tool for outbound sends.
BOOTSTRAP.md
One-time first-run ritual.
Only created for a brand-new workspace.
Delete it after the ritual is complete.
memory/YYYY-MM-DD.md
Daily memory log (one file per day).
Recommended to read today + yesterday on session start.
MEMORY.md
(optional)
Curated long-term memory.
Only load in the main, private session (not shared/group contexts).
See
Memory
for the workflow and automatic memory flush.
skills/
(optional)
Workspace-specific skills.
Overrides managed/bundled skills when names collide.
canvas/
(optional)
Canvas UI files for node displays (for example
canvas/index.html
If any bootstrap file is missing, OpenClaw injects a “missing file” marker into
the session and continues. Large bootstrap files are truncated when injected;
adjust the limit with
agents.defaults.bootstrapMaxChars
(default: 20000).
openclaw setup
can recreate missing defaults without overwriting existing
files.
What is NOT in the workspace
These live under
~/.openclaw/
and should NOT be committed to the workspace repo:
~/.openclaw/openclaw.json
(config)
~/.openclaw/credentials/
(OAuth tokens, API keys)
~/.openclaw/agents/<agentId>/sessions/
(session transcripts + metadata)
~/.openclaw/skills/
(managed skills)
If you need to migrate sessions or config, copy them separately and keep them
out of version control.
Git backup (recommended, private)
Treat the workspace as private memory. Put it in a
private
git repo so it is
backed up and recoverable.
Run these steps on the machine where the Gateway runs (that is where the
workspace lives).
1) Initialize the repo
If git is installed, brand-new workspaces are initialized automatically. If this
workspace is not already a repo, run:
~/.openclaw/workspace
git
init
git
add
AGENTS.md
SOUL.md
TOOLS.md
IDENTITY.md
USER.md
HEARTBEAT.md
memory/
git
commit
"Add agent workspace"
2) Add a private remote (beginner-friendly options)
Option A: GitHub web UI
Create a new
private
repository on GitHub.
Do not initialize with a README (avoids merge conflicts).
Copy the HTTPS remote URL.
Add the remote and push:
git
branch
main
git
remote
add
origin
<
https-ur
>
git
push
origin
main
Option B: GitHub CLI (
auth
login
repo
create
openclaw-workspace
--private
--source
--remote
origin
--push
Option C: GitLab web UI
Create a new
private
repository on GitLab.
Do not initialize with a README (avoids merge conflicts).
Copy the HTTPS remote URL.
Add the remote and push:
git
branch
main
git
remote
add
origin
<
https-ur
>
git
push
origin
main
3) Ongoing updates
git
status
git
add
git
commit
"Update memory"
git
push
Do not commit secrets
Even in a private repo, avoid storing secrets in the workspace:
API keys, OAuth tokens, passwords, or private credentials.
Anything under
~/.openclaw/
Raw dumps of chats or sensitive attachments.
If you must store sensitive references, use placeholders and keep the real
secret elsewhere (password manager, environment variables, or
~/.openclaw/
Suggested
.gitignore
starter:
.DS_Store
.env
**/*.key
**/*.pem
**/secrets*
Moving the workspace to a new machine
Clone the repo to the desired path (default
~/.openclaw/workspace
Set
agents.defaults.workspace
to that path in
~/.openclaw/openclaw.json
Run
openclaw setup --workspace <path>
to seed any missing files.
If you need sessions, copy
~/.openclaw/agents/<agentId>/sessions/
from the
old machine separately.
Advanced notes
Multi-agent routing can use different workspaces per agent. See
Channel routing
for routing configuration.
agents.defaults.sandbox
is enabled, non-main sessions can use per-session sandbox
workspaces under
agents.defaults.sandbox.workspaceRoot
Context
OAuth

---
## Concepts > Agent

[Source: https://docs.openclaw.ai/concepts/agent]

) for tools and context.
Recommended: use
openclaw setup
to create
~/.openclaw/openclaw.json
if missing and initialize the workspace files.
Full workspace layout + backup guide:
Agent workspace
agents.defaults.sandbox
is enabled, non-main sessions can override this with
per-session workspaces under
agents.defaults.sandbox.workspaceRoot
(see
Gateway configuration
Bootstrap files (injected)
Inside
agents.defaults.workspace
, OpenClaw expects these user-editable files:
AGENTS.md
— operating instructions + “memory”
SOUL.md
— persona, boundaries, tone
TOOLS.md
— user-maintained tool notes (e.g.
imsg
sag
, conventions)
BOOTSTRAP.md
— one-time first-run ritual (deleted after completion)
IDENTITY.md
— agent name/vibe/emoji
USER.md
— user profile + preferred address
On the first turn of a new session, OpenClaw injects the contents of these files directly into the agent context.
Blank files are skipped. Large files are trimmed and truncated with a marker so prompts stay lean (read the file for full content).
If a file is missing, OpenClaw injects a single “missing file” marker line (and
openclaw setup
will create a safe default template).
BOOTSTRAP.md
is only created for a
brand new workspace
(no other bootstrap files present). If you delete it after completing the ritual, it should not be recreated on later restarts.
To disable bootstrap file creation entirely (for pre-seeded workspaces), set:
agent
skipBootstrap
true
} }
Built-in tools
Core tools (read/exec/edit/write and related system tools) are always available,
subject to tool policy.
apply_patch
is optional and gated by
tools.exec.applyPatch
TOOLS.md
does
not
control which tools exist; it’s
guidance for how
you
want them used.
Skills
OpenClaw loads skills from three locations (workspace wins on name conflict):
Bundled (shipped with the install)
Managed/local:
~/.openclaw/skills
Workspace:
<workspace>/skills
Skills can be gated by config/env (see
skills
Gateway configuration
pi-mono integration
OpenClaw reuses pieces of the pi-mono codebase (models/tools), but
session management, discovery, and tool wiring are OpenClaw-owned
No pi-coding agent runtime.
~/.pi/agent
<workspace>/.pi
settings are consulted.
Sessions
Session transcripts are stored as JSONL at:
~/.openclaw/agents/<agentId>/sessions/<SessionId>.jsonl
The session ID is stable and chosen by OpenClaw.
Legacy Pi/Tau session folders are
not
read.
Steering while streaming
When queue mode is
steer
, inbound messages are injected into the current run.
The queue is checked
after each tool call
; if a queued message is present,
remaining tool calls from the current assistant message are skipped (error tool
results with “Skipped due to queued user message.”), then the queued user
message is injected before the next assistant response.
When queue mode is
followup
collect
, inbound messages are held until the
current turn ends, then a new agent turn starts with the queued payloads. See
Queue
for mode + debounce/cap behavior.
Block streaming sends completed assistant blocks as soon as they finish; it is
off by default
agents.defaults.blockStreamingDefault: "off"
Tune the boundary via
agents.defaults.blockStreamingBreak
text_end
message_end
; defaults to text_end).
Control soft block chunking with
agents.defaults.blockStreamingChunk
(defaults to
800–1200 chars; prefers paragraph breaks, then newlines; sentences last).
Coalesce streamed chunks with
agents.defaults.blockStreamingCoalesce
to reduce
single-line spam (idle-based merging before send). Non-Telegram channels require
explicit
*.blockStreaming: true
to enable block replies.
Verbose tool summaries are emitted at tool start (no debounce); Control UI
streams tool output via agent events when available.
More details:
Streaming + chunking
Model refs
Model refs in config (for example
agents.defaults.model
and
agents.defaults.models
) are parsed by splitting on the
first
Use
provider/model
when configuring models.
If the model ID itself contains
(OpenRouter-style), include the provider prefix (example:
openrouter/moonshotai/kimi-k2
If you omit the provider, OpenClaw treats the input as an alias or a model for the
default provider
(only works when there is no
in the model ID).
Configuration (minimal)
At minimum, set:
agents.defaults.workspace
channels.whatsapp.allowFrom
(strongly recommended)
Next:
Group Chats
Gateway Architecture
Agent Loop

---
## Concepts > Architecture

[Source: https://docs.openclaw.ai/concepts/architecture]

Baileys, Telegram via grammY, Slack, Discord, Signal, iMessage, WebChat).
Control-plane clients (macOS app, CLI, web UI, automations) connect to the
Gateway over
WebSocket
on the configured bind host (default
127.0.0.1:18789
Nodes
(macOS/iOS/Android/headless) also connect over
WebSocket
, but
declare
role: node
with explicit caps/commands.
One Gateway per host; it is the only place that opens a WhatsApp session.
The
canvas host
is served by the Gateway HTTP server under:
/__openclaw__/canvas/
(agent-editable HTML/CSS/JS)
/__openclaw__/a2ui/
(A2UI host)
It uses the same port as the Gateway (default
18789
Components and flows
Gateway (daemon)
Maintains provider connections.
Exposes a typed WS API (requests, responses, server‑push events).
Validates inbound frames against JSON Schema.
Emits events like
agent
chat
presence
health
heartbeat
cron
Clients (mac app / CLI / web admin)
One WS connection per client.
Send requests (
health
status
send
agent
system-presence
Subscribe to events (
tick
agent
presence
shutdown
Nodes (macOS / iOS / Android / headless)
Connect to the
same WS server
with
role: node
Provide a device identity in
connect
; pairing is
device‑based
(role
node
) and
approval lives in the device pairing store.
Expose commands like
canvas.*
camera.*
screen.record
location.get
Protocol details:
Gateway protocol
WebChat
Static UI that uses the Gateway WS API for chat history and sends.
In remote setups, connects through the same SSH/Tailscale tunnel as other
clients.
Connection lifecycle (single client)
Wire protocol (summary)
Transport: WebSocket, text frames with JSON payloads.
First frame
must
connect
After handshake:
Requests:
{type:"req", id, method, params}
{type:"res", id, ok, payload|error}
Events:
{type:"event", event, payload, seq?, stateVersion?}
OPENCLAW_GATEWAY_TOKEN
(or
--token
) is set,
connect.params.auth.token
must match or the socket closes.
Idempotency keys are required for side‑effecting methods (
send
agent
) to
safely retry; the server keeps a short‑lived dedupe cache.
Nodes must include
role: "node"
plus caps/commands/permissions in
connect
Pairing + local trust
All WS clients (operators + nodes) include a
device identity
connect
New device IDs require pairing approval; the Gateway issues a
device token
for subsequent connects.
Local
connects (loopback or the gateway host’s own tailnet address) can be
auto‑approved to keep same‑host UX smooth.
Non‑local
connects must sign the
connect.challenge
nonce and require
explicit approval.
Gateway auth (
gateway.auth.*
) still applies to
all
connections, local or
remote.
Details:
Gateway protocol
Pairing
Security
Protocol typing and codegen
TypeBox schemas define the protocol.
JSON Schema is generated from those schemas.
Swift models are generated from the JSON Schema.
Remote access
Preferred: Tailscale or VPN.
Alternative: SSH tunnel
ssh
18789:127.0.0.1:18789
user@host
The same handshake + auth token apply over the tunnel.
TLS + optional pinning can be enabled for WS in remote setups.
Operations snapshot
Start:
openclaw gateway
(foreground, logs to stdout).
Health:
health
over WS (also included in
hello-ok
Supervision: launchd/systemd for auto‑restart.
Invariants
Exactly one Gateway controls a single Baileys session per host.
Handshake is mandatory; any non‑JSON or non‑connect first frame is a hard close.
Events are not replayed; clients must refresh on gaps.
Agent Runtime

---
## Concepts > Compaction

[Source: https://docs.openclaw.ai/concepts/compaction]

(max tokens it can see). Long-running chats accumulate messages and tool results; once the window is tight, OpenClaw
compacts
older history to stay within limits.
What compaction is
Compaction
summarizes older conversation
into a compact summary entry and keeps recent messages intact. The summary is stored in the session history, so future requests use:
The compaction summary
Recent messages after the compaction point
Compaction
persists
in the session’s JSONL history.
Configuration
Use the
agents.defaults.compaction
setting in your
openclaw.json
to configure compaction behavior (mode, target tokens, etc.).
Auto-compaction (default on)
When a session nears or exceeds the model’s context window, OpenClaw triggers auto-compaction and may retry the original request using the compacted context.
You’ll see:
🧹 Auto-compaction complete
in verbose mode
/status
showing
🧹 Compactions: <count>
Before compaction, OpenClaw can run a
silent memory flush
turn to store
durable notes to disk. See
Memory
for details and config.
Manual compaction
Use
/compact
(optionally with instructions) to force a compaction pass:
/compact Focus on decisions and open questions
Context window source
Context window is model-specific. OpenClaw uses the model definition from the configured provider catalog to determine limits.
Compaction vs pruning
Compaction
: summarises and
persists
in JSONL.
Session pruning
: trims old
tool results
only,
in-memory
, per request.
See
/concepts/session-pruning
for pruning details.
Tips
Use
/compact
when sessions feel stale or context is bloated.
Large tool outputs are already truncated; pruning can further reduce tool-result buildup.
If you need a fresh slate,
/new
/reset
starts a new session id.
Memory
Multi-Agent Routing

---
## Concepts > Context

[Source: https://docs.openclaw.ai/concepts/context]

“Context” is
everything OpenClaw sends to the model for a run
. It is bounded by the model’s
context window
(token limit).
Beginner mental model:
System prompt
(OpenClaw-built): rules, tools, skills list, time/runtime, and injected workspace files.
Conversation history
: your messages + the assistant’s messages for this session.
Tool calls/results + attachments
: command output, file reads, images/audio, etc.
Context is
not the same thing
as “memory”: memory can be stored on disk and reloaded later; context is what’s inside the model’s current window.
Quick start (inspect context)
/status
→ quick “how full is my window?” view + session settings.
/context list
→ what’s injected + rough sizes (per file + totals).
/context detail
→ deeper breakdown: per-file, per-tool schema sizes, per-skill entry sizes, and system prompt size.
/usage tokens
→ append per-reply usage footer to normal replies.
/compact
→ summarize older history into a compact entry to free window space.
See also:
Slash commands
Token use & costs
Compaction
Example output
Values vary by model, provider, tool policy, and what’s in your workspace.
/context list
🧠 Context breakdown
Workspace: <workspaceDir>
Bootstrap max/file: 20,000 chars
Sandbox: mode=non-main sandboxed=false
System prompt (run): 38,412 chars (~9,603 tok) (Project Context 23,901 chars (~5,976 tok))
Injected workspace files:
- AGENTS.md: OK | raw 1,742 chars (~436 tok) | injected 1,742 chars (~436 tok)
- SOUL.md: OK | raw 912 chars (~228 tok) | injected 912 chars (~228 tok)
- TOOLS.md: TRUNCATED | raw 54,210 chars (~13,553 tok) | injected 20,962 chars (~5,241 tok)
- IDENTITY.md: OK | raw 211 chars (~53 tok) | injected 211 chars (~53 tok)
- USER.md: OK | raw 388 chars (~97 tok) | injected 388 chars (~97 tok)
- HEARTBEAT.md: MISSING | raw 0 | injected 0
- BOOTSTRAP.md: OK | raw 0 chars (~0 tok) | injected 0 chars (~0 tok)
Skills list (system prompt text): 2,184 chars (~546 tok) (12 skills)
Tools: read, edit, write, exec, process, browser, message, sessions_send, …
Tool list (system prompt text): 1,032 chars (~258 tok)
Tool schemas (JSON): 31,988 chars (~7,997 tok) (counts toward context; not shown as text)
Tools: (same as above)
Session tokens (cached): 14,250 total / ctx=32,000
/context detail
🧠 Context breakdown (detailed)
Top skills (prompt entry size):
- frontend-design: 412 chars (~103 tok)
- oracle: 401 chars (~101 tok)
… (+10 more skills)
Top tools (schema size):
- browser: 9,812 chars (~2,453 tok)
- exec: 6,240 chars (~1,560 tok)
… (+N more tools)
What counts toward the context window
Everything the model receives counts, including:
System prompt (all sections).
Conversation history.
Tool calls + tool results.
Attachments/transcripts (images/audio/files).
Compaction summaries and pruning artifacts.
Provider “wrappers” or hidden headers (not visible, still counted).
How OpenClaw builds the system prompt
The system prompt is
OpenClaw-owned
and rebuilt each run. It includes:
Tool list + short descriptions.
Skills list (metadata only; see below).
Workspace location.
Time (UTC + converted user time if configured).
Runtime metadata (host/OS/model/thinking).
Injected workspace bootstrap files under
Project Context
Full breakdown:
System Prompt
Injected workspace files (Project Context)
By default, OpenClaw injects a fixed set of workspace files (if present):
AGENTS.md
SOUL.md
TOOLS.md
IDENTITY.md
USER.md
HEARTBEAT.md
BOOTSTRAP.md
(first-run only)
Large files are truncated per-file using
agents.defaults.bootstrapMaxChars
(default
20000
chars). OpenClaw also enforces a total bootstrap injection cap across files with
agents.defaults.bootstrapTotalMaxChars
(default
24000
chars).
/context
shows
raw vs injected
sizes and whether truncation happened.
Skills: what’s injected vs loaded on-demand
The system prompt includes a compact
skills list
(name + description + location). This list has real overhead.
Skill instructions are
not
included by default. The model is expected to
read
the skill’s
SKILL.md
only when needed
Tools: there are two costs
Tools affect context in two ways:
Tool list text
in the system prompt (what you see as “Tooling”).
Tool schemas
(JSON). These are sent to the model so it can call tools. They count toward context even though you don’t see them as plain text.
/context detail
breaks down the biggest tool schemas so you can see what dominates.
Commands, directives, and “inline shortcuts”
Slash commands are handled by the Gateway. There are a few different behaviors:
Standalone commands
: a message that is only
/...
runs as a command.
Directives
/think
/verbose
/reasoning
/elevated
/model
/queue
are stripped before the model sees the message.
Directive-only messages persist session settings.
Inline directives in a normal message act as per-message hints.
Inline shortcuts
(allowlisted senders only): certain
/...
tokens inside a normal message can run immediately (example: “hey /status”), and are stripped before the model sees the remaining text.
Details:
Slash commands
Sessions, compaction, and pruning (what persists)
What persists across messages depends on the mechanism:
Normal history
persists in the session transcript until compacted/pruned by policy.
Compaction
persists a summary into the transcript and keeps recent messages intact.
Pruning
removes old tool results from the
in-memory
prompt for a run, but does not rewrite the transcript.
Docs:
Session
Compaction
Session pruning
What
/context
actually reports
/context
prefers the latest
run-built
system prompt report when available:
System prompt (run)
= captured from the last embedded (tool-capable) run and persisted in the session store.
System prompt (estimate)
= computed on the fly when no run report exists (or when running via a CLI backend that doesn’t generate the report).
Either way, it reports sizes and top contributors; it does
not
dump the full system prompt or tool schemas.
System Prompt
Agent Workspace

---
## Concepts > Features

[Source: https://docs.openclaw.ai/concepts/features]

WhatsApp, Telegram, Discord, and iMessage with a single Gateway.
Plugins
Add Mattermost and more with extensions.
Routing
Multi-agent routing with isolated sessions.
Media
Images, audio, and documents in and out.
Apps and UI
Web Control UI and macOS companion app.
Mobile nodes
iOS and Android nodes with Canvas support.
Full list
WhatsApp integration via WhatsApp Web (Baileys)
Telegram bot support (grammY)
Discord bot support (channels.discord.js)
Mattermost bot support (plugin)
iMessage integration via local imsg CLI (macOS)
Agent bridge for Pi in RPC mode with tool streaming
Streaming and chunking for long responses
Multi-agent routing for isolated sessions per workspace or sender
Subscription auth for Anthropic and OpenAI via OAuth
Sessions: direct chats collapse into shared
main
; groups are isolated
Group chat support with mention based activation
Media support for images, audio, and documents
Optional voice note transcription hook
WebChat and macOS menu bar app
iOS node with pairing and Canvas surface
Android node with pairing, Canvas, chat, and camera
Legacy Claude, Codex, Gemini, and Opencode paths have been removed. Pi is the only
coding agent path.
Showcase
Getting Started

---
## Concepts > Markdown Formatting

[Source: https://docs.openclaw.ai/concepts/markdown-formatting]

Markdown formatting
OpenClaw formats outbound Markdown by converting it into a shared intermediate
representation (IR) before rendering channel-specific output. The IR keeps the
source text intact while carrying style/link spans so chunking and rendering can
stay consistent across channels.
Goals
Consistency:
one parse step, multiple renderers.
Safe chunking:
split text before rendering so inline formatting never
breaks across chunks.
Channel fit:
map the same IR to Slack mrkdwn, Telegram HTML, and Signal
style ranges without re-parsing Markdown.
Pipeline
Parse Markdown -> IR
IR is plain text plus style spans (bold/italic/strike/code/spoiler) and link spans.
Offsets are UTF-16 code units so Signal style ranges align with its API.
Tables are parsed only when a channel opts into table conversion.
Chunk IR (format-first)
Chunking happens on the IR text before rendering.
Inline formatting does not split across chunks; spans are sliced per chunk.
Render per channel
Slack:
mrkdwn tokens (bold/italic/strike/code), links as
<url|label>
Telegram:
HTML tags (
<b>
<i>
<s>
<code>
<pre><code>
<a href>
Signal:
plain text +
text-style
ranges; links become
label (url)
when label differs.
IR example
Input Markdown:
Hello
**world**
— see
docs
(https://docs.openclaw.ai)
IR (schematic):
"text"
"Hello world — see docs."
"styles"
"start"
"end"
"style"
"bold"
"links"
"start"
"end"
"href"
"https://docs.openclaw.ai"
Where it is used
Slack, Telegram, and Signal outbound adapters render from the IR.
Other channels (WhatsApp, iMessage, MS Teams, Discord) still use plain text or
their own formatting rules, with Markdown table conversion applied before
chunking when enabled.
Table handling
Markdown tables are not consistently supported across chat clients. Use
markdown.tables
to control conversion per channel (and per account).
code
: render tables as code blocks (default for most channels).
bullets
: convert each row into bullet points (default for Signal + WhatsApp).
off
: disable table parsing and conversion; raw table text passes through.
Config keys:
channels
discord
markdown
tables
code
accounts
work
markdown
tables
off
Chunking rules
Chunk limits come from channel adapters/config and are applied to the IR text.
Code fences are preserved as a single block with a trailing newline so channels
render them correctly.
List prefixes and blockquote prefixes are part of the IR text, so chunking
does not split mid-prefix.
Inline styles (bold/italic/strike/inline-code/spoiler) are never split across
chunks; the renderer reopens styles inside each chunk.
If you need more on chunking behavior across channels, see
Streaming + chunking
Link policy
Slack:
[label](url)
->
<url|label>
; bare URLs remain bare. Autolink
is disabled during parse to avoid double-linking.
Telegram:
[label](url)
->
<a href="url">label</a>
(HTML parse mode).
Signal:
[label](url)
->
label (url)
unless label matches the URL.
Spoilers
Spoiler markers (
||spoiler||
) are parsed only for Signal, where they map to
SPOILER style ranges. Other channels treat them as plain text.
How to add or update a channel formatter
Parse once:
use the shared
markdownToIR(...)
helper with channel-appropriate
options (autolink, heading style, blockquote prefix).
Render:
implement a renderer with
renderMarkdownWithMarkers(...)
and a
style marker map (or Signal style ranges).
Chunk:
call
chunkMarkdownIR(...)
before rendering; render each chunk.
Wire adapter:
update the channel outbound adapter to use the new chunker
and renderer.
Test:
add or update format tests and an outbound delivery test if the
channel uses chunking.
Common gotchas
Slack angle-bracket tokens (
<@U123>
<#C123>
<https://...>
) must be
preserved; escape raw HTML safely.
Telegram HTML requires escaping text outside tags to avoid broken markup.
Signal style ranges depend on UTF-16 offsets; do not use code point offsets.
Preserve trailing newlines for fenced code blocks so closing markers land on
their own line.
TypeBox
Typing Indicators

---
## Concepts > Memory

[Source: https://docs.openclaw.ai/concepts/memory]

OpenClaw memory is
plain Markdown in the agent workspace
. The files are the
source of truth; the model only “remembers” what gets written to disk.
Memory search tools are provided by the active memory plugin (default:
memory-core
). Disable memory plugins with
plugins.slots.memory = "none"
Memory files (Markdown)
The default workspace layout uses two memory layers:
memory/YYYY-MM-DD.md
Daily log (append-only).
Read today + yesterday at session start.
MEMORY.md
(optional)
Curated long-term memory.
Only load in the main, private session
(never in group contexts).
These files live under the workspace (
agents.defaults.workspace
, default
~/.openclaw/workspace
). See
Agent workspace
for the full layout.
When to write memory
Decisions, preferences, and durable facts go to
MEMORY.md
Day-to-day notes and running context go to
memory/YYYY-MM-DD.md
If someone says “remember this,” write it down (do not keep it in RAM).
This area is still evolving. It helps to remind the model to store memories; it will know what to do.
If you want something to stick,
ask the bot to write it
into memory.
Automatic memory flush (pre-compaction ping)
When a session is
close to auto-compaction
, OpenClaw triggers a
silent,
agentic turn
that reminds the model to write durable memory
before
the
context is compacted. The default prompts explicitly say the model
may reply
but usually
NO_REPLY
is the correct response so the user never sees this turn.
This is controlled by
agents.defaults.compaction.memoryFlush
agents
defaults
compaction
reserveTokensFloor
20000
memoryFlush
enabled
true
softThresholdTokens
4000
systemPrompt
"Session nearing compaction. Store durable memories now."
prompt
"Write any lasting notes to memory/YYYY-MM-DD.md; reply with NO_REPLY if nothing to store."
Details:
Soft threshold
: flush triggers when the session token estimate crosses
contextWindow - reserveTokensFloor - softThresholdTokens
Silent
by default: prompts include
NO_REPLY
so nothing is delivered.
Two prompts
: a user prompt plus a system prompt append the reminder.
One flush per compaction cycle
(tracked in
sessions.json
Workspace must be writable
: if the session runs sandboxed with
workspaceAccess: "ro"
"none"
, the flush is skipped.
For the full compaction lifecycle, see
Session management + compaction
Vector memory search
OpenClaw can build a small vector index over
MEMORY.md
and
memory/*.md
semantic queries can find related notes even when wording differs.
Defaults:
Enabled by default.
Watches memory files for changes (debounced).
Configure memory search under
agents.defaults.memorySearch
(not top-level
memorySearch
Uses remote embeddings by default. If
memorySearch.provider
is not set, OpenClaw auto-selects:
local
if a
memorySearch.local.modelPath
is configured and the file exists.
openai
if an OpenAI key can be resolved.
gemini
if a Gemini key can be resolved.
voyage
if a Voyage key can be resolved.
Otherwise memory search stays disabled until configured.
Local mode uses node-llama-cpp and may require
pnpm approve-builds
Uses sqlite-vec (when available) to accelerate vector search inside SQLite.
Remote embeddings
require
an API key for the embedding provider. OpenClaw
resolves keys from auth profiles,
models.providers.*.apiKey
, or environment
variables. Codex OAuth only covers chat/completions and does
not
satisfy
embeddings for memory search. For Gemini, use
GEMINI_API_KEY
models.providers.google.apiKey
. For Voyage, use
VOYAGE_API_KEY
models.providers.voyage.apiKey
. When using a custom OpenAI-compatible endpoint,
set
memorySearch.remote.apiKey
(and optional
memorySearch.remote.headers
QMD backend (experimental)
Set
memory.backend = "qmd"
to swap the built-in SQLite indexer for
QMD
: a local-first search sidecar that combines
BM25 + vectors + reranking. Markdown stays the source of truth; OpenClaw shells
out to QMD for retrieval. Key points:
Prereqs
Disabled by default. Opt in per-config (
memory.backend = "qmd"
Install the QMD CLI separately (
bun install -g https://github.com/tobi/qmd
or grab
a release) and make sure the
qmd
binary is on the gateway’s
PATH
QMD needs an SQLite build that allows extensions (
brew install sqlite
macOS).
QMD runs fully locally via Bun +
node-llama-cpp
and auto-downloads GGUF
models from HuggingFace on first use (no separate Ollama daemon required).
The gateway runs QMD in a self-contained XDG home under
~/.openclaw/agents/<agentId>/qmd/
by setting
XDG_CONFIG_HOME
and
XDG_CACHE_HOME
OS support: macOS and Linux work out of the box once Bun + SQLite are
installed. Windows is best supported via WSL2.
How the sidecar runs
The gateway writes a self-contained QMD home under
~/.openclaw/agents/<agentId>/qmd/
(config + cache + sqlite DB).
Collections are created via
qmd collection add
from
memory.qmd.paths
(plus default workspace memory files), then
qmd update
qmd embed
run
on boot and on a configurable interval (
memory.qmd.update.interval
default 5 m).
The gateway now initializes the QMD manager on startup, so periodic update
timers are armed even before the first
memory_search
call.
Boot refresh now runs in the background by default so chat startup is not
blocked; set
memory.qmd.update.waitForBootSync = true
to keep the previous
blocking behavior.
Searches run via
memory.qmd.searchMode
(default
qmd search --json
; also
supports
vsearch
and
query
). If the selected mode rejects flags on your
QMD build, OpenClaw retries with
qmd query
. If QMD fails or the binary is
missing, OpenClaw automatically falls back to the builtin SQLite manager so
memory tools keep working.
OpenClaw does not expose QMD embed batch-size tuning today; batch behavior is
controlled by QMD itself.
First search may be slow
: QMD may download local GGUF models (reranker/query
expansion) on the first
qmd query
run.
OpenClaw sets
XDG_CONFIG_HOME
XDG_CACHE_HOME
automatically when it runs QMD.
If you want to pre-download models manually (and warm the same index OpenClaw
uses), run a one-off query with the agent’s XDG dirs.
OpenClaw’s QMD state lives under your
state dir
(defaults to
~/.openclaw
You can point
qmd
at the exact same index by exporting the same XDG vars
OpenClaw uses:
# Pick the same state dir OpenClaw uses
STATE_DIR
"${OPENCLAW_STATE_DIR
$HOME
.openclaw}"
export
XDG_CONFIG_HOME
"$STATE_DIR/agents/main/qmd/xdg-config"
export
XDG_CACHE_HOME
"$STATE_DIR/agents/main/qmd/xdg-cache"
# (Optional) force an index refresh + embeddings
qmd
update
qmd
embed
# Warm up / trigger first-time model downloads
qmd
query
"test"
memory-root
--json
>
/dev/null
2>&1
Config surface (
memory.qmd.*
command
(default
qmd
): override the executable path.
searchMode
(default
search
): pick which QMD command backs
memory_search
search
vsearch
query
includeDefaultMemory
(default
true
): auto-index
MEMORY.md
memory/**/*.md
paths[]
: add extra directories/files (
path
, optional
pattern
, optional
stable
name
sessions
: opt into session JSONL indexing (
enabled
retentionDays
exportDir
update
: controls refresh cadence and maintenance execution:
interval
debounceMs
onBoot
waitForBootSync
embedInterval
commandTimeoutMs
updateTimeoutMs
embedTimeoutMs
limits
: clamp recall payload (
maxResults
maxSnippetChars
maxInjectedChars
timeoutMs
scope
: same schema as
session.sendPolicy
Default is DM-only (
deny
all,
allow
direct chats); loosen it to surface QMD
hits in groups/channels.
match.keyPrefix
matches the
normalized
session key (lowercased, with any
leading
agent:<id>:
stripped). Example:
discord:channel:
match.rawKeyPrefix
matches the
raw
session key (lowercased), including
agent:<id>:
. Example:
agent:main:discord:
Legacy:
match.keyPrefix: "agent:..."
is still treated as a raw-key prefix,
but prefer
rawKeyPrefix
for clarity.
When
scope
denies a search, OpenClaw logs a warning with the derived
channel
chatType
so empty results are easier to debug.
Snippets sourced outside the workspace show up as
qmd/<collection>/<relative-path>
memory_search
results;
memory_get
understands that prefix and reads from the configured QMD collection root.
When
memory.qmd.sessions.enabled = true
, OpenClaw exports sanitized session
transcripts (User/Assistant turns) into a dedicated QMD collection under
~/.openclaw/agents/<id>/qmd/sessions/
, so
memory_search
can recall recent
conversations without touching the builtin SQLite index.
memory_search
snippets now include a
Source: <path#line>
footer when
memory.citations
auto
; set
memory.citations = "off"
to keep
the path metadata internal (the agent still receives the path for
memory_get
, but the snippet text omits the footer and the system prompt
warns the agent not to cite it).
Example
memory: {
backend
"qmd"
citations
"auto"
qmd
includeDefaultMemory
true
update
interval
"5m"
debounceMs
15000 }
limits
maxResults
timeoutMs
4000 }
scope
default
"deny"
rules
action
"allow"
match
chatType
"direct"
} }
// Normalized session-key prefix (strips `agent:<id>:`).
action
"deny"
match
keyPrefix
"discord:channel:"
} }
// Raw session-key prefix (includes `agent:<id>:`).
action
"deny"
match
rawKeyPrefix
"agent:main:discord:"
} }
paths
name
"docs"
path
"~/notes"
pattern
"**/*.md"
Citations & fallback
memory.citations
applies regardless of backend (
auto
off
When
qmd
runs, we tag
status().backend = "qmd"
so diagnostics show which
engine served the results. If the QMD subprocess exits or JSON output can’t be
parsed, the search manager logs a warning and returns the builtin provider
(existing Markdown embeddings) until QMD recovers.
Additional memory paths
If you want to index Markdown files outside the default workspace layout, add
explicit paths:
agents: {
defaults
memorySearch
extraPaths
"../team-docs"
"/srv/shared-notes/overview.md"
Notes:
Paths can be absolute or workspace-relative.
Directories are scanned recursively for
.md
files.
Only Markdown files are indexed.
Symlinks are ignored (files or directories).
Gemini embeddings (native)
Set the provider to
gemini
to use the Gemini embeddings API directly:
agents: {
defaults
memorySearch
provider
"gemini"
model
"gemini-embedding-001"
remote
apiKey
"YOUR_GEMINI_API_KEY"
Notes:
remote.baseUrl
is optional (defaults to the Gemini API base URL).
remote.headers
lets you add extra headers if needed.
Default model:
gemini-embedding-001
If you want to use a
custom OpenAI-compatible endpoint
(OpenRouter, vLLM, or a proxy),
you can use the
remote
configuration with the OpenAI provider:
agents: {
defaults
memorySearch
provider
"openai"
model
"text-embedding-3-small"
remote
baseUrl
"https://api.example.com/v1/"
apiKey
"YOUR_OPENAI_COMPAT_API_KEY"
headers
"X-Custom-Header"
"value"
If you don’t want to set an API key, use
memorySearch.provider = "local"
or set
memorySearch.fallback = "none"
Fallbacks:
memorySearch.fallback
can be
openai
gemini
local
, or
none
The fallback provider is only used when the primary embedding provider fails.
Batch indexing (OpenAI + Gemini + Voyage):
Disabled by default. Set
agents.defaults.memorySearch.remote.batch.enabled = true
to enable for large-corpus indexing (OpenAI, Gemini, and Voyage).
Default behavior waits for batch completion; tune
remote.batch.wait
remote.batch.pollIntervalMs
, and
remote.batch.timeoutMinutes
if needed.
Set
remote.batch.concurrency
to control how many batch jobs we submit in parallel (default: 2).
Batch mode applies when
memorySearch.provider = "openai"
"gemini"
and uses the corresponding API key.
Gemini batch jobs use the async embeddings batch endpoint and require Gemini Batch API availability.
Why OpenAI batch is fast + cheap:
For large backfills, OpenAI is typically the fastest option we support because we can submit many embedding requests in a single batch job and let OpenAI process them asynchronously.
OpenAI offers discounted pricing for Batch API workloads, so large indexing runs are usually cheaper than sending the same requests synchronously.
See the OpenAI Batch API docs and pricing for details:
https://platform.openai.com/docs/api-reference/batch
https://platform.openai.com/pricing
Config example:
agents: {
defaults
memorySearch
provider
"openai"
model
"text-embedding-3-small"
fallback
"openai"
remote
batch
enabled
true
concurrency
2 }
sync
watch
true
Tools:
memory_search
— returns snippets with file + line ranges.
memory_get
— read memory file content by path.
Local mode:
Set
agents.defaults.memorySearch.provider = "local"
Provide
agents.defaults.memorySearch.local.modelPath
(GGUF or
hf:
URI).
Optional: set
agents.defaults.memorySearch.fallback = "none"
to avoid remote fallback.
How the memory tools work
memory_search
semantically searches Markdown chunks (~400 token target, 80-token overlap) from
MEMORY.md
memory/**/*.md
. It returns snippet text (capped ~700 chars), file path, line range, score, provider/model, and whether we fell back from local → remote embeddings. No full file payload is returned.
memory_get
reads a specific memory Markdown file (workspace-relative), optionally from a starting line and for N lines. Paths outside
MEMORY.md
memory/
are rejected.
Both tools are enabled only when
memorySearch.enabled
resolves true for the agent.
What gets indexed (and when)
File type: Markdown only (
MEMORY.md
memory/**/*.md
Index storage: per-agent SQLite at
~/.openclaw/memory/<agentId>.sqlite
(configurable via
agents.defaults.memorySearch.store.path
, supports
{agentId}
token).
Freshness: watcher on
MEMORY.md
memory/
marks the index dirty (debounce 1.5s). Sync is scheduled on session start, on search, or on an interval and runs asynchronously. Session transcripts use delta thresholds to trigger background sync.
Reindex triggers: the index stores the embedding
provider/model + endpoint fingerprint + chunking params
. If any of those change, OpenClaw automatically resets and reindexes the entire store.
Hybrid search (BM25 + vector)
When enabled, OpenClaw combines:
Vector similarity
(semantic match, wording can differ)
BM25 keyword relevance
(exact tokens like IDs, env vars, code symbols)
If full-text search is unavailable on your platform, OpenClaw falls back to vector-only search.
Why hybrid?
Vector search is great at “this means the same thing”:
“Mac Studio gateway host” vs “the machine running the gateway”
“debounce file updates” vs “avoid indexing on every write”
But it can be weak at exact, high-signal tokens:
IDs (
a828e60
b3b9895a…
code symbols (
memorySearch.query.hybrid
error strings (“sqlite-vec unavailable”)
BM25 (full-text) is the opposite: strong at exact tokens, weaker at paraphrases.
Hybrid search is the pragmatic middle ground:
use both retrieval signals
so you get
good results for both “natural language” queries and “needle in a haystack” queries.
How we merge results (the current design)
Implementation sketch:
Retrieve a candidate pool from both sides:
Vector
: top
maxResults * candidateMultiplier
by cosine similarity.
BM25
: top
maxResults * candidateMultiplier
by FTS5 BM25 rank (lower is better).
Convert BM25 rank into a 0..1-ish score:
textScore = 1 / (1 + max(0, bm25Rank))
Union candidates by chunk id and compute a weighted score:
finalScore = vectorWeight * vectorScore + textWeight * textScore
Notes:
vectorWeight
textWeight
is normalized to 1.0 in config resolution, so weights behave as percentages.
If embeddings are unavailable (or the provider returns a zero-vector), we still run BM25 and return keyword matches.
If FTS5 can’t be created, we keep vector-only search (no hard failure).
This isn’t “IR-theory perfect”, but it’s simple, fast, and tends to improve recall/precision on real notes.
If we want to get fancier later, common next steps are Reciprocal Rank Fusion (RRF) or score normalization
(min/max or z-score) before mixing.
Config:
agents: {
defaults
memorySearch
query
hybrid
enabled
true
vectorWeight
0.7
textWeight
0.3
candidateMultiplier
Embedding cache
OpenClaw can cache
chunk embeddings
in SQLite so reindexing and frequent updates (especially session transcripts) don’t re-embed unchanged text.
Config:
agents: {
defaults
memorySearch
cache
enabled
true
maxEntries
50000
Session memory search (experimental)
You can optionally index
session transcripts
and surface them via
memory_search
This is gated behind an experimental flag.
agents: {
defaults
memorySearch
experimental
sessionMemory
true
sources
"memory"
"sessions"
Notes:
Session indexing is
opt-in
(off by default).
Session updates are debounced and
indexed asynchronously
once they cross delta thresholds (best-effort).
memory_search
never blocks on indexing; results can be slightly stale until background sync finishes.
Results still include snippets only;
memory_get
remains limited to memory files.
Session indexing is isolated per agent (only that agent’s session logs are indexed).
Session logs live on disk (
~/.openclaw/agents/<agentId>/sessions/*.jsonl
). Any process/user with filesystem access can read them, so treat disk access as the trust boundary. For stricter isolation, run agents under separate OS users or hosts.
Delta thresholds (defaults shown):
agents: {
defaults
memorySearch
sync
sessions
deltaBytes
100000
// ~100 KB
deltaMessages
50 // JSONL lines
SQLite vector acceleration (sqlite-vec)
When the sqlite-vec extension is available, OpenClaw stores embeddings in a
SQLite virtual table (
vec0
) and performs vector distance queries in the
database. This keeps search fast without loading every embedding into JS.
Configuration (optional):
agents: {
defaults
memorySearch
store
vector
enabled
true
extensionPath
"/path/to/sqlite-vec"
Notes:
enabled
defaults to true; when disabled, search falls back to in-process
cosine similarity over stored embeddings.
If the sqlite-vec extension is missing or fails to load, OpenClaw logs the
error and continues with the JS fallback (no vector table).
extensionPath
overrides the bundled sqlite-vec path (useful for custom builds
or non-standard install locations).
Local embedding auto-download
Default local embedding model:
hf:ggml-org/embeddinggemma-300m-qat-q8_0-GGUF/embeddinggemma-300m-qat-Q8_0.gguf
(~0.6 GB).
When
memorySearch.provider = "local"
node-llama-cpp
resolves
modelPath
; if the GGUF is missing it
auto-downloads
to the cache (or
local.modelCacheDir
if set), then loads it. Downloads resume on retry.
Native build requirement: run
pnpm approve-builds
, pick
node-llama-cpp
, then
pnpm rebuild node-llama-cpp
Fallback: if local setup fails and
memorySearch.fallback = "openai"
, we automatically switch to remote embeddings (
openai/text-embedding-3-small
unless overridden) and record the reason.
Custom OpenAI-compatible endpoint example
agents: {
defaults
memorySearch
provider
"openai"
model
"text-embedding-3-small"
remote
baseUrl
"https://api.example.com/v1/"
apiKey
"YOUR_REMOTE_API_KEY"
headers
"X-Organization"
"org-id"
"X-Project"
"project-id"
Notes:
remote.*
takes precedence over
models.providers.openai.*
remote.headers
merge with OpenAI headers; remote wins on key conflicts. Omit
remote.headers
to use the OpenAI defaults.
Session Tools
Compaction

---
## Concepts > Messages

[Source: https://docs.openclaw.ai/concepts/messages]

This page ties together how OpenClaw handles inbound messages, sessions, queueing,
streaming, and reasoning visibility.
Message flow (high level)
Inbound message
-> routing/bindings -> session key
-> queue (if a run is active)
-> agent run (streaming + tools)
-> outbound replies (channel limits + chunking)
Key knobs live in configuration:
messages.*
for prefixes, queueing, and group behavior.
agents.defaults.*
for block streaming and chunking defaults.
Channel overrides (
channels.whatsapp.*
channels.telegram.*
, etc.) for caps and streaming toggles.
See
Configuration
for full schema.
Inbound dedupe
Channels can redeliver the same message after reconnects. OpenClaw keeps a
short-lived cache keyed by channel/account/peer/session/message id so duplicate
deliveries do not trigger another agent run.
Inbound debouncing
Rapid consecutive messages from the
same sender
can be batched into a single
agent turn via
messages.inbound
. Debouncing is scoped per channel + conversation
and uses the most recent message for reply threading/IDs.
Config (global default + per-channel overrides):
messages
inbound
debounceMs
2000
byChannel
whatsapp
5000
slack
1500
discord
1500
Notes:
Debounce applies to
text-only
messages; media/attachments flush immediately.
Control commands bypass debouncing so they remain standalone.
Sessions and devices
Sessions are owned by the gateway, not by clients.
Direct chats collapse into the agent main session key.
Groups/channels get their own session keys.
The session store and transcripts live on the gateway host.
Multiple devices/channels can map to the same session, but history is not fully
synced back to every client. Recommendation: use one primary device for long
conversations to avoid divergent context. The Control UI and TUI always show the
gateway-backed session transcript, so they are the source of truth.
Details:
Session management
Inbound bodies and history context
OpenClaw separates the
prompt body
from the
command body
Body
: prompt text sent to the agent. This may include channel envelopes and
optional history wrappers.
CommandBody
: raw user text for directive/command parsing.
RawBody
: legacy alias for
CommandBody
(kept for compatibility).
When a channel supplies history, it uses a shared wrapper:
[Chat messages since your last reply - for context]
[Current message - respond to this]
For
non-direct chats
(groups/channels/rooms), the
current message body
is prefixed with the
sender label (same style used for history entries). This keeps real-time and queued/history
messages consistent in the agent prompt.
History buffers are
pending-only
: they include group messages that did
not
trigger a run (for example, mention-gated messages) and
exclude
messages
already in the session transcript.
Directive stripping only applies to the
current message
section so history
remains intact. Channels that wrap history should set
CommandBody
(or
RawBody
) to the original message text and keep
Body
as the combined prompt.
History buffers are configurable via
messages.groupChat.historyLimit
(global
default) and per-channel overrides like
channels.slack.historyLimit
channels.telegram.accounts.<id>.historyLimit
(set
to disable).
Queueing and followups
If a run is already active, inbound messages can be queued, steered into the
current run, or collected for a followup turn.
Configure via
messages.queue
(and
messages.queue.byChannel
Modes:
interrupt
steer
followup
collect
, plus backlog variants.
Details:
Queueing
Streaming, chunking, and batching
Block streaming sends partial replies as the model produces text blocks.
Chunking respects channel text limits and avoids splitting fenced code.
Key settings:
agents.defaults.blockStreamingDefault
on|off
, default off)
agents.defaults.blockStreamingBreak
text_end|message_end
agents.defaults.blockStreamingChunk
minChars|maxChars|breakPreference
agents.defaults.blockStreamingCoalesce
(idle-based batching)
agents.defaults.humanDelay
(human-like pause between block replies)
Channel overrides:
*.blockStreaming
and
*.blockStreamingCoalesce
(non-Telegram channels require explicit
*.blockStreaming: true
Details:
Streaming + chunking
Reasoning visibility and tokens
OpenClaw can expose or hide model reasoning:
/reasoning on|off|stream
controls visibility.
Reasoning content still counts toward token usage when produced by the model.
Telegram supports reasoning stream into the draft bubble.
Details:
Thinking + reasoning directives
and
Token use
Prefixes, threading, and replies
Outbound message formatting is centralized in
messages
messages.responsePrefix
channels.<channel>.responsePrefix
, and
channels.<channel>.accounts.<id>.responsePrefix
(outbound prefix cascade), plus
channels.whatsapp.messagePrefix
(WhatsApp inbound prefix)
Reply threading via
replyToMode
and per-channel defaults
Details:
Configuration
and channel docs.
Presence
Streaming and Chunking

---
## Concepts > Model Failover

[Source: https://docs.openclaw.ai/concepts/model-failover]

# Model Failover - Complete Documentation

## Overview

OpenClaw implements a two-stage failure handling approach: "Auth profile rotation within the current provider" followed by "Model fallback to the next model in `agents.defaults.model.fallbacks`."

## Auth Storage Architecture

Credentials are stored in `~/.openclaw/agents/<agentId>/agent/auth-profiles.json` with these credential types:

- API keys: `{ provider, key }`
- OAuth tokens: `{ provider, access, refresh, expires, email? }`

The documentation notes that "Config `auth.profiles` / `auth.order` are **metadata + routing only** (no secrets)."

## Profile Identification System

Multiple accounts coexist through distinct OAuth profiles. Default naming follows this pattern:
- Without email: `provider:default`
- With email: `provider:<email>` (example: `google-antigravity:user@gmail.com`)

## Profile Selection Order

When multiple profiles exist, OpenClaw applies this hierarchy:

1. Explicit configuration via `auth.order[provider]`
2. Profiles in `auth.profiles` filtered by provider
3. Stored entries in `auth-profiles.json`

Round-robin ordering prioritizes "profile type (**OAuth before API keys**)" followed by usage statistics.

## Session Management

"OpenClaw **pins the chosen auth profile per session** to keep provider caches warm" and doesn't rotate on every request. Pinning resets when:
- Session resets occur (`/new` / `/reset`)
- Compaction completes
- Profile enters cooldown/disabled status

Manual overrides via `/model …@<profileId>` lock the session to that profile.

## Cooldown Mechanism

Failed profiles enter exponential backoff:
- 1 minute → 5 minutes → 25 minutes → 1 hour (maximum)

State tracking in `auth-profiles.json` includes `lastUsed`, `cooldownUntil`, and `errorCount`.

## Billing Disables

Billing failures trigger longer backoffs than standard cooldowns, starting at "**5 hours**, doubles per billing failure, and caps at **24 hours**." These reset after 24 hours without failures.

## Model Fallback Routing

When all profiles for a provider exhaust, OpenClaw advances through `agents.defaults.model.fallbacks`. This applies specifically to "auth failures, rate limits, and timeouts that exhausted profile rotation."

## Configuration References

Related settings include `auth.profiles`, `auth.order`, `auth.cooldowns.billingBackoffHours`, `agents.defaults.model.primary`, and `agents.defaults.imageModel`.

---
## Concepts > Model Providers

[Source: https://docs.openclaw.ai/concepts/model-providers]

Model Providers
Model providers
This page covers
LLM/model providers
(not chat channels like WhatsApp/Telegram).
For model selection rules, see
/concepts/models
Quick rules
Model refs use
provider/model
(example:
opencode/claude-opus-4-6
If you set
agents.defaults.models
, it becomes the allowlist.
CLI helpers:
openclaw onboard
openclaw models list
openclaw models set <provider/model>
Built-in providers (pi-ai catalog)
OpenClaw ships with the pi‑ai catalog. These providers require
models.providers
config; just set auth + pick a model.
OpenAI
Provider:
openai
Auth:
OPENAI_API_KEY
Example model:
openai/gpt-5.1-codex
CLI:
openclaw onboard --auth-choice openai-api-key
agents
defaults
model
primary
"openai/gpt-5.1-codex"
} } }
Anthropic
Provider:
anthropic
Auth:
ANTHROPIC_API_KEY
claude setup-token
Example model:
anthropic/claude-opus-4-6
CLI:
openclaw onboard --auth-choice token
(paste setup-token) or
openclaw models auth paste-token --provider anthropic
agents
defaults
model
primary
"anthropic/claude-opus-4-6"
} } }
OpenAI Code (Codex)
Provider:
openai-codex
Auth: OAuth (ChatGPT)
Example model:
openai-codex/gpt-5.3-codex
CLI:
openclaw onboard --auth-choice openai-codex
openclaw models auth login --provider openai-codex
agents
defaults
model
primary
"openai-codex/gpt-5.3-codex"
} } }
OpenCode Zen
Provider:
opencode
Auth:
OPENCODE_API_KEY
(or
OPENCODE_ZEN_API_KEY
Example model:
opencode/claude-opus-4-6
CLI:
openclaw onboard --auth-choice opencode-zen
agents
defaults
model
primary
"opencode/claude-opus-4-6"
} } }
Google Gemini (API key)
Provider:
google
Auth:
GEMINI_API_KEY
Example model:
google/gemini-3-pro-preview
CLI:
openclaw onboard --auth-choice gemini-api-key
Google Vertex, Antigravity, and Gemini CLI
Providers:
google-vertex
google-antigravity
google-gemini-cli
Auth: Vertex uses gcloud ADC; Antigravity/Gemini CLI use their respective auth flows
Antigravity OAuth is shipped as a bundled plugin (
google-antigravity-auth
, disabled by default).
Enable:
openclaw plugins enable google-antigravity-auth
Login:
openclaw models auth login --provider google-antigravity --set-default
Gemini CLI OAuth is shipped as a bundled plugin (
google-gemini-cli-auth
, disabled by default).
Enable:
openclaw plugins enable google-gemini-cli-auth
Login:
openclaw models auth login --provider google-gemini-cli --set-default
Note: you do
not
paste a client id or secret into
openclaw.json
. The CLI login flow stores
tokens in auth profiles on the gateway host.
Z.AI (GLM)
Provider:
zai
Auth:
ZAI_API_KEY
Example model:
zai/glm-4.7
CLI:
openclaw onboard --auth-choice zai-api-key
Aliases:
z.ai/*
and
z-ai/*
normalize to
zai/*
Vercel AI Gateway
Provider:
vercel-ai-gateway
Auth:
AI_GATEWAY_API_KEY
Example model:
vercel-ai-gateway/anthropic/claude-opus-4.6
CLI:
openclaw onboard --auth-choice ai-gateway-api-key
Other built-in providers
OpenRouter:
openrouter
OPENROUTER_API_KEY
Example model:
openrouter/anthropic/claude-sonnet-4-5
xAI:
xai
XAI_API_KEY
Groq:
groq
GROQ_API_KEY
Cerebras:
cerebras
CEREBRAS_API_KEY
GLM models on Cerebras use ids
zai-glm-4.7
and
zai-glm-4.6
OpenAI-compatible base URL:
https://api.cerebras.ai/v1
Mistral:
mistral
MISTRAL_API_KEY
GitHub Copilot:
github-copilot
COPILOT_GITHUB_TOKEN
GH_TOKEN
GITHUB_TOKEN
Hugging Face Inference:
huggingface
HUGGINGFACE_HUB_TOKEN
HF_TOKEN
) — OpenAI-compatible router; example model:
huggingface/deepseek-ai/DeepSeek-R1
; CLI:
openclaw onboard --auth-choice huggingface-api-key
. See
Hugging Face (Inference)
Providers via
models.providers
(custom/base URL)
Use
models.providers
(or
models.json
) to add
custom
providers or
OpenAI/Anthropic‑compatible proxies.
Moonshot AI (Kimi)
Moonshot uses OpenAI-compatible endpoints, so configure it as a custom provider:
Provider:
moonshot
Auth:
MOONSHOT_API_KEY
Example model:
moonshot/kimi-k2.5
Kimi K2 model IDs:
moonshot/kimi-k2.5
moonshot/kimi-k2-0905-preview
moonshot/kimi-k2-turbo-preview
moonshot/kimi-k2-thinking
moonshot/kimi-k2-thinking-turbo
agents
defaults
model
primary
"moonshot/kimi-k2.5"
} }
models
mode
"merge"
providers
moonshot
baseUrl
"https://api.moonshot.ai/v1"
apiKey
"${MOONSHOT_API_KEY}"
api
"openai-completions"
models
"kimi-k2.5"
name
"Kimi K2.5"
Kimi Coding
Kimi Coding uses Moonshot AI’s Anthropic-compatible endpoint:
Provider:
kimi-coding
Auth:
KIMI_API_KEY
Example model:
kimi-coding/k2p5
env
KIMI_API_KEY
"sk-..."
agents
defaults
model
primary
"kimi-coding/k2p5"
} }
Qwen OAuth (free tier)
Qwen provides OAuth access to Qwen Coder + Vision via a device-code flow.
Enable the bundled plugin, then log in:
openclaw
plugins
enable
qwen-portal-auth
openclaw
models
auth
login
--provider
qwen-portal
--set-default
Model refs:
qwen-portal/coder-model
qwen-portal/vision-model
See
/providers/qwen
for setup details and notes.
Synthetic
Synthetic provides Anthropic-compatible models behind the
synthetic
provider:
Provider:
synthetic
Auth:
SYNTHETIC_API_KEY
Example model:
synthetic/hf:MiniMaxAI/MiniMax-M2.1
CLI:
openclaw onboard --auth-choice synthetic-api-key
agents
defaults
model
primary
"synthetic/hf:MiniMaxAI/MiniMax-M2.1"
} }
models
mode
"merge"
providers
synthetic
baseUrl
"https://api.synthetic.new/anthropic"
apiKey
"${SYNTHETIC_API_KEY}"
api
"anthropic-messages"
models
"hf:MiniMaxAI/MiniMax-M2.1"
name
"MiniMax M2.1"
MiniMax
MiniMax is configured via
models.providers
because it uses custom endpoints:
MiniMax (Anthropic‑compatible):
--auth-choice minimax-api
Auth:
MINIMAX_API_KEY
See
/providers/minimax
for setup details, model options, and config snippets.
Ollama
Ollama is a local LLM runtime that provides an OpenAI-compatible API:
Provider:
ollama
Auth: None required (local server)
Example model:
ollama/llama3.3
Installation:
https://ollama.ai
# Install Ollama, then pull a model:
ollama
pull
llama3.3
agents
defaults
model
primary
"ollama/llama3.3"
} }
Ollama is automatically detected when running locally at
http://127.0.0.1:11434/v1
. See
/providers/ollama
for model recommendations and custom configuration.
vLLM
vLLM is a local (or self-hosted) OpenAI-compatible server:
Provider:
vllm
Auth: Optional (depends on your server)
Default base URL:
http://127.0.0.1:8000/v1
To opt in to auto-discovery locally (any value works if your server doesn’t enforce auth):
export
VLLM_API_KEY
"vllm-local"
Then set a model (replace with one of the IDs returned by
/v1/models
agents
defaults
model
primary
"vllm/your-model-id"
} }
See
/providers/vllm
for details.
Local proxies (LM Studio, vLLM, LiteLLM, etc.)
Example (OpenAI‑compatible):
agents
defaults
model
primary
"lmstudio/minimax-m2.1-gs32"
models
"lmstudio/minimax-m2.1-gs32"
alias
"Minimax"
} }
models
providers
lmstudio
baseUrl
"http://localhost:1234/v1"
apiKey
"LMSTUDIO_KEY"
api
"openai-completions"
models
"minimax-m2.1-gs32"
name
"MiniMax M2.1"
reasoning
false
input
"text"
cost
input
output
cacheRead
cacheWrite
0 }
contextWindow
200000
maxTokens
8192
Notes:
For custom providers,
reasoning
input
cost
contextWindow
, and
maxTokens
are optional.
When omitted, OpenClaw defaults to:
reasoning: false
input: ["text"]
cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
contextWindow: 200000
maxTokens: 8192
Recommended: set explicit values that match your proxy/model limits.
CLI examples
openclaw
onboard
--auth-choice
opencode-zen
openclaw
models
set
opencode/claude-opus-4-6
openclaw
models
list
See also:
/gateway/configuration
for full configuration examples.
Models CLI
Model Failover

---
## Concepts > Models

[Source: https://docs.openclaw.ai/concepts/models]

/concepts/model-failover
for auth profile
rotation, cooldowns, and how that interacts with fallbacks.
Quick provider overview + examples:
/concepts/model-providers
How model selection works
OpenClaw selects models in this order:
Primary
model (
agents.defaults.model.primary
agents.defaults.model
Fallbacks
agents.defaults.model.fallbacks
(in order).
Provider auth failover
happens inside a provider before moving to the
next model.
Related:
agents.defaults.models
is the allowlist/catalog of models OpenClaw can use (plus aliases).
agents.defaults.imageModel
is used
only when
the primary model can’t accept images.
Per-agent defaults can override
agents.defaults.model
via
agents.list[].model
plus bindings (see
/concepts/multi-agent
Quick model picks (anecdotal)
GLM
: a bit better for coding/tool calling.
MiniMax
: better for writing and vibes.
Setup wizard (recommended)
If you don’t want to hand-edit config, run the onboarding wizard:
openclaw
onboard
It can set up model + auth for common providers, including
OpenAI Code (Codex)
subscription
(OAuth) and
Anthropic
(API key recommended;
claude setup-token
also supported).
Config keys (overview)
agents.defaults.model.primary
and
agents.defaults.model.fallbacks
agents.defaults.imageModel.primary
and
agents.defaults.imageModel.fallbacks
agents.defaults.models
(allowlist + aliases + provider params)
models.providers
(custom providers written into
models.json
Model refs are normalized to lowercase. Provider aliases like
z.ai/*
normalize
zai/*
Provider configuration examples (including OpenCode Zen) live in
/gateway/configuration
“Model is not allowed” (and why replies stop)
agents.defaults.models
is set, it becomes the
allowlist
for
/model
and for
session overrides. When a user selects a model that isn’t in that allowlist,
OpenClaw returns:
Model "provider/model" is not allowed. Use /model to list available models.
This happens
before
a normal reply is generated, so the message can feel
like it “didn’t respond.” The fix is to either:
Add the model to
agents.defaults.models
, or
Clear the allowlist (remove
agents.defaults.models
), or
Pick a model from
/model list
Example allowlist config:
agent
model
primary
"anthropic/claude-sonnet-4-5"
models
"anthropic/claude-sonnet-4-5"
alias
"Sonnet"
"anthropic/claude-opus-4-6"
alias
"Opus"
Switching models in chat (
/model
You can switch models for the current session without restarting:
/model
/model list
/model 3
/model openai/gpt-5.2
/model status
Notes:
/model
(and
/model list
) is a compact, numbered picker (model family + available providers).
/model <#>
selects from that picker.
/model status
is the detailed view (auth candidates and, when configured, provider endpoint
baseUrl
api
mode).
Model refs are parsed by splitting on the
first
. Use
provider/model
when typing
/model <ref>
If the model ID itself contains
(OpenRouter-style), you must include the provider prefix (example:
/model openrouter/moonshotai/kimi-k2
If you omit the provider, OpenClaw treats the input as an alias or a model for the
default provider
(only works when there is no
in the model ID).
Full command behavior/config:
Slash commands
CLI commands
openclaw
models
list
openclaw
models
status
openclaw
models
set
<
provider/mode
>
openclaw
models
set-image
<
provider/mode
>
openclaw
models
aliases
list
openclaw
models
aliases
add
<
alia
>
<
provider/mode
>
openclaw
models
aliases
remove
<
alia
>
openclaw
models
fallbacks
list
openclaw
models
fallbacks
add
<
provider/mode
>
openclaw
models
fallbacks
remove
<
provider/mode
>
openclaw
models
fallbacks
clear
openclaw
models
image-fallbacks
list
openclaw
models
image-fallbacks
add
<
provider/mode
>
openclaw
models
image-fallbacks
remove
<
provider/mode
>
openclaw
models
image-fallbacks
clear
openclaw models
(no subcommand) is a shortcut for
models status
models list
Shows configured models by default. Useful flags:
--all
: full catalog
--local
: local providers only
--provider <name>
: filter by provider
--plain
: one model per line
--json
: machine‑readable output
models status
Shows the resolved primary model, fallbacks, image model, and an auth overview
of configured providers. It also surfaces OAuth expiry status for profiles found
in the auth store (warns within 24h by default).
--plain
prints only the
resolved primary model.
OAuth status is always shown (and included in
--json
output). If a configured
provider has no credentials,
models status
prints a
Missing auth
section.
JSON includes
auth.oauth
(warn window + profiles) and
auth.providers
(effective auth per provider).
Use
--check
for automation (exit
when missing/expired,
when expiring).
Preferred Anthropic auth is the Claude Code CLI setup-token (run anywhere; paste on the gateway host if needed):
claude
setup-token
openclaw
models
status
Scanning (OpenRouter free models)
openclaw models scan
inspects OpenRouter’s
free model catalog
and can
optionally probe models for tool and image support.
Key flags:
--no-probe
: skip live probes (metadata only)
--min-params <b>
: minimum parameter size (billions)
--max-age-days <days>
: skip older models
--provider <name>
: provider prefix filter
--max-candidates <n>
: fallback list size
--set-default
: set
agents.defaults.model.primary
to the first selection
--set-image
: set
agents.defaults.imageModel.primary
to the first image selection
Probing requires an OpenRouter API key (from auth profiles or
OPENROUTER_API_KEY
). Without a key, use
--no-probe
to list candidates only.
Scan results are ranked by:
Image support
Tool latency
Context size
Parameter count
Input
OpenRouter
/models
list (filter
:free
Requires OpenRouter API key from auth profiles or
OPENROUTER_API_KEY
(see
/environment
Optional filters:
--max-age-days
--min-params
--provider
--max-candidates
Probe controls:
--timeout
--concurrency
When run in a TTY, you can select fallbacks interactively. In non‑interactive
mode, pass
--yes
to accept defaults.
Models registry (
models.json
Custom providers in
models.providers
are written into
models.json
under the
agent directory (default
~/.openclaw/agents/<agentId>/models.json
). This file
is merged by default unless
models.mode
is set to
replace
Model Provider Quickstart
Model Providers

---
## Concepts > Multi Agent

[Source: https://docs.openclaw.ai/concepts/multi-agent]

+ sessions), plus multiple channel accounts (e.g. two WhatsApps) in one running Gateway. Inbound is routed to an agent via bindings.
What is “one agent”?
agent
is a fully scoped brain with its own:
Workspace
(files, AGENTS.md/SOUL.md/USER.md, local notes, persona rules).
State directory
agentDir
) for auth profiles, model registry, and per-agent config.
Session store
(chat history + routing state) under
~/.openclaw/agents/<agentId>/sessions
Auth profiles are
per-agent
. Each agent reads from its own:
~/.openclaw/agents/<agentId>/agent/auth-profiles.json
Main agent credentials are
not
shared automatically. Never reuse
agentDir
across agents (it causes auth/session collisions). If you want to share creds,
copy
auth-profiles.json
into the other agent’s
agentDir
Skills are per-agent via each workspace’s
skills/
folder, with shared skills
available from
~/.openclaw/skills
. See
Skills: per-agent vs shared
The Gateway can host
one agent
(default) or
many agents
side-by-side.
Workspace note:
each agent’s workspace is the
default cwd
, not a hard
sandbox. Relative paths resolve inside the workspace, but absolute paths can
reach other host locations unless sandboxing is enabled. See
Sandboxing
Paths (quick map)
Config:
~/.openclaw/openclaw.json
(or
OPENCLAW_CONFIG_PATH
State dir:
~/.openclaw
(or
OPENCLAW_STATE_DIR
Workspace:
~/.openclaw/workspace
(or
~/.openclaw/workspace-<agentId>
Agent dir:
~/.openclaw/agents/<agentId>/agent
(or
agents.list[].agentDir
Sessions:
~/.openclaw/agents/<agentId>/sessions
Single-agent mode (default)
If you do nothing, OpenClaw runs a single agent:
agentId
defaults to
main
Sessions are keyed as
agent:main:<mainKey>
Workspace defaults to
~/.openclaw/workspace
(or
~/.openclaw/workspace-<profile>
when
OPENCLAW_PROFILE
is set).
State defaults to
~/.openclaw/agents/main/agent
Agent helper
Use the agent wizard to add a new isolated agent:
openclaw
agents
add
work
Then add
bindings
(or let the wizard do it) to route inbound messages.
Verify with:
openclaw
agents
list
--bindings
Multiple agents = multiple people, multiple personalities
With
multiple agents
, each
agentId
becomes a
fully isolated persona
Different phone numbers/accounts
(per channel
accountId
Different personalities
(per-agent workspace files like
AGENTS.md
and
SOUL.md
Separate auth + sessions
(no cross-talk unless explicitly enabled).
This lets
multiple people
share one Gateway server while keeping their AI “brains” and data isolated.
One WhatsApp number, multiple people (DM split)
You can route
different WhatsApp DMs
to different agents while staying on
one WhatsApp account
. Match on sender E.164 (like
+15551234567
) with
peer.kind: "direct"
. Replies still come from the same WhatsApp number (no per‑agent sender identity).
Important detail: direct chats collapse to the agent’s
main session key
, so true isolation requires
one agent per person
Example:
agents
list
"alex"
workspace
"~/.openclaw/workspace-alex"
"mia"
workspace
"~/.openclaw/workspace-mia"
bindings
agentId
"alex"
match
channel
"whatsapp"
peer
kind
"direct"
"+15551230001"
} }
agentId
"mia"
match
channel
"whatsapp"
peer
kind
"direct"
"+15551230002"
} }
channels
whatsapp
dmPolicy
"allowlist"
allowFrom
"+15551230001"
"+15551230002"
Notes:
DM access control is
global per WhatsApp account
(pairing/allowlist), not per agent.
For shared groups, bind the group to one agent or use
Broadcast groups
Routing rules (how messages pick an agent)
Bindings are
deterministic
and
most-specific wins
peer
match (exact DM/group/channel id)
parentPeer
match (thread inheritance)
guildId + roles
(Discord role routing)
guildId
(Discord)
teamId
(Slack)
accountId
match for a channel
channel-level match (
accountId: "*"
fallback to default agent (
agents.list[].default
, else first list entry, default:
main
If a binding sets multiple match fields (for example
peer
guildId
), all specified fields are required (
AND
semantics).
Multiple accounts / phone numbers
Channels that support
multiple accounts
(e.g. WhatsApp) use
accountId
to identify
each login. Each
accountId
can be routed to a different agent, so one server can host
multiple phone numbers without mixing sessions.
Concepts
agentId
: one “brain” (workspace, per-agent auth, per-agent session store).
accountId
: one channel account instance (e.g. WhatsApp account
"personal"
"biz"
binding
: routes inbound messages to an
agentId
(channel, accountId, peer)
and optionally guild/team ids.
Direct chats collapse to
agent:<agentId>:<mainKey>
(per-agent “main”;
session.mainKey
Example: two WhatsApps → two agents
~/.openclaw/openclaw.json
(JSON5):
agents
list
"home"
default
true
name
"Home"
workspace
"~/.openclaw/workspace-home"
agentDir
"~/.openclaw/agents/home/agent"
"work"
name
"Work"
workspace
"~/.openclaw/workspace-work"
agentDir
"~/.openclaw/agents/work/agent"
// Deterministic routing: first match wins (most-specific first).
bindings
{ agentId
"home"
match
{ channel
"whatsapp"
accountId
"personal"
} }
{ agentId
"work"
match
{ channel
"whatsapp"
accountId
"biz"
} }
// Optional per-peer override (example: send a specific group to work agent).
agentId
"work"
match
channel
"whatsapp"
accountId
"personal"
peer
{ kind
"group"
"
[email protected]
"
// Off by default: agent-to-agent messaging must be explicitly enabled + allowlisted.
tools
agentToAgent
enabled
false
allow
"home"
"work"
channels
whatsapp
accounts
personal
// Optional override. Default: ~/.openclaw/credentials/whatsapp/personal
// authDir: "~/.openclaw/credentials/whatsapp/personal",
biz
// Optional override. Default: ~/.openclaw/credentials/whatsapp/biz
// authDir: "~/.openclaw/credentials/whatsapp/biz",
Example: WhatsApp daily chat + Telegram deep work
Split by channel: route WhatsApp to a fast everyday agent and Telegram to an Opus agent.
agents
list
"chat"
name
"Everyday"
workspace
"~/.openclaw/workspace-chat"
model
"anthropic/claude-sonnet-4-5"
"opus"
name
"Deep Work"
workspace
"~/.openclaw/workspace-opus"
model
"anthropic/claude-opus-4-6"
bindings
agentId
"chat"
match
channel
"whatsapp"
} }
agentId
"opus"
match
channel
"telegram"
} }
Notes:
If you have multiple accounts for a channel, add
accountId
to the binding (for example
{ channel: "whatsapp", accountId: "personal" }
To route a single DM/group to Opus while keeping the rest on chat, add a
match.peer
binding for that peer; peer matches always win over channel-wide rules.
Example: same channel, one peer to Opus
Keep WhatsApp on the fast agent, but route one DM to Opus:
agents
list
"chat"
name
"Everyday"
workspace
"~/.openclaw/workspace-chat"
model
"anthropic/claude-sonnet-4-5"
"opus"
name
"Deep Work"
workspace
"~/.openclaw/workspace-opus"
model
"anthropic/claude-opus-4-6"
bindings
agentId
"opus"
match
channel
"whatsapp"
peer
kind
"direct"
"+15551234567"
} }
agentId
"chat"
match
channel
"whatsapp"
} }
Peer bindings always win, so keep them above the channel-wide rule.
Family agent bound to a WhatsApp group
Bind a dedicated family agent to a single WhatsApp group, with mention gating
and a tighter tool policy:
agents
list
"family"
name
"Family"
workspace
"~/.openclaw/workspace-family"
identity
name
"Family Bot"
groupChat
mentionPatterns
"@family"
"@familybot"
"@Family Bot"
sandbox
mode
"all"
scope
"agent"
tools
allow
"exec"
"read"
"sessions_list"
"sessions_history"
"sessions_send"
"sessions_spawn"
"session_status"
deny
"write"
"edit"
"apply_patch"
"browser"
"canvas"
"nodes"
"cron"
bindings
agentId
"family"
match
channel
"whatsapp"
peer
kind
"group"
"
[email protected]
"
Notes:
Tool allow/deny lists are
tools
, not skills. If a skill needs to run a
binary, ensure
exec
is allowed and the binary exists in the sandbox.
For stricter gating, set
agents.list[].groupChat.mentionPatterns
and keep
group allowlists enabled for the channel.
Per-Agent Sandbox and Tool Configuration
Starting with v2026.1.6, each agent can have its own sandbox and tool restrictions:
agents
list
"personal"
workspace
"~/.openclaw/workspace-personal"
sandbox
mode
"off"
// No sandbox for personal agent
// No tool restrictions - all tools available
"family"
workspace
"~/.openclaw/workspace-family"
sandbox
mode
"all"
// Always sandboxed
scope
"agent"
// One container per agent
docker
// Optional one-time setup after container creation
setupCommand
"apt-get update && apt-get install -y git curl"
tools
allow
"read"
// Only read tool
deny
"exec"
"write"
"edit"
"apply_patch"
// Deny others
Note:
setupCommand
lives under
sandbox.docker
and runs once on container creation.
Per-agent
sandbox.docker.*
overrides are ignored when the resolved scope is
"shared"
Benefits:
Security isolation
: Restrict tools for untrusted agents
Resource control
: Sandbox specific agents while keeping others on host
Flexible policies
: Different permissions per agent
Note:
tools.elevated
global
and sender-based; it is not configurable per agent.
If you need per-agent boundaries, use
agents.list[].tools
to deny
exec
For group targeting, use
agents.list[].groupChat.mentionPatterns
so @mentions map cleanly to the intended agent.
See
Multi-Agent Sandbox & Tools
for detailed examples.
Compaction
Presence

---
## Concepts > Oauth

[Source: https://docs.openclaw.ai/concepts/oauth]

OpenClaw supports “subscription auth” via OAuth for providers that offer it (notably
OpenAI Codex (ChatGPT OAuth)
). For Anthropic subscriptions, use the
setup-token
flow. This page explains:
how the OAuth
token exchange
works (PKCE)
where tokens are
stored
(and why)
how to handle
multiple accounts
(profiles + per-session overrides)
OpenClaw also supports
provider plugins
that ship their own OAuth or API‑key
flows. Run them via:
openclaw
models
auth
login
--provider
<
>
The token sink (why it exists)
OAuth providers commonly mint a
new refresh token
during login/refresh flows. Some providers (or OAuth clients) can invalidate older refresh tokens when a new one is issued for the same user/app.
Practical symptom:
you log in via OpenClaw
and
via Claude Code / Codex CLI → one of them randomly gets “logged out” later
To reduce that, OpenClaw treats
auth-profiles.json
as a
token sink
the runtime reads credentials from
one place
we can keep multiple profiles and route them deterministically
Storage (where tokens live)
Secrets are stored
per-agent
Auth profiles (OAuth + API keys):
~/.openclaw/agents/<agentId>/agent/auth-profiles.json
Runtime cache (managed automatically; don’t edit):
~/.openclaw/agents/<agentId>/agent/auth.json
Legacy import-only file (still supported, but not the main store):
~/.openclaw/credentials/oauth.json
(imported into
auth-profiles.json
on first use)
All of the above also respect
$OPENCLAW_STATE_DIR
(state dir override). Full reference:
/gateway/configuration
Anthropic setup-token (subscription auth)
Run
claude setup-token
on any machine, then paste it into OpenClaw:
openclaw
models
auth
setup-token
--provider
anthropic
If you generated the token elsewhere, paste it manually:
openclaw
models
auth
paste-token
--provider
anthropic
Verify:
openclaw
models
status
OAuth exchange (how login works)
OpenClaw’s interactive login flows are implemented in
@mariozechner/pi-ai
and wired into the wizards/commands.
Anthropic (Claude Pro/Max) setup-token
Flow shape:
run
claude setup-token
paste the token into OpenClaw
store as a token auth profile (no refresh)
The wizard path is
openclaw onboard
→ auth choice
setup-token
(Anthropic).
OpenAI Codex (ChatGPT OAuth)
Flow shape (PKCE):
generate PKCE verifier/challenge + random
state
open
https://auth.openai.com/oauth/authorize?...
try to capture callback on
http://127.0.0.1:1455/auth/callback
if callback can’t bind (or you’re remote/headless), paste the redirect URL/code
exchange at
https://auth.openai.com/oauth/token
extract
accountId
from the access token and store
{ access, refresh, expires, accountId }
Wizard path is
openclaw onboard
→ auth choice
openai-codex
Refresh + expiry
Profiles store an
expires
timestamp.
At runtime:
expires
is in the future → use the stored access token
if expired → refresh (under a file lock) and overwrite the stored credentials
The refresh flow is automatic; you generally don’t need to manage tokens manually.
Multiple accounts (profiles) + routing
Two patterns:
1) Preferred: separate agents
If you want “personal” and “work” to never interact, use isolated agents (separate sessions + credentials + workspace):
openclaw
agents
add
work
openclaw
agents
add
personal
Then configure auth per-agent (wizard) and route chats to the right agent.
2) Advanced: multiple profiles in one agent
auth-profiles.json
supports multiple profile IDs for the same provider.
Pick which profile is used:
globally via config ordering (
auth.order
per-session via
/model ...@<profileId>
Example (session override):
/model Opus@anthropic:work
How to see what profile IDs exist:
openclaw channels list --json
(shows
auth[]
Related docs:
/concepts/model-failover
(rotation + cooldown rules)
/tools/slash-commands
(command surface)
Agent Workspace
Bootstrapping

---
## Concepts > Presence

[Source: https://docs.openclaw.ai/concepts/presence]

OpenClaw “presence” is a lightweight, best‑effort view of:
the
Gateway
itself, and
clients connected to the Gateway
(mac app, WebChat, CLI, etc.)
Presence is used primarily to render the macOS app’s
Instances
tab and to
provide quick operator visibility.
Presence fields (what shows up)
Presence entries are structured objects with fields like:
instanceId
(optional but strongly recommended): stable client identity (usually
connect.client.instanceId
host
: human‑friendly host name
: best‑effort IP address
version
: client version string
deviceFamily
modelIdentifier
: hardware hints
mode
webchat
cli
backend
probe
test
node
, …
lastInputSeconds
: “seconds since last user input” (if known)
reason
self
connect
node-connected
periodic
, …
: last update timestamp (ms since epoch)
Producers (where presence comes from)
Presence entries are produced by multiple sources and
merged
1) Gateway self entry
The Gateway always seeds a “self” entry at startup so UIs show the gateway host
even before any clients connect.
2) WebSocket connect
Every WS client begins with a
connect
request. On successful handshake the
Gateway upserts a presence entry for that connection.
Why one‑off CLI commands don’t show up
The CLI often connects for short, one‑off commands. To avoid spamming the
Instances list,
client.mode === "cli"
not
turned into a presence entry.
system-event
beacons
Clients can send richer periodic beacons via the
system-event
method. The mac
app uses this to report host name, IP, and
lastInputSeconds
4) Node connects (role: node)
When a node connects over the Gateway WebSocket with
role: node
, the Gateway
upserts a presence entry for that node (same flow as other WS clients).
Merge + dedupe rules (why
instanceId
matters)
Presence entries are stored in a single in‑memory map:
Entries are keyed by a
presence key
The best key is a stable
instanceId
(from
connect.client.instanceId
) that survives restarts.
Keys are case‑insensitive.
If a client reconnects without a stable
instanceId
, it may show up as a
duplicate
row.
TTL and bounded size
Presence is intentionally ephemeral:
TTL:
entries older than 5 minutes are pruned
Max entries:
200 (oldest dropped first)
This keeps the list fresh and avoids unbounded memory growth.
Remote/tunnel caveat (loopback IPs)
When a client connects over an SSH tunnel / local port forward, the Gateway may
see the remote address as
127.0.0.1
. To avoid overwriting a good client‑reported
IP, loopback remote addresses are ignored.
Consumers
macOS Instances tab
The macOS app renders the output of
system-presence
and applies a small status
indicator (Active/Idle/Stale) based on the age of the last update.
Debugging tips
To see the raw list, call
system-presence
against the Gateway.
If you see duplicates:
confirm clients send a stable
client.instanceId
in the handshake
confirm periodic beacons use the same
instanceId
check whether the connection‑derived entry is missing
instanceId
(duplicates are expected)
Multi-Agent Routing
Messages

---
## Concepts > Queue

[Source: https://docs.openclaw.ai/concepts/queue]

Command Queue (2026-01-16)
We serialize inbound auto-reply runs (all channels) through a tiny in-process queue to prevent multiple agent runs from colliding, while still allowing safe parallelism across sessions.
Why
Auto-reply runs can be expensive (LLM calls) and can collide when multiple inbound messages arrive close together.
Serializing avoids competing for shared resources (session files, logs, CLI stdin) and reduces the chance of upstream rate limits.
How it works
A lane-aware FIFO queue drains each lane with a configurable concurrency cap (default 1 for unconfigured lanes; main defaults to 4, subagent to 8).
runEmbeddedPiAgent
enqueues by
session key
(lane
session:<key>
) to guarantee only one active run per session.
Each session run is then queued into a
global lane
main
by default) so overall parallelism is capped by
agents.defaults.maxConcurrent
When verbose logging is enabled, queued runs emit a short notice if they waited more than ~2s before starting.
Typing indicators still fire immediately on enqueue (when supported by the channel) so user experience is unchanged while we wait our turn.
Queue modes (per channel)
Inbound messages can steer the current run, wait for a followup turn, or do both:
steer
: inject immediately into the current run (cancels pending tool calls after the next tool boundary). If not streaming, falls back to followup.
followup
: enqueue for the next agent turn after the current run ends.
collect
: coalesce all queued messages into a
single
followup turn (default). If messages target different channels/threads, they drain individually to preserve routing.
steer-backlog
(aka
steer+backlog
): steer now
and
preserve the message for a followup turn.
interrupt
(legacy): abort the active run for that session, then run the newest message.
queue
(legacy alias): same as
steer
Steer-backlog means you can get a followup response after the steered run, so
streaming surfaces can look like duplicates. Prefer
collect
steer
if you want
one response per inbound message.
Send
/queue collect
as a standalone command (per-session) or set
messages.queue.byChannel.discord: "collect"
Defaults (when unset in config):
All surfaces →
collect
Configure globally or per channel via
messages.queue
messages
queue
mode
"collect"
debounceMs
1000
cap
drop
"summarize"
byChannel
discord
"collect"
Queue options
Options apply to
followup
collect
, and
steer-backlog
(and to
steer
when it falls back to followup):
debounceMs
: wait for quiet before starting a followup turn (prevents “continue, continue”).
cap
: max queued messages per session.
drop
: overflow policy (
old
new
summarize
Summarize keeps a short bullet list of dropped messages and injects it as a synthetic followup prompt.
Defaults:
debounceMs: 1000
cap: 20
drop: summarize
Per-session overrides
Send
/queue <mode>
as a standalone command to store the mode for the current session.
Options can be combined:
/queue collect debounce:2s cap:25 drop:summarize
/queue default
/queue reset
clears the session override.
Scope and guarantees
Applies to auto-reply agent runs across all inbound channels that use the gateway reply pipeline (WhatsApp web, Telegram, Slack, Discord, Signal, iMessage, webchat, etc.).
Default lane (
main
) is process-wide for inbound + main heartbeats; set
agents.defaults.maxConcurrent
to allow multiple sessions in parallel.
Additional lanes may exist (e.g.
cron
subagent
) so background jobs can run in parallel without blocking inbound replies.
Per-session lanes guarantee that only one agent run touches a given session at a time.
No external dependencies or background worker threads; pure TypeScript + promises.
Troubleshooting
If commands seem stuck, enable verbose logs and look for “queued for …ms” lines to confirm the queue is draining.
If you need queue depth, enable verbose logs and watch for queue timing lines.
Retry Policy

---
## Concepts > Retry

[Source: https://docs.openclaw.ai/concepts/retry]

Retry policy
Goals
Retry per HTTP request, not per multi-step flow.
Preserve ordering by retrying only the current step.
Avoid duplicating non-idempotent operations.
Defaults
Attempts: 3
Max delay cap: 30000 ms
Jitter: 0.1 (10 percent)
Provider defaults:
Telegram min delay: 400 ms
Discord min delay: 500 ms
Behavior
Discord
Retries only on rate-limit errors (HTTP 429).
Uses Discord
retry_after
when available, otherwise exponential backoff.
Telegram
Retries on transient errors (429, timeout, connect/reset/closed, temporarily unavailable).
Uses
retry_after
when available, otherwise exponential backoff.
Markdown parse errors are not retried; they fall back to plain text.
Configuration
Set retry policy per provider in
~/.openclaw/openclaw.json
channels
telegram
retry
attempts
minDelayMs
400
maxDelayMs
30000
jitter
0.1
discord
retry
attempts
minDelayMs
500
maxDelayMs
30000
jitter
0.1
Notes
Retries apply per request (message send, media upload, reaction, poll, sticker).
Composite flows do not retry completed steps.
Streaming and Chunking
Command Queue

---
## Concepts > Session Pruning

[Source: https://docs.openclaw.ai/concepts/session-pruning]

from the in-memory context right before each LLM call. It does
not
rewrite the on-disk session history (
*.jsonl
When it runs
When
mode: "cache-ttl"
is enabled and the last Anthropic call for the session is older than
ttl
Only affects the messages sent to the model for that request.
Only active for Anthropic API calls (and OpenRouter Anthropic models).
For best results, match
ttl
to your model
cacheControlTtl
After a prune, the TTL window resets so subsequent requests keep cache until
ttl
expires again.
Smart defaults (Anthropic)
OAuth or setup-token
profiles: enable
cache-ttl
pruning and set heartbeat to
API key
profiles: enable
cache-ttl
pruning, set heartbeat to
30m
, and default
cacheControlTtl
on Anthropic models.
If you set any of these values explicitly, OpenClaw does
not
override them.
What this improves (cost + cache behavior)
Why prune:
Anthropic prompt caching only applies within the TTL. If a session goes idle past the TTL, the next request re-caches the full prompt unless you trim it first.
What gets cheaper:
pruning reduces the
cacheWrite
size for that first request after the TTL expires.
Why the TTL reset matters:
once pruning runs, the cache window resets, so follow‑up requests can reuse the freshly cached prompt instead of re-caching the full history again.
What it does not do:
pruning doesn’t add tokens or “double” costs; it only changes what gets cached on that first post‑TTL request.
What can be pruned
Only
toolResult
messages.
User + assistant messages are
never
modified.
The last
keepLastAssistants
assistant messages are protected; tool results after that cutoff are not pruned.
If there aren’t enough assistant messages to establish the cutoff, pruning is skipped.
Tool results containing
image blocks
are skipped (never trimmed/cleared).
Context window estimation
Pruning uses an estimated context window (chars ≈ tokens × 4). The base window is resolved in this order:
models.providers.*.models[].contextWindow
override.
Model definition
contextWindow
(from the model registry).
Default
200000
tokens.
agents.defaults.contextTokens
is set, it is treated as a cap (min) on the resolved window.
Mode
cache-ttl
Pruning only runs if the last Anthropic call is older than
ttl
(default
When it runs: same soft-trim + hard-clear behavior as before.
Soft vs hard pruning
Soft-trim
: only for oversized tool results.
Keeps head + tail, inserts
...
, and appends a note with the original size.
Skips results with image blocks.
Hard-clear
: replaces the entire tool result with
hardClear.placeholder
Tool selection
tools.allow
tools.deny
support
wildcards.
Deny wins.
Matching is case-insensitive.
Empty allow list => all tools allowed.
Interaction with other limits
Built-in tools already truncate their own output; session pruning is an extra layer that prevents long-running chats from accumulating too much tool output in the model context.
Compaction is separate: compaction summarizes and persists, pruning is transient per request. See
/concepts/compaction
Defaults (when enabled)
ttl
"5m"
keepLastAssistants
softTrimRatio
0.3
hardClearRatio
0.5
minPrunableToolChars
50000
softTrim
{ maxChars: 4000, headChars: 1500, tailChars: 1500 }
hardClear
{ enabled: true, placeholder: "[Old tool result content cleared]" }
Examples
Default (off):
agent
contextPruning
mode
"off"
Enable TTL-aware pruning:
agent
contextPruning
mode
"cache-ttl"
ttl
"5m"
Restrict pruning to specific tools:
agent
contextPruning
mode
"cache-ttl"
tools
allow
"exec"
"read"
deny
"*image*"
] }
See config reference:
Gateway Configuration
Sessions
Session Tools

---
## Concepts > Session Tool

[Source: https://docs.openclaw.ai/concepts/session-tool]

Goal: small, hard-to-misuse tool set so agents can list sessions, fetch history, and send to another session.
Tool Names
sessions_list
sessions_history
sessions_send
sessions_spawn
Key Model
Main direct chat bucket is always the literal key
"main"
(resolved to the current agent’s main key).
Group chats use
agent:<agentId>:<channel>:group:<id>
agent:<agentId>:<channel>:channel:<id>
(pass the full key).
Cron jobs use
cron:<job.id>
Hooks use
hook:<uuid>
unless explicitly set.
Node sessions use
node-<nodeId>
unless explicitly set.
global
and
unknown
are reserved values and are never listed. If
session.scope = "global"
, we alias it to
main
for all tools so callers never see
global
sessions_list
List sessions as an array of rows.
Parameters:
kinds?: string[]
filter: any of
"main" | "group" | "cron" | "hook" | "node" | "other"
limit?: number
max rows (default: server default, clamp e.g. 200)
activeMinutes?: number
only sessions updated within N minutes
messageLimit?: number
0 = no messages (default 0); >0 = include last N messages
Behavior:
messageLimit > 0
fetches
chat.history
per session and includes the last N messages.
Tool results are filtered out in list output; use
sessions_history
for tool messages.
When running in a
sandboxed
agent session, session tools default to
spawned-only visibility
(see below).
Row shape (JSON):
key
: session key (string)
kind
main | group | cron | hook | node | other
channel
whatsapp | telegram | discord | signal | imessage | webchat | internal | unknown
displayName
(group display label if available)
updatedAt
(ms)
sessionId
model
contextTokens
totalTokens
thinkingLevel
verboseLevel
systemSent
abortedLastRun
sendPolicy
(session override if set)
lastChannel
lastTo
deliveryContext
(normalized
{ channel, to, accountId }
when available)
transcriptPath
(best-effort path derived from store dir + sessionId)
messages?
(only when
messageLimit > 0
sessions_history
Fetch transcript for one session.
Parameters:
sessionKey
(required; accepts session key or
sessionId
from
sessions_list
limit?: number
max messages (server clamps)
includeTools?: boolean
(default false)
Behavior:
includeTools=false
filters
role: "toolResult"
messages.
Returns messages array in the raw transcript format.
When given a
sessionId
, OpenClaw resolves it to the corresponding session key (missing ids error).
sessions_send
Send a message into another session.
Parameters:
sessionKey
(required; accepts session key or
sessionId
from
sessions_list
message
(required)
timeoutSeconds?: number
(default >0; 0 = fire-and-forget)
Behavior:
timeoutSeconds = 0
: enqueue and return
{ runId, status: "accepted" }
timeoutSeconds > 0
: wait up to N seconds for completion, then return
{ runId, status: "ok", reply }
If wait times out:
{ runId, status: "timeout", error }
. Run continues; call
sessions_history
later.
If the run fails:
{ runId, status: "error", error }
Announce delivery runs after the primary run completes and is best-effort;
status: "ok"
does not guarantee the announce was delivered.
Waits via gateway
agent.wait
(server-side) so reconnects don’t drop the wait.
Agent-to-agent message context is injected for the primary run.
Inter-session messages are persisted with
message.provenance.kind = "inter_session"
so transcript readers can distinguish routed agent instructions from external user input.
After the primary run completes, OpenClaw runs a
reply-back loop
Round 2+ alternates between requester and target agents.
Reply exactly
REPLY_SKIP
to stop the ping‑pong.
Max turns is
session.agentToAgent.maxPingPongTurns
(0–5, default 5).
Once the loop ends, OpenClaw runs the
agent‑to‑agent announce step
(target agent only):
Reply exactly
ANNOUNCE_SKIP
to stay silent.
Any other reply is sent to the target channel.
Announce step includes the original request + round‑1 reply + latest ping‑pong reply.
Channel Field
For groups,
channel
is the channel recorded on the session entry.
For direct chats,
channel
maps from
lastChannel
For cron/hook/node,
channel
internal
If missing,
channel
unknown
Security / Send Policy
Policy-based blocking by channel/chat type (not per session id).
"session"
"sendPolicy"
"rules"
"match"
"channel"
"discord"
"chatType"
"group"
"action"
"deny"
"default"
"allow"
Runtime override (per session entry):
sendPolicy: "allow" | "deny"
(unset = inherit config)
Settable via
sessions.patch
or owner-only
/send on|off|inherit
(standalone message).
Enforcement points:
chat.send
agent
(gateway)
auto-reply delivery logic
sessions_spawn
Spawn a sub-agent run in an isolated session and announce the result back to the requester chat channel.
Parameters:
task
(required)
label?
(optional; used for logs/UI)
agentId?
(optional; spawn under another agent id if allowed)
model?
(optional; overrides the sub-agent model; invalid values error)
runTimeoutSeconds?
(default 0; when set, aborts the sub-agent run after N seconds)
cleanup?
delete|keep
, default
keep
Allowlist:
agents.list[].subagents.allowAgents
: list of agent ids allowed via
agentId
["*"]
to allow any). Default: only the requester agent.
Discovery:
Use
agents_list
to discover which agent ids are allowed for
sessions_spawn
Behavior:
Starts a new
agent:<agentId>:subagent:<uuid>
session with
deliver: false
Sub-agents default to the full tool set
minus session tools
(configurable via
tools.subagents.tools
Sub-agents are not allowed to call
sessions_spawn
(no sub-agent → sub-agent spawning).
Always non-blocking: returns
{ status: "accepted", runId, childSessionKey }
immediately.
After completion, OpenClaw runs a sub-agent
announce step
and posts the result to the requester chat channel.
Reply exactly
ANNOUNCE_SKIP
during the announce step to stay silent.
Announce replies are normalized to
Status
Result
Notes
Status
comes from runtime outcome (not model text).
Sub-agent sessions are auto-archived after
agents.defaults.subagents.archiveAfterMinutes
(default: 60).
Announce replies include a stats line (runtime, tokens, sessionKey/sessionId, transcript path, and optional cost).
Sandbox Session Visibility
Session tools can be scoped to reduce cross-session access.
Default behavior:
tools.sessions.visibility
defaults to
tree
(current session + spawned subagent sessions).
For sandboxed sessions,
agents.defaults.sandbox.sessionToolsVisibility
can hard-clamp visibility.
Config:
tools
sessions
// "self" | "tree" | "agent" | "all"
// default: "tree"
visibility
"tree"
agents
defaults
sandbox
// default: "spawned"
sessionToolsVisibility
"spawned"
// or "all"
Notes:
self
: only the current session key.
tree
: current session + sessions spawned by the current session.
agent
: any session belonging to the current agent id.
all
: any session (cross-agent access still requires
tools.agentToAgent
When a session is sandboxed and
sessionToolsVisibility="spawned"
, OpenClaw clamps visibility to
tree
even if you set
tools.sessions.visibility="all"
Session Pruning
Memory

---
## Concepts > Session

[Source: https://docs.openclaw.ai/concepts/session]

as primary. Direct chats collapse to
agent:<agentId>:<mainKey>
(default
main
), while group/channel chats get their own keys.
session.mainKey
is honored.
Use
session.dmScope
to control how
direct messages
are grouped:
main
(default): all DMs share the main session for continuity.
per-peer
: isolate by sender id across channels.
per-channel-peer
: isolate by channel + sender (recommended for multi-user inboxes).
per-account-channel-peer
: isolate by account + channel + sender (recommended for multi-account inboxes).
Use
session.identityLinks
to map provider-prefixed peer ids to a canonical identity so the same person shares a DM session across channels when using
per-peer
per-channel-peer
, or
per-account-channel-peer
Secure DM mode (recommended for multi-user setups)
Security Warning:
If your agent can receive DMs from
multiple people
, you should strongly consider enabling secure DM mode. Without it, all users share the same conversation context, which can leak private information between users.
Example of the problem with default settings:
Alice (
<SENDER_A>
) messages your agent about a private topic (for example, a medical appointment)
Bob (
<SENDER_B>
) messages your agent asking “What were we talking about?”
Because both DMs share the same session, the model may answer Bob using Alice’s prior context.
The fix:
Set
dmScope
to isolate sessions per user:
// ~/.openclaw/openclaw.json
session
// Secure DM mode: isolate DM context per channel + sender.
dmScope
"per-channel-peer"
When to enable this:
You have pairing approvals for more than one sender
You use a DM allowlist with multiple entries
You set
dmPolicy: "open"
Multiple phone numbers or accounts can message your agent
Notes:
Default is
dmScope: "main"
for continuity (all DMs share the main session). This is fine for single-user setups.
For multi-account inboxes on the same channel, prefer
per-account-channel-peer
If the same person contacts you on multiple channels, use
session.identityLinks
to collapse their DM sessions into one canonical identity.
You can verify your DM settings with
openclaw security audit
(see
security
Gateway is the source of truth
All session state is
owned by the gateway
(the “master” OpenClaw). UI clients (macOS app, WebChat, etc.) must query the gateway for session lists and token counts instead of reading local files.
remote mode
, the session store you care about lives on the remote gateway host, not your Mac.
Token counts shown in UIs come from the gateway’s store fields (
inputTokens
outputTokens
totalTokens
contextTokens
). Clients do not parse JSONL transcripts to “fix up” totals.
Where state lives
On the
gateway host
Store file:
~/.openclaw/agents/<agentId>/sessions/sessions.json
(per agent).
Transcripts:
~/.openclaw/agents/<agentId>/sessions/<SessionId>.jsonl
(Telegram topic sessions use
.../<SessionId>-topic-<threadId>.jsonl
The store is a map
sessionKey -> { sessionId, updatedAt, ... }
. Deleting entries is safe; they are recreated on demand.
Group entries may include
displayName
channel
subject
room
, and
space
to label sessions in UIs.
Session entries include
origin
metadata (label + routing hints) so UIs can explain where a session came from.
OpenClaw does
not
read legacy Pi/Tau session folders.
Session pruning
OpenClaw trims
old tool results
from the in-memory context right before LLM calls by default.
This does
not
rewrite JSONL history. See
/concepts/session-pruning
Pre-compaction memory flush
When a session nears auto-compaction, OpenClaw can run a
silent memory flush
turn that reminds the model to write durable notes to disk. This only runs when
the workspace is writable. See
Memory
and
Compaction
Mapping transports → session keys
Direct chats follow
session.dmScope
(default
main
main
agent:<agentId>:<mainKey>
(continuity across devices/channels).
Multiple phone numbers and channels can map to the same agent main key; they act as transports into one conversation.
per-peer
agent:<agentId>:dm:<peerId>
per-channel-peer
agent:<agentId>:<channel>:dm:<peerId>
per-account-channel-peer
agent:<agentId>:<channel>:<accountId>:dm:<peerId>
(accountId defaults to
default
session.identityLinks
matches a provider-prefixed peer id (for example
telegram:123
), the canonical key replaces
<peerId>
so the same person shares a session across channels.
Group chats isolate state:
agent:<agentId>:<channel>:group:<id>
(rooms/channels use
agent:<agentId>:<channel>:channel:<id>
Telegram forum topics append
:topic:<threadId>
to the group id for isolation.
Legacy
group:<id>
keys are still recognized for migration.
Inbound contexts may still use
group:<id>
; the channel is inferred from
Provider
and normalized to the canonical
agent:<agentId>:<channel>:group:<id>
form.
Other sources:
Cron jobs:
cron:<job.id>
Webhooks:
hook:<uuid>
(unless explicitly set by the hook)
Node runs:
node-<nodeId>
Lifecycle
Reset policy: sessions are reused until they expire, and expiry is evaluated on the next inbound message.
Daily reset: defaults to
4:00 AM local time on the gateway host
. A session is stale once its last update is earlier than the most recent daily reset time.
Idle reset (optional):
idleMinutes
adds a sliding idle window. When both daily and idle resets are configured,
whichever expires first
forces a new session.
Legacy idle-only: if you set
session.idleMinutes
without any
session.reset
resetByType
config, OpenClaw stays in idle-only mode for backward compatibility.
Per-type overrides (optional):
resetByType
lets you override the policy for
direct
group
, and
thread
sessions (thread = Slack/Discord threads, Telegram topics, Matrix threads when provided by the connector).
Per-channel overrides (optional):
resetByChannel
overrides the reset policy for a channel (applies to all session types for that channel and takes precedence over
reset
resetByType
Reset triggers: exact
/new
/reset
(plus any extras in
resetTriggers
) start a fresh session id and pass the remainder of the message through.
/new <model>
accepts a model alias,
provider/model
, or provider name (fuzzy match) to set the new session model. If
/new
/reset
is sent alone, OpenClaw runs a short “hello” greeting turn to confirm the reset.
Manual reset: delete specific keys from the store or remove the JSONL transcript; the next message recreates them.
Isolated cron jobs always mint a fresh
sessionId
per run (no idle reuse).
Send policy (optional)
Block delivery for specific session types without listing individual ids.
session
sendPolicy
rules
action
"deny"
match
channel
"discord"
chatType
"group"
} }
action
"deny"
match
keyPrefix
"cron:"
} }
// Match the raw session key (including the `agent:<id>:` prefix).
action
"deny"
match
rawKeyPrefix
"agent:main:discord:"
} }
default
"allow"
Runtime override (owner only):
/send on
→ allow for this session
/send off
→ deny for this session
/send inherit
→ clear override and use config rules
Send these as standalone messages so they register.
Configuration (optional rename example)
// ~/.openclaw/openclaw.json
session
scope
"per-sender"
// keep group keys separate
dmScope
"main"
// DM continuity (set per-channel-peer/per-account-channel-peer for shared inboxes)
identityLinks
alice
"telegram:123456789"
"discord:987654321012345678"
reset
// Defaults: mode=daily, atHour=4 (gateway host local time).
// If you also set idleMinutes, whichever expires first wins.
mode
"daily"
atHour
idleMinutes
120
resetByType
thread
mode
"daily"
atHour
4 }
direct
mode
"idle"
idleMinutes
240 }
group
mode
"idle"
idleMinutes
120 }
resetByChannel
discord
mode
"idle"
idleMinutes
10080 }
resetTriggers
"/new"
"/reset"
store
"~/.openclaw/agents/{agentId}/sessions/sessions.json"
mainKey
"main"
Inspecting
openclaw status
— shows store path and recent sessions.
openclaw sessions --json
— dumps every entry (filter with
--active <minutes>
openclaw gateway call sessions.list --params '{}'
— fetch sessions from the running gateway (use
--url
--token
for remote gateway access).
Send
/status
as a standalone message in chat to see whether the agent is reachable, how much of the session context is used, current thinking/verbose toggles, and when your WhatsApp web creds were last refreshed (helps spot relink needs).
Send
/context list
/context detail
to see what’s in the system prompt and injected workspace files (and the biggest context contributors).
Send
/stop
as a standalone message to abort the current run, clear queued followups for that session, and stop any sub-agent runs spawned from it (the reply includes the stopped count).
Send
/compact
(optional instructions) as a standalone message to summarize older context and free up window space. See
/concepts/compaction
JSONL transcripts can be opened directly to review full turns.
Tips
Keep the primary key dedicated to 1:1 traffic; let groups keep their own keys.
When automating cleanup, delete individual keys instead of the whole store to preserve context elsewhere.
Session origin metadata
Each session entry records where it came from (best-effort) in
origin
label
: human label (resolved from conversation label + group subject/channel)
provider
: normalized channel id (including extensions)
from
: raw routing ids from the inbound envelope
accountId
: provider account id (when multi-account)
threadId
: thread/topic id when the channel supports it
The origin fields are populated for direct messages, channels, and groups. If a
connector only updates delivery routing (for example, to keep a DM main session
fresh), it should still provide inbound context so the session keeps its
explainer metadata. Extensions can do this by sending
ConversationLabel
GroupSubject
GroupChannel
GroupSpace
, and
SenderName
in the inbound
context and calling
recordSessionMetaFromInbound
(or passing the same context
updateLastRoute
Bootstrapping
Sessions

---
## Concepts > Sessions

[Source: https://docs.openclaw.ai/concepts/sessions]

## Concepts > Streaming

[Source: https://docs.openclaw.ai/concepts/streaming]

OpenClaw has two separate “streaming” layers:
Block streaming (channels):
emit completed
blocks
as the assistant writes. These are normal channel messages (not token deltas).
Token-ish streaming (Telegram only):
update a temporary
preview message
with partial text while generating.
There is
no true token-delta streaming
to channel messages today. Telegram preview streaming is the only partial-stream surface.
Block streaming (channel messages)
Block streaming sends assistant output in coarse chunks as it becomes available.
Model output
└─ text_delta/events
├─ (blockStreamingBreak=text_end)
│ └─ chunker emits blocks as buffer grows
└─ (blockStreamingBreak=message_end)
└─ chunker flushes at message_end
└─ channel send (block replies)
Legend:
text_delta/events
: model stream events (may be sparse for non-streaming models).
chunker
EmbeddedBlockChunker
applying min/max bounds + break preference.
channel send
: actual outbound messages (block replies).
Controls:
agents.defaults.blockStreamingDefault
"on"
"off"
(default off).
Channel overrides:
*.blockStreaming
(and per-account variants) to force
"on"
"off"
per channel.
agents.defaults.blockStreamingBreak
"text_end"
"message_end"
agents.defaults.blockStreamingChunk
{ minChars, maxChars, breakPreference? }
agents.defaults.blockStreamingCoalesce
{ minChars?, maxChars?, idleMs? }
(merge streamed blocks before send).
Channel hard cap:
*.textChunkLimit
(e.g.,
channels.whatsapp.textChunkLimit
Channel chunk mode:
*.chunkMode
length
default,
newline
splits on blank lines (paragraph boundaries) before length chunking).
Discord soft cap:
channels.discord.maxLinesPerMessage
(default 17) splits tall replies to avoid UI clipping.
Boundary semantics:
text_end
: stream blocks as soon as chunker emits; flush on each
text_end
message_end
: wait until assistant message finishes, then flush buffered output.
message_end
still uses the chunker if the buffered text exceeds
maxChars
, so it can emit multiple chunks at the end.
Chunking algorithm (low/high bounds)
Block chunking is implemented by
EmbeddedBlockChunker
Low bound:
don’t emit until buffer >=
minChars
(unless forced).
High bound:
prefer splits before
maxChars
; if forced, split at
maxChars
Break preference:
paragraph
newline
sentence
whitespace
→ hard break.
Code fences:
never split inside fences; when forced at
maxChars
, close + reopen the fence to keep Markdown valid.
maxChars
is clamped to the channel
textChunkLimit
, so you can’t exceed per-channel caps.
Coalescing (merge streamed blocks)
When block streaming is enabled, OpenClaw can
merge consecutive block chunks
before sending them out. This reduces “single-line spam” while still providing
progressive output.
Coalescing waits for
idle gaps
idleMs
) before flushing.
Buffers are capped by
maxChars
and will flush if they exceed it.
minChars
prevents tiny fragments from sending until enough text accumulates
(final flush always sends remaining text).
Joiner is derived from
blockStreamingChunk.breakPreference
paragraph
\n\n
newline
sentence
→ space).
Channel overrides are available via
*.blockStreamingCoalesce
(including per-account configs).
Default coalesce
minChars
is bumped to 1500 for Signal/Slack/Discord unless overridden.
Human-like pacing between blocks
When block streaming is enabled, you can add a
randomized pause
between
block replies (after the first block). This makes multi-bubble responses feel
more natural.
Config:
agents.defaults.humanDelay
(override per agent via
agents.list[].humanDelay
Modes:
off
(default),
natural
(800–2500ms),
custom
minMs
maxMs
Applies only to
block replies
, not final replies or tool summaries.
“Stream chunks or everything”
This maps to:
Stream chunks:
blockStreamingDefault: "on"
blockStreamingBreak: "text_end"
(emit as you go). Non-Telegram channels also need
*.blockStreaming: true
Stream everything at end:
blockStreamingBreak: "message_end"
(flush once, possibly multiple chunks if very long).
No block streaming:
blockStreamingDefault: "off"
(only final reply).
Channel note:
For non-Telegram channels, block streaming is
off unless
*.blockStreaming
is explicitly set to
true
. Telegram can stream a live preview
channels.telegram.streamMode
) without block replies.
Config location reminder: the
blockStreaming*
defaults live under
agents.defaults
, not the root config.
Telegram preview streaming (token-ish)
Telegram is the only channel with live preview streaming:
Uses Bot API
sendMessage
(first update) +
editMessageText
(subsequent updates).
channels.telegram.streamMode: "partial" | "block" | "off"
partial
: preview updates with latest stream text.
block
: preview updates in chunked blocks (same chunker rules).
off
: no preview streaming.
Preview chunk config (only for
streamMode: "block"
channels.telegram.draftChunk
(defaults:
minChars: 200
maxChars: 800
Preview streaming is separate from block streaming.
When Telegram block streaming is explicitly enabled, preview streaming is skipped to avoid double-streaming.
Text-only finals are applied by editing the preview message in place.
Non-text/complex finals fall back to normal final message delivery.
/reasoning stream
writes reasoning into the live preview (Telegram only).
Telegram
└─ sendMessage (temporary preview message)
├─ streamMode=partial → edit latest text
└─ streamMode=block → chunker + edit updates
└─ final text-only reply → final edit on same message
└─ fallback: cleanup preview + normal final delivery (media/complex)
Legend:
preview message
: temporary Telegram message updated during generation.
final edit
: in-place edit on the same preview message (text-only).
Messages
Retry Policy

---
## Concepts > System Prompt

[Source: https://docs.openclaw.ai/concepts/system-prompt]

OpenClaw builds a custom system prompt for every agent run. The prompt is
OpenClaw-owned
and does not use the pi-coding-agent default prompt.
The prompt is assembled by OpenClaw and injected into each agent run.
Structure
The prompt is intentionally compact and uses fixed sections:
Tooling
: current tool list + short descriptions.
Safety
: short guardrail reminder to avoid power-seeking behavior or bypassing oversight.
Skills
(when available): tells the model how to load skill instructions on demand.
OpenClaw Self-Update
: how to run
config.apply
and
update.run
Workspace
: working directory (
agents.defaults.workspace
Documentation
: local path to OpenClaw docs (repo or npm package) and when to read them.
Workspace Files (injected)
: indicates bootstrap files are included below.
Sandbox
(when enabled): indicates sandboxed runtime, sandbox paths, and whether elevated exec is available.
Current Date & Time
: user-local time, timezone, and time format.
Reply Tags
: optional reply tag syntax for supported providers.
Heartbeats
: heartbeat prompt and ack behavior.
Runtime
: host, OS, node, model, repo root (when detected), thinking level (one line).
Reasoning
: current visibility level + /reasoning toggle hint.
Safety guardrails in the system prompt are advisory. They guide model behavior but do not enforce policy. Use tool policy, exec approvals, sandboxing, and channel allowlists for hard enforcement; operators can disable these by design.
Prompt modes
OpenClaw can render smaller system prompts for sub-agents. The runtime sets a
promptMode
for each run (not a user-facing config):
full
(default): includes all sections above.
minimal
: used for sub-agents; omits
Skills
Memory Recall
OpenClaw
Self-Update
Model Aliases
User Identity
Reply Tags
Messaging
Silent Replies
, and
Heartbeats
. Tooling,
Safety
Workspace, Sandbox, Current Date & Time (when known), Runtime, and injected
context stay available.
none
: returns only the base identity line.
When
promptMode=minimal
, extra injected prompts are labeled
Subagent
Context
instead of
Group Chat Context
Workspace bootstrap injection
Bootstrap files are trimmed and appended under
Project Context
so the model sees identity and profile context without needing explicit reads:
AGENTS.md
SOUL.md
TOOLS.md
IDENTITY.md
USER.md
HEARTBEAT.md
BOOTSTRAP.md
(only on brand-new workspaces)
MEMORY.md
and/or
memory.md
(when present in the workspace; either or both may be injected)
All of these files are
injected into the context window
on every turn, which
means they consume tokens. Keep them concise — especially
MEMORY.md
, which can
grow over time and lead to unexpectedly high context usage and more frequent
compaction.
Note:
memory/*.md
daily files are
not
injected automatically. They
are accessed on demand via the
memory_search
and
memory_get
tools, so they
do not count against the context window unless the model explicitly reads them.
Large files are truncated with a marker. The max per-file size is controlled by
agents.defaults.bootstrapMaxChars
(default: 20000). Total injected bootstrap
content across files is capped by
agents.defaults.bootstrapTotalMaxChars
(default: 24000). Missing files inject a short missing-file marker.
Sub-agent sessions only inject
AGENTS.md
and
TOOLS.md
(other bootstrap files
are filtered out to keep the sub-agent context small).
Internal hooks can intercept this step via
agent:bootstrap
to mutate or replace
the injected bootstrap files (for example swapping
SOUL.md
for an alternate persona).
To inspect how much each injected file contributes (raw vs injected, truncation, plus tool schema overhead), use
/context list
/context detail
. See
Context
Time handling
The system prompt includes a dedicated
Current Date & Time
section when the
user timezone is known. To keep the prompt cache-stable, it now only includes
the
time zone
(no dynamic clock or time format).
Use
session_status
when the agent needs the current time; the status card
includes a timestamp line.
Configure with:
agents.defaults.userTimezone
agents.defaults.timeFormat
auto
See
Date & Time
for full behavior details.
Skills
When eligible skills exist, OpenClaw injects a compact
available skills list
formatSkillsForPrompt
) that includes the
file path
for each skill. The
prompt instructs the model to use
read
to load the SKILL.md at the listed
location (workspace, managed, or bundled). If no skills are eligible, the
Skills section is omitted.
<available_skills>
<skill>
<name>...</name>
<description>...</description>
<location>...</location>
</skill>
</available_skills>
This keeps the base prompt small while still enabling targeted skill usage.
Documentation
When available, the system prompt includes a
Documentation
section that points to the
local OpenClaw docs directory (either
docs/
in the repo workspace or the bundled npm
package docs) and also notes the public mirror, source repo, community Discord, and
ClawHub (
https://clawhub.com
) for skills discovery. The prompt instructs the model to consult local docs first
for OpenClaw behavior, commands, configuration, or architecture, and to run
openclaw status
itself when possible (asking the user only when it lacks access).
Agent Loop
Context

---
## Concepts > Timezone

[Source: https://docs.openclaw.ai/concepts/timezone]

Inbound messages are wrapped in an envelope like:
[Provider ... 2026-01-05 16:26 PST] message text
The timestamp in the envelope is
host-local by default
, with minutes precision.
You can override this with:
agents
defaults
envelopeTimezone
"local"
// "utc" | "local" | "user" | IANA timezone
envelopeTimestamp
"on"
// "on" | "off"
envelopeElapsed
"on"
// "on" | "off"
envelopeTimezone: "utc"
uses UTC.
envelopeTimezone: "user"
uses
agents.defaults.userTimezone
(falls back to host timezone).
Use an explicit IANA timezone (e.g.,
"Europe/Vienna"
) for a fixed offset.
envelopeTimestamp: "off"
removes absolute timestamps from envelope headers.
envelopeElapsed: "off"
removes elapsed time suffixes (the
+2m
style).
Examples
Local (default):
[Signal Alice +1555 2026-01-18 00:19 PST] hello
Fixed timezone:
[Signal Alice +1555 2026-01-18 06:19 GMT+1] hello
Elapsed time:
[Signal Alice +1555 +2m 2026-01-18T05:19Z] follow-up
Tool payloads (raw provider data + normalized fields)
Tool calls (
channels.discord.readMessages
channels.slack.readMessages
, etc.) return
raw provider timestamps
We also attach normalized fields for consistency:
timestampMs
(UTC epoch milliseconds)
timestampUtc
(ISO 8601 UTC string)
Raw provider fields are preserved.
User timezone for the system prompt
Set
agents.defaults.userTimezone
to tell the model the user’s local time zone. If it is
unset, OpenClaw resolves the
host timezone at runtime
(no config write).
agents
defaults
userTimezone
"America/Chicago"
} }
The system prompt includes:
Current Date & Time
section with local time and timezone
Time format: 12-hour
24-hour
You can control the prompt format with
agents.defaults.timeFormat
auto
See
Date & Time
for the full behavior and examples.
Usage Tracking
Credits

---
## Concepts > Typebox

[Source: https://docs.openclaw.ai/concepts/typebox]

TypeBox is a TypeScript-first schema library. We use it to define the
Gateway
WebSocket protocol
(handshake, request/response, server events). Those schemas
drive
runtime validation
JSON Schema export
, and
Swift codegen
for
the macOS app. One source of truth; everything else is generated.
If you want the higher-level protocol context, start with
Gateway architecture
Mental model (30 seconds)
Every Gateway WS message is one of three frames:
Request
{ type: "req", id, method, params }
Response
{ type: "res", id, ok, payload | error }
Event
{ type: "event", event, payload, seq?, stateVersion? }
The first frame
must
be a
connect
request. After that, clients can call
methods (e.g.
health
send
chat.send
) and subscribe to events (e.g.
presence
tick
agent
Connection flow (minimal):
Client Gateway
|---- req:connect -------->|
|<---- res:hello-ok --------|
|<---- event:tick ----------|
|---- req:health ---------->|
|<---- res:health ----------|
Common methods + events:
Category
Examples
Notes
Core
connect
health
status
connect
must be first
Messaging
send
poll
agent
agent.wait
side-effects need
idempotencyKey
Chat
chat.history
chat.send
chat.abort
chat.inject
WebChat uses these
Sessions
sessions.list
sessions.patch
sessions.delete
session admin
Nodes
node.list
node.invoke
node.pair.*
Gateway WS + node actions
Events
tick
presence
agent
chat
health
shutdown
server push
Authoritative list lives in
src/gateway/server.ts
METHODS
EVENTS
Where the schemas live
Source:
src/gateway/protocol/schema.ts
Runtime validators (AJV):
src/gateway/protocol/index.ts
Server handshake + method dispatch:
src/gateway/server.ts
Node client:
src/gateway/client.ts
Generated JSON Schema:
dist/protocol.schema.json
Generated Swift models:
apps/macos/Sources/OpenClawProtocol/GatewayModels.swift
Current pipeline
pnpm protocol:gen
writes JSON Schema (draft‑07) to
dist/protocol.schema.json
pnpm protocol:gen:swift
generates Swift gateway models
pnpm protocol:check
runs both generators and verifies the output is committed
How the schemas are used at runtime
Server side
: every inbound frame is validated with AJV. The handshake only
accepts a
connect
request whose params match
ConnectParams
Client side
: the JS client validates event and response frames before
using them.
Method surface
: the Gateway advertises the supported
methods
and
events
hello-ok
Example frames
Connect (first message):
"type"
"req"
"id"
"c1"
"method"
"connect"
"params"
"minProtocol"
"maxProtocol"
"client"
"id"
"openclaw-macos"
"displayName"
"macos"
"version"
"1.0.0"
"platform"
"macos 15.1"
"mode"
"ui"
"instanceId"
"A1B2"
Hello-ok response:
"type"
"res"
"id"
"c1"
"ok"
true
"payload"
"type"
"hello-ok"
"protocol"
"server"
"version"
"dev"
"connId"
"ws-1"
"features"
"methods"
"health"
"events"
"tick"
] }
"snapshot"
"presence"
"health"
"stateVersion"
"presence"
"health"
"uptimeMs"
"policy"
"maxPayload"
1048576
"maxBufferedBytes"
1048576
"tickIntervalMs"
30000
Request + response:
"type"
"req"
"id"
"r1"
"method"
"health"
"type"
"res"
"id"
"r1"
"ok"
true
"payload"
"ok"
true
} }
Event:
"type"
"event"
"event"
"tick"
"payload"
"ts"
1730000000
"seq"
Minimal client (Node.js)
Smallest useful flow: connect + health.
import
{ WebSocket }
from
"ws"
const
new
WebSocket
"ws://127.0.0.1:18789"
.on
"open"
=>
.send
JSON
.stringify
type
"req"
"c1"
method
"connect"
params
minProtocol
maxProtocol
client
"cli"
displayName
"example"
version
"dev"
platform
"node"
mode
"cli"
});
.on
"message"
(data)
=>
const
msg
JSON
.parse
String
(data));
msg
.type
===
"res"
&&
msg
.id
===
"c1"
&&
msg
.ok) {
.send
JSON
.stringify
({ type
"req"
"h1"
method
"health"
}));
msg
.type
===
"res"
&&
msg
.id
===
"h1"
) {
console
.log
"health:"
msg
.payload);
.close
();
});
Worked example: add a method end‑to‑end
Example: add a new
system.echo
request that returns
{ ok: true, text }
Schema (source of truth)
Add to
src/gateway/protocol/schema.ts
export
const
SystemEchoParamsSchema
Type
.Object
{ text
NonEmptyString }
{ additionalProperties
false
export
const
SystemEchoResultSchema
Type
.Object
{ ok
Type
.Boolean
text
NonEmptyString }
{ additionalProperties
false
Add both to
ProtocolSchemas
and export types:
SystemEchoParams
SystemEchoParamsSchema
SystemEchoResult
SystemEchoResultSchema
export
type
SystemEchoParams
Static
<
typeof
SystemEchoParamsSchema>;
export
type
SystemEchoResult
Static
<
typeof
SystemEchoResultSchema>;
Validation
src/gateway/protocol/index.ts
, export an AJV validator:
export
const
validateSystemEchoParams
ajv
.compile
<
SystemEchoParams
>(SystemEchoParamsSchema);
Server behavior
Add a handler in
src/gateway/server-methods/system.ts
export
const
systemHandlers
GatewayRequestHandlers
"system.echo"
({ params
respond })
=>
const
text
String
params
.text
""
respond
true
{ ok
true
text });
Register it in
src/gateway/server-methods.ts
(already merges
systemHandlers
then add
"system.echo"
METHODS
src/gateway/server.ts
Regenerate
pnpm
protocol:check
Tests + docs
Add a server test in
src/gateway/server.*.test.ts
and note the method in docs.
Swift codegen behavior
The Swift generator emits:
GatewayFrame
enum with
req
res
event
, and
unknown
cases
Strongly typed payload structs/enums
ErrorCode
values and
GATEWAY_PROTOCOL_VERSION
Unknown frame types are preserved as raw payloads for forward compatibility.
Versioning + compatibility
PROTOCOL_VERSION
lives in
src/gateway/protocol/schema.ts
Clients send
minProtocol
maxProtocol
; the server rejects mismatches.
The Swift models keep unknown frame types to avoid breaking older clients.
Schema patterns and conventions
Most objects use
additionalProperties: false
for strict payloads.
NonEmptyString
is the default for IDs and method/event names.
The top-level
GatewayFrame
uses a
discriminator
type
Methods with side effects usually require an
idempotencyKey
in params
(example:
send
poll
agent
chat.send
Live schema JSON
Generated JSON Schema is in the repo at
dist/protocol.schema.json
. The
published raw file is typically available at:
https://raw.githubusercontent.com/openclaw/openclaw/main/dist/protocol.schema.json
When you change schemas
Update the TypeBox schemas.
Run
pnpm protocol:check
Commit the regenerated schema + Swift models.
grammY
Markdown Formatting

---
## Concepts > Typing Indicators

[Source: https://docs.openclaw.ai/concepts/typing-indicators]

Typing indicators are sent to the chat channel while a run is active. Use
agents.defaults.typingMode
to control
when
typing starts and
typingIntervalSeconds
to control
how often
it refreshes.
Defaults
When
agents.defaults.typingMode
unset
, OpenClaw keeps the legacy behavior:
Direct chats
: typing starts immediately once the model loop begins.
Group chats with a mention
: typing starts immediately.
Group chats without a mention
: typing starts only when message text begins streaming.
Heartbeat runs
: typing is disabled.
Modes
Set
agents.defaults.typingMode
to one of:
never
— no typing indicator, ever.
instant
— start typing
as soon as the model loop begins
, even if the run
later returns only the silent reply token.
thinking
— start typing on the
first reasoning delta
(requires
reasoningLevel: "stream"
for the run).
message
— start typing on the
first non-silent text delta
(ignores
the
NO_REPLY
silent token).
Order of “how early it fires”:
never
message
thinking
instant
Configuration
agent
typingMode
"thinking"
typingIntervalSeconds
You can override mode or cadence per session:
session
typingMode
"message"
typingIntervalSeconds
Notes
message
mode won’t show typing for silent-only replies (e.g. the
NO_REPLY
token used to suppress output).
thinking
only fires if the run streams reasoning (
reasoningLevel: "stream"
If the model doesn’t emit reasoning deltas, typing won’t start.
Heartbeats never show typing, regardless of mode.
typingIntervalSeconds
controls the
refresh cadence
, not the start time.
The default is 6 seconds.
Markdown Formatting
Usage Tracking

---
## Concepts > Usage Tracking

[Source: https://docs.openclaw.ai/concepts/usage-tracking]

Usage tracking
What it is
Pulls provider usage/quota directly from their usage endpoints.
No estimated costs; only the provider-reported windows.
Where it shows up
/status
in chats: emoji‑rich status card with session tokens + estimated cost (API key only). Provider usage shows for the
current model provider
when available.
/usage off|tokens|full
in chats: per-response usage footer (OAuth shows tokens only).
/usage cost
in chats: local cost summary aggregated from OpenClaw session logs.
CLI:
openclaw status --usage
prints a full per-provider breakdown.
CLI:
openclaw channels list
prints the same usage snapshot alongside provider config (use
--no-usage
to skip).
macOS menu bar: “Usage” section under Context (only if available).
Providers + credentials
Anthropic (Claude)
: OAuth tokens in auth profiles.
GitHub Copilot
: OAuth tokens in auth profiles.
Gemini CLI
: OAuth tokens in auth profiles.
Antigravity
: OAuth tokens in auth profiles.
OpenAI Codex
: OAuth tokens in auth profiles (accountId used when present).
MiniMax
: API key (coding plan key;
MINIMAX_CODE_PLAN_KEY
MINIMAX_API_KEY
); uses the 5‑hour coding plan window.
z.ai
: API key via env/config/auth store.
Usage is hidden if no matching OAuth/API credentials exist.
Typing Indicators
Timezones
