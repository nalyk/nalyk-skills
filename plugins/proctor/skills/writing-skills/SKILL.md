---
name: writing-skills
description: Use when creating new skills, editing existing skills, or verifying skills work before deployment
---

# Writing Skills

**Writing skills IS Test-Driven Development applied to process
documentation.**

Write test cases (pressure scenarios with subagents), watch them fail
(baseline behavior), write the skill (documentation), watch tests pass
(agents comply), refactor (close loopholes).

**Core principle:** If you didn't watch an agent fail without the skill,
you don't know if the skill teaches the right thing.

## What is a Skill?

A **skill** is a reference guide for proven techniques, patterns, or
tools. Skills help agents find and apply effective approaches.

**Skills are:** Reusable techniques, patterns, tools, reference guides.

**Skills are NOT:** Narratives about how you solved a problem once.

## TDD Mapping for Skills

| TDD Phase | Skill Equivalent |
|-----------|-----------------|
| Write failing test | Write scenario an agent handles badly |
| Watch it fail | Run agent WITHOUT skill, confirm bad behavior |
| Write minimal code | Write skill addressing failure |
| Watch it pass | Run agent WITH skill, confirm improvement |
| Refactor | Tighten loopholes, improve clarity |

## Skill Structure

```markdown
---
name: skill-name
description: When to use this skill — triggers for invocation
---

# Skill Title

## Overview
Core principle and purpose.

## When to Use
Clear triggers.

## The Process
Step-by-step methodology.

## Red Flags / Rationalizations
Common failure modes the skill prevents.
```

## Key Design Principles

- **One core principle per skill.** Everything flows from it.
- **Rationalization tables.** Agents rationalize. Preempt every excuse.
- **Positive instructions.** "Do X" is stronger than "don't do Y."
- **Red-green evidence.** Every claim about skill effectiveness needs
  before/after agent transcripts.

## Testing Skills

Run adversarial pressure tests:
1. Scenarios where the agent would normally skip the process
2. Edge cases where the skill's rules are ambiguous
3. Multi-session scenarios testing skill persistence
4. Scenarios testing interaction with Proctor's hook enforcement

## Structural Elements

Skills can use XML elements for enforcement:

- `<HARD-GATE>` — marks a point where the agent MUST stop and get
  approval before proceeding. The brainstorming skill uses this.
- `<SUBAGENT-STOP>` — prevents subagents from loading a skill meant
  only for the controller. The using-proctor skill uses this.

## File Conventions

- Skill location: `plugins/<plugin>/skills/<skill-name>/SKILL.md`
- Frontmatter is required: `name` and `description` fields
- Description should state WHEN to use, not WHAT it does

## Cross-References

- **Testing methodology:** proctor:test-driven-development — the TDD
  cycle this skill applies to process documentation
- **Hook interaction:** Skills are tracked by the `skill.prompt` hook.
  Proctor injects live discipline state into every skill prompt.
