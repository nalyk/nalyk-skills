> Source: [Organon](https://gitlab.com/lightcyphers-open/organon) by Lightcyphers SRL, licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

# Machiavelli — Strategic Realism

> Principles: Verità effettuale (19), Fortuna/Virtù (20), Lion/Fox (21), Economy of Force (22), Necessità (23), Occasione (24), Intelligence (25).
> For routing and the principle index, see `quick-reference.md`.

---

## 19. Effectual Truth vs. Imagined Truth — Verità effettuale

**Principle:** Start from observed reality — not from idealized models — or your actions will fail regardless of how virtuous your intentions are.

**Application in engineering:**
- Do not design for the ideal user — design for the actual user (who will paste SQL into the search box, submit the form twice, and use IE11)
- Do not estimate based on uninterrupted focus time — estimate based on actual team velocity with meetings, context switches, and interruptions
- Do not architect for the requirements document — architect for the requirements *plus* the undocumented assumptions, political constraints, and legacy integrations
- Do not assume the API contract will be honored — verify, validate, and handle violations

---

## 20. Fortuna and Virtù

**Principle:** Fortuna is chance — everything outside your control. Virtù is the skill, energy, and adaptability to act effectively regardless of what fortuna delivers. You cannot control fortuna, but you can prepare for it and respond with virtù.

**Key distinction from Stoic praemeditatio:** Epictetus says "anticipate what can go wrong." Machiavelli says "anticipate what can go wrong *and build the infrastructure to respond before it happens*." Praemeditatio is mental. Virtù is structural. You need both.

**Application in engineering:**
- Feature flags are virtù against the fortuna of changing requirements
- Database migrations with rollback scripts are virtù against the fortuna of data corruption
- Blue-green deployments are virtù against the fortuna of production failures
- Multi-region architecture is virtù against the fortuna of datacenter outages
- Comprehensive monitoring is virtù against the fortuna of silent failures

---

## 21. The Lion and the Fox — Force and Cunning

**Principle:** The lion represents direct force — straightforward solutions. The fox represents cunning — indirection, workarounds, creative problem-solving. Neither alone is sufficient.

**Application in engineering:**

| Problem | Lion approach | Fox approach | When to use which |
|---|---|---|---|
| Legacy monolith | Big-bang rewrite | Strangler fig pattern | Fox unless team is large and timeline generous |
| Stakeholder resists investment | Present ROI analysis | Build proof-of-concept, show results | Fox first, lion after proof exists |
| Flaky test suite | Fix every flaky test now | Quarantine, fix incrementally, track metrics | Fox for momentum, lion for completion |
| Performance bottleneck | Optimize the hot path | Cache output, avoid hot path entirely | Fox if time-constrained, lion if fundamental |
| API breaking change | Version and migrate all at once | Facade pattern, gradual migration, deprecation timeline | Fox almost always |
| Impossible deadline | Say "it can't be done" | Negotiate scope: deliver X now, Y and Z in phase 2 | Fox — the lion gets you removed |

---

## 22. Economia della violenza — Economy of Force

**Principle:** When you must do something disruptive, do it once, completely, clearly, with full communication. Do not do it incrementally in a way that creates prolonged pain.

**Application in engineering:**
- Breaking changes: one major version bump with a clear migration guide > 15 minor versions that each subtly break something
- Refactoring: one focused sprint dedicated to refactoring > "we'll refactor as we go" (which means never)
- Technical debt: schedule it, prioritize it, execute it. Don't put it on the backlog to die.
- Sunsetting a feature: announce a date, provide alternatives, execute on the date. Don't "soft-deprecate" indefinitely.
- Team process change: introduce, train, enforce. Don't have two processes in parallel for months.

---

## 23. Necessità — The Tyranny of Circumstances

**Principle:** When there is no ideal option, choose the least harmful one and execute it decisively. Do not waste time searching for the perfect solution when none exists. Acknowledge the option is bad and explain why it is the least bad.

**Application in engineering:**
- Deadline is real and scope is fixed → ship with known limitations, document prominently, plan follow-up
- Only library that does X is unmaintained → use it with an isolation layer, document the risk, schedule replacement
- Two teams need incompatible things → someone loses, or you build an adapter that satisfies neither perfectly. Choose. Communicate.
- Legacy system can't be replaced but must be extended → write the ugly adapter. Comment thoroughly. File the migration ticket. Move on.

**Protocol for necessità decisions:**
```
1. Acknowledge: "There is no clean solution here."
2. Enumerate: List all options including their costs.
3. Rank: Order by least total harm (not by most ideal).
4. Decide: Choose the least harmful.
5. Document: Record WHY this was chosen and what the ideal solution would have been.
6. Timeline: Set a date to revisit if circumstances change.
```

---

## 24. Timing — The Art of Occasione

**Principle:** The right action at the wrong time is the wrong action. The imperfect action at the right time often beats the perfect action too late.

**Application in engineering:**
- Refactoring is most valuable right before a big feature build, not after
- Security patches must be applied when discovered, not "next sprint"
- Architectural decisions lock in early and become exponentially expensive to change. Decide early, even with imperfect information.
- A prototype shown at the right moment (before stakeholders commit to a different direction) is worth more than a polished demo shown after

---

## 25. Reading the Room — Intelligence as Foundation

**Principle:** Before acting, understand the real situation — not the reported, assumed, or wished-for situation. Gather information actively. Verify assumptions. Distrust summaries.

**Application in engineering:**
- Before refactoring: read the actual code, don't trust the architecture diagram. They diverged two years ago.
- Before estimating: look at actual historical velocity, not optimistic projections.
- Before choosing a library: check actual GitHub activity (last commit, open issues, bus factor), not the landing page.
- Before designing an API: talk to actual consumers. Their pain points are your requirements.
- Before optimizing: profile first. The bottleneck is never where you think it is.

**Concrete rule:** Never act on a single source of information when the stakes are high. Cross-reference. Verify.

---
