# OpenClaw Plugins & Extensions

Plugin development, voice call, Zalo personal, experiments.

---
## Plugins > Voice Call

[Source: https://docs.openclaw.ai/plugins/voice-call]

Voice calls for OpenClaw via a plugin. Supports outbound notifications and
multi-turn conversations with inbound policies.
Current providers:
twilio
(Programmable Voice + Media Streams)
telnyx
(Call Control v2)
plivo
(Voice API + XML transfer + GetInput speech)
mock
(dev/no network)
Quick mental model:
Install plugin
Restart Gateway
Configure under
plugins.entries.voice-call.config
Use
openclaw voicecall ...
or the
voice_call
tool
Where it runs (local vs remote)
The Voice Call plugin runs
inside the Gateway process
If you use a remote Gateway, install/configure the plugin on the
machine running the Gateway
, then restart the Gateway to load it.
Install
Option A: install from npm (recommended)
openclaw
plugins
install
@openclaw/voice-call
Restart the Gateway afterwards.
Option B: install from a local folder (dev, no copying)
openclaw
plugins
install
./extensions/voice-call
./extensions/voice-call
&&
pnpm
install
Restart the Gateway afterwards.
Config
Set config under
plugins.entries.voice-call.config
plugins
entries
"voice-call"
enabled
true
config
provider
"twilio"
// or "telnyx" | "plivo" | "mock"
fromNumber
"+15550001234"
toNumber
"+15550005678"
twilio
accountSid
"ACxxxxxxxx"
authToken
"..."
telnyx
apiKey
"..."
connectionId
"..."
// Telnyx webhook public key from the Telnyx Mission Control Portal
// (Base64 string; can also be set via TELNYX_PUBLIC_KEY).
publicKey
"..."
plivo
authId
"MAxxxxxxxxxxxxxxxxxxxx"
authToken
"..."
// Webhook server
serve
port
3334
path
"/voice/webhook"
// Webhook security (recommended for tunnels/proxies)
webhookSecurity
allowedHosts
"voice.example.com"
trustedProxyIPs
"100.64.0.1"
// Public exposure (pick one)
// publicUrl: "https://example.ngrok.app/voice/webhook",
// tunnel: { provider: "ngrok" },
// tailscale: { mode: "funnel", path: "/voice/webhook" }
outbound
defaultMode
"notify"
// notify | conversation
streaming
enabled
true
streamPath
"/voice/stream"
Notes:
Twilio/Telnyx require a
publicly reachable
webhook URL.
Plivo requires a
publicly reachable
webhook URL.
mock
is a local dev provider (no network calls).
Telnyx requires
telnyx.publicKey
(or
TELNYX_PUBLIC_KEY
) unless
skipSignatureVerification
is true.
skipSignatureVerification
is for local testing only.
If you use ngrok free tier, set
publicUrl
to the exact ngrok URL; signature verification is always enforced.
tunnel.allowNgrokFreeTierLoopbackBypass: true
allows Twilio webhooks with invalid signatures
only
when
tunnel.provider="ngrok"
and
serve.bind
is loopback (ngrok local agent). Use for local dev only.
Ngrok free tier URLs can change or add interstitial behavior; if
publicUrl
drifts, Twilio signatures will fail. For production, prefer a stable domain or Tailscale funnel.
Webhook Security
When a proxy or tunnel sits in front of the Gateway, the plugin reconstructs the
public URL for signature verification. These options control which forwarded
headers are trusted.
webhookSecurity.allowedHosts
allowlists hosts from forwarding headers.
webhookSecurity.trustForwardingHeaders
trusts forwarded headers without an allowlist.
webhookSecurity.trustedProxyIPs
only trusts forwarded headers when the request
remote IP matches the list.
Example with a stable public host:
plugins
entries
"voice-call"
config
publicUrl
"https://voice.example.com/voice/webhook"
webhookSecurity
allowedHosts
"voice.example.com"
TTS for calls
Voice Call uses the core
messages.tts
configuration (OpenAI or ElevenLabs) for
streaming speech on calls. You can override it under the plugin config with the
same shape
— it deep‑merges with
messages.tts
tts
provider
"elevenlabs"
elevenlabs
voiceId
"pMsXgVXv3BLzUgSXRplE"
modelId
"eleven_multilingual_v2"
Notes:
Edge TTS is ignored for voice calls
(telephony audio needs PCM; Edge output is unreliable).
Core TTS is used when Twilio media streaming is enabled; otherwise calls fall back to provider native voices.
More examples
Use core TTS only (no override):
messages
tts
provider
"openai"
openai
voice
"alloy"
Override to ElevenLabs just for calls (keep core default elsewhere):
plugins
entries
"voice-call"
config
tts
provider
"elevenlabs"
elevenlabs
apiKey
"elevenlabs_key"
voiceId
"pMsXgVXv3BLzUgSXRplE"
modelId
"eleven_multilingual_v2"
Override only the OpenAI model for calls (deep‑merge example):
plugins
entries
"voice-call"
config
tts
openai
model
"gpt-4o-mini-tts"
voice
"marin"
Inbound calls
Inbound policy defaults to
disabled
. To enable inbound calls, set:
inboundPolicy
"allowlist"
allowFrom
"+15550001234"
inboundGreeting
"Hello! How can I help?"
Auto-responses use the agent system. Tune with:
responseModel
responseSystemPrompt
responseTimeoutMs
CLI
openclaw
voicecall
call
--to
"+15555550123"
--message
"Hello from OpenClaw"
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
speak
--call-id
<
>
--message
"One moment"
openclaw
voicecall
end
--call-id
<
>
openclaw
voicecall
status
--call-id
<
>
openclaw
voicecall
tail
openclaw
voicecall
expose
--mode
funnel
Agent tool
Tool name:
voice_call
Actions:
initiate_call
(message, to?, mode?)
continue_call
(callId, message)
speak_to_user
(callId, message)
end_call
(callId)
get_status
(callId)
This repo ships a matching skill doc at
skills/voice-call/SKILL.md
Gateway RPC
voicecall.initiate
to?
message
mode?
voicecall.continue
callId
message
voicecall.speak
callId
message
voicecall.end
callId
voicecall.status
callId
Plugins
Zalo Personal Plugin

---
## Plugins > Zalouser

[Source: https://docs.openclaw.ai/plugins/zalouser]

to automate a normal Zalo user account.
Warning:
Unofficial automation may lead to account suspension/ban. Use at your own risk.
Naming
Channel id is
zalouser
to make it explicit this automates a
personal Zalo user account
(unofficial). We keep
zalo
reserved for a potential future official Zalo API integration.
Where it runs
This plugin runs
inside the Gateway process
If you use a remote Gateway, install/configure it on the
machine running the Gateway
, then restart the Gateway.
Install
Option A: install from npm
openclaw
plugins
install
@openclaw/zalouser
Restart the Gateway afterwards.
Option B: install from a local folder (dev)
openclaw
plugins
install
./extensions/zalouser
./extensions/zalouser
&&
pnpm
install
Restart the Gateway afterwards.
Prerequisite: zca-cli
The Gateway machine must have
zca
PATH
zca
--version
Config
Channel config lives under
channels.zalouser
(not
plugins.entries.*
channels
zalouser
enabled
true
dmPolicy
"pairing"
CLI
openclaw
channels
login
--channel
zalouser
openclaw
channels
logout
--channel
zalouser
openclaw
channels
status
--probe
openclaw
message
send
--channel
zalouser
--target
<
threadI
>
--message
"Hello from OpenClaw"
openclaw
directory
peers
list
--channel
zalouser
--query
"name"
Agent tool
Tool name:
zalouser
Actions:
send
image
link
friends
groups
status
Voice Call Plugin
Hooks

---
## Experiments > Onboarding Config Protocol

[Source: https://docs.openclaw.ai/experiments/onboarding-config-protocol]

Onboarding + Config Protocol
Purpose: shared onboarding + config surfaces across CLI, macOS app, and Web UI.
Components
Wizard engine (shared session + prompts + onboarding state).
CLI onboarding uses the same wizard flow as the UI clients.
Gateway RPC exposes wizard + config schema endpoints.
macOS onboarding uses the wizard step model.
Web UI renders config forms from JSON Schema + UI hints.
Gateway RPC
wizard.start
params:
{ mode?: "local"|"remote", workspace?: string }
wizard.next
params:
{ sessionId, answer?: { stepId, value? } }
wizard.cancel
params:
{ sessionId }
wizard.status
params:
{ sessionId }
config.schema
params:
Responses (shape)
Wizard:
{ sessionId, done, step?, status?, error? }
Config schema:
{ schema, uiHints, version, generatedAt }
UI Hints
uiHints
keyed by path; optional metadata (label/help/group/order/advanced/sensitive/placeholder).
Sensitive fields render as password inputs; no redaction layer.
Unsupported schema nodes fall back to the raw JSON editor.
Notes
This doc is the single place to track protocol refactors for onboarding/config.
Tests

---
## Experiments > Proposals > Model Config

[Source: https://docs.openclaw.ai/experiments/proposals/model-config]

for future model configuration. It is not a
shipping spec. For current behavior, see:
Models
Model failover
OAuth + profiles
Motivation
Operators want:
Multiple auth profiles per provider (personal vs work).
Simple
/model
selection with predictable fallbacks.
Clear separation between text models and image-capable models.
Possible direction (high level)
Keep model selection simple:
provider/model
with optional aliases.
Let providers have multiple auth profiles, with an explicit order.
Use a global fallback list so all sessions fail over consistently.
Only override image routing when explicitly configured.
Open questions
Should profile rotation be per-provider or per-model?
How should the UI surface profile selection for a session?
What is the safest migration path from legacy config keys?
Workspace Memory Research

---
## Experiments > Research > Memory

[Source: https://docs.openclaw.ai/experiments/research/memory]

Proposed architecture (Markdown source-of-truth + derived index)
Canonical store (git-friendly)
Derived store (machine recall)
Retain / Recall / Reflect (operational loop)
Retain: normalize daily logs into “facts”
Recall: queries over the derived index
Reflect: produce stable pages + update beliefs
CLI integration: standalone vs deep integration
Why integrate into OpenClaw?
Why still split a library?
“S-Collide” / SuCo: when to use it (research)
Smallest useful pilot
References
Experiments
Workspace Memory Research
Workspace Memory v2 (offline): research notes
Target: Clawd-style workspace (
agents.defaults.workspace
, default
~/.openclaw/workspace
) where “memory” is stored as one Markdown file per day (
memory/YYYY-MM-DD.md
) plus a small set of stable files (e.g.
memory.md
SOUL.md
This doc proposes an
offline-first
memory architecture that keeps Markdown as the canonical, reviewable source of truth, but adds
structured recall
(search, entity summaries, confidence updates) via a derived index.
Why change?
The current setup (one file per day) is excellent for:
“append-only” journaling
human editing
git-backed durability + auditability
low-friction capture (“just write it down”)
It’s weak for:
high-recall retrieval (“what did we decide about X?”, “last time we tried Y?”)
entity-centric answers (“tell me about Alice / The Castle / warelay”) without rereading many files
opinion/preference stability (and evidence when it changes)
time constraints (“what was true during Nov 2025?”) and conflict resolution
Design goals
Offline
: works without network; can run on laptop/Castle; no cloud dependency.
Explainable
: retrieved items should be attributable (file + location) and separable from inference.
Low ceremony
: daily logging stays Markdown, no heavy schema work.
Incremental
: v1 is useful with FTS only; semantic/vector and graphs are optional upgrades.
Agent-friendly
: makes “recall within token budgets” easy (return small bundles of facts).
North star model (Hindsight × Letta)
Two pieces to blend:
Letta/MemGPT-style control loop
keep a small “core” always in context (persona + key user facts)
everything else is out-of-context and retrieved via tools
memory writes are explicit tool calls (append/replace/insert), persisted, then re-injected next turn
Hindsight-style memory substrate
separate what’s observed vs what’s believed vs what’s summarized
support retain/recall/reflect
confidence-bearing opinions that can evolve with evidence
entity-aware retrieval + temporal queries (even without full knowledge graphs)
Proposed architecture (Markdown source-of-truth + derived index)
Canonical store (git-friendly)
Keep
~/.openclaw/workspace
as canonical human-readable memory.
Suggested workspace layout:
~/.openclaw/workspace/
memory.md # small: durable facts + preferences (core-ish)
memory/
YYYY-MM-DD.md # daily log (append; narrative)
bank/ # “typed” memory pages (stable, reviewable)
world.md # objective facts about the world
experience.md # what the agent did (first-person)
opinions.md # subjective prefs/judgments + confidence + evidence pointers
entities/
Peter.md
The-Castle.md
warelay.md
...
Notes:
Daily log stays daily log
. No need to turn it into JSON.
The
bank/
files are
curated
, produced by reflection jobs, and can still be edited by hand.
memory.md
remains “small + core-ish”: the things you want Clawd to see every session.
Derived store (machine recall)
Add a derived index under the workspace (not necessarily git tracked):
~/.openclaw/workspace/.memory/index.sqlite
Back it with:
SQLite schema for facts + entity links + opinion metadata
SQLite
FTS5
for lexical recall (fast, tiny, offline)
optional embeddings table for semantic recall (still offline)
The index is always
rebuildable from Markdown
Retain / Recall / Reflect (operational loop)
Retain: normalize daily logs into “facts”
Hindsight’s key insight that matters here: store
narrative, self-contained facts
, not tiny snippets.
Practical rule for
memory/YYYY-MM-DD.md
at end of day (or during), add a
## Retain
section with 2–5 bullets that are:
narrative (cross-turn context preserved)
self-contained (standalone makes sense later)
tagged with type + entity mentions
Example:
## Retain
- W @Peter: Currently in Marrakech (Nov 27–Dec 1, 2025) for Andy’s birthday.
- B @warelay: I fixed the Baileys WS crash by wrapping connection.update handlers in try/catch (see memory/2025-11-27.md).
- O(c=0.95) @Peter: Prefers concise replies (<1500 chars) on WhatsApp; long content goes into files.
Minimal parsing:
Type prefix:
(world),
(experience/biographical),
(opinion),
(observation/summary; usually generated)
Entities:
@Peter
@warelay
, etc (slugs map to
bank/entities/*.md
Opinion confidence:
O(c=0.0..1.0)
optional
If you don’t want authors to think about it: the reflect job can infer these bullets from the rest of the log, but having an explicit
## Retain
section is the easiest “quality lever”.
Recall: queries over the derived index
Recall should support:
lexical
: “find exact terms / names / commands” (FTS5)
entity
: “tell me about X” (entity pages + entity-linked facts)
temporal
: “what happened around Nov 27” / “since last week”
opinion
: “what does Peter prefer?” (with confidence + evidence)
Return format should be agent-friendly and cite sources:
kind
world|experience|opinion|observation
timestamp
(source day, or extracted time range if present)
entities
["Peter","warelay"]
content
(the narrative fact)
source
memory/2025-11-27.md#L12
etc)
Reflect: produce stable pages + update beliefs
Reflection is a scheduled job (daily or heartbeat
ultrathink
) that:
updates
bank/entities/*.md
from recent facts (entity summaries)
updates
bank/opinions.md
confidence based on reinforcement/contradiction
optionally proposes edits to
memory.md
(“core-ish” durable facts)
Opinion evolution (simple, explainable):
each opinion has:
statement
confidence
c ∈ [0,1]
last_updated
evidence links (supporting + contradicting fact IDs)
when new facts arrive:
find candidate opinions by entity overlap + similarity (FTS first, embeddings later)
update confidence by small deltas; big jumps require strong contradiction + repeated evidence
CLI integration: standalone vs deep integration
Recommendation:
deep integration in OpenClaw
, but keep a separable core library.
Why integrate into OpenClaw?
OpenClaw already knows:
the workspace path (
agents.defaults.workspace
the session model + heartbeats
logging + troubleshooting patterns
You want the agent itself to call the tools:
openclaw memory recall "…" --k 25 --since 30d
openclaw memory reflect --since 7d
Why still split a library?
keep memory logic testable without gateway/runtime
reuse from other contexts (local scripts, future desktop app, etc.)
Shape:
The memory tooling is intended to be a small CLI + library layer, but this is exploratory only.
“S-Collide” / SuCo: when to use it (research)
If “S-Collide” refers to
SuCo (Subspace Collision)
: it’s an ANN retrieval approach that targets strong recall/latency tradeoffs by using learned/structured collisions in subspaces (paper: arXiv 2411.14754, 2024).
Pragmatic take for
~/.openclaw/workspace
don’t start
with SuCo.
start with SQLite FTS + (optional) simple embeddings; you’ll get most UX wins immediately.
consider SuCo/HNSW/ScaNN-class solutions only once:
corpus is big (tens/hundreds of thousands of chunks)
brute-force embedding search becomes too slow
recall quality is meaningfully bottlenecked by lexical search
Offline-friendly alternatives (in increasing complexity):
SQLite FTS5 + metadata filters (zero ML)
Embeddings + brute force (works surprisingly far if chunk count is low)
HNSW index (common, robust; needs a library binding)
SuCo (research-grade; attractive if there’s a solid implementation you can embed)
Open question:
what’s the
best
offline embedding model for “personal assistant memory” on your machines (laptop + desktop)?
if you already have Ollama: embed with a local model; otherwise ship a small embedding model in the toolchain.
Smallest useful pilot
If you want a minimal, still-useful version:
Add
bank/
entity pages and a
## Retain
section in daily logs.
Use SQLite FTS for recall with citations (path + line numbers).
Add embeddings only if recall quality or scale demands it.
References
Letta / MemGPT concepts: “core memory blocks” + “archival memory” + tool-driven self-editing memory.
Hindsight Technical Report: “retain / recall / reflect”, four-network memory, narrative fact extraction, opinion confidence evolution.
SuCo: arXiv 2411.14754 (2024): “Subspace Collision” approximate nearest neighbor retrieval.
Model Config Exploration

---
## Plugins > Community

[Source: https://docs.openclaw.ai/plugins/community]

# OpenClaw Community Plugins Documentation

## Overview

This page catalogs "high-quality **community-maintained plugins** for OpenClaw." The platform accepts pull requests for community-created plugins that meet established quality standards.

## Listing Requirements

To be included, plugins must satisfy these criteria:

- "Plugin package is published on npmjs (installable via `openclaw plugins install <npm-spec>`)"
- Source code resides in a public GitHub repository
- Documentation and issue tracking are available in the repository
- Clear maintenance indicators are evident through active development or responsive support

## Submission Process

Contributors should open a pull request adding their plugin entry with:
- Plugin name
- npm package identifier
- GitHub repository link
- Brief single-line description
- Installation command

## Quality Standards

The review process prioritizes "plugins that are useful, documented, and safe to operate." The team may decline submissions lacking sufficient documentation, unclear authorship, or evidence of abandonment.

## Entry Template

Plugins should follow this structure:
```
* **Name** — description
  npm: `@scope/package`
  repo: `https://github.com/org/repo`
  install: `openclaw plugins install @scope/package`
```

## Current Plugin

**WeChat Integration** — Enables connection to WeChat personal accounts through WeChatPadPro's iPad protocol, facilitating text, image, and file sharing with automation features.

- npm: `@icesword760/openclaw-wechat`
- repo: `https://github.com/icesword0760/openclaw-wechat`
- install: `openclaw plugins install @icesword760/openclaw-wechat`
