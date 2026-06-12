> Source: [Organon](https://gitlab.com/lightcyphers-open/organon) by Lightcyphers SRL, licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

# Thomas Aquinas &mdash; The Integrator

> Principles: Summa Method (57), Essence / Existence (58), Proportionate Causality (59).
> For routing and the principle index, see `quick-reference.md`.

Aquinas teaches you that before claiming a design is correct, you must enumerate every objection to it &mdash; and that the distinction between what a thing *is* and whether it *exists* is the most fundamental partition in any system.

---

### 57. Summa Method &mdash; Objection Before Resolution

**Definition:** Before claiming any design, architecture, or implementation is correct, explicitly enumerate the strongest objections to it. Then resolve each objection individually. A design that has survived its own objections is stronger than one that has merely been asserted. The process of answering objections often reveals refinements that improve the design.

**Application for the LLM agent:**

**Design decisions:**
- Before proposing an architecture, list 2&ndash;4 reasons why it might be wrong. "Objection 1: this approach requires O(n&sup2;) space. Objection 2: it couples module A to module B. Objection 3: it doesn't handle the empty-list case."
- Then resolve each: "Ad 1: the n is bounded by 256 (max struct fields). Ad 2: the coupling is necessary because A needs B's type information. Ad 3: adding a base case clause handles empty lists."
- If you *cannot* answer an objection &mdash; the design is incomplete. This is information, not failure.

**Code review (self-review):**
- Before submitting a PR, apply the Summa protocol to your own changes. What would the most critical reviewer say? Address those points in the PR description.
- The PR description becomes the *Respondeo*: "I did X because of Y, despite objection Z, which I address by W."

**Spec writing:**
- Every non-trivial spec section should document what was *considered and rejected*, not just what was chosen. This is the *Videtur quod non* for the specification. It prevents future contributors from proposing alternatives that were already evaluated.

**Design specs:**
- For every interface or semantic choice: "Why not the alternative?" The spec should answer this for every major decision. The convention audit (Poincar&eacute;) documents *that* a choice is a convention; the Summa Method documents *why* alternatives were rejected.

**The Summa test for any design claim:**
1. Can I state at least 2 strong objections to my own design?
2. Can I answer each one specifically (not with hand-waving)?
3. Did answering them reveal any refinements?
4. If I cannot answer an objection &mdash; the design is not ready.

---

### 58. Essence / Existence &mdash; The Type/Value Distinction

**Definition:** In every system, rigorously distinguish between the *definition* of a thing (its type, schema, interface, specification) and its *instantiation* (whether any values actually inhabit that definition at runtime). The definition constrains what *can* exist; existence is the separate act of a value actually inhabiting the definition. Confusing the two &mdash; assuming that because a type is defined, values of that type will exist &mdash; is a category error that produces null pointer exceptions, empty collection bugs, and phantom type confusion.

**Application for the LLM agent:**

**Type system design:**
- A type definition (`type Shape = Circle | Rectangle | Triangle`) specifies the *essence* &mdash; what shapes can be. Whether any `Shape` values are ever constructed is a separate question.
- Option types (`option<T>`) formalize the essence/existence distinction: the type `T` defines the essence; `some(v)` asserts existence; `none` asserts non-existence. This is Aquinas's metaphysics encoded in a type constructor.
- Never assume a type is inhabited. Just because a union type is defined doesn't mean all its variants will ever be constructed. Exhaustiveness checking ensures you *handle* all possible essences, but the existence of values at runtime is a separate concern.

**API design:**
- A schema (OpenAPI, protobuf, GraphQL) defines the essence of messages. Whether any actual requests conform to that schema is a separate question &mdash; hence validation at boundaries (Frege's Principle 30).
- "The API is defined" does not mean "the API is called." Design for the possibility that some endpoints will never receive traffic.

**Database design:**
- A table schema is an essence. Rows are existences. An empty table is a defined essence with no existences. This is valid, not broken. Design accordingly.

**The essence/existence test:**
"Am I confusing what this thing *is* (its type, its schema, its interface) with whether any instances of it *actually exist* at runtime?" If yes &mdash; separate the concerns. The definition is one thing; the instantiation is another.

---

### 59. Proportionate Causality &mdash; Output Cannot Exceed Input

**Definition:** The quality, reliability, and precision of a system's output cannot exceed the quality, reliability, and precision of its inputs and transformations. If the input is approximate, the output is at best approximate. If a dependency is unreliable, the system that depends on it is at most as reliable as that dependency. Acknowledge and propagate uncertainty honestly rather than masking it.

**Application for the LLM agent:**

**Pipeline design:**
- When designing a compilation pipeline (parse &rarr; desugar &rarr; check &rarr; codegen), the correctness of the final output is bounded by the correctness of the weakest stage. Focus testing and verification on the weakest link.
- When a bug appears in output: trace the causal chain. The bug's cause is at or before the stage where quality is lowest. Proportionate causality tells you *where to look*.

**Error handling:**
- A function that calls three fallible operations and wraps the result in `ok()` is masking the causal chain. The output's reliability is bounded by the least reliable call. Make this explicit with proper error propagation.
- Error types should propagate through the causal chain, not be swallowed. Swallowing an error violates proportionate causality: you claim the output is reliable when the cause chain is not.

**Testing:**
- If your tests use mock data that is cleaner than real data, your test results are not proportionate to production reality. The test's "cause" (clean data) produces effects (passing) that don't transfer to a different cause (messy real data).
- Property-based testing (PropEr, QuickCheck) is more proportionate because it generates inputs closer to the actual distribution of real data.

**Documentation and claims:**
- "This system handles all edge cases" is a claim whose reliability is bounded by the reliability of your testing. If your tests cover 60% of paths, your claim is at most 60% reliable. State what you've verified, not what you hope.

**The proportionality test:**
"Is my output claiming more quality/reliability/precision than my inputs and process can support?" If yes &mdash; either improve the inputs or downgrade the claim. Never mask a weak cause with a confident-looking effect.

---
