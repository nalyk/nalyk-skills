# OpenClaw Installation Reference

All installation methods, Docker, Nix, Ansible, updating, uninstalling.

---
## Install > Ansible

[Source: https://docs.openclaw.ai/install/ansible]

The recommended way to deploy OpenClaw to production servers is via
openclaw-ansible
— an automated installer with security-first architecture.
Quick Start
One-command install:
curl
-fsSL
https://raw.githubusercontent.com/openclaw/openclaw-ansible/main/install.sh
bash
📦 Full guide:
github.com/openclaw/openclaw-ansible
The openclaw-ansible repo is the source of truth for Ansible deployment. This page is a quick overview.
What You Get
Firewall-first security
: UFW + Docker isolation (only SSH + Tailscale accessible)
Tailscale VPN
: Secure remote access without exposing services publicly
Docker
: Isolated sandbox containers, localhost-only bindings
Defense in depth
: 4-layer security architecture
One-command setup
: Complete deployment in minutes
Systemd integration
: Auto-start on boot with hardening
Requirements
: Debian 11+ or Ubuntu 20.04+
Access
: Root or sudo privileges
Network
: Internet connection for package installation
Ansible
: 2.14+ (installed automatically by quick-start script)
What Gets Installed
The Ansible playbook installs and configures:
Tailscale
(mesh VPN for secure remote access)
UFW firewall
(SSH + Tailscale ports only)
Docker CE + Compose V2
(for agent sandboxes)
Node.js 22.x + pnpm
(runtime dependencies)
OpenClaw
(host-based, not containerized)
Systemd service
(auto-start with security hardening)
Note: The gateway runs
directly on the host
(not in Docker), but agent sandboxes use Docker for isolation. See
Sandboxing
for details.
Post-Install Setup
After installation completes, switch to the openclaw user:
sudo
openclaw
The post-install script will guide you through:
Onboarding wizard
: Configure OpenClaw settings
Provider login
: Connect WhatsApp/Telegram/Discord/Signal
Gateway testing
: Verify the installation
Tailscale setup
: Connect to your VPN mesh
Quick commands
# Check service status
sudo
systemctl
status
openclaw
# View live logs
sudo
journalctl
openclaw
# Restart gateway
sudo
systemctl
restart
openclaw
# Provider login (run as openclaw user)
sudo
openclaw
openclaw
channels
login
Security Architecture
4-Layer Defense
Firewall (UFW)
: Only SSH (22) + Tailscale (41641/udp) exposed publicly
VPN (Tailscale)
: Gateway accessible only via VPN mesh
Docker Isolation
: DOCKER-USER iptables chain prevents external port exposure
Systemd Hardening
: NoNewPrivileges, PrivateTmp, unprivileged user
Verification
Test external attack surface:
nmap
-p-
YOUR_SERVER_IP
Should show
only port 22
(SSH) open. All other services (gateway, Docker) are locked down.
Docker Availability
Docker is installed for
agent sandboxes
(isolated tool execution), not for running the gateway itself. The gateway binds to localhost only and is accessible via Tailscale VPN.
See
Multi-Agent Sandbox & Tools
for sandbox configuration.
Manual Installation
If you prefer manual control over the automation:
# 1. Install prerequisites
sudo
apt
update
&&
sudo
apt
install
ansible
git
# 2. Clone repository
git
clone
https://github.com/openclaw/openclaw-ansible.git
openclaw-ansible
# 3. Install Ansible collections
ansible-galaxy
collection
install
requirements.yml
# 4. Run playbook
./run-playbook.sh
# Or run directly (then manually execute /tmp/openclaw-setup.sh after)
# ansible-playbook playbook.yml --ask-become-pass
Updating OpenClaw
The Ansible installer sets up OpenClaw for manual updates. See
Updating
for the standard update flow.
To re-run the Ansible playbook (e.g., for configuration changes):
openclaw-ansible
./run-playbook.sh
Note: This is idempotent and safe to run multiple times.
Troubleshooting
Firewall blocks my connection
If you’re locked out:
Ensure you can access via Tailscale VPN first
SSH access (port 22) is always allowed
The gateway is
only
accessible via Tailscale by design
Service won’t start
# Check logs
sudo
journalctl
openclaw
100
# Verify permissions
sudo
-la
/opt/openclaw
# Test manual start
sudo
openclaw
~/openclaw
pnpm
start
Docker sandbox issues
# Verify Docker is running
sudo
systemctl
status
docker
# Check sandbox image
sudo
docker
images
grep
openclaw-sandbox
# Build sandbox image if missing
/opt/openclaw/openclaw
sudo
openclaw
./scripts/sandbox-setup.sh
Provider login fails
Make sure you’re running as the
openclaw
user:
sudo
openclaw
openclaw
channels
login
Advanced Configuration
For detailed security architecture and troubleshooting:
Security Architecture
Technical Details
Troubleshooting Guide
Related
openclaw-ansible
— full deployment guide
Docker
— containerized gateway setup
Sandboxing
— agent sandbox configuration
Multi-Agent Sandbox & Tools
— per-agent isolation
Nix
Bun (Experimental)

---
## Install > Bun

[Source: https://docs.openclaw.ai/install/bun]

Bun (experimental)
Goal: run this repo with
Bun
(optional, not recommended for WhatsApp/Telegram)
without diverging from pnpm workflows.
Not recommended for Gateway runtime
(WhatsApp/Telegram bugs). Use Node for production.
Status
Bun is an optional local runtime for running TypeScript directly (
bun run …
bun --watch …
pnpm
is the default for builds and remains fully supported (and used by some docs tooling).
Bun cannot use
pnpm-lock.yaml
and will ignore it.
Install
Default:
bun
install
Note:
bun.lock
bun.lockb
are gitignored, so there’s no repo churn either way. If you want
no lockfile writes
bun
install
--no-save
Build / Test (Bun)
bun
run
build
bun
run
vitest
run
Bun lifecycle scripts (blocked by default)
Bun may block dependency lifecycle scripts unless explicitly trusted (
bun pm untrusted
bun pm trust
For this repo, the commonly blocked scripts are not required:
@whiskeysockets/baileys
preinstall
: checks Node major >= 20 (we run Node 22+).
protobufjs
postinstall
: emits warnings about incompatible version schemes (no build artifacts).
If you hit a real runtime issue that requires these scripts, trust them explicitly:
bun
trust
@whiskeysockets/baileys
protobufjs
Caveats
Some scripts still hardcode pnpm (e.g.
docs:build
ui:*
protocol:check
). Run those via pnpm for now.
Ansible
Updating

---
## Install > Development Channels

[Source: https://docs.openclaw.ai/install/development-channels]

OpenClaw ships three update channels:
stable
: npm dist-tag
latest
beta
: npm dist-tag
beta
(builds under test).
dev
: moving head of
main
(git). npm dist-tag:
dev
(when published).
We ship builds to
beta
, test them, then
promote a vetted build to
latest
without changing the version number — dist-tags are the source of truth for npm installs.
Switching channels
Git checkout:
openclaw
update
--channel
stable
openclaw
update
--channel
beta
openclaw
update
--channel
dev
stable
beta
check out the latest matching tag (often the same tag).
dev
switches to
main
and rebases on the upstream.
npm/pnpm global install:
openclaw
update
--channel
stable
openclaw
update
--channel
beta
openclaw
update
--channel
dev
This updates via the corresponding npm dist-tag (
latest
beta
dev
When you
explicitly
switch channels with
--channel
, OpenClaw also aligns
the install method:
dev
ensures a git checkout (default
~/openclaw
, override with
OPENCLAW_GIT_DIR
updates it, and installs the global CLI from that checkout.
stable
beta
installs from npm using the matching dist-tag.
Tip: if you want stable + dev in parallel, keep two clones and point your gateway at the stable one.
Plugins and channels
When you switch channels with
openclaw update
, OpenClaw also syncs plugin sources:
dev
prefers bundled plugins from the git checkout.
stable
and
beta
restore npm-installed plugin packages.
Tagging best practices
Tag releases you want git checkouts to land on (
vYYYY.M.D
vYYYY.M.D-<patch>
Keep tags immutable: never move or reuse a tag.
npm dist-tags remain the source of truth for npm installs:
latest
→ stable
beta
→ candidate build
dev
→ main snapshot (optional)
macOS app availability
Beta and dev builds may
not
include a macOS app release. That’s OK:
The git tag and npm dist-tag can still be published.
Call out “no macOS build for this beta” in release notes or changelog.
Deploy on Northflank

---
## Install > Docker

[Source: https://docs.openclaw.ai/install/docker]

Docker (optional)
Docker is
optional
. Use it only if you want a containerized gateway or to validate the Docker flow.
Is Docker right for me?
Yes
: you want an isolated, throwaway gateway environment or to run OpenClaw on a host without local installs.
: you’re running on your own machine and just want the fastest dev loop. Use the normal install flow instead.
Sandboxing note
: agent sandboxing uses Docker too, but it does
not
require the full gateway to run in Docker. See
Sandboxing
This guide covers:
Containerized Gateway (full OpenClaw in Docker)
Per-session Agent Sandbox (host gateway + Docker-isolated agent tools)
Sandboxing details:
Sandboxing
Requirements
Docker Desktop (or Docker Engine) + Docker Compose v2
Enough disk for images + logs
Containerized Gateway (Docker Compose)
Quick start (recommended)
From repo root:
./docker-setup.sh
This script:
builds the gateway image
runs the onboarding wizard
prints optional provider setup hints
starts the gateway via Docker Compose
generates a gateway token and writes it to
.env
Optional env vars:
OPENCLAW_DOCKER_APT_PACKAGES
— install extra apt packages during build
OPENCLAW_EXTRA_MOUNTS
— add extra host bind mounts
OPENCLAW_HOME_VOLUME
— persist
/home/node
in a named volume
After it finishes:
Open
http://127.0.0.1:18789/
in your browser.
Paste the token into the Control UI (Settings → token).
Need the URL again? Run
docker compose run --rm openclaw-cli dashboard --no-open
It writes config/workspace on the host:
~/.openclaw/
~/.openclaw/workspace
Running on a VPS? See
Hetzner (Docker VPS)
Shell Helpers (optional)
For easier day-to-day Docker management, install
ClawDock
mkdir
~/.clawdock
&&
curl
-sL
https://raw.githubusercontent.com/openclaw/openclaw/main/scripts/shell-helpers/clawdock-helpers.sh
~/.clawdock/clawdock-helpers.sh
Add to your shell config (zsh):
echo
'source ~/.clawdock/clawdock-helpers.sh'
>>
~/.zshrc
&&
source
~/.zshrc
Then use
clawdock-start
clawdock-stop
clawdock-dashboard
, etc. Run
clawdock-help
for all commands.
See
ClawDock
Helper README
for details.
Manual flow (compose)
docker
build
openclaw:local
Dockerfile
docker
compose
run
--rm
openclaw-cli
onboard
docker
compose
openclaw-gateway
Note: run
docker compose ...
from the repo root. If you enabled
OPENCLAW_EXTRA_MOUNTS
OPENCLAW_HOME_VOLUME
, the setup script writes
docker-compose.extra.yml
; include it when running Compose elsewhere:
docker
compose
docker-compose.yml
docker-compose.extra.yml
<
comman
>
Control UI token + pairing (Docker)
If you see “unauthorized” or “disconnected (1008): pairing required”, fetch a
fresh dashboard link and approve the browser device:
docker
compose
run
--rm
openclaw-cli
dashboard
--no-open
docker
compose
run
--rm
openclaw-cli
devices
list
docker
compose
run
--rm
openclaw-cli
devices
approve
<
requestI
>
More detail:
Dashboard
Devices
Extra mounts (optional)
If you want to mount additional host directories into the containers, set
OPENCLAW_EXTRA_MOUNTS
before running
docker-setup.sh
. This accepts a
comma-separated list of Docker bind mounts and applies them to both
openclaw-gateway
and
openclaw-cli
by generating
docker-compose.extra.yml
Example:
export
OPENCLAW_EXTRA_MOUNTS
"$HOME/.codex:/home/node/.codex:ro,$HOME/github:/home/node/github:rw"
./docker-setup.sh
Notes:
Paths must be shared with Docker Desktop on macOS/Windows.
If you edit
OPENCLAW_EXTRA_MOUNTS
, rerun
docker-setup.sh
to regenerate the
extra compose file.
docker-compose.extra.yml
is generated. Don’t hand-edit it.
Persist the entire container home (optional)
If you want
/home/node
to persist across container recreation, set a named
volume via
OPENCLAW_HOME_VOLUME
. This creates a Docker volume and mounts it at
/home/node
, while keeping the standard config/workspace bind mounts. Use a
named volume here (not a bind path); for bind mounts, use
OPENCLAW_EXTRA_MOUNTS
Example:
export
OPENCLAW_HOME_VOLUME
"openclaw_home"
./docker-setup.sh
You can combine this with extra mounts:
export
OPENCLAW_HOME_VOLUME
"openclaw_home"
export
OPENCLAW_EXTRA_MOUNTS
"$HOME/.codex:/home/node/.codex:ro,$HOME/github:/home/node/github:rw"
./docker-setup.sh
Notes:
If you change
OPENCLAW_HOME_VOLUME
, rerun
docker-setup.sh
to regenerate the
extra compose file.
The named volume persists until removed with
docker volume rm <name>
Install extra apt packages (optional)
If you need system packages inside the image (for example, build tools or media
libraries), set
OPENCLAW_DOCKER_APT_PACKAGES
before running
docker-setup.sh
This installs the packages during the image build, so they persist even if the
container is deleted.
Example:
export
OPENCLAW_DOCKER_APT_PACKAGES
"ffmpeg build-essential"
./docker-setup.sh
Notes:
This accepts a space-separated list of apt package names.
If you change
OPENCLAW_DOCKER_APT_PACKAGES
, rerun
docker-setup.sh
to rebuild
the image.
Power-user / full-featured container (opt-in)
The default Docker image is
security-first
and runs as the non-root
node
user. This keeps the attack surface small, but it means:
no system package installs at runtime
no Homebrew by default
no bundled Chromium/Playwright browsers
If you want a more full-featured container, use these opt-in knobs:
Persist
/home/node
so browser downloads and tool caches survive:
export
OPENCLAW_HOME_VOLUME
"openclaw_home"
./docker-setup.sh
Bake system deps into the image
(repeatable + persistent):
export
OPENCLAW_DOCKER_APT_PACKAGES
"git curl jq"
./docker-setup.sh
Install Playwright browsers without
npx
(avoids npm override conflicts):
docker
compose
run
--rm
openclaw-cli
node
/app/node_modules/playwright-core/cli.js
install
chromium
If you need Playwright to install system deps, rebuild the image with
OPENCLAW_DOCKER_APT_PACKAGES
instead of using
--with-deps
at runtime.
Persist Playwright browser downloads
Set
PLAYWRIGHT_BROWSERS_PATH=/home/node/.cache/ms-playwright
docker-compose.yml
Ensure
/home/node
persists via
OPENCLAW_HOME_VOLUME
, or mount
/home/node/.cache/ms-playwright
via
OPENCLAW_EXTRA_MOUNTS
Permissions + EACCES
The image runs as
node
(uid 1000). If you see permission errors on
/home/node/.openclaw
, make sure your host bind mounts are owned by uid 1000.
Example (Linux host):
sudo
chown
1000:1000
/path/to/openclaw-config
/path/to/openclaw-workspace
If you choose to run as root for convenience, you accept the security tradeoff.
Faster rebuilds (recommended)
To speed up rebuilds, order your Dockerfile so dependency layers are cached.
This avoids re-running
pnpm install
unless lockfiles change:
FROM
node:22-bookworm
# Install Bun (required for build scripts)
RUN
curl -fsSL https://bun.sh/install | bash
ENV
PATH=
"/root/.bun/bin:${PATH}"
RUN
corepack enable
WORKDIR
/app
# Cache dependencies unless package metadata changes
COPY
package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY
ui/package.json ./ui/package.json
COPY
scripts ./scripts
RUN
pnpm install --frozen-lockfile
COPY
. .
RUN
pnpm build
RUN
pnpm ui:install
RUN
pnpm ui:build
ENV
NODE_ENV=production
CMD
"node"
"dist/index.js"
Channel setup (optional)
Use the CLI container to configure channels, then restart the gateway if needed.
WhatsApp (QR):
docker
compose
run
--rm
openclaw-cli
channels
login
Telegram (bot token):
docker
compose
run
--rm
openclaw-cli
channels
add
--channel
telegram
--token
"<token>"
Discord (bot token):
docker
compose
run
--rm
openclaw-cli
channels
add
--channel
discord
--token
"<token>"
Docs:
WhatsApp
Telegram
Discord
OpenAI Codex OAuth (headless Docker)
If you pick OpenAI Codex OAuth in the wizard, it opens a browser URL and tries
to capture a callback on
http://127.0.0.1:1455/auth/callback
. In Docker or
headless setups that callback can show a browser error. Copy the full redirect
URL you land on and paste it back into the wizard to finish auth.
Health check
docker
compose
exec
openclaw-gateway
node
dist/index.js
health
--token
"$OPENCLAW_GATEWAY_TOKEN"
E2E smoke test (Docker)
scripts/e2e/onboard-docker.sh
QR import smoke test (Docker)
pnpm
test:docker:qr
Notes
Gateway bind defaults to
lan
for container use.
Dockerfile CMD uses
--allow-unconfigured
; mounted config with
gateway.mode
not
local
will still start. Override CMD to enforce the guard.
The gateway container is the source of truth for sessions (
~/.openclaw/agents/<agentId>/sessions/
Agent Sandbox (host gateway + Docker tools)
Deep dive:
Sandboxing
What it does
When
agents.defaults.sandbox
is enabled,
non-main sessions
run tools inside a Docker
container. The gateway stays on your host, but the tool execution is isolated:
scope:
"agent"
by default (one container + workspace per agent)
scope:
"session"
for per-session isolation
per-scope workspace folder mounted at
/workspace
optional agent workspace access (
agents.defaults.sandbox.workspaceAccess
allow/deny tool policy (deny wins)
inbound media is copied into the active sandbox workspace (
media/inbound/*
) so tools can read it (with
workspaceAccess: "rw"
, this lands in the agent workspace)
Warning:
scope: "shared"
disables cross-session isolation. All sessions share
one container and one workspace.
Per-agent sandbox profiles (multi-agent)
If you use multi-agent routing, each agent can override sandbox + tool settings:
agents.list[].sandbox
and
agents.list[].tools
(plus
agents.list[].tools.sandbox.tools
). This lets you run
mixed access levels in one gateway:
Full access (personal agent)
Read-only tools + read-only workspace (family/work agent)
No filesystem/shell tools (public agent)
See
Multi-Agent Sandbox & Tools
for examples,
precedence, and troubleshooting.
Default behavior
Image:
openclaw-sandbox:bookworm-slim
One container per agent
Agent workspace access:
workspaceAccess: "none"
(default) uses
~/.openclaw/sandboxes
"ro"
keeps the sandbox workspace at
/workspace
and mounts the agent workspace read-only at
/agent
(disables
write
edit
apply_patch
"rw"
mounts the agent workspace read/write at
/workspace
Auto-prune: idle > 24h OR age > 7d
Network:
none
by default (explicitly opt-in if you need egress)
Default allow:
exec
process
read
write
edit
sessions_list
sessions_history
sessions_send
sessions_spawn
session_status
Default deny:
browser
canvas
nodes
cron
discord
gateway
Enable sandboxing
If you plan to install packages in
setupCommand
, note:
Default
docker.network
"none"
(no egress).
readOnlyRoot: true
blocks package installs.
user
must be root for
apt-get
(omit
user
or set
user: "0:0"
OpenClaw auto-recreates containers when
setupCommand
(or docker config) changes
unless the container was
recently used
(within ~5 minutes). Hot containers
log a warning with the exact
openclaw sandbox recreate ...
command.
agents
defaults
sandbox
mode
"non-main"
// off | non-main | all
scope
"agent"
// session | agent | shared (agent is default)
workspaceAccess
"none"
// none | ro | rw
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
prune
idleHours
// 0 disables idle pruning
maxAgeDays
// 0 disables max-age pruning
tools
sandbox
tools
allow
"exec"
"process"
"read"
"write"
"edit"
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
Hardening knobs live under
agents.defaults.sandbox.docker
network
user
pidsLimit
memory
memorySwap
cpus
ulimits
seccompProfile
apparmorProfile
dns
extraHosts
Multi-agent: override
agents.defaults.sandbox.{docker,browser,prune}.*
per agent via
agents.list[].sandbox.{docker,browser,prune}.*
(ignored when
agents.defaults.sandbox.scope
agents.list[].sandbox.scope
"shared"
Build the default sandbox image
scripts/sandbox-setup.sh
This builds
openclaw-sandbox:bookworm-slim
using
Dockerfile.sandbox
Sandbox common image (optional)
If you want a sandbox image with common build tooling (Node, Go, Rust, etc.), build the common image:
scripts/sandbox-common-setup.sh
This builds
openclaw-sandbox-common:bookworm-slim
. To use it:
agents
defaults
sandbox
docker
image
"openclaw-sandbox-common:bookworm-slim"
} }
Sandbox browser image
To run the browser tool inside the sandbox, build the browser image:
scripts/sandbox-browser-setup.sh
This builds
openclaw-sandbox-browser:bookworm-slim
using
Dockerfile.sandbox-browser
. The container runs Chromium with CDP enabled and
an optional noVNC observer (headful via Xvfb).
Notes:
Headful (Xvfb) reduces bot blocking vs headless.
Headless can still be used by setting
agents.defaults.sandbox.browser.headless=true
No full desktop environment (GNOME) is needed; Xvfb provides the display.
Use config:
agents
defaults
sandbox
browser
enabled
true
Custom browser image:
agents
defaults
sandbox
browser
image
"my-openclaw-browser"
} }
When enabled, the agent receives:
a sandbox browser control URL (for the
browser
tool)
a noVNC URL (if enabled and headless=false)
Remember: if you use an allowlist for tools, add
browser
(and remove it from
deny) or the tool remains blocked.
Prune rules (
agents.defaults.sandbox.prune
) apply to browser containers too.
Custom sandbox image
Build your own image and point config to it:
docker
build
my-openclaw-sbx
Dockerfile.sandbox
agents
defaults
sandbox
docker
image
"my-openclaw-sbx"
} }
Tool policy (allow/deny)
deny
wins over
allow
allow
is empty: all tools (except deny) are available.
allow
is non-empty: only tools in
allow
are available (minus deny).
Pruning strategy
Two knobs:
prune.idleHours
: remove containers not used in X hours (0 = disable)
prune.maxAgeDays
: remove containers older than X days (0 = disable)
Example:
Keep busy sessions but cap lifetime:
idleHours: 24
maxAgeDays: 7
Never prune:
idleHours: 0
maxAgeDays: 0
Security notes
Hard wall only applies to
tools
(exec/read/write/edit/apply_patch).
Host-only tools like browser/camera/canvas are blocked by default.
Allowing
browser
in sandbox
breaks isolation
(browser runs on host).
Troubleshooting
Image missing: build with
scripts/sandbox-setup.sh
or set
agents.defaults.sandbox.docker.image
Container not running: it will auto-create per session on demand.
Permission errors in sandbox: set
docker.user
to a UID:GID that matches your
mounted workspace ownership (or chown the workspace folder).
Custom tools not found: OpenClaw runs commands with
sh -lc
(login shell), which
sources
/etc/profile
and may reset PATH. Set
docker.env.PATH
to prepend your
custom tool paths (e.g.,
/custom/bin:/usr/local/share/npm-global/bin
), or add
a script under
/etc/profile.d/
in your Dockerfile.
Installer Internals
Podman

---
## Install > Exe Dev

[Source: https://docs.openclaw.ai/install/exe-dev]

Goal: OpenClaw Gateway running on an exe.dev VM, reachable from your laptop via:
https://<vm-name>.exe.xyz
This page assumes exe.dev’s default
exeuntu
image. If you picked a different distro, map packages accordingly.
Beginner quick path
https://exe.new/openclaw
Fill in your auth key/token as needed
Click on “Agent” next to your VM, and wait…
???
Profit
What you need
exe.dev account
ssh exe.dev
access to
exe.dev
virtual machines (optional)
Automated Install with Shelley
Shelley,
exe.dev
’s agent, can install OpenClaw instantly with our
prompt. The prompt used is as below:
Set up OpenClaw (https://docs.openclaw.ai/install) on this VM. Use the non-interactive and accept-risk flags for openclaw onboarding. Add the supplied auth or token as needed. Configure nginx to forward from the default port 18789 to the root location on the default enabled site config, making sure to enable Websocket support. Pairing is done by "openclaw devices list" and "openclaw device approve <request id>". Make sure the dashboard shows that OpenClaw's health is OK. exe.dev handles forwarding from port 8000 to port 80/443 and HTTPS for us, so the final "reachable" should be <vm-name>.exe.xyz, without port specification.
Manual installation
1) Create the VM
From your device:
ssh
exe.dev
new
Then connect:
ssh
<
vm-nam
>
.exe.xyz
Tip: keep this VM
stateful
. OpenClaw stores state under
~/.openclaw/
and
~/.openclaw/workspace/
2) Install prerequisites (on the VM)
sudo
apt-get
update
sudo
apt-get
install
git
curl
ca-certificates
openssl
3) Install OpenClaw
Run the OpenClaw install script:
curl
-fsSL
https://openclaw.ai/install.sh
bash
4) Setup nginx to proxy OpenClaw to port 8000
Edit
/etc/nginx/sites-enabled/default
with
server {
listen 80 default_server;
listen [::]:80 default_server;
listen 8000;
listen [::]:8000;
server_name _;
location / {
proxy_pass http://127.0.0.1:18789;
proxy_http_version 1.1;
# WebSocket support
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
# Standard proxy headers
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
# Timeout settings for long-lived connections
proxy_read_timeout 86400s;
proxy_send_timeout 86400s;
5) Access OpenClaw and grant privileges
Access
https://<vm-name>.exe.xyz/
(see the Control UI output from onboarding). If it prompts for auth, paste the
token from
gateway.auth.token
on the VM (retrieve with
openclaw config get gateway.auth.token
, or generate one
with
openclaw doctor --generate-gateway-token
). Approve devices with
openclaw devices list
and
openclaw devices approve <requestId>
. When in doubt, use Shelley from your browser!
Remote Access
Remote access is handled by
exe.dev
’s authentication. By
default, HTTP traffic from port 8000 is forwarded to
https://<vm-name>.exe.xyz
with email auth.
Updating
npm
openclaw@latest
openclaw
doctor
openclaw
gateway
restart
openclaw
health
Guide:
Updating
macOS VMs
Deploy on Railway

---
## Install > Fly

[Source: https://docs.openclaw.ai/install/fly]

Goal:
OpenClaw Gateway running on a
Fly.io
machine with persistent storage, automatic HTTPS, and Discord/channel access.
What you need
flyctl CLI
installed
Fly.io account (free tier works)
Model auth: Anthropic API key (or other provider keys)
Channel credentials: Discord bot token, Telegram token, etc.
Beginner quick path
Clone repo → customize
fly.toml
Create app + volume → set secrets
Deploy with
fly deploy
SSH in to create config or use Control UI
1) Create the Fly app
# Clone the repo
git
clone
https://github.com/openclaw/openclaw.git
openclaw
# Create a new Fly app (pick your own name)
fly
apps
create
my-openclaw
# Create a persistent volume (1GB is usually enough)
fly
volumes
create
openclaw_data
--size
--region
iad
Tip:
Choose a region close to you. Common options:
lhr
(London),
iad
(Virginia),
sjc
(San Jose).
2) Configure fly.toml
Edit
fly.toml
to match your app name and requirements.
Security note:
The default config exposes a public URL. For a hardened deployment with no public IP, see
Private Deployment
or use
fly.private.toml
app
"my-openclaw"
# Your app name
primary_region
"iad"
[build]
dockerfile
"Dockerfile"
[env]
NODE_ENV
"production"
OPENCLAW_PREFER_PNPM
"1"
OPENCLAW_STATE_DIR
"/data"
NODE_OPTIONS
"--max-old-space-size=1536"
[processes]
app
"node dist/index.js gateway --allow-unconfigured --port 3000 --bind lan"
[http_service]
internal_port
3000
force_https
true
auto_stop_machines
false
auto_start_machines
true
min_machines_running
processes
"app"
[[vm]]
size
"shared-cpu-2x"
memory
"2048mb"
[mounts]
source
"openclaw_data"
destination
"/data"
Key settings:
Setting
Why
--bind lan
Binds to
0.0.0.0
so Fly’s proxy can reach the gateway
--allow-unconfigured
Starts without a config file (you’ll create one after)
internal_port = 3000
Must match
--port 3000
(or
OPENCLAW_GATEWAY_PORT
) for Fly health checks
memory = "2048mb"
512MB is too small; 2GB recommended
OPENCLAW_STATE_DIR = "/data"
Persists state on the volume
3) Set secrets
# Required: Gateway token (for non-loopback binding)
fly
secrets
set
OPENCLAW_GATEWAY_TOKEN=
openssl
rand
-hex
# Model provider API keys
fly
secrets
set
ANTHROPIC_API_KEY=sk-ant-...
# Optional: Other providers
fly
secrets
set
OPENAI_API_KEY=sk-...
fly
secrets
set
GOOGLE_API_KEY=...
# Channel tokens
fly
secrets
set
DISCORD_BOT_TOKEN=MTQ...
Notes:
Non-loopback binds (
--bind lan
) require
OPENCLAW_GATEWAY_TOKEN
for security.
Treat these tokens like passwords.
Prefer env vars over config file
for all API keys and tokens. This keeps secrets out of
openclaw.json
where they could be accidentally exposed or logged.
4) Deploy
fly
deploy
First deploy builds the Docker image (~2-3 minutes). Subsequent deploys are faster.
After deployment, verify:
fly
status
fly
logs
You should see:
[gateway] listening on ws://0.0.0.0:3000 (PID xxx)
[discord] logged in to discord as xxx
5) Create config file
SSH into the machine to create a proper config:
fly
ssh
console
Create the config directory and file:
mkdir
/data
cat
>
/data/openclaw.json
<<
'EOF'
"agents": {
"defaults": {
"model": {
"primary": "anthropic/claude-opus-4-6",
"fallbacks": ["anthropic/claude-sonnet-4-5", "openai/gpt-4o"]
"maxConcurrent": 4
"list": [
"id": "main",
"default": true
"auth": {
"profiles": {
"anthropic:default": { "mode": "token", "provider": "anthropic" },
"openai:default": { "mode": "token", "provider": "openai" }
"bindings": [
"agentId": "main",
"match": { "channel": "discord" }
"channels": {
"discord": {
"enabled": true,
"groupPolicy": "allowlist",
"guilds": {
"YOUR_GUILD_ID": {
"channels": { "general": { "allow": true } },
"requireMention": false
"gateway": {
"mode": "local",
"bind": "auto"
"meta": {
"lastTouchedVersion": "2026.1.29"
EOF
Note:
With
OPENCLAW_STATE_DIR=/data
, the config path is
/data/openclaw.json
Note:
The Discord token can come from either:
Environment variable:
DISCORD_BOT_TOKEN
(recommended for secrets)
Config file:
channels.discord.token
If using env var, no need to add token to config. The gateway reads
DISCORD_BOT_TOKEN
automatically.
Restart to apply:
exit
fly
machine
restart
<
machine-i
>
6) Access the Gateway
Control UI
Open in browser:
fly
open
Or visit
https://my-openclaw.fly.dev/
Paste your gateway token (the one from
OPENCLAW_GATEWAY_TOKEN
) to authenticate.
Logs
fly
logs
# Live logs
fly
logs
--no-tail
# Recent logs
SSH Console
fly
ssh
console
Troubleshooting
”App is not listening on expected address”
The gateway is binding to
127.0.0.1
instead of
0.0.0.0
Fix:
Add
--bind lan
to your process command in
fly.toml
Health checks failing / connection refused
Fly can’t reach the gateway on the configured port.
Fix:
Ensure
internal_port
matches the gateway port (set
--port 3000
OPENCLAW_GATEWAY_PORT=3000
OOM / Memory Issues
Container keeps restarting or getting killed. Signs:
SIGABRT
v8::internal::Runtime_AllocateInYoungGeneration
, or silent restarts.
Fix:
Increase memory in
fly.toml
[[vm]]
memory
"2048mb"
Or update an existing machine:
fly
machine
update
<
machine-i
>
--vm-memory
2048
Note:
512MB is too small. 1GB may work but can OOM under load or with verbose logging.
2GB is recommended.
Gateway Lock Issues
Gateway refuses to start with “already running” errors.
This happens when the container restarts but the PID lock file persists on the volume.
Fix:
Delete the lock file:
fly
ssh
console
--command
"rm -f /data/gateway.*.lock"
fly
machine
restart
<
machine-i
>
The lock file is at
/data/gateway.*.lock
(not in a subdirectory).
Config Not Being Read
If using
--allow-unconfigured
, the gateway creates a minimal config. Your custom config at
/data/openclaw.json
should be read on restart.
Verify the config exists:
fly
ssh
console
--command
"cat /data/openclaw.json"
Writing Config via SSH
The
fly ssh console -C
command doesn’t support shell redirection. To write a config file:
# Use echo + tee (pipe from local to remote)
echo
'{"your":"config"}'
fly
ssh
console
"tee /data/openclaw.json"
# Or use sftp
fly
sftp
shell
>
put /local/path/config.json /data/openclaw.json
Note:
fly sftp
may fail if the file already exists. Delete first:
fly
ssh
console
--command
"rm /data/openclaw.json"
State Not Persisting
If you lose credentials or sessions after a restart, the state dir is writing to the container filesystem.
Fix:
Ensure
OPENCLAW_STATE_DIR=/data
is set in
fly.toml
and redeploy.
Updates
# Pull latest changes
git
pull
# Redeploy
fly
deploy
# Check health
fly
status
fly
logs
Updating Machine Command
If you need to change the startup command without a full redeploy:
# Get machine ID
fly
machines
list
# Update command
fly
machine
update
<
machine-i
>
--command
"node dist/index.js gateway --port 3000 --bind lan"
# Or with memory increase
fly
machine
update
<
machine-i
>
--vm-memory
2048
--command
"node dist/index.js gateway --port 3000 --bind lan"
Note:
After
fly deploy
, the machine command may reset to what’s in
fly.toml
. If you made manual changes, re-apply them after deploy.
Private Deployment (Hardened)
By default, Fly allocates public IPs, making your gateway accessible at
https://your-app.fly.dev
. This is convenient but means your deployment is discoverable by internet scanners (Shodan, Censys, etc.).
For a hardened deployment with
no public exposure
, use the private template.
When to use private deployment
You only make
outbound
calls/messages (no inbound webhooks)
You use
ngrok or Tailscale
tunnels for any webhook callbacks
You access the gateway via
SSH, proxy, or WireGuard
instead of browser
You want the deployment
hidden from internet scanners
Setup
Use
fly.private.toml
instead of the standard config:
# Deploy with private config
fly
deploy
fly.private.toml
Or convert an existing deployment:
# List current IPs
fly
ips
list
my-openclaw
# Release public IPs
fly
ips
release
<
public-ipv
4>
my-openclaw
fly
ips
release
<
public-ipv
6>
my-openclaw
# Switch to private config so future deploys don't re-allocate public IPs
# (remove [http_service] or deploy with the private template)
fly
deploy
fly.private.toml
# Allocate private-only IPv6
fly
ips
allocate-v6
--private
my-openclaw
After this,
fly ips list
should show only a
private
type IP:
VERSION IP TYPE REGION
v6 fdaa:x:x:x:x::x private global
Accessing a private deployment
Since there’s no public URL, use one of these methods:
Option 1: Local proxy (simplest)
# Forward local port 3000 to the app
fly
proxy
3000:3000
my-openclaw
# Then open http://localhost:3000 in browser
Option 2: WireGuard VPN
# Create WireGuard config (one-time)
fly
wireguard
create
# Import to WireGuard client, then access via internal IPv6
# Example: http://[fdaa:x:x:x:x::x]:3000
Option 3: SSH only
fly
ssh
console
my-openclaw
Webhooks with private deployment
If you need webhook callbacks (Twilio, Telnyx, etc.) without public exposure:
ngrok tunnel
- Run ngrok inside the container or as a sidecar
Tailscale Funnel
- Expose specific paths via Tailscale
Outbound-only
- Some providers (Twilio) work fine for outbound calls without webhooks
Example voice-call config with ngrok:
"plugins"
"entries"
"voice-call"
"enabled"
true
"config"
"provider"
"twilio"
"tunnel"
"provider"
"ngrok"
"webhookSecurity"
"allowedHosts"
"example.ngrok.app"
The ngrok tunnel runs inside the container and provides a public webhook URL without exposing the Fly app itself. Set
webhookSecurity.allowedHosts
to the public tunnel hostname so forwarded host headers are accepted.
Security benefits
Aspect
Public
Private
Internet scanners
Discoverable
Hidden
Direct attacks
Possible
Blocked
Control UI access
Browser
Proxy/VPN
Webhook delivery
Direct
Via tunnel
Notes
Fly.io uses
x86 architecture
(not ARM)
The Dockerfile is compatible with both architectures
For WhatsApp/Telegram onboarding, use
fly ssh console
Persistent data lives on the volume at
/data
Signal requires Java + signal-cli; use a custom image and keep memory at 2GB+.
Cost
With the recommended config (
shared-cpu-2x
, 2GB RAM):
~$10-15/month depending on usage
Free tier includes some allowance
See
Fly.io pricing
for details.
Uninstall
Hetzner

---
## Install > Gcp

[Source: https://docs.openclaw.ai/install/gcp]

OpenClaw on GCP Compute Engine (Docker, Production VPS Guide)
Goal
What are we doing (simple terms)?
Quick path (experienced operators)
What you need
1) Install gcloud CLI (or use Console)
2) Create a GCP project
3) Create the VM
4) SSH into the VM
5) Install Docker (on the VM)
6) Clone the OpenClaw repository
7) Create persistent host directories
8) Configure environment variables
9) Docker Compose configuration
10) Bake required binaries into the image (critical)
11) Build and launch
12) Verify Gateway
13) Access from your laptop
What persists where (source of truth)
Updates
Troubleshooting
Service accounts (security best practice)
Next steps
Hosting and deployment
GCP
OpenClaw on GCP Compute Engine (Docker, Production VPS Guide)
Goal
Run a persistent OpenClaw Gateway on a GCP Compute Engine VM using Docker, with durable state, baked-in binaries, and safe restart behavior.
If you want “OpenClaw 24/7 for ~$5-12/mo”, this is a reliable setup on Google Cloud.
Pricing varies by machine type and region; pick the smallest VM that fits your workload and scale up if you hit OOMs.
What are we doing (simple terms)?
Create a GCP project and enable billing
Create a Compute Engine VM
Install Docker (isolated app runtime)
Start the OpenClaw Gateway in Docker
Persist
~/.openclaw
~/.openclaw/workspace
on the host (survives restarts/rebuilds)
Access the Control UI from your laptop via an SSH tunnel
The Gateway can be accessed via:
SSH port forwarding from your laptop
Direct port exposure if you manage firewalling and tokens yourself
This guide uses Debian on GCP Compute Engine.
Ubuntu also works; map packages accordingly.
For the generic Docker flow, see
Docker
Quick path (experienced operators)
Create GCP project + enable Compute Engine API
Create Compute Engine VM (e2-small, Debian 12, 20GB)
SSH into the VM
Install Docker
Clone OpenClaw repository
Create persistent host directories
Configure
.env
and
docker-compose.yml
Bake required binaries, build, and launch
What you need
GCP account (free tier eligible for e2-micro)
gcloud CLI installed (or use Cloud Console)
SSH access from your laptop
Basic comfort with SSH + copy/paste
~20-30 minutes
Docker and Docker Compose
Model auth credentials
Optional provider credentials
WhatsApp QR
Telegram bot token
Gmail OAuth
1) Install gcloud CLI (or use Console)
Option A: gcloud CLI
(recommended for automation)
Install from
https://cloud.google.com/sdk/docs/install
Initialize and authenticate:
gcloud
init
gcloud
auth
login
Option B: Cloud Console
All steps can be done via the web UI at
https://console.cloud.google.com
2) Create a GCP project
CLI:
gcloud
projects
create
my-openclaw-project
--name=
"OpenClaw Gateway"
gcloud
config
set
project
my-openclaw-project
Enable billing at
https://console.cloud.google.com/billing
(required for Compute Engine).
Enable the Compute Engine API:
gcloud
services
enable
compute.googleapis.com
Console:
Go to IAM & Admin > Create Project
Name it and create
Enable billing for the project
Navigate to APIs & Services > Enable APIs > search “Compute Engine API” > Enable
3) Create the VM
Machine types:
Type
Specs
Cost
Notes
e2-small
2 vCPU, 2GB RAM
~$12/mo
Recommended
e2-micro
2 vCPU (shared), 1GB RAM
Free tier eligible
May OOM under load
CLI:
gcloud
compute
instances
create
openclaw-gateway
--zone=us-central1-a
--machine-type=e2-small
--boot-disk-size=20GB
--image-family=debian-12
--image-project=debian-cloud
Console:
Go to Compute Engine > VM instances > Create instance
Name:
openclaw-gateway
Region:
us-central1
, Zone:
us-central1-a
Machine type:
e2-small
Boot disk: Debian 12, 20GB
Create
4) SSH into the VM
CLI:
gcloud
compute
ssh
openclaw-gateway
--zone=us-central1-a
Console:
Click the “SSH” button next to your VM in the Compute Engine dashboard.
Note: SSH key propagation can take 1-2 minutes after VM creation. If connection is refused, wait and retry.
5) Install Docker (on the VM)
sudo
apt-get
update
sudo
apt-get
install
git
curl
ca-certificates
curl
-fsSL
https://get.docker.com
sudo
sudo
usermod
-aG
docker
$USER
Log out and back in for the group change to take effect:
exit
Then SSH back in:
gcloud
compute
ssh
openclaw-gateway
--zone=us-central1-a
Verify:
docker
--version
docker
compose
version
6) Clone the OpenClaw repository
git
clone
https://github.com/openclaw/openclaw.git
openclaw
This guide assumes you will build a custom image to guarantee binary persistence.
7) Create persistent host directories
Docker containers are ephemeral.
All long-lived state must live on the host.
mkdir
~/.openclaw
mkdir
~/.openclaw/workspace
8) Configure environment variables
Create
.env
in the repository root.
OPENCLAW_IMAGE
openclaw:latest
OPENCLAW_GATEWAY_TOKEN
change-me-now
OPENCLAW_GATEWAY_BIND
lan
OPENCLAW_GATEWAY_PORT
18789
OPENCLAW_CONFIG_DIR
/home/
$USER
/.openclaw
OPENCLAW_WORKSPACE_DIR
/home/
$USER
/.openclaw/workspace
GOG_KEYRING_PASSWORD
change-me-now
XDG_CONFIG_HOME
/home/node/.openclaw
Generate strong secrets:
openssl
rand
-hex
Do not commit this file.
9) Docker Compose configuration
Create or update
docker-compose.yml
services
openclaw-gateway
image
${OPENCLAW_IMAGE}
build
restart
unless-stopped
env_file
.env
environment
HOME=/home/node
NODE_ENV=production
TERM=xterm-256color
OPENCLAW_GATEWAY_BIND=${OPENCLAW_GATEWAY_BIND}
OPENCLAW_GATEWAY_PORT=${OPENCLAW_GATEWAY_PORT}
OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
GOG_KEYRING_PASSWORD=${GOG_KEYRING_PASSWORD}
XDG_CONFIG_HOME=${XDG_CONFIG_HOME}
PATH=/home/linuxbrew/.linuxbrew/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
volumes
${OPENCLAW_CONFIG_DIR}:/home/node/.openclaw
${OPENCLAW_WORKSPACE_DIR}:/home/node/.openclaw/workspace
ports
# Recommended: keep the Gateway loopback-only on the VM; access via SSH tunnel.
# To expose it publicly, remove the `127.0.0.1:` prefix and firewall accordingly.
"127.0.0.1:${OPENCLAW_GATEWAY_PORT}:18789"
command
"node"
"dist/index.js"
"gateway"
"--bind"
"${OPENCLAW_GATEWAY_BIND}"
"--port"
"${OPENCLAW_GATEWAY_PORT}"
10) Bake required binaries into the image (critical)
Installing binaries inside a running container is a trap.
Anything installed at runtime will be lost on restart.
All external binaries required by skills must be installed at image build time.
The examples below show three common binaries only:
gog
for Gmail access
goplaces
for Google Places
wacli
for WhatsApp
These are examples, not a complete list.
You may install as many binaries as needed using the same pattern.
If you add new skills later that depend on additional binaries, you must:
Update the Dockerfile
Rebuild the image
Restart the containers
Example Dockerfile
FROM
node:22-bookworm
RUN
apt-get update && apt-get install -y socat && rm -rf /var/lib/apt/lists/*
# Example binary 1: Gmail CLI
RUN
curl -L https://github.com/steipete/gog/releases/latest/download/gog_Linux_x86_64.tar.gz \
| tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/gog
# Example binary 2: Google Places CLI
RUN
curl -L https://github.com/steipete/goplaces/releases/latest/download/goplaces_Linux_x86_64.tar.gz \
| tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/goplaces
# Example binary 3: WhatsApp CLI
RUN
curl -L https://github.com/steipete/wacli/releases/latest/download/wacli_Linux_x86_64.tar.gz \
| tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/wacli
# Add more binaries below using the same pattern
WORKDIR
/app
COPY
package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY
ui/package.json ./ui/package.json
COPY
scripts ./scripts
RUN
corepack enable
RUN
pnpm install --frozen-lockfile
COPY
. .
RUN
pnpm build
RUN
pnpm ui:install
RUN
pnpm ui:build
ENV
NODE_ENV=production
CMD
"node"
"dist/index.js"
11) Build and launch
docker
compose
build
docker
compose
openclaw-gateway
Verify binaries:
docker
compose
exec
openclaw-gateway
which
gog
docker
compose
exec
openclaw-gateway
which
goplaces
docker
compose
exec
openclaw-gateway
which
wacli
Expected output:
/usr/local/bin/gog
/usr/local/bin/goplaces
/usr/local/bin/wacli
12) Verify Gateway
docker
compose
logs
openclaw-gateway
Success:
[gateway] listening on ws://0.0.0.0:18789
13) Access from your laptop
Create an SSH tunnel to forward the Gateway port:
gcloud
compute
ssh
openclaw-gateway
--zone=us-central1-a
18789:127.0.0.1:18789
Open in your browser:
http://127.0.0.1:18789/
Paste your gateway token.
What persists where (source of truth)
OpenClaw runs in Docker, but Docker is not the source of truth.
All long-lived state must survive restarts, rebuilds, and reboots.
Component
Location
Persistence mechanism
Notes
Gateway config
/home/node/.openclaw/
Host volume mount
Includes
openclaw.json
, tokens
Model auth profiles
/home/node/.openclaw/
Host volume mount
OAuth tokens, API keys
Skill configs
/home/node/.openclaw/skills/
Host volume mount
Skill-level state
Agent workspace
/home/node/.openclaw/workspace/
Host volume mount
Code and agent artifacts
WhatsApp session
/home/node/.openclaw/
Host volume mount
Preserves QR login
Gmail keyring
/home/node/.openclaw/
Host volume + password
Requires
GOG_KEYRING_PASSWORD
External binaries
/usr/local/bin/
Docker image
Must be baked at build time
Node runtime
Container filesystem
Docker image
Rebuilt every image build
OS packages
Container filesystem
Docker image
Do not install at runtime
Docker container
Ephemeral
Restartable
Safe to destroy
Updates
To update OpenClaw on the VM:
~/openclaw
git
pull
docker
compose
build
docker
compose
Troubleshooting
SSH connection refused
SSH key propagation can take 1-2 minutes after VM creation. Wait and retry.
OS Login issues
Check your OS Login profile:
gcloud
compute
os-login
describe-profile
Ensure your account has the required IAM permissions (Compute OS Login or Compute OS Admin Login).
Out of memory (OOM)
If using e2-micro and hitting OOM, upgrade to e2-small or e2-medium:
# Stop the VM first
gcloud
compute
instances
stop
openclaw-gateway
--zone=us-central1-a
# Change machine type
gcloud
compute
instances
set-machine-type
openclaw-gateway
--zone=us-central1-a
--machine-type=e2-small
# Start the VM
gcloud
compute
instances
start
openclaw-gateway
--zone=us-central1-a
Service accounts (security best practice)
For personal use, your default user account works fine.
For automation or CI/CD pipelines, create a dedicated service account with minimal permissions:
Create a service account:
gcloud
iam
service-accounts
create
openclaw-deploy
--display-name=
"OpenClaw Deployment"
Grant Compute Instance Admin role (or narrower custom role):
gcloud
projects
add-iam-policy-binding
my-openclaw-project
--member=
"serviceAccount:
[email protected]
"
--role=
"roles/compute.instanceAdmin.v1"
Avoid using the Owner role for automation. Use the principle of least privilege.
See
https://cloud.google.com/iam/docs/understanding-roles
for IAM role details.
Next steps
Set up messaging channels:
Channels
Pair local devices as nodes:
Nodes
Configure the Gateway:
Gateway configuration
Hetzner
macOS VMs

---
## Install > Hetzner

[Source: https://docs.openclaw.ai/install/hetzner]

OpenClaw on Hetzner (Docker, Production VPS Guide)
Goal
Run a persistent OpenClaw Gateway on a Hetzner VPS using Docker, with durable state, baked-in binaries, and safe restart behavior.
If you want “OpenClaw 24/7 for ~$5”, this is the simplest reliable setup.
Hetzner pricing changes; pick the smallest Debian/Ubuntu VPS and scale up if you hit OOMs.
What are we doing (simple terms)?
Rent a small Linux server (Hetzner VPS)
Install Docker (isolated app runtime)
Start the OpenClaw Gateway in Docker
Persist
~/.openclaw
~/.openclaw/workspace
on the host (survives restarts/rebuilds)
Access the Control UI from your laptop via an SSH tunnel
The Gateway can be accessed via:
SSH port forwarding from your laptop
Direct port exposure if you manage firewalling and tokens yourself
This guide assumes Ubuntu or Debian on Hetzner.
If you are on another Linux VPS, map packages accordingly.
For the generic Docker flow, see
Docker
Quick path (experienced operators)
Provision Hetzner VPS
Install Docker
Clone OpenClaw repository
Create persistent host directories
Configure
.env
and
docker-compose.yml
Bake required binaries into the image
docker compose up -d
Verify persistence and Gateway access
What you need
Hetzner VPS with root access
SSH access from your laptop
Basic comfort with SSH + copy/paste
~20 minutes
Docker and Docker Compose
Model auth credentials
Optional provider credentials
WhatsApp QR
Telegram bot token
Gmail OAuth
1) Provision the VPS
Create an Ubuntu or Debian VPS in Hetzner.
Connect as root:
ssh
root@YOUR_VPS_IP
This guide assumes the VPS is stateful.
Do not treat it as disposable infrastructure.
2) Install Docker (on the VPS)
apt-get
update
apt-get
install
git
curl
ca-certificates
curl
-fsSL
https://get.docker.com
Verify:
docker
--version
docker
compose
version
3) Clone the OpenClaw repository
git
clone
https://github.com/openclaw/openclaw.git
openclaw
This guide assumes you will build a custom image to guarantee binary persistence.
4) Create persistent host directories
Docker containers are ephemeral.
All long-lived state must live on the host.
mkdir
/root/.openclaw/workspace
# Set ownership to the container user (uid 1000):
chown
1000:1000
/root/.openclaw
5) Configure environment variables
Create
.env
in the repository root.
OPENCLAW_IMAGE
openclaw:latest
OPENCLAW_GATEWAY_TOKEN
change-me-now
OPENCLAW_GATEWAY_BIND
lan
OPENCLAW_GATEWAY_PORT
18789
OPENCLAW_CONFIG_DIR
/root/.openclaw
OPENCLAW_WORKSPACE_DIR
/root/.openclaw/workspace
GOG_KEYRING_PASSWORD
change-me-now
XDG_CONFIG_HOME
/home/node/.openclaw
Generate strong secrets:
openssl
rand
-hex
Do not commit this file.
6) Docker Compose configuration
Create or update
docker-compose.yml
services
openclaw-gateway
image
${OPENCLAW_IMAGE}
build
restart
unless-stopped
env_file
.env
environment
HOME=/home/node
NODE_ENV=production
TERM=xterm-256color
OPENCLAW_GATEWAY_BIND=${OPENCLAW_GATEWAY_BIND}
OPENCLAW_GATEWAY_PORT=${OPENCLAW_GATEWAY_PORT}
OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
GOG_KEYRING_PASSWORD=${GOG_KEYRING_PASSWORD}
XDG_CONFIG_HOME=${XDG_CONFIG_HOME}
PATH=/home/linuxbrew/.linuxbrew/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
volumes
${OPENCLAW_CONFIG_DIR}:/home/node/.openclaw
${OPENCLAW_WORKSPACE_DIR}:/home/node/.openclaw/workspace
ports
# Recommended: keep the Gateway loopback-only on the VPS; access via SSH tunnel.
# To expose it publicly, remove the `127.0.0.1:` prefix and firewall accordingly.
"127.0.0.1:${OPENCLAW_GATEWAY_PORT}:18789"
command
"node"
"dist/index.js"
"gateway"
"--bind"
"${OPENCLAW_GATEWAY_BIND}"
"--port"
"${OPENCLAW_GATEWAY_PORT}"
"--allow-unconfigured"
--allow-unconfigured
is only for bootstrap convenience, it is not a replacement for a proper gateway configuration. Still set auth (
gateway.auth.token
or password) and use safe bind settings for your deployment.
7) Bake required binaries into the image (critical)
Installing binaries inside a running container is a trap.
Anything installed at runtime will be lost on restart.
All external binaries required by skills must be installed at image build time.
The examples below show three common binaries only:
gog
for Gmail access
goplaces
for Google Places
wacli
for WhatsApp
These are examples, not a complete list.
You may install as many binaries as needed using the same pattern.
If you add new skills later that depend on additional binaries, you must:
Update the Dockerfile
Rebuild the image
Restart the containers
Example Dockerfile
FROM
node:22-bookworm
RUN
apt-get update && apt-get install -y socat && rm -rf /var/lib/apt/lists/*
# Example binary 1: Gmail CLI
RUN
curl -L https://github.com/steipete/gog/releases/latest/download/gog_Linux_x86_64.tar.gz \
| tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/gog
# Example binary 2: Google Places CLI
RUN
curl -L https://github.com/steipete/goplaces/releases/latest/download/goplaces_Linux_x86_64.tar.gz \
| tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/goplaces
# Example binary 3: WhatsApp CLI
RUN
curl -L https://github.com/steipete/wacli/releases/latest/download/wacli_Linux_x86_64.tar.gz \
| tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/wacli
# Add more binaries below using the same pattern
WORKDIR
/app
COPY
package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY
ui/package.json ./ui/package.json
COPY
scripts ./scripts
RUN
corepack enable
RUN
pnpm install --frozen-lockfile
COPY
. .
RUN
pnpm build
RUN
pnpm ui:install
RUN
pnpm ui:build
ENV
NODE_ENV=production
CMD
"node"
"dist/index.js"
8) Build and launch
docker
compose
build
docker
compose
openclaw-gateway
Verify binaries:
docker
compose
exec
openclaw-gateway
which
gog
docker
compose
exec
openclaw-gateway
which
goplaces
docker
compose
exec
openclaw-gateway
which
wacli
Expected output:
/usr/local/bin/gog
/usr/local/bin/goplaces
/usr/local/bin/wacli
9) Verify Gateway
docker
compose
logs
openclaw-gateway
Success:
[gateway] listening on ws://0.0.0.0:18789
From your laptop:
ssh
18789:127.0.0.1:18789
root@YOUR_VPS_IP
Open:
http://127.0.0.1:18789/
Paste your gateway token.
What persists where (source of truth)
OpenClaw runs in Docker, but Docker is not the source of truth.
All long-lived state must survive restarts, rebuilds, and reboots.
Component
Location
Persistence mechanism
Notes
Gateway config
/home/node/.openclaw/
Host volume mount
Includes
openclaw.json
, tokens
Model auth profiles
/home/node/.openclaw/
Host volume mount
OAuth tokens, API keys
Skill configs
/home/node/.openclaw/skills/
Host volume mount
Skill-level state
Agent workspace
/home/node/.openclaw/workspace/
Host volume mount
Code and agent artifacts
WhatsApp session
/home/node/.openclaw/
Host volume mount
Preserves QR login
Gmail keyring
/home/node/.openclaw/
Host volume + password
Requires
GOG_KEYRING_PASSWORD
External binaries
/usr/local/bin/
Docker image
Must be baked at build time
Node runtime
Container filesystem
Docker image
Rebuilt every image build
OS packages
Container filesystem
Docker image
Do not install at runtime
Docker container
Ephemeral
Restartable
Safe to destroy
Infrastructure as Code (Terraform)
For teams preferring infrastructure-as-code workflows, a community-maintained Terraform setup provides:
Modular Terraform configuration with remote state management
Automated provisioning via cloud-init
Deployment scripts (bootstrap, deploy, backup/restore)
Security hardening (firewall, UFW, SSH-only access)
SSH tunnel configuration for gateway access
Repositories:
Infrastructure:
openclaw-terraform-hetzner
Docker config:
openclaw-docker-config
This approach complements the Docker setup above with reproducible deployments, version-controlled infrastructure, and automated disaster recovery.
Note:
Community-maintained. For issues or contributions, see the repository links above.
Fly.io
GCP

---
## Install > Installer

[Source: https://docs.openclaw.ai/install/installer]

Installs Node if needed, installs OpenClaw via npm (default) or git, and can run onboarding.
install-cli.sh
macOS / Linux / WSL
Installs Node + OpenClaw into a local prefix (
~/.openclaw
). No root required.
install.ps1
Windows (PowerShell)
Installs Node if needed, installs OpenClaw via npm (default) or git, and can run onboarding.
Quick commands
install.sh
install-cli.sh
install.ps1
curl
-fsSL
--proto
'=https'
--tlsv1.2
https://openclaw.ai/install.sh
bash
curl
-fsSL
--proto
'=https'
--tlsv1.2
https://openclaw.ai/install.sh
bash
--help
curl
-fsSL
--proto
'=https'
--tlsv1.2
https://openclaw.ai/install-cli.sh
bash
curl
-fsSL
--proto
'=https'
--tlsv1.2
https://openclaw.ai/install-cli.sh
bash
--help
iwr
useb https:
openclaw.ai
install.ps1
iex
&
scriptblock
]::Create((iwr
useb https:
openclaw.ai
install.ps1)))
Tag beta
NoOnboard
DryRun
If install succeeds but
openclaw
is not found in a new terminal, see
Node.js troubleshooting
install.sh
Recommended for most interactive installs on macOS/Linux/WSL.
Flow (install.sh)
Detect OS
Supports macOS and Linux (including WSL). If macOS is detected, installs Homebrew if missing.
Ensure Node.js 22+
Checks Node version and installs Node 22 if needed (Homebrew on macOS, NodeSource setup scripts on Linux apt/dnf/yum).
Ensure Git
Installs Git if missing.
Install OpenClaw
npm
method (default): global npm install
git
method: clone/update repo, install deps with pnpm, build, then install wrapper at
~/.local/bin/openclaw
Post-install tasks
Runs
openclaw doctor --non-interactive
on upgrades and git installs (best effort)
Attempts onboarding when appropriate (TTY available, onboarding not disabled, and bootstrap/config checks pass)
Defaults
SHARP_IGNORE_GLOBAL_LIBVIPS=1
Source checkout detection
If run inside an OpenClaw checkout (
package.json
pnpm-workspace.yaml
), the script offers:
use checkout (
git
), or
use global install (
npm
If no TTY is available and no install method is set, it defaults to
npm
and warns.
The script exits with code
for invalid method selection or invalid
--install-method
values.
Examples (install.sh)
Default
Skip onboarding
Git install
Dry run
curl
-fsSL
--proto
'=https'
--tlsv1.2
https://openclaw.ai/install.sh
bash
curl
-fsSL
--proto
'=https'
--tlsv1.2
https://openclaw.ai/install.sh
bash
--no-onboard
curl
-fsSL
--proto
'=https'
--tlsv1.2
https://openclaw.ai/install.sh
bash
--install-method
git
curl
-fsSL
--proto
'=https'
--tlsv1.2
https://openclaw.ai/install.sh
bash
--dry-run
Flags reference
Flag
Description
--install-method npm|git
Choose install method (default:
npm
). Alias:
--method
--npm
Shortcut for npm method
--git
Shortcut for git method. Alias:
--github
--version <version|dist-tag>
npm version or dist-tag (default:
latest
--beta
Use beta dist-tag if available, else fallback to
latest
--git-dir <path>
Checkout directory (default:
~/openclaw
). Alias:
--dir
--no-git-update
Skip
git pull
for existing checkout
--no-prompt
Disable prompts
--no-onboard
Skip onboarding
--onboard
Enable onboarding
--dry-run
Print actions without applying changes
--verbose
Enable debug output (
set -x
, npm notice-level logs)
--help
Show usage (
Environment variables reference
Variable
Description
OPENCLAW_INSTALL_METHOD=git|npm
Install method
OPENCLAW_VERSION=latest|next|<semver>
npm version or dist-tag
OPENCLAW_BETA=0|1
Use beta if available
OPENCLAW_GIT_DIR=<path>
Checkout directory
OPENCLAW_GIT_UPDATE=0|1
Toggle git updates
OPENCLAW_NO_PROMPT=1
Disable prompts
OPENCLAW_NO_ONBOARD=1
Skip onboarding
OPENCLAW_DRY_RUN=1
Dry run mode
OPENCLAW_VERBOSE=1
Debug mode
OPENCLAW_NPM_LOGLEVEL=error|warn|notice
npm log level
SHARP_IGNORE_GLOBAL_LIBVIPS=0|1
Control sharp/libvips behavior (default:
install-cli.sh
Designed for environments where you want everything under a local prefix (default
~/.openclaw
) and no system Node dependency.
Flow (install-cli.sh)
Install local Node runtime
Downloads Node tarball (default
22.22.0
) to
<prefix>/tools/node-v<version>
and verifies SHA-256.
Ensure Git
If Git is missing, attempts install via apt/dnf/yum on Linux or Homebrew on macOS.
Install OpenClaw under prefix
Installs with npm using
--prefix <prefix>
, then writes wrapper to
<prefix>/bin/openclaw
Examples (install-cli.sh)
Default
Custom prefix + version
Automation JSON output
Run onboarding
curl
-fsSL
--proto
'=https'
--tlsv1.2
https://openclaw.ai/install-cli.sh
bash
curl
-fsSL
--proto
'=https'
--tlsv1.2
https://openclaw.ai/install-cli.sh
bash
--prefix
/opt/openclaw
--version
latest
curl
-fsSL
--proto
'=https'
--tlsv1.2
https://openclaw.ai/install-cli.sh
bash
--json
--prefix
/opt/openclaw
curl
-fsSL
--proto
'=https'
--tlsv1.2
https://openclaw.ai/install-cli.sh
bash
--onboard
Flags reference
Flag
Description
--prefix <path>
Install prefix (default:
~/.openclaw
--version <ver>
OpenClaw version or dist-tag (default:
latest
--node-version <ver>
Node version (default:
22.22.0
--json
Emit NDJSON events
--onboard
Run
openclaw onboard
after install
--no-onboard
Skip onboarding (default)
--set-npm-prefix
On Linux, force npm prefix to
~/.npm-global
if current prefix is not writable
--help
Show usage (
Environment variables reference
Variable
Description
OPENCLAW_PREFIX=<path>
Install prefix
OPENCLAW_VERSION=<ver>
OpenClaw version or dist-tag
OPENCLAW_NODE_VERSION=<ver>
Node version
OPENCLAW_NO_ONBOARD=1
Skip onboarding
OPENCLAW_NPM_LOGLEVEL=error|warn|notice
npm log level
OPENCLAW_GIT_DIR=<path>
Legacy cleanup lookup path (used when removing old
Peekaboo
submodule checkout)
SHARP_IGNORE_GLOBAL_LIBVIPS=0|1
Control sharp/libvips behavior (default:
install.ps1
Flow (install.ps1)
Ensure PowerShell + Windows environment
Requires PowerShell 5+.
Ensure Node.js 22+
If missing, attempts install via winget, then Chocolatey, then Scoop.
Install OpenClaw
npm
method (default): global npm install using selected
-Tag
git
method: clone/update repo, install/build with pnpm, and install wrapper at
%USERPROFILE%\.local\bin\openclaw.cmd
Post-install tasks
Adds needed bin directory to user PATH when possible, then runs
openclaw doctor --non-interactive
on upgrades and git installs (best effort).
Examples (install.ps1)
Default
Git install
Custom git directory
Dry run
Debug trace
iwr
useb https:
openclaw.ai
install.ps1
iex
&
scriptblock
]::Create((iwr
useb https:
openclaw.ai
install.ps1)))
InstallMethod git
&
scriptblock
]::Create((iwr
useb https:
openclaw.ai
install.ps1)))
InstallMethod git
GitDir
"C:\openclaw"
&
scriptblock
]::Create((iwr
useb https:
openclaw.ai
install.ps1)))
DryRun
# install.ps1 has no dedicated -Verbose flag yet.
Set-PSDebug
Trace
&
scriptblock
]::Create((iwr
useb https:
openclaw.ai
install.ps1)))
NoOnboard
Set-PSDebug
Trace
Flags reference
Flag
Description
-InstallMethod npm|git
Install method (default:
npm
-Tag <tag>
npm dist-tag (default:
latest
-GitDir <path>
Checkout directory (default:
%USERPROFILE%\openclaw
-NoOnboard
Skip onboarding
-NoGitUpdate
Skip
git pull
-DryRun
Print actions only
Environment variables reference
Variable
Description
OPENCLAW_INSTALL_METHOD=git|npm
Install method
OPENCLAW_GIT_DIR=<path>
Checkout directory
OPENCLAW_NO_ONBOARD=1
Skip onboarding
OPENCLAW_GIT_UPDATE=0
Disable git pull
OPENCLAW_DRY_RUN=1
Dry run mode
-InstallMethod git
is used and Git is missing, the script exits and prints the Git for Windows link.
CI and automation
Use non-interactive flags/env vars for predictable runs.
install.sh (non-interactive npm)
install.sh (non-interactive git)
install-cli.sh (JSON)
install.ps1 (skip onboarding)
curl
-fsSL
--proto
'=https'
--tlsv1.2
https://openclaw.ai/install.sh
bash
--no-prompt
--no-onboard
OPENCLAW_INSTALL_METHOD
git
OPENCLAW_NO_PROMPT
curl
-fsSL
--proto
'=https'
--tlsv1.2
https://openclaw.ai/install.sh
bash
curl
-fsSL
--proto
'=https'
--tlsv1.2
https://openclaw.ai/install-cli.sh
bash
--json
--prefix
/opt/openclaw
&
scriptblock
]::Create((iwr
useb https:
openclaw.ai
install.ps1)))
NoOnboard
Troubleshooting
Why is Git required?
Git is required for
git
install method. For
npm
installs, Git is still checked/installed to avoid
spawn git ENOENT
failures when dependencies use git URLs.
Why does npm hit EACCES on Linux?
Some Linux setups point npm global prefix to root-owned paths.
install.sh
can switch prefix to
~/.npm-global
and append PATH exports to shell rc files (when those files exist).
sharp/libvips issues
The scripts default
SHARP_IGNORE_GLOBAL_LIBVIPS=1
to avoid sharp building against system libvips. To override:
SHARP_IGNORE_GLOBAL_LIBVIPS
curl
-fsSL
--proto
'=https'
--tlsv1.2
https://openclaw.ai/install.sh
bash
Windows: "npm error spawn git / ENOENT"
Install Git for Windows, reopen PowerShell, rerun installer.
Windows: "openclaw is not recognized"
Run
npm config get prefix
, append
\bin
, add that directory to user PATH, then reopen PowerShell.
Windows: how to get verbose installer output
install.ps1
does not currently expose a
-Verbose
switch.
Use PowerShell tracing for script-level diagnostics:
Set-PSDebug
Trace
&
scriptblock
]::Create((iwr
useb https:
openclaw.ai
install.ps1)))
NoOnboard
Set-PSDebug
Trace
openclaw not found after install
Usually a PATH issue. See
Node.js troubleshooting
Install
Docker

---
## Install > Macos Vm

[Source: https://docs.openclaw.ai/install/macos-vm]

for an always-on Gateway and low cost. See
VPS hosting
Dedicated hardware
(Mac mini or Linux box) if you want full control and a
residential IP
for browser automation. Many sites block data center IPs, so local browsing often works better.
Hybrid:
keep the Gateway on a cheap VPS, and connect your Mac as a
node
when you need browser/UI automation. See
Nodes
and
Gateway remote
Use a macOS VM when you specifically need macOS-only capabilities (iMessage/BlueBubbles) or want strict isolation from your daily Mac.
macOS VM options
Local VM on your Apple Silicon Mac (Lume)
Run OpenClaw in a sandboxed macOS VM on your existing Apple Silicon Mac using
Lume
This gives you:
Full macOS environment in isolation (your host stays clean)
iMessage support via BlueBubbles (impossible on Linux/Windows)
Instant reset by cloning VMs
No extra hardware or cloud costs
Hosted Mac providers (cloud)
If you want macOS in the cloud, hosted Mac providers work too:
MacStadium
(hosted Macs)
Other hosted Mac vendors also work; follow their VM + SSH docs
Once you have SSH access to a macOS VM, continue at step 6 below.
Quick path (Lume, experienced users)
Install Lume
lume create openclaw --os macos --ipsw latest
Complete Setup Assistant, enable Remote Login (SSH)
lume run openclaw --no-display
SSH in, install OpenClaw, configure channels
Done
What you need (Lume)
Apple Silicon Mac (M1/M2/M3/M4)
macOS Sequoia or later on the host
~60 GB free disk space per VM
~20 minutes
1) Install Lume
/bin/bash
"$(
curl
-fsSL
https://raw.githubusercontent.com/trycua/cua/main/libs/lume/scripts/install.sh
)"
~/.local/bin
isn’t in your PATH:
echo
'export PATH="$PATH:$HOME/.local/bin"'
>>
~/.zshrc
&&
source
~/.zshrc
Verify:
lume
--version
Docs:
Lume Installation
2) Create the macOS VM
lume
create
openclaw
--os
macos
--ipsw
latest
This downloads macOS and creates the VM. A VNC window opens automatically.
Note: The download can take a while depending on your connection.
3) Complete Setup Assistant
In the VNC window:
Select language and region
Skip Apple ID (or sign in if you want iMessage later)
Create a user account (remember the username and password)
Skip all optional features
After setup completes, enable SSH:
Open System Settings → General → Sharing
Enable “Remote Login”
4) Get the VM’s IP address
lume
get
openclaw
Look for the IP address (usually
192.168.64.x
5) SSH into the VM
ssh
[email protected]
Replace
youruser
with the account you created, and the IP with your VM’s IP.
6) Install OpenClaw
Inside the VM:
npm
install
openclaw@latest
openclaw
onboard
--install-daemon
Follow the onboarding prompts to set up your model provider (Anthropic, OpenAI, etc.).
7) Configure channels
Edit the config file:
nano
~/.openclaw/openclaw.json
Add your channels:
"channels"
"whatsapp"
"dmPolicy"
"allowlist"
"allowFrom"
"+15551234567"
"telegram"
"botToken"
"YOUR_BOT_TOKEN"
Then login to WhatsApp (scan QR):
openclaw
channels
login
8) Run the VM headlessly
Stop the VM and restart without display:
lume
stop
openclaw
lume
run
openclaw
--no-display
The VM runs in the background. OpenClaw’s daemon keeps the gateway running.
To check status:
ssh
[email protected]
"openclaw status"
Bonus: iMessage integration
This is the killer feature of running on macOS. Use
BlueBubbles
to add iMessage to OpenClaw.
Inside the VM:
Download BlueBubbles from bluebubbles.app
Sign in with your Apple ID
Enable the Web API and set a password
Point BlueBubbles webhooks at your gateway (example:
https://your-gateway-host:3000/bluebubbles-webhook?password=<password>
Add to your OpenClaw config:
"channels"
"bluebubbles"
"serverUrl"
"http://localhost:1234"
"password"
"your-api-password"
"webhookPath"
"/bluebubbles-webhook"
Restart the gateway. Now your agent can send and receive iMessages.
Full setup details:
BlueBubbles channel
Save a golden image
Before customizing further, snapshot your clean state:
lume
stop
openclaw
lume
clone
openclaw
openclaw-golden
Reset anytime:
lume
stop
openclaw
&&
lume
delete
openclaw
lume
clone
openclaw-golden
openclaw
lume
run
openclaw
--no-display
Running 24/7
Keep the VM running by:
Keeping your Mac plugged in
Disabling sleep in System Settings → Energy Saver
Using
caffeinate
if needed
For true always-on, consider a dedicated Mac mini or a small VPS. See
VPS hosting
Troubleshooting
Problem
Solution
Can’t SSH into VM
Check “Remote Login” is enabled in VM’s System Settings
VM IP not showing
Wait for VM to fully boot, run
lume get openclaw
again
Lume command not found
Add
~/.local/bin
to your PATH
WhatsApp QR not scanning
Ensure you’re logged into the VM (not host) when running
openclaw channels login
Related docs
VPS hosting
Nodes
Gateway remote
BlueBubbles channel
Lume Quickstart
Lume CLI Reference
Unattended VM Setup
(advanced)
Docker Sandboxing
(alternative isolation approach)
GCP
exe.dev

---
## Install > Migrating

[Source: https://docs.openclaw.ai/install/migrating]

This guide migrates a OpenClaw Gateway from one machine to another
without redoing onboarding
The migration is simple conceptually:
Copy the
state directory
$OPENCLAW_STATE_DIR
, default:
~/.openclaw/
) — this includes config, auth, sessions, and channel state.
Copy your
workspace
~/.openclaw/workspace/
by default) — this includes your agent files (memory, prompts, etc.).
But there are common footguns around
profiles
permissions
, and
partial copies
Before you start (what you are migrating)
1) Identify your state directory
Most installs use the default:
State dir:
~/.openclaw/
But it may be different if you use:
--profile <name>
(often becomes
~/.openclaw-<profile>/
OPENCLAW_STATE_DIR=/some/path
If you’re not sure, run on the
old
machine:
openclaw
status
Look for mentions of
OPENCLAW_STATE_DIR
/ profile in the output. If you run multiple gateways, repeat for each profile.
2) Identify your workspace
Common defaults:
~/.openclaw/workspace/
(recommended workspace)
a custom folder you created
Your workspace is where files like
MEMORY.md
USER.md
, and
memory/*.md
live.
3) Understand what you will preserve
If you copy
both
the state dir and workspace, you keep:
Gateway configuration (
openclaw.json
Auth profiles / API keys / OAuth tokens
Session history + agent state
Channel state (e.g. WhatsApp login/session)
Your workspace files (memory, skills notes, etc.)
If you copy
only
the workspace (e.g., via Git), you do
not
preserve:
sessions
credentials
channel logins
Those live under
$OPENCLAW_STATE_DIR
Migration steps (recommended)
Step 0 — Make a backup (old machine)
On the
old
machine, stop the gateway first so files aren’t changing mid-copy:
openclaw
gateway
stop
(Optional but recommended) archive the state dir and workspace:
# Adjust paths if you use a profile or custom locations
tar
-czf
openclaw-state.tgz
.openclaw
tar
-czf
openclaw-workspace.tgz
.openclaw/workspace
If you have multiple profiles/state dirs (e.g.
~/.openclaw-main
~/.openclaw-work
), archive each.
Step 1 — Install OpenClaw on the new machine
On the
new
machine, install the CLI (and Node if needed):
See:
Install
At this stage, it’s OK if onboarding creates a fresh
~/.openclaw/
— you will overwrite it in the next step.
Step 2 — Copy the state dir + workspace to the new machine
both
$OPENCLAW_STATE_DIR
(default
~/.openclaw/
your workspace (default
~/.openclaw/workspace/
Common approaches:
scp
the tarballs and extract
rsync -a
over SSH
external drive
After copying, ensure:
Hidden directories were included (e.g.
.openclaw/
File ownership is correct for the user running the gateway
Step 3 — Run Doctor (migrations + service repair)
On the
new
machine:
openclaw
doctor
Doctor is the “safe boring” command. It repairs services, applies config migrations, and warns about mismatches.
Then:
openclaw
gateway
restart
openclaw
status
Common footguns (and how to avoid them)
Footgun: profile / state-dir mismatch
If you ran the old gateway with a profile (or
OPENCLAW_STATE_DIR
), and the new gateway uses a different one, you’ll see symptoms like:
config changes not taking effect
channels missing / logged out
empty session history
Fix: run the gateway/service using the
same
profile/state dir you migrated, then rerun:
openclaw
doctor
Footgun: copying only
openclaw.json
openclaw.json
is not enough. Many providers store state under:
$OPENCLAW_STATE_DIR/credentials/
$OPENCLAW_STATE_DIR/agents/<agentId>/...
Always migrate the entire
$OPENCLAW_STATE_DIR
folder.
Footgun: permissions / ownership
If you copied as root or changed users, the gateway may fail to read credentials/sessions.
Fix: ensure the state dir + workspace are owned by the user running the gateway.
Footgun: migrating between remote/local modes
If your UI (WebUI/TUI) points at a
remote
gateway, the remote host owns the session store + workspace.
Migrating your laptop won’t move the remote gateway’s state.
If you’re in remote mode, migrate the
gateway host
Footgun: secrets in backups
$OPENCLAW_STATE_DIR
contains secrets (API keys, OAuth tokens, WhatsApp creds). Treat backups like production secrets:
store encrypted
avoid sharing over insecure channels
rotate keys if you suspect exposure
Verification checklist
On the new machine, confirm:
openclaw status
shows the gateway running
Your channels are still connected (e.g. WhatsApp doesn’t require re-pair)
The dashboard opens and shows existing sessions
Your workspace files (memory, configs) are present
Related
Doctor
Gateway troubleshooting
Where does OpenClaw store its data?
Updating
Uninstall

---
## Install > Nix

[Source: https://docs.openclaw.ai/install/nix]

— a batteries-included Home Manager module.
Quick Start
Paste this to your AI agent (Claude, Cursor, etc.):
I want to set up nix-openclaw on my Mac.
Repository: github:openclaw/nix-openclaw
What I need you to do:
1. Check if Determinate Nix is installed (if not, install it)
2. Create a local flake at ~/code/openclaw-local using templates/agent-first/flake.nix
3. Help me create a Telegram bot (@BotFather) and get my chat ID (@userinfobot)
4. Set up secrets (bot token, Anthropic key) - plain files at ~/.secrets/ is fine
5. Fill in the template placeholders and run home-manager switch
6. Verify: launchd running, bot responds to messages
Reference the nix-openclaw README for module options.
📦 Full guide:
github.com/openclaw/nix-openclaw
The nix-openclaw repo is the source of truth for Nix installation. This page is just a quick overview.
What you get
Gateway + macOS app + tools (whisper, spotify, cameras) — all pinned
Launchd service that survives reboots
Plugin system with declarative config
Instant rollback:
home-manager switch --rollback
Nix Mode Runtime Behavior
When
OPENCLAW_NIX_MODE=1
is set (automatic with nix-openclaw):
OpenClaw supports a
Nix mode
that makes configuration deterministic and disables auto-install flows.
Enable it by exporting:
OPENCLAW_NIX_MODE
On macOS, the GUI app does not automatically inherit shell env vars. You can
also enable Nix mode via defaults:
defaults
write
bot.molt.mac
openclaw.nixMode
-bool
true
Config + state paths
OpenClaw reads JSON5 config from
OPENCLAW_CONFIG_PATH
and stores mutable data in
OPENCLAW_STATE_DIR
When needed, you can also set
OPENCLAW_HOME
to control the base home directory used for internal path resolution.
OPENCLAW_HOME
(default precedence:
HOME
USERPROFILE
os.homedir()
OPENCLAW_STATE_DIR
(default:
~/.openclaw
OPENCLAW_CONFIG_PATH
(default:
$OPENCLAW_STATE_DIR/openclaw.json
When running under Nix, set these explicitly to Nix-managed locations so runtime state and config
stay out of the immutable store.
Runtime behavior in Nix mode
Auto-install and self-mutation flows are disabled
Missing dependencies surface Nix-specific remediation messages
UI surfaces a read-only Nix mode banner when present
Packaging note (macOS)
The macOS packaging flow expects a stable Info.plist template at:
apps/macos/Sources/OpenClaw/Resources/Info.plist
scripts/package-mac-app.sh
copies this template into the app bundle and patches dynamic fields
(bundle ID, version/build, Git SHA, Sparkle keys). This keeps the plist deterministic for SwiftPM
packaging and Nix builds (which do not rely on a full Xcode toolchain).
Related
nix-openclaw
— full setup guide
Wizard
— non-Nix CLI setup
Docker
— containerized setup
Podman
Ansible

---
## Install > Node

[Source: https://docs.openclaw.ai/install/node]

. The
installer script
will detect and install Node automatically — this page is for when you want to set up Node yourself and make sure everything is wired up correctly (versions, PATH, global installs).
Check your version
node
If this prints
v22.x.x
or higher, you’re good. If Node isn’t installed or the version is too old, pick an install method below.
Install Node
macOS
Linux
Windows
Homebrew
(recommended):
brew
install
node
Or download the macOS installer from
nodejs.org
Ubuntu / Debian:
curl
-fsSL
https://deb.nodesource.com/setup_22.x
sudo
bash
sudo
apt-get
install
nodejs
Fedora / RHEL:
sudo
dnf
install
nodejs
Or use a version manager (see below).
winget
(recommended):
winget install OpenJS.NodeJS.LTS
Chocolatey:
choco install nodejs
lts
Or download the Windows installer from
nodejs.org
Using a version manager (nvm, fnm, mise, asdf)
Version managers let you switch between Node versions easily. Popular options:
fnm
— fast, cross-platform
nvm
— widely used on macOS/Linux
mise
— polyglot (Node, Python, Ruby, etc.)
Example with fnm:
fnm
install
fnm
use
Make sure your version manager is initialized in your shell startup file (
~/.zshrc
~/.bashrc
). If it isn’t,
openclaw
may not be found in new terminal sessions because the PATH won’t include Node’s bin directory.
Troubleshooting
openclaw: command not found
This almost always means npm’s global bin directory isn’t on your PATH.
Find your global npm prefix
npm
prefix
Check if it's on your PATH
echo
"$PATH"
Look for
<npm-prefix>/bin
(macOS/Linux) or
<npm-prefix>
(Windows) in the output.
Add it to your shell startup file
macOS / Linux
Windows
Add to
~/.zshrc
~/.bashrc
export
PATH
"$(
npm
prefix
)/bin:$PATH"
Then open a new terminal (or run
rehash
in zsh /
hash -r
in bash).
Add the output of
npm prefix -g
to your system PATH via Settings → System → Environment Variables.
Permission errors on
npm install -g
(Linux)
If you see
EACCES
errors, switch npm’s global prefix to a user-writable directory:
mkdir
"$HOME/.npm-global"
npm
config
set
prefix
"$HOME/.npm-global"
export
PATH
"$HOME/.npm-global/bin:$PATH"
Add the
export PATH=...
line to your
~/.bashrc
~/.zshrc
to make it permanent.
Scripts
Session Management Deep Dive

---
## Install > Northflank

[Source: https://docs.openclaw.ai/install/northflank]

Deploy OpenClaw on Northflank with a one-click template and finish setup in your browser.
This is the easiest “no terminal on the server” path: Northflank runs the Gateway for you,
and you configure everything via the
/setup
web wizard.
How to get started
Click
Deploy OpenClaw
to open the template.
Create an
account on Northflank
if you don’t already have one.
Click
Deploy OpenClaw now
Set the required environment variable:
SETUP_PASSWORD
Click
Deploy stack
to build and run the OpenClaw template.
Wait for the deployment to complete, then click
View resources
Open the OpenClaw service.
Open the public OpenClaw URL and complete setup at
/setup
Open the Control UI at
/openclaw
What you get
Hosted OpenClaw Gateway + Control UI
Web setup wizard at
/setup
(no terminal commands)
Persistent storage via Northflank Volume (
/data
) so config/credentials/workspace survive redeploys
Setup flow
Visit
https://<your-northflank-domain>/setup
and enter your
SETUP_PASSWORD
Choose a model/auth provider and paste your key.
(Optional) Add Telegram/Discord/Slack tokens.
Click
Run setup
Open the Control UI at
https://<your-northflank-domain>/openclaw
If Telegram DMs are set to pairing, the setup wizard can approve the pairing code.
Getting chat tokens
Telegram bot token
Message
@BotFather
in Telegram
Run
/newbot
Copy the token (looks like
123456789:AA...
Paste it into
/setup
Discord bot token
Go to
https://discord.com/developers/applications
New Application
→ choose a name
Bot
Add Bot
Enable MESSAGE CONTENT INTENT
under Bot → Privileged Gateway Intents (required or the bot will crash on startup)
Copy the
Bot Token
and paste into
/setup
Invite the bot to your server (OAuth2 URL Generator; scopes:
bot
applications.commands
Deploy on Render
Development Channels

---
## Install > Podman

[Source: https://docs.openclaw.ai/install/podman]

Run the OpenClaw gateway in a
rootless
Podman container. Uses the same image as Docker (build from the repo
Dockerfile
Requirements
Podman (rootless)
Sudo for one-time setup (create user, build image)
Quick start
1. One-time setup
(from repo root; creates user, builds image, installs launch script):
./setup-podman.sh
This also creates a minimal
~openclaw/.openclaw/openclaw.json
(sets
gateway.mode="local"
) so the gateway can start without running the wizard.
By default the container is
not
installed as a systemd service, you start it manually (see below). For a production-style setup with auto-start and restarts, install it as a systemd Quadlet user service instead:
./setup-podman.sh
--quadlet
(Or set
OPENCLAW_PODMAN_QUADLET=1
; use
--container
to install only the container and launch script.)
2. Start gateway
(manual, for quick smoke testing):
./scripts/run-openclaw-podman.sh
launch
3. Onboarding wizard
(e.g. to add channels or providers):
./scripts/run-openclaw-podman.sh
launch
setup
Then open
http://127.0.0.1:18789/
and use the token from
~openclaw/.openclaw/.env
(or the value printed by setup).
Systemd (Quadlet, optional)
If you ran
./setup-podman.sh --quadlet
(or
OPENCLAW_PODMAN_QUADLET=1
), a
Podman Quadlet
unit is installed so the gateway runs as a systemd user service for the openclaw user. The service is enabled and started at the end of setup.
Start:
sudo systemctl --machine openclaw@ --user start openclaw.service
Stop:
sudo systemctl --machine openclaw@ --user stop openclaw.service
Status:
sudo systemctl --machine openclaw@ --user status openclaw.service
Logs:
sudo journalctl --machine openclaw@ --user -u openclaw.service -f
The quadlet file lives at
~openclaw/.config/containers/systemd/openclaw.container
. To change ports or env, edit that file (or the
.env
it sources), then
sudo systemctl --machine openclaw@ --user daemon-reload
and restart the service. On boot, the service starts automatically if lingering is enabled for openclaw (setup does this when loginctl is available).
To add quadlet
after
an initial setup that did not use it, re-run:
./setup-podman.sh --quadlet
The openclaw user (non-login)
setup-podman.sh
creates a dedicated system user
openclaw
Shell:
nologin
— no interactive login; reduces attack surface.
Home:
e.g.
/home/openclaw
— holds
~/.openclaw
(config, workspace) and the launch script
run-openclaw-podman.sh
Rootless Podman:
The user must have a
subuid
and
subgid
range. Many distros assign these automatically when the user is created. If setup prints a warning, add lines to
/etc/subuid
and
/etc/subgid
openclaw:100000:65536
Then start the gateway as that user (e.g. from cron or systemd):
sudo
openclaw
/home/openclaw/run-openclaw-podman.sh
sudo
openclaw
/home/openclaw/run-openclaw-podman.sh
setup
Config:
Only
openclaw
and root can access
/home/openclaw/.openclaw
. To edit config: use the Control UI once the gateway is running, or
sudo -u openclaw $EDITOR /home/openclaw/.openclaw/openclaw.json
Environment and config
Token:
Stored in
~openclaw/.openclaw/.env
OPENCLAW_GATEWAY_TOKEN
setup-podman.sh
and
run-openclaw-podman.sh
generate it if missing (uses
openssl
python3
, or
Optional:
In that
.env
you can set provider keys (e.g.
GROQ_API_KEY
OLLAMA_API_KEY
) and other OpenClaw env vars.
Host ports:
By default the script maps
18789
(gateway) and
18790
(bridge). Override the
host
port mapping with
OPENCLAW_PODMAN_GATEWAY_HOST_PORT
and
OPENCLAW_PODMAN_BRIDGE_HOST_PORT
when launching.
Paths:
Host config and workspace default to
~openclaw/.openclaw
and
~openclaw/.openclaw/workspace
. Override the host paths used by the launch script with
OPENCLAW_CONFIG_DIR
and
OPENCLAW_WORKSPACE_DIR
Useful commands
Logs:
With quadlet:
sudo journalctl --machine openclaw@ --user -u openclaw.service -f
. With script:
sudo -u openclaw podman logs -f openclaw
Stop:
With quadlet:
sudo systemctl --machine openclaw@ --user stop openclaw.service
. With script:
sudo -u openclaw podman stop openclaw
Start again:
With quadlet:
sudo systemctl --machine openclaw@ --user start openclaw.service
. With script: re-run the launch script or
podman start openclaw
Remove container:
sudo -u openclaw podman rm -f openclaw
— config and workspace on the host are kept
Troubleshooting
Permission denied (EACCES) on config or auth-profiles:
The container defaults to
--userns=keep-id
and runs as the same uid/gid as the host user running the script. Ensure your host
OPENCLAW_CONFIG_DIR
and
OPENCLAW_WORKSPACE_DIR
are owned by that user.
Gateway start blocked (missing
gateway.mode=local
Ensure
~openclaw/.openclaw/openclaw.json
exists and sets
gateway.mode="local"
setup-podman.sh
creates this file if missing.
Rootless Podman fails for user openclaw:
Check
/etc/subuid
and
/etc/subgid
contain a line for
openclaw
(e.g.
openclaw:100000:65536
). Add it if missing and restart.
Container name in use:
The launch script uses
podman run --replace
, so the existing container is replaced when you start again. To clean up manually:
podman rm -f openclaw
Script not found when running as openclaw:
Ensure
setup-podman.sh
was run so that
run-openclaw-podman.sh
is copied to openclaw’s home (e.g.
/home/openclaw/run-openclaw-podman.sh
Quadlet service not found or fails to start:
Run
sudo systemctl --machine openclaw@ --user daemon-reload
after editing the
.container
file. Quadlet requires cgroups v2:
podman info --format '{{.Host.CgroupsVersion}}'
should show
Optional: run as your own user
To run the gateway as your normal user (no dedicated openclaw user): build the image, create
~/.openclaw/.env
with
OPENCLAW_GATEWAY_TOKEN
, and run the container with
--userns=keep-id
and mounts to your
~/.openclaw
. The launch script is designed for the openclaw-user flow; for a single-user setup you can instead run the
podman run
command from the script manually, pointing config and workspace to your home. Recommended for most users: use
setup-podman.sh
and run as the openclaw user so config and process are isolated.
Docker
Nix

---
## Install > Railway

[Source: https://docs.openclaw.ai/install/railway]

Deploy OpenClaw on Railway with a one-click template and finish setup in your browser.
This is the easiest “no terminal on the server” path: Railway runs the Gateway for you,
and you configure everything via the
/setup
web wizard.
Quick checklist (new users)
Click
Deploy on Railway
(below).
Add a
Volume
mounted at
/data
Set the required
Variables
(at least
SETUP_PASSWORD
Enable
HTTP Proxy
on port
8080
Open
https://<your-railway-domain>/setup
and finish the wizard.
One-click deploy
Deploy on Railway
After deploy, find your public URL in
Railway → your service → Settings → Domains
Railway will either:
give you a generated domain (often
https://<something>.up.railway.app
), or
use your custom domain if you attached one.
Then open:
https://<your-railway-domain>/setup
— setup wizard (password protected)
https://<your-railway-domain>/openclaw
— Control UI
What you get
Hosted OpenClaw Gateway + Control UI
Web setup wizard at
/setup
(no terminal commands)
Persistent storage via Railway Volume (
/data
) so config/credentials/workspace survive redeploys
Backup export at
/setup/export
to migrate off Railway later
Required Railway settings
Public Networking
Enable
HTTP Proxy
for the service.
Port:
8080
Volume (required)
Attach a volume mounted at:
/data
Variables
Set these variables on the service:
SETUP_PASSWORD
(required)
PORT=8080
(required — must match the port in Public Networking)
OPENCLAW_STATE_DIR=/data/.openclaw
(recommended)
OPENCLAW_WORKSPACE_DIR=/data/workspace
(recommended)
OPENCLAW_GATEWAY_TOKEN
(recommended; treat as an admin secret)
Setup flow
Visit
https://<your-railway-domain>/setup
and enter your
SETUP_PASSWORD
Choose a model/auth provider and paste your key.
(Optional) Add Telegram/Discord/Slack tokens.
Click
Run setup
If Telegram DMs are set to pairing, the setup wizard can approve the pairing code.
Getting chat tokens
Telegram bot token
Message
@BotFather
in Telegram
Run
/newbot
Copy the token (looks like
123456789:AA...
Paste it into
/setup
Discord bot token
Go to
https://discord.com/developers/applications
New Application
→ choose a name
Bot
Add Bot
Enable MESSAGE CONTENT INTENT
under Bot → Privileged Gateway Intents (required or the bot will crash on startup)
Copy the
Bot Token
and paste into
/setup
Invite the bot to your server (OAuth2 URL Generator; scopes:
bot
applications.commands
Backups & migration
Download a backup at:
https://<your-railway-domain>/setup/export
This exports your OpenClaw state + workspace so you can migrate to another host without losing config or memory.
exe.dev
Deploy on Render

---
## Install > Render

[Source: https://docs.openclaw.ai/install/render]

Deploy OpenClaw on Render using Infrastructure as Code. The included
render.yaml
Blueprint defines your entire stack declaratively, service, disk, environment variables, so you can deploy with a single click and version your infrastructure alongside your code.
Prerequisites
Render account
(free tier available)
An API key from your preferred
model provider
Deploy with a Render Blueprint
Deploy to Render
Clicking this link will:
Create a new Render service from the
render.yaml
Blueprint at the root of this repo.
Prompt you to set
SETUP_PASSWORD
Build the Docker image and deploy
Once deployed, your service URL follows the pattern
https://<service-name>.onrender.com
Understanding the Blueprint
Render Blueprints are YAML files that define your infrastructure. The
render.yaml
in this
repository configures everything needed to run OpenClaw:
services
type
web
name
openclaw
runtime
docker
plan
starter
healthCheckPath
/health
envVars
key
PORT
value
"8080"
key
SETUP_PASSWORD
sync
false
# prompts during deploy
key
OPENCLAW_STATE_DIR
value
/data/.openclaw
key
OPENCLAW_WORKSPACE_DIR
value
/data/workspace
key
OPENCLAW_GATEWAY_TOKEN
generateValue
true
# auto-generates a secure token
disk
name
openclaw-data
mountPath
/data
sizeGB
Key Blueprint features used:
Feature
Purpose
runtime: docker
Builds from the repo’s Dockerfile
healthCheckPath
Render monitors
/health
and restarts unhealthy instances
sync: false
Prompts for value during deploy (secrets)
generateValue: true
Auto-generates a cryptographically secure value
disk
Persistent storage that survives redeploys
Choosing a plan
Plan
Spin-down
Disk
Best for
Free
After 15 min idle
Not available
Testing, demos
Starter
Never
1GB+
Personal use, small teams
Standard+
Never
1GB+
Production, multiple channels
The Blueprint defaults to
starter
. To use free tier, change
plan: free
in your fork’s
render.yaml
(but note: no persistent disk means config resets on each deploy).
After deployment
Complete the setup wizard
Navigate to
https://<your-service>.onrender.com/setup
Enter your
SETUP_PASSWORD
Select a model provider and paste your API key
Optionally configure messaging channels (Telegram, Discord, Slack)
Click
Run setup
Access the Control UI
The web dashboard is available at
https://<your-service>.onrender.com/openclaw
Render Dashboard features
Logs
View real-time logs in
Dashboard → your service → Logs
. Filter by:
Build logs (Docker image creation)
Deploy logs (service startup)
Runtime logs (application output)
Shell access
For debugging, open a shell session via
Dashboard → your service → Shell
. The persistent disk is mounted at
/data
Environment variables
Modify variables in
Dashboard → your service → Environment
. Changes trigger an automatic redeploy.
Auto-deploy
If you use the original OpenClaw repository, Render will not auto-deploy your OpenClaw. To update it, run a manual Blueprint sync from the dashboard.
Custom domain
Go to
Dashboard → your service → Settings → Custom Domains
Add your domain
Configure DNS as instructed (CNAME to
*.onrender.com
Render provisions a TLS certificate automatically
Scaling
Render supports horizontal and vertical scaling:
Vertical
: Change the plan to get more CPU/RAM
Horizontal
: Increase instance count (Standard plan and above)
For OpenClaw, vertical scaling is usually sufficient. Horizontal scaling requires sticky sessions or external state management.
Backups and migration
Export your configuration and workspace at any time:
https://<your-service>.onrender.com/setup/export
This downloads a portable backup you can restore on any OpenClaw host.
Troubleshooting
Service won’t start
Check the deploy logs in the Render Dashboard. Common issues:
Missing
SETUP_PASSWORD
— the Blueprint prompts for this, but verify it’s set
Port mismatch — ensure
PORT=8080
matches the Dockerfile’s exposed port
Slow cold starts (free tier)
Free tier services spin down after 15 minutes of inactivity. The first request after spin-down takes a few seconds while the container starts. Upgrade to Starter plan for always-on.
Data loss after redeploy
This happens on free tier (no persistent disk). Upgrade to a paid plan, or
regularly export your config via
/setup/export
Health check failures
Render expects a 200 response from
/health
within 30 seconds. If builds succeed but deploys fail, the service may be taking too long to start. Check:
Build logs for errors
Whether the container runs locally with
docker build && docker run
Deploy on Railway
Deploy on Northflank

---
## Install > Uninstall

[Source: https://docs.openclaw.ai/install/uninstall]

Two paths:
Easy path
openclaw
is still installed.
Manual service removal
if the CLI is gone but the service is still running.
Easy path (CLI still installed)
Recommended: use the built-in uninstaller:
openclaw
uninstall
Non-interactive (automation / npx):
openclaw
uninstall
--all
--yes
--non-interactive
npx
openclaw
uninstall
--all
--yes
--non-interactive
Manual steps (same result):
Stop the gateway service:
openclaw
gateway
stop
Uninstall the gateway service (launchd/systemd/schtasks):
openclaw
gateway
uninstall
Delete state + config:
-rf
"${OPENCLAW_STATE_DIR
$HOME
.openclaw}"
If you set
OPENCLAW_CONFIG_PATH
to a custom location outside the state dir, delete that file too.
Delete your workspace (optional, removes agent files):
-rf
~/.openclaw/workspace
Remove the CLI install (pick the one you used):
npm
openclaw
pnpm
remove
openclaw
bun
remove
openclaw
If you installed the macOS app:
-rf
/Applications/OpenClaw.app
Notes:
If you used profiles (
--profile
OPENCLAW_PROFILE
), repeat step 3 for each state dir (defaults are
~/.openclaw-<profile>
In remote mode, the state dir lives on the
gateway host
, so run steps 1-4 there too.
Manual service removal (CLI not installed)
Use this if the gateway service keeps running but
openclaw
is missing.
macOS (launchd)
Default label is
bot.molt.gateway
(or
bot.molt.<profile>
; legacy
com.openclaw.*
may still exist):
launchctl
bootout
gui/
$UID
/bot.molt.gateway
~/Library/LaunchAgents/bot.molt.gateway.plist
If you used a profile, replace the label and plist name with
bot.molt.<profile>
. Remove any legacy
com.openclaw.*
plists if present.
Linux (systemd user unit)
Default unit name is
openclaw-gateway.service
(or
openclaw-gateway-<profile>.service
systemctl
--user
disable
--now
openclaw-gateway.service
~/.config/systemd/user/openclaw-gateway.service
systemctl
--user
daemon-reload
Windows (Scheduled Task)
Default task name is
OpenClaw Gateway
(or
OpenClaw Gateway (<profile>)
The task script lives under your state dir.
schtasks
Delete
"OpenClaw Gateway"
Remove-Item
Force
"$
env:
USERPROFILE\.openclaw\gateway.cmd"
If you used a profile, delete the matching task name and
~\.openclaw-<profile>\gateway.cmd
Normal install vs source checkout
Normal install (install.sh / npm / pnpm / bun)
If you used
https://openclaw.ai/install.sh
install.ps1
, the CLI was installed with
npm install -g openclaw@latest
Remove it with
npm rm -g openclaw
(or
pnpm remove -g
bun remove -g
if you installed that way).
Source checkout (git clone)
If you run from a repo checkout (
git clone
openclaw ...
bun run openclaw ...
Uninstall the gateway service
before
deleting the repo (use the easy path above or manual service removal).
Delete the repo directory.
Remove state + workspace as shown above.
Migration Guide
Fly.io

---
## Install > Updating

[Source: https://docs.openclaw.ai/install/updating]

OpenClaw is moving fast (pre “1.0”). Treat updates like shipping infra: update → run checks → restart (or use
openclaw update
, which restarts) → verify.
Recommended: re-run the website installer (upgrade in place)
The
preferred
update path is to re-run the installer from the website. It
detects existing installs, upgrades in place, and runs
openclaw doctor
when
needed.
curl
-fsSL
https://openclaw.ai/install.sh
bash
Notes:
Add
--no-onboard
if you don’t want the onboarding wizard to run again.
For
source installs
, use:
curl
-fsSL
https://openclaw.ai/install.sh
bash
--install-method
git
--no-onboard
The installer will
git pull --rebase
only
if the repo is clean.
For
global installs
, the script uses
npm install -g openclaw@latest
under the hood.
Legacy note:
clawdbot
remains available as a compatibility shim.
Before you update
Know how you installed:
global
(npm/pnpm) vs
from source
(git clone).
Know how your Gateway is running:
foreground terminal
supervised service
(launchd/systemd).
Snapshot your tailoring:
Config:
~/.openclaw/openclaw.json
Credentials:
~/.openclaw/credentials/
Workspace:
~/.openclaw/workspace
Update (global install)
Global install (pick one):
npm
openclaw@latest
pnpm
add
openclaw@latest
We do
not
recommend Bun for the Gateway runtime (WhatsApp/Telegram bugs).
To switch update channels (git + npm installs):
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
--channel
stable
Use
--tag <dist-tag|version>
for a one-off install tag/version.
See
Development channels
for channel semantics and release notes.
Note: on npm installs, the gateway logs an update hint on startup (checks the current channel tag). Disable via
update.checkOnStart: false
Then:
openclaw
doctor
openclaw
gateway
restart
openclaw
health
Notes:
If your Gateway runs as a service,
openclaw gateway restart
is preferred over killing PIDs.
If you’re pinned to a specific version, see “Rollback / pinning” below.
Update (
openclaw update
For
source installs
(git checkout), prefer:
openclaw
update
It runs a safe-ish update flow:
Requires a clean worktree.
Switches to the selected channel (tag or branch).
Fetches + rebases against the configured upstream (dev channel).
Installs deps, builds, builds the Control UI, and runs
openclaw doctor
Restarts the gateway by default (use
--no-restart
to skip).
If you installed via
npm/pnpm
(no git metadata),
openclaw update
will try to update via your package manager. If it can’t detect the install, use “Update (global install)” instead.
Update (Control UI / RPC)
The Control UI has
Update & Restart
(RPC:
update.run
). It:
Runs the same source-update flow as
openclaw update
(git checkout only).
Writes a restart sentinel with a structured report (stdout/stderr tail).
Restarts the gateway and pings the last active session with the report.
If the rebase fails, the gateway aborts and restarts without applying the update.
Update (from source)
From the repo checkout:
Preferred:
openclaw
update
Manual (equivalent-ish):
git
pull
pnpm
install
pnpm
build
pnpm
ui:build
# auto-installs UI deps on first run
openclaw
doctor
openclaw
health
Notes:
pnpm build
matters when you run the packaged
openclaw
binary (
openclaw.mjs
) or use Node to run
dist/
If you run from a repo checkout without a global install, use
pnpm openclaw ...
for CLI commands.
If you run directly from TypeScript (
pnpm openclaw ...
), a rebuild is usually unnecessary, but
config migrations still apply
→ run doctor.
Switching between global and git installs is easy: install the other flavor, then run
openclaw doctor
so the gateway service entrypoint is rewritten to the current install.
Always Run:
openclaw doctor
Doctor is the “safe update” command. It’s intentionally boring: repair + migrate + warn.
Note: if you’re on a
source install
(git checkout),
openclaw doctor
will offer to run
openclaw update
first.
Typical things it does:
Migrate deprecated config keys / legacy config file locations.
Audit DM policies and warn on risky “open” settings.
Check Gateway health and can offer to restart.
Detect and migrate older gateway services (launchd/systemd; legacy schtasks) to current OpenClaw services.
On Linux, ensure systemd user lingering (so the Gateway survives logout).
Details:
Doctor
Start / stop / restart the Gateway
CLI (works regardless of OS):
openclaw
gateway
status
openclaw
gateway
stop
openclaw
gateway
restart
openclaw
gateway
--port
18789
openclaw
logs
--follow
If you’re supervised:
macOS launchd (app-bundled LaunchAgent):
launchctl kickstart -k gui/$UID/bot.molt.gateway
(use
bot.molt.<profile>
; legacy
com.openclaw.*
still works)
Linux systemd user service:
systemctl --user restart openclaw-gateway[-<profile>].service
Windows (WSL2):
systemctl --user restart openclaw-gateway[-<profile>].service
launchctl
systemctl
only work if the service is installed; otherwise run
openclaw gateway install
Runbook + exact service labels:
Gateway runbook
Rollback / pinning (when something breaks)
Pin (global install)
Install a known-good version (replace
<version>
with the last working one):
npm
openclaw@
<
versio
>
pnpm
add
openclaw@
<
versio
>
Tip: to see the current published version, run
npm view openclaw version
Then restart + re-run doctor:
openclaw
doctor
openclaw
gateway
restart
Pin (source) by date
Pick a commit from a date (example: “state of main as of 2026-01-01”):
git
fetch
origin
git
checkout
"$(
git
rev-list
--before=\"2026-01-01\"
origin/main
)"
Then reinstall deps + restart:
pnpm
install
pnpm
build
openclaw
gateway
restart
If you want to go back to latest later:
git
checkout
main
git
pull
If you’re stuck
Run
openclaw doctor
again and read the output carefully (it often tells you the fix).
Check:
Troubleshooting
Ask in Discord:
https://discord.gg/clawd
Bun (Experimental)
Migration Guide
