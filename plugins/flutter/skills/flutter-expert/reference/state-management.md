# State Management Reference

> Verify versions against the live project before copying any snippet. Add packages with `flutter pub add <pkg>` and verify current majors on pub.dev.

## Table of Contents
1. [Riverpod 3 (Default)](#riverpod)
2. [BLoC / Cubit](#bloc)
3. [Provider (Legacy)](#provider-legacy)
4. [Comparison Matrix](#comparison)

---

## Riverpod 3 (Default Recommendation) {#riverpod}

### Setup

```bash
flutter pub add flutter_riverpod riverpod_annotation
flutter pub add -d riverpod_generator build_runner riverpod_lint custom_lint
```

Riverpod 3 codegen note: generated function providers take a plain `Ref` parameter — the per-provider typed refs (`FooRef`) are gone.

Add to `analysis_options.yaml`:
```yaml
analyzer:
  plugins:
    - custom_lint
```

### Provider Types Cheat Sheet

| Use case | Provider type | Code gen annotation |
|---|---|---|
| Constant/computed value | `Provider` | `@riverpod` (sync fn) |
| Simple mutable state | `NotifierProvider` | `@riverpod` (class) |
| Async data fetch | `FutureProvider` | `@riverpod` (async fn) |
| Async mutable state | `AsyncNotifierProvider` | `@riverpod` (class, async) |
| Real-time stream | `StreamProvider` | `@riverpod` (stream fn) |

### Pattern: Async Data with Loading/Error States

```dart
// lib/features/products/presentation/providers/products_provider.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../domain/entities/product.dart';
import '../../domain/repositories/product_repository.dart';

part 'products_provider.g.dart';

@riverpod
class Products extends _$Products {
  @override
  FutureOr<List<Product>> build() async {
    return _fetchProducts();
  }

  Future<List<Product>> _fetchProducts() async {
    final repo = ref.read(productRepositoryProvider);
    return repo.getProducts();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_fetchProducts);
  }

  Future<void> addProduct(Product product) async {
    final repo = ref.read(productRepositoryProvider);
    await repo.addProduct(product);
    ref.invalidateSelf();
    await future; // Wait for rebuild
  }

  Future<void> deleteProduct(String id) async {
    // Optimistic update
    final previous = state.valueOrNull ?? [];
    state = AsyncData(previous.where((p) => p.id != id).toList());

    try {
      final repo = ref.read(productRepositoryProvider);
      await repo.deleteProduct(id);
    } catch (e, st) {
      state = AsyncData(previous); // Rollback
      state = AsyncError(e, st);
    }
  }
}

// Derived/filtered provider
@riverpod
List<Product> filteredProducts(Ref ref, {String? category}) {
  final products = ref.watch(productsProvider).valueOrNull ?? [];
  if (category == null) return products;
  return products.where((p) => p.category == category).toList();
}
```

### Pattern: Auth State

```dart
@riverpod
class AuthState extends _$AuthState {
  @override
  FutureOr<User?> build() async {
    final token = await ref.read(secureStorageProvider).read(key: 'token');
    if (token == null) return null;
    return ref.read(authRepositoryProvider).getCurrentUser(token);
  }

  Future<void> login(String email, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(authRepositoryProvider);
      final user = await repo.login(email, password);
      await ref.read(secureStorageProvider).write(key: 'token', value: user.token);
      return user;
    });
  }

  Future<void> logout() async {
    await ref.read(secureStorageProvider).delete(key: 'token');
    state = const AsyncData(null);
  }
}

// Convenience provider for checking auth status
@riverpod
bool isAuthenticated(Ref ref) {
  return ref.watch(authStateProvider).valueOrNull != null;
}
```

### UI Integration Pattern

```dart
class ProductListScreen extends ConsumerWidget {
  const ProductListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsAsync = ref.watch(productsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Products')),
      body: productsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Error: $error'),
              const SizedBox(height: 8),
              ElevatedButton(
                onPressed: () => ref.invalidate(productsProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (products) => products.isEmpty
          ? const Center(child: Text('No products'))
          : RefreshIndicator(
              onRefresh: () => ref.read(productsProvider.notifier).refresh(),
              child: ListView.builder(
                itemCount: products.length,
                itemBuilder: (context, index) => ProductTile(
                  product: products[index],
                  onDelete: () => ref
                      .read(productsProvider.notifier)
                      .deleteProduct(products[index].id),
                ),
              ),
            ),
      ),
    );
  }
}
```

### Form State Pattern

```dart
@riverpod
class LoginForm extends _$LoginForm {
  @override
  ({String email, String password, bool isSubmitting, String? error}) build() {
    return (email: '', password: '', isSubmitting: false, error: null);
  }

  void updateEmail(String value) =>
      state = (email: value, password: state.password, isSubmitting: false, error: null);

  void updatePassword(String value) =>
      state = (email: state.email, password: value, isSubmitting: false, error: null);

  Future<bool> submit() async {
    state = (email: state.email, password: state.password, isSubmitting: true, error: null);
    try {
      await ref.read(authStateProvider.notifier).login(state.email, state.password);
      return true;
    } catch (e) {
      state = (email: state.email, password: state.password, isSubmitting: false, error: e.toString());
      return false;
    }
  }
}
```

### Provider Scoping for Testing

```dart
// In tests
void main() {
  testWidgets('shows products', (tester) async {
    final mockProducts = [
      Product(id: '1', name: 'Test', price: 9.99, category: 'test'),
    ];

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          productsProvider.overrideWith(() => MockProductsNotifier(mockProducts)),
        ],
        child: const MaterialApp(home: ProductListScreen()),
      ),
    );

    expect(find.text('Test'), findsOneWidget);
  });
}
```

---

## BLoC / Cubit {#bloc}

Use when: team mandate, event-driven architecture, complex state machines.

### Setup

```bash
flutter pub add flutter_bloc equatable
flutter pub add -d bloc_test
```

### Cubit Pattern (Simpler — Use by Default)

```dart
// State
class ProductsState extends Equatable {
  final List<Product> products;
  final bool isLoading;
  final String? error;

  const ProductsState({
    this.products = const [],
    this.isLoading = false,
    this.error,
  });

  ProductsState copyWith({
    List<Product>? products,
    bool? isLoading,
    String? error,
  }) => ProductsState(
    products: products ?? this.products,
    isLoading: isLoading ?? this.isLoading,
    error: error,
  );

  @override
  List<Object?> get props => [products, isLoading, error];
}

// Cubit
class ProductsCubit extends Cubit<ProductsState> {
  final ProductRepository _repository;

  ProductsCubit(this._repository) : super(const ProductsState());

  Future<void> loadProducts() async {
    emit(state.copyWith(isLoading: true, error: null));
    try {
      final products = await _repository.getProducts();
      emit(state.copyWith(products: products, isLoading: false));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: e.toString()));
    }
  }

  Future<void> deleteProduct(String id) async {
    final previous = state.products;
    emit(state.copyWith(
      products: previous.where((p) => p.id != id).toList(),
    ));
    try {
      await _repository.deleteProduct(id);
    } catch (e) {
      emit(state.copyWith(products: previous, error: e.toString()));
    }
  }
}
```

### Full BLoC Pattern (When Events Matter)

```dart
// Events
sealed class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

class LoginRequested extends AuthEvent {
  final String email;
  final String password;
  const LoginRequested(this.email, this.password);

  @override
  List<Object?> get props => [email, password];
}

class LogoutRequested extends AuthEvent {
  const LogoutRequested();
}

class AuthCheckRequested extends AuthEvent {
  const AuthCheckRequested();
}

// State
sealed class AuthState extends Equatable {
  const AuthState();

  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState { const AuthInitial(); }
class AuthLoading extends AuthState { const AuthLoading(); }
class Authenticated extends AuthState {
  final User user;
  const Authenticated(this.user);

  @override
  List<Object?> get props => [user];
}
class Unauthenticated extends AuthState { const Unauthenticated(); }
class AuthError extends AuthState {
  final String message;
  const AuthError(this.message);

  @override
  List<Object?> get props => [message];
}

// BLoC
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final AuthRepository _authRepo;
  final SecureStorage _storage;

  AuthBloc({required AuthRepository authRepo, required SecureStorage storage})
      : _authRepo = authRepo,
        _storage = storage,
        super(const AuthInitial()) {
    on<AuthCheckRequested>(_onAuthCheck);
    on<LoginRequested>(_onLogin);
    on<LogoutRequested>(_onLogout);
  }

  Future<void> _onAuthCheck(AuthCheckRequested event, Emitter<AuthState> emit) async {
    final token = await _storage.read(key: 'token');
    if (token == null) { emit(const Unauthenticated()); return; }
    try {
      final user = await _authRepo.getCurrentUser(token);
      emit(Authenticated(user));
    } catch (_) {
      await _storage.delete(key: 'token');
      emit(const Unauthenticated());
    }
  }

  Future<void> _onLogin(LoginRequested event, Emitter<AuthState> emit) async {
    emit(const AuthLoading());
    try {
      final user = await _authRepo.login(event.email, event.password);
      await _storage.write(key: 'token', value: user.token);
      emit(Authenticated(user));
    } catch (e) {
      emit(AuthError(e.toString()));
    }
  }

  Future<void> _onLogout(LogoutRequested event, Emitter<AuthState> emit) async {
    await _storage.delete(key: 'token');
    emit(const Unauthenticated());
  }
}
```

### BLoC Testing

```dart
import 'package:bloc_test/bloc_test.dart';

void main() {
  late MockAuthRepository mockRepo;
  late MockSecureStorage mockStorage;

  setUp(() {
    mockRepo = MockAuthRepository();
    mockStorage = MockSecureStorage();
  });

  blocTest<AuthBloc, AuthState>(
    'emits [AuthLoading, Authenticated] on successful login',
    build: () {
      when(() => mockRepo.login(any(), any()))
          .thenAnswer((_) async => testUser);
      when(() => mockStorage.write(key: any(named: 'key'), value: any(named: 'value')))
          .thenAnswer((_) async {});
      return AuthBloc(authRepo: mockRepo, storage: mockStorage);
    },
    act: (bloc) => bloc.add(const LoginRequested('test@test.com', 'pass')),
    expect: () => [const AuthLoading(), Authenticated(testUser)],
  );
}
```

---

## Comparison Matrix {#comparison}

| Criterion | Riverpod 3 | BLoC/Cubit | Provider |
|---|---|---|---|
| Learning curve | Medium | Medium-High | Low |
| Boilerplate | Low (with codegen) | Medium | Low |
| Testability | Excellent | Excellent | Good |
| Compile safety | Excellent | Good | Weak |
| DevTools | Good | Excellent | Good |
| Scalability | Excellent | Excellent | Fair |
| Community | Growing fast | Very large | Legacy |
| Code generation | Yes (riverpod_generator) | No | No |
| Recommended for new projects | ✅ Yes | ✅ Yes (if team prefers) | ❌ No |
