# Quality Gates Reference

> Verify versions against the live project before copying any snippet. Lint set assumes flutter_lints 6 (`flutter pub add -d flutter_lints`).

## Table of Contents
1. [Analysis & Linting](#linting)
2. [Testing Pipeline](#testing)
3. [CI/CD with GitHub Actions](#ci-cd)
4. [Pre-Commit Hooks](#pre-commit)
5. [Release Checklist](#release)
6. [Performance Profiling](#performance)

---

## Analysis & Linting {#linting}

### analysis_options.yaml (Copy-Paste Ready)

```yaml
include: package:flutter_lints/flutter.yaml

analyzer:
  errors:
    dead_code: warning
    unused_import: warning
    unused_local_variable: warning
  exclude:
    - "**/*.g.dart"
    - "**/*.freezed.dart"
    - "lib/generated/**"
  language:
    strict-casts: true
    strict-inference: true
    strict-raw-types: true
  plugins:
    - custom_lint  # For riverpod_lint

linter:
  rules:
    # Error prevention
    - always_use_package_imports
    - avoid_dynamic_calls
    - avoid_print
    - avoid_slow_async_io
    - cancel_subscriptions
    - close_sinks
    - literal_only_boolean_expressions
    - no_adjacent_strings_in_list
    - test_types_in_equals
    - throw_in_finally
    - unnecessary_statements

    # Style enforcement
    - always_declare_return_types
    - annotate_overrides
    - avoid_bool_literals_in_conditional_expressions
    - avoid_catches_without_on_clauses
    - avoid_catching_errors
    - avoid_field_initializers_in_const_classes
    - avoid_implementing_value_types
    - avoid_returning_this
    - avoid_unused_constructor_parameters
    - cascade_invocations
    - directives_ordering
    - eol_at_end_of_file
    - join_return_with_assignment
    - leading_newlines_in_multiline_strings
    - missing_whitespace_between_adjacent_strings
    - noop_primitive_operations
    - omit_local_variable_types
    - one_member_abstracts
    - only_throw_errors
    - parameter_assignments
    - prefer_asserts_in_initializer_lists
    - prefer_const_constructors
    - prefer_const_constructors_in_immutables
    - prefer_const_declarations
    - prefer_const_literals_to_create_immutables
    - prefer_constructors_over_static_methods
    - prefer_expression_function_bodies
    - prefer_final_in_for_each
    - prefer_final_locals
    - prefer_if_elements_to_conditional_expressions
    - prefer_int_literals
    - prefer_mixin
    - prefer_null_aware_method_calls
    - prefer_single_quotes
    - require_trailing_commas
    - sized_box_for_whitespace
    - sort_child_properties_last
    - sort_constructors_first
    - sort_unnamed_constructors_first
    - unawaited_futures
    - unnecessary_await_in_return
    - unnecessary_lambdas
    - unnecessary_null_aware_assignments
    - unnecessary_parenthesis
    - unnecessary_raw_strings
    - use_colored_box
    - use_decorated_box
    - use_enums
    - use_if_null_to_convert_nulls_to_bools
    - use_is_even_rather_than_modulo
    - use_named_constants
    - use_raw_strings
    - use_setters_to_change_properties
    - use_string_buffers
    - use_super_parameters
    - use_to_and_as_if_applicable
```

### Run Analysis

```bash
# Must pass with ZERO issues
dart analyze --fatal-infos

# Auto-fix what can be fixed
dart fix --apply

# Format all code
dart format .

# Check formatting without modifying
dart format --set-exit-if-changed .
```

---

## Testing Pipeline {#testing}

### Test Structure

```
test/
├── core/
│   ├── network/
│   │   └── api_client_test.dart
│   └── utils/
│       └── extensions_test.dart
├── features/
│   ├── auth/
│   │   ├── data/
│   │   │   ├── datasources/
│   │   │   │   └── auth_remote_source_test.dart
│   │   │   └── repositories/
│   │   │       └── auth_repository_impl_test.dart
│   │   ├── domain/
│   │   │   └── usecases/
│   │   │       └── login_test.dart
│   │   └── presentation/
│   │       ├── providers/
│   │       │   └── auth_provider_test.dart
│   │       └── screens/
│   │           └── login_screen_test.dart
│   └── home/
│       └── ...
├── helpers/
│   ├── test_helpers.dart        # Shared setup utilities
│   ├── mock_providers.dart      # Common mock overrides
│   └── pump_app.dart            # Widget test wrapper
└── fixtures/
    ├── products.json            # Mock API responses
    └── user.json
integration_test/
├── app_test.dart
└── robots/                      # Page object pattern
    ├── login_robot.dart
    └── home_robot.dart
```

### Test Helper

```dart
// test/helpers/pump_app.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

extension PumpApp on WidgetTester {
  Future<void> pumpApp(
    Widget widget, {
    List<Override>? overrides,
    GoRouter? router,
  }) async {
    await pumpWidget(
      ProviderScope(
        overrides: overrides ?? [],
        child: router != null
            ? MaterialApp.router(routerConfig: router)
            : MaterialApp(home: widget),
      ),
    );
  }
}
```

### Run Tests

```bash
# All tests
flutter test

# With coverage
flutter test --coverage

# Specific test file
flutter test test/features/auth/domain/usecases/login_test.dart

# With verbose output
flutter test --reporter expanded

# Generate HTML coverage report
flutter test --coverage
genhtml coverage/lcov.info -o coverage/html
open coverage/html/index.html  # macOS
```

### Coverage Thresholds

Target: **80% minimum** for production code.

```bash
# Quick coverage check (requires lcov)
COVERAGE=$(lcov --summary coverage/lcov.info 2>&1 | grep "lines" | grep -oP '\d+\.\d+')
echo "Coverage: $COVERAGE%"
if (( $(echo "$COVERAGE < 80" | bc -l) )); then
  echo "❌ Coverage below 80% threshold"
  exit 1
fi
```

---

## CI/CD with GitHub Actions {#ci-cd}

### .github/workflows/flutter_ci.yml

```yaml
name: Flutter CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with:
          channel: stable  # or pin flutter-version to the project's version for reproducible builds
          cache: true

      - name: Install dependencies
        run: flutter pub get

      - name: Generate code
        run: dart run build_runner build --delete-conflicting-outputs

      - name: Analyze
        run: dart analyze --fatal-infos

      - name: Format check
        run: dart format --set-exit-if-changed .

  test:
    runs-on: ubuntu-latest
    needs: analyze
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with:
          channel: stable  # or pin flutter-version to the project's version for reproducible builds
          cache: true

      - run: flutter pub get
      - run: dart run build_runner build --delete-conflicting-outputs

      - name: Run tests
        run: flutter test --coverage

      - name: Check coverage
        run: |
          sudo apt-get install -y lcov
          COVERAGE=$(lcov --summary coverage/lcov.info 2>&1 | grep "lines" | grep -oP '\d+\.\d+')
          echo "Coverage: $COVERAGE%"
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "❌ Coverage below 80%"
            exit 1
          fi

  build-android:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'
      - uses: subosito/flutter-action@v2
        with:
          channel: stable  # or pin flutter-version to the project's version for reproducible builds
          cache: true

      - run: flutter pub get
      - run: dart run build_runner build --delete-conflicting-outputs
      - run: flutter build appbundle --release

      - uses: actions/upload-artifact@v4
        with:
          name: android-release
          path: build/app/outputs/bundle/release/app-release.aab

  build-ios:
    runs-on: macos-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with:
          channel: stable  # or pin flutter-version to the project's version for reproducible builds
          cache: true

      - run: flutter pub get
      - run: dart run build_runner build --delete-conflicting-outputs
      - run: flutter build ios --release --no-codesign

      - uses: actions/upload-artifact@v4
        with:
          name: ios-release
          path: build/ios/iphoneos/Runner.app
```

---

## Pre-Commit Hooks {#pre-commit}

### Setup with lefthook

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    format:
      run: dart format --set-exit-if-changed {staged_files}
      glob: "*.dart"
    analyze:
      run: dart analyze --fatal-infos
    test:
      run: flutter test --no-pub
```

Install:
```bash
# macOS
brew install lefthook
lefthook install

# Or with npm
npx lefthook install
```

### Alternative: Git hooks directly

```bash
# .git/hooks/pre-commit
#!/bin/sh
set -e
echo "Running pre-commit checks..."
dart format --set-exit-if-changed .
dart analyze --fatal-infos
flutter test --no-pub
echo "✅ All checks passed"
```

---

## Release Checklist {#release}

### Pre-Release

```bash
# 1. Bump version in pubspec.yaml
# Format: major.minor.patch+buildNumber
# Example: version: 1.2.0+15

# 2. Run full quality check
dart analyze --fatal-infos
dart format --set-exit-if-changed .
flutter test --coverage

# 3. Build release artifacts
flutter build appbundle --release --obfuscate --split-debug-info=build/debug-info
flutter build ipa --release --obfuscate --split-debug-info=build/debug-info

# 4. Test release builds on real devices
flutter install --release

# 5. Upload debug symbols (for Firebase Crashlytics)
# firebase crashlytics:symbols:upload --app=APP_ID build/debug-info
```

### Android Release Signing

```properties
# android/key.properties (DO NOT COMMIT)
storePassword=<password>
keyPassword=<password>
keyAlias=<alias>
storeFile=<path-to-keystore>
```

```kotlin
// android/app/build.gradle.kts (Kotlin DSL — default in current Flutter)
import java.io.FileInputStream
import java.util.Properties

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String?
            keyPassword = keystoreProperties["keyPassword"] as String?
            storeFile = (keystoreProperties["storeFile"] as String?)?.let { file(it) }
            storePassword = keystoreProperties["storePassword"] as String?
        }
    }
    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}
```

### App Size Analysis

```bash
# Generate size report
flutter build apk --analyze-size --target-platform android-arm64
flutter build ios --analyze-size

# Opens DevTools with size breakdown
# Target: <15MB for most apps, <25MB with heavy assets
```

---

## Performance Profiling {#performance}

### Quick Performance Audit

```bash
# Run in profile mode (real device required for accurate results)
flutter run --profile

# Open DevTools
flutter pub global activate devtools
dart devtools
```

### Key Metrics to Check

1. **Frame rendering** — Open Performance tab, look for red frames (>16ms)
2. **Widget rebuild count** — Enable "Track widget rebuilds" in DevTools
3. **Memory** — Check for leaks: open Memory tab, trigger GC, check retained size
4. **App startup** — Measure with `Timeline.startSync('app_startup')` in main()
5. **Network** — Check request waterfall in Network tab

### Common Performance Fixes

```dart
// 1. Const constructors — biggest single impact
const MyWidget(); // ✅ Won't rebuild when parent rebuilds

// 2. RepaintBoundary — isolate expensive paints
RepaintBoundary(child: ComplexAnimatedWidget())

// 3. AutomaticKeepAliveClientMixin — preserve tab state
class _MyTabState extends State<MyTab> with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context); // Required
    return ExpensiveWidget();
  }
}

// 4. Selective rebuilds with Riverpod select
final name = ref.watch(userProvider.select((u) => u?.name));

// 5. Image optimization
Image.network(
  url,
  cacheWidth: 300,   // Decode at display size, not full resolution
  cacheHeight: 300,
  loadingBuilder: (context, child, progress) =>
      progress == null ? child : const ShimmerLoading(),
  errorBuilder: (context, error, stack) => const Icon(Icons.broken_image),
)

// 6. Heavy computation off main thread
final parsed = await Isolate.run(() => jsonDecode(hugeJsonString));
```
