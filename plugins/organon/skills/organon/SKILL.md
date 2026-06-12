---
name: organon
description: >-
  Use when the user invokes /organon, /organon:decide, or /organon:review,
  mentions "organon", asks for a philosophical review or philosophical analysis
  of code or a decision, or asks "what principles apply here". Applies 63
  numbered engineering principles (0-62) from 20 philosophers.
version: 2.0.0
---

# Organon — Philosophical Reasoning Engine

> Source: [Organon](https://gitlab.com/lightcyphers-open/organon) by Lightcyphers SRL, licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Applies 63 principles (numbered 0–62; #0 is Aristotle's Four Causes) from 20 philosophers to engineering decisions and reviews.

## Modes

- **Decision** (`/organon:decide`): analyze an engineering decision, recommend, address objections.
- **Review** (`/organon:review`): evaluate code/design against principle-derived quality dimensions.
- **Auto-detect** (`/organon`): classify the context as decision or review, then proceed.

## Depth

| Level | When | What to load |
|---|---|---|
| Quick | One principle clearly applies | `references/quick-reference.md` only |
| Standard | Multiple principles or ambiguity | + matched `references/principles-*.md` files |
| Deep | Architectural, irreversible, high-stakes | Delegate to the `philosopher-council` agent |

User can force depth: `/organon quick|standard|deep`.

## Execution

1. **Route**: Load `references/quick-reference.md` — the single routing and numbering authority. Match the situation to principles.
2. **Load detail**: Read only the `references/principles-*.md` files for matched principles.
3. **Protocol** (Standard/Deep decisions): follow `references/decision-protocol.md` (22 steps, Aristotle → Peirce).
4. **Deep**: delegate to the `philosopher-council` agent instead of running inline.

## Output

Decision mode:

```
ORGANON — Decision Analysis
Situation / Depth
Applicable Principles: #NN Name (Philosopher) -> concrete action
[Standard/Deep] Protocol steps traversed with findings
[Deep] Summa objections: Videtur quod non N -> Ad N
Decision: [recommendation]
Confidence: High|Medium|Low — N independent signals
```

Review mode:

```
ORGANON — Philosophical Review
Target
Quality Dimensions (each pass|warn|fail + finding):
  Kalokagathia (10), Golden Mean (2), Structural Stability (55),
  Falsifiability (45), Proportionate Causality (59), Beetle in the Box (49),
  Information Theory (36), Categorical Imperative (40), Simplicity Prior (61),
  Paradox of Tolerance (47), Layer Separation (35), Scope Discipline (31)
Violations / Strengths / Recommendation
```

## Reference Files

- `references/quick-reference.md` — situation → principle routing table (authoritative)
- `references/decision-protocol.md` — full 22-step decision protocol
- `references/principles-<philosopher>.md` — per-principle Definition + Application:
  aristotle, stoics, plato, seneca, machiavelli, engineers (Leibniz→Church),
  kant, popper, wittgenstein, peirce, poincare, aquinas, swinburne
