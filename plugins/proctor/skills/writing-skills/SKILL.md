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
