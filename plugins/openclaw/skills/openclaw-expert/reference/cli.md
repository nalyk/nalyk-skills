# OpenClaw CLI Complete Reference

Every CLI command and subcommand with flags, examples, and usage.

---
## Cli > Agent

[Source: https://docs.openclaw.ai/cli/agent]

--local
for embedded).
Use
--agent <id>
to target a configured agent directly.
Related:
Agent send tool:
Agent send
Examples
openclaw
agent
--to
+15555550123
--message
"status update"
--deliver
openclaw
agent
--agent
ops
--message
"Summarize logs"
openclaw
agent
--session-id
1234
--message
"Summarize inbox"
--thinking
medium
openclaw
agent
--agent
ops
--message
"Generate report"
--deliver
--reply-channel
slack
--reply-to
"#reports"
CLI Reference
agents

---
## Cli > Agents

[Source: https://docs.openclaw.ai/cli/agents]

Manage isolated agents (workspaces + auth + routing).
Related:
Multi-agent routing:
Multi-Agent Routing
Agent workspace:
Agent workspace
Examples
openclaw
agents
list
openclaw
agents
add
work
--workspace
~/.openclaw/workspace-work
openclaw
agents
set-identity
--workspace
~/.openclaw/workspace
--from-identity
openclaw
agents
set-identity
--agent
main
--avatar
avatars/openclaw.png
openclaw
agents
delete
work
Identity files
Each agent workspace can include an
IDENTITY.md
at the workspace root:
Example path:
~/.openclaw/workspace/IDENTITY.md
set-identity --from-identity
reads from the workspace root (or an explicit
--identity-file
Avatar paths resolve relative to the workspace root.
Set identity
set-identity
writes fields into
agents.list[].identity
name
theme
emoji
avatar
(workspace-relative path, http(s) URL, or data URI)
Load from
IDENTITY.md
openclaw
agents
set-identity
--workspace
~/.openclaw/workspace
--from-identity
Override fields explicitly:
openclaw
agents
set-identity
--agent
main
--name
"OpenClaw"
--emoji
"🦞"
--avatar
avatars/openclaw.png
Config sample:
agents
list
"main"
identity
name
"OpenClaw"
theme
"space lobster"
emoji
"🦞"
avatar
"avatars/openclaw.png"
agent
approvals

---
## Cli > Approvals

[Source: https://docs.openclaw.ai/cli/approvals]

openclaw approvals
Manage exec approvals for the
local host
gateway host
, or a
node host
By default, commands target the local approvals file on disk. Use
--gateway
to target the gateway, or
--node
to target a specific node.
Related:
Exec approvals:
Exec approvals
Nodes:
Nodes
Common commands
openclaw
approvals
get
openclaw
approvals
get
--node
<
name
>
openclaw
approvals
get
--gateway
Replace approvals from a file
openclaw
approvals
set
--file
./exec-approvals.json
openclaw
approvals
set
--node
<
name
>
--file
./exec-approvals.json
openclaw
approvals
set
--gateway
--file
./exec-approvals.json
Allowlist helpers
openclaw
approvals
allowlist
add
"~/Projects/**/bin/rg"
openclaw
approvals
allowlist
add
--agent
main
--node
<
name
>
"/usr/bin/uptime"
openclaw
approvals
allowlist
add
--agent
"*"
"/usr/bin/uname"
openclaw
approvals
allowlist
remove
"~/Projects/**/bin/rg"
Notes
--node
uses the same resolver as
openclaw nodes
(id, name, ip, or id prefix).
--agent
defaults to
"*"
, which applies to all agents.
The node host must advertise
system.execApprovals.get/set
(macOS app or headless node host).
Approvals files are stored per host at
~/.openclaw/exec-approvals.json
agents
browser

---
## Cli > Browser

[Source: https://docs.openclaw.ai/cli/browser]

Manage OpenClaw’s browser control server and run browser actions (tabs, snapshots, screenshots, navigation, clicks, typing).
Related:
Browser tool + API:
Browser tool
Chrome extension relay:
Chrome extension
Common flags
--url <gatewayWsUrl>
: Gateway WebSocket URL (defaults to config).
--token <token>
: Gateway token (if required).
--timeout <ms>
: request timeout (ms).
--browser-profile <name>
: choose a browser profile (default from config).
--json
: machine-readable output (where supported).
Quick start (local)
openclaw
browser
--browser-profile
chrome
tabs
openclaw
browser
--browser-profile
openclaw
start
openclaw
browser
--browser-profile
openclaw
open
https://example.com
openclaw
browser
--browser-profile
openclaw
snapshot
Profiles
Profiles are named browser routing configs. In practice:
openclaw
: launches/attaches to a dedicated OpenClaw-managed Chrome instance (isolated user data dir).
chrome
: controls your existing Chrome tab(s) via the Chrome extension relay.
openclaw
browser
profiles
openclaw
browser
create-profile
--name
work
--color
"#FF5A36"
openclaw
browser
delete-profile
--name
work
Use a specific profile:
openclaw
browser
--browser-profile
work
tabs
Tabs
openclaw
browser
tabs
openclaw
browser
open
https://docs.openclaw.ai
openclaw
browser
focus
<
targetI
>
openclaw
browser
close
<
targetI
>
Snapshot / screenshot / actions
Snapshot:
openclaw
browser
snapshot
Screenshot:
openclaw
browser
screenshot
Navigate/click/type (ref-based UI automation):
openclaw
browser
navigate
https://example.com
openclaw
browser
click
<
>
openclaw
browser
type
<
>
"hello"
Chrome extension relay (attach via toolbar button)
This mode lets the agent control an existing Chrome tab that you attach manually (it does not auto-attach).
Install the unpacked extension to a stable path:
openclaw
browser
extension
install
openclaw
browser
extension
path
Then Chrome →
chrome://extensions
→ enable “Developer mode” → “Load unpacked” → select the printed folder.
Full guide:
Chrome extension
Remote browser control (node host proxy)
If the Gateway runs on a different machine than the browser, run a
node host
on the machine that has Chrome/Brave/Edge/Chromium. The Gateway will proxy browser actions to that node (no separate browser control server required).
Use
gateway.nodes.browser.mode
to control auto-routing and
gateway.nodes.browser.node
to pin a specific node if multiple are connected.
Security + remote setup:
Browser tool
Remote access
Tailscale
Security
approvals
channels

---
## Cli > Channels

[Source: https://docs.openclaw.ai/cli/channels]

Manage chat channel accounts and their runtime status on the Gateway.
Related docs:
Channel guides:
Channels
Gateway configuration:
Configuration
Common commands
openclaw
channels
list
openclaw
channels
status
openclaw
channels
capabilities
openclaw
channels
capabilities
--channel
discord
--target
channel:123
openclaw
channels
resolve
--channel
slack
"#general"
"@jane"
openclaw
channels
logs
--channel
all
Add / remove accounts
openclaw
channels
add
--channel
telegram
--token
<
bot-toke
>
openclaw
channels
remove
--channel
telegram
--delete
Tip:
openclaw channels add --help
shows per-channel flags (token, app token, signal-cli paths, etc).
Login / logout (interactive)
openclaw
channels
login
--channel
whatsapp
openclaw
channels
logout
--channel
whatsapp
Troubleshooting
Run
openclaw status --deep
for a broad probe.
Use
openclaw doctor
for guided fixes.
openclaw channels list
prints
Claude: HTTP 403 ... user:profile
→ usage snapshot needs the
user:profile
scope. Use
--no-usage
, or provide a claude.ai session key (
CLAUDE_WEB_SESSION_KEY
CLAUDE_WEB_COOKIE
), or re-auth via Claude Code CLI.
Capabilities probe
Fetch provider capability hints (intents/scopes where available) plus static feature support:
openclaw
channels
capabilities
openclaw
channels
capabilities
--channel
discord
--target
channel:123
Notes:
--channel
is optional; omit it to list every channel (including extensions).
--target
accepts
channel:<id>
or a raw numeric channel id and only applies to Discord.
Probes are provider-specific: Discord intents + optional channel permissions; Slack bot + user scopes; Telegram bot flags + webhook; Signal daemon version; MS Teams app token + Graph roles/scopes (annotated where known). Channels without probes report
Probe: unavailable
Resolve names to IDs
Resolve channel/user names to IDs using the provider directory:
openclaw
channels
resolve
--channel
slack
"#general"
"@jane"
openclaw
channels
resolve
--channel
discord
"My Server/#support"
"@someone"
openclaw
channels
resolve
--channel
matrix
"Project Room"
Notes:
Use
--kind user|group|auto
to force the target type.
Resolution prefers active matches when multiple entries share the same name.
browser
configure

---
## Cli > Configure

[Source: https://docs.openclaw.ai/cli/configure]

openclaw configure
Interactive prompt to set up credentials, devices, and agent defaults.
Note: The
Model
section now includes a multi-select for the
agents.defaults.models
allowlist (what shows up in
/model
and the model picker).
Tip:
openclaw config
without a subcommand opens the same wizard. Use
openclaw config get|set|unset
for non-interactive edits.
Related:
Gateway configuration reference:
Configuration
Config CLI:
Config
Notes:
Choosing where the Gateway runs always updates
gateway.mode
. You can select “Continue” without other sections if that is all you need.
Channel-oriented services (Slack/Discord/Matrix/Microsoft Teams) prompt for channel/room allowlists during setup. You can enter names or IDs; the wizard resolves names to IDs when possible.
Examples
openclaw
configure
openclaw
configure
--section
models
--section
channels
channels
cron

---
## Cli > Cron

[Source: https://docs.openclaw.ai/cli/cron]

openclaw cron
Manage cron jobs for the Gateway scheduler.
Related:
Cron jobs:
Cron jobs
Tip: run
openclaw cron --help
for the full command surface.
Note: isolated
cron add
jobs default to
--announce
delivery. Use
--no-deliver
to keep
output internal.
--deliver
remains as a deprecated alias for
--announce
Note: one-shot (
--at
) jobs delete after success by default. Use
--keep-after-run
to keep them.
Note: recurring jobs now use exponential retry backoff after consecutive errors (30s → 1m → 5m → 15m → 60m), then return to normal schedule after the next successful run.
Common edits
Update delivery settings without changing the message:
openclaw
cron
edit
<
job-i
>
--announce
--channel
telegram
--to
"123456789"
Disable delivery for an isolated job:
openclaw
cron
edit
<
job-i
>
--no-deliver
Announce to a specific channel:
openclaw
cron
edit
<
job-i
>
--announce
--channel
slack
--to
"channel:C1234567890"
configure
dashboard

---
## Cli > Dashboard

[Source: https://docs.openclaw.ai/cli/dashboard]

Open the Control UI using your current auth.
openclaw
dashboard
openclaw
dashboard
--no-open
cron
directory

---
## Cli > Directory

[Source: https://docs.openclaw.ai/cli/directory]

Directory lookups for channels that support it (contacts/peers, groups, and “me”).
Common flags
--channel <name>
: channel id/alias (required when multiple channels are configured; auto when only one is configured)
--account <id>
: account id (default: channel default)
--json
: output JSON
Notes
directory
is meant to help you find IDs you can paste into other commands (especially
openclaw message send --target ...
For many channels, results are config-backed (allowlists / configured groups) rather than a live provider directory.
Default output is
(and sometimes
name
) separated by a tab; use
--json
for scripting.
Using results with
message send
openclaw
directory
peers
list
--channel
slack
--query
"U0"
openclaw
message
send
--channel
slack
--target
user:U012ABCDEF
--message
"hello"
ID formats (by channel)
WhatsApp:
+15551234567
(DM),
[email protected]
(group)
Telegram:
@username
or numeric chat id; groups are numeric ids
Slack:
user:U…
and
channel:C…
Discord:
user:<id>
and
channel:<id>
Matrix (plugin):
user:@user:server
room:!roomId:server
, or
#alias:server
Microsoft Teams (plugin):
user:<id>
and
conversation:<id>
Zalo (plugin): user id (Bot API)
Zalo Personal /
zalouser
(plugin): thread id (DM/group) from
zca
friend list
group list
Self (“me”)
openclaw
directory
self
--channel
zalouser
Peers (contacts/users)
openclaw
directory
peers
list
--channel
zalouser
openclaw
directory
peers
list
--channel
zalouser
--query
"name"
openclaw
directory
peers
list
--channel
zalouser
--limit
Groups
openclaw
directory
groups
list
--channel
zalouser
openclaw
directory
groups
list
--channel
zalouser
--query
"work"
openclaw
directory
groups
members
--channel
zalouser
--group-id
<
>
dashboard
dns

---
## Cli > Dns

[Source: https://docs.openclaw.ai/cli/dns]

DNS helpers for wide-area discovery (Tailscale + CoreDNS). Currently focused on macOS + Homebrew CoreDNS.
Related:
Gateway discovery:
Discovery
Wide-area discovery config:
Configuration
Setup
openclaw
dns
setup
openclaw
dns
setup
--apply
directory
docs

---
## Cli > Docs

[Source: https://docs.openclaw.ai/cli/docs]

Search the live docs index.
openclaw
docs
browser
extension
openclaw
docs
sandbox
allowHostControl
dns
doctor

---
## Cli > Doctor

[Source: https://docs.openclaw.ai/cli/doctor]

Health checks + quick fixes for the gateway and channels.
Related:
Troubleshooting:
Troubleshooting
Security audit:
Security
Examples
openclaw
doctor
openclaw
doctor
--repair
openclaw
doctor
--deep
Notes:
Interactive prompts (like keychain/OAuth fixes) only run when stdin is a TTY and
--non-interactive
not
set. Headless runs (cron, Telegram, no terminal) will skip prompts.
--fix
(alias for
--repair
) writes a backup to
~/.openclaw/openclaw.json.bak
and drops unknown config keys, listing each removal.
macOS:
launchctl
env overrides
If you previously ran
launchctl setenv OPENCLAW_GATEWAY_TOKEN ...
(or
...PASSWORD
), that value overrides your config file and can cause persistent “unauthorized” errors.
launchctl
getenv
OPENCLAW_GATEWAY_TOKEN
launchctl
getenv
OPENCLAW_GATEWAY_PASSWORD
launchctl
unsetenv
OPENCLAW_GATEWAY_TOKEN
launchctl
unsetenv
OPENCLAW_GATEWAY_PASSWORD
docs
gateway

---
## Cli > Gateway

[Source: https://docs.openclaw.ai/cli/gateway]

The Gateway is OpenClaw’s WebSocket server (channels, nodes, sessions, hooks).
Subcommands in this page live under
openclaw gateway …
Related docs:
/gateway/bonjour
/gateway/discovery
/gateway/configuration
Run the Gateway
Run a local Gateway process:
openclaw
gateway
Foreground alias:
openclaw
gateway
run
Notes:
By default, the Gateway refuses to start unless
gateway.mode=local
is set in
~/.openclaw/openclaw.json
. Use
--allow-unconfigured
for ad-hoc/dev runs.
Binding beyond loopback without auth is blocked (safety guardrail).
SIGUSR1
triggers an in-process restart when authorized (enable
commands.restart
or use the gateway tool/config apply/update).
SIGINT
SIGTERM
handlers stop the gateway process, but they don’t restore any custom terminal state. If you wrap the CLI with a TUI or raw-mode input, restore the terminal before exit.
Options
--port <port>
: WebSocket port (default comes from config/env; usually
18789
--bind <loopback|lan|tailnet|auto|custom>
: listener bind mode.
--auth <token|password>
: auth mode override.
--token <token>
: token override (also sets
OPENCLAW_GATEWAY_TOKEN
for the process).
--password <password>
: password override (also sets
OPENCLAW_GATEWAY_PASSWORD
for the process).
--tailscale <off|serve|funnel>
: expose the Gateway via Tailscale.
--tailscale-reset-on-exit
: reset Tailscale serve/funnel config on shutdown.
--allow-unconfigured
: allow gateway start without
gateway.mode=local
in config.
--dev
: create a dev config + workspace if missing (skips BOOTSTRAP.md).
--reset
: reset dev config + credentials + sessions + workspace (requires
--dev
--force
: kill any existing listener on the selected port before starting.
--verbose
: verbose logs.
--claude-cli-logs
: only show claude-cli logs in the console (and enable its stdout/stderr).
--ws-log <auto|full|compact>
: websocket log style (default
auto
--compact
: alias for
--ws-log compact
--raw-stream
: log raw model stream events to jsonl.
--raw-stream-path <path>
: raw stream jsonl path.
Query a running Gateway
All query commands use WebSocket RPC.
Output modes:
Default: human-readable (colored in TTY).
--json
: machine-readable JSON (no styling/spinner).
--no-color
(or
NO_COLOR=1
): disable ANSI while keeping human layout.
Shared options (where supported):
--url <url>
: Gateway WebSocket URL.
--token <token>
: Gateway token.
--password <password>
: Gateway password.
--timeout <ms>
: timeout/budget (varies per command).
--expect-final
: wait for a “final” response (agent calls).
Note: when you set
--url
, the CLI does not fall back to config or environment credentials.
Pass
--token
--password
explicitly. Missing explicit credentials is an error.
gateway health
openclaw
gateway
health
--url
ws://127.0.0.1:18789
gateway status
gateway status
shows the Gateway service (launchd/systemd/schtasks) plus an optional RPC probe.
openclaw
gateway
status
openclaw
gateway
status
--json
Options:
--url <url>
: override the probe URL.
--token <token>
: token auth for the probe.
--password <password>
: password auth for the probe.
--timeout <ms>
: probe timeout (default
10000
--no-probe
: skip the RPC probe (service-only view).
--deep
: scan system-level services too.
gateway probe
gateway probe
is the “debug everything” command. It always probes:
your configured remote gateway (if set), and
localhost (loopback)
even if remote is configured
If multiple gateways are reachable, it prints all of them. Multiple gateways are supported when you use isolated profiles/ports (e.g., a rescue bot), but most installs still run a single gateway.
openclaw
gateway
probe
openclaw
gateway
probe
--json
Remote over SSH (Mac app parity)
The macOS app “Remote over SSH” mode uses a local port-forward so the remote gateway (which may be bound to loopback only) becomes reachable at
ws://127.0.0.1:<port>
CLI equivalent:
openclaw
gateway
probe
--ssh
user@gateway-host
Options:
--ssh <target>
user@host
user@host:port
(port defaults to
--ssh-identity <path>
: identity file.
--ssh-auto
: pick the first discovered gateway host as SSH target (LAN/WAB only).
Config (optional, used as defaults):
gateway.remote.sshTarget
gateway.remote.sshIdentity
gateway call <method>
Low-level RPC helper.
openclaw
gateway
call
status
openclaw
gateway
call
logs.tail
--params
'{"sinceMs": 60000}'
Manage the Gateway service
openclaw
gateway
install
openclaw
gateway
start
openclaw
gateway
stop
openclaw
gateway
restart
openclaw
gateway
uninstall
Notes:
gateway install
supports
--port
--runtime
--token
--force
--json
Lifecycle commands accept
--json
for scripting.
Discover gateways (Bonjour)
gateway discover
scans for Gateway beacons (
_openclaw-gw._tcp
Multicast DNS-SD:
local.
Unicast DNS-SD (Wide-Area Bonjour): choose a domain (example:
openclaw.internal.
) and set up split DNS + a DNS server; see
/gateway/bonjour
Only gateways with Bonjour discovery enabled (default) advertise the beacon.
Wide-Area discovery records include (TXT):
role
(gateway role hint)
transport
(transport hint, e.g.
gateway
gatewayPort
(WebSocket port, usually
18789
sshPort
(SSH port; defaults to
if not present)
tailnetDns
(MagicDNS hostname, when available)
gatewayTls
gatewayTlsSha256
(TLS enabled + cert fingerprint)
cliPath
(optional hint for remote installs)
gateway discover
openclaw
gateway
discover
Options:
--timeout <ms>
: per-command timeout (browse/resolve); default
2000
--json
: machine-readable output (also disables styling/spinner).
Examples:
openclaw
gateway
discover
--timeout
4000
openclaw
gateway
discover
--json
'.beacons[].wsUrl'
doctor
health

---
## Cli > Health

[Source: https://docs.openclaw.ai/cli/health]

Fetch health from the running Gateway.
openclaw
health
openclaw
health
--json
openclaw
health
--verbose
Notes:
--verbose
runs live probes and prints per-account timings when multiple accounts are configured.
Output includes per-agent session stores when multiple agents are configured.
gateway
hooks

---
## Cli > Hooks

[Source: https://docs.openclaw.ai/cli/hooks]

Manage agent hooks (event-driven automations for commands like
/new
/reset
, and gateway startup).
Related:
Hooks:
Hooks
Plugin hooks:
Plugins
List All Hooks
openclaw
hooks
list
List all discovered hooks from workspace, managed, and bundled directories.
Options:
--eligible
: Show only eligible hooks (requirements met)
--json
: Output as JSON
-v, --verbose
: Show detailed information including missing requirements
Example output:
Hooks (4/4 ready)
Ready:
🚀 boot-md ✓ - Run BOOT.md on gateway startup
📎 bootstrap-extra-files ✓ - Inject extra workspace bootstrap files during agent bootstrap
📝 command-logger ✓ - Log all command events to a centralized audit file
💾 session-memory ✓ - Save session context to memory when /new command is issued
Example (verbose):
openclaw
hooks
list
--verbose
Shows missing requirements for ineligible hooks.
Example (JSON):
openclaw
hooks
list
--json
Returns structured JSON for programmatic use.
Get Hook Information
openclaw
hooks
info
<
nam
>
Show detailed information about a specific hook.
Arguments:
<name>
: Hook name (e.g.,
session-memory
Options:
--json
: Output as JSON
Example:
openclaw
hooks
info
session-memory
Output:
💾 session-memory ✓ Ready
Save session context to memory when /new command is issued
Details:
Source: openclaw-bundled
Path: /path/to/openclaw/hooks/bundled/session-memory/HOOK.md
Handler: /path/to/openclaw/hooks/bundled/session-memory/handler.ts
Homepage: https://docs.openclaw.ai/automation/hooks#session-memory
Events: command:new
Requirements:
Config: ✓ workspace.dir
Check Hooks Eligibility
openclaw
hooks
check
Show summary of hook eligibility status (how many are ready vs. not ready).
Options:
--json
: Output as JSON
Example output:
Hooks Status
Total hooks: 4
Ready: 4
Not ready: 0
Enable a Hook
openclaw
hooks
enable
<
nam
>
Enable a specific hook by adding it to your config (
~/.openclaw/config.json
Note:
Hooks managed by plugins show
plugin:<id>
openclaw hooks list
and
can’t be enabled/disabled here. Enable/disable the plugin instead.
Arguments:
<name>
: Hook name (e.g.,
session-memory
Example:
openclaw
hooks
enable
session-memory
Output:
✓ Enabled hook: 💾 session-memory
What it does:
Checks if hook exists and is eligible
Updates
hooks.internal.entries.<name>.enabled = true
in your config
Saves config to disk
After enabling:
Restart the gateway so hooks reload (menu bar app restart on macOS, or restart your gateway process in dev).
Disable a Hook
openclaw
hooks
disable
<
nam
>
Disable a specific hook by updating your config.
Arguments:
<name>
: Hook name (e.g.,
command-logger
Example:
openclaw
hooks
disable
command-logger
Output:
⏸ Disabled hook: 📝 command-logger
After disabling:
Restart the gateway so hooks reload
Install Hooks
openclaw
hooks
install
<
path-or-spe
>
Install a hook pack from a local folder/archive or npm.
Npm specs are
registry-only
(package name + optional version/tag). Git/URL/file
specs are rejected. Dependency installs run with
--ignore-scripts
for safety.
What it does:
Copies the hook pack into
~/.openclaw/hooks/<id>
Enables the installed hooks in
hooks.internal.entries.*
Records the install under
hooks.internal.installs
Options:
-l, --link
: Link a local directory instead of copying (adds it to
hooks.internal.load.extraDirs
Supported archives:
.zip
.tgz
.tar.gz
.tar
Examples:
# Local directory
openclaw
hooks
install
./my-hook-pack
# Local archive
openclaw
hooks
install
./my-hook-pack.zip
# NPM package
openclaw
hooks
install
@openclaw/my-hook-pack
# Link a local directory without copying
openclaw
hooks
install
./my-hook-pack
Update Hooks
openclaw
hooks
update
<
>
openclaw
hooks
update
--all
Update installed hook packs (npm installs only).
Options:
--all
: Update all tracked hook packs
--dry-run
: Show what would change without writing
Bundled Hooks
session-memory
Saves session context to memory when you issue
/new
Enable:
openclaw
hooks
enable
session-memory
Output:
~/.openclaw/workspace/memory/YYYY-MM-DD-slug.md
See:
session-memory documentation
bootstrap-extra-files
Injects additional bootstrap files (for example monorepo-local
AGENTS.md
TOOLS.md
) during
agent:bootstrap
Enable:
openclaw
hooks
enable
bootstrap-extra-files
See:
bootstrap-extra-files documentation
command-logger
Logs all command events to a centralized audit file.
Enable:
openclaw
hooks
enable
command-logger
Output:
~/.openclaw/logs/commands.log
View logs:
# Recent commands
tail
~/.openclaw/logs/commands.log
# Pretty-print
cat
~/.openclaw/logs/commands.log
# Filter by action
grep
'"action":"new"'
~/.openclaw/logs/commands.log
See:
command-logger documentation
boot-md
Runs
BOOT.md
when the gateway starts (after channels start).
Events
gateway:startup
Enable
openclaw
hooks
enable
boot-md
See:
boot-md documentation
health
logs

---
## Cli > Logs

[Source: https://docs.openclaw.ai/cli/logs]

Tail Gateway file logs over RPC (works in remote mode).
Related:
Logging overview:
Logging
Examples
openclaw
logs
openclaw
logs
--follow
openclaw
logs
--json
openclaw
logs
--limit
500
openclaw
logs
--local-time
openclaw
logs
--follow
--local-time
Use
--local-time
to render timestamps in your local timezone.
hooks
memory

---
## Cli > Memory

[Source: https://docs.openclaw.ai/cli/memory]

openclaw memory
Manage semantic memory indexing and search.
Provided by the active memory plugin (default:
memory-core
; set
plugins.slots.memory = "none"
to disable).
Related:
Memory concept:
Memory
Plugins:
Plugins
Examples
openclaw
memory
status
openclaw
memory
status
--deep
openclaw
memory
status
--deep
--index
openclaw
memory
status
--deep
--index
--verbose
openclaw
memory
index
openclaw
memory
index
--verbose
openclaw
memory
search
"release checklist"
openclaw
memory
status
--agent
main
openclaw
memory
index
--agent
main
--verbose
Options
Common:
--agent <id>
: scope to a single agent (default: all configured agents).
--verbose
: emit detailed logs during probes and indexing.
Notes:
memory status --deep
probes vector + embedding availability.
memory status --deep --index
runs a reindex if the store is dirty.
memory index --verbose
prints per-phase details (provider, model, sources, batch activity).
memory status
includes any extra paths configured via
memorySearch.extraPaths
logs
message

---
## Cli > Message

[Source: https://docs.openclaw.ai/cli/message]

Single outbound command for sending messages and channel actions
(Discord/Google Chat/Slack/Mattermost (plugin)/Telegram/WhatsApp/Signal/iMessage/MS Teams).
Usage
openclaw message <subcommand> [flags]
Channel selection:
--channel
required if more than one channel is configured.
If exactly one channel is configured, it becomes the default.
Values:
whatsapp|telegram|discord|googlechat|slack|mattermost|signal|imessage|msteams
(Mattermost requires plugin)
Target formats (
--target
WhatsApp: E.164 or group JID
Telegram: chat id or
@username
Discord:
channel:<id>
user:<id>
(or
<@id>
mention; raw numeric ids are treated as channels)
Google Chat:
spaces/<spaceId>
users/<userId>
Slack:
channel:<id>
user:<id>
(raw channel id is accepted)
Mattermost (plugin):
channel:<id>
user:<id>
, or
@username
(bare ids are treated as channels)
Signal:
+E.164
group:<id>
signal:+E.164
signal:group:<id>
, or
username:<name>
u:<name>
iMessage: handle,
chat_id:<id>
chat_guid:<guid>
, or
chat_identifier:<id>
MS Teams: conversation id (
19:
[email protected]
) or
conversation:<id>
user:<aad-object-id>
Name lookup:
For supported providers (Discord/Slack/etc), channel names like
Help
#help
are resolved via the directory cache.
On cache miss, OpenClaw will attempt a live directory lookup when the provider supports it.
Common flags
--channel <name>
--account <id>
--target <dest>
(target channel or user for send/poll/read/etc)
--targets <name>
(repeat; broadcast only)
--json
--dry-run
--verbose
Actions
Core
send
Channels: WhatsApp/Telegram/Discord/Google Chat/Slack/Mattermost (plugin)/Signal/iMessage/MS Teams
Required:
--target
, plus
--message
--media
Optional:
--media
--reply-to
--thread-id
--gif-playback
Telegram only:
--buttons
(requires
channels.telegram.capabilities.inlineButtons
to allow it)
Telegram only:
--thread-id
(forum topic id)
Slack only:
--thread-id
(thread timestamp;
--reply-to
uses the same field)
WhatsApp only:
--gif-playback
poll
Channels: WhatsApp/Telegram/Discord/Matrix/MS Teams
Required:
--target
--poll-question
--poll-option
(repeat)
Optional:
--poll-multi
Discord only:
--poll-duration-hours
--silent
--message
Telegram only:
--poll-duration-seconds
(5-600),
--silent
--poll-anonymous
--poll-public
--thread-id
react
Channels: Discord/Google Chat/Slack/Telegram/WhatsApp/Signal
Required:
--message-id
--target
Optional:
--emoji
--remove
--participant
--from-me
--target-author
--target-author-uuid
Note:
--remove
requires
--emoji
(omit
--emoji
to clear own reactions where supported; see /tools/reactions)
WhatsApp only:
--participant
--from-me
Signal group reactions:
--target-author
--target-author-uuid
required
reactions
Channels: Discord/Google Chat/Slack
Required:
--message-id
--target
Optional:
--limit
read
Channels: Discord/Slack
Required:
--target
Optional:
--limit
--before
--after
Discord only:
--around
edit
Channels: Discord/Slack
Required:
--message-id
--message
--target
delete
Channels: Discord/Slack/Telegram
Required:
--message-id
--target
pin
unpin
Channels: Discord/Slack
Required:
--message-id
--target
pins
(list)
Channels: Discord/Slack
Required:
--target
permissions
Channels: Discord
Required:
--target
search
Channels: Discord
Required:
--guild-id
--query
Optional:
--channel-id
--channel-ids
(repeat),
--author-id
--author-ids
(repeat),
--limit
Threads
thread create
Channels: Discord
Required:
--thread-name
--target
(channel id)
Optional:
--message-id
--message
--auto-archive-min
thread list
Channels: Discord
Required:
--guild-id
Optional:
--channel-id
--include-archived
--before
--limit
thread reply
Channels: Discord
Required:
--target
(thread id),
--message
Optional:
--media
--reply-to
Emojis
emoji list
Discord:
--guild-id
Slack: no extra flags
emoji upload
Channels: Discord
Required:
--guild-id
--emoji-name
--media
Optional:
--role-ids
(repeat)
Stickers
sticker send
Channels: Discord
Required:
--target
--sticker-id
(repeat)
Optional:
--message
sticker upload
Channels: Discord
Required:
--guild-id
--sticker-name
--sticker-desc
--sticker-tags
--media
Roles / Channels / Members / Voice
role info
(Discord):
--guild-id
role add
role remove
(Discord):
--guild-id
--user-id
--role-id
channel info
(Discord):
--target
channel list
(Discord):
--guild-id
member info
(Discord/Slack):
--user-id
--guild-id
for Discord)
voice status
(Discord):
--guild-id
--user-id
Events
event list
(Discord):
--guild-id
event create
(Discord):
--guild-id
--event-name
--start-time
Optional:
--end-time
--desc
--channel-id
--location
--event-type
Moderation (Discord)
timeout
--guild-id
--user-id
(optional
--duration-min
--until
; omit both to clear timeout)
kick
--guild-id
--user-id
--reason
ban
--guild-id
--user-id
--delete-days
--reason
timeout
also supports
--reason
Broadcast
broadcast
Channels: any configured channel; use
--channel all
to target all providers
Required:
--targets
(repeat)
Optional:
--message
--media
--dry-run
Examples
Send a Discord reply:
openclaw message send --channel discord \
--target channel:123 --message "hi" --reply-to 456
Create a Discord poll:
openclaw message poll --channel discord \
--target channel:123 \
--poll-question "Snack?" \
--poll-option Pizza --poll-option Sushi \
--poll-multi --poll-duration-hours 48
Create a Telegram poll (auto-close in 2 minutes):
openclaw message poll --channel telegram \
--target @mychat \
--poll-question "Lunch?" \
--poll-option Pizza --poll-option Sushi \
--poll-duration-seconds 120 --silent
Send a Teams proactive message:
openclaw message send --channel msteams \
--target conversation:19:
[email protected]
--message "hi"
Create a Teams poll:
openclaw message poll --channel msteams \
--target conversation:19:
[email protected]
--poll-question "Lunch?" \
--poll-option Pizza --poll-option Sushi
React in Slack:
openclaw message react --channel slack \
--target C123 --message-id 456 --emoji "✅"
React in a Signal group:
openclaw message react --channel signal \
--target signal:group:abc123 --message-id 1737630212345 \
--emoji "✅" --target-author-uuid 123e4567-e89b-12d3-a456-426614174000
Send Telegram inline buttons:
openclaw message send --channel telegram --target @mychat --message "Choose:" \
--buttons '[ [{"text":"Yes","callback_data":"cmd:yes"}], [{"text":"No","callback_data":"cmd:no"}] ]'
memory
models

---
## Cli > Models

[Source: https://docs.openclaw.ai/cli/models]

Model discovery, scanning, and configuration (default model, fallbacks, auth profiles).
Related:
Providers + models:
Models
Provider auth setup:
Getting started
Common commands
openclaw
models
status
openclaw
models
list
openclaw
models
set
<
model-or-alia
>
openclaw
models
scan
openclaw models status
shows the resolved default/fallbacks plus an auth overview.
When provider usage snapshots are available, the OAuth/token status section includes
provider usage headers.
Add
--probe
to run live auth probes against each configured provider profile.
Probes are real requests (may consume tokens and trigger rate limits).
Use
--agent <id>
to inspect a configured agent’s model/auth state. When omitted,
the command uses
OPENCLAW_AGENT_DIR
PI_CODING_AGENT_DIR
if set, otherwise the
configured default agent.
Notes:
models set <model-or-alias>
accepts
provider/model
or an alias.
Model refs are parsed by splitting on the
first
. If the model ID includes
(OpenRouter-style), include the provider prefix (example:
openrouter/moonshotai/kimi-k2
If you omit the provider, OpenClaw treats the input as an alias or a model for the
default provider
(only works when there is no
in the model ID).
models status
Options:
--json
--plain
--check
(exit 1=expired/missing, 2=expiring)
--probe
(live probe of configured auth profiles)
--probe-provider <name>
(probe one provider)
--probe-profile <id>
(repeat or comma-separated profile ids)
--probe-timeout <ms>
--probe-concurrency <n>
--probe-max-tokens <n>
--agent <id>
(configured agent id; overrides
OPENCLAW_AGENT_DIR
PI_CODING_AGENT_DIR
Aliases + fallbacks
openclaw
models
aliases
list
openclaw
models
fallbacks
list
Auth profiles
openclaw
models
auth
add
openclaw
models
auth
login
--provider
<
>
openclaw
models
auth
setup-token
openclaw
models
auth
paste-token
models auth login
runs a provider plugin’s auth flow (OAuth/API key). Use
openclaw plugins list
to see which providers are installed.
Notes:
setup-token
prompts for a setup-token value (generate it with
claude setup-token
on any machine).
paste-token
accepts a token string generated elsewhere or from automation.
message
nodes

---
## Cli > Nodes

[Source: https://docs.openclaw.ai/cli/nodes]

Manage paired nodes (devices) and invoke node capabilities.
Related:
Nodes overview:
Nodes
Camera:
Camera nodes
Images:
Image nodes
Common options:
--url
--token
--timeout
--json
Common commands
openclaw
nodes
list
openclaw
nodes
list
--connected
openclaw
nodes
list
--last-connected
24h
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
status
openclaw
nodes
status
--connected
openclaw
nodes
status
--last-connected
24h
nodes list
prints pending/paired tables. Paired rows include the most recent connect age (Last Connect).
Use
--connected
to only show currently-connected nodes. Use
--last-connected <duration>
filter to nodes that connected within a duration (e.g.
24h
Invoke / run
openclaw
nodes
invoke
--node
<
name
>
--command
<
comman
>
--params
<
jso
>
openclaw
nodes
run
--node
<
name
>
<
command..
>
openclaw
nodes
run
--raw
"git status"
openclaw
nodes
run
--agent
main
--node
<
name
>
--raw
"git status"
Invoke flags:
--params <json>
: JSON object string (default
--invoke-timeout <ms>
: node invoke timeout (default
15000
--idempotency-key <key>
: optional idempotency key.
Exec-style defaults
nodes run
mirrors the model’s exec behavior (defaults + approvals):
Reads
tools.exec.*
(plus
agents.list[].tools.exec.*
overrides).
Uses exec approvals (
exec.approval.request
) before invoking
system.run
--node
can be omitted when
tools.exec.node
is set.
Requires a node that advertises
system.run
(macOS companion app or headless node host).
Flags:
--cwd <path>
: working directory.
--env <key=val>
: env override (repeatable). Note: node hosts ignore
PATH
overrides (and
tools.exec.pathPrepend
is not applied to node hosts).
--command-timeout <ms>
: command timeout.
--invoke-timeout <ms>
: node invoke timeout (default
30000
--needs-screen-recording
: require screen recording permission.
--raw <command>
: run a shell string (
/bin/sh -lc
cmd.exe /c
--agent <id>
: agent-scoped approvals/allowlists (defaults to configured agent).
--ask <off|on-miss|always>
--security <deny|allowlist|full>
: overrides.
models
onboard

---
## Cli > Onboard

[Source: https://docs.openclaw.ai/cli/onboard]

openclaw onboard
Interactive onboarding wizard (local or remote Gateway setup).
Related guides
CLI onboarding hub:
Onboarding Wizard (CLI)
Onboarding overview:
Onboarding Overview
CLI onboarding reference:
CLI Onboarding Reference
CLI automation:
CLI Automation
macOS onboarding:
Onboarding (macOS App)
Examples
openclaw
onboard
openclaw
onboard
--flow
quickstart
openclaw
onboard
--flow
manual
openclaw
onboard
--mode
remote
--remote-url
ws://gateway-host:18789
Non-interactive custom provider:
openclaw
onboard
--non-interactive
--auth-choice
custom-api-key
--custom-base-url
"https://llm.example.com/v1"
--custom-model-id
"foo-large"
--custom-api-key
"$CUSTOM_API_KEY"
--custom-compatibility
openai
--custom-api-key
is optional in non-interactive mode. If omitted, onboarding checks
CUSTOM_API_KEY
Non-interactive Z.AI endpoint choices:
Note:
--auth-choice zai-api-key
now auto-detects the best Z.AI endpoint for your key (prefers the general API with
zai/glm-5
If you specifically want the GLM Coding Plan endpoints, pick
zai-coding-global
zai-coding-cn
# Promptless endpoint selection
openclaw
onboard
--non-interactive
--auth-choice
zai-coding-global
--zai-api-key
"$ZAI_API_KEY"
# Other Z.AI endpoint choices:
# --auth-choice zai-coding-cn
# --auth-choice zai-global
# --auth-choice zai-cn
Flow notes:
quickstart
: minimal prompts, auto-generates a gateway token.
manual
: full prompts for port/bind/auth (alias of
advanced
Fastest first chat:
openclaw dashboard
(Control UI, no channel setup).
Custom Provider: connect any OpenAI or Anthropic compatible endpoint,
including hosted providers not listed. Use Unknown to auto-detect.
Common follow-up commands
openclaw
configure
openclaw
agents
add
<
nam
>
--json
does not imply non-interactive mode. Use
--non-interactive
for scripts.
nodes
pairing

---
## Cli > Pairing

[Source: https://docs.openclaw.ai/cli/pairing]

Approve or inspect DM pairing requests (for channels that support pairing).
Related:
Pairing flow:
Pairing
Commands
openclaw
pairing
list
whatsapp
openclaw
pairing
approve
whatsapp
<
cod
>
--notify
onboard
plugins

---
## Cli > Plugins

[Source: https://docs.openclaw.ai/cli/plugins]

Manage Gateway plugins/extensions (loaded in-process).
Related:
Plugin system:
Plugins
Plugin manifest + schema:
Plugin manifest
Security hardening:
Security
Commands
openclaw
plugins
list
openclaw
plugins
info
<
>
openclaw
plugins
enable
<
>
openclaw
plugins
disable
<
>
openclaw
plugins
uninstall
<
>
openclaw
plugins
doctor
openclaw
plugins
update
<
>
openclaw
plugins
update
--all
Bundled plugins ship with OpenClaw but start disabled. Use
plugins enable
activate them.
All plugins must ship a
openclaw.plugin.json
file with an inline JSON Schema
configSchema
, even if empty). Missing/invalid manifests or schemas prevent
the plugin from loading and fail config validation.
Install
openclaw
plugins
install
<
path-or-spe
>
Security note: treat plugin installs like running code. Prefer pinned versions.
Npm specs are
registry-only
(package name + optional version/tag). Git/URL/file
specs are rejected. Dependency installs run with
--ignore-scripts
for safety.
Supported archives:
.zip
.tgz
.tar.gz
.tar
Use
--link
to avoid copying a local directory (adds to
plugins.load.paths
openclaw
plugins
install
./my-plugin
Uninstall
openclaw
plugins
uninstall
<
>
openclaw
plugins
uninstall
<
>
--dry-run
openclaw
plugins
uninstall
<
>
--keep-files
uninstall
removes plugin records from
plugins.entries
plugins.installs
the plugin allowlist, and linked
plugins.load.paths
entries when applicable.
For active memory plugins, the memory slot resets to
memory-core
By default, uninstall also removes the plugin install directory under the active
state dir extensions root (
$OPENCLAW_STATE_DIR/extensions/<id>
). Use
--keep-files
to keep files on disk.
--keep-config
is supported as a deprecated alias for
--keep-files
Update
openclaw
plugins
update
<
>
openclaw
plugins
update
--all
openclaw
plugins
update
<
>
--dry-run
Updates only apply to plugins installed from npm (tracked in
plugins.installs
pairing
reset

---
## Cli > Reset

[Source: https://docs.openclaw.ai/cli/reset]

Reset local config/state (keeps the CLI installed).
openclaw
reset
openclaw
reset
--dry-run
openclaw
reset
--scope
config+creds+sessions
--yes
--non-interactive
plugins
Sandbox CLI

---
## Cli > Sandbox

[Source: https://docs.openclaw.ai/cli/sandbox]

Manage Docker-based sandbox containers for isolated agent execution.
Overview
OpenClaw can run agents in isolated Docker containers for security. The
sandbox
commands help you manage these containers, especially after updates or configuration changes.
Commands
openclaw sandbox explain
Inspect the
effective
sandbox mode/scope/workspace access, sandbox tool policy, and elevated gates (with fix-it config key paths).
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
openclaw sandbox list
List all sandbox containers with their status and configuration.
openclaw
sandbox
list
openclaw
sandbox
list
--browser
# List only browser containers
openclaw
sandbox
list
--json
# JSON output
Output includes:
Container name and status (running/stopped)
Docker image and whether it matches config
Age (time since creation)
Idle time (time since last use)
Associated session/agent
openclaw sandbox recreate
Remove sandbox containers to force recreation with updated images/config.
openclaw
sandbox
recreate
--all
# Recreate all containers
openclaw
sandbox
recreate
--session
main
# Specific session
openclaw
sandbox
recreate
--agent
mybot
# Specific agent
openclaw
sandbox
recreate
--browser
# Only browser containers
openclaw
sandbox
recreate
--all
--force
# Skip confirmation
Options:
--all
: Recreate all sandbox containers
--session <key>
: Recreate container for specific session
--agent <id>
: Recreate containers for specific agent
--browser
: Only recreate browser containers
--force
: Skip confirmation prompt
Important:
Containers are automatically recreated when the agent is next used.
Use Cases
After updating Docker images
# Pull new image
docker
pull
openclaw-sandbox:latest
docker
tag
openclaw-sandbox:latest
openclaw-sandbox:bookworm-slim
# Update config to use new image
# Edit config: agents.defaults.sandbox.docker.image (or agents.list[].sandbox.docker.image)
# Recreate containers
openclaw
sandbox
recreate
--all
After changing sandbox configuration
# Edit config: agents.defaults.sandbox.* (or agents.list[].sandbox.*)
# Recreate to apply new config
openclaw
sandbox
recreate
--all
After changing setupCommand
openclaw
sandbox
recreate
--all
# or just one agent:
openclaw
sandbox
recreate
--agent
family
For a specific agent only
# Update only one agent's containers
openclaw
sandbox
recreate
--agent
alfred
Why is this needed?
Problem:
When you update sandbox Docker images or configuration:
Existing containers continue running with old settings
Containers are only pruned after 24h of inactivity
Regularly-used agents keep old containers running indefinitely
Solution:
Use
openclaw sandbox recreate
to force removal of old containers. They’ll be recreated automatically with current settings when next needed.
Tip: prefer
openclaw sandbox recreate
over manual
docker rm
. It uses the
Gateway’s container naming and avoids mismatches when scope/session keys change.
Configuration
Sandbox settings live in
~/.openclaw/openclaw.json
under
agents.defaults.sandbox
(per-agent overrides go in
agents.list[].sandbox
"agents"
"defaults"
"sandbox"
"mode"
"all"
// off, non-main, all
"scope"
"agent"
// session, agent, shared
"docker"
"image"
"openclaw-sandbox:bookworm-slim"
"containerPrefix"
"openclaw-sbx-"
// ... more Docker options
"prune"
"idleHours"
// Auto-prune after 24h idle
"maxAgeDays"
// Auto-prune after 7 days
See Also
Sandbox Documentation
Agent Configuration
Doctor Command
- Check sandbox setup
reset
security

---
## Cli > Security

[Source: https://docs.openclaw.ai/cli/security]

Security tools (audit + optional fixes).
Related:
Security guide:
Security
Audit
openclaw
security
audit
openclaw
security
audit
--deep
openclaw
security
audit
--fix
The audit warns when multiple DM senders share the main session and recommends
secure DM mode
session.dmScope="per-channel-peer"
(or
per-account-channel-peer
for multi-account channels) for shared inboxes.
It also warns when small models (
<=300B
) are used without sandboxing and with web/browser tools enabled.
For webhook ingress, it warns when
hooks.defaultSessionKey
is unset, when request
sessionKey
overrides are enabled, and when overrides are enabled without
hooks.allowedSessionKeyPrefixes
It also warns when sandbox Docker settings are configured while sandbox mode is off, when
gateway.nodes.denyCommands
uses ineffective pattern-like/unknown entries, when global
tools.profile="minimal"
is overridden by agent tool profiles, and when installed extension plugin tools may be reachable under permissive tool policy.
Sandbox CLI
sessions

---
## Cli > Sessions

[Source: https://docs.openclaw.ai/cli/sessions]

List stored conversation sessions.
openclaw
sessions
openclaw
sessions
--active
120
openclaw
sessions
--json
security
setup

---
## Cli > Setup

[Source: https://docs.openclaw.ai/cli/setup]

and the agent workspace.
Related:
Getting started:
Getting started
Wizard:
Onboarding
Examples
openclaw
setup
openclaw
setup
--workspace
~/.openclaw/workspace
To run the wizard via setup:
openclaw
setup
--wizard
sessions
skills

---
## Cli > Skills

[Source: https://docs.openclaw.ai/cli/skills]

Inspect skills (bundled + workspace + managed overrides) and see what’s eligible vs missing requirements.
Related:
Skills system:
Skills
Skills config:
Skills config
ClawHub installs:
ClawHub
Commands
openclaw
skills
list
openclaw
skills
list
--eligible
openclaw
skills
info
<
nam
>
openclaw
skills
check
setup
status

---
## Cli > Status

[Source: https://docs.openclaw.ai/cli/status]

Diagnostics for channels + sessions.
openclaw
status
openclaw
status
--all
openclaw
status
--deep
openclaw
status
--usage
Notes:
--deep
runs live probes (WhatsApp Web + Telegram + Discord + Google Chat + Slack + Signal).
Output includes per-agent session stores when multiple agents are configured.
Overview includes Gateway + node host service install/runtime status when available.
Overview includes update channel + git SHA (for source checkouts).
Update info surfaces in the Overview; if an update is available, status prints a hint to run
openclaw update
(see
Updating
skills
system

---
## Cli > System

[Source: https://docs.openclaw.ai/cli/system]

System-level helpers for the Gateway: enqueue system events, control heartbeats,
and view presence.
Common commands
openclaw
system
event
--text
"Check for urgent follow-ups"
--mode
now
openclaw
system
heartbeat
enable
openclaw
system
heartbeat
last
openclaw
system
presence
system event
Enqueue a system event on the
main
session. The next heartbeat will inject
it as a
System:
line in the prompt. Use
--mode now
to trigger the heartbeat
immediately;
next-heartbeat
waits for the next scheduled tick.
Flags:
--text <text>
: required system event text.
--mode <mode>
now
next-heartbeat
(default).
--json
: machine-readable output.
system heartbeat last|enable|disable
Heartbeat controls:
last
: show the last heartbeat event.
enable
: turn heartbeats back on (use this if they were disabled).
disable
: pause heartbeats.
Flags:
--json
: machine-readable output.
system presence
List the current system presence entries the Gateway knows about (nodes,
instances, and similar status lines).
Flags:
--json
: machine-readable output.
Notes
Requires a running Gateway reachable by your current config (local or remote).
System events are ephemeral and not persisted across restarts.
status
tui

---
## Cli > Tui

[Source: https://docs.openclaw.ai/cli/tui]

Open the terminal UI connected to the Gateway.
Related:
TUI guide:
TUI
Examples
openclaw
tui
openclaw
tui
--url
ws://127.0.0.1:18789
--token
<
toke
>
openclaw
tui
--session
main
--deliver
system
uninstall

---
## Cli > Uninstall

[Source: https://docs.openclaw.ai/cli/uninstall]

Uninstall the gateway service + local data (CLI remains).
openclaw
uninstall
openclaw
uninstall
--all
--yes
openclaw
uninstall
--dry-run
tui
update

---
## Cli > Update

[Source: https://docs.openclaw.ai/cli/update]

--update shorthand
See also
CLI commands
update
openclaw update
Safely update OpenClaw and switch between stable/beta/dev channels.
If you installed via
npm/pnpm
(global install, no git metadata), updates happen via the package manager flow in
Updating
Usage
openclaw
update
openclaw
update
status
openclaw
update
wizard
openclaw
update
--channel
beta
openclaw
update
--channel
dev
openclaw
update
--tag
beta
openclaw
update
--no-restart
openclaw
update
--json
openclaw
--update
Options
--no-restart
: skip restarting the Gateway service after a successful update.
--channel <stable|beta|dev>
: set the update channel (git + npm; persisted in config).
--tag <dist-tag|version>
: override the npm dist-tag or version for this update only.
--json
: print machine-readable
UpdateRunResult
JSON.
--timeout <seconds>
: per-step timeout (default is 1200s).
Note: downgrades require confirmation because older versions can break configuration.
update status
Show the active update channel + git tag/branch/SHA (for source checkouts), plus update availability.
openclaw
update
status
openclaw
update
status
--json
openclaw
update
status
--timeout
Options:
--json
: print machine-readable status JSON.
--timeout <seconds>
: timeout for checks (default is 3s).
update wizard
Interactive flow to pick an update channel and confirm whether to restart the Gateway
after updating (default is to restart). If you select
dev
without a git checkout, it
offers to create one.
What it does
When you switch channels explicitly (
--channel ...
), OpenClaw also keeps the
install method aligned:
dev
→ ensures a git checkout (default:
~/openclaw
, override with
OPENCLAW_GIT_DIR
updates it, and installs the global CLI from that checkout.
stable
beta
→ installs from npm using the matching dist-tag.
Git checkout flow
Channels:
stable
: checkout the latest non-beta tag, then build + doctor.
beta
: checkout the latest
-beta
tag, then build + doctor.
dev
: checkout
main
, then fetch + rebase.
High-level:
Requires a clean worktree (no uncommitted changes).
Switches to the selected channel (tag or branch).
Fetches upstream (dev only).
Dev only: preflight lint + TypeScript build in a temp worktree; if the tip fails, walks back up to 10 commits to find the newest clean build.
Rebases onto the selected commit (dev only).
Installs deps (pnpm preferred; npm fallback).
Builds + builds the Control UI.
Runs
openclaw doctor
as the final “safe update” check.
Syncs plugins to the active channel (dev uses bundled extensions; stable/beta uses npm) and updates npm-installed plugins.
--update
shorthand
openclaw --update
rewrites to
openclaw update
(useful for shells and launcher scripts).
See also
openclaw doctor
(offers to run update first on git checkouts)
Development channels
Updating
CLI reference
uninstall
voicecall

---
## Cli > Voicecall

[Source: https://docs.openclaw.ai/cli/voicecall]

is a plugin-provided command. It only appears if the voice-call plugin is installed and enabled.
Primary doc:
Voice-call plugin:
Voice Call
Common commands
openclaw
voicecall
status
--call-id
<
>
openclaw
voicecall
call
--to
"+15555550123"
--message
"Hello"
--mode
notify
openclaw
voicecall
continue
--call-id
<
>
--message
"Any questions?"
openclaw
voicecall
end
--call-id
<
>
Exposing webhooks (Tailscale)
openclaw
voicecall
expose
--mode
serve
openclaw
voicecall
expose
--mode
funnel
openclaw
voicecall
unexpose
Security note: only expose the webhook endpoint to networks you trust. Prefer Tailscale Serve over Funnel when possible.
update
RPC Adapters---
## Cli > ACP

[Source: https://docs.openclaw.ai/cli/acp]

# ACP Command Documentation

## Overview

The `acp` command operates an Agent Client Protocol bridge that connects IDEs and clients to OpenClaw Gateway instances via WebSocket, maintaining mapped sessions between ACP and Gateway protocols.

## Core Usage Patterns

**Local Gateway:**
```bash
openclaw acp
```

**Remote Gateway with token:**
```bash
openclaw acp --url wss://gateway-host:18789 --token <token>
openclaw acp --url wss://gateway-host:18789 --token-file ~/.openclaw/gateway.token
```

**Session targeting:**
```bash
openclaw acp --session agent:main:main
openclaw acp --session-label "support inbox"
openclaw acp --session agent:main:main --reset-session
```

## Debug Mode

The built-in client allows interactive testing:

```bash
openclaw acp client
openclaw acp client --server-args --url wss://gateway-host:18789 --token-file ~/.openclaw/gateway.token
openclaw acp client --server "node" --server-args openclaw.mjs acp --url ws://127.0.0.1:19001
```

## Primary Flags

| Flag | Purpose |
|------|---------|
| `--url <url>` | Gateway WebSocket endpoint |
| `--token <token>` | Authentication token |
| `--token-file <path>` | Token sourced from file |
| `--password <password>` | Authentication password |
| `--password-file <path>` | Password sourced from file |
| `--session <key>` | Specific Gateway session key |
| `--session-label <label>` | Resolve session by existing label |
| `--require-existing` | Error if session doesn't exist |
| `--reset-session` | Create fresh session ID |
| `--no-prefix-cwd` | Omit directory prefix from prompts |
| `--verbose, -v` | Enhanced stderr logging |

## Zed Editor Integration

Configure in `~/.config/zed/settings.json`:

```json
{
  "agent_servers": {
    "OpenClaw ACP": {
      "type": "custom",
      "command": "openclaw",
      "args": ["acp"]
    }
  }
}
```

## Client Debug Options

| Flag | Purpose |
|------|---------|
| `--cwd <dir>` | Working directory context |
| `--server <command>` | ACP server executable |
| `--server-args <args...>` | Additional server arguments |
| `--server-verbose` | Server-side verbose logging |
| `--verbose, -v` | Client logging |

## Security Recommendations

Prefer environment variables or file-based credentials over command-line arguments to avoid process-listing exposure:
- `OPENCLAW_GATEWAY_TOKEN`
- `OPENCLAW_GATEWAY_PASSWORD`

---
## Cli > Clawbot

[Source: https://docs.openclaw.ai/cli/clawbot]

# OpenClaw clawbot Documentation

## Overview

The `openclaw clawbot` command represents a legacy namespace maintained for backward compatibility purposes.

## Supported Commands

Currently, only one alias is available:
- `openclaw clawbot qr` — provides identical functionality to the modern `openclaw qr` command

## Migration Guidance

The documentation recommends transitioning to newer top-level commands rather than using the legacy namespace:

**Legacy command:**
```
openclaw clawbot qr
```

**Modern equivalent:**
```
openclaw qr
```

## Key Takeaway

Users should migrate away from the `clawbot` namespace and adopt the streamlined command structure available at the root level of the CLI tool.

---
## Cli > Completion

[Source: https://docs.openclaw.ai/cli/completion]

# OpenClaw Completion Command Documentation

## Command Overview
The `openclaw completion` command generates shell completion scripts for various shell environments and can optionally install them into your shell profile.

## Usage Examples
The command supports several invocation patterns:
- Basic usage: `openclaw completion`
- Specify shell: `openclaw completion --shell zsh`
- Install to profile: `openclaw completion --install`
- Combined options: `openclaw completion --shell fish --install`
- State file operations: `openclaw completion --write-state`

## Available Flags

**Shell Selection:**
- `-s, --shell <shell>`: "shell target (`zsh`, `bash`, `powershell`, `fish`; default: `zsh`)"

**Installation Options:**
- `-i, --install`: "install completion by adding a source line to your shell profile"
- `--write-state`: "write completion script(s) to `$OPENCLAW_STATE_DIR/completions` without printing to stdout"
- `-y, --yes`: "skip install confirmation prompts"

## Key Behaviors

The `--install` flag modifies your shell profile by adding a small configuration block that references cached completion scripts rather than embedding them directly.

By default, without installation flags, the script outputs to standard output for piping or manual review.

The completion generation process eagerly loads the entire command tree to ensure nested subcommands are properly included in the generated completion scripts.

---
## Cli > Config

[Source: https://docs.openclaw.ai/cli/config]

# OpenClaw Config Documentation

## Overview
The `openclaw config` command manages configuration settings through a path-based interface. Running it without arguments opens the configure wizard (equivalent to `openclaw configure`).

## Subcommands

**Get**: Retrieve configuration values
- `openclaw config get <path>`

**Set**: Assign configuration values
- `openclaw config set <path> <value>`

**Unset**: Remove configuration values
- `openclaw config unset <path>`

## Path Syntax

Configuration uses "dot or bracket notation" to navigate the settings structure:
- Dot notation: `agents.defaults.workspace`
- Bracket notation for array indices: `agents.list[0].id`

You can target specific agents in the list using index numbers: `agents.list[1].tools.exec.node`

## Value Parsing

Values are "parsed as JSON5 when possible; otherwise they are treated as strings." Use the `--strict-json` flag to enforce JSON5 parsing requirements. The legacy `--json` alias remains supported.

## Common Examples

```bash
openclaw config get browser.executablePath
openclaw config set browser.executablePath "/usr/bin/google-chrome"
openclaw config set agents.defaults.heartbeat.every "2h"
openclaw config set gateway.port 19001 --strict-json
openclaw config set channels.whatsapp.groups '["*"]' --strict-json
openclaw config unset tools.web.search.apiKey
```

## Important Note

After making edits, restart the gateway to apply changes.

---
## Cli > Daemon

[Source: https://docs.openclaw.ai/cli/daemon]

# Documentation: `openclaw daemon`

## Overview
The `openclaw daemon` command is a legacy alias that maps to `openclaw gateway` service management. It provides platform-specific service control through `launchd` (macOS), `systemd` (Linux), or `schtasks` (Windows).

## Available Subcommands

The command supports six service management operations:

- **status**: Display installation state and health probe results for Gateway
- **install**: Deploy service using platform-appropriate mechanisms
- **uninstall**: Remove the installed service
- **start**: Activate the service
- **stop**: Deactivate the service
- **restart**: Cycle the service

## Command-Line Options

**For status checks:**
`--url`, `--token`, `--password`, `--timeout`, `--no-probe`, `--deep`, `--json`

**For installation:**
`--port`, `--runtime <node|bun>`, `--token`, `--force`, `--json`

**For lifecycle operations** (uninstall, start, stop, restart):
`--json`

## Usage Examples

```bash
openclaw daemon status
openclaw daemon install
openclaw daemon start
openclaw daemon stop
openclaw daemon restart
openclaw daemon uninstall
```

## Recommendation

The documentation advises consulting the newer `openclaw gateway` reference for current documentation and practical examples.

---
## Cli > Devices

[Source: https://docs.openclaw.ai/cli/devices]

# OpenClaw Devices Documentation

## Overview

The `openclaw devices` command manages device pairing requests and device-scoped tokens through a CLI interface.

## Available Subcommands

**List Operations:**
- `openclaw devices list` - Display pending pairing requests and paired devices
- `openclaw devices list --json` - Output results in JSON format

**Device Removal:**
- `openclaw devices remove <deviceId>` - Delete a single paired device entry
- `openclaw devices remove <deviceId> --json` - Removal with JSON output

**Bulk Management:**
- `openclaw devices clear --yes` - Bulk removal of paired devices (requires confirmation flag)
- `openclaw devices clear --yes --pending` - Clear pending requests specifically
- `openclaw devices clear --yes --pending --json` - Bulk operations with JSON formatting

**Pairing Approval:**
- `openclaw devices approve` - Automatically approve the most recent pending request
- `openclaw devices approve <requestId>` - Approve a specific pairing request
- `openclaw devices approve --latest` - Approve the latest pending request

**Pairing Rejection:**
- `openclaw devices reject <requestId>` - Decline a pending pairing request

**Token Management:**
- `openclaw devices rotate --device <id> --role <role> [--scope <scope...>]` - Generate new token for specified role with optional scope updates
- `openclaw devices revoke --device <id> --role <role>` - Invalidate a device token

## Global Options

Available across all commands:
- `--url <url>` - Specify Gateway WebSocket address (uses `gateway.remote.url` config if omitted)
- `--token <token>` - Authentication token
- `--password <password>` - Password-based authentication
- `--timeout <ms>` - Set RPC timeout duration
- `--json` - Enable structured JSON output

## Key Requirements & Notes

- Token rotation produces sensitive credentials requiring secure handling
- Operations require `operator.pairing` or `operator.admin` authorization scope
- Bulk clearing requires explicit `--yes` flag as safety measure
- Local loopback pairing fallback available when scopes unavailable without explicit `--url` parameter

---
## Cli > Node

[Source: https://docs.openclaw.ai/cli/node]

# Complete Documentation: `openclaw node`

## Overview
The `openclaw node` command runs a headless node host connecting to the Gateway WebSocket, exposing `system.run` and `system.which` capabilities on remote machines.

## Primary Use Cases
- Execute commands on distant Linux/Windows systems (build servers, lab equipment, NAS)
- Keep execution sandboxed at the gateway while delegating approved runs elsewhere
- Deploy lightweight, headless targets for automation or CI workflows

All execution remains protected by exec approvals and per-agent allowlists.

## Browser Proxy Feature
Node hosts automatically advertise a browser proxy unless explicitly disabled. To disable:

```json5
{
  nodeHost: {
    browserProxy: {
      enabled: false,
    },
  },
}
```

## Foreground Execution
Launch an interactive node host:

```bash
openclaw node run --host <gateway-host> --port 18789
```

**Available flags:**
- `--host <host>`: Gateway WebSocket destination (default: `127.0.0.1`)
- `--port <port>`: WebSocket port (default: `18789`)
- `--tls`: Enable TLS for gateway connection
- `--tls-fingerprint <sha256>`: Expected certificate fingerprint
- `--node-id <id>`: Custom node identifier (clears existing token)
- `--display-name <name>`: Custom display identifier

## Background Service Installation
Install as a persistent user service:

```bash
openclaw node install --host <gateway-host> --port 18789
```

**Installation flags:** Same as foreground, plus:
- `--runtime <runtime>`: Service runtime selection (`node` or `bun`)
- `--force`: Reinstall/overwrite existing installation

**Service management commands:**
```bash
openclaw node status
openclaw node stop
openclaw node restart
openclaw node uninstall
```

Service commands support `--json` for structured output.

## Pairing Process
Initial connections generate a pending pair request. Approve via:

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
```

Configuration stored in `~/.openclaw/node.json` includes node ID, token, display name, and gateway details.

## Execution Controls
`system.run` operations are restricted by:
- Local exec approvals (`~/.openclaw/exec-approvals.json`)
- Gateway-level management: `openclaw approvals --node <id|name|ip>`

---
## Cli > QR

[Source: https://docs.openclaw.ai/cli/qr]

# OpenClaw QR Command Documentation

## Command Overview
The `openclaw qr` command generates iOS pairing QR codes and setup codes from your current Gateway configuration.

## Basic Usage Patterns
The command supports several invocation styles:
- Standard QR generation: `openclaw qr`
- Setup code only output: `openclaw qr --setup-code-only`
- JSON formatted output: `openclaw qr --json`
- Remote gateway mode: `openclaw qr --remote`
- Custom gateway specification: `openclaw qr --url wss://gateway.example/ws --token '<token>'`

## Available Flags

**URL & Authentication Options:**
- `--remote`: Leverages `gateway.remote.url` with stored remote credentials
- `--url <url>`: Replaces the gateway URL in the payload
- `--public-url <url>`: Substitutes the public URL in the payload
- `--token <token>`: Overrides gateway authentication token
- `--password <password>`: Overrides gateway password

**Output Formatting:**
- `--setup-code-only`: Returns exclusively the setup code string
- `--no-ascii`: Omits ASCII-rendered QR visualization
- `--json`: Delivers structured JSON with setupCode, gatewayUrl, auth, and urlSource fields

## Important Constraints
The `--token` and `--password` options cannot be used simultaneously—select one authentication method.

## Device Pairing Workflow
After scanning the generated QR code, complete pairing approval through:
- `openclaw devices list` to view pending requests
- `openclaw devices approve <requestId>` to authorize the device

---
## Cli > Webhooks

[Source: https://docs.openclaw.ai/cli/webhooks]

# Webhooks Documentation

## Overview
The `openclaw webhooks` command provides webhook integration helpers, including Gmail Pub/Sub support and general webhook functionality.

## Available Subcommands

**Gmail Integration:**
- `openclaw webhooks gmail setup --account you@example.com` - Initializes Gmail Pub/Sub
- `openclaw webhooks gmail run` - Executes the Gmail webhook service

## Related Resources
- Webhook documentation: `/automation/webhook`
- Gmail Pub/Sub details: `/automation/gmail-pubsub`

## Key Points
The command surfaces utilities for setting up and managing webhooks. The Gmail feature requires account configuration before running. Additional details about implementation and configuration are available in the dedicated Gmail Pub/Sub documentation section.
