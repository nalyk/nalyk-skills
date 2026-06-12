---
name: organon
description: "Philosophical reasoning engine — auto-detects decision analysis vs. code review, selects depth, applies the relevant principles from 20 philosophers."
---

# /organon

Invoke the `organon` skill in **auto-detect mode**: classify the arguments (or the
current conversation context) as a decision or a review, auto-select depth, execute.

Optional depth override as first argument: `quick`, `standard`, or `deep`
(e.g. `/organon deep should we use microservices or a monolith`).

Modes, depth selection, and output format are defined by the skill and its references.
