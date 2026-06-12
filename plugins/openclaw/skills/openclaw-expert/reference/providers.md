# OpenClaw Model Providers Reference

Configuration for every supported model provider.

---
## Providers > Anthropic

[Source: https://docs.openclaw.ai/providers/anthropic]

model family and provides access via an API.
In OpenClaw you can authenticate with an API key or a
setup-token
Option A: Anthropic API key
Best for:
standard API access and usage-based billing.
Create your API key in the Anthropic Console.
CLI setup
openclaw
onboard
# choose: Anthropic API key
# or non-interactive
openclaw
onboard
--anthropic-api-key
"$ANTHROPIC_API_KEY"
Config snippet
env
ANTHROPIC_API_KEY
"sk-ant-..."
agents
defaults
model
primary
"anthropic/claude-opus-4-6"
} } }
Prompt caching (Anthropic API)
OpenClaw supports Anthropic’s prompt caching feature. This is
API-only
; subscription auth does not honor cache settings.
Configuration
Use the
cacheRetention
parameter in your model config:
Value
Cache Duration
Description
none
No caching
Disable prompt caching
short
5 minutes
Default for API Key auth
long
1 hour
Extended cache (requires beta flag)
agents
defaults
models
"anthropic/claude-opus-4-6"
params
cacheRetention
"long"
Defaults
When using Anthropic API Key authentication, OpenClaw automatically applies
cacheRetention: "short"
(5-minute cache) for all Anthropic models. You can override this by explicitly setting
cacheRetention
in your config.
Legacy parameter
The older
cacheControlTtl
parameter is still supported for backwards compatibility:
"5m"
maps to
short
"1h"
maps to
long
We recommend migrating to the new
cacheRetention
parameter.
OpenClaw includes the
extended-cache-ttl-2025-04-11
beta flag for Anthropic API
requests; keep it if you override provider headers (see
/gateway/configuration
Option B: Claude setup-token
Best for:
using your Claude subscription.
Where to get a setup-token
Setup-tokens are created by the
Claude Code CLI
, not the Anthropic Console. You can run this on
any machine
claude
setup-token
Paste the token into OpenClaw (wizard:
Anthropic token (paste setup-token)
), or run it on the gateway host:
openclaw
models
auth
setup-token
--provider
anthropic
If you generated the token on a different machine, paste it:
openclaw
models
auth
paste-token
--provider
anthropic
CLI setup (setup-token)
# Paste a setup-token during onboarding
openclaw
onboard
--auth-choice
setup-token
Config snippet (setup-token)
agents
defaults
model
primary
"anthropic/claude-opus-4-6"
} } }
Notes
Generate the setup-token with
claude setup-token
and paste it, or run
openclaw models auth setup-token
on the gateway host.
If you see “OAuth token refresh failed …” on a Claude subscription, re-auth with a setup-token. See
/gateway/troubleshooting#oauth-token-refresh-failed-anthropic-claude-subscription
Auth details + reuse rules are in
/concepts/oauth
Troubleshooting
401 errors / token suddenly invalid
Claude subscription auth can expire or be revoked. Re-run
claude setup-token
and paste it into the
gateway host
If the Claude CLI login lives on a different machine, use
openclaw models auth paste-token --provider anthropic
on the gateway host.
No API key found for provider “anthropic”
Auth is
per agent
. New agents don’t inherit the main agent’s keys.
Re-run onboarding for that agent, or paste a setup-token / API key on the
gateway host, then verify with
openclaw models status
No credentials found for profile
anthropic:default
Run
openclaw models status
to see which auth profile is active.
Re-run onboarding, or paste a setup-token / API key for that profile.
No available auth profile (all in cooldown/unavailable)
Check
openclaw models status --json
for
auth.unusableProfiles
Add another Anthropic profile or wait for cooldown.
More:
/gateway/troubleshooting
and
/help/faq
Model Failover
OpenAI

---
## Providers > Bedrock

