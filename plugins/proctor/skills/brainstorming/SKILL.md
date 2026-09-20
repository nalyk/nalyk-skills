---
name: brainstorming
description: Use before any creative work — creating features, building components, adding functionality, or modifying behavior. Explores intent, requirements and design before implementation.
---

# Brainstorming Ideas Into Designs

Turn ideas into fully formed designs through collaborative dialogue.

Classify the request, work through the path, get approval.

## Establish Shared Understanding

1. **Discover intent.** Identify the intended outcome, who it is for, and
   what success looks like. When missing, ask one focused question about
   purpose before proposing features.
2. **Write back your understanding.** Summarize outcome, constraints,
   success criteria. Separate what they said from assumptions. Invite
   correction.
3. **Carry intent into the design.** Preserve the agreed understanding in
   the selected path's design artifact.

<HARD-GATE>
Before taking any implementation action — writing product code,
scaffolding, installing dependencies, creating a project — complete the
selected path's prerequisites. A reply approves the stage actually
presented. Approval of an idea does not approve artifacts that do not
exist yet.
</HARD-GATE>

## Three Paths

Classify the request and say the classification out loud so your human
partner can override it:

- **Spike** — a feasibility question ("can we...", "is it possible...",
  "quick and dirty"). Output is an answer, not code you keep. Present the
  question and probe in 2-3 sentences, get a nod, investigate. Report
  findings as a recommendation. Anything built stays labeled throwaway.

- **Bounded** — a well-scoped change to code that already exists: a new
  flag, a small endpoint, a one-file fix. Understanding the kind of app
  is not enough — bounded means the flow you are changing is already here
  to read. If there is no existing flow, the task is not bounded. Ask
  clarifying questions, present a short design IN CHAT, and STOP.
  Implementation starts only after your human partner says yes.

- **Architectural** — new projects, new subsystems, changes that
  restructure how components fit together. Full process: questions,
  approaches, sectioned design, written spec, then the writing-plans
  skill.

When in doubt, take the heavier path. Nothing downgrades mid-task.

## Red Flags

| Thought | Reality |
|---------|---------|
| "This is too simple to need a design" | Follow the selected path. |
| "I'll call it bounded and skip the spec" | Reaching for a label to skip work IS the doubt. |
| "It's bounded — I'll start while they read it" | The gate is the approval, not the design's length. |
| "Bounded because I know this kind of app" | Bounded measures the repo, not your familiarity. |
| "The spike works, so I'll keep the code" | Spike output is an answer. Keeping the code is a new request. |
| "It grew, but I'm almost done" | Hidden complexity upgrades the path. Stop and say so. |

## Checklist

**Spike:**
1. Explore project context
2. Present question + probe plan (2-3 sentences)
3. Get approval
4. Investigate cheaply
5. Report findings

**Bounded:**
1. Explore project context
2. Ask clarifying questions (one at a time)
3. Present short design in chat
4. Get approval — STOP until explicit yes
5. Implement (TDD applies)

**Architectural:**
1. Explore project context
2. Ask clarifying questions (one at a time)
3. Propose 2-3 approaches with trade-offs
4. Present design in sections, get approval per section
5. Write design doc to `docs/plans/YYYY-MM-DD-<topic>-design.md`
6. Self-review the spec
7. User reviews written spec
8. Invoke proctor:writing-plans
