# Flutter Expert

Flutter/Dart development skill — architecture decisions, state management, code templates, and quality gates for production apps.

## What It Does

A single-skill knowledge plugin: a lean SKILL.md router plus four reference files loaded on demand.

| Reference | Covers |
|-----------|--------|
| `architecture-patterns.md` | Small/Medium/Large/Monorepo scaffolds, DI, flavors, Failure hierarchy, migration |
| `state-management.md` | Riverpod 3, BLoC/Cubit, Provider, comparison matrix |
| `code-templates.md` | App entry point, Dio ApiClient (flavor-gated logging, 401 refresh), Freezed 3, GoRouter, forms, tests, i18n |
| `quality-gates.md` | flutter_lints 6 rule set, CI/CD, coverage, pre-commit hooks, Kotlin DSL release signing, profiling |

Snippets are version-agnostic: no pinned dependency versions — add packages with `flutter pub add` and verify current majors on pub.dev. Syntax targets current majors (Riverpod 3, freezed 3, go_router 16).

## Install

```bash
/plugin install flutter@nalyk-skills
```

## Usage

The skill activates only on a Flutter/Dart signal — a `pubspec.yaml` in the project or an explicit mention of Flutter/Dart. Examples:

- "Scaffold a feature-first Flutter project with authentication"
- "Set up Riverpod state management"
- "Add CI/CD quality gates to my Flutter project"
- "Debug this iOS build error in my Flutter app"

Environment orientation (`flutter doctor` etc.) runs only for new projects or unknown environments, not for targeted edits.