[Source: https://docs.openclaw.ai/providers/bedrock]

models via pi‑ai’s
Bedrock Converse
streaming provider. Bedrock auth uses the
AWS SDK default credential chain
not an API key.
What pi‑ai supports
Provider:
amazon-bedrock
API:
bedrock-converse-stream
Auth: AWS credentials (env vars, shared config, or instance role)
Region:
AWS_REGION
AWS_DEFAULT_REGION
(default:
us-east-1
Automatic model discovery
If AWS credentials are detected, OpenClaw can automatically discover Bedrock
models that support
streaming
and
text output
. Discovery uses
bedrock:ListFoundationModels
and is cached (default: 1 hour).
Config options live under
models.bedrockDiscovery
models
bedrockDiscovery
enabled
true
region
"us-east-1"
providerFilter
"anthropic"
"amazon"
refreshInterval
3600
defaultContextWindow
32000
defaultMaxTokens
4096
Notes:
enabled
defaults to
true
when AWS credentials are present.
region
defaults to
AWS_REGION
AWS_DEFAULT_REGION
, then
us-east-1
providerFilter
matches Bedrock provider names (for example
anthropic
refreshInterval
is seconds; set to
to disable caching.
defaultContextWindow
(default:
32000
) and
defaultMaxTokens
(default:
4096
are used for discovered models (override if you know your model limits).
Setup (manual)
Ensure AWS credentials are available on the
gateway host
export
AWS_ACCESS_KEY_ID
"AKIA..."
export
AWS_SECRET_ACCESS_KEY
"..."
export
AWS_REGION
"us-east-1"
# Optional:
export
AWS_SESSION_TOKEN
"..."
export
AWS_PROFILE
"your-profile"
# Optional (Bedrock API key/bearer token):
export
AWS_BEARER_TOKEN_BEDROCK
"..."
Add a Bedrock provider and model to your config (no
apiKey
required):
models
providers
"amazon-bedrock"
baseUrl
"https://bedrock-runtime.us-east-1.amazonaws.com"
api
"bedrock-converse-stream"
auth
"aws-sdk"
models
"us.anthropic.claude-opus-4-6-v1:0"
name
"Claude Opus 4.6 (Bedrock)"
reasoning
true
input
"text"
"image"
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
agents
defaults
model
primary
"amazon-bedrock/us.anthropic.claude-opus-4-6-v1:0"
EC2 Instance Roles
When running OpenClaw on an EC2 instance with an IAM role attached, the AWS SDK
will automatically use the instance metadata service (IMDS) for authentication.
However, OpenClaw’s credential detection currently only checks for environment
variables, not IMDS credentials.
Workaround:
Set
AWS_PROFILE=default
to signal that AWS credentials are
available. The actual authentication still uses the instance role via IMDS.
# Add to ~/.bashrc or your shell profile
export
AWS_PROFILE
default
export
AWS_REGION
us-east-1
Required IAM permissions
for the EC2 instance role:
bedrock:InvokeModel
bedrock:InvokeModelWithResponseStream
bedrock:ListFoundationModels
(for automatic discovery)
Or attach the managed policy
AmazonBedrockFullAccess
Quick setup:
# 1. Create IAM role and instance profile
aws
iam
create-role
--role-name
EC2-Bedrock-Access
--assume-role-policy-document
'{
"Version": "2012-10-17",
"Statement": [{
"Effect": "Allow",
"Principal": {"Service": "ec2.amazonaws.com"},
"Action": "sts:AssumeRole"
}'
aws
iam
attach-role-policy
--role-name
EC2-Bedrock-Access
--policy-arn
arn:aws:iam::aws:policy/AmazonBedrockFullAccess
aws
iam
create-instance-profile
--instance-profile-name
EC2-Bedrock-Access
aws
iam
add-role-to-instance-profile
--instance-profile-name
EC2-Bedrock-Access
--role-name
EC2-Bedrock-Access
# 2. Attach to your EC2 instance
aws
ec2
associate-iam-instance-profile
--instance-id
i-xxxxx
--iam-instance-profile
Name=EC2-Bedrock-Access
# 3. On the EC2 instance, enable discovery
openclaw
config
set
models.bedrockDiscovery.enabled
true
openclaw
config
set
models.bedrockDiscovery.region
us-east-1
# 4. Set the workaround env vars
echo
'export AWS_PROFILE=default'
>>
~/.bashrc
echo
'export AWS_REGION=us-east-1'
>>
~/.bashrc
source
~/.bashrc
# 5. Verify models are discovered
openclaw
models
list
Notes
Bedrock requires
model access
enabled in your AWS account/region.
Automatic discovery needs the
bedrock:ListFoundationModels
permission.
If you use profiles, set
AWS_PROFILE
on the gateway host.
OpenClaw surfaces the credential source in this order:
AWS_BEARER_TOKEN_BEDROCK
then
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
, then
AWS_PROFILE
, then the
default AWS SDK chain.
Reasoning support depends on the model; check the Bedrock model card for
current capabilities.
If you prefer a managed key flow, you can also place an OpenAI‑compatible
proxy in front of Bedrock and configure it as an OpenAI provider instead.
Litellm
Vercel AI Gateway

---
## Providers > Glm

[Source: https://docs.openclaw.ai/providers/glm]

(not a company) available through the Z.AI platform. In OpenClaw, GLM
models are accessed via the
zai
provider and model IDs like
zai/glm-5
CLI setup
openclaw
onboard
--auth-choice
zai-api-key
Config snippet
env
ZAI_API_KEY
"sk-..."
agents
defaults
model
primary
"zai/glm-5"
} } }
Notes
GLM versions and availability can change; check Z.AI’s docs for the latest.
Example model IDs include
glm-5
glm-4.7
, and
glm-4.6
For provider details, see
/providers/zai
OpenCode Zen
Z.AI

---
## Providers > Litellm

[Source: https://docs.openclaw.ai/providers/litellm]

is an open-source LLM gateway that provides a unified API to 100+ model providers. Route OpenClaw through LiteLLM to get centralized cost tracking, logging, and the flexibility to switch backends without changing your OpenClaw config.
Why use LiteLLM with OpenClaw?
Cost tracking
— See exactly what OpenClaw spends across all models
Model routing
— Switch between Claude, GPT-4, Gemini, Bedrock without config changes
Virtual keys
— Create keys with spend limits for OpenClaw
Logging
— Full request/response logs for debugging
Fallbacks
— Automatic failover if your primary provider is down
Quick start
Via onboarding
openclaw
onboard
--auth-choice
litellm-api-key
Manual setup
Start LiteLLM Proxy:
pip
install
'litellm[proxy]'
litellm
--model
claude-opus-4-6
Point OpenClaw to LiteLLM:
export
LITELLM_API_KEY
"your-litellm-key"
openclaw
That’s it. OpenClaw now routes through LiteLLM.
Configuration
Environment variables
export
LITELLM_API_KEY
"sk-litellm-key"
Config file
models
providers
litellm
baseUrl
"http://localhost:4000"
apiKey
"${LITELLM_API_KEY}"
api
"openai-completions"
models
"claude-opus-4-6"
name
"Claude Opus 4.6"
reasoning
true
input
"text"
"image"
contextWindow
200000
maxTokens
64000
"gpt-4o"
name
"GPT-4o"
reasoning
false
input
"text"
"image"
contextWindow
128000
maxTokens
8192
agents
defaults
model
primary
"litellm/claude-opus-4-6"
Virtual keys
Create a dedicated key for OpenClaw with spend limits:
curl
POST
"http://localhost:4000/key/generate"
"Authorization: Bearer $LITELLM_MASTER_KEY"
"Content-Type: application/json"
'{
"key_alias": "openclaw",
"max_budget": 50.00,
"budget_duration": "monthly"
}'
Use the generated key as
LITELLM_API_KEY
Model routing
LiteLLM can route model requests to different backends. Configure in your LiteLLM
config.yaml
model_list
model_name
claude-opus-4-6
litellm_params
model
claude-opus-4-6
api_key
os.environ/ANTHROPIC_API_KEY
model_name
gpt-4o
litellm_params
model
gpt-4o
api_key
os.environ/OPENAI_API_KEY
OpenClaw keeps requesting
claude-opus-4-6
— LiteLLM handles the routing.
Viewing usage
Check LiteLLM’s dashboard or API:
# Key info
curl
"http://localhost:4000/key/info"
"Authorization: Bearer sk-litellm-key"
# Spend logs
curl
"http://localhost:4000/spend/logs"
"Authorization: Bearer $LITELLM_MASTER_KEY"
Notes
LiteLLM runs on
http://localhost:4000
by default
OpenClaw connects via the OpenAI-compatible
/v1/chat/completions
endpoint
All OpenClaw features work through LiteLLM — no limitations
See also
LiteLLM Docs
Model Providers
OpenRouter
Amazon Bedrock

---
## Providers > Minimax

[Source: https://docs.openclaw.ai/providers/minimax]

model family. The current
coding-focused release is
MiniMax M2.1
(December 23, 2025), built for
real-world complex tasks.
Source:
MiniMax M2.1 release note
Model overview (M2.1)
MiniMax highlights these improvements in M2.1:
Stronger
multi-language coding
(Rust, Java, Go, C++, Kotlin, Objective-C, TS/JS).
Better
web/app development
and aesthetic output quality (including native mobile).
Improved
composite instruction
handling for office-style workflows, building on
interleaved thinking and integrated constraint execution.
More concise responses
with lower token usage and faster iteration loops.
Stronger
tool/agent framework
compatibility and context management (Claude Code,
Droid/Factory AI, Cline, Kilo Code, Roo Code, BlackBox).
Higher-quality
dialogue and technical writing
outputs.
MiniMax M2.1 vs MiniMax M2.1 Lightning
Speed:
Lightning is the “fast” variant in MiniMax’s pricing docs.
Cost:
Pricing shows the same input cost, but Lightning has higher output cost.
Coding plan routing:
The Lightning back-end isn’t directly available on the MiniMax
coding plan. MiniMax auto-routes most requests to Lightning, but falls back to the
regular M2.1 back-end during traffic spikes.
Choose a setup
MiniMax OAuth (Coding Plan) — recommended
Best for:
quick setup with MiniMax Coding Plan via OAuth, no API key required.
Enable the bundled OAuth plugin and authenticate:
openclaw
plugins
enable
minimax-portal-auth
# skip if already loaded.
openclaw
gateway
restart
# restart if gateway is already running
openclaw
onboard
--auth-choice
minimax-portal
You will be prompted to select an endpoint:
Global
- International users (
api.minimax.io
- Users in China (
api.minimaxi.com
See
MiniMax OAuth plugin README
for details.
MiniMax M2.1 (API key)
Best for:
hosted MiniMax with Anthropic-compatible API.
Configure via CLI:
Run
openclaw configure
Select
Model/auth
Choose
MiniMax M2.1
env
MINIMAX_API_KEY
"sk-..."
agents
defaults
model
primary
"minimax/MiniMax-M2.1"
} } }
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
MiniMax M2.1 as fallback (Opus primary)
Best for:
keep Opus 4.6 as primary, fail over to MiniMax M2.1.
env
MINIMAX_API_KEY
"sk-..."
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
Optional: Local via LM Studio (manual)
Best for:
local inference with LM Studio.
We have seen strong results with MiniMax M2.1 on powerful hardware (e.g. a
desktop/server) using LM Studio’s local server.
Configure manually via
openclaw.json
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
Configure via
openclaw configure
Use the interactive config wizard to set MiniMax without editing JSON:
Run
openclaw configure
Select
Model/auth
Choose
MiniMax M2.1
Pick your default model when prompted.
Configuration options
models.providers.minimax.baseUrl
: prefer
https://api.minimax.io/anthropic
(Anthropic-compatible);
https://api.minimax.io/v1
is optional for OpenAI-compatible payloads.
models.providers.minimax.api
: prefer
anthropic-messages
openai-completions
is optional for OpenAI-compatible payloads.
models.providers.minimax.apiKey
: MiniMax API key (
MINIMAX_API_KEY
models.providers.minimax.models
: define
name
reasoning
contextWindow
maxTokens
cost
agents.defaults.models
: alias models you want in the allowlist.
models.mode
: keep
merge
if you want to add MiniMax alongside built-ins.
Notes
Model refs are
minimax/<model>
Coding Plan usage API:
https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains
(requires a coding plan key).
Update pricing values in
models.json
if you need exact cost tracking.
Referral link for MiniMax Coding Plan (10% off):
https://platform.minimax.io/subscribe/coding-plan?code=DbXJTRClnb&source=link
See
/concepts/model-providers
for provider rules.
Use
openclaw models list
and
openclaw models set minimax/MiniMax-M2.1
to switch.
Troubleshooting
“Unknown model: minimax/MiniMax-M2.1”
This usually means the
MiniMax provider isn’t configured
(no provider entry
and no MiniMax auth profile/env key found). A fix for this detection is in
2026.1.12
(unreleased at the time of writing). Fix by:
Upgrading to
2026.1.12
(or run from source
main
), then restarting the gateway.
Running
openclaw configure
and selecting
MiniMax M2.1
, or
Adding the
models.providers.minimax
block manually, or
Setting
MINIMAX_API_KEY
(or a MiniMax auth profile) so the provider can be injected.
Make sure the model id is
case‑sensitive
minimax/MiniMax-M2.1
minimax/MiniMax-M2.1-lightning
Then recheck with:
openclaw
models
list
Moonshot AI
OpenCode Zen

---
## Providers > Models

[Source: https://docs.openclaw.ai/providers/models]

OpenClaw can use many LLM providers. Pick one, authenticate, then set the default
model as
provider/model
Highlight: Venice (Venice AI)
Venice is our recommended Venice AI setup for privacy-first inference with an option to use Opus for the hardest tasks.
Default:
venice/llama-3.3-70b
Best overall:
venice/claude-opus-45
(Opus remains the strongest)
See
Venice AI
Quick start (two steps)
Authenticate with the provider (usually via
openclaw onboard
Set the default model:
agents
defaults
model
primary
"anthropic/claude-opus-4-6"
} } }
Supported providers (starter set)
OpenAI (API + Codex)
Anthropic (API + Claude Code CLI)
OpenRouter
Vercel AI Gateway
Cloudflare AI Gateway
Moonshot AI (Kimi + Kimi Coding)
Synthetic
OpenCode Zen
Z.AI
GLM models
MiniMax
Venice (Venice AI)
Amazon Bedrock
Qianfan
For the full provider catalog (xAI, Groq, Mistral, etc.) and advanced configuration,
see
Model providers
Model Providers
Models CLI

---
## Providers > Moonshot

[Source: https://docs.openclaw.ai/providers/moonshot]

# Moonshot AI Documentation Extract

## Overview
Moonshot provides the Kimi API with "OpenAI-compatible endpoints." Users can configure the provider and select from multiple model options including standard, preview, turbo, and thinking variants.

## Setup Instructions

**Moonshot API onboarding:**
```bash
openclaw onboard --auth-choice moonshot-api-key
```

**Kimi Coding onboarding:**
```bash
openclaw onboard --auth-choice kimi-code-api-key
```

## Available Models

The documentation lists five Kimi K2 model identifiers:
- `kimi-k2.5`
- `kimi-k2-0905-preview`
- `kimi-k2-turbo-preview`
- `kimi-k2-thinking`
- `kimi-k2-thinking-turbo`

## Key Configuration Details

**Important distinction:** "Moonshot and Kimi Coding are separate providers. Keys are not interchangeable, endpoints differ, and model refs differ."

**Model reference formatting:**
- Moonshot uses prefix format: `moonshot/<modelId>`
- Kimi Coding uses prefix format: `kimi-coding/<modelId>`

**Default models:**
- Moonshot: `moonshot/kimi-k2.5`
- Kimi Coding: `kimi-coding/k2p5`

## Technical Specifications

All models feature:
- 256,000 token context window
- 8,192 maximum output tokens
- Zero cost (pricing shown as 0)
- Text input support

Two models include reasoning capabilities: `kimi-k2-thinking` and `kimi-k2-thinking-turbo`

## Endpoint Options

Users can select between international and China endpoints: `https://api.moonshot.ai/v1` or `https://api.moonshot.cn/v1`

---
## Providers > Openai

[Source: https://docs.openclaw.ai/providers/openai]

OpenAI provides developer APIs for GPT models. Codex supports
ChatGPT sign-in
for subscription
access or
API key
sign-in for usage-based access. Codex cloud requires ChatGPT sign-in.
Option A: OpenAI API key (OpenAI Platform)
Best for:
direct API access and usage-based billing.
Get your API key from the OpenAI dashboard.
CLI setup
openclaw
onboard
--auth-choice
openai-api-key
# or non-interactive
openclaw
onboard
--openai-api-key
"$OPENAI_API_KEY"
Config snippet
env
OPENAI_API_KEY
"sk-..."
agents
defaults
model
primary
"openai/gpt-5.1-codex"
} } }
Option B: OpenAI Code (Codex) subscription
Best for:
using ChatGPT/Codex subscription access instead of an API key.
Codex cloud requires ChatGPT sign-in, while the Codex CLI supports ChatGPT or API key sign-in.
CLI setup (Codex OAuth)
# Run Codex OAuth in the wizard
openclaw
onboard
--auth-choice
openai-codex
# Or run OAuth directly
openclaw
models
auth
login
--provider
openai-codex
Config snippet (Codex subscription)
agents
defaults
model
primary
"openai-codex/gpt-5.3-codex"
} } }
Notes
Model refs always use
provider/model
(see
/concepts/models
Auth details + reuse rules are in
/concepts/oauth
Anthropic
OpenRouter

---
## Providers > Opencode

[Source: https://docs.openclaw.ai/providers/opencode]

recommended by the OpenCode team for coding agents.
It is an optional, hosted model access path that uses an API key and the
opencode
provider.
Zen is currently in beta.
CLI setup
openclaw
onboard
--auth-choice
opencode-zen
# or non-interactive
openclaw
onboard
--opencode-zen-api-key
"$OPENCODE_API_KEY"
Config snippet
env
OPENCODE_API_KEY
"sk-..."
agents
defaults
model
primary
"opencode/claude-opus-4-6"
} } }
Notes
OPENCODE_ZEN_API_KEY
is also supported.
You sign in to Zen, add billing details, and copy your API key.
OpenCode Zen bills per request; check the OpenCode dashboard for details.
MiniMax
GLM Models

