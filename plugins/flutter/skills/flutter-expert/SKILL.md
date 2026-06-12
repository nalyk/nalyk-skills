---
name: flutter-expert
description: "Production Flutter/Dart development: architecture scaffolds, Riverpod/BLoC, GoRouter, Freezed, testing, CI/CD gates, platform build fixes. Trigger only on a Flutter/Dart signal — pubspec.yaml present or explicit Flutter/Dart mention."
---

# Flutter Expert

Opinionated patterns for shipping production Flutter apps.

> **Verify versions against the live project before copying any snippet.** Nothing here pins versions: add packages with `flutter pub add <pkg>` (`-d` for dev deps) and verify current majors on pub.dev. Snippets assume current majors: Riverpod 3, freezed 3, go_router 16, flutter_lints 6, Dart 3.

## Reference Routing

Read the relevant file before writing detailed code.

| Topic | File |
|---|---|
| Scaffolds (small/medium/large/monorepo), DI, flavors, Failure hierarchy, migration | `reference/architecture-patterns.md` |
| Riverpod 3, BLoC/Cubit, Provider, comparison matrix | `reference/state-management.md` |
| App entry point, Dio ApiClient, Freezed, repository, GoRouter, forms, responsive, widgets, tests, i18n | `reference/code-templates.md` |
| Lint rules, CI/CD, coverage, pre-commit, release signing, profiling | `reference/quality-gates.md` |

## Phase 0: Orientation (conditional)

Run only for new projects or unknown environments; skip for targeted edits in an already-inspected project.

```bash
flutter doctor -v
if [ -f "pubspec.yaml" ]; then
  head -40 pubspec.yaml
  ls lib/ lib/features/ lib/core/ 2>/dev/null
fi
```

Identify: Flutter/Dart version, architecture, state management in use, target platforms.

## Phase 1: Architecture

Recommend by scope; don't ask the user to pick:

- **Small** (1-5 screens, simple state) → minimal structure + setState/Riverpod
- **Medium** (5-15 screens, auth, API) → feature-first + Riverpod 3 + GoRouter — default
- **Large** (15+ screens, offline, multi-team) → Clean Architecture + BLoC + auto_route

Every feature: `data/(datasources|models|repositories)`, `domain/(entities|repositories|usecases)`, `presentation/(providers|screens|widgets)`. Scaffold scripts and the app entry point live in the references.

## Phase 2: State Management

| Signal | Choose |
|---|---|
| Local form/toggle state in one widget | `setState` |
| Shared state across widgets | Riverpod 3 |
| Complex async flows (auth, pagination, real-time) | Riverpod 3 `AsyncNotifier` |
| Event-driven, team mandates BLoC | `flutter_bloc` |
| Legacy Provider project | keep Provider unless rewriting |

## Phase 3: Implementation Order

domain (pure Dart contract) → data (models, datasources, repository impl) → presentation (one provider per screen) → routing (register + guards) → tests (unit domain → unit data → widget → integration). Templates: `reference/code-templates.md`.

## Phase 4: Critical Patterns (enforce always)

- **Typed failures** — never catch generic exceptions; use the sealed `Failure` hierarchy (`architecture-patterns.md` § Medium Project).
- **Network** — Dio `ApiClient` with flavor-gated logging and 401-refresh interceptor (`code-templates.md` § Network Layer).
- **Navigation** — GoRouter with auth guards and shell routes (`code-templates.md` § Navigation).
- **Performance:** `const` constructors everywhere; `RepaintBoundary` around animated widgets; `ListView.builder` for dynamic lists; `cacheWidth`/`cacheHeight` or `cached_network_image`; check `mounted` after every await before using context; `ValueKey` on reorderable list items; `compute()`/`Isolate.run()` for JSON >1MB or image work.

## Phase 5: Quality Gates

Before marking any task complete:

```bash
dart analyze --fatal-infos
dart format --set-exit-if-changed .
flutter test --coverage
flutter build apk --debug 2>&1 | tail -5
```

Full CI pipeline, lint set, release signing: `reference/quality-gates.md`.

## Phase 6: Platform Gotchas

- **iOS:** add `NS*UsageDescription` strings for every permission; CocoaPods fix: `cd ios && pod deintegrate && pod install --repo-update`.
- **Android:** `minSdk` 23+, current `compileSdk`; `namespace = "com.example.app"` in `build.gradle.kts`; multidex if >64K methods.
- **Nuclear clean:** `flutter clean && rm -rf pubspec.lock .dart_tool build ios/Pods ios/Podfile.lock && flutter pub get`

## Debugging Quick-Reference

| Symptom | Fix |
|---|---|
| `setState() called after dispose()` | check `mounted` before `setState` |
| Widget rebuild storms | add `const`, check provider scoping |
| "Looking up deactivated widget's ancestor" | check `mounted` after await |
| Jank on scroll | `flutter run --profile`, add RepaintBoundary |
| "Connection refused" on Android emulator | use `10.0.2.2` not `localhost` |
| iOS "module not found" | `cd ios && pod install --repo-update` |
| Gradle failure | check `gradle-wrapper.properties` version |
| "type 'Null' is not a subtype" | trace the nullable chain |
