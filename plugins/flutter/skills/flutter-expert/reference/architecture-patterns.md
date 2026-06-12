# Architecture Patterns Reference

> Verify versions against the live project before copying any snippet. Add packages with `flutter pub add <pkg>` and verify current majors on pub.dev.

## Table of Contents
1. [Small Project Scaffold](#small-project)
2. [Medium Project Scaffold](#medium-project)
3. [Large Project (Clean Architecture)](#large-project)
4. [Monorepo / Multi-Package](#monorepo)
5. [Migration Strategies](#migration)

---

## Small Project

**When:** 1-5 screens, single developer, no complex business logic, prototype/MVP.

```
lib/
├── main.dart
├── app.dart
├── models/          # Simple data classes
├── services/        # API calls, local storage
├── screens/         # One file per screen
├── widgets/         # Shared widgets
└── utils/           # Helpers, constants
```

### Scaffold Script

```bash
mkdir -p lib/{models,services,screens,widgets,utils}

cat > lib/main.dart << 'DART'
import 'package:flutter/material.dart';
import 'app.dart';

void main() => runApp(const App());
DART

cat > lib/app.dart << 'DART'
import 'package:flutter/material.dart';
import 'screens/home_screen.dart';

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'App',
      theme: ThemeData(
        colorSchemeSeed: Colors.blue,
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}
DART

cat > lib/screens/home_screen.dart << 'DART'
import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Home')),
      body: const Center(child: Text('Hello Flutter')),
    );
  }
}
DART
```

---

## Medium Project

**When:** 5-15 screens, authentication, API integration, local storage, 1-3 developers.

This is the default recommendation for most projects.

```
lib/
├── main.dart
├── core/
│   ├── constants/
│   │   ├── app_constants.dart
│   │   └── api_endpoints.dart
│   ├── errors/
│   │   ├── failures.dart
│   │   └── exceptions.dart
│   ├── network/
│   │   ├── api_client.dart
│   │   └── network_info.dart
│   ├── theme/
│   │   ├── app_theme.dart
│   │   ├── app_colors.dart
│   │   └── app_typography.dart
│   ├── utils/
│   │   ├── extensions.dart
│   │   └── validators.dart
│   └── widgets/
│       ├── app_button.dart
│       ├── app_text_field.dart
│       ├── loading_widget.dart
│       └── error_widget.dart
├── features/
│   ├── auth/
│   │   ├── data/
│   │   │   ├── datasources/
│   │   │   │   ├── auth_remote_source.dart
│   │   │   │   └── auth_local_source.dart
│   │   │   ├── models/
│   │   │   │   └── user_model.dart
│   │   │   └── repositories/
│   │   │       └── auth_repository_impl.dart
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   └── user.dart
│   │   │   ├── repositories/
│   │   │   │   └── auth_repository.dart
│   │   │   └── usecases/
│   │   │       ├── login.dart
│   │   │       └── register.dart
│   │   └── presentation/
│   │       ├── providers/
│   │       │   └── auth_provider.dart
│   │       ├── screens/
│   │       │   ├── login_screen.dart
│   │       │   └── register_screen.dart
│   │       └── widgets/
│   │           └── auth_form.dart
│   └── home/
│       └── ... (same structure)
└── routing/
    ├── app_router.dart
    └── route_guards.dart
```

### Full Scaffold Script

```bash
# Core directories
for dir in constants errors network theme utils widgets; do
  mkdir -p "lib/core/$dir"
done

# Routing
mkdir -p lib/routing

# Feature generator function
generate_feature() {
  local name=$1
  for dir in data/datasources data/models data/repositories domain/entities domain/repositories domain/usecases presentation/providers presentation/screens presentation/widgets; do
    mkdir -p "lib/features/$name/$dir"
  done
}

# Generate initial features
generate_feature "auth"
generate_feature "home"

# Core files
cat > lib/core/errors/failures.dart << 'DART'
sealed class Failure {
  const Failure(this.message, {this.stackTrace});
  final String message;
  final StackTrace? stackTrace;

  @override
  String toString() => '$runtimeType: $message';
}

class ServerFailure extends Failure {
  const ServerFailure(super.message, {super.stackTrace, this.statusCode});
  final int? statusCode;
}

class NetworkFailure extends Failure {
  const NetworkFailure([super.message = 'No internet connection']);
}

class CacheFailure extends Failure {
  const CacheFailure([super.message = 'Cache error']);
}

class ValidationFailure extends Failure {
  const ValidationFailure(super.message);
}
DART

cat > lib/core/errors/exceptions.dart << 'DART'
class ServerException implements Exception {
  const ServerException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;
}

class CacheException implements Exception {
  const CacheException([this.message = 'Cache error']);
  final String message;
}

class NetworkException implements Exception {
  const NetworkException([this.message = 'No internet connection']);
  final String message;
}
DART

cat > lib/core/theme/app_theme.dart << 'DART'
import 'package:flutter/material.dart';

class AppTheme {
  AppTheme._();

  static final light = ThemeData(
    useMaterial3: true,
    colorSchemeSeed: Colors.blue,
    brightness: Brightness.light,
    inputDecorationTheme: _inputTheme,
    elevatedButtonTheme: _buttonTheme,
  );

  static final dark = ThemeData(
    useMaterial3: true,
    colorSchemeSeed: Colors.blue,
    brightness: Brightness.dark,
    inputDecorationTheme: _inputTheme,
    elevatedButtonTheme: _buttonTheme,
  );

  static final _inputTheme = InputDecorationTheme(
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
    filled: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
  );

  static final _buttonTheme = ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      minimumSize: const Size(double.infinity, 48),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  );
}
DART

cat > lib/core/utils/extensions.dart << 'DART'
import 'package:flutter/material.dart';

extension ContextExtensions on BuildContext {
  ThemeData get theme => Theme.of(this);
  TextTheme get textTheme => Theme.of(this).textTheme;
  ColorScheme get colorScheme => Theme.of(this).colorScheme;
  MediaQueryData get mediaQuery => MediaQuery.of(this);
  double get screenWidth => mediaQuery.size.width;
  double get screenHeight => mediaQuery.size.height;
  bool get isDark => theme.brightness == Brightness.dark;

  void showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(this).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? colorScheme.error : null,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }
}

extension StringExtensions on String {
  String get capitalize =>
      isEmpty ? '' : '${this[0].toUpperCase()}${substring(1)}';
  bool get isValidEmail =>
      RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,}$').hasMatch(this);
}
DART

echo "✅ Medium project scaffolded"
```

---

## Large Project

**When:** 15+ screens, multiple teams, offline-first, complex business rules, enterprise.

Uses Clean Architecture with strict layer separation and dependency injection.

```
lib/
├── main.dart
├── app/
│   ├── app.dart
│   ├── di/                    # Dependency injection
│   │   ├── injection.dart
│   │   └── modules/
│   ├── observers/             # Navigation, BLoC observers
│   └── config/
│       ├── env.dart
│       └── flavors.dart
├── core/
│   ├── error/
│   ├── network/
│   ├── storage/
│   ├── theme/
│   ├── l10n/                  # Localization
│   ├── analytics/
│   └── platform/              # Platform channel abstractions
├── features/
│   └── <feature>/             # Same 3-layer structure
├── routing/
│   ├── app_router.dart
│   ├── guards/
│   └── transitions/
└── shared/
    ├── domain/                # Cross-feature entities
    ├── data/                  # Shared datasources
    └── presentation/          # App-wide widgets
```

### Dependency Injection (get_it + injectable)

```bash
flutter pub add get_it injectable
flutter pub add -d injectable_generator build_runner
```

```dart
// lib/app/di/injection.dart
import 'package:get_it/get_it.dart';
import 'package:injectable/injectable.dart';

import 'injection.config.dart';

final getIt = GetIt.instance;

@InjectableInit(preferRelativeImports: true)
void configureDependencies(String env) => getIt.init(environment: env);

abstract class Env {
  static const dev = 'dev';
  static const staging = 'staging';
  static const prod = 'prod';
}
```

### Build Flavors

```dart
// lib/app/config/flavors.dart
enum Flavor { dev, staging, prod }

class FlavorConfig {
  final Flavor flavor;
  final String apiBaseUrl;
  final bool enableLogging;

  const FlavorConfig._({
    required this.flavor,
    required this.apiBaseUrl,
    required this.enableLogging,
  });

  static const dev = FlavorConfig._(
    flavor: Flavor.dev,
    apiBaseUrl: 'https://api-dev.example.com',
    enableLogging: true,
  );

  static const staging = FlavorConfig._(
    flavor: Flavor.staging,
    apiBaseUrl: 'https://api-staging.example.com',
    enableLogging: true,
  );

  static const prod = FlavorConfig._(
    flavor: Flavor.prod,
    apiBaseUrl: 'https://api.example.com',
    enableLogging: false,
  );
}
```

---

## Monorepo

**When:** Shared packages across multiple apps (e.g., design system, API client, shared models).

Uses `melos` for workspace management.

```yaml
# melos.yaml at root
name: my_workspace
packages:
  - apps/**
  - packages/**

scripts:
  analyze:
    run: melos exec -- dart analyze --fatal-infos
  test:
    run: melos exec -- flutter test
  build_runner:
    run: melos exec -- dart run build_runner build --delete-conflicting-outputs
```

```
my_workspace/
├── melos.yaml
├── apps/
│   ├── customer_app/
│   └── admin_app/
└── packages/
    ├── design_system/         # Shared UI components
    ├── api_client/            # Shared HTTP layer
    ├── shared_models/         # Cross-app domain models
    └── core_utils/            # Shared utilities
```

---

## Migration Strategies

### Provider → Riverpod

1. Add `flutter_riverpod` alongside existing `provider`
2. Wrap root with `ProviderScope` (above existing `MultiProvider`)
3. Migrate one feature at a time, starting with the simplest
4. Convert `ChangeNotifier` → `Notifier` / `AsyncNotifier`
5. Replace `Consumer<T>` with `Consumer` (Riverpod)
6. Remove `provider` package only when fully migrated

### setState → Any State Management

1. Identify all `StatefulWidget`s that manage shared state
2. Extract state into providers/cubits
3. Convert to `StatelessWidget` or `ConsumerWidget`
4. Keep `setState` ONLY for truly local UI state (animation controllers, form field visibility)

### BLoC → Riverpod (or vice versa)

Only migrate if there's a strong reason. Both are production-grade. Migration approach:
1. Create adapter layer that wraps old state in new system
2. Migrate feature by feature
3. Never mix two state solutions in the same feature
