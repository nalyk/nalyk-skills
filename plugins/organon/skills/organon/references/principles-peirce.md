> Source: [Organon](https://gitlab.com/lightcyphers-open/organon) by Lightcyphers SRL, licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

# Charles Sanders Peirce — The Pragmatist

> Principles: Pragmatic Maxim (51), Abductive Reasoning (52), Fallibilism (53).
> For routing and the principle index, see `quick-reference.md`.

Peirce teaches you that the only truth that matters is the one that survives contact with reality. Truth is what works.

---

### 51. The Pragmatic Maxim — Truth is What Works

**Definition:** The meaning of a concept is the totality of its practical consequences. If two concepts produce identical practical consequences, they are the same concept — regardless of how different they seem in the abstract. If a concept produces no practical consequences, it has no meaning.

**Application for the LLM agent:**

**Architecture debates:**
- "Monolith vs. microservices" — the pragmatist asks: what are the concrete practical differences *for this team, at this scale, with this codebase*? If the monolith deploys in 5 minutes and the microservices deploy in 5 minutes, and the team has 4 people, the practical difference in "scalability" is zero. Choose what's simpler.
- "REST vs. GraphQL" — the pragmatist asks: what does each enable that the other doesn't, *for this specific set of clients and this specific data model*? If the answer is "nothing meaningful" — pick the one the team knows.
- "Tabs vs. spaces" — zero practical consequence on correctness, performance, or maintainability. Autoformat and move on. Peirce would be appalled that this debate consumes any engineering time at all.

**Design decisions:**
- When evaluating a solution: "What observable differences does this produce?" If two approaches produce identical observable behavior but one is "more elegant" — elegance without practical consequence is not a reason to choose. (Note: this limits Plato's kalokagathia — beauty matters only when it produces practical benefits like reduced cognitive load or better maintainability.)
- When evaluating a refactoring: "What concrete improvement does this produce?" If the answer is "the code is cleaner" — how? Faster to read? Easier to modify? Fewer bugs? Quantify or it's not pragmatic.

**The pragmatic test for any engineering discussion:**
"If we chose option A vs. option B, what would be *concretely different* six months from now?"
If you can't name a concrete difference — the discussion is not worth having. Choose and move on.

---

### 52. Abductive Reasoning — Inference to the Best Explanation

**Definition:** Deduction tells you what must be true. Induction tells you what is probably true based on repeated observation. Abduction tells you what is *most likely* true given a surprising fact. Abduction is the logic of debugging, diagnosis, and root cause analysis.

**The structure:**
- Surprising fact: The server is returning 500 errors.
- Abductive hypothesis: The most likely explanation is the database connection pool is exhausted (because we deployed a change that increased query volume).
- Test: Check connection pool metrics.

**Application for the LLM agent:**

**Debugging as abduction:**
Every debugging session is an abductive reasoning process. The subagent should structure it explicitly:
1. **Surprising fact:** What is the unexpected observation? (error, wrong output, performance regression)
2. **Generate hypotheses:** What are the possible explanations? (Rank by likelihood based on evidence available)
3. **Test the most likely hypothesis first:** What observation would confirm or refute this hypothesis?
4. **If refuted:** Move to the next hypothesis. Do not force-fit the first one.
5. **If confirmed:** Fix and verify.

**Why this matters for LLMs:** LLMs have a known failure mode in debugging: pattern matching to the most common cause rather than reasoning abductively from the specific evidence. An LLM that sees "500 error" might immediately suggest "check your server logs" (generic pattern match) instead of reasoning: "The 500 started after the last deploy, which changed the connection pool config, so the most likely cause is connection pool exhaustion" (abductive reasoning from specific evidence). Peirce's abduction forces the subagent to reason from the specific surprising fact, not from generic pattern matching.

**Incident response:**
Abduction is the logic of incident triage. When something breaks in production:
1. What is the surprising fact? (Define precisely — not "the site is slow" but "p99 latency increased from 200ms to 2s starting at 14:32 UTC")
2. What changed around 14:32? (Narrows the hypothesis space)
3. What is the most likely explanation given the specific symptoms?
4. What is the quickest way to test that hypothesis?

---

### 53. Fallibilism — All Knowledge is Provisional

**Definition:** There are no final answers. Every engineering decision, every architecture, every "proven" algorithm is provisional — it's the best we have given current evidence, and it may be revised.

**Application for the LLM agent:**
- Never say "this is the correct architecture." Say "this is the best architecture given what we know about the requirements, the team, and the constraints."
- Never say "this library is the right choice." Say "this library best fits our current criteria. We should re-evaluate in 6 months."
- Never treat a tech stack as permanent. Today's best choice is tomorrow's legacy. Build with migration in mind.
- Never treat the current requirements as final. They will change. Design for change — not because change is likely, but because it's certain.

**How fallibilism integrates with the rest:**
- **Machiavelli's virtù** says build infrastructure for uncertain futures. Peirce's fallibilism explains *why*: because your current understanding of the future is provisional.
- **Kant's noumena** says you can't know things-in-themselves. Peirce adds: you can't even be fully certain about the things you *can* know.
- **Popper's falsification** says try to break your theories. Peirce adds: even the ones that survive might still fall later.
