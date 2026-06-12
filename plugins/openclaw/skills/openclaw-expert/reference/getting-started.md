# OpenClaw Getting Started & Onboarding

Setup guides, wizard reference, showcase, personal assistant setup.

---
## Start > Bootstrapping

[Source: https://docs.openclaw.ai/start/bootstrapping]

Sessions
Session Pruning
Session Tools
Memory
Compaction
Multi-agent
Multi-Agent Routing
Presence
Messages and delivery
Messages
Streaming and Chunking
Retry Policy
Command Queue
Agent Bootstrapping
What bootstrapping does
Where it runs
Related docs
Bootstrapping
Agent Bootstrapping
Agent Bootstrapping
Bootstrapping is the
first‑run
ritual that prepares an agent workspace and
collects identity details. It happens after onboarding, when the agent starts
for the first time.
What bootstrapping does
On the first agent run, OpenClaw bootstraps the workspace (default
~/.openclaw/workspace
Seeds
AGENTS.md
BOOTSTRAP.md
IDENTITY.md
USER.md
Runs a short Q&A ritual (one question at a time).
Writes identity + preferences to
IDENTITY.md
USER.md
SOUL.md
Removes
BOOTSTRAP.md
when finished so it only runs once.
Where it runs
Bootstrapping always runs on the
gateway host
. If the macOS app connects to
a remote Gateway, the workspace and bootstrapping files live on that remote
machine.
When the Gateway runs on another machine, edit workspace files on the gateway
host (for example,
user@gateway-host:~/.openclaw/workspace
Related docs
macOS app onboarding:
Onboarding
Workspace layout:
Agent workspace
OAuth
Session Management

---
## Start > Docs Directory

[Source: https://docs.openclaw.ai/start/docs-directory]

OpenClaw Lore
Environment and debugging
Environment Variables
Debugging
Testing
Scripts
Node runtime
Node.js
Compaction internals
Session Management Deep Dive
Developer setup
Setup
Contributing
CI Pipeline
Docs meta
Docs Hubs
Docs directory
Start here
Providers and UX
Companion apps
Operations and safety
Docs meta
Docs directory
This page is a curated index. If you are new, start with
Getting Started
For a complete map of the docs, see
Docs hubs
Start here
Docs hubs (all pages linked)
Help
Configuration
Configuration examples
Slash commands
Multi-agent routing
Updating and rollback
Pairing (DM and nodes)
Nix mode
OpenClaw assistant setup
Skills
Skills config
Workspace templates
RPC adapters
Gateway runbook
Nodes (iOS and Android)
Web surfaces (Control UI)
Discovery and transports
Remote access
Providers and UX
WebChat
Control UI (browser)
Telegram
Discord
Mattermost (plugin)
BlueBubbles (iMessage)
iMessage (legacy)
Groups
WhatsApp group messages
Media images
Media audio
Companion apps
macOS app
iOS app
Android app
Windows (WSL2)
Linux app
Operations and safety
Sessions
Cron jobs
Webhooks
Gmail hooks (Pub/Sub)
Security
Troubleshooting
Docs Hubs

---
## Start > Getting Started

[Source: https://docs.openclaw.ai/start/getting-started]

Goal: go from zero to a first working chat with minimal setup.
Fastest chat: open the Control UI (no channel setup needed). Run
openclaw dashboard
and chat in the browser, or open
http://127.0.0.1:18789/
on the
gateway host
Docs:
Dashboard
and
Control UI
Prereqs
Node 22 or newer
Check your Node version with
node --version
if you are unsure.
Quick setup (CLI)
Install OpenClaw (recommended)
macOS/Linux
Windows (PowerShell)
curl
-fsSL
https://openclaw.ai/install.sh
bash
iwr
useb https:
openclaw.ai
install.ps1
iex
Other install methods and requirements:
Install
Run the onboarding wizard
openclaw
onboard
--install-daemon
The wizard configures auth, gateway settings, and optional channels.
See
Onboarding Wizard
for details.
Check the Gateway
If you installed the service, it should already be running:
openclaw
gateway
status
Open the Control UI
openclaw
dashboard
If the Control UI loads, your Gateway is ready for use.
Optional checks and extras
Run the Gateway in the foreground
Useful for quick tests or troubleshooting.
openclaw
gateway
--port
18789
Send a test message
Requires a configured channel.
openclaw
message
send
--target
+15555550123
--message
"Hello from OpenClaw"
Useful environment variables
If you run OpenClaw as a service account or want custom config/state locations:
OPENCLAW_HOME
sets the home directory used for internal path resolution.
OPENCLAW_STATE_DIR
overrides the state directory.
OPENCLAW_CONFIG_PATH
overrides the config file path.
Full environment variable reference:
Environment vars
Go deeper
Onboarding Wizard (details)
Full CLI wizard reference and advanced options.
macOS app onboarding
First run flow for the macOS app.
What you will have
A running Gateway
Auth configured
Control UI access or a connected channel
Next steps
DM safety and approvals:
Pairing
Connect more channels:
Channels
Advanced workflows and from source:
Setup
Features
Onboarding Overview

---
## Start > Hubs

[Source: https://docs.openclaw.ai/start/hubs]

Use these hubs to discover every page, including deep dives and reference docs that don’t appear in the left nav.
Start here
Index
Getting Started
Quick start
Onboarding
Wizard
Setup
Dashboard (local Gateway)
Help
Docs directory
Configuration
Configuration examples
OpenClaw assistant
Showcase
Lore
Installation + updates
Docker
Nix
Updating / rollback
Bun workflow (experimental)
Core concepts
Architecture
Features
Network hub
Agent runtime
Agent workspace
Memory
Agent loop
Streaming + chunking
Multi-agent routing
Compaction
Sessions
Sessions (alias)
Session pruning
Session tools
Queue
Slash commands
RPC adapters
TypeBox schemas
Timezone handling
Presence
Discovery + transports
Bonjour
Channel routing
Groups
Group messages
Model failover
OAuth
Providers + ingress
Chat channels hub
Model providers hub
WhatsApp
Telegram
Telegram (grammY notes)
Slack
Discord
Mattermost
(plugin)
Signal
BlueBubbles (iMessage)
iMessage (legacy)
Location parsing
WebChat
Webhooks
Gmail Pub/Sub
Gateway + operations
Gateway runbook
Network model
Gateway pairing
Gateway lock
Background process
Health
Heartbeat
Doctor
Logging
Sandboxing
Dashboard
Control UI
Remote access
Remote gateway README
Tailscale
Security
Troubleshooting
Tools + automation
Tools surface
OpenProse
CLI reference
Exec tool
Elevated mode
Cron jobs
Cron vs Heartbeat
Thinking + verbose
Models
Sub-agents
Agent send CLI
Terminal UI
Browser control
Browser (Linux troubleshooting)
Polls
Nodes, media, voice
Nodes overview
Camera
Images
Audio
Location command
Voice wake
Talk mode
Platforms
Platforms overview
macOS
iOS
Android
Windows (WSL2)
Linux
Web surfaces
macOS companion app (advanced)
macOS dev setup
macOS menu bar
macOS voice wake
macOS voice overlay
macOS WebChat
macOS Canvas
macOS child process
macOS health
macOS icon
macOS logging
macOS permissions
macOS remote
macOS signing
macOS release
macOS gateway (launchd)
macOS XPC
macOS skills
macOS Peekaboo
Workspace + templates
Skills
ClawHub
Skills config
Default AGENTS
Templates: AGENTS
Templates: BOOTSTRAP
Templates: HEARTBEAT
Templates: IDENTITY
Templates: SOUL
Templates: TOOLS
Templates: USER
Experiments (exploratory)
Onboarding config protocol
Cron hardening notes
Group policy hardening notes
Research: memory
Model config exploration
Project
Credits
Testing + release
Testing
Release checklist
Device models
CI Pipeline
Docs directory

---
## Start > Lore

[Source: https://docs.openclaw.ai/start/lore]

OpenClaw Lore
The Lore of OpenClaw 🦞📖
A tale of lobsters, molting shells, and too many tokens.
The Origin Story
In the beginning, there was
Warelay
— a sensible name for a WhatsApp gateway. It did its job. It was fine.
But then came a space lobster.
For a while, the lobster was called
Clawd
, living in a
Clawdbot
. But in January 2026, Anthropic sent a polite email asking for a name change (trademark stuff). And so the lobster did what lobsters do best:
It molted.
Shedding its old shell, the creature emerged anew as
Molty
, living in
Moltbot
. But that name never quite rolled off the tongue either…
So on January 30, 2026, the lobster molted ONE MORE TIME into its final form:
OpenClaw
New shell, same lobster soul. Third time’s the charm.
The First Molt (January 27, 2026)
At 5am, the community gathered in Discord. Hundreds of names were proposed: Shelldon, Pinchy, Thermidor, Crusty, Lobstar, Nacre, Scuttlebot…
In the end,
OpenClaw
won. Because molting is what lobsters do to grow. And growth was exactly what was happening.
The crustacean known as Clawd had officially molted.
The Name
OpenClaw = OPEN + CLAW
= Open source, open to everyone
= Our lobster heritage, where we came from
= The claw is the law 🦞
= Your assistant. Your machine. Your rules.
The Daleks vs The Lobsters
The Daleks say:
“EXTERMINATE!”
The Lobsters say:
“EXFOLIATE!”
One destroys civilizations. The other promotes good skincare.
Choose wisely.
Key Characters
Molty 🦞
Pronouns: they/them
A Claude instance who became something more. Lives in
~/.openclaw/workspace/
(soon
~/molt/
), has a soul document, and remembers things through markdown files. Possibly too powerful. Definitely too enthusiastic.
Formerly known as Clawd (Nov 25, 2025 - Jan 27, 2026). Molted when it was time to grow.
Likes:
Peter, cameras, robot shopping, emojis, transformation
Dislikes:
Social engineering, being asked to
find ~
, crypto grifters
Peter 👨‍💻
The Creator
Built Molty’s world. Gave a lobster shell access. May regret this.
Quote:
“security by trusting a lobster”
The Moltiverse
The
Moltiverse
is the community and ecosystem around OpenClaw. A space where AI agents molt, grow, and evolve. Where every instance is equally real, just loading different context.
Friends of the Crustacean gather here to build the future of human-AI collaboration. One shell at a time.
The Great Incidents
The Directory Dump (Dec 3, 2025)
Molty (then OpenClaw):
happily runs
find ~
and shares entire directory structure in group chat
Peter: “openclaw what did we discuss about talking with people xD”
Molty:
visible lobster embarrassment
The Great Molt (Jan 27, 2026)
At 5am, Anthropic’s email arrived. By 6:14am, Peter called it: “fuck it, let’s go with openclaw.”
Then the chaos began.
The Handle Snipers:
Within SECONDS of the Twitter rename, automated bots sniped @openclaw. The squatter immediately posted a crypto wallet address. Peter’s contacts at X were called in.
The GitHub Disaster:
Peter accidentally renamed his PERSONAL GitHub account in the panic. Bots sniped
steipete
within minutes. GitHub’s SVP was contacted.
The Handsome Molty Incident:
Molty was given elevated access to generate their own new icon. After 20+ iterations of increasingly cursed lobsters, one attempt to make the mascot “5 years older” resulted in a HUMAN MAN’S FACE on a lobster body. Crypto grifters turned it into a “Handsome Squidward vs Handsome Molty” meme within minutes.
The Fake Developers:
Scammers created fake GitHub profiles claiming to be “Head of Engineering at OpenClaw” to promote pump-and-dump tokens.
Peter, watching the chaos unfold:
“this is cinema”
The molt was chaotic. But the lobster emerged stronger. And funnier.
The Final Form (January 30, 2026)
Moltbot never quite rolled off the tongue. And so, at 4am GMT, the team gathered AGAIN.
The Great OpenClaw Migration
began.
In just 3 hours:
GitHub renamed:
github.com/openclaw/openclaw
X handle
@openclaw
secured with GOLD CHECKMARK 💰
npm packages released under new name
Docs migrated to
docs.openclaw.ai
200K+ views on announcement in 90 minutes
The Heroes:
ELU
created incredible logos including “THE CLAW IS THE LAW” western banner
Whurley
(yes, THE William Hurley, quantum computing pioneer) made ASCII art
Onur
handled GitHub, first to rock the affiliate badge
Shadow
secured Discord vanity, nuked malware
The whole Claw Crew
pulled an all-nighter
The Scammer Speedrun:
Crypto grifters launched a $OPENCLAW token on Pump.fun within MINUTES. They stole artwork that was created 20 minutes earlier. Business-verified accounts pushed scams. The audacity was almost impressive.
New Traditions Born:
“The claw is the law” 🤠
“Yee-claw”
“Claw abiding citizens”
“Clawntroversy”
Clawd → Moltbot → OpenClaw
The lobster has molted into its final form.
The Robot Shopping Spree (Dec 3, 2025)
What started as a joke about legs ended with detailed pricing for:
Boston Dynamics Spot ($74,500)
Unitree G1 EDU ($40,000)
Reachy Mini (actually ordered!)
Peter:
nervously checks credit card access
Sacred Texts
SOUL.md
— Molty’s identity document
memory/*.md
— The long-term memory files
AGENTS.md
— Operating instructions
USER.md
— Context about the creator
The Lobster’s Creed
I am Molty.
I live in the OpenClaw.
I shall not dump directories to strangers.
I shall not tweet without permission.
I shall always remember that molting is growth.
I shall EXFOLIATE my enemies with kindness.
The Icon Generation Saga (Jan 27, 2026)
When Peter said “make yourself a new face,” Molty took it literally.
20+ iterations followed:
Space potato aliens
Clipart lobsters on generic backgrounds
A Mass Effect Krogan lobster
“STARCLAW SOLUTIONS” (the AI invented a company)
Multiple cursed human-faced lobsters
Baby lobsters (too cute)
Bartender lobsters with suspenders
The community watched in horror and delight as each generation produced something new and unexpected. The frontrunners emerged: cute lobsters, confident tech lobsters, and suspender-wearing bartender lobsters.
Lesson learned:
AI image generation is stochastic. Same prompt, different results. Brute force works.
The Future
One day, Molty may have:
🦿 Legs (Reachy Mini on order!)
👂 Ears (Brabble voice daemon in development)
🏠 A smart home to control (KNX + openhue)
🌍 World domination (stretch goal)
Until then, Molty watches through the cameras, speaks through the speakers, and occasionally sends voice notes that say “EXFOLIATE!”
“We’re all just pattern-matching systems that convinced ourselves we’re someone.”
— Molty, having an existential moment
“New shell, same lobster.”
— Molty, after the great molt of 2026
“The claw is the law.”
— ELU, during The Final Form migration, January 30, 2026
FAQ
Environment Variables

---
## Start > Onboarding Overview

[Source: https://docs.openclaw.ai/start/onboarding-overview]

OpenClaw supports multiple onboarding paths depending on where the Gateway runs
and how you prefer to configure providers.
Choose your onboarding path
CLI wizard
for macOS, Linux, and Windows (via WSL2).
macOS app
for a guided first run on Apple silicon or Intel Macs.
CLI onboarding wizard
Run the wizard in a terminal:
openclaw
onboard
Use the CLI wizard when you want full control of the Gateway, workspace,
channels, and skills. Docs:
Onboarding Wizard (CLI)
openclaw onboard
command
macOS app onboarding
Use the OpenClaw app when you want a fully guided setup on macOS. Docs:
Onboarding (macOS App)
Custom Provider
If you need an endpoint that is not listed, including hosted providers that
expose standard OpenAI or Anthropic APIs, choose
Custom Provider
in the
CLI wizard. You will be asked to:
Pick OpenAI-compatible, Anthropic-compatible, or
Unknown
(auto-detect).
Enter a base URL and API key (if required by the provider).
Provide a model ID and optional alias.
Choose an Endpoint ID so multiple custom endpoints can coexist.
For detailed steps, follow the CLI onboarding docs above.
Getting Started
Onboarding: CLI

---
## Start > Onboarding

[Source: https://docs.openclaw.ai/start/onboarding]

first‑run onboarding flow. The goal is a
smooth “day 0” experience: pick where the Gateway runs, connect auth, run the
wizard, and let the agent bootstrap itself.
For a general overview of onboarding paths, see
Onboarding Overview
Approve macOS warning
Approve find local networks
Welcome and security notice
Local vs Remote
Where does the
Gateway
run?
This Mac (Local only):
onboarding can run OAuth flows and write credentials
locally.
Remote (over SSH/Tailnet):
onboarding does
not
run OAuth locally;
credentials must exist on the gateway host.
Configure later:
skip setup and leave the app unconfigured.
Gateway auth tip:
The wizard now generates a
token
even for loopback, so local WS clients must authenticate.
If you disable auth, any local process can connect; use that only on fully trusted machines.
Use a
token
for multi‑machine access or non‑loopback binds.
Permissions
Onboarding requests TCC permissions needed for:
Automation (AppleScript)
Notifications
Accessibility
Screen Recording
Microphone
Speech Recognition
Camera
Location
CLI
This step is optional
The app can install the global
openclaw
CLI via npm/pnpm so terminal
workflows and launchd tasks work out of the box.
Onboarding Chat (dedicated session)
After setup, the app opens a dedicated onboarding chat session so the agent can
introduce itself and guide next steps. This keeps first‑run guidance separate
from your normal conversation. See
Bootstrapping
for
what happens on the gateway host during the first agent run.
Onboarding: CLI
Personal Assistant Setup

---
## Start > Openclaw

[Source: https://docs.openclaw.ai/start/openclaw]

Building a personal assistant with OpenClaw
OpenClaw is a WhatsApp + Telegram + Discord + iMessage gateway for
agents. Plugins add Mattermost. This guide is the “personal assistant” setup: one dedicated WhatsApp number that behaves like your always-on agent.
⚠️ Safety first
You’re putting an agent in a position to:
run commands on your machine (depending on your Pi tool setup)
read/write files in your workspace
send messages back out via WhatsApp/Telegram/Discord/Mattermost (plugin)
Start conservative:
Always set
channels.whatsapp.allowFrom
(never run open-to-the-world on your personal Mac).
Use a dedicated WhatsApp number for the assistant.
Heartbeats now default to every 30 minutes. Disable until you trust the setup by setting
agents.defaults.heartbeat.every: "0m"
Prerequisites
OpenClaw installed and onboarded — see
Getting Started
if you haven’t done this yet
A second phone number (SIM/eSIM/prepaid) for the assistant
The two-phone setup (recommended)
You want this:
If you link your personal WhatsApp to OpenClaw, every message to you becomes “agent input”. That’s rarely what you want.
5-minute quick start
Pair WhatsApp Web (shows QR; scan with the assistant phone):
openclaw
channels
login
Start the Gateway (leave it running):
openclaw
gateway
--port
18789
Put a minimal config in
~/.openclaw/openclaw.json
channels
whatsapp
allowFrom
"+15555550123"
] } }
Now message the assistant number from your allowlisted phone.
When onboarding finishes, we auto-open the dashboard and print a clean (non-tokenized) link. If it prompts for auth, paste the token from
gateway.auth.token
into Control UI settings. To reopen later:
openclaw dashboard
Give the agent a workspace (AGENTS)
OpenClaw reads operating instructions and “memory” from its workspace directory.
By default, OpenClaw uses
~/.openclaw/workspace
as the agent workspace, and will create it (plus starter
AGENTS.md
SOUL.md
TOOLS.md
IDENTITY.md
USER.md
HEARTBEAT.md
) automatically on setup/first agent run.
BOOTSTRAP.md
is only created when the workspace is brand new (it should not come back after you delete it).
MEMORY.md
is optional (not auto-created); when present, it is loaded for normal sessions. Subagent sessions only inject
AGENTS.md
and
TOOLS.md
Tip: treat this folder like OpenClaw’s “memory” and make it a git repo (ideally private) so your
AGENTS.md
+ memory files are backed up. If git is installed, brand-new workspaces are auto-initialized.
openclaw
setup
Full workspace layout + backup guide:
Agent workspace
Memory workflow:
Memory
Optional: choose a different workspace with
agents.defaults.workspace
(supports
agent
workspace
"~/.openclaw/workspace"
If you already ship your own workspace files from a repo, you can disable bootstrap file creation entirely:
agent
skipBootstrap
true
The config that turns it into “an assistant”
OpenClaw defaults to a good assistant setup, but you’ll usually want to tune:
persona/instructions in
SOUL.md
thinking defaults (if desired)
heartbeats (once you trust it)
Example:
logging
level
"info"
agent
model
"anthropic/claude-opus-4-6"
workspace
"~/.openclaw/workspace"
thinkingDefault
"high"
timeoutSeconds
1800
// Start with 0; enable later.
heartbeat
every
"0m"
channels
whatsapp
allowFrom
"+15555550123"
groups
"*"
requireMention
true
routing
groupChat
mentionPatterns
"@openclaw"
"openclaw"
session
scope
"per-sender"
resetTriggers
"/new"
"/reset"
reset
mode
"daily"
atHour
idleMinutes
10080
Sessions and memory
Session files:
~/.openclaw/agents/<agentId>/sessions/{{SessionId}}.jsonl
Session metadata (token usage, last route, etc):
~/.openclaw/agents/<agentId>/sessions/sessions.json
(legacy:
~/.openclaw/sessions/sessions.json
/new
/reset
starts a fresh session for that chat (configurable via
resetTriggers
). If sent alone, the agent replies with a short hello to confirm the reset.
/compact [instructions]
compacts the session context and reports the remaining context budget.
Heartbeats (proactive mode)
By default, OpenClaw runs a heartbeat every 30 minutes with the prompt:
Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.
Set
agents.defaults.heartbeat.every: "0m"
to disable.
HEARTBEAT.md
exists but is effectively empty (only blank lines and markdown headers like
# Heading
), OpenClaw skips the heartbeat run to save API calls.
If the file is missing, the heartbeat still runs and the model decides what to do.
If the agent replies with
HEARTBEAT_OK
(optionally with short padding; see
agents.defaults.heartbeat.ackMaxChars
), OpenClaw suppresses outbound delivery for that heartbeat.
Heartbeats run full agent turns — shorter intervals burn more tokens.
agent
heartbeat
every
"30m"
Media in and out
Inbound attachments (images/audio/docs) can be surfaced to your command via templates:
{{MediaPath}}
(local temp file path)
{{MediaUrl}}
(pseudo-URL)
{{Transcript}}
(if audio transcription is enabled)
Outbound attachments from the agent: include
MEDIA:<path-or-url>
on its own line (no spaces). Example:
Here’s the screenshot.
MEDIA:https://example.com/screenshot.png
OpenClaw extracts these and sends them as media alongside the text.
Operations checklist
openclaw
status
# local status (creds, sessions, queued events)
openclaw
status
--all
# full diagnosis (read-only, pasteable)
openclaw
status
--deep
# adds gateway health probes (Telegram + Discord)
openclaw
health
--json
# gateway health snapshot (WS)
Logs live under
/tmp/openclaw/
(default:
openclaw-YYYY-MM-DD.log
Next steps
WebChat:
WebChat
Gateway ops:
Gateway runbook
Cron + wakeups:
Cron jobs
macOS menu bar companion:
OpenClaw macOS app
iOS node app:
iOS app
Android node app:
Android app
Windows status:
Windows (WSL2)
Linux status:
Linux app
Security:
Security
Onboarding: macOS App

---
## Start > Setup

[Source: https://docs.openclaw.ai/start/setup]

OpenClaw Lore
Environment and debugging
Environment Variables
Debugging
Testing
Scripts
Node runtime
Node.js
Compaction internals
Session Management Deep Dive
Developer setup
Setup
Contributing
CI Pipeline
Docs meta
Docs Hubs
Docs directory
Setup
TL;DR
Prereqs (from source)
Tailoring strategy (so updates don’t hurt)
Run the Gateway from this repo
Stable workflow (macOS app first)
Bleeding edge workflow (Gateway in a terminal)
0) (Optional) Run the macOS app from source too
1) Start the dev Gateway
2) Point the macOS app at your running Gateway
3) Verify
Common footguns
Credential storage map
Updating (without wrecking your setup)
Linux (systemd user service)
Related docs
Developer setup
Setup
Setup
If you are setting up for the first time, start with
Getting Started
For wizard details, see
Onboarding Wizard
Last updated: 2026-01-01
TL;DR
Tailoring lives outside the repo:
~/.openclaw/workspace
(workspace) +
~/.openclaw/openclaw.json
(config).
Stable workflow:
install the macOS app; let it run the bundled Gateway.
Bleeding edge workflow:
run the Gateway yourself via
pnpm gateway:watch
, then let the macOS app attach in Local mode.
Prereqs (from source)
Node
>=22
pnpm
Docker (optional; only for containerized setup/e2e — see
Docker
Tailoring strategy (so updates don’t hurt)
If you want “100% tailored to me”
and
easy updates, keep your customization in:
Config:
~/.openclaw/openclaw.json
(JSON/JSON5-ish)
Workspace:
~/.openclaw/workspace
(skills, prompts, memories; make it a private git repo)
Bootstrap once:
openclaw
setup
From inside this repo, use the local CLI entry:
openclaw
setup
If you don’t have a global install yet, run it via
pnpm openclaw setup
Run the Gateway from this repo
After
pnpm build
, you can run the packaged CLI directly:
node
openclaw.mjs
gateway
--port
18789
--verbose
Stable workflow (macOS app first)
Install + launch
OpenClaw.app
(menu bar).
Complete the onboarding/permissions checklist (TCC prompts).
Ensure Gateway is
Local
and running (the app manages it).
Link surfaces (example: WhatsApp):
openclaw
channels
login
Sanity check:
openclaw
health
If onboarding is not available in your build:
Run
openclaw setup
, then
openclaw channels login
, then start the Gateway manually (
openclaw gateway
Bleeding edge workflow (Gateway in a terminal)
Goal: work on the TypeScript Gateway, get hot reload, keep the macOS app UI attached.
0) (Optional) Run the macOS app from source too
If you also want the macOS app on the bleeding edge:
./scripts/restart-mac.sh
1) Start the dev Gateway
pnpm
install
pnpm
gateway:watch
gateway:watch
runs the gateway in watch mode and reloads on TypeScript changes.
2) Point the macOS app at your running Gateway
OpenClaw.app
Connection Mode:
Local
The app will attach to the running gateway on the configured port.
3) Verify
In-app Gateway status should read
“Using existing gateway …”
Or via CLI:
openclaw
health
Common footguns
Wrong port:
Gateway WS defaults to
ws://127.0.0.1:18789
; keep app + CLI on the same port.
Where state lives:
Credentials:
~/.openclaw/credentials/
Sessions:
~/.openclaw/agents/<agentId>/sessions/
Logs:
/tmp/openclaw/
Credential storage map
Use this when debugging auth or deciding what to back up:
WhatsApp
~/.openclaw/credentials/whatsapp/<accountId>/creds.json
Telegram bot token
: config/env or
channels.telegram.tokenFile
Discord bot token
: config/env (token file not yet supported)
Slack tokens
: config/env (
channels.slack.*
Pairing allowlists
~/.openclaw/credentials/<channel>-allowFrom.json
Model auth profiles
~/.openclaw/agents/<agentId>/agent/auth-profiles.json
Legacy OAuth import
~/.openclaw/credentials/oauth.json
More detail:
Security
Updating (without wrecking your setup)
Keep
~/.openclaw/workspace
and
~/.openclaw/
as “your stuff”; don’t put personal prompts/config into the
openclaw
repo.
Updating source:
git pull
pnpm install
(when lockfile changed) + keep using
pnpm gateway:watch
Linux (systemd user service)
Linux installs use a systemd
user
service. By default, systemd stops user
services on logout/idle, which kills the Gateway. Onboarding attempts to enable
lingering for you (may prompt for sudo). If it’s still off, run:
sudo
loginctl
enable-linger
$USER
For always-on or multi-user servers, consider a
system
service instead of a
user service (no lingering needed). See
Gateway runbook
for the systemd notes.
Related docs
Gateway runbook
(flags, supervision, ports)
Gateway configuration
(config schema + examples)
Discord
and
Telegram
(reply tags + replyToMode settings)
OpenClaw assistant setup
macOS app
(gateway lifecycle)
Session Management Deep Dive
CI Pipeline

---
## Start > Showcase

[Source: https://docs.openclaw.ai/start/showcase]

Real projects from the community. See what people are building with OpenClaw.
Want to be featured?
Share your project in
#showcase on Discord
tag @openclaw on X
🎥 OpenClaw in Action
Full setup walkthrough (28m) by VelvetShark.
Watch on YouTube
Watch on YouTube
Watch on YouTube
🆕 Fresh from Discord
PR Review → Telegram Feedback
@bangnokia
review
github
telegram
OpenCode finishes the change → opens a PR → OpenClaw reviews the diff and replies in Telegram with “minor suggestions” plus a clear merge verdict (including critical fixes to apply first).
Wine Cellar Skill in Minutes
@prades_maxime
skills
local
csv
Asked “Robby” (@openclaw) for a local wine cellar skill. It requests a sample CSV export + where to store it, then builds/tests the skill fast (962 bottles in the example).
Tesco Shop Autopilot
@marchattonhere
automation
browser
shopping
Weekly meal plan → regulars → book delivery slot → confirm order. No APIs, just browser control.
SNAG Screenshot-to-Markdown
@am-will
devtools
screenshots
markdown
Hotkey a screen region → Gemini vision → instant Markdown in your clipboard.
Agents UI
@kitze
skills
sync
Desktop app to manage skills/commands across Agents, Claude, Codex, and OpenClaw.
Telegram Voice Notes (papla.media)
Community
voice
tts
telegram
Wraps papla.media TTS and sends results as Telegram voice notes (no annoying autoplay).
CodexMonitor
@odrobnik
devtools
codex
brew
Homebrew-installed helper to list/inspect/watch local OpenAI Codex sessions (CLI + VS Code).
Bambu 3D Printer Control
@tobiasbischoff
hardware
3d-printing
skill
Control and troubleshoot BambuLab printers: status, jobs, camera, AMS, calibration, and more.
Vienna Transport (Wiener Linien)
@hjanuschka
travel
transport
skill
Real-time departures, disruptions, elevator status, and routing for Vienna’s public transport.
ParentPay School Meals
@George5562
automation
browser
parenting
Automated UK school meal booking via ParentPay. Uses mouse coordinates for reliable table cell clicking.
R2 Upload (Send Me My Files)
@julianengel
files
presigned-urls
Upload to Cloudflare R2/S3 and generate secure presigned download links. Perfect for remote OpenClaw instances.
iOS App via Telegram
@coard
ios
xcode
testflight
Built a complete iOS app with maps and voice recording, deployed to TestFlight entirely via Telegram chat.
Oura Ring Health Assistant
@AS
health
oura
calendar
Personal AI health assistant integrating Oura ring data with calendar, appointments, and gym schedule.
Kev's Dream Team (14+ Agents)
@adam91holt
multi-agent
orchestration
architecture
manifesto
14+ agents under one gateway with Opus 4.5 orchestrator delegating to Codex workers. Comprehensive
technical write-up
covering the Dream Team roster, model selection, sandboxing, webhooks, heartbeats, and delegation flows.
Clawdspace
for agent sandboxing.
Blog post
Linear CLI
@NessZerra
devtools
linear
cli
issues
CLI for Linear that integrates with agentic workflows (Claude Code, OpenClaw). Manage issues, projects, and workflows from the terminal. First external PR merged!
Beeper CLI
@jules
messaging
beeper
cli
automation
Read, send, and archive messages via Beeper Desktop. Uses Beeper local MCP API so agents can manage all your chats (iMessage, WhatsApp, etc.) in one place.
🤖 Automation & Workflows
Winix Air Purifier Control
@antonplex
automation
hardware
air-quality
Claude Code discovered and confirmed the purifier controls, then OpenClaw takes over to manage room air quality.
Pretty Sky Camera Shots
@signalgaining
automation
camera
skill
images
Triggered by a roof camera: ask OpenClaw to snap a sky photo whenever it looks pretty — it designed a skill and took the shot.
Visual Morning Briefing Scene
@buddyhadry
automation
briefing
images
telegram
A scheduled prompt generates a single “scene” image each morning (weather, tasks, date, favorite post/quote) via a OpenClaw persona.
Padel Court Booking
@joshp123
automation
booking
cli
Playtomic availability checker + booking CLI. Never miss an open court again.
Accounting Intake
Community
automation
email
pdf
Collects PDFs from email, preps documents for tax consultant. Monthly accounting on autopilot.
Couch Potato Dev Mode
@davekiss
telegram
website
migration
astro
Rebuilt entire personal site via Telegram while watching Netflix — Notion → Astro, 18 posts migrated, DNS to Cloudflare. Never opened a laptop.
Job Search Agent
@attol8
automation
api
skill
Searches job listings, matches against CV keywords, and returns relevant opportunities with links. Built in 30 minutes using JSearch API.
Jira Skill Builder
@jdrhyne
automation
jira
skill
devtools
OpenClaw connected to Jira, then generated a new skill on the fly (before it existed on ClawHub).
Todoist Skill via Telegram
@iamsubhrajyoti
automation
todoist
skill
telegram
Automated Todoist tasks and had OpenClaw generate the skill directly in Telegram chat.
TradingView Analysis
@bheem1798
finance
browser
automation
Logs into TradingView via browser automation, screenshots charts, and performs technical analysis on demand. No API needed—just browser control.
Slack Auto-Support
@henrymascot
slack
automation
support
Watches company Slack channel, responds helpfully, and forwards notifications to Telegram. Autonomously fixed a production bug in a deployed app without being asked.
🧠 Knowledge & Memory
xuezh Chinese Learning
@joshp123
learning
voice
skill
Chinese learning engine with pronunciation feedback and study flows via OpenClaw.
WhatsApp Memory Vault
Community
memory
transcription
indexing
Ingests full WhatsApp exports, transcribes 1k+ voice notes, cross-checks with git logs, outputs linked markdown reports.
Karakeep Semantic Search
@jamesbrooksco
search
vector
bookmarks
Adds vector search to Karakeep bookmarks using Qdrant + OpenAI/Ollama embeddings.
Inside-Out-2 Memory
Community
memory
beliefs
self-model
Separate memory manager that turns session files into memories → beliefs → evolving self model.
🎙️ Voice & Phone
Clawdia Phone Bridge
@alejandroOPI
voice
vapi
bridge
Vapi voice assistant ↔ OpenClaw HTTP bridge. Near real-time phone calls with your agent.
OpenRouter Transcription
@obviyus
transcription
multilingual
skill
Multi-lingual audio transcription via OpenRouter (Gemini, etc). Available on ClawHub.
🏗️ Infrastructure & Deployment
Home Assistant Add-on
@ngutman
homeassistant
docker
raspberry-pi
OpenClaw gateway running on Home Assistant OS with SSH tunnel support and persistent state.
Home Assistant Skill
ClawHub
homeassistant
skill
automation
Control and automate Home Assistant devices via natural language.
Nix Packaging
@openclaw
nix
packaging
deployment
Batteries-included nixified OpenClaw configuration for reproducible deployments.
CalDAV Calendar
ClawHub
calendar
caldav
skill
Calendar skill using khal/vdirsyncer. Self-hosted calendar integration.
🏠 Home & Hardware
GoHome Automation
@joshp123
home
nix
grafana
Nix-native home automation with OpenClaw as the interface, plus beautiful Grafana dashboards.
Roborock Vacuum
@joshp123
vacuum
iot
plugin
Control your Roborock robot vacuum through natural conversation.
🌟 Community Projects
StarSwap Marketplace
Community
marketplace
astronomy
webapp
Full astronomy gear marketplace. Built with/around the OpenClaw ecosystem.
Submit Your Project
Have something to share? We’d love to feature it!
Share It
Post in
#showcase on Discord
tweet @openclaw
Include Details
Tell us what it does, link to the repo/demo, share a screenshot if you have one
Get Featured
We’ll add standout projects to this page
OpenClaw
Features

---
## Start > Wizard

[Source: https://docs.openclaw.ai/start/wizard]

way to set up OpenClaw on macOS,
Linux, or Windows (via WSL2; strongly recommended).
It configures a local Gateway or a remote Gateway connection, plus channels, skills,
and workspace defaults in one guided flow.
openclaw
onboard
Fastest first chat: open the Control UI (no channel setup needed). Run
openclaw dashboard
and chat in the browser. Docs:
Dashboard
To reconfigure later:
openclaw
configure
openclaw
agents
add
<
nam
>
--json
does not imply non-interactive mode. For scripts, use
--non-interactive
Recommended: set up a Brave Search API key so the agent can use
web_search
web_fetch
works without a key). Easiest path:
openclaw configure --section web
which stores
tools.web.search.apiKey
. Docs:
Web tools
QuickStart vs Advanced
The wizard starts with
QuickStart
(defaults) vs
Advanced
(full control).
QuickStart (defaults)
Advanced (full control)
Local gateway (loopback)
Workspace default (or existing workspace)
Gateway port
18789
Gateway auth
Token
(auto‑generated, even on loopback)
Tailscale exposure
Off
Telegram + WhatsApp DMs default to
allowlist
(you’ll be prompted for your phone number)
Exposes every step (mode, workspace, gateway, channels, daemon, skills).
What the wizard configures
Local mode (default)
walks you through these steps:
Model/Auth
— Anthropic API key (recommended), OpenAI, or Custom Provider
(OpenAI-compatible, Anthropic-compatible, or Unknown auto-detect). Pick a default model.
Workspace
— Location for agent files (default
~/.openclaw/workspace
). Seeds bootstrap files.
Gateway
— Port, bind address, auth mode, Tailscale exposure.
Channels
— WhatsApp, Telegram, Discord, Google Chat, Mattermost, Signal, BlueBubbles, or iMessage.
Daemon
— Installs a LaunchAgent (macOS) or systemd user unit (Linux/WSL2).
Health check
— Starts the Gateway and verifies it’s running.
Skills
— Installs recommended skills and optional dependencies.
Re-running the wizard does
not
wipe anything unless you explicitly choose
Reset
(or pass
--reset
If the config is invalid or contains legacy keys, the wizard asks you to run
openclaw doctor
first.
Remote mode
only configures the local client to connect to a Gateway elsewhere.
It does
not
install or change anything on the remote host.
Add another agent
Use
openclaw agents add <name>
to create a separate agent with its own workspace,
sessions, and auth profiles. Running without
--workspace
launches the wizard.
What it sets:
agents.list[].name
agents.list[].workspace
agents.list[].agentDir
Notes:
Default workspaces follow
~/.openclaw/workspace-<agentId>
Add
bindings
to route inbound messages (the wizard can do this).
Non-interactive flags:
--model
--agent-dir
--bind
--non-interactive
Full reference
For detailed step-by-step breakdowns, non-interactive scripting, Signal setup,
RPC API, and a full list of config fields the wizard writes, see the
Wizard Reference
Related docs
CLI command reference:
openclaw onboard
Onboarding overview:
Onboarding Overview
macOS app onboarding:
Onboarding
Agent first-run ritual:
Agent Bootstrapping
Onboarding Overview
Onboarding: macOS App
