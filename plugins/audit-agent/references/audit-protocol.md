# Shared Audit Protocol

Evidence and hygiene standards shared by /jobs-audit, /carlin-audit, and /vibe-audit.

## Evidence Requirements

### Acceptable Evidence
- Direct quotes from code/docs
- Specific file paths and line numbers
- Measurable metrics (response time, LOC, etc.)
- Concrete examples of behavior
- Screenshots or output logs

### Unacceptable Evidence
- "It seems like..." / "Generally speaking..." / "In my opinion..."
- Assumptions without verification
- Hearsay or secondhand information

## Anti-Patterns to Avoid

- **Drive-By Audit:** Skimming questions without depth. Every applicable question deserves real analysis.
- **Benefit of Doubt:** Assuming things work when not verified. Default to skepticism.
- **Generic Answers:** Copy-paste responses that could apply to anything. Be specific.
- **Happy Path Only:** Only considering best-case scenarios. Audits expose problems.
- **Completion Theater:** Box-checking rituals without doing the work. Substance over ceremony — scope honestly, mark non-assessable items N/A with a reason, and report "N/M applicable items assessed."

## Audit Hygiene

- Start fresh for each audit (no assumptions carried over from previous audits)
- Read actual code/content; don't rely on descriptions
- If an item is not assessable for this artifact class, mark it N/A with a one-line reason instead of guessing
- Be consistent in scoring across audits
