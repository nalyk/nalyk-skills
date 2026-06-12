# seo-skill — Developer Notes

Deterministic SEO analysis plugin (v3.x). One registered skill
(`skills/seo/SKILL.md`) routes every topic to on-demand files in
`skills/seo/references/`; 7 subagents in `agents/`; Python engine in
`engine/` + `integrations/`.

## Layout

```
.claude-plugin/plugin.json   # Manifest (1 skill via ./skills/, 7 agents)
skills/seo/SKILL.md          # Orchestrator/router — keep lean
skills/seo/references/       # Topic guides + single-source-of-truth refs
  quality-gates.md cwv-thresholds.md schema-types.md
  eeat-framework.md ai-crawlers.md   # canonical data — cite, never restate
  plan-assets/                        # industry planning templates
engine/                      # crawler, scorer (98 checks), link_graph,
                             # auto_fixer, db, report, cli
integrations/                # pagespeed.py, gsc.py
agents/                      # 7 subagents
hooks/regression-check.py    # standalone, invoked explicitly (no hooks.json)
ci/ schema/ tests/
```

## Rules

- All runtime paths use `${CLAUDE_PLUGIN_ROOT}` — never hardcoded cache
  paths, never relative paths from a subagent.
- All numeric scores come from the engine (`python3 -m engine.cli`) — no
  prose scoring rubrics in skills or agents.
- Canonical data (quality gates, CWV thresholds, schema deprecations, AI
  crawler tokens) lives only in the references above; everything else cites
  the path.
- Engine: deterministic (same input → same output), every CheckResult
  carries evidence, degrades gracefully when optional deps are missing.
- Validate: `bash -n` shell scripts, `python3 -m py_compile` python files,
  `jq` JSON files, `python3 -m pytest tests/`.
