---
description: "Check debate system health - probes agy/codex/qwen challenger CLIs with live auth round-trips and caches the working list."
allowed-tools: Bash
---

# Debate System Health Check

Run the doctor script (it probes each CLI with a live "DEBATE_AUTH_OK" round-trip, prints the capability level, and caches working challengers to `/tmp/debate-available-challengers`):

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.sh"
```

Relay the script's output to the user verbatim.

Then:
- **DISABLED** (0 challengers): tell the user debates will refuse to run until at least one challenger CLI (agy, codex, or qwen) is installed and authenticated, using the install hints the script printed.
- **MINIMAL/FUNCTIONAL/OPTIMAL**: confirm `/debate <topic>` is ready; more challengers = more perspective diversity.

Note: the legacy `gemini` CLI is dead and unsupported — a resolving `gemini` binary is likely a stale shim. The Gemini perspective is provided by `agy` (Antigravity CLI), pinned to a Gemini model.
