# OpenClaw Gateway & Operations Reference

Configuration, security, sandboxing, protocols, networking, remote access, web interfaces.

---
## Gateway > Authentication

[Source: https://docs.openclaw.ai/gateway/authentication]

OpenClaw supports OAuth and API keys for model providers. For Anthropic
accounts, we recommend using an
API key
. For Claude subscription access,
use the long‑lived token created by
claude setup-token
See
/concepts/oauth
for the full OAuth flow and storage
layout.
Recommended Anthropic setup (API key)
If you’re using Anthropic directly, use an API key.
Create an API key in the Anthropic Console.
Put it on the
gateway host
(the machine running
openclaw gateway
export
ANTHROPIC_API_KEY
"..."
openclaw
models
status
If the Gateway runs under systemd/launchd, prefer putting the key in
~/.openclaw/.env
so the daemon can read it:
cat
>>
~/.openclaw/.env
<<
'EOF'
ANTHROPIC_API_KEY=...
EOF
Then restart the daemon (or restart your Gateway process) and re-check:
openclaw
models
status
openclaw
doctor
If you’d rather not manage env vars yourself, the onboarding wizard can store
API keys for daemon use:
openclaw onboard
See
Help
for details on env inheritance (
env.shellEnv
~/.openclaw/.env
, systemd/launchd).
Anthropic: setup-token (subscription auth)
For Anthropic, the recommended path is an
API key
. If you’re using a Claude
subscription, the setup-token flow is also supported. Run it on the
gateway host
claude
setup-token
Then paste it into OpenClaw:
openclaw
models
auth
setup-token
--provider
anthropic
If the token was created on another machine, paste it manually:
openclaw
models
auth
paste-token
--provider
anthropic
If you see an Anthropic error like:
This credential is only authorized for use with Claude Code and cannot be used for other API requests.
…use an Anthropic API key instead.
Manual token entry (any provider; writes
auth-profiles.json
+ updates config):
openclaw
models
auth
paste-token
--provider
anthropic
openclaw
models
auth
paste-token
--provider
openrouter
Automation-friendly check (exit
when expired/missing,
when expiring):
openclaw
models
status
--check
Optional ops scripts (systemd/Termux) are documented here:
/automation/auth-monitoring
claude setup-token
requires an interactive TTY.
Checking model auth status
openclaw
models
status
openclaw
doctor
Controlling which credential is used
Per-session (chat command)
Use
/model <alias-or-id>@<profileId>
to pin a specific provider credential for the current session (example profile ids:
anthropic:default
anthropic:work
Use
/model
(or
/model list
) for a compact picker; use
/model status
for the full view (candidates + next auth profile, plus provider endpoint details when configured).
Per-agent (CLI override)
Set an explicit auth profile order override for an agent (stored in that agent’s
auth-profiles.json
openclaw
models
auth
order
get
--provider
anthropic
openclaw
models
auth
order
set
--provider
anthropic
anthropic:default
openclaw
models
auth
order
clear
--provider
anthropic
Use
--agent <id>
to target a specific agent; omit it to use the configured default agent.
Troubleshooting
“No credentials found”
If the Anthropic token profile is missing, run
claude setup-token
on the
gateway host
, then re-check:
openclaw
models
status
Token expiring/expired
Run
openclaw models status
to confirm which profile is expiring. If the profile
is missing, rerun
claude setup-token
and paste the token again.
Requirements
Claude Max or Pro subscription (for
claude setup-token
Claude Code CLI installed (
claude
command available)
Configuration Examples
Trusted proxy auth

---
## Gateway > Background Process

[Source: https://docs.openclaw.ai/gateway/background-process]

tool and keeps long‑running tasks in memory. The
process
tool manages those background sessions.
exec tool
Key parameters:
command
(required)
yieldMs
(default 10000): auto‑background after this delay
background
(bool): background immediately
timeout
(seconds, default 1800): kill the process after this timeout
elevated
(bool): run on host if elevated mode is enabled/allowed
Need a real TTY? Set
pty: true
workdir
env
Behavior:
Foreground runs return output directly.
When backgrounded (explicit or timeout), the tool returns
status: "running"
sessionId
and a short tail.
Output is kept in memory until the session is polled or cleared.
If the
process
tool is disallowed,
exec
runs synchronously and ignores
yieldMs
background
Child process bridging
When spawning long-running child processes outside the exec/process tools (for example, CLI respawns or gateway helpers), attach the child-process bridge helper so termination signals are forwarded and listeners are detached on exit/error. This avoids orphaned processes on systemd and keeps shutdown behavior consistent across platforms.
Environment overrides:
PI_BASH_YIELD_MS
: default yield (ms)
PI_BASH_MAX_OUTPUT_CHARS
: in‑memory output cap (chars)
OPENCLAW_BASH_PENDING_MAX_OUTPUT_CHARS
: pending stdout/stderr cap per stream (chars)
PI_BASH_JOB_TTL_MS
: TTL for finished sessions (ms, bounded to 1m–3h)
Config (preferred):
tools.exec.backgroundMs
(default 10000)
tools.exec.timeoutSec
(default 1800)
tools.exec.cleanupMs
(default 1800000)
tools.exec.notifyOnExit
(default true): enqueue a system event + request heartbeat when a backgrounded exec exits.
tools.exec.notifyOnExitEmptySuccess
(default false): when true, also enqueue completion events for successful backgrounded runs that produced no output.
process tool
Actions:
list
: running + finished sessions
poll
: drain new output for a session (also reports exit status)
log
: read the aggregated output (supports
offset
limit
write
: send stdin (
data
, optional
eof
kill
: terminate a background session
clear
: remove a finished session from memory
remove
: kill if running, otherwise clear if finished
Notes:
Only backgrounded sessions are listed/persisted in memory.
Sessions are lost on process restart (no disk persistence).
Session logs are only saved to chat history if you run
process poll/log
and the tool result is recorded.
process
is scoped per agent; it only sees sessions started by that agent.
process list
includes a derived
name
(command verb + target) for quick scans.
process log
uses line-based
offset
limit
When both
offset
and
limit
are omitted, it returns the last 200 lines and includes a paging hint.
When
offset
is provided and
limit
is omitted, it returns from
offset
to the end (not capped to 200).
Examples
Run a long task and poll later:
"tool"
"exec"
"command"
"sleep 5 && echo done"
"yieldMs"
1000
"tool"
"process"
"action"
"poll"
"sessionId"
"<id>"
Start immediately in background:
"tool"
"exec"
"command"
"npm run build"
"background"
true
Send stdin:
"tool"
"process"
"action"
"write"
"sessionId"
"<id>"
"data"
"y\n"
Gateway Lock
Multiple Gateways

---
## Gateway > Bonjour

[Source: https://docs.openclaw.ai/gateway/bonjour]

an active Gateway (WebSocket endpoint). It is best‑effort and does
not
replace SSH or
Tailnet-based connectivity.
Wide‑area Bonjour (Unicast DNS‑SD) over Tailscale
If the node and gateway are on different networks, multicast mDNS won’t cross the
boundary. You can keep the same discovery UX by switching to
unicast DNS‑SD
(“Wide‑Area Bonjour”) over Tailscale.
High‑level steps:
Run a DNS server on the gateway host (reachable over Tailnet).
Publish DNS‑SD records for
_openclaw-gw._tcp
under a dedicated zone
(example:
openclaw.internal.
Configure Tailscale
split DNS
so your chosen domain resolves via that
DNS server for clients (including iOS).
OpenClaw supports any discovery domain;
openclaw.internal.
is just an example.
iOS/Android nodes browse both
local.
and your configured wide‑area domain.
Gateway config (recommended)
gateway
bind
"tailnet"
// tailnet-only (recommended)
discovery
wideArea
enabled
true
} }
// enables wide-area DNS-SD publishing
One‑time DNS server setup (gateway host)
openclaw
dns
setup
--apply
This installs CoreDNS and configures it to:
listen on port 53 only on the gateway’s Tailscale interfaces
serve your chosen domain (example:
openclaw.internal.
) from
~/.openclaw/dns/<domain>.db
Validate from a tailnet‑connected machine:
dns-sd
_openclaw-gw._tcp
openclaw.internal.
dig
<
TAILNET_IPV
4>
_openclaw-gw._tcp.openclaw.internal
PTR
+short
Tailscale DNS settings
In the Tailscale admin console:
Add a nameserver pointing at the gateway’s tailnet IP (UDP/TCP 53).
Add split DNS so your discovery domain uses that nameserver.
Once clients accept tailnet DNS, iOS nodes can browse
_openclaw-gw._tcp
in your discovery domain without multicast.
Gateway listener security (recommended)
The Gateway WS port (default
18789
) binds to loopback by default. For LAN/tailnet
access, bind explicitly and keep auth enabled.
For tailnet‑only setups:
Set
gateway.bind: "tailnet"
~/.openclaw/openclaw.json
Restart the Gateway (or restart the macOS menubar app).
What advertises
Only the Gateway advertises
_openclaw-gw._tcp
Service types
_openclaw-gw._tcp
— gateway transport beacon (used by macOS/iOS/Android nodes).
TXT keys (non‑secret hints)
The Gateway advertises small non‑secret hints to make UI flows convenient:
role=gateway
displayName=<friendly name>
lanHost=<hostname>.local
gatewayPort=<port>
(Gateway WS + HTTP)
gatewayTls=1
(only when TLS is enabled)
gatewayTlsSha256=<sha256>
(only when TLS is enabled and fingerprint is available)
canvasPort=<port>
(only when the canvas host is enabled; currently the same as
gatewayPort
sshPort=<port>
(defaults to 22 when not overridden)
transport=gateway
cliPath=<path>
(optional; absolute path to a runnable
openclaw
entrypoint)
tailnetDns=<magicdns>
(optional hint when Tailnet is available)
Security notes:
Bonjour/mDNS TXT records are
unauthenticated
. Clients must not treat TXT as authoritative routing.
Clients should route using the resolved service endpoint (SRV + A/AAAA). Treat
lanHost
tailnetDns
gatewayPort
, and
gatewayTlsSha256
as hints only.
TLS pinning must never allow an advertised
gatewayTlsSha256
to override a previously stored pin.
iOS/Android nodes should treat discovery-based direct connects as
TLS-only
and require explicit user confirmation before trusting a first-time fingerprint.
Debugging on macOS
Useful built‑in tools:
Browse instances:
dns-sd
_openclaw-gw._tcp
local.
Resolve one instance (replace
<instance>
dns-sd
"<instance>"
_openclaw-gw._tcp
local.
If browsing works but resolving fails, you’re usually hitting a LAN policy or
mDNS resolver issue.
Debugging in Gateway logs
The Gateway writes a rolling log file (printed on startup as
gateway log file: ...
). Look for
bonjour:
lines, especially:
bonjour: advertise failed ...
bonjour: ... name conflict resolved
hostname conflict resolved
bonjour: watchdog detected non-announced service ...
Debugging on iOS node
The iOS node uses
NWBrowser
to discover
_openclaw-gw._tcp
To capture logs:
Settings → Gateway → Advanced →
Discovery Debug Logs
Settings → Gateway → Advanced →
Discovery Logs
→ reproduce →
The log includes browser state transitions and result‑set changes.
Common failure modes
Bonjour doesn’t cross networks
: use Tailnet or SSH.
Multicast blocked
: some Wi‑Fi networks disable mDNS.
Sleep / interface churn
: macOS may temporarily drop mDNS results; retry.
Browse works but resolve fails
: keep machine names simple (avoid emojis or
punctuation), then restart the Gateway. The service instance name derives from
the host name, so overly complex names can confuse some resolvers.
Escaped instance names (
\032
Bonjour/DNS‑SD often escapes bytes in service instance names as decimal
\DDD
sequences (e.g. spaces become
\032
This is normal at the protocol level.
UIs should decode for display (iOS uses
BonjourEscapes.decode
Disabling / configuration
OPENCLAW_DISABLE_BONJOUR=1
disables advertising (legacy:
OPENCLAW_DISABLE_BONJOUR
gateway.bind
~/.openclaw/openclaw.json
controls the Gateway bind mode.
OPENCLAW_SSH_PORT
overrides the SSH port advertised in TXT (legacy:
OPENCLAW_SSH_PORT
OPENCLAW_TAILNET_DNS
publishes a MagicDNS hint in TXT (legacy:
OPENCLAW_TAILNET_DNS
OPENCLAW_CLI_PATH
overrides the advertised CLI path (legacy:
OPENCLAW_CLI_PATH
Related docs
Discovery policy and transport selection:
Discovery
Node pairing + approvals:
Gateway pairing
Discovery and Transports
Remote Access

---
## Gateway > Bridge Protocol

[Source: https://docs.openclaw.ai/gateway/bridge-protocol]

Bridge Protocol
Bridge protocol (legacy node transport)
The Bridge protocol is a
legacy
node transport (TCP JSONL). New node clients
should use the unified Gateway WebSocket protocol instead.
If you are building an operator or node client, use the
Gateway protocol
Note:
Current OpenClaw builds no longer ship the TCP bridge listener; this document is kept for historical reference.
Legacy
bridge.*
config keys are no longer part of the config schema.
Why we have both
Security boundary
: the bridge exposes a small allowlist instead of the
full gateway API surface.
Pairing + node identity
: node admission is owned by the gateway and tied
to a per-node token.
Discovery UX
: nodes can discover gateways via Bonjour on LAN, or connect
directly over a tailnet.
Loopback WS
: the full WS control plane stays local unless tunneled via SSH.
Transport
TCP, one JSON object per line (JSONL).
Optional TLS (when
bridge.tls.enabled
is true).
Legacy default listener port was
18790
(current builds do not start a TCP bridge).
When TLS is enabled, discovery TXT records include
bridgeTls=1
plus
bridgeTlsSha256
as a non-secret hint. Note that Bonjour/mDNS TXT records are
unauthenticated; clients must not treat the advertised fingerprint as an
authoritative pin without explicit user intent or other out-of-band verification.
Handshake + pairing
Client sends
hello
with node metadata + token (if already paired).
If not paired, gateway replies
error
NOT_PAIRED
UNAUTHORIZED
Client sends
pair-request
Gateway waits for approval, then sends
pair-ok
and
hello-ok
hello-ok
returns
serverName
and may include
canvasHostUrl
Frames
Client → Gateway:
req
res
: scoped gateway RPC (chat, sessions, config, health, voicewake, skills.bins)
event
: node signals (voice transcript, agent request, chat subscribe, exec lifecycle)
Gateway → Client:
invoke
invoke-res
: node commands (
canvas.*
camera.*
screen.record
location.get
sms.send
event
: chat updates for subscribed sessions
ping
pong
: keepalive
Legacy allowlist enforcement lived in
src/gateway/server-bridge.ts
(removed).
Exec lifecycle events
Nodes can emit
exec.finished
exec.denied
events to surface system.run activity.
These are mapped to system events in the gateway. (Legacy nodes may still emit
exec.started
Payload fields (all optional unless noted):
sessionKey
(required): agent session to receive the system event.
runId
: unique exec id for grouping.
command
: raw or formatted command string.
exitCode
timedOut
success
output
: completion details (finished only).
reason
: denial reason (denied only).
Tailnet usage
Bind the bridge to a tailnet IP:
bridge.bind: "tailnet"
~/.openclaw/openclaw.json
Clients connect via MagicDNS name or tailnet IP.
Bonjour does
not
cross networks; use manual host/port or wide-area DNS‑SD
when needed.
Versioning
Bridge is currently
implicit v1
(no min/max negotiation). Backward‑compat
is expected; add a bridge protocol version field before any breaking changes.
Gateway Protocol
OpenAI Chat Completions

---
## Gateway > Cli Backends

[Source: https://docs.openclaw.ai/gateway/cli-backends]

CLI Backends
CLI backends (fallback runtime)
OpenClaw can run
local AI CLIs
as a
text-only fallback
when API providers are down,
rate-limited, or temporarily misbehaving. This is intentionally conservative:
Tools are disabled
(no tool calls).
Text in → text out
(reliable).
Sessions are supported
(so follow-up turns stay coherent).
Images can be passed through
if the CLI accepts image paths.
This is designed as a
safety net
rather than a primary path. Use it when you
want “always works” text responses without relying on external APIs.
Beginner-friendly quick start
You can use Claude Code CLI
without any config
(OpenClaw ships a built-in default):
openclaw
agent
--message
"hi"
--model
claude-cli/opus-4.6
Codex CLI also works out of the box:
openclaw
agent
--message
"hi"
--model
codex-cli/gpt-5.3-codex
If your gateway runs under launchd/systemd and PATH is minimal, add just the
command path:
agents
defaults
cliBackends
"claude-cli"
command
"/opt/homebrew/bin/claude"
That’s it. No keys, no extra auth config needed beyond the CLI itself.
Using it as a fallback
Add a CLI backend to your fallback list so it only runs when primary models fail:
agents
defaults
model
primary
"anthropic/claude-opus-4-6"
fallbacks
"claude-cli/opus-4.6"
"claude-cli/opus-4.5"
models
"anthropic/claude-opus-4-6"
alias
"Opus"
"claude-cli/opus-4.6"
"claude-cli/opus-4.5"
Notes:
If you use
agents.defaults.models
(allowlist), you must include
claude-cli/...
If the primary provider fails (auth, rate limits, timeouts), OpenClaw will
try the CLI backend next.
Configuration overview
All CLI backends live under:
agents.defaults.cliBackends
Each entry is keyed by a
provider id
(e.g.
claude-cli
my-cli
The provider id becomes the left side of your model ref:
<provider>/<model>
Example configuration
agents
defaults
cliBackends
"claude-cli"
command
"/opt/homebrew/bin/claude"
"my-cli"
command
"my-cli"
args
"--json"
output
"json"
input
"arg"
modelArg
"--model"
modelAliases
"claude-opus-4-6"
"opus"
"claude-opus-4-5"
"opus"
"claude-sonnet-4-5"
"sonnet"
sessionArg
"--session"
sessionMode
"existing"
sessionIdFields
"session_id"
"conversation_id"
systemPromptArg
"--system"
systemPromptWhen
"first"
imageArg
"--image"
imageMode
"repeat"
serialize
true
How it works
Selects a backend
based on the provider prefix (
claude-cli/...
Builds a system prompt
using the same OpenClaw prompt + workspace context.
Executes the CLI
with a session id (if supported) so history stays consistent.
Parses output
(JSON or plain text) and returns the final text.
Persists session ids
per backend, so follow-ups reuse the same CLI session.
Sessions
If the CLI supports sessions, set
sessionArg
(e.g.
--session-id
) or
sessionArgs
(placeholder
{sessionId}
) when the ID needs to be inserted
into multiple flags.
If the CLI uses a
resume subcommand
with different flags, set
resumeArgs
(replaces
args
when resuming) and optionally
resumeOutput
(for non-JSON resumes).
sessionMode
always
: always send a session id (new UUID if none stored).
existing
: only send a session id if one was stored before.
none
: never send a session id.
Images (pass-through)
If your CLI accepts image paths, set
imageArg
imageArg:
"--image"
imageMode:
"repeat"
OpenClaw will write base64 images to temp files. If
imageArg
is set, those
paths are passed as CLI args. If
imageArg
is missing, OpenClaw appends the
file paths to the prompt (path injection), which is enough for CLIs that auto-
load local files from plain paths (Claude Code CLI behavior).
Inputs / outputs
output: "json"
(default) tries to parse JSON and extract text + session id.
output: "jsonl"
parses JSONL streams (Codex CLI
--json
) and extracts the
last agent message plus
thread_id
when present.
output: "text"
treats stdout as the final response.
Input modes:
input: "arg"
(default) passes the prompt as the last CLI arg.
input: "stdin"
sends the prompt via stdin.
If the prompt is very long and
maxPromptArgChars
is set, stdin is used.
Defaults (built-in)
OpenClaw ships a default for
claude-cli
command: "claude"
args: ["-p", "--output-format", "json", "--dangerously-skip-permissions"]
resumeArgs: ["-p", "--output-format", "json", "--dangerously-skip-permissions", "--resume", "{sessionId}"]
modelArg: "--model"
systemPromptArg: "--append-system-prompt"
sessionArg: "--session-id"
systemPromptWhen: "first"
sessionMode: "always"
OpenClaw also ships a default for
codex-cli
command: "codex"
args: ["exec","--json","--color","never","--sandbox","read-only","--skip-git-repo-check"]
resumeArgs: ["exec","resume","{sessionId}","--color","never","--sandbox","read-only","--skip-git-repo-check"]
output: "jsonl"
resumeOutput: "text"
modelArg: "--model"
imageArg: "--image"
sessionMode: "existing"
Override only if needed (common: absolute
command
path).
Limitations
No OpenClaw tools
(the CLI backend never receives tool calls). Some CLIs
may still run their own agent tooling.
No streaming
(CLI output is collected then returned).
Structured outputs
depend on the CLI’s JSON format.
Codex CLI sessions
resume via text output (no JSONL), which is less
structured than the initial
--json
run. OpenClaw sessions still work
normally.
Troubleshooting
CLI not found
: set
command
to a full path.
Wrong model name
: use
modelAliases
to map
provider/model
→ CLI model.
No session continuity
: ensure
sessionArg
is set and
sessionMode
is not
none
(Codex CLI currently cannot resume with JSON output).
Images ignored
: set
imageArg
(and verify CLI supports file paths).
Tools Invoke API
Local Models

---
## Gateway > Configuration Examples

[Source: https://docs.openclaw.ai/gateway/configuration-examples]

Examples below are aligned with the current config schema. For the exhaustive reference and per-field notes, see
Configuration
Quick start
Absolute minimum
agent
workspace
"~/.openclaw/workspace"
channels
whatsapp
allowFrom
"+15555550123"
] } }
Save to
~/.openclaw/openclaw.json
and you can DM the bot from that number.
Recommended starter
identity
name
"Clawd"
theme
"helpful assistant"
emoji
"🦞"
agent
workspace
"~/.openclaw/workspace"
model
primary
"anthropic/claude-sonnet-4-5"
channels
whatsapp
allowFrom
"+15555550123"
groups
"*"
requireMention
true
} }
Expanded example (major options)
JSON5 lets you use comments and trailing commas. Regular JSON works too.
// Environment + shell
env
OPENROUTER_API_KEY
"sk-or-..."
vars
GROQ_API_KEY
"gsk-..."
shellEnv
enabled
true
timeoutMs
15000
// Auth profile metadata (secrets live in auth-profiles.json)
auth
profiles
"anthropic:
[email protected]
"
provider
"anthropic"
mode
"oauth"
email
"
[email protected]
"
"anthropic:work"
provider
"anthropic"
mode
"api_key"
"openai:default"
provider
"openai"
mode
"api_key"
"openai-codex:default"
provider
"openai-codex"
mode
"oauth"
order
anthropic
"anthropic:
[email protected]
"
"anthropic:work"
openai
"openai:default"
"openai-codex"
"openai-codex:default"
// Identity
identity
name
"Samantha"
theme
"helpful sloth"
emoji
"🦥"
// Logging
logging
level
"info"
file
"/tmp/openclaw/openclaw.log"
consoleLevel
"info"
consoleStyle
"pretty"
redactSensitive
"tools"
// Message formatting
messages
messagePrefix
"[openclaw]"
responsePrefix
">"
ackReaction
"👀"
ackReactionScope
"group-mentions"
// Routing + queue
routing
groupChat
mentionPatterns
"@openclaw"
"openclaw"
historyLimit
queue
mode
"collect"
debounceMs
1000
cap
drop
"summarize"
byChannel
whatsapp
"collect"
telegram
"collect"
discord
"collect"
slack
"collect"
signal
"collect"
imessage
"collect"
webchat
"collect"
// Tooling
tools
media
audio
enabled
true
maxBytes
20971520
models
provider
"openai"
model
"gpt-4o-mini-transcribe"
// Optional CLI fallback (Whisper binary):
// { type: "cli", command: "whisper", args: ["--model", "base", "{{MediaPath}}"] }
timeoutSeconds
120
video
enabled
true
maxBytes
52428800
models
provider
"google"
model
"gemini-3-flash-preview"
// Session behavior
session
scope
"per-sender"
reset
mode
"daily"
atHour
idleMinutes
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
"~/.openclaw/agents/default/sessions/sessions.json"
maintenance
mode
"warn"
pruneAfter
"30d"
maxEntries
500
rotateBytes
"10mb"
typingIntervalSeconds
sendPolicy
default
"allow"
rules
action
"deny"
match
channel
"discord"
chatType
"group"
} }]
// Channels
channels
whatsapp
dmPolicy
"pairing"
allowFrom
"+15555550123"
groupPolicy
"allowlist"
groupAllowFrom
"+15555550123"
groups
"*"
requireMention
true
} }
telegram
enabled
true
botToken
"YOUR_TELEGRAM_BOT_TOKEN"
allowFrom
"123456789"
groupPolicy
"allowlist"
groupAllowFrom
"123456789"
groups
"*"
requireMention
true
} }
discord
enabled
true
token
"YOUR_DISCORD_BOT_TOKEN"
enabled
true
allowFrom
"steipete"
] }
guilds
"123456789012345678"
slug
"friends-of-openclaw"
requireMention
false
channels
general
allow
true
help
allow
true
requireMention
true
slack
enabled
true
botToken
"xoxb-REPLACE_ME"
appToken
"xapp-REPLACE_ME"
channels
"#general"
allow
true
requireMention
true
enabled
true
allowFrom
"U123"
] }
slashCommand
enabled
true
name
"openclaw"
sessionPrefix
"slack:slash"
ephemeral
true
// Agent runtime
agents
defaults
workspace
"~/.openclaw/workspace"
userTimezone
"America/Chicago"
model
primary
"anthropic/claude-sonnet-4-5"
fallbacks
"anthropic/claude-opus-4-6"
"openai/gpt-5.2"
imageModel
primary
"openrouter/anthropic/claude-sonnet-4-5"
models
"anthropic/claude-opus-4-6"
alias
"opus"
"anthropic/claude-sonnet-4-5"
alias
"sonnet"
"openai/gpt-5.2"
alias
"gpt"
thinkingDefault
"low"
verboseDefault
"off"
elevatedDefault
"on"
blockStreamingDefault
"off"
blockStreamingBreak
"text_end"
blockStreamingChunk
minChars
800
maxChars
1200
breakPreference
"paragraph"
blockStreamingCoalesce
idleMs
1000
humanDelay
mode
"natural"
timeoutSeconds
600
mediaMaxMb
typingIntervalSeconds
maxConcurrent
heartbeat
every
"30m"
model
"anthropic/claude-sonnet-4-5"
target
"last"
"+15555550123"
prompt
"HEARTBEAT"
ackMaxChars
300
memorySearch
provider
"gemini"
model
"gemini-embedding-001"
remote
apiKey
"${GEMINI_API_KEY}"
extraPaths
"../team-docs"
"/srv/shared-notes"
sandbox
mode
"non-main"
perSession
true
workspaceRoot
"~/.openclaw/sandboxes"
docker
image
"openclaw-sandbox:bookworm-slim"
workdir
"/workspace"
readOnlyRoot
true
tmpfs
"/tmp"
"/var/tmp"
"/run"
network
"none"
user
"1000:1000"
browser
enabled
false
tools
allow
"exec"
"process"
"read"
"write"
"edit"
"apply_patch"
deny
"browser"
"canvas"
exec
backgroundMs
10000
timeoutSec
1800
cleanupMs
1800000
elevated
enabled
true
allowFrom
whatsapp
"+15555550123"
telegram
"123456789"
discord
"steipete"
slack
"U123"
signal
"+15555550123"
imessage
"
[email protected]
"
webchat
"session:demo"
// Custom model providers
models
mode
"merge"
providers
"custom-proxy"
baseUrl
"http://localhost:4000/v1"
apiKey
"LITELLM_KEY"
api
"openai-responses"
authHeader
true
headers
"X-Proxy-Region"
"us-west"
models
"llama-3.1-8b"
name
"Llama 3.1 8B"
api
"openai-responses"
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
128000
maxTokens
32000
// Cron jobs
cron
enabled
true
store
"~/.openclaw/cron/cron.json"
maxConcurrentRuns
sessionRetention
"24h"
// Webhooks
hooks
enabled
true
path
"/hooks"
token
"shared-secret"
presets
"gmail"
transformsDir
"~/.openclaw/hooks/transforms"
mappings
"gmail-hook"
match
path
"gmail"
action
"agent"
wakeMode
"now"
name
"Gmail"
sessionKey
"hook:gmail:{{messages[0].id}}"
messageTemplate
"From: {{messages[0].from}}\nSubject: {{messages[0].subject}}"
textTemplate
"{{messages[0].snippet}}"
deliver
true
channel
"last"
"+15555550123"
thinking
"low"
timeoutSeconds
300
transform
module
"gmail.js"
export
"transformGmail"
gmail
account
"
[email protected]
"
label
"INBOX"
topic
"projects/<project-id>/topics/gog-gmail-watch"
subscription
"gog-gmail-watch-push"
pushToken
"shared-push-token"
hookUrl
"http://127.0.0.1:18789/hooks/gmail"
includeBody
true
maxBytes
20000
renewEveryMinutes
720
serve
bind
"127.0.0.1"
port
8788
path
"/"
tailscale
mode
"funnel"
path
"/gmail-pubsub"
// Gateway + networking
gateway
mode
"local"
port
18789
bind
"loopback"
controlUi
enabled
true
basePath
"/openclaw"
auth
mode
"token"
token
"gateway-token"
allowTailscale
true
tailscale
mode
"serve"
resetOnExit
false
remote
url
"ws://gateway.tailnet:18789"
token
"remote-token"
reload
mode
"hybrid"
debounceMs
300 }
skills
allowBundled
"gemini"
"peekaboo"
load
extraDirs
"~/Projects/agent-scripts/skills"
install
preferBrew
true
nodeManager
"npm"
entries
"nano-banana-pro"
enabled
true
apiKey
"GEMINI_KEY_HERE"
env
GEMINI_API_KEY
"GEMINI_KEY_HERE"
peekaboo
enabled
true
Common patterns
Multi-platform setup
agent
workspace
"~/.openclaw/workspace"
channels
whatsapp
allowFrom
"+15555550123"
] }
telegram
enabled
true
botToken
"YOUR_TOKEN"
allowFrom
"123456789"
discord
enabled
true
token
"YOUR_TOKEN"
allowFrom
"yourname"
] }
Secure DM mode (shared inbox / multi-user DMs)
If more than one person can DM your bot (multiple entries in
allowFrom
, pairing approvals for multiple people, or
dmPolicy: "open"
), enable
secure DM mode
so DMs from different senders don’t share one context by default:
// Secure DM mode (recommended for multi-user or sensitive DM agents)
session
dmScope
"per-channel-peer"
channels
// Example: WhatsApp multi-user inbox
whatsapp
dmPolicy
"allowlist"
allowFrom
"+15555550123"
"+15555550124"
// Example: Discord multi-user inbox
discord
enabled
true
token
"YOUR_DISCORD_BOT_TOKEN"
enabled
true
allowFrom
"alice"
"bob"
] }
OAuth with API key failover
auth
profiles
"anthropic:subscription"
provider
"anthropic"
mode
"oauth"
email
"
[email protected]
"
"anthropic:api"
provider
"anthropic"
mode
"api_key"
order
anthropic
"anthropic:subscription"
"anthropic:api"
agent
workspace
"~/.openclaw/workspace"
model
primary
"anthropic/claude-sonnet-4-5"
fallbacks
"anthropic/claude-opus-4-6"
Anthropic subscription + API key, MiniMax fallback
auth
profiles
"anthropic:subscription"
provider
"anthropic"
mode
"oauth"
email
"
[email protected]
"
"anthropic:api"
provider
"anthropic"
mode
"api_key"
order
anthropic
"anthropic:subscription"
"anthropic:api"
models
providers
minimax
baseUrl
"https://api.minimax.io/anthropic"
api
"anthropic-messages"
apiKey
"${MINIMAX_API_KEY}"
agent
workspace
"~/.openclaw/workspace"
model
primary
"anthropic/claude-opus-4-6"
fallbacks
"minimax/MiniMax-M2.1"
Work bot (restricted access)
identity
name
"WorkBot"
theme
"professional assistant"
agent
workspace
"~/work-openclaw"
elevated
enabled
false
channels
slack
enabled
true
botToken
"xoxb-..."
channels
"#engineering"
allow
true
requireMention
true
"#general"
allow
true
requireMention
true
Local models only
agent
workspace
"~/.openclaw/workspace"
model
primary
"lmstudio/minimax-m2.1-gs32"
models
mode
"merge"
providers
lmstudio
baseUrl
"http://127.0.0.1:1234/v1"
apiKey
"lmstudio"
api
"openai-responses"
models
"minimax-m2.1-gs32"
name
"MiniMax M2.1 GS32"
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
196608
maxTokens
8192
Tips
If you set
dmPolicy: "open"
, the matching
allowFrom
list must include
"*"
Provider IDs differ (phone numbers, user IDs, channel IDs). Use the provider docs to confirm the format.
Optional sections to add later:
web
browser
discovery
canvasHost
talk
signal
imessage
See
Providers
and
Troubleshooting
for deeper setup notes.
Configuration Reference
Authentication

---
## Gateway > Configuration Reference

[Source: https://docs.openclaw.ai/gateway/configuration-reference]

Complete field-by-field reference for ~/.openclaw/openclaw.json
Configuration Reference
Every field available in
~/.openclaw/openclaw.json
. For a task-oriented overview, see
Configuration
Config format is
JSON5
(comments + trailing commas allowed). All fields are optional — OpenClaw uses safe defaults when omitted.
Channels
Each channel starts automatically when its config section exists (unless
enabled: false
DM and group access
All channels support DM policies and group policies:
DM policy
Behavior
pairing
(default)
Unknown senders get a one-time pairing code; owner must approve
allowlist
Only senders in
allowFrom
(or paired allow store)
open
Allow all inbound DMs (requires
allowFrom: ["*"]
disabled
Ignore all inbound DMs
Group policy
Behavior
allowlist
(default)
Only groups matching the configured allowlist
open
Bypass group allowlists (mention-gating still applies)
disabled
Block all group/room messages
channels.defaults.groupPolicy
sets the default when a provider’s
groupPolicy
is unset.
Pairing codes expire after 1 hour. Pending DM pairing requests are capped at
3 per channel
Slack/Discord have a special fallback: if their provider section is missing entirely, runtime group policy can resolve to
open
(with a startup warning).
WhatsApp
WhatsApp runs through the gateway’s web channel (Baileys Web). It starts automatically when a linked session exists.
channels
whatsapp
dmPolicy
"pairing"
// pairing | allowlist | open | disabled
allowFrom
"+15555550123"
"+447700900123"
textChunkLimit
4000
chunkMode
"length"
// length | newline
mediaMaxMb
sendReadReceipts
true
// blue ticks (false in self-chat mode)
groups
"*"
requireMention
true
groupPolicy
"allowlist"
groupAllowFrom
"+15551234567"
web
enabled
true
heartbeatSeconds
reconnect
initialMs
2000
maxMs
120000
factor
1.4
jitter
0.2
maxAttempts
Multi-account WhatsApp
channels
whatsapp
accounts
default
personal
biz
// authDir: "~/.openclaw/credentials/whatsapp/biz",
Outbound commands default to account
default
if present; otherwise the first configured account id (sorted).
Legacy single-account Baileys auth dir is migrated by
openclaw doctor
into
whatsapp/default
Per-account overrides:
channels.whatsapp.accounts.<id>.sendReadReceipts
channels.whatsapp.accounts.<id>.dmPolicy
channels.whatsapp.accounts.<id>.allowFrom
Telegram
channels
telegram
enabled
true
botToken
"your-bot-token"
dmPolicy
"pairing"
allowFrom
"tg:123456789"
groups
"*"
requireMention
true
"-1001234567890"
allowFrom
"@admin"
systemPrompt
"Keep answers brief."
topics
"99"
requireMention
false
skills
"search"
systemPrompt
"Stay on topic."
customCommands
command
"backup"
description
"Git backup"
command
"generate"
description
"Create an image"
historyLimit
replyToMode
"first"
// off | first | all
linkPreview
true
streamMode
"partial"
// off | partial | block
draftChunk
minChars
200
maxChars
800
breakPreference
"paragraph"
// paragraph | newline | sentence
actions
reactions
true
sendMessage
true
reactionNotifications
"own"
// off | own | all
mediaMaxMb
retry
attempts
minDelayMs
400
maxDelayMs
30000
jitter
0.1
network
autoSelectFamily
false
proxy
"socks5://localhost:9050"
webhookUrl
"https://example.com/telegram-webhook"
webhookSecret
"secret"
webhookPath
"/telegram-webhook"
Bot token:
channels.telegram.botToken
channels.telegram.tokenFile
, with
TELEGRAM_BOT_TOKEN
as fallback for the default account.
configWrites: false
blocks Telegram-initiated config writes (supergroup ID migrations,
/config set|unset
Telegram stream previews use
sendMessage
editMessageText
(works in direct and group chats).
Retry policy: see
Retry policy
Discord
channels
discord
enabled
true
token
"your-bot-token"
mediaMaxMb
allowBots
false
actions
reactions
true
stickers
true
polls
true
permissions
true
messages
true
threads
true
pins
true
search
true
memberInfo
true
roleInfo
true
roles
false
channelInfo
true
voiceStatus
true
events
true
moderation
false
replyToMode
"off"
// off | first | all
dmPolicy
"pairing"
allowFrom
"1234567890"
"steipete"
enabled
true
groupEnabled
false
groupChannels
"openclaw-dm"
] }
guilds
"123456789012345678"
slug
"friends-of-openclaw"
requireMention
false
reactionNotifications
"own"
users
"987654321098765432"
channels
general
allow
true
help
allow
true
requireMention
true
users
"987654321098765432"
skills
"docs"
systemPrompt
"Short answers only."
historyLimit
textChunkLimit
2000
chunkMode
"length"
// length | newline
maxLinesPerMessage
components
accentColor
"#5865F2"
retry
attempts
minDelayMs
500
maxDelayMs
30000
jitter
0.1
Token:
channels.discord.token
, with
DISCORD_BOT_TOKEN
as fallback for the default account.
Use
user:<id>
(DM) or
channel:<id>
(guild channel) for delivery targets; bare numeric IDs are rejected.
Guild slugs are lowercase with spaces replaced by
; channel keys use the slugged name (no
). Prefer guild IDs.
Bot-authored messages are ignored by default.
allowBots: true
enables them (own messages still filtered).
maxLinesPerMessage
(default 17) splits tall messages even when under 2000 chars.
channels.discord.ui.components.accentColor
sets the accent color for Discord components v2 containers.
Reaction notification modes:
off
(none),
own
(bot’s messages, default),
all
(all messages),
allowlist
(from
guilds.<id>.users
on all messages).
Google Chat
channels
googlechat
enabled
true
serviceAccountFile
"/path/to/service-account.json"
audienceType
"app-url"
// app-url | project-number
audience
"https://gateway.example.com/googlechat"
webhookPath
"/googlechat"
botUser
"users/1234567890"
enabled
true
policy
"pairing"
allowFrom
"users/1234567890"
groupPolicy
"allowlist"
groups
"spaces/AAAA"
allow
true
requireMention
true
actions
reactions
true
typingIndicator
"message"
mediaMaxMb
Service account JSON: inline (
serviceAccount
) or file-based (
serviceAccountFile
Env fallbacks:
GOOGLE_CHAT_SERVICE_ACCOUNT
GOOGLE_CHAT_SERVICE_ACCOUNT_FILE
Use
spaces/<spaceId>
users/<userId|email>
for delivery targets.
Slack
channels
slack
enabled
true
botToken
"xoxb-..."
appToken
"xapp-..."
dmPolicy
"pairing"
allowFrom
"U123"
"U456"
"*"
enabled
true
groupEnabled
false
groupChannels
"G123"
] }
channels
C123
allow
true
requireMention
true
allowBots
false
"#general"
allow
true
requireMention
true
allowBots
false
users
"U123"
skills
"docs"
systemPrompt
"Short answers only."
historyLimit
allowBots
false
reactionNotifications
"own"
reactionAllowlist
"U123"
replyToMode
"off"
// off | first | all
thread
historyScope
"thread"
// thread | channel
inheritParent
false
actions
reactions
true
messages
true
pins
true
memberInfo
true
emojiList
true
slashCommand
enabled
true
name
"openclaw"
sessionPrefix
"slack:slash"
ephemeral
true
textChunkLimit
4000
chunkMode
"length"
mediaMaxMb
Socket mode
requires both
botToken
and
appToken
SLACK_BOT_TOKEN
SLACK_APP_TOKEN
for default account env fallback).
HTTP mode
requires
botToken
plus
signingSecret
(at root or per-account).
configWrites: false
blocks Slack-initiated config writes.
Use
user:<id>
(DM) or
channel:<id>
for delivery targets.
Reaction notification modes:
off
own
(default),
all
allowlist
(from
reactionAllowlist
Thread session isolation:
thread.historyScope
is per-thread (default) or shared across channel.
thread.inheritParent
copies parent channel transcript to new threads.
Action group
Default
Notes
reactions
enabled
React + list reactions
messages
enabled
Read/send/edit/delete
pins
enabled
Pin/unpin/list
memberInfo
enabled
Member info
emojiList
enabled
Custom emoji list
Mattermost
Mattermost ships as a plugin:
openclaw plugins install @openclaw/mattermost
channels
mattermost
enabled
true
botToken
"mm-token"
baseUrl
"https://chat.example.com"
dmPolicy
"pairing"
chatmode
"oncall"
// oncall | onmessage | onchar
oncharPrefixes
">"
"!"
textChunkLimit
4000
chunkMode
"length"
Chat modes:
oncall
(respond on @-mention, default),
onmessage
(every message),
onchar
(messages starting with trigger prefix).
Signal
channels
signal
reactionNotifications
"own"
// off | own | all | allowlist
reactionAllowlist
"+15551234567"
"uuid:123e4567-e89b-12d3-a456-426614174000"
historyLimit
Reaction notification modes:
off
own
(default),
all
allowlist
(from
reactionAllowlist
iMessage
OpenClaw spawns
imsg rpc
(JSON-RPC over stdio). No daemon or port required.
channels
imessage
enabled
true
cliPath
"imsg"
dbPath
"~/Library/Messages/chat.db"
remoteHost
"user@gateway-host"
dmPolicy
"pairing"
allowFrom
"+15555550123"
"
[email protected]
"
"chat_id:123"
historyLimit
includeAttachments
false
mediaMaxMb
service
"auto"
region
"US"
Requires Full Disk Access to the Messages DB.
Prefer
chat_id:<id>
targets. Use
imsg chats --limit 20
to list chats.
cliPath
can point to an SSH wrapper; set
remoteHost
for SCP attachment fetching.
iMessage SSH wrapper example
#!/usr/bin/env bash
exec
ssh
gateway-host
imsg
"$@"
Multi-account (all channels)
Run multiple accounts per channel (each with its own
accountId
channels
telegram
accounts
default
name
"Primary bot"
botToken
"123456:ABC..."
alerts
name
"Alerts bot"
botToken
"987654:XYZ..."
default
is used when
accountId
is omitted (CLI + routing).
Env tokens only apply to the
default
account.
Base channel settings apply to all accounts unless overridden per account.
Use
bindings[].match.accountId
to route each account to a different agent.
Group chat mention gating
Group messages default to
require mention
(metadata mention or regex patterns). Applies to WhatsApp, Telegram, Discord, Google Chat, and iMessage group chats.
Mention types:
Metadata mentions
: Native platform @-mentions. Ignored in WhatsApp self-chat mode.
Text patterns
: Regex patterns in
agents.list[].groupChat.mentionPatterns
. Always checked.
Mention gating is enforced only when detection is possible (native mentions or at least one pattern).
messages
groupChat
historyLimit
50 }
agents
list
"main"
groupChat
mentionPatterns
"@openclaw"
"openclaw"
] } }]
messages.groupChat.historyLimit
sets the global default. Channels can override with
channels.<channel>.historyLimit
(or per-account). Set
to disable.
DM history limits
channels
telegram
dmHistoryLimit
dms
"123456789"
historyLimit
50 }
Resolution: per-DM override → provider default → no limit (all retained).
Supported:
telegram
whatsapp
discord
slack
signal
imessage
msteams
Self-chat mode
Include your own number in
allowFrom
to enable self-chat mode (ignores native @-mentions, only responds to text patterns):
channels
whatsapp
allowFrom
"+15555550123"
groups
"*"
requireMention
true
} }
agents
list
"main"
groupChat
mentionPatterns
"reisponde"
"@openclaw"
] }
Commands (chat command handling)
commands
native
"auto"
// register native commands when supported
text
true
// parse /commands in chat messages
bash
false
// allow ! (alias: /bash)
bashForegroundMs
2000
config
false
// allow /config
debug
false
// allow /debug
restart
false
// allow /restart + gateway restart tool
allowFrom
"*"
"user1"
discord
"user:123"
useAccessGroups
true
Command details
Text commands must be
standalone
messages with leading
native: "auto"
turns on native commands for Discord/Telegram, leaves Slack off.
Override per channel:
channels.discord.commands.native
(bool or
"auto"
false
clears previously registered commands.
channels.telegram.customCommands
adds extra Telegram bot menu entries.
bash: true
enables
! <cmd>
for host shell. Requires
tools.elevated.enabled
and sender in
tools.elevated.allowFrom.<channel>
config: true
enables
/config
(reads/writes
openclaw.json
channels.<provider>.configWrites
gates config mutations per channel (default: true).
allowFrom
is per-provider. When set, it is the
only
authorization source (channel allowlists/pairing and
useAccessGroups
are ignored).
useAccessGroups: false
allows commands to bypass access-group policies when
allowFrom
is not set.
Agent defaults
agents.defaults.workspace
Default:
~/.openclaw/workspace
agents
defaults
workspace
"~/.openclaw/workspace"
} }
agents.defaults.repoRoot
Optional repository root shown in the system prompt’s Runtime line. If unset, OpenClaw auto-detects by walking upward from the workspace.
agents
defaults
repoRoot
"~/Projects/openclaw"
} }
agents.defaults.skipBootstrap
Disables automatic creation of workspace bootstrap files (
AGENTS.md
SOUL.md
TOOLS.md
IDENTITY.md
USER.md
HEARTBEAT.md
BOOTSTRAP.md
agents
defaults
skipBootstrap
true
} }
agents.defaults.bootstrapMaxChars
Max characters per workspace bootstrap file before truncation. Default:
20000
agents
defaults
bootstrapMaxChars
20000 } }
agents.defaults.bootstrapTotalMaxChars
Max total characters injected across all workspace bootstrap files. Default:
24000
agents
defaults
bootstrapTotalMaxChars
24000 } }
agents.defaults.userTimezone
Timezone for system prompt context (not message timestamps). Falls back to host timezone.
agents
defaults
userTimezone
"America/Chicago"
} }
agents.defaults.timeFormat
Time format in system prompt. Default:
auto
(OS preference).
agents
defaults
timeFormat
"auto"
} }
// auto | 12 | 24
agents.defaults.model
agents
defaults
models
"anthropic/claude-opus-4-6"
alias
"opus"
"minimax/MiniMax-M2.1"
alias
"minimax"
model
primary
"anthropic/claude-opus-4-6"
fallbacks
"minimax/MiniMax-M2.1"
imageModel
primary
"openrouter/qwen/qwen-2.5-vl-72b-instruct:free"
fallbacks
"openrouter/google/gemini-2.0-flash-vision:free"
thinkingDefault
"low"
verboseDefault
"off"
elevatedDefault
"on"
timeoutSeconds
600
mediaMaxMb
contextTokens
200000
maxConcurrent
model.primary
: format
provider/model
(e.g.
anthropic/claude-opus-4-6
). If you omit the provider, OpenClaw assumes
anthropic
(deprecated).
models
: the configured model catalog and allowlist for
/model
. Each entry can include
alias
(shortcut) and
params
(provider-specific:
temperature
maxTokens
imageModel
: only used if the primary model lacks image input.
maxConcurrent
: max parallel agent runs across sessions (each session still serialized). Default: 1.
Built-in alias shorthands
(only apply when the model is in
agents.defaults.models
Alias
Model
opus
anthropic/claude-opus-4-6
sonnet
anthropic/claude-sonnet-4-5
gpt
openai/gpt-5.2
gpt-mini
openai/gpt-5-mini
gemini
google/gemini-3-pro-preview
gemini-flash
google/gemini-3-flash-preview
Your configured aliases always win over defaults.
Z.AI GLM-4.x models automatically enable thinking mode unless you set
--thinking off
or define
agents.defaults.models["zai/<model>"].params.thinking
yourself.
agents.defaults.cliBackends
Optional CLI backends for text-only fallback runs (no tool calls). Useful as a backup when API providers fail.
agents
defaults
cliBackends
"claude-cli"
command
"/opt/homebrew/bin/claude"
"my-cli"
command
"my-cli"
args
"--json"
output
"json"
modelArg
"--model"
sessionArg
"--session"
sessionMode
"existing"
systemPromptArg
"--system"
systemPromptWhen
"first"
imageArg
"--image"
imageMode
"repeat"
CLI backends are text-first; tools are always disabled.
Sessions supported when
sessionArg
is set.
Image pass-through supported when
imageArg
accepts file paths.
agents.defaults.heartbeat
Periodic heartbeat runs.
agents
defaults
heartbeat
every
"30m"
// 0m disables
model
"openai/gpt-5.2-mini"
includeReasoning
false
session
"main"
"+15555550123"
target
"last"
// last | whatsapp | telegram | discord | ... | none
prompt
"Read HEARTBEAT.md if it exists..."
ackMaxChars
300
every
: duration string (ms/s/m/h). Default:
30m
Per-agent: set
agents.list[].heartbeat
. When any agent defines
heartbeat
only those agents
run heartbeats.
Heartbeats run full agent turns — shorter intervals burn more tokens.
agents.defaults.compaction
agents
defaults
compaction
mode
"safeguard"
// default | safeguard
reserveTokensFloor
24000
memoryFlush
enabled
true
softThresholdTokens
6000
systemPrompt
"Session nearing compaction. Store durable memories now."
prompt
"Write any lasting notes to memory/YYYY-MM-DD.md; reply with NO_REPLY if nothing to store."
mode
default
safeguard
(chunked summarization for long histories). See
Compaction
memoryFlush
: silent agentic turn before auto-compaction to store durable memories. Skipped when workspace is read-only.
agents.defaults.contextPruning
Prunes
old tool results
from in-memory context before sending to the LLM. Does
not
modify session history on disk.
agents
defaults
contextPruning
mode
"cache-ttl"
// off | cache-ttl
ttl
"1h"
// duration (ms/s/m/h), default unit: minutes
keepLastAssistants
softTrimRatio
0.3
hardClearRatio
0.5
minPrunableToolChars
50000
softTrim
maxChars
4000
headChars
1500
tailChars
1500 }
hardClear
enabled
true
placeholder
"[Old tool result content cleared]"
tools
deny
"browser"
"canvas"
] }
cache-ttl mode behavior
mode: "cache-ttl"
enables pruning passes.
ttl
controls how often pruning can run again (after the last cache touch).
Pruning soft-trims oversized tool results first, then hard-clears older tool results if needed.
Soft-trim
keeps beginning + end and inserts
...
in the middle.
Hard-clear
replaces the entire tool result with the placeholder.
Notes:
Image blocks are never trimmed/cleared.
Ratios are character-based (approximate), not exact token counts.
If fewer than
keepLastAssistants
assistant messages exist, pruning is skipped.
See
Session Pruning
for behavior details.
Block streaming
agents
defaults
blockStreamingDefault
"off"
// on | off
blockStreamingBreak
"text_end"
// text_end | message_end
blockStreamingChunk
minChars
800
maxChars
1200 }
blockStreamingCoalesce
idleMs
1000 }
humanDelay
mode
"natural"
// off | natural | custom (use minMs/maxMs)
Non-Telegram channels require explicit
*.blockStreaming: true
to enable block replies.
Channel overrides:
channels.<channel>.blockStreamingCoalesce
(and per-account variants). Signal/Slack/Discord/Google Chat default
minChars: 1500
humanDelay
: randomized pause between block replies.
natural
= 800–2500ms. Per-agent override:
agents.list[].humanDelay
See
Streaming
for behavior + chunking details.
Typing indicators
agents
defaults
typingMode
"instant"
// never | instant | thinking | message
typingIntervalSeconds
Defaults:
instant
for direct chats/mentions,
message
for unmentioned group chats.
Per-session overrides:
session.typingMode
session.typingIntervalSeconds
See
Typing Indicators
agents.defaults.sandbox
Optional
Docker sandboxing
for the embedded agent. See
Sandboxing
for the full guide.
agents
defaults
sandbox
mode
"non-main"
// off | non-main | all
scope
"agent"
// session | agent | shared
workspaceAccess
"none"
// none | ro | rw
workspaceRoot
"~/.openclaw/sandboxes"
docker
image
"openclaw-sandbox:bookworm-slim"
containerPrefix
"openclaw-sbx-"
workdir
"/workspace"
readOnlyRoot
true
tmpfs
"/tmp"
"/var/tmp"
"/run"
network
"none"
user
"1000:1000"
capDrop
"ALL"
env
LANG
"C.UTF-8"
setupCommand
"apt-get update && apt-get install -y git curl jq"
pidsLimit
256
memory
"1g"
memorySwap
"2g"
cpus
ulimits
nofile
soft
1024
hard
2048 }
nproc
256
seccompProfile
"/path/to/seccomp.json"
apparmorProfile
"openclaw-sandbox"
dns
"1.1.1.1"
"8.8.8.8"
extraHosts
"internal.service:10.0.0.5"
binds
"/home/user/source:/source:rw"
browser
enabled
false
image
"openclaw-sandbox-browser:bookworm-slim"
cdpPort
9222
vncPort
5900
noVncPort
6080
headless
false
enableNoVnc
true
allowHostControl
false
autoStart
true
autoStartTimeoutMs
12000
prune
idleHours
maxAgeDays
tools
sandbox
tools
allow
"exec"
"process"
"read"
"write"
"edit"
"apply_patch"
"sessions_list"
"sessions_history"
"sessions_send"
"sessions_spawn"
"session_status"
deny
"browser"
"canvas"
"nodes"
"cron"
"discord"
"gateway"
Sandbox details
Workspace access:
none
: per-scope sandbox workspace under
~/.openclaw/sandboxes
: sandbox workspace at
/workspace
, agent workspace mounted read-only at
/agent
: agent workspace mounted read/write at
/workspace
Scope:
session
: per-session container + workspace
agent
: one container + workspace per agent (default)
shared
: shared container and workspace (no cross-session isolation)
setupCommand
runs once after container creation (via
sh -lc
). Needs network egress, writable root, root user.
Containers default to
network: "none"
— set to
"bridge"
if the agent needs outbound access.
Inbound attachments
are staged into
media/inbound/*
in the active workspace.
docker.binds
mounts additional host directories; global and per-agent binds are merged.
Sandboxed browser
sandbox.browser.enabled
): Chromium + CDP in a container. noVNC URL injected into system prompt. Does not require
browser.enabled
in main config.
allowHostControl: false
(default) blocks sandboxed sessions from targeting the host browser.
sandbox.browser.binds
mounts additional host directories into the sandbox browser container only. When set (including
), it replaces
docker.binds
for the browser container.
Build images:
scripts/sandbox-setup.sh
# main sandbox image
scripts/sandbox-browser-setup.sh
# optional browser image
agents.list
(per-agent overrides)
agents
list
"main"
default
true
name
"Main Agent"
workspace
"~/.openclaw/workspace"
agentDir
"~/.openclaw/agents/main/agent"
model
"anthropic/claude-opus-4-6"
// or { primary, fallbacks }
identity
name
"Samantha"
theme
"helpful sloth"
emoji
"🦥"
avatar
"avatars/samantha.png"
groupChat
mentionPatterns
"@openclaw"
] }
sandbox
mode
"off"
subagents
allowAgents
"*"
] }
tools
profile
"coding"
allow
"browser"
deny
"canvas"
elevated
enabled
true
: stable agent id (required).
default
: when multiple are set, first wins (warning logged). If none set, first list entry is default.
model
: string form overrides
primary
only; object form
{ primary, fallbacks }
overrides both (
disables global fallbacks).
identity.avatar
: workspace-relative path,
http(s)
URL, or
data:
URI.
identity
derives defaults:
ackReaction
from
emoji
mentionPatterns
from
name
emoji
subagents.allowAgents
: allowlist of agent ids for
sessions_spawn
["*"]
= any; default: same agent only).
Multi-agent routing
Run multiple isolated agents inside one Gateway. See
Multi-Agent
agents
list
"home"
default
true
workspace
"~/.openclaw/workspace-home"
"work"
workspace
"~/.openclaw/workspace-work"
bindings
agentId
"home"
match
channel
"whatsapp"
accountId
"personal"
} }
agentId
"work"
match
channel
"whatsapp"
accountId
"biz"
} }
Binding match fields
match.channel
(required)
match.accountId
(optional;
= any account; omitted = default account)
match.peer
(optional;
{ kind: direct|group|channel, id }
match.guildId
match.teamId
(optional; channel-specific)
Deterministic match order:
match.peer
match.guildId
match.teamId
match.accountId
(exact, no peer/guild/team)
match.accountId: "*"
(channel-wide)
Default agent
Within each tier, the first matching
bindings
entry wins.
Per-agent access profiles
Full access (no sandbox)
agents
list
"personal"
workspace
"~/.openclaw/workspace-personal"
sandbox
mode
"off"
Read-only tools + workspace
agents
list
"family"
workspace
"~/.openclaw/workspace-family"
sandbox
mode
"all"
scope
"agent"
workspaceAccess
"ro"
tools
allow
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
"exec"
"process"
"browser"
No filesystem access (messaging only)
agents
list
"public"
workspace
"~/.openclaw/workspace-public"
sandbox
mode
"all"
scope
"agent"
workspaceAccess
"none"
tools
allow
"sessions_list"
"sessions_history"
"sessions_send"
"sessions_spawn"
"session_status"
"whatsapp"
"telegram"
"slack"
"discord"
"gateway"
deny
"read"
"write"
"edit"
"apply_patch"
"exec"
"process"
"browser"
"canvas"
"nodes"
"cron"
"gateway"
"image"
See
Multi-Agent Sandbox & Tools
for precedence details.
Session
session
scope
"per-sender"
dmScope
"main"
// main | per-peer | per-channel-peer | per-account-channel-peer
identityLinks
alice
"telegram:123456789"
"discord:987654321012345678"
reset
mode
"daily"
// daily | idle
atHour
idleMinutes
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
resetTriggers
"/new"
"/reset"
store
"~/.openclaw/agents/{agentId}/sessions/sessions.json"
maintenance
mode
"warn"
// warn | enforce
pruneAfter
"30d"
maxEntries
500
rotateBytes
"10mb"
mainKey
"main"
// legacy (runtime always uses "main")
agentToAgent
maxPingPongTurns
5 }
sendPolicy
rules
action
"deny"
match
channel
"discord"
chatType
"group"
} }]
default
"allow"
Session field details
dmScope
: how DMs are grouped.
main
: all DMs share the main session.
per-peer
: isolate by sender id across channels.
per-channel-peer
: isolate per channel + sender (recommended for multi-user inboxes).
per-account-channel-peer
: isolate per account + channel + sender (recommended for multi-account).
identityLinks
: map canonical ids to provider-prefixed peers for cross-channel session sharing.
reset
: primary reset policy.
daily
resets at
atHour
local time;
idle
resets after
idleMinutes
. When both configured, whichever expires first wins.
resetByType
: per-type overrides (
direct
group
thread
). Legacy
accepted as alias for
direct
mainKey
: legacy field. Runtime now always uses
"main"
for the main direct-chat bucket.
sendPolicy
: match by
channel
chatType
direct|group|channel
, with legacy
alias),
keyPrefix
, or
rawKeyPrefix
. First deny wins.
maintenance
warn
warns the active session on eviction;
enforce
applies pruning and rotation.
Messages
messages
responsePrefix
"🦞"
// or "auto"
ackReaction
"👀"
ackReactionScope
"group-mentions"
// group-mentions | group-all | direct | all
removeAckAfterReply
false
queue
mode
"collect"
// steer | followup | collect | steer-backlog | steer+backlog | queue | interrupt
debounceMs
1000
cap
drop
"summarize"
// old | new | summarize
byChannel
whatsapp
"collect"
telegram
"collect"
inbound
debounceMs
2000
// 0 disables
byChannel
whatsapp
5000
slack
1500
Response prefix
Per-channel/account overrides:
channels.<channel>.responsePrefix
channels.<channel>.accounts.<id>.responsePrefix
Resolution (most specific wins): account → channel → global.
""
disables and stops cascade.
"auto"
derives
[{identity.name}]
Template variables:
Variable
Description
Example
{model}
Short model name
claude-opus-4-6
{modelFull}
Full model identifier
anthropic/claude-opus-4-6
{provider}
Provider name
anthropic
{thinkingLevel}
Current thinking level
high
low
off
{identity.name}
Agent identity name
(same as
"auto"
Variables are case-insensitive.
{think}
is an alias for
{thinkingLevel}
Ack reaction
Defaults to active agent’s
identity.emoji
, otherwise
"👀"
. Set
""
to disable.
Per-channel overrides:
channels.<channel>.ackReaction
channels.<channel>.accounts.<id>.ackReaction
Resolution order: account → channel →
messages.ackReaction
→ identity fallback.
Scope:
group-mentions
(default),
group-all
direct
all
removeAckAfterReply
: removes ack after reply (Slack/Discord/Telegram/Google Chat only).
Inbound debounce
Batches rapid text-only messages from the same sender into a single agent turn. Media/attachments flush immediately. Control commands bypass debouncing.
TTS (text-to-speech)
messages
tts
auto
"always"
// off | always | inbound | tagged
mode
"final"
// final | all
provider
"elevenlabs"
summaryModel
"openai/gpt-4.1-mini"
modelOverrides
enabled
true
maxTextLength
4000
timeoutMs
30000
prefsPath
"~/.openclaw/settings/tts.json"
elevenlabs
apiKey
"elevenlabs_api_key"
baseUrl
"https://api.elevenlabs.io"
voiceId
"voice_id"
modelId
"eleven_multilingual_v2"
seed
applyTextNormalization
"auto"
languageCode
"en"
voiceSettings
stability
0.5
similarityBoost
0.75
style
0.0
useSpeakerBoost
true
speed
1.0
openai
apiKey
"openai_api_key"
model
"gpt-4o-mini-tts"
voice
"alloy"
auto
controls auto-TTS.
/tts off|always|inbound|tagged
overrides per session.
summaryModel
overrides
agents.defaults.model.primary
for auto-summary.
API keys fall back to
ELEVENLABS_API_KEY
XI_API_KEY
and
OPENAI_API_KEY
Talk
Defaults for Talk mode (macOS/iOS/Android).
talk
voiceId
"elevenlabs_voice_id"
voiceAliases
Clawd
"EXAVITQu4vr4xnSDxMaL"
Roger
"CwhRBWXzGAHq8TQ4Fs17"
modelId
"eleven_v3"
outputFormat
"mp3_44100_128"
apiKey
"elevenlabs_api_key"
interruptOnSpeech
true
Voice IDs fall back to
ELEVENLABS_VOICE_ID
SAG_VOICE_ID
apiKey
falls back to
ELEVENLABS_API_KEY
voiceAliases
lets Talk directives use friendly names.
Tools
Tool profiles
tools.profile
sets a base allowlist before
tools.allow
tools.deny
Profile
Includes
minimal
session_status
only
coding
group:fs
group:runtime
group:sessions
group:memory
image
messaging
group:messaging
sessions_list
sessions_history
sessions_send
session_status
full
No restriction (same as unset)
Tool groups
Group
Tools
group:runtime
exec
process
bash
is accepted as an alias for
exec
group:fs
read
write
edit
apply_patch
group:sessions
sessions_list
sessions_history
sessions_send
sessions_spawn
session_status
group:memory
memory_search
memory_get
group:web
web_search
web_fetch
group:ui
browser
canvas
group:automation
cron
gateway
group:messaging
message
group:nodes
nodes
group:openclaw
All built-in tools (excludes provider plugins)
tools.allow
tools.deny
Global tool allow/deny policy (deny wins). Case-insensitive, supports
wildcards. Applied even when Docker sandbox is off.
tools
deny
"browser"
"canvas"
] }
tools.byProvider
Further restrict tools for specific providers or models. Order: base profile → provider profile → allow/deny.
tools
profile
"coding"
byProvider
"google-antigravity"
profile
"minimal"
"openai/gpt-5.2"
allow
"group:fs"
"sessions_list"
] }
tools.elevated
Controls elevated (host) exec access:
tools
elevated
enabled
true
allowFrom
whatsapp
"+15555550123"
discord
"steipete"
"1234567890123"
Per-agent override (
agents.list[].tools.elevated
) can only further restrict.
/elevated on|off|ask|full
stores state per session; inline directives apply to single message.
Elevated
exec
runs on the host, bypasses sandboxing.
tools.exec
tools
exec
backgroundMs
10000
timeoutSec
1800
cleanupMs
1800000
notifyOnExit
true
notifyOnExitEmptySuccess
false
applyPatch
enabled
false
allowModels
"gpt-5.2"
tools.web
tools
web
search
enabled
true
apiKey
"brave_api_key"
// or BRAVE_API_KEY env
maxResults
timeoutSeconds
cacheTtlMinutes
fetch
enabled
true
maxChars
50000
maxCharsCap
50000
timeoutSeconds
cacheTtlMinutes
userAgent
"custom-ua"
tools.media
Configures inbound media understanding (image/audio/video):
tools
media
concurrency
audio
enabled
true
maxBytes
20971520
scope
default
"deny"
rules
action
"allow"
match
chatType
"direct"
} }]
models
provider
"openai"
model
"gpt-4o-mini-transcribe"
type
"cli"
command
"whisper"
args
"--model"
"base"
"{{MediaPath}}"
] }
video
enabled
true
maxBytes
52428800
models
provider
"google"
model
"gemini-3-flash-preview"
Media model entry fields
Provider entry
type: "provider"
or omitted):
provider
: API provider id (
openai
anthropic
google
gemini
groq
, etc.)
model
: model id override
profile
preferredProfile
: auth profile selection
CLI entry
type: "cli"
command
: executable to run
args
: templated args (supports
{{MediaPath}}
{{Prompt}}
{{MaxChars}}
, etc.)
Common fields:
capabilities
: optional list (
image
audio
video
). Defaults:
openai
anthropic
minimax
→ image,
google
→ image+audio+video,
groq
→ audio.
prompt
maxChars
maxBytes
timeoutSeconds
language
: per-entry overrides.
Failures fall back to the next entry.
Provider auth follows standard order: auth profiles → env vars →
models.providers.*.apiKey
tools.agentToAgent
tools
agentToAgent
enabled
false
allow
"home"
"work"
tools.sessions
Controls which sessions can be targeted by the session tools (
sessions_list
sessions_history
sessions_send
Default:
tree
(current session + sessions spawned by it, such as subagents).
tools
sessions
// "self" | "tree" | "agent" | "all"
visibility
"tree"
Notes:
self
: only the current session key.
tree
: current session + sessions spawned by the current session (subagents).
agent
: any session belonging to the current agent id (can include other users if you run per-sender sessions under the same agent id).
all
: any session. Cross-agent targeting still requires
tools.agentToAgent
Sandbox clamp: when the current session is sandboxed and
agents.defaults.sandbox.sessionToolsVisibility="spawned"
, visibility is forced to
tree
even if
tools.sessions.visibility="all"
tools.subagents
agents
defaults
subagents
model
"minimax/MiniMax-M2.1"
maxConcurrent
archiveAfterMinutes
model
: default model for spawned sub-agents. If omitted, sub-agents inherit the caller’s model.
Per-subagent tool policy:
tools.subagents.tools.allow
tools.subagents.tools.deny
Custom providers and base URLs
OpenClaw uses the pi-coding-agent model catalog. Add custom providers via
models.providers
in config or
~/.openclaw/agents/<agentId>/agent/models.json
models
mode
"merge"
// merge (default) | replace
providers
"custom-proxy"
baseUrl
"http://localhost:4000/v1"
apiKey
"LITELLM_KEY"
api
"openai-completions"
// openai-completions | openai-responses | anthropic-messages | google-generative-ai
models
"llama-3.1-8b"
name
"Llama 3.1 8B"
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
128000
maxTokens
32000
Use
authHeader: true
headers
for custom auth needs.
Override agent config root with
OPENCLAW_AGENT_DIR
(or
PI_CODING_AGENT_DIR
Provider examples
Cerebras (GLM 4.6 / 4.7)
env
CEREBRAS_API_KEY
"sk-..."
agents
defaults
model
primary
"cerebras/zai-glm-4.7"
fallbacks
"cerebras/zai-glm-4.6"
models
"cerebras/zai-glm-4.7"
alias
"GLM 4.7 (Cerebras)"
"cerebras/zai-glm-4.6"
alias
"GLM 4.6 (Cerebras)"
models
mode
"merge"
providers
cerebras
baseUrl
"https://api.cerebras.ai/v1"
apiKey
"${CEREBRAS_API_KEY}"
api
"openai-completions"
models
"zai-glm-4.7"
name
"GLM 4.7 (Cerebras)"
"zai-glm-4.6"
name
"GLM 4.6 (Cerebras)"
Use
cerebras/zai-glm-4.7
for Cerebras;
zai/glm-4.7
for Z.AI direct.
OpenCode Zen
agents
defaults
model
primary
"opencode/claude-opus-4-6"
models
"opencode/claude-opus-4-6"
alias
"Opus"
} }
Set
OPENCODE_API_KEY
(or
OPENCODE_ZEN_API_KEY
). Shortcut:
openclaw onboard --auth-choice opencode-zen
Z.AI (GLM-4.7)
agents
defaults
model
primary
"zai/glm-4.7"
models
"zai/glm-4.7"
{} }
Set
ZAI_API_KEY
z.ai/*
and
z-ai/*
are accepted aliases. Shortcut:
openclaw onboard --auth-choice zai-api-key
General endpoint:
https://api.z.ai/api/paas/v4
Coding endpoint (default):
https://api.z.ai/api/coding/paas/v4
For the general endpoint, define a custom provider with the base URL override.
Moonshot AI (Kimi)
env
MOONSHOT_API_KEY
"sk-..."
agents
defaults
model
primary
"moonshot/kimi-k2.5"
models
"moonshot/kimi-k2.5"
alias
"Kimi K2.5"
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
256000
maxTokens
8192
For the China endpoint:
baseUrl: "https://api.moonshot.cn/v1"
openclaw onboard --auth-choice moonshot-api-key-cn
Kimi Coding
env
KIMI_API_KEY
"sk-..."
agents
defaults
model
primary
"kimi-coding/k2p5"
models
"kimi-coding/k2p5"
alias
"Kimi K2.5"
} }
Anthropic-compatible, built-in provider. Shortcut:
openclaw onboard --auth-choice kimi-code-api-key
Synthetic (Anthropic-compatible)
env
SYNTHETIC_API_KEY
"sk-..."
agents
defaults
model
primary
"synthetic/hf:MiniMaxAI/MiniMax-M2.1"
models
"synthetic/hf:MiniMaxAI/MiniMax-M2.1"
alias
"MiniMax M2.1"
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
192000
maxTokens
65536
Base URL should omit
/v1
(Anthropic client appends it). Shortcut:
openclaw onboard --auth-choice synthetic-api-key
MiniMax M2.1 (direct)
agents
defaults
model
primary
"minimax/MiniMax-M2.1"
models
"minimax/MiniMax-M2.1"
alias
"Minimax"
models
mode
"merge"
providers
minimax
baseUrl
"https://api.minimax.io/anthropic"
apiKey
"${MINIMAX_API_KEY}"
api
"anthropic-messages"
models
"MiniMax-M2.1"
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
10 }
contextWindow
200000
maxTokens
8192
Set
MINIMAX_API_KEY
. Shortcut:
openclaw onboard --auth-choice minimax-api
Local models (LM Studio)
See
Local Models
. TL;DR: run MiniMax M2.1 via LM Studio Responses API on serious hardware; keep hosted models merged for fallback.
Skills
skills
allowBundled
"gemini"
"peekaboo"
load
extraDirs
"~/Projects/agent-scripts/skills"
install
preferBrew
true
nodeManager
"npm"
// npm | pnpm | yarn
entries
"nano-banana-pro"
apiKey
"GEMINI_KEY_HERE"
env
GEMINI_API_KEY
"GEMINI_KEY_HERE"
peekaboo
enabled
true
sag
enabled
false
allowBundled
: optional allowlist for bundled skills only (managed/workspace skills unaffected).
entries.<skillKey>.enabled: false
disables a skill even if bundled/installed.
entries.<skillKey>.apiKey
: convenience for skills declaring a primary env var.
Plugins
plugins
enabled
true
allow
"voice-call"
deny
load
paths
"~/Projects/oss/voice-call-extension"
entries
"voice-call"
enabled
true
config
provider
"twilio"
Loaded from
~/.openclaw/extensions
<workspace>/.openclaw/extensions
, plus
plugins.load.paths
Config changes require a gateway restart.
allow
: optional allowlist (only listed plugins load).
deny
wins.
See
Plugins
Browser
browser
enabled
true
evaluateEnabled
true
defaultProfile
"chrome"
profiles
openclaw
cdpPort
18800
color
"#FF4500"
work
cdpPort
18801
color
"#0066CC"
remote
cdpUrl
"http://10.0.0.42:9222"
color
"#00AA00"
color
"#FF4500"
// headless: false,
// noSandbox: false,
// executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
// attachOnly: false,
evaluateEnabled: false
disables
act:evaluate
and
wait --fn
Remote profiles are attach-only (start/stop/reset disabled).
Auto-detect order: default browser if Chromium-based → Chrome → Brave → Edge → Chromium → Chrome Canary.
Control service: loopback only (port derived from
gateway.port
, default
18791
seamColor
"#FF4500"
assistant
name
"OpenClaw"
avatar
"CB"
// emoji, short text, image URL, or data URI
seamColor
: accent color for native app UI chrome (Talk Mode bubble tint, etc.).
assistant
: Control UI identity override. Falls back to active agent identity.
Gateway
gateway
mode
"local"
// local | remote
port
18789
bind
"loopback"
auth
mode
"token"
// token | password | trusted-proxy
token
"your-token"
// password: "your-password",
// or OPENCLAW_GATEWAY_PASSWORD
// trustedProxy: { userHeader: "x-forwarded-user" },
// for mode=trusted-proxy; see /gateway/trusted-proxy-auth
allowTailscale
true
rateLimit
maxAttempts
windowMs
60000
lockoutMs
300000
exemptLoopback
true
tailscale
mode
"off"
// off | serve | funnel
resetOnExit
false
controlUi
enabled
true
basePath
"/openclaw"
// root: "dist/control-ui",
// allowInsecureAuth: false,
// dangerouslyDisableDeviceAuth: false,
remote
url
"ws://gateway.tailnet:18789"
transport
"ssh"
// ssh | direct
token
"your-token"
// password: "your-password",
trustedProxies
"10.0.0.1"
tools
// Additional /tools/invoke HTTP denies
deny
"browser"
// Remove tools from the default HTTP deny list
allow
"gateway"
Gateway field details
mode
local
(run gateway) or
remote
(connect to remote gateway). Gateway refuses to start unless
local
port
: single multiplexed port for WS + HTTP. Precedence:
--port
>
OPENCLAW_GATEWAY_PORT
>
gateway.port
>
18789
bind
auto
loopback
(default),
lan
0.0.0.0
tailnet
(Tailscale IP only), or
custom
Auth
: required by default. Non-loopback binds require a shared token/password. Onboarding wizard generates a token by default.
auth.mode: "trusted-proxy"
: delegate auth to an identity-aware reverse proxy and trust identity headers from
gateway.trustedProxies
(see
Trusted Proxy Auth
auth.allowTailscale
: when
true
, Tailscale Serve identity headers satisfy auth (verified via
tailscale whois
). Defaults to
true
when
tailscale.mode = "serve"
auth.rateLimit
: optional failed-auth limiter. Applies per client IP and per auth scope (shared-secret and device-token are tracked independently). Blocked attempts return
429
Retry-After
auth.rateLimit.exemptLoopback
defaults to
true
; set
false
when you intentionally want localhost traffic rate-limited too (for test setups or strict proxy deployments).
tailscale.mode
serve
(tailnet only, loopback bind) or
funnel
(public, requires auth).
remote.transport
ssh
(default) or
direct
(ws/wss). For
direct
remote.url
must be
ws://
wss://
gateway.remote.token
is for remote CLI calls only; does not enable local gateway auth.
trustedProxies
: reverse proxy IPs that terminate TLS. Only list proxies you control.
gateway.tools.deny
: extra tool names blocked for HTTP
POST /tools/invoke
(extends default deny list).
gateway.tools.allow
: remove tool names from the default HTTP deny list.
OpenAI-compatible endpoints
Chat Completions: disabled by default. Enable with
gateway.http.endpoints.chatCompletions.enabled: true
Responses API:
gateway.http.endpoints.responses.enabled
Responses URL-input hardening:
gateway.http.endpoints.responses.maxUrlParts
gateway.http.endpoints.responses.files.urlAllowlist
gateway.http.endpoints.responses.images.urlAllowlist
Multi-instance isolation
Run multiple gateways on one host with unique ports and state dirs:
OPENCLAW_CONFIG_PATH
~/.openclaw/a.json
OPENCLAW_STATE_DIR=~/.openclaw-a \
openclaw
gateway
--port
19001
Convenience flags:
--dev
(uses
~/.openclaw-dev
+ port
19001
--profile <name>
(uses
~/.openclaw-<name>
See
Multiple Gateways
Hooks
hooks
enabled
true
token
"shared-secret"
path
"/hooks"
maxBodyBytes
262144
defaultSessionKey
"hook:ingress"
allowRequestSessionKey
false
allowedSessionKeyPrefixes
"hook:"
allowedAgentIds
"hooks"
"main"
presets
"gmail"
transformsDir
"~/.openclaw/hooks/transforms"
mappings
match
path
"gmail"
action
"agent"
agentId
"hooks"
wakeMode
"now"
name
"Gmail"
sessionKey
"hook:gmail:{{messages[0].id}}"
messageTemplate
"From: {{messages[0].from}}\nSubject: {{messages[0].subject}}\n{{messages[0].snippet}}"
deliver
true
channel
"last"
model
"openai/gpt-5.2-mini"
Auth:
Authorization: Bearer <token>
x-openclaw-token: <token>
Endpoints:
POST /hooks/wake
{ text, mode?: "now"|"next-heartbeat" }
POST /hooks/agent
{ message, name?, agentId?, sessionKey?, wakeMode?, deliver?, channel?, to?, model?, thinking?, timeoutSeconds? }
sessionKey
from request payload is accepted only when
hooks.allowRequestSessionKey=true
(default:
false
POST /hooks/<name>
→ resolved via
hooks.mappings
Mapping details
match.path
matches sub-path after
/hooks
(e.g.
/hooks/gmail
gmail
match.source
matches a payload field for generic paths.
Templates like
{{messages[0].subject}}
read from the payload.
transform
can point to a JS/TS module returning a hook action.
transform.module
must be a relative path and stays within
hooks.transformsDir
(absolute paths and traversal are rejected).
agentId
routes to a specific agent; unknown IDs fall back to default.
allowedAgentIds
: restricts explicit routing (
or omitted = allow all,
= deny all).
defaultSessionKey
: optional fixed session key for hook agent runs without explicit
sessionKey
allowRequestSessionKey
: allow
/hooks/agent
callers to set
sessionKey
(default:
false
allowedSessionKeyPrefixes
: optional prefix allowlist for explicit
sessionKey
values (request + mapping), e.g.
["hook:"]
deliver: true
sends final reply to a channel;
channel
defaults to
last
model
overrides LLM for this hook run (must be allowed if model catalog is set).
Gmail integration
hooks
gmail
account
"
[email protected]
"
topic
"projects/<project-id>/topics/gog-gmail-watch"
subscription
"gog-gmail-watch-push"
pushToken
"shared-push-token"
hookUrl
"http://127.0.0.1:18789/hooks/gmail"
includeBody
true
maxBytes
20000
renewEveryMinutes
720
serve
bind
"127.0.0.1"
port
8788
path
"/"
tailscale
mode
"funnel"
path
"/gmail-pubsub"
model
"openrouter/meta-llama/llama-3.3-70b-instruct:free"
thinking
"off"
Gateway auto-starts
gog gmail watch serve
on boot when configured. Set
OPENCLAW_SKIP_GMAIL_WATCHER=1
to disable.
Don’t run a separate
gog gmail watch serve
alongside the Gateway.
Canvas host
canvasHost
root
"~/.openclaw/workspace/canvas"
liveReload
true
// enabled: false,
// or OPENCLAW_SKIP_CANVAS_HOST=1
Serves agent-editable HTML/CSS/JS and A2UI over HTTP under the Gateway port:
http://<gateway-host>:<gateway.port>/__openclaw__/canvas/
http://<gateway-host>:<gateway.port>/__openclaw__/a2ui/
Local-only: keep
gateway.bind: "loopback"
(default).
Non-loopback binds: canvas routes require Gateway auth (token/password/trusted-proxy), same as other Gateway HTTP surfaces.
Node WebViews typically don’t send auth headers; after a node is paired and connected, the Gateway allows a private-IP fallback so the node can load canvas/A2UI without leaking secrets into URLs.
Injects live-reload client into served HTML.
Auto-creates starter
index.html
when empty.
Also serves A2UI at
/__openclaw__/a2ui/
Changes require a gateway restart.
Disable live reload for large directories or
EMFILE
errors.
Discovery
mDNS (Bonjour)
discovery
mdns
mode
"minimal"
// minimal | full | off
minimal
(default): omit
cliPath
sshPort
from TXT records.
full
: include
cliPath
sshPort
Hostname defaults to
openclaw
. Override with
OPENCLAW_MDNS_HOSTNAME
Wide-area (DNS-SD)
discovery
wideArea
enabled
true
Writes a unicast DNS-SD zone under
~/.openclaw/dns/
. For cross-network discovery, pair with a DNS server (CoreDNS recommended) + Tailscale split DNS.
Setup:
openclaw dns setup --apply
Environment
env
(inline env vars)
env
OPENROUTER_API_KEY
"sk-or-..."
vars
GROQ_API_KEY
"gsk-..."
shellEnv
enabled
true
timeoutMs
15000
Inline env vars are only applied if the process env is missing the key.
.env
files: CWD
.env
~/.openclaw/.env
(neither overrides existing vars).
shellEnv
: imports missing expected keys from your login shell profile.
See
Environment
for full precedence.
Env var substitution
Reference env vars in any config string with
${VAR_NAME}
gateway
auth
token
"${OPENCLAW_GATEWAY_TOKEN}"
Only uppercase names matched:
[A-Z_][A-Z0-9_]*
Missing/empty vars throw an error at config load.
Escape with
$${VAR}
for a literal
${VAR}
Works with
$include
Auth storage
auth
profiles
"anthropic:
[email protected]
"
provider
"anthropic"
mode
"oauth"
email
"
[email protected]
"
"anthropic:work"
provider
"anthropic"
mode
"api_key"
order
anthropic
"anthropic:
[email protected]
"
"anthropic:work"
Per-agent auth profiles stored at
<agentDir>/auth-profiles.json
Legacy OAuth imports from
~/.openclaw/credentials/oauth.json
See
OAuth
Logging
logging
level
"info"
file
"/tmp/openclaw/openclaw.log"
consoleLevel
"info"
consoleStyle
"pretty"
// pretty | compact | json
redactSensitive
"tools"
// off | tools
redactPatterns
"\\bTOKEN\\b\\s*[=:]\\s*([\"']?)([^\\s\"']+)\\1"
Default log file:
/tmp/openclaw/openclaw-YYYY-MM-DD.log
Set
logging.file
for a stable path.
consoleLevel
bumps to
debug
when
--verbose
Wizard
Metadata written by CLI wizards (
onboard
configure
doctor
wizard
lastRunAt
"2026-01-01T00:00:00.000Z"
lastRunVersion
"2026.1.4"
lastRunCommit
"abc1234"
lastRunCommand
"configure"
lastRunMode
"local"
Identity
agents
list
"main"
identity
name
"Samantha"
theme
"helpful sloth"
emoji
"🦥"
avatar
"avatars/samantha.png"
Written by the macOS onboarding assistant. Derives defaults:
messages.ackReaction
from
identity.emoji
(falls back to 👀)
mentionPatterns
from
identity.name
identity.emoji
avatar
accepts: workspace-relative path,
http(s)
URL, or
data:
URI
Bridge (legacy, removed)
Current builds no longer include the TCP bridge. Nodes connect over the Gateway WebSocket.
bridge.*
keys are no longer part of the config schema (validation fails until removed;
openclaw doctor --fix
can strip unknown keys).
Legacy bridge config (historical reference)
"bridge"
"enabled"
true
"port"
18790
"bind"
"tailnet"
"tls"
"enabled"
true
"autoGenerate"
true
Cron
cron
enabled
true
maxConcurrentRuns
webhook
"https://example.invalid/cron-finished"
// optional, must be http:// or https://
webhookToken
"replace-with-dedicated-token"
// optional bearer token for outbound webhook auth
sessionRetention
"24h"
// duration string or false
sessionRetention
: how long to keep completed cron sessions before pruning. Default:
24h
webhook
: finished-run webhook endpoint, only used when the job has
notify: true
webhookToken
: dedicated bearer token for webhook auth, if omitted no auth header is sent.
See
Cron Jobs
Media model template variables
Template placeholders expanded in
tools.media.*.models[].args
Variable
Description
{{Body}}
Full inbound message body
{{RawBody}}
Raw body (no history/sender wrappers)
{{BodyStripped}}
Body with group mentions stripped
{{From}}
Sender identifier
{{To}}
Destination identifier
{{MessageSid}}
Channel message id
{{SessionId}}
Current session UUID
{{IsNewSession}}
"true"
when new session created
{{MediaUrl}}
Inbound media pseudo-URL
{{MediaPath}}
Local media path
{{MediaType}}
Media type (image/audio/document/…)
{{Transcript}}
Audio transcript
{{Prompt}}
Resolved media prompt for CLI entries
{{MaxChars}}
Resolved max output chars for CLI entries
{{ChatType}}
"direct"
"group"
{{GroupSubject}}
Group subject (best effort)
{{GroupMembers}}
Group members preview (best effort)
{{SenderName}}
Sender display name (best effort)
{{SenderE164}}
Sender phone number (best effort)
{{Provider}}
Provider hint (whatsapp, telegram, discord, etc.)
Config includes (
$include
Split config into multiple files:
// ~/.openclaw/openclaw.json
gateway
port
18789 }
agents
{ $
include
"./agents.json5"
broadcast
include
"./clients/mueller.json5"
"./clients/schmidt.json5"
Merge behavior:
Single file: replaces the containing object.
Array of files: deep-merged in order (later overrides earlier).
Sibling keys: merged after includes (override included values).
Nested includes: up to 10 levels deep.
Paths: relative (to the including file), absolute, or
../
parent references.
Errors: clear messages for missing files, parse errors, and circular includes.
Related:
Configuration
Configuration Examples
Doctor
Configuration
Configuration Examples

---
## Gateway > Configuration

[Source: https://docs.openclaw.ai/gateway/configuration]

If the file is missing, OpenClaw uses safe defaults. Common reasons to add a config:
Connect channels and control who can message the bot
Set models, tools, sandboxing, or automation (cron, hooks)
Tune sessions, media, networking, or UI
See the
full reference
for every available field.
New to configuration?
Start with
openclaw onboard
for interactive setup, or check out the
Configuration Examples
guide for complete copy-paste configs.
Minimal config
// ~/.openclaw/openclaw.json
agents
defaults
workspace
"~/.openclaw/workspace"
} }
channels
whatsapp
allowFrom
"+15555550123"
] } }
Editing config
Interactive wizard
CLI (one-liners)
Control UI
Direct edit
openclaw
onboard
# full setup wizard
openclaw
configure
# config wizard
openclaw
config
get
agents.defaults.workspace
openclaw
config
set
agents.defaults.heartbeat.every
"2h"
openclaw
config
unset
tools.web.search.apiKey
Open
http://127.0.0.1:18789
and use the
Config
tab.
The Control UI renders a form from the config schema, with a
Raw JSON
editor as an escape hatch.
Edit
~/.openclaw/openclaw.json
directly. The Gateway watches the file and applies changes automatically (see
hot reload
Strict validation
OpenClaw only accepts configurations that fully match the schema. Unknown keys, malformed types, or invalid values cause the Gateway to
refuse to start
. The only root-level exception is
$schema
(string), so editors can attach JSON Schema metadata.
When validation fails:
The Gateway does not boot
Only diagnostic commands work (
openclaw doctor
openclaw logs
openclaw health
openclaw status
Run
openclaw doctor
to see exact issues
Run
openclaw doctor --fix
(or
--yes
) to apply repairs
Common tasks
Set up a channel (WhatsApp, Telegram, Discord, etc.)
Each channel has its own config section under
channels.<provider>
. See the dedicated channel page for setup steps:
WhatsApp
channels.whatsapp
Telegram
channels.telegram
Discord
channels.discord
Slack
channels.slack
Signal
channels.signal
iMessage
channels.imessage
Google Chat
channels.googlechat
Mattermost
channels.mattermost
MS Teams
channels.msteams
All channels share the same DM policy pattern:
channels
telegram
enabled
true
botToken
"123:abc"
dmPolicy
"pairing"
// pairing | allowlist | open | disabled
allowFrom
"tg:123"
// only for allowlist/open
Choose and configure models
Set the primary model and optional fallbacks:
agents
defaults
model
primary
"anthropic/claude-sonnet-4-5"
fallbacks
"openai/gpt-5.2"
models
"anthropic/claude-sonnet-4-5"
alias
"Sonnet"
"openai/gpt-5.2"
alias
"GPT"
agents.defaults.models
defines the model catalog and acts as the allowlist for
/model
Model refs use
provider/model
format (e.g.
anthropic/claude-opus-4-6
See
Models CLI
for switching models in chat and
Model Failover
for auth rotation and fallback behavior.
For custom/self-hosted providers, see
Custom providers
in the reference.
Control who can message the bot
DM access is controlled per channel via
dmPolicy
"pairing"
(default): unknown senders get a one-time pairing code to approve
"allowlist"
: only senders in
allowFrom
(or the paired allow store)
"open"
: allow all inbound DMs (requires
allowFrom: ["*"]
"disabled"
: ignore all DMs
For groups, use
groupPolicy
groupAllowFrom
or channel-specific allowlists.
See the
full reference
for per-channel details.
Set up group chat mention gating
Group messages default to
require mention
. Configure patterns per agent:
agents
list
"main"
groupChat
mentionPatterns
"@openclaw"
"openclaw"
channels
whatsapp
groups
"*"
requireMention
true
} }
Metadata mentions
: native @-mentions (WhatsApp tap-to-mention, Telegram @bot, etc.)
Text patterns
: regex patterns in
mentionPatterns
See
full reference
for per-channel overrides and self-chat mode.
Configure sessions and resets
Sessions control conversation continuity and isolation:
session
dmScope
"per-channel-peer"
// recommended for multi-user
reset
mode
"daily"
atHour
idleMinutes
120
dmScope
main
(shared) |
per-peer
per-channel-peer
per-account-channel-peer
See
Session Management
for scoping, identity links, and send policy.
See
full reference
for all fields.
Enable sandboxing
Run agent sessions in isolated Docker containers:
agents
defaults
sandbox
mode
"non-main"
// off | non-main | all
scope
"agent"
// session | agent | shared
Build the image first:
scripts/sandbox-setup.sh
See
Sandboxing
for the full guide and
full reference
for all options.
Set up heartbeat (periodic check-ins)
agents
defaults
heartbeat
every
"30m"
target
"last"
every
: duration string (
30m
). Set
to disable.
target
last
whatsapp
telegram
discord
none
See
Heartbeat
for the full guide.
Configure cron jobs
cron
enabled
true
maxConcurrentRuns
sessionRetention
"24h"
See
Cron jobs
for the feature overview and CLI examples.
Set up webhooks (hooks)
Enable HTTP webhook endpoints on the Gateway:
hooks
enabled
true
token
"shared-secret"
path
"/hooks"
defaultSessionKey
"hook:ingress"
allowRequestSessionKey
false
allowedSessionKeyPrefixes
"hook:"
mappings
match
path
"gmail"
action
"agent"
agentId
"main"
deliver
true
See
full reference
for all mapping options and Gmail integration.
Configure multi-agent routing
Run multiple isolated agents with separate workspaces and sessions:
agents
list
"home"
default
true
workspace
"~/.openclaw/workspace-home"
"work"
workspace
"~/.openclaw/workspace-work"
bindings
agentId
"home"
match
channel
"whatsapp"
accountId
"personal"
} }
agentId
"work"
match
channel
"whatsapp"
accountId
"biz"
} }
See
Multi-Agent
and
full reference
for binding rules and per-agent access profiles.
Split config into multiple files ($include)
Use
$include
to organize large configs:
// ~/.openclaw/openclaw.json
gateway
port
18789 }
agents
{ $
include
"./agents.json5"
broadcast
include
"./clients/a.json5"
"./clients/b.json5"
Single file
: replaces the containing object
Array of files
: deep-merged in order (later wins)
Sibling keys
: merged after includes (override included values)
Nested includes
: supported up to 10 levels deep
Relative paths
: resolved relative to the including file
Error handling
: clear errors for missing files, parse errors, and circular includes
Config hot reload
The Gateway watches
~/.openclaw/openclaw.json
and applies changes automatically — no manual restart needed for most settings.
Reload modes
Mode
Behavior
hybrid
(default)
Hot-applies safe changes instantly. Automatically restarts for critical ones.
hot
Hot-applies safe changes only. Logs a warning when a restart is needed — you handle it.
restart
Restarts the Gateway on any config change, safe or not.
off
Disables file watching. Changes take effect on the next manual restart.
gateway
reload
mode
"hybrid"
debounceMs
300 }
What hot-applies vs what needs a restart
Most fields hot-apply without downtime. In
hybrid
mode, restart-required changes are handled automatically.
Category
Fields
Restart needed?
Channels
channels.*
web
(WhatsApp) — all built-in and extension channels
Agent & models
agent
agents
models
routing
Automation
hooks
cron
agent.heartbeat
Sessions & messages
session
messages
Tools & media
tools
browser
skills
audio
talk
UI & misc
logging
identity
bindings
Gateway server
gateway.*
(port, bind, auth, tailscale, TLS, HTTP)
Yes
Infrastructure
discovery
canvasHost
plugins
Yes
gateway.reload
and
gateway.remote
are exceptions — changing them does
not
trigger a restart.
Config RPC (programmatic updates)
config.apply (full replace)
Validates + writes the full config and restarts the Gateway in one step.
config.apply
replaces the
entire config
. Use
config.patch
for partial updates, or
openclaw config set
for single keys.
Params:
raw
(string) — JSON5 payload for the entire config
baseHash
(optional) — config hash from
config.get
(required when config exists)
sessionKey
(optional) — session key for the post-restart wake-up ping
note
(optional) — note for the restart sentinel
restartDelayMs
(optional) — delay before restart (default 2000)
openclaw
gateway
call
config.get
--params
'{}'
# capture payload.hash
openclaw
gateway
call
config.apply
--params
'{
"raw": "{ agents: { defaults: { workspace: \"~/.openclaw/workspace\" } } }",
"baseHash": "<hash>",
"sessionKey": "agent:main:whatsapp:dm:+15555550123"
}'
config.patch (partial update)
Merges a partial update into the existing config (JSON merge patch semantics):
Objects merge recursively
null
deletes a key
Arrays replace
Params:
raw
(string) — JSON5 with just the keys to change
baseHash
(required) — config hash from
config.get
sessionKey
note
restartDelayMs
— same as
config.apply
openclaw
gateway
call
config.patch
--params
'{
"raw": "{ channels: { telegram: { groups: { \"*\": { requireMention: false } } } } }",
"baseHash": "<hash>"
}'
Environment variables
OpenClaw reads env vars from the parent process plus:
.env
from the current working directory (if present)
~/.openclaw/.env
(global fallback)
Neither file overrides existing env vars. You can also set inline env vars in config:
env
OPENROUTER_API_KEY
"sk-or-..."
vars
GROQ_API_KEY
"gsk-..."
Shell env import (optional)
If enabled and expected keys aren’t set, OpenClaw runs your login shell and imports only the missing keys:
env
shellEnv
enabled
true
timeoutMs
15000 }
Env var equivalent:
OPENCLAW_LOAD_SHELL_ENV=1
Env var substitution in config values
Reference env vars in any config string value with
${VAR_NAME}
gateway
auth
token
"${OPENCLAW_GATEWAY_TOKEN}"
} }
models
providers
custom
apiKey
"${CUSTOM_API_KEY}"
} } }
Rules:
Only uppercase names matched:
[A-Z_][A-Z0-9_]*
Missing/empty vars throw an error at load time
Escape with
$${VAR}
for literal output
Works inside
$include
files
Inline substitution:
"${BASE}/v1"
"https://api.example.com/v1"
See
Environment
for full precedence and sources.
Full reference
For the complete field-by-field reference, see
Configuration Reference
Related:
Configuration Examples
Configuration Reference
Doctor
Gateway Runbook
Configuration Reference

---
## Gateway > Discovery

[Source: https://docs.openclaw.ai/gateway/discovery]

Discovery and Transports
Discovery & transports
OpenClaw has two distinct problems that look similar on the surface:
Operator remote control
: the macOS menu bar app controlling a gateway running elsewhere.
Node pairing
: iOS/Android (and future nodes) finding a gateway and pairing securely.
The design goal is to keep all network discovery/advertising in the
Node Gateway
openclaw gateway
) and keep clients (mac app, iOS) as consumers.
Terms
Gateway
: a single long-running gateway process that owns state (sessions, pairing, node registry) and runs channels. Most setups use one per host; isolated multi-gateway setups are possible.
Gateway WS (control plane)
: the WebSocket endpoint on
127.0.0.1:18789
by default; can be bound to LAN/tailnet via
gateway.bind
Direct WS transport
: a LAN/tailnet-facing Gateway WS endpoint (no SSH).
SSH transport (fallback)
: remote control by forwarding
127.0.0.1:18789
over SSH.
Legacy TCP bridge (deprecated/removed)
: older node transport (see
Bridge protocol
); no longer advertised for discovery.
Protocol details:
Gateway protocol
Bridge protocol (legacy)
Why we keep both “direct” and SSH
Direct WS
is the best UX on the same network and within a tailnet:
auto-discovery on LAN via Bonjour
pairing tokens + ACLs owned by the gateway
no shell access required; protocol surface can stay tight and auditable
SSH
remains the universal fallback:
works anywhere you have SSH access (even across unrelated networks)
survives multicast/mDNS issues
requires no new inbound ports besides SSH
Discovery inputs (how clients learn where the gateway is)
1) Bonjour / mDNS (LAN only)
Bonjour is best-effort and does not cross networks. It is only used for “same LAN” convenience.
Target direction:
The
gateway
advertises its WS endpoint via Bonjour.
Clients browse and show a “pick a gateway” list, then store the chosen endpoint.
Troubleshooting and beacon details:
Bonjour
Service beacon details
Service types:
_openclaw-gw._tcp
(gateway transport beacon)
TXT keys (non-secret):
role=gateway
lanHost=<hostname>.local
sshPort=22
(or whatever is advertised)
gatewayPort=18789
(Gateway WS + HTTP)
gatewayTls=1
(only when TLS is enabled)
gatewayTlsSha256=<sha256>
(only when TLS is enabled and fingerprint is available)
canvasPort=<port>
(canvas host port; currently the same as
gatewayPort
when the canvas host is enabled)
cliPath=<path>
(optional; absolute path to a runnable
openclaw
entrypoint or binary)
tailnetDns=<magicdns>
(optional hint; auto-detected when Tailscale is available)
Security notes:
Bonjour/mDNS TXT records are
unauthenticated
. Clients must treat TXT values as UX hints only.
Routing (host/port) should prefer the
resolved service endpoint
(SRV + A/AAAA) over TXT-provided
lanHost
tailnetDns
, or
gatewayPort
TLS pinning must never allow an advertised
gatewayTlsSha256
to override a previously stored pin.
iOS/Android nodes should treat discovery-based direct connects as
TLS-only
and require an explicit “trust this fingerprint” confirmation before storing a first-time pin (out-of-band verification).
Disable/override:
OPENCLAW_DISABLE_BONJOUR=1
disables advertising.
gateway.bind
~/.openclaw/openclaw.json
controls the Gateway bind mode.
OPENCLAW_SSH_PORT
overrides the SSH port advertised in TXT (defaults to 22).
OPENCLAW_TAILNET_DNS
publishes a
tailnetDns
hint (MagicDNS).
OPENCLAW_CLI_PATH
overrides the advertised CLI path.
2) Tailnet (cross-network)
For London/Vienna style setups, Bonjour won’t help. The recommended “direct” target is:
Tailscale MagicDNS name (preferred) or a stable tailnet IP.
If the gateway can detect it is running under Tailscale, it publishes
tailnetDns
as an optional hint for clients (including wide-area beacons).
3) Manual / SSH target
When there is no direct route (or direct is disabled), clients can always connect via SSH by forwarding the loopback gateway port.
See
Remote access
Transport selection (client policy)
Recommended client behavior:
If a paired direct endpoint is configured and reachable, use it.
Else, if Bonjour finds a gateway on LAN, offer a one-tap “Use this gateway” choice and save it as the direct endpoint.
Else, if a tailnet DNS/IP is configured, try direct.
Else, fall back to SSH.
Pairing + auth (direct transport)
The gateway is the source of truth for node/client admission.
Pairing requests are created/approved/rejected in the gateway (see
Gateway pairing
The gateway enforces:
auth (token / keypair)
scopes/ACLs (the gateway is not a raw proxy to every method)
rate limits
Responsibilities by component
Gateway
: advertises discovery beacons, owns pairing decisions, and hosts the WS endpoint.
macOS app
: helps you pick a gateway, shows pairing prompts, and uses SSH only as a fallback.
iOS/Android nodes
: browse Bonjour as a convenience and connect to the paired Gateway WS.
Gateway-Owned Pairing
Bonjour Discovery

---
## Gateway > Doctor

[Source: https://docs.openclaw.ai/gateway/doctor]

4) State integrity checks (session persistence, routing, and safety)
5) Model auth health (OAuth expiry)
6) Hooks model validation
7) Sandbox image repair
8) Gateway service migrations and cleanup hints
9) Security warnings
10) systemd linger (Linux)
11) Skills status
12) Gateway auth checks (local token)
13) Gateway health check + restart
14) Channel status warnings
15) Supervisor config audit + repair
16) Gateway runtime + port diagnostics
17) Gateway runtime best practices
18) Config write + wizard metadata
19) Workspace tips (backup + memory system)
Configuration and operations
Doctor
Doctor
openclaw doctor
is the repair + migration tool for OpenClaw. It fixes stale
config/state, checks health, and provides actionable repair steps.
Quick start
openclaw
doctor
Headless / automation
openclaw
doctor
--yes
Accept defaults without prompting (including restart/service/sandbox repair steps when applicable).
openclaw
doctor
--repair
Apply recommended repairs without prompting (repairs + restarts where safe).
openclaw
doctor
--repair
--force
Apply aggressive repairs too (overwrites custom supervisor configs).
openclaw
doctor
--non-interactive
Run without prompts and only apply safe migrations (config normalization + on-disk state moves). Skips restart/service/sandbox actions that require human confirmation.
Legacy state migrations run automatically when detected.
openclaw
doctor
--deep
Scan system services for extra gateway installs (launchd/systemd/schtasks).
If you want to review changes before writing, open the config file first:
cat
~/.openclaw/openclaw.json
What it does (summary)
Optional pre-flight update for git installs (interactive only).
UI protocol freshness check (rebuilds Control UI when the protocol schema is newer).
Health check + restart prompt.
Skills status summary (eligible/missing/blocked).
Config normalization for legacy values.
OpenCode Zen provider override warnings (
models.providers.opencode
Legacy on-disk state migration (sessions/agent dir/WhatsApp auth).
State integrity and permissions checks (sessions, transcripts, state dir).
Config file permission checks (chmod 600) when running locally.
Model auth health: checks OAuth expiry, can refresh expiring tokens, and reports auth-profile cooldown/disabled states.
Extra workspace dir detection (
~/openclaw
Sandbox image repair when sandboxing is enabled.
Legacy service migration and extra gateway detection.
Gateway runtime checks (service installed but not running; cached launchd label).
Channel status warnings (probed from the running gateway).
Supervisor config audit (launchd/systemd/schtasks) with optional repair.
Gateway runtime best-practice checks (Node vs Bun, version-manager paths).
Gateway port collision diagnostics (default
18789
Security warnings for open DM policies.
Gateway auth warnings when no
gateway.auth.token
is set (local mode; offers token generation).
systemd linger check on Linux.
Source install checks (pnpm workspace mismatch, missing UI assets, missing tsx binary).
Writes updated config + wizard metadata.
Detailed behavior and rationale
0) Optional update (git installs)
If this is a git checkout and doctor is running interactively, it offers to
update (fetch/rebase/build) before running doctor.
1) Config normalization
If the config contains legacy value shapes (for example
messages.ackReaction
without a channel-specific override), doctor normalizes them into the current
schema.
2) Legacy config key migrations
When the config contains deprecated keys, other commands refuse to run and ask
you to run
openclaw doctor
Doctor will:
Explain which legacy keys were found.
Show the migration it applied.
Rewrite
~/.openclaw/openclaw.json
with the updated schema.
The Gateway also auto-runs doctor migrations on startup when it detects a
legacy config format, so stale configs are repaired without manual intervention.
Current migrations:
routing.allowFrom
channels.whatsapp.allowFrom
routing.groupChat.requireMention
channels.whatsapp/telegram/imessage.groups."*".requireMention
routing.groupChat.historyLimit
messages.groupChat.historyLimit
routing.groupChat.mentionPatterns
messages.groupChat.mentionPatterns
routing.queue
messages.queue
routing.bindings
→ top-level
bindings
routing.agents
routing.defaultAgentId
agents.list
agents.list[].default
routing.agentToAgent
tools.agentToAgent
routing.transcribeAudio
tools.media.audio.models
bindings[].match.accountID
bindings[].match.accountId
identity
agents.list[].identity
agent.*
agents.defaults
tools.*
(tools/elevated/exec/sandbox/subagents)
agent.model
allowedModels
modelAliases
modelFallbacks
imageModelFallbacks
agents.defaults.models
agents.defaults.model.primary/fallbacks
agents.defaults.imageModel.primary/fallbacks
2b) OpenCode Zen provider overrides
If you’ve added
models.providers.opencode
(or
opencode-zen
) manually, it
overrides the built-in OpenCode Zen catalog from
@mariozechner/pi-ai
. That can
force every model onto a single API or zero out costs. Doctor warns so you can
remove the override and restore per-model API routing + costs.
3) Legacy state migrations (disk layout)
Doctor can migrate older on-disk layouts into the current structure:
Sessions store + transcripts:
from
~/.openclaw/sessions/
~/.openclaw/agents/<agentId>/sessions/
Agent dir:
from
~/.openclaw/agent/
~/.openclaw/agents/<agentId>/agent/
WhatsApp auth state (Baileys):
from legacy
~/.openclaw/credentials/*.json
(except
oauth.json
~/.openclaw/credentials/whatsapp/<accountId>/...
(default account id:
default
These migrations are best-effort and idempotent; doctor will emit warnings when
it leaves any legacy folders behind as backups. The Gateway/CLI also auto-migrates
the legacy sessions + agent dir on startup so history/auth/models land in the
per-agent path without a manual doctor run. WhatsApp auth is intentionally only
migrated via
openclaw doctor
4) State integrity checks (session persistence, routing, and safety)
The state directory is the operational brainstem. If it vanishes, you lose
sessions, credentials, logs, and config (unless you have backups elsewhere).
Doctor checks:
State dir missing
: warns about catastrophic state loss, prompts to recreate
the directory, and reminds you that it cannot recover missing data.
State dir permissions
: verifies writability; offers to repair permissions
(and emits a
chown
hint when owner/group mismatch is detected).
Session dirs missing
sessions/
and the session store directory are
required to persist history and avoid
ENOENT
crashes.
Transcript mismatch
: warns when recent session entries have missing
transcript files.
Main session “1-line JSONL”
: flags when the main transcript has only one
line (history is not accumulating).
Multiple state dirs
: warns when multiple
~/.openclaw
folders exist across
home directories or when
OPENCLAW_STATE_DIR
points elsewhere (history can
split between installs).
Remote mode reminder
: if
gateway.mode=remote
, doctor reminds you to run
it on the remote host (the state lives there).
Config file permissions
: warns if
~/.openclaw/openclaw.json
group/world readable and offers to tighten to
600
5) Model auth health (OAuth expiry)
Doctor inspects OAuth profiles in the auth store, warns when tokens are
expiring/expired, and can refresh them when safe. If the Anthropic Claude Code
profile is stale, it suggests running
claude setup-token
(or pasting a setup-token).
Refresh prompts only appear when running interactively (TTY);
--non-interactive
skips refresh attempts.
Doctor also reports auth profiles that are temporarily unusable due to:
short cooldowns (rate limits/timeouts/auth failures)
longer disables (billing/credit failures)
6) Hooks model validation
hooks.gmail.model
is set, doctor validates the model reference against the
catalog and allowlist and warns when it won’t resolve or is disallowed.
7) Sandbox image repair
When sandboxing is enabled, doctor checks Docker images and offers to build or
switch to legacy names if the current image is missing.
8) Gateway service migrations and cleanup hints
Doctor detects legacy gateway services (launchd/systemd/schtasks) and
offers to remove them and install the OpenClaw service using the current gateway
port. It can also scan for extra gateway-like services and print cleanup hints.
Profile-named OpenClaw gateway services are considered first-class and are not
flagged as “extra.”
9) Security warnings
Doctor emits warnings when a provider is open to DMs without an allowlist, or
when a policy is configured in a dangerous way.
10) systemd linger (Linux)
If running as a systemd user service, doctor ensures lingering is enabled so the
gateway stays alive after logout.
11) Skills status
Doctor prints a quick summary of eligible/missing/blocked skills for the current
workspace.
12) Gateway auth checks (local token)
Doctor warns when
gateway.auth
is missing on a local gateway and offers to
generate a token. Use
openclaw doctor --generate-gateway-token
to force token
creation in automation.
13) Gateway health check + restart
Doctor runs a health check and offers to restart the gateway when it looks
unhealthy.
14) Channel status warnings
If the gateway is healthy, doctor runs a channel status probe and reports
warnings with suggested fixes.
15) Supervisor config audit + repair
Doctor checks the installed supervisor config (launchd/systemd/schtasks) for
missing or outdated defaults (e.g., systemd network-online dependencies and
restart delay). When it finds a mismatch, it recommends an update and can
rewrite the service file/task to the current defaults.
Notes:
openclaw doctor
prompts before rewriting supervisor config.
openclaw doctor --yes
accepts the default repair prompts.
openclaw doctor --repair
applies recommended fixes without prompts.
openclaw doctor --repair --force
overwrites custom supervisor configs.
You can always force a full rewrite via
openclaw gateway install --force
16) Gateway runtime + port diagnostics
Doctor inspects the service runtime (PID, last exit status) and warns when the
service is installed but not actually running. It also checks for port collisions
on the gateway port (default
18789
) and reports likely causes (gateway already
running, SSH tunnel).
17) Gateway runtime best practices
Doctor warns when the gateway service runs on Bun or a version-managed Node path
nvm
fnm
volta
asdf
, etc.). WhatsApp + Telegram channels require Node,
and version-manager paths can break after upgrades because the service does not
load your shell init. Doctor offers to migrate to a system Node install when
available (Homebrew/apt/choco).
18) Config write + wizard metadata
Doctor persists any config changes and stamps wizard metadata to record the
doctor run.
19) Workspace tips (backup + memory system)
Doctor suggests a workspace memory system when missing and prints a backup tip
if the workspace is not already under git.
See
/concepts/agent-workspace
for a full guide to
workspace structure and git backup (recommended private GitHub or GitLab).
Heartbeat
Logging

---
## Gateway > Gateway Lock

[Source: https://docs.openclaw.ai/gateway/gateway-lock]

Gateway Lock
Gateway lock
Last updated: 2025-12-11
Why
Ensure only one gateway instance runs per base port on the same host; additional gateways must use isolated profiles and unique ports.
Survive crashes/SIGKILL without leaving stale lock files.
Fail fast with a clear error when the control port is already occupied.
Mechanism
The gateway binds the WebSocket listener (default
ws://127.0.0.1:18789
) immediately on startup using an exclusive TCP listener.
If the bind fails with
EADDRINUSE
, startup throws
GatewayLockError("another gateway instance is already listening on ws://127.0.0.1:<port>")
The OS releases the listener automatically on any process exit, including crashes and SIGKILL—no separate lock file or cleanup step is needed.
On shutdown the gateway closes the WebSocket server and underlying HTTP server to free the port promptly.
Error surface
If another process holds the port, startup throws
GatewayLockError("another gateway instance is already listening on ws://127.0.0.1:<port>")
Other bind failures surface as
GatewayLockError("failed to bind gateway socket on ws://127.0.0.1:<port>: …")
Operational notes
If the port is occupied by
another
process, the error is the same; free the port or choose another with
openclaw gateway --port <port>
The macOS app still maintains its own lightweight PID guard before spawning the gateway; the runtime lock is enforced by the WebSocket bind.
Logging
Background Exec and Process Tool

---
## Gateway > Health

[Source: https://docs.openclaw.ai/gateway/health]

Health Checks
Health Checks (CLI)
Short guide to verify channel connectivity without guessing.
Quick checks
openclaw status
— local summary: gateway reachability/mode, update hint, linked channel auth age, sessions + recent activity.
openclaw status --all
— full local diagnosis (read-only, color, safe to paste for debugging).
openclaw status --deep
— also probes the running Gateway (per-channel probes when supported).
openclaw health --json
— asks the running Gateway for a full health snapshot (WS-only; no direct Baileys socket).
Send
/status
as a standalone message in WhatsApp/WebChat to get a status reply without invoking the agent.
Logs: tail
/tmp/openclaw/openclaw-*.log
and filter for
web-heartbeat
web-reconnect
web-auto-reply
web-inbound
Deep diagnostics
Creds on disk:
ls -l ~/.openclaw/credentials/whatsapp/<accountId>/creds.json
(mtime should be recent).
Session store:
ls -l ~/.openclaw/agents/<agentId>/sessions/sessions.json
(path can be overridden in config). Count and recent recipients are surfaced via
status
Relink flow:
openclaw channels logout && openclaw channels login --verbose
when status codes 409–515 or
loggedOut
appear in logs. (Note: the QR login flow auto-restarts once for status 515 after pairing.)
When something fails
logged out
or status 409–515 → relink with
openclaw channels logout
then
openclaw channels login
Gateway unreachable → start it:
openclaw gateway --port 18789
(use
--force
if the port is busy).
No inbound messages → confirm linked phone is online and the sender is allowed (
channels.whatsapp.allowFrom
); for group chats, ensure allowlist + mention rules match (
channels.whatsapp.groups
agents.list[].groupChat.mentionPatterns
Dedicated “health” command
openclaw health --json
asks the running Gateway for its health snapshot (no direct channel sockets from the CLI). It reports linked creds/auth age when available, per-channel probe summaries, session-store summary, and a probe duration. It exits non-zero if the Gateway is unreachable or the probe fails/timeouts. Use
--timeout <ms>
to override the 10s default.
Trusted proxy auth
Heartbeat

---
## Gateway > Heartbeat

[Source: https://docs.openclaw.ai/gateway/heartbeat]

# Heartbeat Documentation Summary

## Overview

Heartbeat enables **periodic agent turns** in the main session, allowing models to surface urgent matters without excessive notifications. The feature distinguishes itself from cron jobs through different use cases.

## Quick Start

Basic setup involves:
1. Keeping heartbeats enabled (default: 30 minutes, or 1 hour with Anthropic OAuth)
2. Optionally creating a `HEARTBEAT.md` checklist in the workspace
3. Configuring message routing via the `target` parameter
4. Enabling reasoning delivery for transparency (optional)
5. Restricting to active hours if desired

Key configuration example:
```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last",
        // activeHours: { start: "08:00", end: "24:00" },
        // includeReasoning: true,
      },
    },
  },
}
```

## Core Defaults

- **Interval**: "30m" by default (adjustable or disable with "0m")
- **Prompt**: Reads `HEARTBEAT.md` and replies with "HEARTBEAT_OK" if nothing requires attention
- **Active Hours**: Checked against configured timezone; skipped outside windows
- **Response Contract**: Return "HEARTBEAT_OK" when no action needed; omit it for alerts

## Response Handling

The system recognizes "HEARTBEAT_OK" appearing at message start or end (≤300 characters by default) as acknowledgment and suppresses delivery. Mid-message instances are treated as regular text. Alerts should exclude this token entirely.

## Configuration Scope

Settings cascade through hierarchy: global defaults → per-agent overrides → channel-level settings → multi-account refinements. If any agent has heartbeat configuration, only those agents run heartbeats.

## Active Hours Setup

Business-hours restriction example:
```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        activeHours: {
          start: "09:00",
          end: "22:00",
          timezone: "America/New_York",
        },
      },
    },
  },
}
```

For 24/7 operation, omit `activeHours` or set "00:00" to "24:00". Avoid identical start/end times.

## HEARTBEAT.md (Optional Checklist)

This workspace file serves as a stable reminder list included with each heartbeat. The agent references it strictly and ignores inferred prior tasks. Empty files trigger API call optimization by skipping the run.

The file is updatable through normal chat requests.

## Advanced Features

- **Reasoning Delivery**: Enable `includeReasoning: true` for transparency
- **Manual Wake**: Trigger immediate heartbeats via `openclaw system event`
- **Multi-Account Channels**: Use `accountId` to target specific accounts (Telegram, etc.)
- **Visibility Controls**: Configure `showOk`, `showAlerts`, and `useIndicator` per-channel or per-account

## Cost Considerations

Heartbeats consume full agent turns. Shorter intervals increase token usage. Maintaining minimal `HEARTBEAT.md` files and selecting appropriate models helps optimize costs.

---
## Gateway > Local Models

[Source: https://docs.openclaw.ai/gateway/local-models]

Recommended: LM Studio + MiniMax M2.1 (Responses API, full-size)
Hybrid config: hosted primary, local fallback
Local-first with hosted safety net
Regional hosting / data routing
Other OpenAI-compatible local proxies
Troubleshooting
Protocols and APIs
Local Models
Local models
Local is doable, but OpenClaw expects large context + strong defenses against prompt injection. Small cards truncate context and leak safety. Aim high:
≥2 maxed-out Mac Studios or equivalent GPU rig (~$30k+)
. A single
24 GB
GPU works only for lighter prompts with higher latency. Use the
largest / full-size model variant you can run
; aggressively quantized or “small” checkpoints raise prompt-injection risk (see
Security
Recommended: LM Studio + MiniMax M2.1 (Responses API, full-size)
Best current local stack. Load MiniMax M2.1 in LM Studio, enable the local server (default
http://127.0.0.1:1234
), and use Responses API to keep reasoning separate from final text.
agents
defaults
model
primary
"lmstudio/minimax-m2.1-gs32"
models
"anthropic/claude-opus-4-6"
alias
"Opus"
"lmstudio/minimax-m2.1-gs32"
alias
"Minimax"
models
mode
"merge"
providers
lmstudio
baseUrl
"http://127.0.0.1:1234/v1"
apiKey
"lmstudio"
api
"openai-responses"
models
"minimax-m2.1-gs32"
name
"MiniMax M2.1 GS32"
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
196608
maxTokens
8192
Setup checklist
Install LM Studio:
https://lmstudio.ai
In LM Studio, download the
largest MiniMax M2.1 build available
(avoid “small”/heavily quantized variants), start the server, confirm
http://127.0.0.1:1234/v1/models
lists it.
Keep the model loaded; cold-load adds startup latency.
Adjust
contextWindow
maxTokens
if your LM Studio build differs.
For WhatsApp, stick to Responses API so only final text is sent.
Keep hosted models configured even when running local; use
models.mode: "merge"
so fallbacks stay available.
Hybrid config: hosted primary, local fallback
agents
defaults
model
primary
"anthropic/claude-sonnet-4-5"
fallbacks
"lmstudio/minimax-m2.1-gs32"
"anthropic/claude-opus-4-6"
models
"anthropic/claude-sonnet-4-5"
alias
"Sonnet"
"lmstudio/minimax-m2.1-gs32"
alias
"MiniMax Local"
"anthropic/claude-opus-4-6"
alias
"Opus"
models
mode
"merge"
providers
lmstudio
baseUrl
"http://127.0.0.1:1234/v1"
apiKey
"lmstudio"
api
"openai-responses"
models
"minimax-m2.1-gs32"
name
"MiniMax M2.1 GS32"
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
196608
maxTokens
8192
Local-first with hosted safety net
Swap the primary and fallback order; keep the same providers block and
models.mode: "merge"
so you can fall back to Sonnet or Opus when the local box is down.
Regional hosting / data routing
Hosted MiniMax/Kimi/GLM variants also exist on OpenRouter with region-pinned endpoints (e.g., US-hosted). Pick the regional variant there to keep traffic in your chosen jurisdiction while still using
models.mode: "merge"
for Anthropic/OpenAI fallbacks.
Local-only remains the strongest privacy path; hosted regional routing is the middle ground when you need provider features but want control over data flow.
Other OpenAI-compatible local proxies
vLLM, LiteLLM, OAI-proxy, or custom gateways work if they expose an OpenAI-style
/v1
endpoint. Replace the provider block above with your endpoint and model ID:
models
mode
"merge"
providers
local
baseUrl
"http://127.0.0.1:8000/v1"
apiKey
"sk-local"
api
"openai-responses"
models
"my-local-model"
name
"Local Model"
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
120000
maxTokens
8192
Keep
models.mode: "merge"
so hosted models stay available as fallbacks.
Troubleshooting
Gateway can reach the proxy?
curl http://127.0.0.1:1234/v1/models
LM Studio model unloaded? Reload; cold start is a common “hanging” cause.
Context errors? Lower
contextWindow
or raise your server limit.
Safety: local models skip provider-side filters; keep agents narrow and compaction on to limit prompt injection blast radius.
CLI Backends
Network model

---
## Gateway > Logging

[Source: https://docs.openclaw.ai/gateway/logging]

OpenClaw has two log “surfaces”:
Console output
(what you see in the terminal / Debug UI).
File logs
(JSON lines) written by the gateway logger.
File-based logger
Default rolling log file is under
/tmp/openclaw/
(one file per day):
openclaw-YYYY-MM-DD.log
Date uses the gateway host’s local timezone.
The log file path and level can be configured via
~/.openclaw/openclaw.json
logging.file
logging.level
The file format is one JSON object per line.
The Control UI Logs tab tails this file via the gateway (
logs.tail
CLI can do the same:
openclaw
logs
--follow
Verbose vs. log levels
File logs
are controlled exclusively by
logging.level
--verbose
only affects
console verbosity
(and WS log style); it does
not
raise the file log level.
To capture verbose-only details in file logs, set
logging.level
debug
trace
Console capture
The CLI captures
console.log/info/warn/error/debug/trace
and writes them to file logs,
while still printing to stdout/stderr.
You can tune console verbosity independently via:
logging.consoleLevel
(default
info
logging.consoleStyle
pretty
compact
json
Tool summary redaction
Verbose tool summaries (e.g.
🛠️ Exec: ...
) can mask sensitive tokens before they hit the
console stream. This is
tools-only
and does not alter file logs.
logging.redactSensitive
off
tools
(default:
tools
logging.redactPatterns
: array of regex strings (overrides defaults)
Use raw regex strings (auto
), or
/pattern/flags
if you need custom flags.
Matches are masked by keeping the first 6 + last 4 chars (length >= 18), otherwise
***
Defaults cover common key assignments, CLI flags, JSON fields, bearer headers, PEM blocks, and popular token prefixes.
Gateway WebSocket logs
The gateway prints WebSocket protocol logs in two modes:
Normal mode (no
--verbose
: only “interesting” RPC results are printed:
errors (
ok=false
slow calls (default threshold:
>= 50ms
parse errors
Verbose mode (
--verbose
: prints all WS request/response traffic.
WS log style
openclaw gateway
supports a per-gateway style switch:
--ws-log auto
(default): normal mode is optimized; verbose mode uses compact output
--ws-log compact
: compact output (paired request/response) when verbose
--ws-log full
: full per-frame output when verbose
--compact
: alias for
--ws-log compact
Examples:
# optimized (only errors/slow)
openclaw
gateway
# show all WS traffic (paired)
openclaw
gateway
--verbose
--ws-log
compact
# show all WS traffic (full meta)
openclaw
gateway
--verbose
--ws-log
full
Console formatting (subsystem logging)
The console formatter is
TTY-aware
and prints consistent, prefixed lines.
Subsystem loggers keep output grouped and scannable.
Behavior:
Subsystem prefixes
on every line (e.g.
[gateway]
[canvas]
[tailscale]
Subsystem colors
(stable per subsystem) plus level coloring
Color when output is a TTY or the environment looks like a rich terminal
TERM
COLORTERM
TERM_PROGRAM
), respects
NO_COLOR
Shortened subsystem prefixes
: drops leading
gateway/
channels/
, keeps last 2 segments (e.g.
whatsapp/outbound
Sub-loggers by subsystem
(auto prefix + structured field
{ subsystem }
logRaw()
for QR/UX output (no prefix, no formatting)
Console styles
(e.g.
pretty | compact | json
Console log level
separate from file log level (file keeps full detail when
logging.level
is set to
debug
trace
WhatsApp message bodies
are logged at
debug
(use
--verbose
to see them)
This keeps existing file logs stable while making interactive output scannable.
Doctor
Gateway Lock

---
## Gateway > Multiple Gateways

[Source: https://docs.openclaw.ai/gateway/multiple-gateways]

Configuration Reference
Configuration Examples
Authentication
Trusted proxy auth
Health Checks
Heartbeat
Doctor
Logging
Gateway Lock
Background Exec and Process Tool
Multiple Gateways
Troubleshooting
Security and sandboxing
Protocols and APIs
Networking and discovery
Remote access
Remote Access
Remote Gateway Setup
Tailscale
Security
Formal Verification (Security Models)
Web interfaces
Web
Control UI
Dashboard
WebChat
TUI
Multiple Gateways (same host)
Isolation checklist (required)
Recommended: profiles (--profile)
Rescue-bot guide
How to install (rescue bot)
Port mapping (derived)
Browser/CDP notes (common footgun)
Manual env example
Quick checks
Configuration and operations
Multiple Gateways
Multiple Gateways (same host)
Most setups should use one Gateway because a single Gateway can handle multiple messaging connections and agents. If you need stronger isolation or redundancy (e.g., a rescue bot), run separate Gateways with isolated profiles/ports.
Isolation checklist (required)
OPENCLAW_CONFIG_PATH
— per-instance config file
OPENCLAW_STATE_DIR
— per-instance sessions, creds, caches
agents.defaults.workspace
— per-instance workspace root
gateway.port
(or
--port
) — unique per instance
Derived ports (browser/canvas) must not overlap
If these are shared, you will hit config races and port conflicts.
Recommended: profiles (
--profile
Profiles auto-scope
OPENCLAW_STATE_DIR
OPENCLAW_CONFIG_PATH
and suffix service names.
# main
openclaw
--profile
main
setup
openclaw
--profile
main
gateway
--port
18789
# rescue
openclaw
--profile
rescue
setup
openclaw
--profile
rescue
gateway
--port
19001
Per-profile services:
openclaw
--profile
main
gateway
install
openclaw
--profile
rescue
gateway
install
Rescue-bot guide
Run a second Gateway on the same host with its own:
profile/config
state dir
workspace
base port (plus derived ports)
This keeps the rescue bot isolated from the main bot so it can debug or apply config changes if the primary bot is down.
Port spacing: leave at least 20 ports between base ports so the derived browser/canvas/CDP ports never collide.
How to install (rescue bot)
# Main bot (existing or fresh, without --profile param)
# Runs on port 18789 + Chrome CDC/Canvas/... Ports
openclaw
onboard
openclaw
gateway
install
# Rescue bot (isolated profile + ports)
openclaw
--profile
rescue
onboard
# Notes:
# - workspace name will be postfixed with -rescue per default
# - Port should be at least 18789 + 20 Ports,
# better choose completely different base port, like 19789,
# - rest of the onboarding is the same as normal
# To install the service (if not happened automatically during onboarding)
openclaw
--profile
rescue
gateway
install
Port mapping (derived)
Base port =
gateway.port
(or
OPENCLAW_GATEWAY_PORT
--port
browser control service port = base + 2 (loopback only)
canvas host is served on the Gateway HTTP server (same port as
gateway.port
Browser profile CDP ports auto-allocate from
browser.controlPort + 9 .. + 108
If you override any of these in config or env, you must keep them unique per instance.
Browser/CDP notes (common footgun)
not
pin
browser.cdpUrl
to the same values on multiple instances.
Each instance needs its own browser control port and CDP range (derived from its gateway port).
If you need explicit CDP ports, set
browser.profiles.<name>.cdpPort
per instance.
Remote Chrome: use
browser.profiles.<name>.cdpUrl
(per profile, per instance).
Manual env example
OPENCLAW_CONFIG_PATH
~/.openclaw/main.json
OPENCLAW_STATE_DIR=~/.openclaw-main \
openclaw
gateway
--port
18789
OPENCLAW_CONFIG_PATH
~/.openclaw/rescue.json
OPENCLAW_STATE_DIR=~/.openclaw-rescue \
openclaw
gateway
--port
19001
Quick checks
openclaw
--profile
main
status
openclaw
--profile
rescue
status
openclaw
--profile
rescue
browser
status
Background Exec and Process Tool
Troubleshooting

---
## Gateway > Network Model

[Source: https://docs.openclaw.ai/gateway/network-model]

Network model
Most operations flow through the Gateway (
openclaw gateway
), a single long-running
process that owns channel connections and the WebSocket control plane.
Core rules
One Gateway per host is recommended. It is the only process allowed to own the WhatsApp Web session. For rescue bots or strict isolation, run multiple gateways with isolated profiles and ports. See
Multiple gateways
Loopback first: the Gateway WS defaults to
ws://127.0.0.1:18789
. The wizard generates a gateway token by default, even for loopback. For tailnet access, run
openclaw gateway --bind tailnet --token ...
because tokens are required for non-loopback binds.
Nodes connect to the Gateway WS over LAN, tailnet, or SSH as needed. The legacy TCP bridge is deprecated.
Canvas host is served by the Gateway HTTP server on the
same port
as the Gateway (default
18789
/__openclaw__/canvas/
/__openclaw__/a2ui/
When
gateway.auth
is configured and the Gateway binds beyond loopback, these routes are protected by Gateway auth (loopback requests are exempt). See
Gateway configuration
canvasHost
gateway
Remote use is typically SSH tunnel or tailnet VPN. See
Remote access
and
Discovery
Local Models
Gateway-Owned Pairing

---
## Gateway > Openai Http Api

[Source: https://docs.openclaw.ai/gateway/openai-http-api]

OpenAI Chat Completions
OpenAI Chat Completions (HTTP)
OpenClaw’s Gateway can serve a small OpenAI-compatible Chat Completions endpoint.
This endpoint is
disabled by default
. Enable it in config first.
POST /v1/chat/completions
Same port as the Gateway (WS + HTTP multiplex):
http://<gateway-host>:<port>/v1/chat/completions
Under the hood, requests are executed as a normal Gateway agent run (same codepath as
openclaw agent
), so routing/permissions/config match your Gateway.
Authentication
Uses the Gateway auth configuration. Send a bearer token:
Authorization: Bearer <token>
Notes:
When
gateway.auth.mode="token"
, use
gateway.auth.token
(or
OPENCLAW_GATEWAY_TOKEN
When
gateway.auth.mode="password"
, use
gateway.auth.password
(or
OPENCLAW_GATEWAY_PASSWORD
gateway.auth.rateLimit
is configured and too many auth failures occur, the endpoint returns
429
with
Retry-After
Choosing an agent
No custom headers required: encode the agent id in the OpenAI
model
field:
model: "openclaw:<agentId>"
(example:
"openclaw:main"
"openclaw:beta"
model: "agent:<agentId>"
(alias)
Or target a specific OpenClaw agent by header:
x-openclaw-agent-id: <agentId>
(default:
main
Advanced:
x-openclaw-session-key: <sessionKey>
to fully control session routing.
Enabling the endpoint
Set
gateway.http.endpoints.chatCompletions.enabled
true
gateway
http
endpoints
chatCompletions
enabled
true
Disabling the endpoint
Set
gateway.http.endpoints.chatCompletions.enabled
false
gateway
http
endpoints
chatCompletions
enabled
false
Session behavior
By default the endpoint is
stateless per request
(a new session key is generated each call).
If the request includes an OpenAI
user
string, the Gateway derives a stable session key from it, so repeated calls can share an agent session.
Streaming (SSE)
Set
stream: true
to receive Server-Sent Events (SSE):
Content-Type: text/event-stream
Each event line is
data: <json>
Stream ends with
data: [DONE]
Examples
Non-streaming:
curl
-sS
http://127.0.0.1:18789/v1/chat/completions
'Authorization: Bearer YOUR_TOKEN'
'Content-Type: application/json'
'x-openclaw-agent-id: main'
'{
"model": "openclaw",
"messages": [{"role":"user","content":"hi"}]
}'
Streaming:
curl
http://127.0.0.1:18789/v1/chat/completions
'Authorization: Bearer YOUR_TOKEN'
'Content-Type: application/json'
'x-openclaw-agent-id: main'
'{
"model": "openclaw",
"stream": true,
"messages": [{"role":"user","content":"hi"}]
}'
Bridge Protocol
Tools Invoke API

---
## Gateway > Pairing

[Source: https://docs.openclaw.ai/gateway/pairing]

is the source of truth for which nodes
are allowed to join. UIs (macOS app, future clients) are just frontends that
approve or reject pending requests.
Important:
WS nodes use
device pairing
(role
node
) during
connect
node.pair.*
is a separate pairing store and does
not
gate the WS handshake.
Only clients that explicitly call
node.pair.*
use this flow.
Concepts
Pending request
: a node asked to join; requires approval.
Paired node
: approved node with an issued auth token.
Transport
: the Gateway WS endpoint forwards requests but does not decide
membership. (Legacy TCP bridge support is deprecated/removed.)
How pairing works
A node connects to the Gateway WS and requests pairing.
The Gateway stores a
pending request
and emits
node.pair.requested
You approve or reject the request (CLI or UI).
On approval, the Gateway issues a
new token
(tokens are rotated on re‑pair).
The node reconnects using the token and is now “paired”.
Pending requests expire automatically after
5 minutes
CLI workflow (headless friendly)
openclaw
nodes
pending
openclaw
nodes
approve
<
requestI
>
openclaw
nodes
reject
<
requestI
>
openclaw
nodes
status
openclaw
nodes
rename
--node
<
name
>
--name
"Living Room iPad"
nodes status
shows paired/connected nodes and their capabilities.
API surface (gateway protocol)
Events:
node.pair.requested
— emitted when a new pending request is created.
node.pair.resolved
— emitted when a request is approved/rejected/expired.
Methods:
node.pair.request
— create or reuse a pending request.
node.pair.list
— list pending + paired nodes.
node.pair.approve
— approve a pending request (issues token).
node.pair.reject
— reject a pending request.
node.pair.verify
— verify
{ nodeId, token }
Notes:
node.pair.request
is idempotent per node: repeated calls return the same
pending request.
Approval
always
generates a fresh token; no token is ever returned from
node.pair.request
Requests may include
silent: true
as a hint for auto-approval flows.
Auto-approval (macOS app)
The macOS app can optionally attempt a
silent approval
when:
the request is marked
silent
, and
the app can verify an SSH connection to the gateway host using the same user.
If silent approval fails, it falls back to the normal “Approve/Reject” prompt.
Storage (local, private)
Pairing state is stored under the Gateway state directory (default
~/.openclaw
~/.openclaw/nodes/paired.json
~/.openclaw/nodes/pending.json
If you override
OPENCLAW_STATE_DIR
, the
nodes/
folder moves with it.
Security notes:
Tokens are secrets; treat
paired.json
as sensitive.
Rotating a token requires re-approval (or deleting the node entry).
Transport behavior
The transport is
stateless
; it does not store membership.
If the Gateway is offline or pairing is disabled, nodes cannot pair.
If the Gateway is in remote mode, pairing still happens against the remote Gateway’s store.
Network model
Discovery and Transports

---
## Gateway > Protocol

[Source: https://docs.openclaw.ai/gateway/protocol]

Gateway Protocol
Gateway protocol (WebSocket)
The Gateway WS protocol is the
single control plane + node transport
for
OpenClaw. All clients (CLI, web UI, macOS app, iOS/Android nodes, headless
nodes) connect over WebSocket and declare their
role
scope
handshake time.
Transport
WebSocket, text frames with JSON payloads.
First frame
must
be a
connect
request.
Handshake (connect)
Gateway → Client (pre-connect challenge):
"type"
"event"
"event"
"connect.challenge"
"payload"
"nonce"
"…"
"ts"
1737264000000
Client → Gateway:
"type"
"req"
"id"
"…"
"method"
"connect"
"params"
"minProtocol"
"maxProtocol"
"client"
"id"
"cli"
"version"
"1.2.3"
"platform"
"macos"
"mode"
"operator"
"role"
"operator"
"scopes"
"operator.read"
"operator.write"
"caps"
"commands"
"permissions"
"auth"
"token"
"…"
"locale"
"en-US"
"userAgent"
"openclaw-cli/1.2.3"
"device"
"id"
"device_fingerprint"
"publicKey"
"…"
"signature"
"…"
"signedAt"
1737264000000
"nonce"
"…"
Gateway → Client:
"type"
"res"
"id"
"…"
"ok"
true
"payload"
"type"
"hello-ok"
"protocol"
"policy"
"tickIntervalMs"
15000
} }
When a device token is issued,
hello-ok
also includes:
"auth"
"deviceToken"
"…"
"role"
"operator"
"scopes"
"operator.read"
"operator.write"
Node example
"type"
"req"
"id"
"…"
"method"
"connect"
"params"
"minProtocol"
"maxProtocol"
"client"
"id"
"ios-node"
"version"
"1.2.3"
"platform"
"ios"
"mode"
"node"
"role"
"node"
"scopes"
"caps"
"camera"
"canvas"
"screen"
"location"
"voice"
"commands"
"camera.snap"
"canvas.navigate"
"screen.record"
"location.get"
"permissions"
"camera.capture"
true
"screen.record"
false
"auth"
"token"
"…"
"locale"
"en-US"
"userAgent"
"openclaw-ios/1.2.3"
"device"
"id"
"device_fingerprint"
"publicKey"
"…"
"signature"
"…"
"signedAt"
1737264000000
"nonce"
"…"
Framing
Request
{type:"req", id, method, params}
Response
{type:"res", id, ok, payload|error}
Event
{type:"event", event, payload, seq?, stateVersion?}
Side-effecting methods require
idempotency keys
(see schema).
Roles + scopes
Roles
operator
= control plane client (CLI/UI/automation).
node
= capability host (camera/screen/canvas/system.run).
Scopes (operator)
Common scopes:
operator.read
operator.write
operator.admin
operator.approvals
operator.pairing
Caps/commands/permissions (node)
Nodes declare capability claims at connect time:
caps
: high-level capability categories.
commands
: command allowlist for invoke.
permissions
: granular toggles (e.g.
screen.record
camera.capture
The Gateway treats these as
claims
and enforces server-side allowlists.
Presence
system-presence
returns entries keyed by device identity.
Presence entries include
deviceId
roles
, and
scopes
so UIs can show a single row per device
even when it connects as both
operator
and
node
Node helper methods
Nodes may call
skills.bins
to fetch the current list of skill executables
for auto-allow checks.
Exec approvals
When an exec request needs approval, the gateway broadcasts
exec.approval.requested
Operator clients resolve by calling
exec.approval.resolve
(requires
operator.approvals
scope).
Versioning
PROTOCOL_VERSION
lives in
src/gateway/protocol/schema.ts
Clients send
minProtocol
maxProtocol
; the server rejects mismatches.
Schemas + models are generated from TypeBox definitions:
pnpm protocol:gen
pnpm protocol:gen:swift
pnpm protocol:check
Auth
OPENCLAW_GATEWAY_TOKEN
(or
--token
) is set,
connect.params.auth.token
must match or the socket is closed.
After pairing, the Gateway issues a
device token
scoped to the connection
role + scopes. It is returned in
hello-ok.auth.deviceToken
and should be
persisted by the client for future connects.
Device tokens can be rotated/revoked via
device.token.rotate
and
device.token.revoke
(requires
operator.pairing
scope).
Device identity + pairing
Nodes should include a stable device identity (
device.id
) derived from a
keypair fingerprint.
Gateways issue tokens per device + role.
Pairing approvals are required for new device IDs unless local auto-approval
is enabled.
Local
connects include loopback and the gateway host’s own tailnet address
(so same‑host tailnet binds can still auto‑approve).
All WS clients must include
device
identity during
connect
(operator + node).
Control UI can omit it
only
when
gateway.controlUi.allowInsecureAuth
is enabled
(or
gateway.controlUi.dangerouslyDisableDeviceAuth
for break-glass use).
Non-local connections must sign the server-provided
connect.challenge
nonce.
TLS + pinning
TLS is supported for WS connections.
Clients may optionally pin the gateway cert fingerprint (see
gateway.tls
config plus
gateway.remote.tlsFingerprint
or CLI
--tls-fingerprint
Scope
This protocol exposes the
full gateway API
(status, channels, models, chat,
agent, sessions, nodes, approvals, etc.). The exact surface is defined by the
TypeBox schemas in
src/gateway/protocol/schema.ts
Sandbox vs Tool Policy vs Elevated
Bridge Protocol

---
## Gateway > Remote Gateway Readme

[Source: https://docs.openclaw.ai/gateway/remote-gateway-readme]

OpenClaw.app uses SSH tunneling to connect to a remote gateway. This guide shows you how to set it up.
Overview
Quick Setup
Step 1: Add SSH Config
Edit
~/.ssh/config
and add:
Host remote-gateway
HostName <REMOTE_IP> # e.g., 172.27.187.184
User <REMOTE_USER> # e.g., jefferson
LocalForward 18789 127.0.0.1:18789
IdentityFile ~/.ssh/id_rsa
Replace
<REMOTE_IP>
and
<REMOTE_USER>
with your values.
Step 2: Copy SSH Key
Copy your public key to the remote machine (enter password once):
ssh-copy-id
~/.ssh/id_rsa
<
REMOTE_USE
>
<
REMOTE_I
>
Step 3: Set Gateway Token
launchctl
setenv
OPENCLAW_GATEWAY_TOKEN
"<your-token>"
Step 4: Start SSH Tunnel
ssh
remote-gateway
&
Step 5: Restart OpenClaw.app
# Quit OpenClaw.app (⌘Q), then reopen:
open
/path/to/OpenClaw.app
The app will now connect to the remote gateway through the SSH tunnel.
Auto-Start Tunnel on Login
To have the SSH tunnel start automatically when you log in, create a Launch Agent.
Create the PLIST file
Save this as
~/Library/LaunchAgents/bot.molt.ssh-tunnel.plist
<?
xml
version
"1.0"
encoding
"UTF-8"
?>
<!
DOCTYPE
plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<
plist
version
"1.0"
>
<
dict
>
<
key
>Label</
key
>
<
string
>bot.molt.ssh-tunnel</
string
>
<
key
>ProgramArguments</
key
>
<
array
>
<
string
>/usr/bin/ssh</
string
>
<
string
>-N</
string
>
<
string
>remote-gateway</
string
>
</
array
>
<
key
>KeepAlive</
key
>
<
true
/>
<
key
>RunAtLoad</
key
>
<
true
/>
</
dict
>
</
plist
>
Load the Launch Agent
launchctl
bootstrap
gui/
$UID
~/Library/LaunchAgents/bot.molt.ssh-tunnel.plist
The tunnel will now:
Start automatically when you log in
Restart if it crashes
Keep running in the background
Legacy note: remove any leftover
com.openclaw.ssh-tunnel
LaunchAgent if present.
Troubleshooting
Check if tunnel is running:
aux
grep
"ssh -N remote-gateway"
grep
grep
lsof
:18789
Restart the tunnel:
launchctl
kickstart
gui/
$UID
/bot.molt.ssh-tunnel
Stop the tunnel:
launchctl
bootout
gui/
$UID
/bot.molt.ssh-tunnel
How It Works
Component
What It Does
LocalForward 18789 127.0.0.1:18789
Forwards local port 18789 to remote port 18789
ssh -N
SSH without executing remote commands (just port forwarding)
KeepAlive
Automatically restarts tunnel if it crashes
RunAtLoad
Starts tunnel when the agent loads
OpenClaw.app connects to
ws://127.0.0.1:18789
on your client machine. The SSH tunnel forwards that connection to port 18789 on the remote machine where the Gateway is running.
Remote Access
Tailscale

---
## Gateway > Remote

[Source: https://docs.openclaw.ai/gateway/remote]

3) Laptop runs the Gateway, remote access from other machines
Command flow (what runs where)
SSH tunnel (CLI + tools)
CLI remote defaults
Chat UI over SSH
macOS app “Remote over SSH”
Security rules (remote/VPN)
Remote access
Remote Access
Remote access (SSH, tunnels, and tailnets)
This repo supports “remote over SSH” by keeping a single Gateway (the master) running on a dedicated host (desktop/server) and connecting clients to it.
For
operators (you / the macOS app)
: SSH tunneling is the universal fallback.
For
nodes (iOS/Android and future devices)
: connect to the Gateway
WebSocket
(LAN/tailnet or SSH tunnel as needed).
The core idea
The Gateway WebSocket binds to
loopback
on your configured port (defaults to 18789).
For remote use, you forward that loopback port over SSH (or use a tailnet/VPN and tunnel less).
Common VPN/tailnet setups (where the agent lives)
Think of the
Gateway host
as “where the agent lives.” It owns sessions, auth profiles, channels, and state.
Your laptop/desktop (and nodes) connect to that host.
1) Always-on Gateway in your tailnet (VPS or home server)
Run the Gateway on a persistent host and reach it via
Tailscale
or SSH.
Best UX:
keep
gateway.bind: "loopback"
and use
Tailscale Serve
for the Control UI.
Fallback:
keep loopback + SSH tunnel from any machine that needs access.
Examples:
exe.dev
(easy VM) or
Hetzner
(production VPS).
This is ideal when your laptop sleeps often but you want the agent always-on.
2) Home desktop runs the Gateway, laptop is remote control
The laptop does
not
run the agent. It connects remotely:
Use the macOS app’s
Remote over SSH
mode (Settings → General → “OpenClaw runs”).
The app opens and manages the tunnel, so WebChat + health checks “just work.”
Runbook:
macOS remote access
3) Laptop runs the Gateway, remote access from other machines
Keep the Gateway local but expose it safely:
SSH tunnel to the laptop from other machines, or
Tailscale Serve the Control UI and keep the Gateway loopback-only.
Guide:
Tailscale
and
Web overview
Command flow (what runs where)
One gateway service owns state + channels. Nodes are peripherals.
Flow example (Telegram → node):
Telegram message arrives at the
Gateway
Gateway runs the
agent
and decides whether to call a node tool.
Gateway calls the
node
over the Gateway WebSocket (
node.*
RPC).
Node returns the result; Gateway replies back out to Telegram.
Notes:
Nodes do not run the gateway service.
Only one gateway should run per host unless you intentionally run isolated profiles (see
Multiple gateways
macOS app “node mode” is just a node client over the Gateway WebSocket.
SSH tunnel (CLI + tools)
Create a local tunnel to the remote Gateway WS:
ssh
18789:127.0.0.1:18789
user@host
With the tunnel up:
openclaw health
and
openclaw status --deep
now reach the remote gateway via
ws://127.0.0.1:18789
openclaw gateway {status,health,send,agent,call}
can also target the forwarded URL via
--url
when needed.
Note: replace
18789
with your configured
gateway.port
(or
--port
OPENCLAW_GATEWAY_PORT
Note: when you pass
--url
, the CLI does not fall back to config or environment credentials.
Include
--token
--password
explicitly. Missing explicit credentials is an error.
CLI remote defaults
You can persist a remote target so CLI commands use it by default:
gateway
mode
"remote"
remote
url
"ws://127.0.0.1:18789"
token
"your-token"
When the gateway is loopback-only, keep the URL at
ws://127.0.0.1:18789
and open the SSH tunnel first.
Chat UI over SSH
WebChat no longer uses a separate HTTP port. The SwiftUI chat UI connects directly to the Gateway WebSocket.
Forward
18789
over SSH (see above), then connect clients to
ws://127.0.0.1:18789
On macOS, prefer the app’s “Remote over SSH” mode, which manages the tunnel automatically.
macOS app “Remote over SSH”
The macOS menu bar app can drive the same setup end-to-end (remote status checks, WebChat, and Voice Wake forwarding).
Runbook:
macOS remote access
Security rules (remote/VPN)
Short version:
keep the Gateway loopback-only
unless you’re sure you need a bind.
Loopback + SSH/Tailscale Serve
is the safest default (no public exposure).
Non-loopback binds
lan
tailnet
custom
, or
auto
when loopback is unavailable) must use auth tokens/passwords.
gateway.remote.token
only
for remote CLI calls — it does
not
enable local auth.
gateway.remote.tlsFingerprint
pins the remote TLS cert when using
wss://
Tailscale Serve
can authenticate via identity headers when
gateway.auth.allowTailscale: true
Set it to
false
if you want tokens/passwords instead.
Treat browser control like operator access: tailnet-only + deliberate node pairing.
Deep dive:
Security
Bonjour Discovery
Remote Gateway Setup

---
## Gateway > Sandbox Vs Tool Policy Vs Elevated

[Source: https://docs.openclaw.ai/gateway/sandbox-vs-tool-policy-vs-elevated]

OpenClaw has three related (but different) controls:
Sandbox
agents.defaults.sandbox.*
agents.list[].sandbox.*
) decides
where tools run
(Docker vs host).
Tool policy
tools.*
tools.sandbox.tools.*
agents.list[].tools.*
) decides
which tools are available/allowed
Elevated
tools.elevated.*
agents.list[].tools.elevated.*
) is an
exec-only escape hatch
to run on the host when you’re sandboxed.
Quick debug
Use the inspector to see what OpenClaw is
actually
doing:
openclaw
sandbox
explain
openclaw
sandbox
explain
--session
agent:main:main
openclaw
sandbox
explain
--agent
work
openclaw
sandbox
explain
--json
It prints:
effective sandbox mode/scope/workspace access
whether the session is currently sandboxed (main vs non-main)
effective sandbox tool allow/deny (and whether it came from agent/global/default)
elevated gates and fix-it key paths
Sandbox: where tools run
Sandboxing is controlled by
agents.defaults.sandbox.mode
"off"
: everything runs on the host.
"non-main"
: only non-main sessions are sandboxed (common “surprise” for groups/channels).
"all"
: everything is sandboxed.
See
Sandboxing
for the full matrix (scope, workspace mounts, images).
Bind mounts (security quick check)
docker.binds
pierces
the sandbox filesystem: whatever you mount is visible inside the container with the mode you set (
:ro
:rw
Default is read-write if you omit the mode; prefer
:ro
for source/secrets.
scope: "shared"
ignores per-agent binds (only global binds apply).
Binding
/var/run/docker.sock
effectively hands host control to the sandbox; only do this intentionally.
Workspace access (
workspaceAccess: "ro"
"rw"
) is independent of bind modes.
Tool policy: which tools exist/are callable
Two layers matter:
Tool profile
tools.profile
and
agents.list[].tools.profile
(base allowlist)
Provider tool profile
tools.byProvider[provider].profile
and
agents.list[].tools.byProvider[provider].profile
Global/per-agent tool policy
tools.allow
tools.deny
and
agents.list[].tools.allow
agents.list[].tools.deny
Provider tool policy
tools.byProvider[provider].allow/deny
and
agents.list[].tools.byProvider[provider].allow/deny
Sandbox tool policy
(only applies when sandboxed):
tools.sandbox.tools.allow
tools.sandbox.tools.deny
and
agents.list[].tools.sandbox.tools.*
Rules of thumb:
deny
always wins.
allow
is non-empty, everything else is treated as blocked.
Tool policy is the hard stop:
/exec
cannot override a denied
exec
tool.
/exec
only changes session defaults for authorized senders; it does not grant tool access.
Provider tool keys accept either
provider
(e.g.
google-antigravity
) or
provider/model
(e.g.
openai/gpt-5.2
Tool groups (shorthands)
Tool policies (global, agent, sandbox) support
group:*
entries that expand to multiple tools:
tools
sandbox
tools
allow
"group:runtime"
"group:fs"
"group:sessions"
"group:memory"
Available groups:
group:runtime
exec
bash
process
group:fs
read
write
edit
apply_patch
group:sessions
sessions_list
sessions_history
sessions_send
sessions_spawn
session_status
group:memory
memory_search
memory_get
group:ui
browser
canvas
group:automation
cron
gateway
group:messaging
message
group:nodes
nodes
group:openclaw
: all built-in OpenClaw tools (excludes provider plugins)
Elevated: exec-only “run on host”
Elevated does
not
grant extra tools; it only affects
exec
If you’re sandboxed,
/elevated on
(or
exec
with
elevated: true
) runs on the host (approvals may still apply).
Use
/elevated full
to skip exec approvals for the session.
If you’re already running direct, elevated is effectively a no-op (still gated).
Elevated is
not
skill-scoped and does
not
override tool allow/deny.
/exec
is separate from elevated. It only adjusts per-session exec defaults for authorized senders.
Gates:
Enablement:
tools.elevated.enabled
(and optionally
agents.list[].tools.elevated.enabled
Sender allowlists:
tools.elevated.allowFrom.<provider>
(and optionally
agents.list[].tools.elevated.allowFrom.<provider>
See
Elevated Mode
Common “sandbox jail” fixes
“Tool X blocked by sandbox tool policy”
Fix-it keys (pick one):
Disable sandbox:
agents.defaults.sandbox.mode=off
(or per-agent
agents.list[].sandbox.mode=off
Allow the tool inside sandbox:
remove it from
tools.sandbox.tools.deny
(or per-agent
agents.list[].tools.sandbox.tools.deny
or add it to
tools.sandbox.tools.allow
(or per-agent allow)
“I thought this was main, why is it sandboxed?”
"non-main"
mode, group/channel keys are
not
main. Use the main session key (shown by
sandbox explain
) or switch mode to
"off"
Sandboxing
Gateway Protocol

---
## Gateway > Sandboxing

[Source: https://docs.openclaw.ai/gateway/sandboxing]

to reduce blast radius.
This is
optional
and controlled by configuration (
agents.defaults.sandbox
agents.list[].sandbox
). If sandboxing is off, tools run on the host.
The Gateway stays on the host; tool execution runs in an isolated sandbox
when enabled.
This is not a perfect security boundary, but it materially limits filesystem
and process access when the model does something dumb.
What gets sandboxed
Tool execution (
exec
read
write
edit
apply_patch
process
, etc.).
Optional sandboxed browser (
agents.defaults.sandbox.browser
By default, the sandbox browser auto-starts (ensures CDP is reachable) when the browser tool needs it.
Configure via
agents.defaults.sandbox.browser.autoStart
and
agents.defaults.sandbox.browser.autoStartTimeoutMs
agents.defaults.sandbox.browser.allowHostControl
lets sandboxed sessions target the host browser explicitly.
Optional allowlists gate
target: "custom"
allowedControlUrls
allowedControlHosts
allowedControlPorts
Not sandboxed:
The Gateway process itself.
Any tool explicitly allowed to run on the host (e.g.
tools.elevated
Elevated exec runs on the host and bypasses sandboxing.
If sandboxing is off,
tools.elevated
does not change execution (already on host). See
Elevated Mode
Modes
agents.defaults.sandbox.mode
controls
when
sandboxing is used:
"off"
: no sandboxing.
"non-main"
: sandbox only
non-main
sessions (default if you want normal chats on host).
"all"
: every session runs in a sandbox.
Note:
"non-main"
is based on
session.mainKey
(default
"main"
), not agent id.
Group/channel sessions use their own keys, so they count as non-main and will be sandboxed.
Scope
agents.defaults.sandbox.scope
controls
how many containers
are created:
"session"
(default): one container per session.
"agent"
: one container per agent.
"shared"
: one container shared by all sandboxed sessions.
Workspace access
agents.defaults.sandbox.workspaceAccess
controls
what the sandbox can see
"none"
(default): tools see a sandbox workspace under
~/.openclaw/sandboxes
"ro"
: mounts the agent workspace read-only at
/agent
(disables
write
edit
apply_patch
"rw"
: mounts the agent workspace read/write at
/workspace
Inbound media is copied into the active sandbox workspace (
media/inbound/*
Skills note: the
read
tool is sandbox-rooted. With
workspaceAccess: "none"
OpenClaw mirrors eligible skills into the sandbox workspace (
.../skills
) so
they can be read. With
"rw"
, workspace skills are readable from
/workspace/skills
Custom bind mounts
agents.defaults.sandbox.docker.binds
mounts additional host directories into the container.
Format:
host:container:mode
(e.g.,
"/home/user/source:/source:rw"
Global and per-agent binds are
merged
(not replaced). Under
scope: "shared"
, per-agent binds are ignored.
agents.defaults.sandbox.browser.binds
mounts additional host directories into the
sandbox browser
container only.
When set (including
), it replaces
agents.defaults.sandbox.docker.binds
for the browser container.
When omitted, the browser container falls back to
agents.defaults.sandbox.docker.binds
(backwards compatible).
Example (read-only source + an extra data directory):
agents
defaults
sandbox
docker
binds
"/home/user/source:/source:ro"
"/var/data/myapp:/data:ro"
list
"build"
sandbox
docker
binds
"/mnt/cache:/cache:rw"
Security notes:
Binds bypass the sandbox filesystem: they expose host paths with whatever mode you set (
:ro
:rw
OpenClaw blocks dangerous bind sources (for example:
docker.sock
/etc
/proc
/sys
/dev
, and parent mounts that would expose them).
Sensitive mounts (secrets, SSH keys, service credentials) should be
:ro
unless absolutely required.
Combine with
workspaceAccess: "ro"
if you only need read access to the workspace; bind modes stay independent.
See
Sandbox vs Tool Policy vs Elevated
for how binds interact with tool policy and elevated exec.
Images + setup
Default image:
openclaw-sandbox:bookworm-slim
Build it once:
scripts/sandbox-setup.sh
Note: the default image does
not
include Node. If a skill needs Node (or
other runtimes), either bake a custom image or install via
sandbox.docker.setupCommand
(requires network egress + writable root +
root user).
Sandboxed browser image:
scripts/sandbox-browser-setup.sh
By default, sandbox containers run with
no network
Override with
agents.defaults.sandbox.docker.network
Docker installs and the containerized gateway live here:
Docker
setupCommand (one-time container setup)
setupCommand
runs
once
after the sandbox container is created (not on every run).
It executes inside the container via
sh -lc
Paths:
Global:
agents.defaults.sandbox.docker.setupCommand
Per-agent:
agents.list[].sandbox.docker.setupCommand
Common pitfalls:
Default
docker.network
"none"
(no egress), so package installs will fail.
readOnlyRoot: true
prevents writes; set
readOnlyRoot: false
or bake a custom image.
user
must be root for package installs (omit
user
or set
user: "0:0"
Sandbox exec does
not
inherit host
process.env
. Use
agents.defaults.sandbox.docker.env
(or a custom image) for skill API keys.
Tool policy + escape hatches
Tool allow/deny policies still apply before sandbox rules. If a tool is denied
globally or per-agent, sandboxing doesn’t bring it back.
tools.elevated
is an explicit escape hatch that runs
exec
on the host.
/exec
directives only apply for authorized senders and persist per session; to hard-disable
exec
, use tool policy deny (see
Sandbox vs Tool Policy vs Elevated
Debugging:
Use
openclaw sandbox explain
to inspect effective sandbox mode, tool policy, and fix-it config keys.
See
Sandbox vs Tool Policy vs Elevated
for the “why is this blocked?” mental model.
Keep it locked down.
Multi-agent overrides
Each agent can override sandbox + tools:
agents.list[].sandbox
and
agents.list[].tools
(plus
agents.list[].tools.sandbox.tools
for sandbox tool policy).
See
Multi-Agent Sandbox & Tools
for precedence.
Minimal enable example
agents
defaults
sandbox
mode
"non-main"
scope
"session"
workspaceAccess
"none"
Related docs
Sandbox Configuration
Multi-Agent Sandbox & Tools
Security
Security
Sandbox vs Tool Policy vs Elevated

---
## Gateway > Security

[Source: https://docs.openclaw.ai/gateway/security]

# OpenClaw Security Documentation Summary

## Core Security Model

OpenClaw operates under a **personal assistant trust model**, not multi-tenant isolation. The documentation states: *"one trusted operator boundary per gateway (single-user/personal assistant model)"* rather than hostile multi-user separation.

Key distinction: *"If you need mixed-trust or adversarial-user operation, split trust boundaries (separate gateway + credentials, ideally separate OS users/hosts)."*

## Quick Security Audit

Run regularly to identify configuration issues:

```bash
openclaw security audit
openclaw security audit --deep
openclaw security audit --fix
```

This flags common vulnerabilities including authentication exposure, elevated tool allowlists, and filesystem permission problems.

## Hardened 60-Second Baseline

Essential starting configuration:

```json5
{
  gateway: {
    mode: "local",
    bind: "loopback",
    auth: { mode: "token", token: "replace-with-long-random-token" },
  },
  tools: {
    profile: "messaging",
    deny: ["group:automation", "group:runtime", "group:fs"],
    exec: { security: "deny", ask: "always" },
    elevated: { enabled: false },
  },
  channels: {
    whatsapp: { dmPolicy: "pairing", groups: { "*": { requireMention: true } } },
  },
}
```

## Critical Trust Boundaries

| Control | Purpose | Common Misunderstanding |
|---------|---------|------------------------|
| `gateway.auth` | Authenticates callers | Not per-message signatures |
| `sessionKey` | Routes context/sessions | Not user authorization |
| Prompt guardrails | Reduce model abuse | Prompt injection alone isn't auth bypass |
| Node pairing | Remote device execution | Operator-level access, not untrusted |

## Not Vulnerabilities (By Design)

The documentation explicitly excludes from security considerations:
- Prompt injection without policy/auth bypass
- Claims assuming hostile multi-tenant operation on shared hosts
- IDOR findings treating `sessionKey` as auth tokens
- Localhost-only deployment security findings

## DM Access Model

Three strategies for managing direct messages:

- **Pairing** (default): Unknown senders receive codes; messages ignored until approved
- **Allowlist**: Block unknown senders entirely
- **Open**: Allow anyone; requires explicit channel allowlist including `"*"`

Activate secure DM mode: `session.dmScope: "per-channel-peer"` prevents cross-user context leakage.

## Credential Storage Locations

Sensitive data stored under `~/.openclaw/credentials/`:

- WhatsApp credentials: `whatsapp/<accountId>/creds.json`
- Channel allowlists: `<channel>-allowFrom.json`
- Model auth profiles: `agents/<agentId>/agent/auth-profiles.json`
- Legacy OAuth: `oauth.json`

Session transcripts live in `agents/<agentId>/sessions/*.jsonl`—treat disk access as your trust boundary.

## High-Risk Security Findings

Priority remediation order from `openclaw security audit`:

1. **Open groups + enabled tools**: Lock down DMs/groups first (pairing/allowlists)
2. **Public network exposure**: Fix missing authentication immediately
3. **Browser control remote exposure**: Treat like operator access
4. **File permissions**: Ensure state/config aren't group/world-readable
5. **Plugin/extension oversight**: Only load explicitly trusted code
6. **Model selection**: Prefer modern, hardened models for tool-enabled bots

## Deployment Assumptions

The security model requires:
- *"If someone can modify Gateway host state/config (`~/.openclaw`), treat them as a trusted operator"*
- One OS user per machine for multi-user scenarios
- Separate gateways for adversarial trust boundaries

Config changes made by authenticated operators are trusted control-plane actions, not per-user tenant operations.

## Prompt Injection & Model Strength

Risk factors extend beyond sender identity:
- Untrusted content (web results, attachments, pasted logs) carries adversarial instructions
- Smaller models more susceptible to instruction hijacking
- Recommendation: *"Use the latest generation, best-tier model for any bot that can run tools"*

Mitigation: read-only reader agent → summary → main agent workflow.

## Sandboxing & Tool Policy

Two complementary approaches:

- **Full Gateway containerization**: Run entire Gateway in Docker
- **Tool sandboxing**: `agents.defaults.sandbox` isolates tool execution with Docker

Configure workspace access:
- `workspaceAccess: "none"` (default): sandbox workspace only
- `workspaceAccess: "ro"`: mount agent workspace read-only
- `workspaceAccess: "rw"`: full read/write access

## Browser Control Risks

*"If that browser profile already contains logged-in sessions, the model can access those accounts and data."*

Hardening measures:
- Dedicated agent profile (not personal daily-driver)
- Keep Gateway/node hosts tailnet-only
- Disable browser sync/password managers in agent profile
- SSRF policy: set `dangerouslyAllowPrivateNetwork: false` for strict validation

## Reverse Proxy Configuration

When running behind proxies:

```yaml
gateway:
  trustedProxies:
    - "127.0.0.1"
  allowRealIpFallback: false
  auth:
    mode: password
```

Critical: Proxy must **overwrite** `X-Forwarded-For` (not append) to prevent IP spoofing.

## Incident Response

**Containment steps:**
1. Stop the Gateway process
2. Set `gateway.bind: "loopback"` or disable Tailscale exposure
3. Switch risky channels to `dmPolicy: "disabled"` temporarily

**Rotation:**
1. Rotate `gateway.auth.token` and restart
2. Rotate remote client credentials
3. Rotate provider credentials (WhatsApp, Slack, API keys)

**Audit:**
- Check logs: `/tmp/openclaw/openclaw-YYYY-MM-DD.log`
- Review transcripts: `~/.openclaw/agents/<agentId>/sessions/`
- Rerun `openclaw security audit --deep`

## Multi-Agent Access Profiles

Example read-only agent:

```json5
{
  agents: {
    list: [
      {
        id: "family",
        sandbox: {
          mode: "all",
          workspaceAccess: "ro",
        },
        tools: {
          allow: ["read"],
          deny: ["write", "exec", "browser"],
        },
      },
    ],
  },
}
```

## Secrets Management

Keep these practices:
- `~/.openclaw/openclaw.json`: `600` permissions (user only)
- `~/.openclaw`: `700` permissions (user only)
- Use full-disk encryption on gateway host
- Dedicated OS user for Gateway if host is shared

Enable log redaction: `logging.redactSensitive: "tools"` (default active).

## Research Disclosure

Before reporting vulnerabilities, verify:
1. Repro works on latest `main` or release
2. Includes exact code path and version/commit
3. Crosses documented trust boundary (not just prompt injection)
4. Not listed in out-of-scope findings
5. Explicit deployment assumptions (loopback vs exposed, trusted vs untrusted)

Contact: [security@openclaw.ai](mailto:security@openclaw.ai)

---
## Gateway > Tailscale

[Source: https://docs.openclaw.ai/gateway/tailscale]

Tailscale (Gateway dashboard)
OpenClaw can auto-configure Tailscale
Serve
(tailnet) or
Funnel
(public) for the
Gateway dashboard and WebSocket port. This keeps the Gateway bound to loopback while
Tailscale provides HTTPS, routing, and (for Serve) identity headers.
Modes
serve
: Tailnet-only Serve via
tailscale serve
. The gateway stays on
127.0.0.1
funnel
: Public HTTPS via
tailscale funnel
. OpenClaw requires a shared password.
off
: Default (no Tailscale automation).
Auth
Set
gateway.auth.mode
to control the handshake:
token
(default when
OPENCLAW_GATEWAY_TOKEN
is set)
password
(shared secret via
OPENCLAW_GATEWAY_PASSWORD
or config)
When
tailscale.mode = "serve"
and
gateway.auth.allowTailscale
true
valid Serve proxy requests can authenticate via Tailscale identity headers
tailscale-user-login
) without supplying a token/password. OpenClaw verifies
the identity by resolving the
x-forwarded-for
address via the local Tailscale
daemon (
tailscale whois
) and matching it to the header before accepting it.
OpenClaw only treats a request as Serve when it arrives from loopback with
Tailscale’s
x-forwarded-for
x-forwarded-proto
, and
x-forwarded-host
headers.
To require explicit credentials, set
gateway.auth.allowTailscale: false
force
gateway.auth.mode: "password"
Config examples
Tailnet-only (Serve)
gateway
bind
"loopback"
tailscale
mode
"serve"
Open:
https://<magicdns>/
(or your configured
gateway.controlUi.basePath
Tailnet-only (bind to Tailnet IP)
Use this when you want the Gateway to listen directly on the Tailnet IP (no Serve/Funnel).
gateway
bind
"tailnet"
auth
mode
"token"
token
"your-token"
Connect from another Tailnet device:
Control UI:
http://<tailscale-ip>:18789/
WebSocket:
ws://<tailscale-ip>:18789
Note: loopback (
http://127.0.0.1:18789
) will
not
work in this mode.
Public internet (Funnel + shared password)
gateway
bind
"loopback"
tailscale
mode
"funnel"
auth
mode
"password"
password
"replace-me"
Prefer
OPENCLAW_GATEWAY_PASSWORD
over committing a password to disk.
CLI examples
openclaw
gateway
--tailscale
serve
openclaw
gateway
--tailscale
funnel
--auth
password
Notes
Tailscale Serve/Funnel requires the
tailscale
CLI to be installed and logged in.
tailscale.mode: "funnel"
refuses to start unless auth mode is
password
to avoid public exposure.
Set
gateway.tailscale.resetOnExit
if you want OpenClaw to undo
tailscale serve
tailscale funnel
configuration on shutdown.
gateway.bind: "tailnet"
is a direct Tailnet bind (no HTTPS, no Serve/Funnel).
gateway.bind: "auto"
prefers loopback; use
tailnet
if you want Tailnet-only.
Serve/Funnel only expose the
Gateway control UI + WS
. Nodes connect over
the same Gateway WS endpoint, so Serve can work for node access.
Browser control (remote Gateway + local browser)
If you run the Gateway on one machine but want to drive a browser on another machine,
run a
node host
on the browser machine and keep both on the same tailnet.
The Gateway will proxy browser actions to the node; no separate control server or Serve URL needed.
Avoid Funnel for browser control; treat node pairing like operator access.
Tailscale prerequisites + limits
Serve requires HTTPS enabled for your tailnet; the CLI prompts if it is missing.
Serve injects Tailscale identity headers; Funnel does not.
Funnel requires Tailscale v1.38.3+, MagicDNS, HTTPS enabled, and a funnel node attribute.
Funnel only supports ports
443
8443
, and
10000
over TLS.
Funnel on macOS requires the open-source Tailscale app variant.
Learn more
Tailscale Serve overview:
https://tailscale.com/kb/1312/serve
tailscale serve
command:
https://tailscale.com/kb/1242/tailscale-serve
Tailscale Funnel overview:
https://tailscale.com/kb/1223/tailscale-funnel
tailscale funnel
command:
https://tailscale.com/kb/1311/tailscale-funnel
Remote Gateway Setup
Formal Verification (Security Models)

---
## Gateway > Tools Invoke Http Api

[Source: https://docs.openclaw.ai/gateway/tools-invoke-http-api]

Tools Invoke API
Tools Invoke (HTTP)
OpenClaw’s Gateway exposes a simple HTTP endpoint for invoking a single tool directly. It is always enabled, but gated by Gateway auth and tool policy.
POST /tools/invoke
Same port as the Gateway (WS + HTTP multiplex):
http://<gateway-host>:<port>/tools/invoke
Default max payload size is 2 MB.
Authentication
Uses the Gateway auth configuration. Send a bearer token:
Authorization: Bearer <token>
Notes:
When
gateway.auth.mode="token"
, use
gateway.auth.token
(or
OPENCLAW_GATEWAY_TOKEN
When
gateway.auth.mode="password"
, use
gateway.auth.password
(or
OPENCLAW_GATEWAY_PASSWORD
gateway.auth.rateLimit
is configured and too many auth failures occur, the endpoint returns
429
with
Retry-After
Request body
"tool"
"sessions_list"
"action"
"json"
"args"
"sessionKey"
"main"
"dryRun"
false
Fields:
tool
(string, required): tool name to invoke.
action
(string, optional): mapped into args if the tool schema supports
action
and the args payload omitted it.
args
(object, optional): tool-specific arguments.
sessionKey
(string, optional): target session key. If omitted or
"main"
, the Gateway uses the configured main session key (honors
session.mainKey
and default agent, or
global
in global scope).
dryRun
(boolean, optional): reserved for future use; currently ignored.
Policy + routing behavior
Tool availability is filtered through the same policy chain used by Gateway agents:
tools.profile
tools.byProvider.profile
tools.allow
tools.byProvider.allow
agents.<id>.tools.allow
agents.<id>.tools.byProvider.allow
group policies (if the session key maps to a group or channel)
subagent policy (when invoking with a subagent session key)
If a tool is not allowed by policy, the endpoint returns
404
Gateway HTTP also applies a hard deny list by default (even if session policy allows the tool):
sessions_spawn
sessions_send
gateway
whatsapp_login
You can customize this deny list via
gateway.tools
gateway
tools
// Additional tools to block over HTTP /tools/invoke
deny
"browser"
// Remove tools from the default deny list
allow
"gateway"
To help group policies resolve context, you can optionally set:
x-openclaw-message-channel: <channel>
(example:
slack
telegram
x-openclaw-account-id: <accountId>
(when multiple accounts exist)
Responses
200
{ ok: true, result }
400
{ ok: false, error: { type, message } }
(invalid request or tool input error)
401
→ unauthorized
429
→ auth rate-limited (
Retry-After
set)
404
→ tool not available (not found or not allowlisted)
405
→ method not allowed
500
{ ok: false, error: { type, message } }
(unexpected tool execution error; sanitized message)
Example
curl
-sS
http://127.0.0.1:18789/tools/invoke
'Authorization: Bearer YOUR_TOKEN'
'Content-Type: application/json'
'{
"tool": "sessions_list",
"action": "json",
"args": {}
}'
OpenAI Chat Completions
CLI Backends

---
## Gateway > Troubleshooting

[Source: https://docs.openclaw.ai/gateway/troubleshooting]

Configuration Reference
Configuration Examples
Authentication
Trusted proxy auth
Health Checks
Heartbeat
Doctor
Logging
Gateway Lock
Background Exec and Process Tool
Multiple Gateways
Troubleshooting
Security and sandboxing
Protocols and APIs
Networking and discovery
Remote access
Remote Access
Remote Gateway Setup
Tailscale
Security
Formal Verification (Security Models)
Web interfaces
Web
Control UI
Dashboard
WebChat
TUI
Gateway troubleshooting
Command ladder
No replies
Dashboard control ui connectivity
Gateway service not running
Channel connected messages not flowing
Cron and heartbeat delivery
Node paired tool fails
Browser tool fails
If you upgraded and something suddenly broke
1) Auth and URL override behavior changed
2) Bind and auth guardrails are stricter
3) Pairing and device identity state changed
Configuration and operations
Troubleshooting
Gateway troubleshooting
This page is the deep runbook.
Start at
/help/troubleshooting
if you want the fast triage flow first.
Command ladder
Run these first, in this order:
openclaw
status
openclaw
gateway
status
openclaw
logs
--follow
openclaw
doctor
openclaw
channels
status
--probe
Expected healthy signals:
openclaw gateway status
shows
Runtime: running
and
RPC probe: ok
openclaw doctor
reports no blocking config/service issues.
openclaw channels status --probe
shows connected/ready channels.
No replies
If channels are up but nothing answers, check routing and policy before reconnecting anything.
openclaw
status
openclaw
channels
status
--probe
openclaw
pairing
list
<
channe
>
openclaw
config
get
channels
openclaw
logs
--follow
Look for:
Pairing pending for DM senders.
Group mention gating (
requireMention
mentionPatterns
Channel/group allowlist mismatches.
Common signatures:
drop guild message (mention required
→ group message ignored until mention.
pairing request
→ sender needs approval.
blocked
allowlist
→ sender/channel was filtered by policy.
Related:
/channels/troubleshooting
/channels/pairing
/channels/groups
Dashboard control ui connectivity
When dashboard/control UI will not connect, validate URL, auth mode, and secure context assumptions.
openclaw
gateway
status
openclaw
status
openclaw
logs
--follow
openclaw
doctor
openclaw
gateway
status
--json
Look for:
Correct probe URL and dashboard URL.
Auth mode/token mismatch between client and gateway.
HTTP usage where device identity is required.
Common signatures:
device identity required
→ non-secure context or missing device auth.
unauthorized
/ reconnect loop → token/password mismatch.
gateway connect failed:
→ wrong host/port/url target.
Related:
/web/control-ui
/gateway/authentication
/gateway/remote
Gateway service not running
Use this when service is installed but process does not stay up.
openclaw
gateway
status
openclaw
status
openclaw
logs
--follow
openclaw
doctor
openclaw
gateway
status
--deep
Look for:
Runtime: stopped
with exit hints.
Service config mismatch (
Config (cli)
Config (service)
Port/listener conflicts.
Common signatures:
Gateway start blocked: set gateway.mode=local
→ local gateway mode is not enabled. Fix: set
gateway.mode="local"
in your config (or run
openclaw configure
). If you are running OpenClaw via Podman using the dedicated
openclaw
user, the config lives at
~openclaw/.openclaw/openclaw.json
refusing to bind gateway ... without auth
→ non-loopback bind without token/password.
another gateway instance is already listening
EADDRINUSE
→ port conflict.
Related:
/gateway/background-process
/gateway/configuration
/gateway/doctor
Channel connected messages not flowing
If channel state is connected but message flow is dead, focus on policy, permissions, and channel specific delivery rules.
openclaw
channels
status
--probe
openclaw
pairing
list
<
channe
>
openclaw
status
--deep
openclaw
logs
--follow
openclaw
config
get
channels
Look for:
DM policy (
pairing
allowlist
open
disabled
Group allowlist and mention requirements.
Missing channel API permissions/scopes.
Common signatures:
mention required
→ message ignored by group mention policy.
pairing
/ pending approval traces → sender is not approved.
missing_scope
not_in_channel
Forbidden
401/403
→ channel auth/permissions issue.
Related:
/channels/troubleshooting
/channels/whatsapp
/channels/telegram
/channels/discord
Cron and heartbeat delivery
If cron or heartbeat did not run or did not deliver, verify scheduler state first, then delivery target.
openclaw
cron
status
openclaw
cron
list
openclaw
cron
runs
--id
<
jobI
>
--limit
openclaw
system
heartbeat
last
openclaw
logs
--follow
Look for:
Cron enabled and next wake present.
Job run history status (
skipped
error
Heartbeat skip reasons (
quiet-hours
requests-in-flight
alerts-disabled
Common signatures:
cron: scheduler disabled; jobs will not run automatically
→ cron disabled.
cron: timer tick failed
→ scheduler tick failed; check file/log/runtime errors.
heartbeat skipped
with
reason=quiet-hours
→ outside active hours window.
heartbeat: unknown accountId
→ invalid account id for heartbeat delivery target.
Related:
/automation/troubleshooting
/automation/cron-jobs
/gateway/heartbeat
Node paired tool fails
If a node is paired but tools fail, isolate foreground, permission, and approval state.
openclaw
nodes
status
openclaw
nodes
describe
--node
<
idOrNameOrI
>
openclaw
approvals
get
--node
<
idOrNameOrI
>
openclaw
logs
--follow
openclaw
status
Look for:
Node online with expected capabilities.
OS permission grants for camera/mic/location/screen.
Exec approvals and allowlist state.
Common signatures:
NODE_BACKGROUND_UNAVAILABLE
→ node app must be in foreground.
*_PERMISSION_REQUIRED
LOCATION_PERMISSION_REQUIRED
→ missing OS permission.
SYSTEM_RUN_DENIED: approval required
→ exec approval pending.
SYSTEM_RUN_DENIED: allowlist miss
→ command blocked by allowlist.
Related:
/nodes/troubleshooting
/nodes/index
/tools/exec-approvals
Browser tool fails
Use this when browser tool actions fail even though the gateway itself is healthy.
openclaw
browser
status
openclaw
browser
start
--browser-profile
openclaw
openclaw
browser
profiles
openclaw
logs
--follow
openclaw
doctor
Look for:
Valid browser executable path.
CDP profile reachability.
Extension relay tab attachment for
profile="chrome"
Common signatures:
Failed to start Chrome CDP on port
→ browser process failed to launch.
browser.executablePath not found
→ configured path is invalid.
Chrome extension relay is running, but no tab is connected
→ extension relay not attached.
Browser attachOnly is enabled ... not reachable
→ attach-only profile has no reachable target.
Related:
/tools/browser-linux-troubleshooting
/tools/chrome-extension
/tools/browser
If you upgraded and something suddenly broke
Most post-upgrade breakage is config drift or stricter defaults now being enforced.
1) Auth and URL override behavior changed
openclaw
gateway
status
openclaw
config
get
gateway.mode
openclaw
config
get
gateway.remote.url
openclaw
config
get
gateway.auth.mode
What to check:
gateway.mode=remote
, CLI calls may be targeting remote while your local service is fine.
Explicit
--url
calls do not fall back to stored credentials.
Common signatures:
gateway connect failed:
→ wrong URL target.
unauthorized
→ endpoint reachable but wrong auth.
2) Bind and auth guardrails are stricter
openclaw
config
get
gateway.bind
openclaw
config
get
gateway.auth.token
openclaw
gateway
status
openclaw
logs
--follow
What to check:
Non-loopback binds (
lan
tailnet
custom
) need auth configured.
Old keys like
gateway.token
do not replace
gateway.auth.token
Common signatures:
refusing to bind gateway ... without auth
→ bind+auth mismatch.
RPC probe: failed
while runtime is running → gateway alive but inaccessible with current auth/url.
3) Pairing and device identity state changed
openclaw
devices
list
openclaw
pairing
list
<
channe
>
openclaw
logs
--follow
openclaw
doctor
What to check:
Pending device approvals for dashboard/nodes.
Pending DM pairing approvals after policy or identity changes.
Common signatures:
device identity required
→ device auth not satisfied.
pairing required
→ sender/device must be approved.
If the service config and runtime still disagree after checks, reinstall service metadata from the same profile/state directory:
openclaw
gateway
install
--force
openclaw
gateway
restart
Related:
/gateway/pairing
/gateway/authentication
/gateway/background-process
Multiple Gateways
Security

---
## Gateway > Trusted Proxy Auth

[Source: https://docs.openclaw.ai/gateway/trusted-proxy-auth]

Security-sensitive feature.
This mode delegates authentication entirely to your reverse proxy. Misconfiguration can expose your Gateway to unauthorized access. Read this page carefully before enabling.
When to Use
Use
trusted-proxy
auth mode when:
You run OpenClaw behind an
identity-aware proxy
(Pomerium, Caddy + OAuth, nginx + oauth2-proxy, Traefik + forward auth)
Your proxy handles all authentication and passes user identity via headers
You’re in a Kubernetes or container environment where the proxy is the only path to the Gateway
You’re hitting WebSocket
1008 unauthorized
errors because browsers can’t pass tokens in WS payloads
When NOT to Use
If your proxy doesn’t authenticate users (just a TLS terminator or load balancer)
If there’s any path to the Gateway that bypasses the proxy (firewall holes, internal network access)
If you’re unsure whether your proxy correctly strips/overwrites forwarded headers
If you only need personal single-user access (consider Tailscale Serve + loopback for simpler setup)
How It Works
Your reverse proxy authenticates users (OAuth, OIDC, SAML, etc.)
Proxy adds a header with the authenticated user identity (e.g.,
x-forwarded-user:
[email protected]
OpenClaw checks that the request came from a
trusted proxy IP
(configured in
gateway.trustedProxies
OpenClaw extracts the user identity from the configured header
If everything checks out, the request is authorized
Configuration
gateway
// Must bind to network interface (not loopback)
bind
"lan"
// CRITICAL: Only add your proxy's IP(s) here
trustedProxies
"10.0.0.1"
"172.17.0.1"
auth
mode
"trusted-proxy"
trustedProxy
// Header containing authenticated user identity (required)
userHeader
"x-forwarded-user"
// Optional: headers that MUST be present (proxy verification)
requiredHeaders
"x-forwarded-proto"
"x-forwarded-host"
// Optional: restrict to specific users (empty = allow all)
allowUsers
"
[email protected]
"
"
[email protected]
"
Configuration Reference
Field
Required
Description
gateway.trustedProxies
Yes
Array of proxy IP addresses to trust. Requests from other IPs are rejected.
gateway.auth.mode
Yes
Must be
"trusted-proxy"
gateway.auth.trustedProxy.userHeader
Yes
Header name containing the authenticated user identity
gateway.auth.trustedProxy.requiredHeaders
Additional headers that must be present for the request to be trusted
gateway.auth.trustedProxy.allowUsers
Allowlist of user identities. Empty means allow all authenticated users.
Proxy Setup Examples
Pomerium
Pomerium passes identity in
x-pomerium-claim-email
(or other claim headers) and a JWT in
x-pomerium-jwt-assertion
gateway
bind
"lan"
trustedProxies
"10.0.0.1"
// Pomerium's IP
auth
mode
"trusted-proxy"
trustedProxy
userHeader
"x-pomerium-claim-email"
requiredHeaders
"x-pomerium-jwt-assertion"
Pomerium config snippet:
routes
from
https://openclaw.example.com
http://openclaw-gateway:18789
policy
allow
email
[email protected]
pass_identity_headers
true
Caddy with OAuth
Caddy with the
caddy-security
plugin can authenticate users and pass identity headers.
gateway
bind
"lan"
trustedProxies
"127.0.0.1"
// Caddy's IP (if on same host)
auth
mode
"trusted-proxy"
trustedProxy
userHeader
"x-forwarded-user"
Caddyfile snippet:
openclaw.example.com {
authenticate with oauth2_provider
authorize with policy1
reverse_proxy openclaw:18789 {
header_up X-Forwarded-User {http.auth.user.email}
nginx + oauth2-proxy
oauth2-proxy authenticates users and passes identity in
x-auth-request-email
gateway
bind
"lan"
trustedProxies
"10.0.0.1"
// nginx/oauth2-proxy IP
auth
mode
"trusted-proxy"
trustedProxy
userHeader
"x-auth-request-email"
nginx config snippet:
location
/ {
auth_request
/oauth2/auth;
auth_request_set
$user $upstream_http_x_auth_request_email;
proxy_pass
http://openclaw:18789;
proxy_set_header
X-Auth-Request-Email $user;
proxy_http_version
1.1
proxy_set_header
Upgrade $http_upgrade;
proxy_set_header
Connection
"upgrade"
Traefik with Forward Auth
gateway
bind
"lan"
trustedProxies
"172.17.0.1"
// Traefik container IP
auth
mode
"trusted-proxy"
trustedProxy
userHeader
"x-forwarded-user"
Security Checklist
Before enabling trusted-proxy auth, verify:
Proxy is the only path
: The Gateway port is firewalled from everything except your proxy
trustedProxies is minimal
: Only your actual proxy IPs, not entire subnets
Proxy strips headers
: Your proxy overwrites (not appends)
x-forwarded-*
headers from clients
TLS termination
: Your proxy handles TLS; users connect via HTTPS
allowUsers is set
(recommended): Restrict to known users rather than allowing anyone authenticated
Security Audit
openclaw security audit
will flag trusted-proxy auth with a
critical
severity finding. This is intentional — it’s a reminder that you’re delegating security to your proxy setup.
The audit checks for:
Missing
trustedProxies
configuration
Missing
userHeader
configuration
Empty
allowUsers
(allows any authenticated user)
Troubleshooting
”trusted_proxy_untrusted_source”
The request didn’t come from an IP in
gateway.trustedProxies
. Check:
Is the proxy IP correct? (Docker container IPs can change)
Is there a load balancer in front of your proxy?
Use
docker inspect
kubectl get pods -o wide
to find actual IPs
”trusted_proxy_user_missing”
The user header was empty or missing. Check:
Is your proxy configured to pass identity headers?
Is the header name correct? (case-insensitive, but spelling matters)
Is the user actually authenticated at the proxy?
“trusted
proxy_missing_header
A required header wasn’t present. Check:
Your proxy configuration for those specific headers
Whether headers are being stripped somewhere in the chain
”trusted_proxy_user_not_allowed”
The user is authenticated but not in
allowUsers
. Either add them or remove the allowlist.
WebSocket Still Failing
Make sure your proxy:
Supports WebSocket upgrades (
Upgrade: websocket
Connection: upgrade
Passes the identity headers on WebSocket upgrade requests (not just HTTP)
Doesn’t have a separate auth path for WebSocket connections
Migration from Token Auth
If you’re moving from token auth to trusted-proxy:
Configure your proxy to authenticate users and pass headers
Test the proxy setup independently (curl with headers)
Update OpenClaw config with trusted-proxy auth
Restart the Gateway
Test WebSocket connections from the Control UI
Run
openclaw security audit
and review findings
Related
Security
— full security guide
Configuration
— config reference
Remote Access
— other remote access patterns
Tailscale
— simpler alternative for tailnet-only access
Authentication
Health Checks

---
## Web > Control Ui

[Source: https://docs.openclaw.ai/web/control-ui]

single-page app served by the Gateway:
default:
http://<host>:18789/
optional prefix: set
gateway.controlUi.basePath
(e.g.
/openclaw
It speaks
directly to the Gateway WebSocket
on the same port.
Quick open (local)
If the Gateway is running on the same computer, open:
http://127.0.0.1:18789/
(or
http://localhost:18789/
If the page fails to load, start the Gateway first:
openclaw gateway
Auth is supplied during the WebSocket handshake via:
connect.params.auth.token
connect.params.auth.password
The dashboard settings panel lets you store a token; passwords are not persisted.
The onboarding wizard generates a gateway token by default, so paste it here on first connect.
Device pairing (first connection)
When you connect to the Control UI from a new browser or device, the Gateway
requires a
one-time pairing approval
— even if you’re on the same Tailnet
with
gateway.auth.allowTailscale: true
. This is a security measure to prevent
unauthorized access.
What you’ll see:
“disconnected (1008): pairing required”
To approve the device:
# List pending requests
openclaw
devices
list
# Approve by request ID
openclaw
devices
approve
<
requestI
>
Once approved, the device is remembered and won’t require re-approval unless
you revoke it with
openclaw devices revoke --device <id> --role <role>
. See
Devices CLI
for token rotation and revocation.
Notes:
Local connections (
127.0.0.1
) are auto-approved.
Remote connections (LAN, Tailnet, etc.) require explicit approval.
Each browser profile generates a unique device ID, so switching browsers or
clearing browser data will require re-pairing.
What it can do (today)
Chat with the model via Gateway WS (
chat.history
chat.send
chat.abort
chat.inject
Stream tool calls + live tool output cards in Chat (agent events)
Channels: WhatsApp/Telegram/Discord/Slack + plugin channels (Mattermost, etc.) status + QR login + per-channel config (
channels.status
web.login.*
config.patch
Instances: presence list + refresh (
system-presence
Sessions: list + per-session thinking/verbose overrides (
sessions.list
sessions.patch
Cron jobs: list/add/run/enable/disable + run history (
cron.*
Skills: status, enable/disable, install, API key updates (
skills.*
Nodes: list + caps (
node.list
Exec approvals: edit gateway or node allowlists + ask policy for
exec host=gateway/node
exec.approvals.*
Config: view/edit
~/.openclaw/openclaw.json
config.get
config.set
Config: apply + restart with validation (
config.apply
) and wake the last active session
Config writes include a base-hash guard to prevent clobbering concurrent edits
Config schema + form rendering (
config.schema
, including plugin + channel schemas); Raw JSON editor remains available
Debug: status/health/models snapshots + event log + manual RPC calls (
status
health
models.list
Logs: live tail of gateway file logs with filter/export (
logs.tail
Update: run a package/git update + restart (
update.run
) with a restart report
Cron jobs panel notes:
For isolated jobs, delivery defaults to announce summary. You can switch to none if you want internal-only runs.
Channel/target fields appear when announce is selected.
New job form includes a
Notify webhook
toggle (
notify
on the job).
Gateway webhook posting requires both
notify: true
on the job and
cron.webhook
in config.
Set
cron.webhookToken
to send a dedicated bearer token, if omitted the webhook is sent without an auth header.
Chat behavior
chat.send
non-blocking
: it acks immediately with
{ runId, status: "started" }
and the response streams via
chat
events.
Re-sending with the same
idempotencyKey
returns
{ status: "in_flight" }
while running, and
{ status: "ok" }
after completion.
chat.inject
appends an assistant note to the session transcript and broadcasts a
chat
event for UI-only updates (no agent run, no channel delivery).
Stop:
Click
Stop
(calls
chat.abort
Type
/stop
(or
stop|esc|abort|wait|exit|interrupt
) to abort out-of-band
chat.abort
supports
{ sessionKey }
(no
runId
) to abort all active runs for that session
Abort partial retention:
When a run is aborted, partial assistant text can still be shown in the UI
Gateway persists aborted partial assistant text into transcript history when buffered output exists
Persisted entries include abort metadata so transcript consumers can tell abort partials from normal completion output
Tailnet access (recommended)
Integrated Tailscale Serve (preferred)
Keep the Gateway on loopback and let Tailscale Serve proxy it with HTTPS:
openclaw
gateway
--tailscale
serve
Open:
https://<magicdns>/
(or your configured
gateway.controlUi.basePath
By default, Serve requests can authenticate via Tailscale identity headers
tailscale-user-login
) when
gateway.auth.allowTailscale
true
. OpenClaw
verifies the identity by resolving the
x-forwarded-for
address with
tailscale whois
and matching it to the header, and only accepts these when the
request hits loopback with Tailscale’s
x-forwarded-*
headers. Set
gateway.auth.allowTailscale: false
(or force
gateway.auth.mode: "password"
if you want to require a token/password even for Serve traffic.
Bind to tailnet + token
openclaw
gateway
--bind
tailnet
--token
"$(
openssl
rand
-hex
)"
Then open:
http://<tailscale-ip>:18789/
(or your configured
gateway.controlUi.basePath
Paste the token into the UI settings (sent as
connect.params.auth.token
Insecure HTTP
If you open the dashboard over plain HTTP (
http://<lan-ip>
http://<tailscale-ip>
the browser runs in a
non-secure context
and blocks WebCrypto. By default,
OpenClaw
blocks
Control UI connections without device identity.
Recommended fix:
use HTTPS (Tailscale Serve) or open the UI locally:
https://<magicdns>/
(Serve)
http://127.0.0.1:18789/
(on the gateway host)
Downgrade example (token-only over HTTP):
gateway
controlUi
allowInsecureAuth
true
bind
"tailnet"
auth
mode
"token"
token
"replace-me"
This disables device identity + pairing for the Control UI (even on HTTPS). Use
only if you trust the network.
See
Tailscale
for HTTPS setup guidance.
Building the UI
The Gateway serves static files from
dist/control-ui
. Build them with:
pnpm
ui:build
# auto-installs UI deps on first run
Optional absolute base (when you want fixed asset URLs):
OPENCLAW_CONTROL_UI_BASE_PATH
/openclaw/
pnpm
ui:build
For local development (separate dev server):
pnpm
ui:dev
# auto-installs UI deps on first run
Then point the UI at your Gateway WS URL (e.g.
ws://127.0.0.1:18789
Debugging/testing: dev server + remote Gateway
The Control UI is static files; the WebSocket target is configurable and can be
different from the HTTP origin. This is handy when you want the Vite dev server
locally but the Gateway runs elsewhere.
Start the UI dev server:
pnpm ui:dev
Open a URL like:
http://localhost:5173/?gatewayUrl=ws://<gateway-host>:18789
Optional one-time auth (if needed):
http://localhost:5173/?gatewayUrl=wss://<gateway-host>:18789&token=<gateway-token>
Notes:
gatewayUrl
is stored in localStorage after load and removed from the URL.
token
is stored in localStorage;
password
is kept in memory only.
When
gatewayUrl
is set, the UI does not fall back to config or environment credentials.
Provide
token
(or
password
) explicitly. Missing explicit credentials is an error.
Use
wss://
when the Gateway is behind TLS (Tailscale Serve, HTTPS proxy, etc.).
gatewayUrl
is only accepted in a top-level window (not embedded) to prevent clickjacking.
For cross-origin dev setups (e.g.
pnpm ui:dev
to a remote Gateway), add the UI
origin to
gateway.controlUi.allowedOrigins
Example:
gateway
controlUi
allowedOrigins
"http://localhost:5173"
Remote access setup details:
Remote access
Web
Dashboard

---
## Web > Dashboard

[Source: https://docs.openclaw.ai/web/dashboard]

Quick open (local Gateway):
http://127.0.0.1:18789/
(or
http://localhost:18789/
Key references:
Control UI
for usage and UI capabilities.
Tailscale
for Serve/Funnel automation.
Web surfaces
for bind modes and security notes.
Authentication is enforced at the WebSocket handshake via
connect.params.auth
(token or password). See
gateway.auth
Gateway configuration
Security note: the Control UI is an
admin surface
(chat, config, exec approvals).
Do not expose it publicly. The UI stores the token in
localStorage
after first load.
Prefer localhost, Tailscale Serve, or an SSH tunnel.
Fast path (recommended)
After onboarding, the CLI auto-opens the dashboard and prints a clean (non-tokenized) link.
Re-open anytime:
openclaw dashboard
(copies link, opens browser if possible, shows SSH hint if headless).
If the UI prompts for auth, paste the token from
gateway.auth.token
(or
OPENCLAW_GATEWAY_TOKEN
) into Control UI settings.
Token basics (local vs remote)
Localhost
: open
http://127.0.0.1:18789/
Token source
gateway.auth.token
(or
OPENCLAW_GATEWAY_TOKEN
); the UI stores a copy in localStorage after you connect.
Not localhost
: use Tailscale Serve (tokenless if
gateway.auth.allowTailscale: true
), tailnet bind with a token, or an SSH tunnel. See
Web surfaces
If you see “unauthorized” / 1008
Ensure the gateway is reachable (local:
openclaw status
; remote: SSH tunnel
ssh -N -L 18789:127.0.0.1:18789 user@host
then open
http://127.0.0.1:18789/
Retrieve the token from the gateway host:
openclaw config get gateway.auth.token
(or generate one:
openclaw doctor --generate-gateway-token
In the dashboard settings, paste the token into the auth field, then connect.
Control UI
WebChat

---
## Web > Tui

[Source: https://docs.openclaw.ai/web/tui]

Start the Gateway.
openclaw
gateway
Open the TUI.
openclaw
tui
Type a message and press Enter.
Remote Gateway:
openclaw
tui
--url
ws://
<
hos
>
<
por
>
--token
<
gateway-toke
>
Use
--password
if your Gateway uses password auth.
What you see
Header: connection URL, current agent, current session.
Chat log: user messages, assistant replies, system notices, tool cards.
Status line: connection/run state (connecting, running, streaming, idle, error).
Footer: connection state + agent + session + model + think/verbose/reasoning + token counts + deliver.
Input: text editor with autocomplete.
Mental model: agents + sessions
Agents are unique slugs (e.g.
main
research
). The Gateway exposes the list.
Sessions belong to the current agent.
Session keys are stored as
agent:<agentId>:<sessionKey>
If you type
/session main
, the TUI expands it to
agent:<currentAgent>:main
If you type
/session agent:other:main
, you switch to that agent session explicitly.
Session scope:
per-sender
(default): each agent has many sessions.
global
: the TUI always uses the
global
session (the picker may be empty).
The current agent + session are always visible in the footer.
Sending + delivery
Messages are sent to the Gateway; delivery to providers is off by default.
Turn delivery on:
/deliver on
or the Settings panel
or start with
openclaw tui --deliver
Pickers + overlays
Model picker: list available models and set the session override.
Agent picker: choose a different agent.
Session picker: shows only sessions for the current agent.
Settings: toggle deliver, tool output expansion, and thinking visibility.
Keyboard shortcuts
Enter: send message
Esc: abort active run
Ctrl+C: clear input (press twice to exit)
Ctrl+D: exit
Ctrl+L: model picker
Ctrl+G: agent picker
Ctrl+P: session picker
Ctrl+O: toggle tool output expansion
Ctrl+T: toggle thinking visibility (reloads history)
Slash commands
Core:
/help
/status
/agent <id>
(or
/agents
/session <key>
(or
/sessions
/model <provider/model>
(or
/models
Session controls:
/think <off|minimal|low|medium|high>
/verbose <on|full|off>
/reasoning <on|off|stream>
/usage <off|tokens|full>
/elevated <on|off|ask|full>
(alias:
/elev
/activation <mention|always>
/deliver <on|off>
Session lifecycle:
/new
/reset
(reset the session)
/abort
(abort the active run)
/settings
/exit
Other Gateway slash commands (for example,
/context
) are forwarded to the Gateway and shown as system output. See
Slash commands
Local shell commands
Prefix a line with
to run a local shell command on the TUI host.
The TUI prompts once per session to allow local execution; declining keeps
disabled for the session.
Commands run in a fresh, non-interactive shell in the TUI working directory (no persistent
/env).
A lone
is sent as a normal message; leading spaces do not trigger local exec.
Tool output
Tool calls show as cards with args + results.
Ctrl+O toggles between collapsed/expanded views.
While tools run, partial updates stream into the same card.
History + streaming
On connect, the TUI loads the latest history (default 200 messages).
Streaming responses update in place until finalized.
The TUI also listens to agent tool events for richer tool cards.
Connection details
The TUI registers with the Gateway as
mode: "tui"
Reconnects show a system message; event gaps are surfaced in the log.
Options
--url <url>
: Gateway WebSocket URL (defaults to config or
ws://127.0.0.1:<port>
--token <token>
: Gateway token (if required)
--password <password>
: Gateway password (if required)
--session <key>
: Session key (default:
main
, or
global
when scope is global)
--deliver
: Deliver assistant replies to the provider (default off)
--thinking <level>
: Override thinking level for sends
--timeout-ms <ms>
: Agent timeout in ms (defaults to
agents.defaults.timeoutSeconds
Note: when you set
--url
, the TUI does not fall back to config or environment credentials.
Pass
--token
--password
explicitly. Missing explicit credentials is an error.
Troubleshooting
No output after sending a message:
Run
/status
in the TUI to confirm the Gateway is connected and idle/busy.
Check the Gateway logs:
openclaw logs --follow
Confirm the agent can run:
openclaw status
and
openclaw models status
If you expect messages in a chat channel, enable delivery (
/deliver on
--deliver
--history-limit <n>
: History entries to load (default 200)
Connection troubleshooting
disconnected
: ensure the Gateway is running and your
--url/--token/--password
are correct.
No agents in picker: check
openclaw agents list
and your routing config.
Empty session picker: you might be in global scope or have no sessions yet.
WebChat

---
## Web > Webchat

[Source: https://docs.openclaw.ai/web/webchat]

WebChat (Gateway WebSocket UI)
Status: the macOS/iOS SwiftUI chat UI talks directly to the Gateway WebSocket.
What it is
A native chat UI for the gateway (no embedded browser and no local static server).
Uses the same sessions and routing rules as other channels.
Deterministic routing: replies always go back to WebChat.
Quick start
Start the gateway.
Open the WebChat UI (macOS/iOS app) or the Control UI chat tab.
Ensure gateway auth is configured (required by default, even on loopback).
How it works (behavior)
The UI connects to the Gateway WebSocket and uses
chat.history
chat.send
, and
chat.inject
chat.inject
appends an assistant note directly to the transcript and broadcasts it to the UI (no agent run).
Aborted runs can keep partial assistant output visible in the UI.
Gateway persists aborted partial assistant text into transcript history when buffered output exists, and marks those entries with abort metadata.
History is always fetched from the gateway (no local file watching).
If the gateway is unreachable, WebChat is read-only.
Remote use
Remote mode tunnels the gateway WebSocket over SSH/Tailscale.
You do not need to run a separate WebChat server.
Configuration reference (WebChat)
Full configuration:
Configuration
Channel options:
No dedicated
webchat.*
block. WebChat uses the gateway endpoint + auth settings below.
Related global options:
gateway.port
gateway.bind
: WebSocket host/port.
gateway.auth.mode
gateway.auth.token
gateway.auth.password
: WebSocket auth (token/password).
gateway.auth.mode: "trusted-proxy"
: reverse-proxy auth for browser clients (see
Trusted Proxy Auth
gateway.remote.url
gateway.remote.token
gateway.remote.password
: remote gateway target.
session.*
: session storage and main key defaults.
Dashboard
TUI

---
## Security > Formal Verification

[Source: https://docs.openclaw.ai/security/formal-verification]

v1++: additional bounded models (concurrency, retries, trace correctness)
Pairing store concurrency / idempotency
Ingress trace correlation / idempotency
Routing dmScope precedence + identityLinks
Security
Formal Verification (Security Models)
Formal Verification (Security Models)
This page tracks OpenClaw’s
formal security models
(TLA+/TLC today; more as needed).
Note: some older links may refer to the previous project name.
Goal (north star):
provide a machine-checked argument that OpenClaw enforces its
intended security policy (authorization, session isolation, tool gating, and
misconfiguration safety), under explicit assumptions.
What this is (today):
an executable, attacker-driven
security regression suite
Each claim has a runnable model-check over a finite state space.
Many claims have a paired
negative model
that produces a counterexample trace for a realistic bug class.
What this is not (yet):
a proof that “OpenClaw is secure in all respects” or that the full TypeScript implementation is correct.
Where the models live
Models are maintained in a separate repo:
vignesh07/openclaw-formal-models
Important caveats
These are
models
, not the full TypeScript implementation. Drift between model and code is possible.
Results are bounded by the state space explored by TLC; “green” does not imply security beyond the modeled assumptions and bounds.
Some claims rely on explicit environmental assumptions (e.g., correct deployment, correct configuration inputs).
Reproducing results
Today, results are reproduced by cloning the models repo locally and running TLC (see below). A future iteration could offer:
CI-run models with public artifacts (counterexample traces, run logs)
a hosted “run this model” workflow for small, bounded checks
Getting started:
git
clone
https://github.com/vignesh07/openclaw-formal-models
openclaw-formal-models
# Java 11+ required (TLC runs on the JVM).
# The repo vendors a pinned `tla2tools.jar` (TLA+ tools) and provides `bin/tlc` + Make targets.
make
<
targe
>
Gateway exposure and open gateway misconfiguration
Claim:
binding beyond loopback without auth can make remote compromise possible / increases exposure; token/password blocks unauth attackers (per the model assumptions).
Green runs:
make gateway-exposure-v2
make gateway-exposure-v2-protected
Red (expected):
make gateway-exposure-v2-negative
See also:
docs/gateway-exposure-matrix.md
in the models repo.
Nodes.run pipeline (highest-risk capability)
Claim:
nodes.run
requires (a) node command allowlist plus declared commands and (b) live approval when configured; approvals are tokenized to prevent replay (in the model).
Green runs:
make nodes-pipeline
make approvals-token
Red (expected):
make nodes-pipeline-negative
make approvals-token-negative
Pairing store (DM gating)
Claim:
pairing requests respect TTL and pending-request caps.
Green runs:
make pairing
make pairing-cap
Red (expected):
make pairing-negative
make pairing-cap-negative
Ingress gating (mentions + control-command bypass)
Claim:
in group contexts requiring mention, an unauthorized “control command” cannot bypass mention gating.
Green:
make ingress-gating
Red (expected):
make ingress-gating-negative
Routing/session-key isolation
Claim:
DMs from distinct peers do not collapse into the same session unless explicitly linked/configured.
Green:
make routing-isolation
Red (expected):
make routing-isolation-negative
v1++: additional bounded models (concurrency, retries, trace correctness)
These are follow-on models that tighten fidelity around real-world failure modes (non-atomic updates, retries, and message fan-out).
Pairing store concurrency / idempotency
Claim:
a pairing store should enforce
MaxPending
and idempotency even under interleavings (i.e., “check-then-write” must be atomic / locked; refresh shouldn’t create duplicates).
What it means:
Under concurrent requests, you can’t exceed
MaxPending
for a channel.
Repeated requests/refreshes for the same
(channel, sender)
should not create duplicate live pending rows.
Green runs:
make pairing-race
(atomic/locked cap check)
make pairing-idempotency
make pairing-refresh
make pairing-refresh-race
Red (expected):
make pairing-race-negative
(non-atomic begin/commit cap race)
make pairing-idempotency-negative
make pairing-refresh-negative
make pairing-refresh-race-negative
Ingress trace correlation / idempotency
Claim:
ingestion should preserve trace correlation across fan-out and be idempotent under provider retries.
What it means:
When one external event becomes multiple internal messages, every part keeps the same trace/event identity.
Retries do not result in double-processing.
If provider event IDs are missing, dedupe falls back to a safe key (e.g., trace ID) to avoid dropping distinct events.
Green:
make ingress-trace
make ingress-trace2
make ingress-idempotency
make ingress-dedupe-fallback
Red (expected):
make ingress-trace-negative
make ingress-trace2-negative
make ingress-idempotency-negative
make ingress-dedupe-fallback-negative
Routing dmScope precedence + identityLinks
Claim:
routing must keep DM sessions isolated by default, and only collapse sessions when explicitly configured (channel precedence + identity links).
What it means:
Channel-specific dmScope overrides must win over global defaults.
identityLinks should collapse only within explicit linked groups, not across unrelated peers.
Green:
make routing-precedence
make routing-identitylinks
Red (expected):
make routing-precedence-negative
make routing-identitylinks-negative
Tailscale
Web
