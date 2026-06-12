# Explore Patterns pentru Auto-Ralph

Template-uri complete pentru utilizarea Explore Agent înainte de Ralph Loop.
Fiecare prompt de mai jos se trimite ca subagent prin Task tool cu `subagent_type: "Explore"`.

## Când să folosești Explore

| Situație | Folosește Explore? | Motiv |
|----------|-------------------|-------|
| Bug cu stack trace clar | NU | Contextul e evident |
| Bug în cod necunoscut | DA | Mapează structura |
| Feature nouă în proiect cunoscut | NU | Știi deja arhitectura |
| Feature nouă în proiect necunoscut | DA | Descoperă patterns |
| Refactor <100 linii | NU | Scop mic |
| Refactor >500 linii | DA | Mapează dependențe |
| Test pentru funcție izolată | NU | Direct la implementare |
| Test pentru modul complex | DA | Înțelege interacțiunile |

---

## Template: Bug Fix Explore

### Când
- Eroarea nu are stack trace clar
- Nu știi unde e cauza root
- Codul e mare sau necunoscut

### Prompt
```
Investigate bug: [DESCRIERE ERROR]

Find:
1. Source file containing the error
2. Call chain leading to the error
3. Related test files
4. Similar error handling patterns in codebase
5. Recent changes in affected area (git log)

Return: File paths, function names, risk assessment
```

### Exemplu
```
Investigate bug: TypeError in auth.js when refreshing token

Find:
1. Source file containing token refresh logic
2. Call chain from login to token refresh
3. Test files for auth module
4. Error handling patterns for API calls
5. Recent commits touching auth files
```

---

## Template: Feature Implementation Explore

### Când
- Implementezi feature în cod necunoscut
- Feature-ul trebuie să se integreze cu sisteme existente
- Nu știi ce patterns folosește proiectul

### Prompt
```
Plan feature: [FEATURE NAME]

Find:
1. Similar implementations in codebase
2. Integration points (APIs, DB, services)
3. Test patterns used for similar features
4. Config files that might need updates
5. Documentation patterns

Return: Architecture overview, key files, integration points
```

### Exemplu
```
Plan feature: User notifications system

Find:
1. Existing notification or messaging code
2. User service integration points
3. How similar features are tested
4. Environment config for external services
5. How other features document their APIs
```

---

## Template: Refactoring Explore

### Când
- Refactor afectează >500 linii
- Nu știi toate locurile care folosesc codul target
- Risc mare de regresii

### Prompt
```
Analyze refactor target: [FILE/MODULE]

Find:
1. ALL usages across codebase (imports, calls)
2. Direct and indirect dependencies
3. Test coverage for affected code
4. Risk areas (no tests, complex logic)
5. Safe refactoring order

Return: Dependency map, risk assessment, recommended approach
```

### Exemplu
```
Analyze refactor target: src/utils/helpers.js

Find:
1. All files importing from helpers.js
2. Functions most frequently used
3. Which helpers have tests
4. Complex helpers that need careful attention
5. Order to refactor without breaking builds
```

---

## Template: API Development Explore

### Când
- Implementezi API nou
- Trebuie să urmezi patterns existente
- Integrare cu auth/validation existente

### Prompt
```
Design API: [ENDPOINT]

Find:
1. Existing API patterns (routing, controllers)
2. Authentication middleware used
3. Validation patterns
4. Error response format
5. Test patterns for APIs

Return: Pattern guide, middleware to use, test template
```

### Exemplu
```
Design API: POST /api/orders

Find:
1. How other POST endpoints are structured
2. Auth middleware for protected routes
3. Request validation approach
4. Standard error responses
5. API test examples
```

---

## Template: Test Writing Explore

### Când
- Scrii teste pentru cod complex
- Nu cunoști test framework-ul
- Trebuie să mockezi dependențe

### Prompt
```
Plan tests for: [MODULE/FUNCTION]

Find:
1. Test framework and patterns used
2. Existing mocks and fixtures
3. How similar code is tested
4. Coverage gaps
5. Test utilities available

Return: Test strategy, mock templates, coverage targets
```

---

## Best Practices

1. **Nu exagera** - Explore doar când chiar ai nevoie
2. **Fii specific** - Prompt-uri vagi = rezultate vagi
3. **Include context** - Ce știi deja despre problemă
4. **Cere fișiere concrete** - "Find file paths" nu "find information"
5. **Limitează scope** - Un Explore per concern, nu totul odată

## Anti-Patterns

- ❌ Explore pentru task-uri triviale
- ❌ Explore când deja știi structura
- ❌ Prompt-uri generice "explore the codebase"
- ❌ Multiple Explore calls când unul e suficient
