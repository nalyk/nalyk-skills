> Source: [Organon](https://gitlab.com/lightcyphers-open/organon) by Lightcyphers SRL, licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

# Henri Poincar&eacute; &mdash; The Conventionalist

> Principles: Conventionalism (54), Structural Stability (55), Creative Recombination (56).
> For routing and the principle index, see `quick-reference.md`.

Poincar&eacute; teaches you that when formalisms are equivalent, the choice between them is a convention &mdash; and the right convention is the one that remains stable when the world shifts under it.

---

### 54. Conventionalism &mdash; Equivalent Formalizations Are Conventions

**Definition:** When two or more designs, representations, or formalizations are formally equivalent &mdash; producing identical observable behavior &mdash; the choice between them is a convention, not a discovery. Make the choice explicitly. Document *why* this convention was chosen. Optimize for simplicity, coherence with existing conventions, and stability under future change.

**Application for the LLM agent:**

**Language design:**
- When two syntax choices parse identically and compile to the same target: this is a convention. Choose for readability and coherence with the language's existing idioms. Document the convention in the spec.
- When two type system designs are equally sound: choose the one that requires fewer special cases as new types are added. That's structural stability (Principle 55) applied to conventions.

**Architecture decisions:**
- "Should we represent errors as sum types or as exceptions?" If both are expressible in the target runtime, this is a convention. Choose based on which convention the rest of the codebase already follows (coherence) and which requires fewer changes when new error types are added (stability).
- "Should module paths use dots or slashes?" Convention. Pick and commit. The worst outcome is inconsistency &mdash; mixing conventions is worse than either convention alone.

**The conventionalist test for any engineering debate:**
1. Are the two options formally equivalent? (Same observable behavior, same expressiveness)
2. If yes &mdash; this is a convention. Stop debating truth.
3. Choose by: (a) simplicity, (b) coherence with existing conventions, (c) stability under perturbation.
4. Document the convention. Future maintainers need to know this was a *choice*, not a *discovery*.

---

### 55. Structural Stability (Analysis Situs) &mdash; Topology of Design

**Definition:** A structurally stable design is one where small changes in requirements, inputs, or environment produce proportionally small changes in the implementation. Fragile designs amplify perturbations: one requirement change cascades through many modules. Stable designs absorb perturbations: the change stays local.

**Application for the LLM agent:**

**Design evaluation:**
- When choosing between two architectures, ask: "If the requirements shift by 10%, which design absorbs the change locally and which propagates it globally?" The one that absorbs locally is more structurally stable.
- When a single requirement change touches 12 files across 4 modules: the design has poor structural stability. The abstraction boundaries are in the wrong place.

**System extension points:**
- A system where adding a new variant requires changes in 3 places is more stable than one requiring changes in 15 places. Count the perturbation propagation.
- A rule that generalizes (one widening rule, one dispatch mechanism) is more structurally stable than explicit special cases everywhere, because adding the next case perturbs fewer call sites.

**API design:**
- An API where adding a new field to a response is backward-compatible (structural stability) vs. one where any schema change breaks all clients (fragile). Choose the stable topology.
- Additive-only APIs (you can add fields but never remove them) are topologically stable. Breaking-change APIs are topologically fragile.

**The structural stability test:**
"If requirement X changes by a small amount, how many files/modules/tests need to change?" If the answer is "proportionally small" &mdash; the design is stable. If the answer is "it cascades everywhere" &mdash; the abstraction boundaries need rethinking.

---

### 56. Creative Recombination &mdash; Invention as Unconscious Selection

**Definition:** When stuck on a problem, decompose it into known sub-patterns and allow unexpected *combinations* of those patterns to suggest the solution. The best solutions are not wholly novel &mdash; they are surprising recombinations of familiar components. The aesthetic signal ("this feels elegant") is a reliable heuristic for structural soundness.

**Application for the LLM agent:**

**When stuck on a design problem:**
1. **Decompose:** What are the known sub-patterns? (design patterns, existing library APIs, solved subproblems)
2. **Recombine:** What happens if you apply pattern A from domain X to the structure of problem Y? What if you compose two simple patterns that have never been composed in this codebase?
3. **Aesthetic filter:** Does the combination feel simpler than expected? Does it unify two previously separate concerns? Does it make a special case disappear? If yes &mdash; investigate further.

**Refactoring:**
- The best refactorings are recombinations: "What if we treat X and Y as instances of the same pattern?" This is Poincar&eacute;'s creative recombination applied to existing code. The sign that a recombination is good: it eliminates duplication not by extracting a helper, but by revealing a deeper structural similarity.

**Language and API design:**
- Pattern matching combined with exhaustiveness checking combined with guard clauses: each comes from a different tradition, and the combination is more powerful than any individual component.
- The pipe operator recombines Unix pipes with function application. The combination is so natural it feels inevitable &mdash; which is Poincar&eacute;'s aesthetic signal.

**The recombination heuristic:**
"What known patterns from other domains, when combined, would solve this problem more simply than a purpose-built solution?" If the recombination eliminates a special case or unifies two separate mechanisms &mdash; it's likely correct.

---
