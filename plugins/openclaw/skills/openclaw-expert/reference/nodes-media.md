# OpenClaw Nodes & Media Reference

Device management, audio, camera, images, talk mode, voice wake, location.

---
## Nodes > Audio

[Source: https://docs.openclaw.ai/nodes/audio]

: If audio understanding is enabled (or auto‑detected), OpenClaw:
Locates the first audio attachment (local path or URL) and downloads it if needed.
Enforces
maxBytes
before sending to each model entry.
Runs the first eligible model entry in order (provider or CLI).
If it fails or skips (size/timeout), it tries the next entry.
On success, it replaces
Body
with an
[Audio]
block and sets
{{Transcript}}
Command parsing
: When transcription succeeds,
CommandBody
RawBody
are set to the transcript so slash commands still work.
Verbose logging
: In
--verbose
, we log when transcription runs and when it replaces the body.
Auto-detection (default)
If you
don’t configure models
and
tools.media.audio.enabled
not
set to
false
OpenClaw auto-detects in this order and stops at the first working option:
Local CLIs
(if installed)
sherpa-onnx-offline
(requires
SHERPA_ONNX_MODEL_DIR
with encoder/decoder/joiner/tokens)
whisper-cli
(from
whisper-cpp
; uses
WHISPER_CPP_MODEL
or the bundled tiny model)
whisper
(Python CLI; downloads models automatically)
Gemini CLI
gemini
) using
read_many_files
Provider keys
(OpenAI → Groq → Deepgram → Google)
To disable auto-detection, set
tools.media.audio.enabled: false
To customize, set
tools.media.audio.models
Note: Binary detection is best-effort across macOS/Linux/Windows; ensure the CLI is on
PATH
(we expand
), or set an explicit CLI model with a full command path.
Config examples
Provider + CLI fallback (OpenAI + Whisper CLI)
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
type
"cli"
command
"whisper"
args
"--model"
"base"
"{{MediaPath}}"
timeoutSeconds
Provider-only with scope gating
tools
media
audio
enabled
true
scope
default
"allow"
rules
action
"deny"
match
chatType
"group"
} }]
models
provider
"openai"
model
"gpt-4o-mini-transcribe"
Provider-only (Deepgram)
tools
media
audio
enabled
true
models
provider
"deepgram"
model
"nova-3"
Notes & limits
Provider auth follows the standard model auth order (auth profiles, env vars,
models.providers.*.apiKey
Deepgram picks up
DEEPGRAM_API_KEY
when
provider: "deepgram"
is used.
Deepgram setup details:
Deepgram (audio transcription)
Audio providers can override
baseUrl
headers
, and
providerOptions
via
tools.media.audio
Default size cap is 20MB (
tools.media.audio.maxBytes
). Oversize audio is skipped for that model and the next entry is tried.
Default
maxChars
for audio is
unset
(full transcript). Set
tools.media.audio.maxChars
or per-entry
maxChars
to trim output.
OpenAI auto default is
gpt-4o-mini-transcribe
; set
model: "gpt-4o-transcribe"
for higher accuracy.
Use
tools.media.audio.attachments
to process multiple voice notes (
mode: "all"
maxAttachments
Transcript is available to templates as
{{Transcript}}
CLI stdout is capped (5MB); keep CLI output concise.
Mention Detection in Groups
When
requireMention: true
is set for a group chat, OpenClaw now transcribes audio
before
checking for mentions. This allows voice notes to be processed even when they contain mentions.
How it works:
If a voice message has no text body and the group requires mentions, OpenClaw performs a “preflight” transcription.
The transcript is checked for mention patterns (e.g.,
@BotName
, emoji triggers).
If a mention is found, the message proceeds through the full reply pipeline.
The transcript is used for mention detection so voice notes can pass the mention gate.
Fallback behavior:
If transcription fails during preflight (timeout, API error, etc.), the message is processed based on text-only mention detection.
This ensures that mixed messages (text + audio) are never incorrectly dropped.
Example:
A user sends a voice note saying “Hey @Claude, what’s the weather?” in a Telegram group with
requireMention: true
. The voice note is transcribed, the mention is detected, and the agent replies.
Gotchas
Scope rules use first-match wins.
chatType
is normalized to
direct
group
, or
room
Ensure your CLI exits 0 and prints plain text; JSON needs to be massaged via
jq -r .text
Keep timeouts reasonable (
timeoutSeconds
, default 60s) to avoid blocking the reply queue.
Preflight transcription only processes the
first
audio attachment for mention detection. Additional audio is processed during the main media understanding phase.
Image and Media Support
Camera Capture

---
## Nodes > Camera

[Source: https://docs.openclaw.ai/nodes/camera]

for agent workflows:
iOS node
(paired via Gateway): capture a
photo
jpg
) or
short video clip
mp4
, with optional audio) via
node.invoke
Android node
(paired via Gateway): capture a
photo
jpg
) or
short video clip
mp4
, with optional audio) via
node.invoke
macOS app
(node via Gateway): capture a
photo
jpg
) or
short video clip
mp4
, with optional audio) via
node.invoke
All camera access is gated behind
user-controlled settings
iOS node
User setting (default on)
iOS Settings tab →
Camera
Allow Camera
camera.enabled
Default:
(missing key is treated as enabled).
When off:
camera.*
commands return
CAMERA_DISABLED
Commands (via Gateway
node.invoke
camera.list
Response payload:
devices
: array of
{ id, name, position, deviceType }
camera.snap
Params:
facing
front|back
(default:
front
maxWidth
: number (optional; default
1600
on the iOS node)
quality
0..1
(optional; default
0.9
format
: currently
jpg
delayMs
: number (optional; default
deviceId
: string (optional; from
camera.list
Response payload:
format: "jpg"
base64: "<...>"
width
height
Payload guard: photos are recompressed to keep the base64 payload under 5 MB.
camera.clip
Params:
facing
front|back
(default:
front
durationMs
: number (default
3000
, clamped to a max of
60000
includeAudio
: boolean (default
true
format
: currently
mp4
deviceId
: string (optional; from
camera.list
Response payload:
format: "mp4"
base64: "<...>"
durationMs
hasAudio
Foreground requirement
Like
canvas.*
, the iOS node only allows
camera.*
commands in the
foreground
. Background invocations return
NODE_BACKGROUND_UNAVAILABLE
CLI helper (temp files + MEDIA)
The easiest way to get attachments is via the CLI helper, which writes decoded media to a temp file and prints
MEDIA:<path>
Examples:
openclaw
nodes
camera
snap
--node
<
>
# default: both front + back (2 MEDIA lines)
openclaw
nodes
camera
snap
--node
<
>
--facing
front
openclaw
nodes
camera
clip
--node
<
>
--duration
3000
openclaw
nodes
camera
clip
--node
<
>
--no-audio
Notes:
nodes camera snap
defaults to
both
facings to give the agent both views.
Output files are temporary (in the OS temp directory) unless you build your own wrapper.
Android node
Android user setting (default on)
Android Settings sheet →
Camera
Allow Camera
camera.enabled
Default:
(missing key is treated as enabled).
When off:
camera.*
commands return
CAMERA_DISABLED
Permissions
Android requires runtime permissions:
CAMERA
for both
camera.snap
and
camera.clip
RECORD_AUDIO
for
camera.clip
when
includeAudio=true
If permissions are missing, the app will prompt when possible; if denied,
camera.*
requests fail with a
*_PERMISSION_REQUIRED
error.
Android foreground requirement
Like
canvas.*
, the Android node only allows
camera.*
commands in the
foreground
. Background invocations return
NODE_BACKGROUND_UNAVAILABLE
Payload guard
Photos are recompressed to keep the base64 payload under 5 MB.
macOS app
User setting (default off)
The macOS companion app exposes a checkbox:
Settings → General → Allow Camera
openclaw.cameraEnabled
Default:
off
When off: camera requests return “Camera disabled by user”.
CLI helper (node invoke)
Use the main
openclaw
CLI to invoke camera commands on the macOS node.
Examples:
openclaw
nodes
camera
list
--node
<
>
# list camera ids
openclaw
nodes
camera
snap
--node
<
>
# prints MEDIA:<path>
openclaw
nodes
camera
snap
--node
<
>
--max-width
1280
openclaw
nodes
camera
snap
--node
<
>
--delay-ms
2000
openclaw
nodes
camera
snap
--node
<
>
--device-id
<
>
openclaw
nodes
camera
clip
--node
<
>
--duration
10s
# prints MEDIA:<path>
openclaw
nodes
camera
clip
--node
<
>
--duration-ms
3000
# prints MEDIA:<path> (legacy flag)
openclaw
nodes
camera
clip
--node
<
>
--device-id
<
>
openclaw
nodes
camera
clip
--node
<
>
--no-audio
Notes:
openclaw nodes camera snap
defaults to
maxWidth=1600
unless overridden.
On macOS,
camera.snap
waits
delayMs
(default 2000ms) after warm-up/exposure settle before capturing.
Photo payloads are recompressed to keep base64 under 5 MB.
Safety + practical limits
Camera and microphone access trigger the usual OS permission prompts (and require usage strings in Info.plist).
Video clips are capped (currently
<= 60s
) to avoid oversized node payloads (base64 overhead + message limits).
macOS screen video (OS-level)
For
screen
video (not camera), use the macOS companion:
openclaw
nodes
screen
record
--node
<
>
--duration
10s
--fps
# prints MEDIA:<path>
Notes:
Requires macOS
Screen Recording
permission (TCC).
Audio and Voice Notes
Talk Mode

---
## Nodes > Images

[Source: https://docs.openclaw.ai/nodes/images]

Image & Media Support — 2025-12-05
The WhatsApp channel runs via
Baileys Web
. This document captures the current media handling rules for send, gateway, and agent replies.
Goals
Send media with optional captions via
openclaw message send --media
Allow auto-replies from the web inbox to include media alongside text.
Keep per-type limits sane and predictable.
CLI Surface
openclaw message send --media <path-or-url> [--message <caption>]
--media
optional; caption can be empty for media-only sends.
--dry-run
prints the resolved payload;
--json
emits
{ channel, to, messageId, mediaUrl, caption }
WhatsApp Web channel behavior
Input: local file path
HTTP(S) URL.
Flow: load into a Buffer, detect media kind, and build the correct payload:
Images:
resize & recompress to JPEG (max side 2048px) targeting
agents.defaults.mediaMaxMb
(default 5 MB), capped at 6 MB.
Audio/Voice/Video:
pass-through up to 16 MB; audio is sent as a voice note (
ptt: true
Documents:
anything else, up to 100 MB, with filename preserved when available.
WhatsApp GIF-style playback: send an MP4 with
gifPlayback: true
(CLI:
--gif-playback
) so mobile clients loop inline.
MIME detection prefers magic bytes, then headers, then file extension.
Caption comes from
--message
reply.text
; empty caption is allowed.
Logging: non-verbose shows
; verbose includes size and source path/URL.
Auto-Reply Pipeline
getReplyFromConfig
returns
{ text?, mediaUrl?, mediaUrls? }
When media is present, the web sender resolves local paths or URLs using the same pipeline as
openclaw message send
Multiple media entries are sent sequentially if provided.
Inbound Media to Commands (Pi)
When inbound web messages include media, OpenClaw downloads to a temp file and exposes templating variables:
{{MediaUrl}}
pseudo-URL for the inbound media.
{{MediaPath}}
local temp path written before running the command.
When a per-session Docker sandbox is enabled, inbound media is copied into the sandbox workspace and
MediaPath
MediaUrl
are rewritten to a relative path like
media/inbound/<filename>
Media understanding (if configured via
tools.media.*
or shared
tools.media.models
) runs before templating and can insert
[Image]
[Audio]
, and
[Video]
blocks into
Body
Audio sets
{{Transcript}}
and uses the transcript for command parsing so slash commands still work.
Video and image descriptions preserve any caption text for command parsing.
By default only the first matching image/audio/video attachment is processed; set
tools.media.<cap>.attachments
to process multiple attachments.
Limits & Errors
Outbound send caps (WhatsApp web send)
Images: ~6 MB cap after recompression.
Audio/voice/video: 16 MB cap; documents: 100 MB cap.
Oversize or unreadable media → clear error in logs and the reply is skipped.
Media understanding caps (transcription/description)
Image default: 10 MB (
tools.media.image.maxBytes
Audio default: 20 MB (
tools.media.audio.maxBytes
Video default: 50 MB (
tools.media.video.maxBytes
Oversize media skips understanding, but replies still go through with the original body.
Notes for Tests
Cover send + reply flows for image/audio/document cases.
Validate recompression for images (size bound) and voice-note flag for audio.
Ensure multi-media replies fan out as sequential sends.
Node Troubleshooting
Audio and Voice Notes

---
## Nodes > Location Command

[Source: https://docs.openclaw.ai/nodes/location-command]

Off by default.
Settings use a selector: Off / While Using / Always.
Separate toggle: Precise Location.
Why a selector (not just a switch)
OS permissions are multi-level. We can expose a selector in-app, but the OS still decides the actual grant.
iOS/macOS: user can choose
While Using
Always
in system prompts/Settings. App can request upgrade, but OS may require Settings.
Android: background location is a separate permission; on Android 10+ it often requires a Settings flow.
Precise location is a separate grant (iOS 14+ “Precise”, Android “fine” vs “coarse”).
Selector in UI drives our requested mode; actual grant lives in OS settings.
Settings model
Per node device:
location.enabledMode
off | whileUsing | always
location.preciseEnabled
: bool
UI behavior:
Selecting
whileUsing
requests foreground permission.
Selecting
always
first ensures
whileUsing
, then requests background (or sends user to Settings if required).
If OS denies requested level, revert to the highest granted level and show status.
Permissions mapping (node.permissions)
Optional. macOS node reports
location
via the permissions map; iOS/Android may omit it.
Command:
location.get
Called via
node.invoke
Params (suggested):
"timeoutMs"
10000
"maxAgeMs"
15000
"desiredAccuracy"
"coarse|balanced|precise"
Response payload:
"lat"
48.20849
"lon"
16.37208
"accuracyMeters"
12.5
"altitudeMeters"
182.0
"speedMps"
0.0
"headingDeg"
270.0
"timestamp"
"2026-01-03T12:34:56.000Z"
"isPrecise"
true
"source"
"gps|wifi|cell|unknown"
Errors (stable codes):
LOCATION_DISABLED
: selector is off.
LOCATION_PERMISSION_REQUIRED
: permission missing for requested mode.
LOCATION_BACKGROUND_UNAVAILABLE
: app is backgrounded but only While Using allowed.
LOCATION_TIMEOUT
: no fix in time.
LOCATION_UNAVAILABLE
: system failure / no providers.
Background behavior (future)
Goal: model can request location even when node is backgrounded, but only when:
User selected
Always
OS grants background location.
App is allowed to run in background for location (iOS background mode / Android foreground service or special allowance).
Push-triggered flow (future):
Gateway sends a push to the node (silent push or FCM data).
Node wakes briefly and requests location from the device.
Node forwards payload to Gateway.
Notes:
iOS: Always permission + background location mode required. Silent push may be throttled; expect intermittent failures.
Android: background location may require a foreground service; otherwise, expect denial.
Model/tooling integration
Tool surface:
nodes
tool adds
location_get
action (node required).
CLI:
openclaw nodes location get --node <id>
Agent guidelines: only call when user enabled location and understands the scope.
UX copy (suggested)
Off: “Location sharing is disabled.”
While Using: “Only when OpenClaw is open.”
Always: “Allow background location. Requires system permission.”
Precise: “Use precise GPS location. Toggle off to share approximate location.”
Voice Wake

---
## Nodes > Talk

[Source: https://docs.openclaw.ai/nodes/talk]

Talk mode is a continuous voice conversation loop:
Listen for speech
Send transcript to the model (main session, chat.send)
Wait for the response
Speak it via ElevenLabs (streaming playback)
Behavior (macOS)
Always-on overlay
while Talk mode is enabled.
Listening → Thinking → Speaking
phase transitions.
On a
short pause
(silence window), the current transcript is sent.
Replies are
written to WebChat
(same as typing).
Interrupt on speech
(default on): if the user starts talking while the assistant is speaking, we stop playback and note the interruption timestamp for the next prompt.
Voice directives in replies
The assistant may prefix its reply with a
single JSON line
to control voice:
"voice"
"<voice-id>"
"once"
true
Rules:
First non-empty line only.
Unknown keys are ignored.
once: true
applies to the current reply only.
Without
once
, the voice becomes the new default for Talk mode.
The JSON line is stripped before TTS playback.
Supported keys:
voice
voice_id
voiceId
model
model_id
modelId
speed
rate
(WPM),
stability
similarity
style
speakerBoost
seed
normalize
lang
output_format
latency_tier
once
Config (
~/.openclaw/openclaw.json
talk
voiceId
"elevenlabs_voice_id"
modelId
"eleven_v3"
outputFormat
"mp3_44100_128"
apiKey
"elevenlabs_api_key"
interruptOnSpeech
true
Defaults:
interruptOnSpeech
: true
voiceId
: falls back to
ELEVENLABS_VOICE_ID
SAG_VOICE_ID
(or first ElevenLabs voice when API key is available)
modelId
: defaults to
eleven_v3
when unset
apiKey
: falls back to
ELEVENLABS_API_KEY
(or gateway shell profile if available)
outputFormat
: defaults to
pcm_44100
on macOS/iOS and
pcm_24000
on Android (set
mp3_*
to force MP3 streaming)
macOS UI
Menu bar toggle:
Talk
Config tab:
Talk Mode
group (voice id + interrupt toggle)
Overlay:
Listening
: cloud pulses with mic level
Thinking
: sinking animation
Speaking
: radiating rings
Click cloud: stop speaking
Click X: exit Talk mode
Notes
Requires Speech + Microphone permissions.
Uses
chat.send
against session key
main
TTS uses ElevenLabs streaming API with
ELEVENLABS_API_KEY
and incremental playback on macOS/iOS/Android for lower latency.
stability
for
eleven_v3
is validated to
0.0
0.5
, or
1.0
; other models accept
0..1
latency_tier
is validated to
0..4
when set.
Android supports
pcm_16000
pcm_22050
pcm_24000
, and
pcm_44100
output formats for low-latency AudioTrack streaming.
Camera Capture
Voice Wake

---
## Nodes > Troubleshooting

[Source: https://docs.openclaw.ai/nodes/troubleshooting]

Use this page when a node is visible in status but node tools fail.
Command ladder
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
Then run node specific checks:
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
Healthy signals:
Node is connected and paired for role
node
nodes describe
includes the capability you are calling.
Exec approvals show expected mode/allowlist.
Foreground requirements
canvas.*
camera.*
, and
screen.*
are foreground only on iOS/Android nodes.
Quick check and fix:
openclaw
nodes
describe
--node
<
idOrNameOrI
>
openclaw
nodes
canvas
snapshot
--node
<
idOrNameOrI
>
openclaw
logs
--follow
If you see
NODE_BACKGROUND_UNAVAILABLE
, bring the node app to the foreground and retry.
Permissions matrix
Capability
iOS
Android
macOS node app
Typical failure code
camera.snap
camera.clip
Camera (+ mic for clip audio)
Camera (+ mic for clip audio)
Camera (+ mic for clip audio)
*_PERMISSION_REQUIRED
screen.record
Screen Recording (+ mic optional)
Screen capture prompt (+ mic optional)
Screen Recording
*_PERMISSION_REQUIRED
location.get
While Using or Always (depends on mode)
Foreground/Background location based on mode
Location permission
LOCATION_PERMISSION_REQUIRED
system.run
n/a (node host path)
n/a (node host path)
Exec approvals required
SYSTEM_RUN_DENIED
Pairing versus approvals
These are different gates:
Device pairing
: can this node connect to the gateway?
Exec approvals
: can this node run a specific shell command?
Quick checks:
openclaw
devices
list
openclaw
nodes
status
openclaw
approvals
get
--node
<
idOrNameOrI
>
openclaw
approvals
allowlist
add
--node
<
idOrNameOrI
>
"/usr/bin/uname"
If pairing is missing, approve the node device first.
If pairing is fine but
system.run
fails, fix exec approvals/allowlist.
Common node error codes
NODE_BACKGROUND_UNAVAILABLE
→ app is backgrounded; bring it foreground.
CAMERA_DISABLED
→ camera toggle disabled in node settings.
*_PERMISSION_REQUIRED
→ OS permission missing/denied.
LOCATION_DISABLED
→ location mode is off.
LOCATION_PERMISSION_REQUIRED
→ requested location mode not granted.
LOCATION_BACKGROUND_UNAVAILABLE
→ app is backgrounded but only While Using permission exists.
SYSTEM_RUN_DENIED: approval required
→ exec request needs explicit approval.
SYSTEM_RUN_DENIED: allowlist miss
→ command blocked by allowlist mode.
Fast recovery loop
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
If still stuck:
Re-approve device pairing.
Re-open node app (foreground).
Re-grant OS permissions.
Recreate/adjust exec approval policy.
Related:
/nodes/index
/nodes/camera
/nodes/location-command
/tools/exec-approvals
/gateway/pairing
Nodes
Image and Media Support

---
## Nodes > Voicewake

[Source: https://docs.openclaw.ai/nodes/voicewake]

There are
no per-node custom wake words
Any node/app UI may edit
the list; changes are persisted by the Gateway and broadcast to everyone.
Each device still keeps its own
Voice Wake enabled/disabled
toggle (local UX + permissions differ).
Storage (Gateway host)
Wake words are stored on the gateway machine at:
~/.openclaw/settings/voicewake.json
Shape:
"triggers"
"openclaw"
"claude"
"computer"
"updatedAtMs"
1730000000000
Protocol
Methods
voicewake.get
{ triggers: string[] }
voicewake.set
with params
{ triggers: string[] }
{ triggers: string[] }
Notes:
Triggers are normalized (trimmed, empties dropped). Empty lists fall back to defaults.
Limits are enforced for safety (count/length caps).
Events
voicewake.changed
payload
{ triggers: string[] }
Who receives it:
All WebSocket clients (macOS app, WebChat, etc.)
All connected nodes (iOS/Android), and also on node connect as an initial “current state” push.
Client behavior
macOS app
Uses the global list to gate
VoiceWakeRuntime
triggers.
Editing “Trigger words” in Voice Wake settings calls
voicewake.set
and then relies on the broadcast to keep other clients in sync.
iOS node
Uses the global list for
VoiceWakeManager
trigger detection.
Editing Wake Words in Settings calls
voicewake.set
(over the Gateway WS) and also keeps local wake-word detection responsive.
Android node
Exposes a Wake Words editor in Settings.
Calls
voicewake.set
over the Gateway WS so edits sync everywhere.
Talk Mode
Location Command
