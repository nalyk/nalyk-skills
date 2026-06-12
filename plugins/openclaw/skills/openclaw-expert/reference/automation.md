# OpenClaw Automation Reference

Cron jobs, hooks, webhooks, Gmail PubSub, polls, auth monitoring.

---
## Automation > Auth Monitoring

[Source: https://docs.openclaw.ai/automation/auth-monitoring]

. Use that for
automation and alerting; scripts are optional extras for phone workflows.
Preferred: CLI check (portable)
openclaw
models
status
--check
Exit codes:
: OK
: expired or missing credentials
: expiring soon (within 24h)
This works in cron/systemd and requires no extra scripts.
Optional scripts (ops / phone workflows)
These live under
scripts/
and are
optional
. They assume SSH access to the
gateway host and are tuned for systemd + Termux.
scripts/claude-auth-status.sh
now uses
openclaw models status --json
as the
source of truth (falling back to direct file reads if the CLI is unavailable),
so keep
openclaw
PATH
for timers.
scripts/auth-monitor.sh
: cron/systemd timer target; sends alerts (ntfy or phone).
scripts/systemd/openclaw-auth-monitor.{service,timer}
: systemd user timer.
scripts/claude-auth-status.sh
: Claude Code + OpenClaw auth checker (full/json/simple).
scripts/mobile-reauth.sh
: guided re‑auth flow over SSH.
scripts/termux-quick-auth.sh
: one‑tap widget status + open auth URL.
scripts/termux-auth-widget.sh
: full guided widget flow.
scripts/termux-sync-widget.sh
: sync Claude Code creds → OpenClaw.
If you don’t need phone automation or systemd timers, skip these scripts.
Polls
Nodes

---
## Automation > Cron Jobs

[Source: https://docs.openclaw.ai/automation/cron-jobs]

for guidance on when to use each.
Cron is the Gateway’s built-in scheduler. It persists jobs, wakes the agent at
the right time, and can optionally deliver output back to a chat.
If you want
“run this every morning”
“poke the agent in 20 minutes”
cron is the mechanism.
Troubleshooting:
/automation/troubleshooting
TL;DR
Cron runs
inside the Gateway
(not inside the model).
Jobs persist under
~/.openclaw/cron/
so restarts don’t lose schedules.
Two execution styles:
Main session
: enqueue a system event, then run on the next heartbeat.
Isolated
: run a dedicated agent turn in
cron:<jobId>
, with delivery (announce by default or none).
Wakeups are first-class: a job can request “wake now” vs “next heartbeat”.
Webhook posting is opt-in per job: set
notify: true
and configure
cron.webhook
Quick start (actionable)
Create a one-shot reminder, verify it exists, and run it immediately:
openclaw
cron
add
--name
"Reminder"
--at
"2026-02-01T16:00:00Z"
--session
main
--system-event
"Reminder: check the cron docs draft"
--wake
now
--delete-after-run
openclaw
cron
list
openclaw
cron
run
<
job-i
>
openclaw
cron
runs
--id
<
job-i
>
Schedule a recurring isolated job with delivery:
openclaw
cron
add
--name
"Morning brief"
--cron
"0 7 * * *"
--tz
"America/Los_Angeles"
--session
isolated
--message
"Summarize overnight updates."
--announce
--channel
slack
--to
"channel:C1234567890"
Tool-call equivalents (Gateway cron tool)
For the canonical JSON shapes and examples, see
JSON schema for tool calls
Where cron jobs are stored
Cron jobs are persisted on the Gateway host at
~/.openclaw/cron/jobs.json
by default.
The Gateway loads the file into memory and writes it back on changes, so manual edits
are only safe when the Gateway is stopped. Prefer
openclaw cron add/edit
or the cron
tool call API for changes.
Beginner-friendly overview
Think of a cron job as:
when
to run +
what
to do.
Choose a schedule
One-shot reminder →
schedule.kind = "at"
(CLI:
--at
Repeating job →
schedule.kind = "every"
schedule.kind = "cron"
If your ISO timestamp omits a timezone, it is treated as
UTC
Choose where it runs
sessionTarget: "main"
→ run during the next heartbeat with main context.
sessionTarget: "isolated"
→ run a dedicated agent turn in
cron:<jobId>
Choose the payload
Main session →
payload.kind = "systemEvent"
Isolated session →
payload.kind = "agentTurn"
Optional: one-shot jobs (
schedule.kind = "at"
) delete after success by default. Set
deleteAfterRun: false
to keep them (they will disable after success).
Concepts
Jobs
A cron job is a stored record with:
schedule
(when it should run),
payload
(what it should do),
optional
delivery mode
(announce or none).
optional
agent binding
agentId
): run the job under a specific agent; if
missing or unknown, the gateway falls back to the default agent.
Jobs are identified by a stable
jobId
(used by CLI/Gateway APIs).
In agent tool calls,
jobId
is canonical; legacy
is accepted for compatibility.
One-shot jobs auto-delete after success by default; set
deleteAfterRun: false
to keep them.
Schedules
Cron supports three schedule kinds:
: one-shot timestamp via
schedule.at
(ISO 8601).
every
: fixed interval (ms).
cron
: 5-field cron expression with optional IANA timezone.
Cron expressions use
croner
. If a timezone is omitted, the Gateway host’s
local timezone is used.
Main vs isolated execution
Main session jobs (system events)
Main jobs enqueue a system event and optionally wake the heartbeat runner.
They must use
payload.kind = "systemEvent"
wakeMode: "now"
(default): event triggers an immediate heartbeat run.
wakeMode: "next-heartbeat"
: event waits for the next scheduled heartbeat.
This is the best fit when you want the normal heartbeat prompt + main-session context.
See
Heartbeat
Isolated jobs (dedicated cron sessions)
Isolated jobs run a dedicated agent turn in session
cron:<jobId>
Key behaviors:
Prompt is prefixed with
[cron:<jobId> <job name>]
for traceability.
Each run starts a
fresh session id
(no prior conversation carry-over).
Default behavior: if
delivery
is omitted, isolated jobs announce a summary (
delivery.mode = "announce"
delivery.mode
(isolated-only) chooses what happens:
announce
: deliver a summary to the target channel and post a brief summary to the main session.
none
: internal only (no delivery, no main-session summary).
wakeMode
controls when the main-session summary posts:
now
: immediate heartbeat.
next-heartbeat
: waits for the next scheduled heartbeat.
Use isolated jobs for noisy, frequent, or “background chores” that shouldn’t spam
your main chat history.
Payload shapes (what runs)
Two payload kinds are supported:
systemEvent
: main-session only, routed through the heartbeat prompt.
agentTurn
: isolated-session only, runs a dedicated agent turn.
Common
agentTurn
fields:
message
: required text prompt.
model
thinking
: optional overrides (see below).
timeoutSeconds
: optional timeout override.
Delivery config (isolated jobs only):
delivery.mode
none
announce
delivery.channel
last
or a specific channel.
delivery.to
: channel-specific target (phone/chat/channel id).
delivery.bestEffort
: avoid failing the job if announce delivery fails.
Announce delivery suppresses messaging tool sends for the run; use
delivery.channel
delivery.to
to target the chat instead. When
delivery.mode = "none"
, no summary is posted to the main session.
delivery
is omitted for isolated jobs, OpenClaw defaults to
announce
Announce delivery flow
When
delivery.mode = "announce"
, cron delivers directly via the outbound channel adapters.
The main agent is not spun up to craft or forward the message.
Behavior details:
Content: delivery uses the isolated run’s outbound payloads (text/media) with normal chunking and
channel formatting.
Heartbeat-only responses (
HEARTBEAT_OK
with no real content) are not delivered.
If the isolated run already sent a message to the same target via the message tool, delivery is
skipped to avoid duplicates.
Missing or invalid delivery targets fail the job unless
delivery.bestEffort = true
A short summary is posted to the main session only when
delivery.mode = "announce"
The main-session summary respects
wakeMode
now
triggers an immediate heartbeat and
next-heartbeat
waits for the next scheduled heartbeat.
Model and thinking overrides
Isolated jobs (
agentTurn
) can override the model and thinking level:
model
: Provider/model string (e.g.,
anthropic/claude-sonnet-4-20250514
) or alias (e.g.,
opus
thinking
: Thinking level (
off
minimal
low
medium
high
xhigh
; GPT-5.2 + Codex models only)
Note: You can set
model
on main-session jobs too, but it changes the shared main
session model. We recommend model overrides only for isolated jobs to avoid
unexpected context shifts.
Resolution priority:
Job payload override (highest)
Hook-specific defaults (e.g.,
hooks.gmail.model
Agent config default
Delivery (channel + target)
Isolated jobs can deliver output to a channel via the top-level
delivery
config:
delivery.mode
announce
(deliver a summary) or
none
delivery.channel
whatsapp
telegram
discord
slack
mattermost
(plugin) /
signal
imessage
last
delivery.to
: channel-specific recipient target.
Delivery config is only valid for isolated jobs (
sessionTarget: "isolated"
delivery.channel
delivery.to
is omitted, cron can fall back to the main session’s
“last route” (the last place the agent replied).
Target format reminders:
Slack/Discord/Mattermost (plugin) targets should use explicit prefixes (e.g.
channel:<id>
user:<id>
) to avoid ambiguity.
Telegram topics should use the
:topic:
form (see below).
Telegram delivery targets (topics / forum threads)
Telegram supports forum topics via
message_thread_id
. For cron delivery, you can encode
the topic/thread into the
field:
-1001234567890
(chat id only)
-1001234567890:topic:123
(preferred: explicit topic marker)
-1001234567890:123
(shorthand: numeric suffix)
Prefixed targets like
telegram:...
telegram:group:...
are also accepted:
telegram:group:-1001234567890:topic:123
JSON schema for tool calls
Use these shapes when calling Gateway
cron.*
tools directly (agent tool calls or RPC).
CLI flags accept human durations like
20m
, but tool calls should use an ISO 8601 string
for
schedule.at
and milliseconds for
schedule.everyMs
cron.add params
One-shot, main session job (system event):
"name"
"Reminder"
"schedule"
"kind"
"at"
"at"
"2026-02-01T16:00:00Z"
"sessionTarget"
"main"
"wakeMode"
"now"
"payload"
"kind"
"systemEvent"
"text"
"Reminder text"
"deleteAfterRun"
true
Recurring, isolated job with delivery:
"name"
"Morning brief"
"schedule"
"kind"
"cron"
"expr"
"0 7 * * *"
"tz"
"America/Los_Angeles"
"sessionTarget"
"isolated"
"wakeMode"
"next-heartbeat"
"payload"
"kind"
"agentTurn"
"message"
"Summarize overnight updates."
"delivery"
"mode"
"announce"
"channel"
"slack"
"to"
"channel:C1234567890"
"bestEffort"
true
Notes:
schedule.kind
every
everyMs
), or
cron
expr
, optional
schedule.at
accepts ISO 8601 (timezone optional; treated as UTC when omitted).
everyMs
is milliseconds.
sessionTarget
must be
"main"
"isolated"
and must match
payload.kind
Optional fields:
agentId
description
enabled
notify
deleteAfterRun
(defaults to true for
delivery
wakeMode
defaults to
"now"
when omitted.
cron.update params
"jobId"
"job-123"
"patch"
"enabled"
false
"schedule"
"kind"
"every"
"everyMs"
3600000
Notes:
jobId
is canonical;
is accepted for compatibility.
Use
agentId: null
in the patch to clear an agent binding.
cron.run and cron.remove params
"jobId"
"job-123"
"mode"
"force"
"jobId"
"job-123"
Storage & history
Job store:
~/.openclaw/cron/jobs.json
(Gateway-managed JSON).
Run history:
~/.openclaw/cron/runs/<jobId>.jsonl
(JSONL, auto-pruned).
Override store path:
cron.store
in config.
Configuration
cron
enabled
true
// default true
store
"~/.openclaw/cron/jobs.json"
maxConcurrentRuns
// default 1
webhook
"https://example.invalid/cron-finished"
// optional finished-run webhook endpoint
webhookToken
"replace-with-dedicated-webhook-token"
// optional, do not reuse gateway auth token
Webhook behavior:
The Gateway posts finished run events to
cron.webhook
only when the job has
notify: true
Payload is the cron finished event JSON.
cron.webhookToken
is set, auth header is
Authorization: Bearer <cron.webhookToken>
cron.webhookToken
is not set, no
Authorization
header is sent.
Disable cron entirely:
cron.enabled: false
(config)
OPENCLAW_SKIP_CRON=1
(env)
CLI quickstart
One-shot reminder (UTC ISO, auto-delete after success):
openclaw
cron
add
--name
"Send reminder"
--at
"2026-01-12T18:00:00Z"
--session
main
--system-event
"Reminder: submit expense report."
--wake
now
--delete-after-run
One-shot reminder (main session, wake immediately):
openclaw
cron
add
--name
"Calendar check"
--at
"20m"
--session
main
--system-event
"Next heartbeat: check calendar."
--wake
now
Recurring isolated job (announce to WhatsApp):
openclaw
cron
add
--name
"Morning status"
--cron
"0 7 * * *"
--tz
"America/Los_Angeles"
--session
isolated
--message
"Summarize inbox + calendar for today."
--announce
--channel
whatsapp
--to
"+15551234567"
Recurring isolated job (deliver to a Telegram topic):
openclaw
cron
add
--name
"Nightly summary (topic)"
--cron
"0 22 * * *"
--tz
"America/Los_Angeles"
--session
isolated
--message
"Summarize today; send to the nightly topic."
--announce
--channel
telegram
--to
"-1001234567890:topic:123"
Isolated job with model and thinking override:
openclaw
cron
add
--name
"Deep analysis"
--cron
"0 6 * * 1"
--tz
"America/Los_Angeles"
--session
isolated
--message
"Weekly deep analysis of project progress."
--model
"opus"
--thinking
high
--announce
--channel
whatsapp
--to
"+15551234567"
Agent selection (multi-agent setups):
# Pin a job to agent "ops" (falls back to default if that agent is missing)
openclaw
cron
add
--name
"Ops sweep"
--cron
"0 6 * * *"
--session
isolated
--message
"Check ops queue"
--agent
ops
# Switch or clear the agent on an existing job
openclaw
cron
edit
<
jobI
>
--agent
ops
openclaw
cron
edit
<
jobI
>
--clear-agent
Manual run (force is the default, use
--due
to only run when due):
openclaw
cron
run
<
jobI
>
openclaw
cron
run
<
jobI
>
--due
Edit an existing job (patch fields):
openclaw
cron
edit
<
jobI
>
--message
"Updated prompt"
--model
"opus"
--thinking
low
Run history:
openclaw
cron
runs
--id
<
jobI
>
--limit
Immediate system event without creating a job:
openclaw
system
event
--mode
now
--text
"Next heartbeat: check battery."
Gateway API surface
cron.list
cron.status
cron.add
cron.update
cron.remove
cron.run
(force or due),
cron.runs
For immediate system events without a job, use
openclaw system event
Troubleshooting
“Nothing runs”
Check cron is enabled:
cron.enabled
and
OPENCLAW_SKIP_CRON
Check the Gateway is running continuously (cron runs inside the Gateway process).
For
cron
schedules: confirm timezone (
--tz
) vs the host timezone.
A recurring job keeps delaying after failures
OpenClaw applies exponential retry backoff for recurring jobs after consecutive errors:
30s, 1m, 5m, 15m, then 60m between retries.
Backoff resets automatically after the next successful run.
One-shot (
) jobs disable after a terminal run (
error
, or
skipped
) and do not retry.
Telegram delivers to the wrong place
For forum topics, use
-100…:topic:<id>
so it’s explicit and unambiguous.
If you see
telegram:...
prefixes in logs or stored “last route” targets, that’s normal;
cron delivery accepts them and still parses topic IDs correctly.
Hooks
Cron vs Heartbeat

---
## Automation > Cron Vs Heartbeat

[Source: https://docs.openclaw.ai/automation/cron-vs-heartbeat]

Both heartbeats and cron jobs let you run tasks on a schedule. This guide helps you choose the right mechanism for your use case.
Quick Decision Guide
Use Case
Recommended
Why
Check inbox every 30 min
Heartbeat
Batches with other checks, context-aware
Send daily report at 9am sharp
Cron (isolated)
Exact timing needed
Monitor calendar for upcoming events
Heartbeat
Natural fit for periodic awareness
Run weekly deep analysis
Cron (isolated)
Standalone task, can use different model
Remind me in 20 minutes
Cron (main,
--at
One-shot with precise timing
Background project health check
Heartbeat
Piggybacks on existing cycle
Heartbeat: Periodic Awareness
Heartbeats run in the
main session
at a regular interval (default: 30 min). They’re designed for the agent to check on things and surface anything important.
When to use heartbeat
Multiple periodic checks
: Instead of 5 separate cron jobs checking inbox, calendar, weather, notifications, and project status, a single heartbeat can batch all of these.
Context-aware decisions
: The agent has full main-session context, so it can make smart decisions about what’s urgent vs. what can wait.
Conversational continuity
: Heartbeat runs share the same session, so the agent remembers recent conversations and can follow up naturally.
Low-overhead monitoring
: One heartbeat replaces many small polling tasks.
Heartbeat advantages
Batches multiple checks
: One agent turn can review inbox, calendar, and notifications together.
Reduces API calls
: A single heartbeat is cheaper than 5 isolated cron jobs.
Context-aware
: The agent knows what you’ve been working on and can prioritize accordingly.
Smart suppression
: If nothing needs attention, the agent replies
HEARTBEAT_OK
and no message is delivered.
Natural timing
: Drifts slightly based on queue load, which is fine for most monitoring.
Heartbeat example: HEARTBEAT.md checklist
# Heartbeat checklist
- Check email for urgent messages
- Review calendar for events in next 2 hours
- If a background task finished, summarize results
- If idle for 8+ hours, send a brief check-in
The agent reads this on each heartbeat and handles all items in one turn.
Configuring heartbeat
agents
defaults
heartbeat
every
"30m"
// interval
target
"last"
// where to deliver alerts
activeHours
start
"08:00"
end
"22:00"
// optional
See
Heartbeat
for full configuration.
Cron: Precise Scheduling
Cron jobs run at
exact times
and can run in isolated sessions without affecting main context.
When to use cron
Exact timing required
: “Send this at 9:00 AM every Monday” (not “sometime around 9”).
Standalone tasks
: Tasks that don’t need conversational context.
Different model/thinking
: Heavy analysis that warrants a more powerful model.
One-shot reminders
: “Remind me in 20 minutes” with
--at
Noisy/frequent tasks
: Tasks that would clutter main session history.
External triggers
: Tasks that should run independently of whether the agent is otherwise active.
Cron advantages
Exact timing
: 5-field cron expressions with timezone support.
Session isolation
: Runs in
cron:<jobId>
without polluting main history.
Model overrides
: Use a cheaper or more powerful model per job.
Delivery control
: Isolated jobs default to
announce
(summary); choose
none
as needed.
Immediate delivery
: Announce mode posts directly without waiting for heartbeat.
No agent context needed
: Runs even if main session is idle or compacted.
One-shot support
--at
for precise future timestamps.
Cron example: Daily morning briefing
openclaw
cron
add
--name
"Morning briefing"
--cron
"0 7 * * *"
--tz
"America/New_York"
--session
isolated
--message
"Generate today's briefing: weather, calendar, top emails, news summary."
--model
opus
--announce
--channel
whatsapp
--to
"+15551234567"
This runs at exactly 7:00 AM New York time, uses Opus for quality, and announces a summary directly to WhatsApp.
Cron example: One-shot reminder
openclaw
cron
add
--name
"Meeting reminder"
--at
"20m"
--session
main
--system-event
"Reminder: standup meeting starts in 10 minutes."
--wake
now
--delete-after-run
See
Cron jobs
for full CLI reference.
Decision Flowchart
Does the task need to run at an EXACT time?
YES -> Use cron
NO -> Continue...
Does the task need isolation from main session?
YES -> Use cron (isolated)
NO -> Continue...
Can this task be batched with other periodic checks?
YES -> Use heartbeat (add to HEARTBEAT.md)
NO -> Use cron
Is this a one-shot reminder?
YES -> Use cron with --at
NO -> Continue...
Does it need a different model or thinking level?
YES -> Use cron (isolated) with --model/--thinking
NO -> Use heartbeat
Combining Both
The most efficient setup uses
both
Heartbeat
handles routine monitoring (inbox, calendar, notifications) in one batched turn every 30 minutes.
Cron
handles precise schedules (daily reports, weekly reviews) and one-shot reminders.
Example: Efficient automation setup
HEARTBEAT.md
(checked every 30 min):
# Heartbeat checklist
- Scan inbox for urgent emails
- Check calendar for events in next 2h
- Review any pending tasks
- Light check-in if quiet for 8+ hours
Cron jobs
(precise timing):
# Daily morning briefing at 7am
openclaw
cron
add
--name
"Morning brief"
--cron
"0 7 * * *"
--session
isolated
--message
"..."
--announce
# Weekly project review on Mondays at 9am
openclaw
cron
add
--name
"Weekly review"
--cron
"0 9 * * 1"
--session
isolated
--message
"..."
--model
opus
# One-shot reminder
openclaw
cron
add
--name
"Call back"
--at
"2h"
--session
main
--system-event
"Call back the client"
--wake
now
Lobster: Deterministic workflows with approvals
Lobster is the workflow runtime for
multi-step tool pipelines
that need deterministic execution and explicit approvals.
Use it when the task is more than a single agent turn, and you want a resumable workflow with human checkpoints.
When Lobster fits
Multi-step automation
: You need a fixed pipeline of tool calls, not a one-off prompt.
Approval gates
: Side effects should pause until you approve, then resume.
Resumable runs
: Continue a paused workflow without re-running earlier steps.
How it pairs with heartbeat and cron
Heartbeat/cron
decide
when
a run happens.
Lobster
defines
what steps
happen once the run starts.
For scheduled workflows, use cron or heartbeat to trigger an agent turn that calls Lobster.
For ad-hoc workflows, call Lobster directly.
Operational notes (from the code)
Lobster runs as a
local subprocess
lobster
CLI) in tool mode and returns a
JSON envelope
If the tool returns
needs_approval
, you resume with a
resumeToken
and
approve
flag.
The tool is an
optional plugin
; enable it additively via
tools.alsoAllow: ["lobster"]
(recommended).
If you pass
lobsterPath
, it must be an
absolute path
See
Lobster
for full usage and examples.
Main Session vs Isolated Session
Both heartbeat and cron can interact with the main session, but differently:
Heartbeat
Cron (main)
Cron (isolated)
Session
Main
Main (via system event)
cron:<jobId>
History
Shared
Shared
Fresh each run
Context
Full
Full
None (starts clean)
Model
Main session model
Main session model
Can override
Output
Delivered if not
HEARTBEAT_OK
Heartbeat prompt + event
Announce summary (default)
When to use main session cron
Use
--session main
with
--system-event
when you want:
The reminder/event to appear in main session context
The agent to handle it during the next heartbeat with full context
No separate isolated run
openclaw
cron
add
--name
"Check project"
--every
"4h"
--session
main
--system-event
"Time for a project health check"
--wake
now
When to use isolated cron
Use
--session isolated
when you want:
A clean slate without prior context
Different model or thinking settings
Announce summaries directly to a channel
History that doesn’t clutter main session
openclaw
cron
add
--name
"Deep analysis"
--cron
"0 6 * * 0"
--session
isolated
--message
"Weekly codebase analysis..."
--model
opus
--thinking
high
--announce
Cost Considerations
Mechanism
Cost Profile
Heartbeat
One turn every N minutes; scales with HEARTBEAT.md size
Cron (main)
Adds event to next heartbeat (no isolated turn)
Cron (isolated)
Full agent turn per job; can use cheaper model
Tips
Keep
HEARTBEAT.md
small to minimize token overhead.
Batch similar checks into heartbeat instead of multiple cron jobs.
Use
target: "none"
on heartbeat if you only want internal processing.
Use isolated cron with a cheaper model for routine tasks.
Related
Heartbeat
- full heartbeat configuration
Cron jobs
- full cron CLI and API reference
System
- system events + heartbeat controls
Cron Jobs
Automation Troubleshooting

---
## Automation > Gmail Pubsub

[Source: https://docs.openclaw.ai/automation/gmail-pubsub]

-> OpenClaw webhook.
Prereqs
gcloud
installed and logged in (
install guide
gog
(gogcli) installed and authorized for the Gmail account (
gogcli.sh
OpenClaw hooks enabled (see
Webhooks
tailscale
logged in (
tailscale.com
). Supported setup uses Tailscale Funnel for the public HTTPS endpoint.
Other tunnel services can work, but are DIY/unsupported and require manual wiring.
Right now, Tailscale is what we support.
Example hook config (enable Gmail preset mapping):
hooks
enabled
true
token
"OPENCLAW_HOOK_TOKEN"
path
"/hooks"
presets
"gmail"
To deliver the Gmail summary to a chat surface, override the preset with a mapping
that sets
deliver
+ optional
channel
hooks
enabled
true
token
"OPENCLAW_HOOK_TOKEN"
presets
"gmail"
mappings
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
"New email from {{messages[0].from}}\nSubject: {{messages[0].subject}}\n{{messages[0].snippet}}\n{{messages[0].body}}"
model
"openai/gpt-5.2-mini"
deliver
true
channel
"last"
// to: "+15551234567"
If you want a fixed channel, set
channel
. Otherwise
channel: "last"
uses the last delivery route (falls back to WhatsApp).
To force a cheaper model for Gmail runs, set
model
in the mapping
provider/model
or alias). If you enforce
agents.defaults.models
, include it there.
To set a default model and thinking level specifically for Gmail hooks, add
hooks.gmail.model
hooks.gmail.thinking
in your config:
hooks
gmail
model
"openrouter/meta-llama/llama-3.3-70b-instruct:free"
thinking
"off"
Notes:
Per-hook
model
thinking
in the mapping still overrides these defaults.
Fallback order:
hooks.gmail.model
agents.defaults.model.fallbacks
→ primary (auth/rate-limit/timeouts).
agents.defaults.models
is set, the Gmail model must be in the allowlist.
Gmail hook content is wrapped with external-content safety boundaries by default.
To disable (dangerous), set
hooks.gmail.allowUnsafeExternalContent: true
To customize payload handling further, add
hooks.mappings
or a JS/TS transform module
under
~/.openclaw/hooks/transforms
(see
Webhooks
Wizard (recommended)
Use the OpenClaw helper to wire everything together (installs deps on macOS via brew):
openclaw
webhooks
gmail
setup
--account
[email protected]
Defaults:
Uses Tailscale Funnel for the public push endpoint.
Writes
hooks.gmail
config for
openclaw webhooks gmail run
Enables the Gmail hook preset (
hooks.presets: ["gmail"]
Path note: when
tailscale.mode
is enabled, OpenClaw automatically sets
hooks.gmail.serve.path
and keeps the public path at
hooks.gmail.tailscale.path
(default
/gmail-pubsub
) because Tailscale
strips the set-path prefix before proxying.
If you need the backend to receive the prefixed path, set
hooks.gmail.tailscale.target
(or
--tailscale-target
) to a full URL like
http://127.0.0.1:8788/gmail-pubsub
and match
hooks.gmail.serve.path
Want a custom endpoint? Use
--push-endpoint <url>
--tailscale off
Platform note: on macOS the wizard installs
gcloud
gogcli
, and
tailscale
via Homebrew; on Linux install them manually first.
Gateway auto-start (recommended):
When
hooks.enabled=true
and
hooks.gmail.account
is set, the Gateway starts
gog gmail watch serve
on boot and auto-renews the watch.
Set
OPENCLAW_SKIP_GMAIL_WATCHER=1
to opt out (useful if you run the daemon yourself).
Do not run the manual daemon at the same time, or you will hit
listen tcp 127.0.0.1:8788: bind: address already in use
Manual daemon (starts
gog gmail watch serve
+ auto-renew):
openclaw
webhooks
gmail
run
One-time setup
Select the GCP project
that owns the OAuth client
used by
gog
gcloud
auth
login
gcloud
config
set
project
<
project-i
>
Note: Gmail watch requires the Pub/Sub topic to live in the same project as the OAuth client.
Enable APIs:
gcloud
services
enable
gmail.googleapis.com
pubsub.googleapis.com
Create a topic:
gcloud
pubsub
topics
create
gog-gmail-watch
Allow Gmail push to publish:
gcloud
pubsub
topics
add-iam-policy-binding
gog-gmail-watch
--member=serviceAccount:
[email protected]
--role=roles/pubsub.publisher
Start the watch
gog
gmail
watch
start
--account
[email protected]
--label
INBOX
--topic
projects/
<
project-i
>
/topics/gog-gmail-watch
Save the
history_id
from the output (for debugging).
Run the push handler
Local example (shared token auth):
gog
gmail
watch
serve
--account
[email protected]
--bind
127.0.0.1
--port
8788
--path
/gmail-pubsub
--token
<
share
>
--hook-url
http://127.0.0.1:18789/hooks/gmail
--hook-token
OPENCLAW_HOOK_TOKEN
--include-body
--max-bytes
20000
Notes:
--token
protects the push endpoint (
x-gog-token
?token=
--hook-url
points to OpenClaw
/hooks/gmail
(mapped; isolated run + summary to main).
--include-body
and
--max-bytes
control the body snippet sent to OpenClaw.
Recommended:
openclaw webhooks gmail run
wraps the same flow and auto-renews the watch.
Expose the handler (advanced, unsupported)
If you need a non-Tailscale tunnel, wire it manually and use the public URL in the push
subscription (unsupported, no guardrails):
cloudflared
tunnel
--url
http://127.0.0.1:8788
--no-autoupdate
Use the generated URL as the push endpoint:
gcloud
pubsub
subscriptions
create
gog-gmail-watch-push
--topic
gog-gmail-watch
--push-endpoint
"https://<public-url>/gmail-pubsub?token=<shared>"
Production: use a stable HTTPS endpoint and configure Pub/Sub OIDC JWT, then run:
gog
gmail
watch
serve
--verify-oidc
--oidc-email
<
svc@..
>
Test
Send a message to the watched inbox:
gog
gmail
send
--account
[email protected]
--to
[email protected]
--subject
"watch test"
--body
"ping"
Check watch state and history:
gog
gmail
watch
status
--account
[email protected]
gog
gmail
history
--account
[email protected]
--since
<
historyI
>
Troubleshooting
Invalid topicName
: project mismatch (topic not in the OAuth client project).
User not authorized
: missing
roles/pubsub.publisher
on the topic.
Empty messages: Gmail push only provides
historyId
; fetch via
gog gmail history
Cleanup
gog
gmail
watch
stop
--account
[email protected]
gcloud
pubsub
subscriptions
delete
gog-gmail-watch-push
gcloud
pubsub
topics
delete
gog-gmail-watch
Webhooks
Polls

---
## Automation > Hooks

[Source: https://docs.openclaw.ai/automation/hooks]

Hooks provide an extensible event-driven system for automating actions in response to agent commands and events. Hooks are automatically discovered from directories and can be managed via CLI commands, similar to how skills work in OpenClaw.
Getting Oriented
Hooks are small scripts that run when something happens. There are two kinds:
Hooks
(this page): run inside the Gateway when agent events fire, like
/new
/reset
/stop
, or lifecycle events.
Webhooks
: external HTTP webhooks that let other systems trigger work in OpenClaw. See
Webhook Hooks
or use
openclaw webhooks
for Gmail helper commands.
Hooks can also be bundled inside plugins; see
Plugins
Common uses:
Save a memory snapshot when you reset a session
Keep an audit trail of commands for troubleshooting or compliance
Trigger follow-up automation when a session starts or ends
Write files into the agent workspace or call external APIs when events fire
If you can write a small TypeScript function, you can write a hook. Hooks are discovered automatically, and you enable or disable them via the CLI.
Overview
The hooks system allows you to:
Save session context to memory when
/new
is issued
Log all commands for auditing
Trigger custom automations on agent lifecycle events
Extend OpenClaw’s behavior without modifying core code
Getting Started
Bundled Hooks
OpenClaw ships with four bundled hooks that are automatically discovered:
💾 session-memory
: Saves session context to your agent workspace (default
~/.openclaw/workspace/memory/
) when you issue
/new
📎 bootstrap-extra-files
: Injects additional workspace bootstrap files from configured glob/path patterns during
agent:bootstrap
📝 command-logger
: Logs all command events to
~/.openclaw/logs/commands.log
🚀 boot-md
: Runs
BOOT.md
when the gateway starts (requires internal hooks enabled)
List available hooks:
openclaw
hooks
list
Enable a hook:
openclaw
hooks
enable
session-memory
Check hook status:
openclaw
hooks
check
Get detailed information:
openclaw
hooks
info
session-memory
Onboarding
During onboarding (
openclaw onboard
), you’ll be prompted to enable recommended hooks. The wizard automatically discovers eligible hooks and presents them for selection.
Hook Discovery
Hooks are automatically discovered from three directories (in order of precedence):
Workspace hooks
<workspace>/hooks/
(per-agent, highest precedence)
Managed hooks
~/.openclaw/hooks/
(user-installed, shared across workspaces)
Bundled hooks
<openclaw>/dist/hooks/bundled/
(shipped with OpenClaw)
Managed hook directories can be either a
single hook
or a
hook pack
(package directory).
Each hook is a directory containing:
my-hook/
├── HOOK.md # Metadata + documentation
└── handler.ts # Handler implementation
Hook Packs (npm/archives)
Hook packs are standard npm packages that export one or more hooks via
openclaw.hooks
package.json
. Install them with:
openclaw
hooks
install
<
path-or-spe
>
Npm specs are registry-only (package name + optional version/tag). Git/URL/file specs are rejected.
Example
package.json
"name"
"@acme/my-hooks"
"version"
"0.1.0"
"openclaw"
"hooks"
"./hooks/my-hook"
"./hooks/other-hook"
Each entry points to a hook directory containing
HOOK.md
and
handler.ts
(or
index.ts
Hook packs can ship dependencies; they will be installed under
~/.openclaw/hooks/<id>
Security note:
openclaw hooks install
installs dependencies with
npm install --ignore-scripts
(no lifecycle scripts). Keep hook pack dependency trees “pure JS/TS” and avoid packages that rely
postinstall
builds.
Hook Structure
HOOK.md Format
The
HOOK.md
file contains metadata in YAML frontmatter plus Markdown documentation:
---
name
my-hook
description
"Short description of what this hook does"
homepage
https://docs.openclaw.ai/automation/hooks#my-hook
metadata
"openclaw"
"emoji"
"🔗"
"events"
"command:new"
"requires"
"bins"
"node"
] } } }
---
# My Hook
Detailed documentation goes here...
## What It Does
- Listens for
`/new`
commands
- Performs some action
- Logs the result
## Requirements
- Node.js must be installed
## Configuration
No configuration needed.
Metadata Fields
The
metadata.openclaw
object supports:
emoji
: Display emoji for CLI (e.g.,
"💾"
events
: Array of events to listen for (e.g.,
["command:new", "command:reset"]
export
: Named export to use (defaults to
"default"
homepage
: Documentation URL
requires
: Optional requirements
bins
: Required binaries on PATH (e.g.,
["git", "node"]
anyBins
: At least one of these binaries must be present
env
: Required environment variables
config
: Required config paths (e.g.,
["workspace.dir"]
: Required platforms (e.g.,
["darwin", "linux"]
always
: Bypass eligibility checks (boolean)
install
: Installation methods (for bundled hooks:
[{"id":"bundled","kind":"bundled"}]
Handler Implementation
The
handler.ts
file exports a
HookHandler
function:
import
type
{ HookHandler }
from
"../../src/hooks/hooks.js"
const
myHandler
HookHandler
async
(event)
=>
// Only trigger on 'new' command
event
.type
!==
"command"
event
.action
!==
"new"
) {
return
console
.log
`[my-hook] New command triggered`
console
.log
` Session:
event
.sessionKey
console
.log
` Timestamp:
event
timestamp
.toISOString
// Your custom logic here
// Optionally send message to user
event
messages
.push
"✨ My hook executed!"
export
default
myHandler;
Event Context
Each event includes:
type
'command'
'session'
'agent'
'gateway'
action
string
// e.g., 'new', 'reset', 'stop'
sessionKey
string
// Session identifier
timestamp
Date
// When the event occurred
messages
string[]
// Push messages here to send to user
context
sessionEntry
SessionEntry
sessionId
string
sessionFile
string
commandSource
string
// e.g., 'whatsapp', 'telegram'
senderId
string
workspaceDir
string
bootstrapFiles
WorkspaceBootstrapFile[]
cfg
OpenClawConfig
Event Types
Command Events
Triggered when agent commands are issued:
command
: All command events (general listener)
command:new
: When
/new
command is issued
command:reset
: When
/reset
command is issued
command:stop
: When
/stop
command is issued
Agent Events
agent:bootstrap
: Before workspace bootstrap files are injected (hooks may mutate
context.bootstrapFiles
Gateway Events
Triggered when the gateway starts:
gateway:startup
: After channels start and hooks are loaded
Tool Result Hooks (Plugin API)
These hooks are not event-stream listeners; they let plugins synchronously adjust tool results before OpenClaw persists them.
tool_result_persist
: transform tool results before they are written to the session transcript. Must be synchronous; return the updated tool result payload or
undefined
to keep it as-is. See
Agent Loop
Future Events
Planned event types:
session:start
: When a new session begins
session:end
: When a session ends
agent:error
: When an agent encounters an error
message:sent
: When a message is sent
message:received
: When a message is received
Creating Custom Hooks
1. Choose Location
Workspace hooks
<workspace>/hooks/
): Per-agent, highest precedence
Managed hooks
~/.openclaw/hooks/
): Shared across workspaces
2. Create Directory Structure
mkdir
~/.openclaw/hooks/my-hook
~/.openclaw/hooks/my-hook
3. Create HOOK.md
---
name
my-hook
description
"Does something useful"
metadata
"openclaw"
"emoji"
"🎯"
"events"
"command:new"
] } }
---
# My Custom Hook
This hook does something useful when you issue
`/new`
4. Create handler.ts
import
type
{ HookHandler }
from
"../../src/hooks/hooks.js"
const
handler
HookHandler
async
(event)
=>
event
.type
!==
"command"
event
.action
!==
"new"
) {
return
console
.log
"[my-hook] Running!"
// Your logic here
export
default
handler;
5. Enable and Test
# Verify hook is discovered
openclaw
hooks
list
# Enable it
openclaw
hooks
enable
my-hook
# Restart your gateway process (menu bar app restart on macOS, or restart your dev process)
# Trigger the event
# Send /new via your messaging channel
Configuration
New Config Format (Recommended)
"hooks"
"internal"
"enabled"
true
"entries"
"session-memory"
"enabled"
true
"command-logger"
"enabled"
false
Per-Hook Configuration
Hooks can have custom configuration:
"hooks"
"internal"
"enabled"
true
"entries"
"my-hook"
"enabled"
true
"env"
"MY_CUSTOM_VAR"
"value"
Extra Directories
Load hooks from additional directories:
"hooks"
"internal"
"enabled"
true
"load"
"extraDirs"
"/path/to/more/hooks"
Legacy Config Format (Still Supported)
The old config format still works for backwards compatibility:
"hooks"
"internal"
"enabled"
true
"handlers"
"event"
"command:new"
"module"
"./hooks/handlers/my-handler.ts"
"export"
"default"
Note:
module
must be a workspace-relative path. Absolute paths and traversal outside the workspace are rejected.
Migration
: Use the new discovery-based system for new hooks. Legacy handlers are loaded after directory-based hooks.
CLI Commands
List Hooks
# List all hooks
openclaw
hooks
list
# Show only eligible hooks
openclaw
hooks
list
--eligible
# Verbose output (show missing requirements)
openclaw
hooks
list
--verbose
# JSON output
openclaw
hooks
list
--json
Hook Information
# Show detailed info about a hook
openclaw
hooks
info
session-memory
# JSON output
openclaw
hooks
info
session-memory
--json
Check Eligibility
# Show eligibility summary
openclaw
hooks
check
# JSON output
openclaw
hooks
check
--json
Enable/Disable
# Enable a hook
openclaw
hooks
enable
session-memory
# Disable a hook
openclaw
hooks
disable
command-logger
Bundled hook reference
session-memory
Saves session context to memory when you issue
/new
Events
command:new
Requirements
workspace.dir
must be configured
Output
<workspace>/memory/YYYY-MM-DD-slug.md
(defaults to
~/.openclaw/workspace
What it does
Uses the pre-reset session entry to locate the correct transcript
Extracts the last 15 lines of conversation
Uses LLM to generate a descriptive filename slug
Saves session metadata to a dated memory file
Example output
# Session: 2026-01-16 14:30:00 UTC
**Session Key**
: agent:main:main
**Session ID**
: abc123def456
**Source**
: telegram
Filename examples
2026-01-16-vendor-pitch.md
2026-01-16-api-design.md
2026-01-16-1430.md
(fallback timestamp if slug generation fails)
Enable
openclaw
hooks
enable
session-memory
bootstrap-extra-files
Injects additional bootstrap files (for example monorepo-local
AGENTS.md
TOOLS.md
) during
agent:bootstrap
Events
agent:bootstrap
Requirements
workspace.dir
must be configured
Output
: No files written; bootstrap context is modified in-memory only.
Config
"hooks"
"internal"
"enabled"
true
"entries"
"bootstrap-extra-files"
"enabled"
true
"paths"
"packages/*/AGENTS.md"
"packages/*/TOOLS.md"
Notes
Paths are resolved relative to workspace.
Files must stay inside workspace (realpath-checked).
Only recognized bootstrap basenames are loaded.
Subagent allowlist is preserved (
AGENTS.md
and
TOOLS.md
only).
Enable
openclaw
hooks
enable
bootstrap-extra-files
command-logger
Logs all command events to a centralized audit file.
Events
command
Requirements
: None
Output
~/.openclaw/logs/commands.log
What it does
Captures event details (command action, timestamp, session key, sender ID, source)
Appends to log file in JSONL format
Runs silently in the background
Example log entries
"timestamp"
"2026-01-16T14:30:00.000Z"
"action"
"new"
"sessionKey"
"agent:main:main"
"senderId"
"+1234567890"
"source"
"telegram"
"timestamp"
"2026-01-16T15:45:22.000Z"
"action"
"stop"
"sessionKey"
"agent:main:main"
"senderId"
"
[email protected]
"
"source"
"whatsapp"
View logs
# View recent commands
tail
~/.openclaw/logs/commands.log
# Pretty-print with jq
cat
~/.openclaw/logs/commands.log
# Filter by action
grep
'"action":"new"'
~/.openclaw/logs/commands.log
Enable
openclaw
hooks
enable
command-logger
boot-md
Runs
BOOT.md
when the gateway starts (after channels start).
Internal hooks must be enabled for this to run.
Events
gateway:startup
Requirements
workspace.dir
must be configured
What it does
Reads
BOOT.md
from your workspace
Runs the instructions via the agent runner
Sends any requested outbound messages via the message tool
Enable
openclaw
hooks
enable
boot-md
Best Practices
Keep Handlers Fast
Hooks run during command processing. Keep them lightweight:
// ✓ Good - async work, returns immediately
const
handler
HookHandler
async
(event)
=>
void
processInBackground
(event);
// Fire and forget
// ✗ Bad - blocks command processing
const
handler
HookHandler
async
(event)
=>
await
slowDatabaseQuery
(event);
await
evenSlowerAPICall
(event);
Handle Errors Gracefully
Always wrap risky operations:
const
handler
HookHandler
async
(event)
=>
try
await
riskyOperation
(event);
catch
(err) {
console
.error
"[my-handler] Failed:"
err
instanceof
Error
err
.message
String
(err));
// Don't throw - let other handlers run
Filter Events Early
Return early if the event isn’t relevant:
const
handler
HookHandler
async
(event)
=>
// Only handle 'new' commands
event
.type
!==
"command"
event
.action
!==
"new"
) {
return
// Your logic here
Use Specific Event Keys
Specify exact events in metadata when possible:
metadata
"openclaw"
"events"
"command:new"
] } }
# Specific
Rather than:
metadata
"openclaw"
"events"
"command"
] } }
# General - more overhead
Debugging
Enable Hook Logging
The gateway logs hook loading at startup:
Registered hook: session-memory -> command:new
Registered hook: bootstrap-extra-files -> agent:bootstrap
Registered hook: command-logger -> command
Registered hook: boot-md -> gateway:startup
Check Discovery
List all discovered hooks:
openclaw
hooks
list
--verbose
Check Registration
In your handler, log when it’s called:
const
handler
HookHandler
async
(event)
=>
console
.log
"[my-handler] Triggered:"
event
.type
event
.action);
// Your logic
Verify Eligibility
Check why a hook isn’t eligible:
openclaw
hooks
info
my-hook
Look for missing requirements in the output.
Testing
Gateway Logs
Monitor gateway logs to see hook execution:
# macOS
./scripts/clawlog.sh
# Other platforms
tail
~/.openclaw/gateway.log
Test Hooks Directly
Test your handlers in isolation:
import
{ test }
from
"vitest"
import
{ createHookEvent }
from
"./src/hooks/hooks.js"
import
myHandler
from
"./hooks/my-hook/handler.js"
test
"my handler works"
async
=>
const
event
createHookEvent
"command"
"new"
"test-session"
foo
"bar"
});
await
myHandler
(event);
// Assert side effects
});
Architecture
Core Components
src/hooks/types.ts
: Type definitions
src/hooks/workspace.ts
: Directory scanning and loading
src/hooks/frontmatter.ts
: HOOK.md metadata parsing
src/hooks/config.ts
: Eligibility checking
src/hooks/hooks-status.ts
: Status reporting
src/hooks/loader.ts
: Dynamic module loader
src/cli/hooks-cli.ts
: CLI commands
src/gateway/server-startup.ts
: Loads hooks at gateway start
src/auto-reply/reply/commands-core.ts
: Triggers command events
Discovery Flow
Gateway startup
Scan directories (workspace → managed → bundled)
Parse HOOK.md files
Check eligibility (bins, env, config, os)
Load handlers from eligible hooks
Register handlers for events
Event Flow
User sends /new
Command validation
Create hook event
Trigger hook (all registered handlers)
Command processing continues
Session reset
Troubleshooting
Hook Not Discovered
Check directory structure:
-la
~/.openclaw/hooks/my-hook/
# Should show: HOOK.md, handler.ts
Verify HOOK.md format:
cat
~/.openclaw/hooks/my-hook/HOOK.md
# Should have YAML frontmatter with name and metadata
List all discovered hooks:
openclaw
hooks
list
Hook Not Eligible
Check requirements:
openclaw
hooks
info
my-hook
Look for missing:
Binaries (check PATH)
Environment variables
Config values
OS compatibility
Hook Not Executing
Verify hook is enabled:
openclaw
hooks
list
# Should show ✓ next to enabled hooks
Restart your gateway process so hooks reload.
Check gateway logs for errors:
./scripts/clawlog.sh
grep
hook
Handler Errors
Check for TypeScript/import errors:
# Test import directly
node
"import('./path/to/handler.ts').then(console.log)"
Migration Guide
From Legacy Config to Discovery
Before
"hooks"
"internal"
"enabled"
true
"handlers"
"event"
"command:new"
"module"
"./hooks/handlers/my-handler.ts"
After
Create hook directory:
mkdir
~/.openclaw/hooks/my-hook
./hooks/handlers/my-handler.ts
~/.openclaw/hooks/my-hook/handler.ts
Create HOOK.md:
---
name
my-hook
description
"My custom hook"
metadata
"openclaw"
"emoji"
"🎯"
"events"
"command:new"
] } }
---
# My Hook
Does something useful.
Update config:
"hooks"
"internal"
"enabled"
true
"entries"
"my-hook"
"enabled"
true
Verify and restart your gateway process:
openclaw
hooks
list
# Should show: 🎯 my-hook ✓
Benefits of migration
Automatic discovery
CLI management
Eligibility checking
Better documentation
Consistent structure
See Also
CLI Reference: hooks
Bundled Hooks README
Webhook Hooks
Configuration
Zalo Personal Plugin
Cron Jobs

---
## Automation > Poll

[Source: https://docs.openclaw.ai/automation/poll]

# WhatsApp
openclaw
message
poll
--target
+15555550123
--poll-question
"Lunch today?"
--poll-option
"Yes"
--poll-option
"No"
--poll-option
"Maybe"
openclaw
message
poll
--target
[email protected]
--poll-question
"Meeting time?"
--poll-option
"10am"
--poll-option
"2pm"
--poll-option
"4pm"
--poll-multi
# Discord
openclaw
message
poll
--channel
discord
--target
channel:123456789
--poll-question
"Snack?"
--poll-option
"Pizza"
--poll-option
"Sushi"
openclaw
message
poll
--channel
discord
--target
channel:123456789
--poll-question
"Plan?"
--poll-option
"A"
--poll-option
"B"
--poll-duration-hours
# MS Teams
openclaw
message
poll
--channel
msteams
--target
conversation:19:
[email protected]
--poll-question
"Lunch?"
--poll-option
"Pizza"
--poll-option
"Sushi"
Options:
--channel
whatsapp
(default),
discord
, or
msteams
--poll-multi
: allow selecting multiple options
--poll-duration-hours
: Discord-only (defaults to 24 when omitted)
Gateway RPC
Method:
poll
Params:
(string, required)
question
(string, required)
options
(string[], required)
maxSelections
(number, optional)
durationHours
(number, optional)
channel
(string, optional, default:
whatsapp
idempotencyKey
(string, required)
Channel differences
WhatsApp: 2-12 options,
maxSelections
must be within option count, ignores
durationHours
Discord: 2-10 options,
durationHours
clamped to 1-768 hours (default 24).
maxSelections > 1
enables multi-select; Discord does not support a strict selection count.
MS Teams: Adaptive Card polls (OpenClaw-managed). No native poll API;
durationHours
is ignored.
Agent tool (Message)
Use the
message
tool with
poll
action (
pollQuestion
pollOption
, optional
pollMulti
pollDurationHours
channel
Note: Discord has no “pick exactly N” mode;
pollMulti
maps to multi-select.
Teams polls are rendered as Adaptive Cards and require the gateway to stay online
to record votes in
~/.openclaw/msteams-polls.json
Gmail PubSub
Auth Monitoring

---
## Automation > Troubleshooting

[Source: https://docs.openclaw.ai/automation/troubleshooting]

--follow
openclaw
doctor
openclaw
channels
status
--probe
Then run automation checks:
openclaw
cron
status
openclaw
cron
list
openclaw
system
heartbeat
last
Cron not firing
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
logs
--follow
Good output looks like:
cron status
reports enabled and a future
nextWakeAtMs
Job is enabled and has a valid schedule/timezone.
cron runs
shows
or explicit skip reason.
Common signatures:
cron: scheduler disabled; jobs will not run automatically
→ cron disabled in config/env.
cron: timer tick failed
→ scheduler tick crashed; inspect surrounding stack/log context.
reason: not-due
in run output → manual run called without
--force
and job not due yet.
Cron fired but no delivery
openclaw
cron
runs
--id
<
jobI
>
--limit
openclaw
cron
list
openclaw
channels
status
--probe
openclaw
logs
--follow
Good output looks like:
Run status is
Delivery mode/target are set for isolated jobs.
Channel probe reports target channel connected.
Common signatures:
Run succeeded but delivery mode is
none
→ no external message is expected.
Delivery target missing/invalid (
channel
) → run may succeed internally but skip outbound.
Channel auth errors (
unauthorized
missing_scope
Forbidden
) → delivery blocked by channel credentials/permissions.
Heartbeat suppressed or skipped
openclaw
system
heartbeat
last
openclaw
logs
--follow
openclaw
config
get
agents.defaults.heartbeat
openclaw
channels
status
--probe
Good output looks like:
Heartbeat enabled with non-zero interval.
Last heartbeat result is
ran
(or skip reason is understood).
Common signatures:
heartbeat skipped
with
reason=quiet-hours
→ outside
activeHours
requests-in-flight
→ main lane busy; heartbeat deferred.
empty-heartbeat-file
HEARTBEAT.md
exists but has no actionable content.
alerts-disabled
→ visibility settings suppress outbound heartbeat messages.
Timezone and activeHours gotchas
openclaw
config
get
agents.defaults.heartbeat.activeHours
openclaw
config
get
agents.defaults.heartbeat.activeHours.timezone
openclaw
config
get
agents.defaults.userTimezone
echo
"agents.defaults.userTimezone not set"
openclaw
cron
list
openclaw
logs
--follow
Quick rules:
Config path not found: agents.defaults.userTimezone
means the key is unset; heartbeat falls back to host timezone (or
activeHours.timezone
if set).
Cron without
--tz
uses gateway host timezone.
Heartbeat
activeHours
uses configured timezone resolution (
user
local
, or explicit IANA tz).
ISO timestamps without timezone are treated as UTC for cron
schedules.
Common signatures:
Jobs run at the wrong wall-clock time after host timezone changes.
Heartbeat always skipped during your daytime because
activeHours.timezone
is wrong.
Related:
/automation/cron-jobs
/gateway/heartbeat
/automation/cron-vs-heartbeat
/concepts/timezone
Cron vs Heartbeat
Webhooks

---
## Automation > Webhook

[Source: https://docs.openclaw.ai/automation/webhook]

Gateway can expose a small HTTP webhook endpoint for external triggers.
Enable
hooks
enabled
true
token
"shared-secret"
path
"/hooks"
// Optional: restrict explicit `agentId` routing to this allowlist.
// Omit or include "*" to allow any agent.
// Set [] to deny all explicit `agentId` routing.
allowedAgentIds
"hooks"
"main"
Notes:
hooks.token
is required when
hooks.enabled=true
hooks.path
defaults to
/hooks
Auth
Every request must include the hook token. Prefer headers:
Authorization: Bearer <token>
(recommended)
x-openclaw-token: <token>
Query-string tokens are rejected (
?token=...
returns
400
Endpoints
POST /hooks/wake
Payload:
"text"
"System line"
"mode"
"now"
text
required
(string): The description of the event (e.g., “New email received”).
mode
optional (
now
next-heartbeat
): Whether to trigger an immediate heartbeat (default
now
) or wait for the next periodic check.
Effect:
Enqueues a system event for the
main
session
mode=now
, triggers an immediate heartbeat
POST /hooks/agent
Payload:
"message"
"Run this"
"name"
"Email"
"agentId"
"hooks"
"sessionKey"
"hook:email:msg-123"
"wakeMode"
"now"
"deliver"
true
"channel"
"last"
"to"
"+15551234567"
"model"
"openai/gpt-5.2-mini"
"thinking"
"low"
"timeoutSeconds"
120
message
required
(string): The prompt or message for the agent to process.
name
optional (string): Human-readable name for the hook (e.g., “GitHub”), used as a prefix in session summaries.
agentId
optional (string): Route this hook to a specific agent. Unknown IDs fall back to the default agent. When set, the hook runs using the resolved agent’s workspace and configuration.
sessionKey
optional (string): The key used to identify the agent’s session. By default this field is rejected unless
hooks.allowRequestSessionKey=true
wakeMode
optional (
now
next-heartbeat
): Whether to trigger an immediate heartbeat (default
now
) or wait for the next periodic check.
deliver
optional (boolean): If
true
, the agent’s response will be sent to the messaging channel. Defaults to
true
. Responses that are only heartbeat acknowledgments are automatically skipped.
channel
optional (string): The messaging channel for delivery. One of:
last
whatsapp
telegram
discord
slack
mattermost
(plugin),
signal
imessage
msteams
. Defaults to
last
optional (string): The recipient identifier for the channel (e.g., phone number for WhatsApp/Signal, chat ID for Telegram, channel ID for Discord/Slack/Mattermost (plugin), conversation ID for MS Teams). Defaults to the last recipient in the main session.
model
optional (string): Model override (e.g.,
anthropic/claude-3-5-sonnet
or an alias). Must be in the allowed model list if restricted.
thinking
optional (string): Thinking level override (e.g.,
low
medium
high
timeoutSeconds
optional (number): Maximum duration for the agent run in seconds.
Effect:
Runs an
isolated
agent turn (own session key)
Always posts a summary into the
main
session
wakeMode=now
, triggers an immediate heartbeat
Session key policy (breaking change)
/hooks/agent
payload
sessionKey
overrides are disabled by default.
Recommended: set a fixed
hooks.defaultSessionKey
and keep request overrides off.
Optional: allow request overrides only when needed, and restrict prefixes.
Recommended config:
hooks
enabled
true
token
"${OPENCLAW_HOOKS_TOKEN}"
defaultSessionKey
"hook:ingress"
allowRequestSessionKey
false
allowedSessionKeyPrefixes
"hook:"
Compatibility config (legacy behavior):
hooks
enabled
true
token
"${OPENCLAW_HOOKS_TOKEN}"
allowRequestSessionKey
true
allowedSessionKeyPrefixes
"hook:"
// strongly recommended
POST /hooks/<name>
(mapped)
Custom hook names are resolved via
hooks.mappings
(see configuration). A mapping can
turn arbitrary payloads into
wake
agent
actions, with optional templates or
code transforms.
Mapping options (summary):
hooks.presets: ["gmail"]
enables the built-in Gmail mapping.
hooks.mappings
lets you define
match
action
, and templates in config.
hooks.transformsDir
transform.module
loads a JS/TS module for custom logic.
hooks.transformsDir
(if set) must stay within the transforms root under your OpenClaw config directory (typically
~/.openclaw/hooks/transforms
transform.module
must resolve within the effective transforms directory (traversal/escape paths are rejected).
Use
match.source
to keep a generic ingest endpoint (payload-driven routing).
TS transforms require a TS loader (e.g.
bun
tsx
) or precompiled
.js
at runtime.
Set
deliver: true
channel
on mappings to route replies to a chat surface
channel
defaults to
last
and falls back to WhatsApp).
agentId
routes the hook to a specific agent; unknown IDs fall back to the default agent.
hooks.allowedAgentIds
restricts explicit
agentId
routing. Omit it (or include
) to allow any agent. Set
to deny explicit
agentId
routing.
hooks.defaultSessionKey
sets the default session for hook agent runs when no explicit key is provided.
hooks.allowRequestSessionKey
controls whether
/hooks/agent
payloads may set
sessionKey
(default:
false
hooks.allowedSessionKeyPrefixes
optionally restricts explicit
sessionKey
values from request payloads and mappings.
allowUnsafeExternalContent: true
disables the external content safety wrapper for that hook
(dangerous; only for trusted internal sources).
openclaw webhooks gmail setup
writes
hooks.gmail
config for
openclaw webhooks gmail run
See
Gmail Pub/Sub
for the full Gmail watch flow.
Responses
200
for
/hooks/wake
202
for
/hooks/agent
(async run started)
401
on auth failure
429
after repeated auth failures from the same client (check
Retry-After
400
on invalid payload
413
on oversized payloads
Examples
curl
POST
http://127.0.0.1:18789/hooks/wake
'Authorization: Bearer SECRET'
'Content-Type: application/json'
'{"text":"New email received","mode":"now"}'
curl
POST
http://127.0.0.1:18789/hooks/agent
'x-openclaw-token: SECRET'
'Content-Type: application/json'
'{"message":"Summarize inbox","name":"Email","wakeMode":"next-heartbeat"}'
Use a different model
Add
model
to the agent payload (or mapping) to override the model for that run:
curl
POST
http://127.0.0.1:18789/hooks/agent
'x-openclaw-token: SECRET'
'Content-Type: application/json'
'{"message":"Summarize inbox","name":"Email","model":"openai/gpt-5.2-mini"}'
If you enforce
agents.defaults.models
, make sure the override model is included there.
curl
POST
http://127.0.0.1:18789/hooks/gmail
'Authorization: Bearer SECRET'
'Content-Type: application/json'
'{"source":"gmail","messages":[{"from":"Ada","subject":"Hello","snippet":"Hi"}]}'
Security
Keep hook endpoints behind loopback, tailnet, or trusted reverse proxy.
Use a dedicated hook token; do not reuse gateway auth tokens.
Repeated auth failures are rate-limited per client address to slow brute-force attempts.
If you use multi-agent routing, set
hooks.allowedAgentIds
to limit explicit
agentId
selection.
Keep
hooks.allowRequestSessionKey=false
unless you require caller-selected sessions.
If you enable request
sessionKey
, restrict
hooks.allowedSessionKeyPrefixes
(for example,
["hook:"]
Avoid including sensitive raw payloads in webhook logs.
Hook payloads are treated as untrusted and wrapped with safety boundaries by default.
If you must disable this for a specific hook, set
allowUnsafeExternalContent: true
in that hook’s mapping (dangerous).
Automation Troubleshooting
Gmail PubSub