---
## Providers > Openrouter

[Source: https://docs.openclaw.ai/providers/openrouter]

endpoint and API key. It is OpenAI-compatible, so most OpenAI SDKs work by switching the base URL.
CLI setup
openclaw
onboard
--auth-choice
apiKey
--token-provider
openrouter
--token
"$OPENROUTER_API_KEY"
Config snippet
env
OPENROUTER_API_KEY
"sk-or-..."
agents
defaults
model
primary
"openrouter/anthropic/claude-sonnet-4-5"
Notes
Model refs are
openrouter/<provider>/<model>
For more model/provider options, see
/concepts/model-providers
OpenRouter uses a Bearer token with your API key under the hood.
OpenAI
Litellm

---
## Providers > Qianfan

[Source: https://docs.openclaw.ai/providers/qianfan]

Qianfan Provider Guide
Qianfan is Baidu’s MaaS platform, provides a
unified API
that routes requests to many models behind a single
endpoint and API key. It is OpenAI-compatible, so most OpenAI SDKs work by switching the base URL.
Prerequisites
A Baidu Cloud account with Qianfan API access
An API key from the Qianfan console
OpenClaw installed on your system
Getting Your API Key
Visit the
Qianfan Console
Create a new application or select an existing one
Generate an API key (format:
bce-v3/ALTAK-...
Copy the API key for use with OpenClaw
CLI setup
openclaw
onboard
--auth-choice
qianfan-api-key
Related Documentation
OpenClaw Configuration
Model Providers
Agent Setup
Qianfan API Documentation
Synthetic

---
## Providers > Synthetic

[Source: https://docs.openclaw.ai/providers/synthetic]

Synthetic exposes Anthropic-compatible endpoints. OpenClaw registers it as the
synthetic
provider and uses the Anthropic Messages API.
Quick setup
Set
SYNTHETIC_API_KEY
(or run the wizard below).
Run onboarding:
openclaw
onboard
--auth-choice
synthetic-api-key
The default model is set to:
synthetic/hf:MiniMaxAI/MiniMax-M2.1
Config example
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
Note: OpenClaw’s Anthropic client appends
/v1
to the base URL, so use
https://api.synthetic.new/anthropic
(not
/anthropic/v1
). If Synthetic changes
its base URL, override
models.providers.synthetic.baseUrl
Model catalog
All models below use cost
(input/output/cache).
Model ID
Context window
Max tokens
Reasoning
Input
hf:MiniMaxAI/MiniMax-M2.1
192000
65536
false
text
hf:moonshotai/Kimi-K2-Thinking
256000
8192
true
text
hf:zai-org/GLM-4.7
198000
128000
false
text
hf:deepseek-ai/DeepSeek-R1-0528
128000
8192
false
text
hf:deepseek-ai/DeepSeek-V3-0324
128000
8192
false
text
hf:deepseek-ai/DeepSeek-V3.1
128000
8192
false
text
hf:deepseek-ai/DeepSeek-V3.1-Terminus
128000
8192
false
text
hf:deepseek-ai/DeepSeek-V3.2
159000
8192
false
text
hf:meta-llama/Llama-3.3-70B-Instruct
128000
8192
false
text
hf:meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8
524000
8192
false
text
hf:moonshotai/Kimi-K2-Instruct-0905
256000
8192
false
text
hf:openai/gpt-oss-120b
128000
8192
false
text
hf:Qwen/Qwen3-235B-A22B-Instruct-2507
256000
8192
false
text
hf:Qwen/Qwen3-Coder-480B-A35B-Instruct
256000
8192
false
text
hf:Qwen/Qwen3-VL-235B-A22B-Instruct
250000
8192
false
text + image
hf:zai-org/GLM-4.5
128000
128000
false
text
hf:zai-org/GLM-4.6
198000
128000
false
text
hf:deepseek-ai/DeepSeek-V3
128000
8192
false
text
hf:Qwen/Qwen3-235B-A22B-Thinking-2507
256000
8192
true
text
Notes
Model refs use
synthetic/<modelId>
If you enable a model allowlist (
agents.defaults.models
), add every model you
plan to use.
See
Model providers
for provider rules.
Z.AI
Qianfan

---
## Providers > Vercel Ai Gateway

[Source: https://docs.openclaw.ai/providers/vercel-ai-gateway]

provides a unified API to access hundreds of models through a single endpoint.
Provider:
vercel-ai-gateway
Auth:
AI_GATEWAY_API_KEY
API: Anthropic Messages compatible
Quick start
Set the API key (recommended: store it for the Gateway):
openclaw
onboard
--auth-choice
ai-gateway-api-key
Set a default model:
agents
defaults
model
primary
"vercel-ai-gateway/anthropic/claude-opus-4.6"
Non-interactive example
openclaw
onboard
--non-interactive
--mode
local
--auth-choice
ai-gateway-api-key
--ai-gateway-api-key
"$AI_GATEWAY_API_KEY"
Environment note
If the Gateway runs as a daemon (launchd/systemd), make sure
AI_GATEWAY_API_KEY
is available to that process (for example, in
~/.openclaw/.env
or via
env.shellEnv
Amazon Bedrock
Moonshot AI

---
## Providers > Zai

[Source: https://docs.openclaw.ai/providers/zai]

models. It provides REST APIs for GLM and uses API keys
for authentication. Create your API key in the Z.AI console. OpenClaw uses the
zai
provider
with a Z.AI API key.
CLI setup
openclaw
onboard
--auth-choice
zai-api-key
# or non-interactive
openclaw
onboard
--zai-api-key
"$ZAI_API_KEY"
Config snippet
env
ZAI_API_KEY
"sk-..."
agents
defaults
model
primary
"zai/glm-5"
} } }
Notes
GLM models are available as
zai/<model>
(example:
zai/glm-5
See
/providers/glm
for the model family overview.
Z.AI uses Bearer auth with your API key.
GLM Models
Synthetic---
## Providers > Mistral

[Source: https://docs.openclaw.ai/providers/mistral]

# Mistral Integration Documentation

OpenClaw provides comprehensive Mistral support across multiple use cases.

## Setup Instructions

The CLI onboarding process accepts Mistral credentials interactively or via command-line argument:

```bash
openclaw onboard --auth-choice mistral-api-key
# or non-interactive
openclaw onboard --mistral-api-key "$MISTRAL_API_KEY"
```

## LLM Provider Configuration

To use Mistral as your primary language model:

```json5
{
  env: { MISTRAL_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "mistral/mistral-large-latest" } } },
}
```

## Audio Transcription Setup

Voxtral enables audio processing capabilities:

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        models: [{ provider: "mistral", model: "voxtral-mini-latest" }],
      },
    },
  },
}
```

## Key Configuration Details

- **Authentication**: Uses the `MISTRAL_API_KEY` environment variable
- **Base URL**: Defaults to `https://api.mistral.ai/v1`
- **Default LLM Model**: `mistral-large-latest`
- **Audio Model**: `voxtral-mini-latest` for transcription
- **Embedding Support**: Memory search via `mistral-embed` at `/v1/embeddings`
- **Transcription Endpoint**: `/v1/audio/transcriptions`
