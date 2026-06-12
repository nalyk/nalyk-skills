# organon

Philosophical reasoning engine for Claude Code: 63 principles (numbered 0–62, where #0 is Aristotle's Four Causes) from 20 philosophers, applied as a decision engine and code review framework.

> Based on [Organon](https://gitlab.com/lightcyphers-open/organon) by [Lightcyphers SRL](https://lightcyphers.com), licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

## Usage

```
/organon [quick|standard|deep] [topic]     # auto-detect decision vs. review
/organon:decide [depth] <decision>         # structured decision analysis
/organon:review [depth] <file|dir|PR>      # pass/warn/fail quality audit
```

Depth is auto-selected if omitted. **Deep** delegates to the `philosopher-council`
agent, which runs the full 22-step protocol with Summa Method objections and a
confidence rating.

## Structure

- `skills/organon/SKILL.md` — lean router: modes, depth, execution steps
- `skills/organon/references/quick-reference.md` — the routing and numbering authority (situation → principle)
- `skills/organon/references/decision-protocol.md` — the full 22-step protocol
- `skills/organon/references/principles-*.md` — per-principle Definition + Application (13 files)
- `agents/philosopher-council.md` — deep-analysis subagent

## The Philosophers

Aristotle, Marcus Aurelius, Epictetus, Plato, Seneca (what is right) · Machiavelli
(what works) · Leibniz, Boole, Frege, Gödel, Turing, Shannon, Church (what is
computable) · Kant (what can be known) · Popper, Wittgenstein, Peirce (what survives
reality) · Poincaré (how to choose between equivalents) · Aquinas (how to synthesize)
· Swinburne (where to focus investigation).

The complete principle index lives in `skills/organon/references/quick-reference.md`.

## Credits

Original idea and code by Anatolie Golovco.

## License

Based on [Organon](https://gitlab.com/lightcyphers-open/organon) by [Lightcyphers SRL](https://lightcyphers.com).
Licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
