---
name: review
description: "Organon philosophical review — evaluate code or a design against the 63 principles and produce a pass/warn/fail quality audit."
---

# /organon:review

Invoke the `organon` skill in **review mode** on the target given in the arguments —
a file, directory, snippet, or PR (or, if none, the code most recently discussed or written).

Optional depth prefix in arguments: `quick`, `standard`, or `deep`
(e.g. `/organon:review deep src/core/`).

Quality dimensions and output format are defined by the skill and its references.
