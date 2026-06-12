# Prompt Patterns pentru Ralph Loop

Template-uri optimizate pentru diferite tipuri de task-uri.

## Template General

```markdown
## Task
[Cererea originală a utilizatorului - în limba lui]

## Context Detectat
[Din detect-context.sh:]
- Fișiere modificate: [lista]
- Status git: [clean/dirty/conflicts]
- Framework test: [disponibil/nu]
- Erori recente: [dacă există]

## Criterii de Succes
[Auto-inferate din tipul task-ului]

## Completion
Când task-ul e COMPLET și verificat, output:
<promise>GATA</promise>

IMPORTANT: Output promise DOAR când ești 100% sigur că totul funcționează.
Pentru a anula loop-ul: /cancel-ralph
```

---

## Pattern: Bug Fix

### Trigger Keywords
- "fix", "bug", "broken", "error", "crash", "fail"
- "nu merge", "eroare", "problemă", "crapă"
- "ошибка", "не работает", "сломан"

### Template

```markdown
## Task
Repară bug-ul: [descrierea originală]

## Context Detectat
- Fișiere relevante: [auto-detected]
- Erori în log: [auto-detected]
- Stack trace: [dacă există]

## Criterii de Succes
1. Eroarea nu mai apare
2. Testele existente trec
3. Funcționalitatea afectată merge corect
4. Nu s-au introdus regresii

## Abordare
1. Identifică root cause
2. Scrie test care reproduce bug-ul (dacă nu există)
3. Implementează fix
4. Verifică că testul trece
5. Rulează toate testele
6. Verifică că nu ai introdus alte probleme

## Completion
Când bug-ul e FIX și toate testele trec:
<promise>GATA</promise>

IMPORTANT: NU output promise dacă:
- Testele failează
- Fix-ul e parțial
- Ai dubii despre soluție
```

---

## Pattern: Feature Implementation

### Trigger Keywords
- "implement", "add", "create", "build", "make"
- "adaugă", "implementează", "creează", "fă"
- "добавь", "создай", "сделай"

### Template

```markdown
## Task
Implementează: [descrierea originală]

## Context Detectat
- Structură proiect: [auto-detected]
- Pattern-uri existente: [auto-detected]
- Framework: [auto-detected]

## Criterii de Succes
1. Feature-ul funcționează conform specificațiilor
2. Teste scrise și verzi
3. Integrare cu codul existent
4. Code style consistent cu proiectul

## Abordare
1. Analizează structura existentă
2. Planifică implementarea
3. Scrie teste pentru happy path
4. Implementează feature
5. Adaugă teste edge cases
6. Verifică integrarea

## Completion
Când feature-ul e COMPLET și testat:
<promise>GATA</promise>

IMPORTANT: NU output promise dacă:
- Lipsesc funcționalități cerute
- Testele nu acoperă feature-ul
- Integrarea e incompletă
```

---

## Pattern: Test Writing

### Trigger Keywords
- "test", "tests", "testing", "coverage"
- "teste", "testează", "acoperire"
- "тесты", "тестируй"

### Template

```markdown
## Task
Scrie teste pentru: [descrierea originală]

## Context Detectat
- Framework test: [auto-detected]
- Coverage actuală: [dacă disponibil]
- Pattern-uri test existente: [auto-detected]

## Criterii de Succes
1. Teste scrise pentru funcționalitățile specificate
2. Toate testele trec
3. Coverage îmbunătățită
4. Edge cases acoperite

## Abordare
1. Identifică funcționalitățile de testat
2. Scrie teste pentru happy path
3. Adaugă teste pentru edge cases
4. Adaugă teste pentru error handling
5. Rulează toate testele
6. Verifică că toate trec

## Completion
Când testele sunt COMPLETE și toate trec:
<promise>GATA</promise>
```

---

## Pattern: Refactoring

### Trigger Keywords
- "refactor", "clean", "improve", "reorganize"
- "refactorizează", "curăță", "îmbunătățește"
- "рефактор", "улучши", "очисти"

### Template

```markdown
## Task
Refactorizează: [descrierea originală]

## Context Detectat
- Cod target: [auto-detected]
- Dependențe: [auto-detected]
- Teste existente: [auto-detected]

## Criterii de Succes
1. Codul e mai curat/organizat
2. TOATE testele existente trec (nicio regresie!)
3. Funcționalitatea identică
4. Code style consistent

## Abordare
1. Rulează testele (baseline)
2. Identifică îmbunătățirile
3. Refactorizează incremental
4. Rulează testele după fiecare schimbare
5. Verifică că nu ai spart nimic

## Completion
Când refactoring-ul e COMPLET și testele trec:
<promise>GATA</promise>

IMPORTANT: NU output promise dacă:
- Orice test fallește
- Comportamentul s-a schimbat (dacă nu era cerut)
```

---

## Pattern: API Development

### Trigger Keywords
- "API", "endpoint", "REST", "GraphQL"
- "API", "endpoint", "rută"

### Template

```markdown
## Task
Dezvoltă API: [descrierea originală]

## Context Detectat
- Framework backend: [auto-detected]
- Pattern-uri existente: [auto-detected]
- Auth mechanism: [auto-detected]

## Criterii de Succes
1. Endpoint-uri funcționale
2. Validare input
3. Error handling complet
4. Teste API (integration)
5. Documentație actualizată (dacă există)

## Abordare
1. Design endpoint-uri
2. Implementează handlers
3. Adaugă validare
4. Adaugă error handling
5. Scrie teste integration
6. Testează manual
7. Actualizează documentație

## Completion
Când API-ul e COMPLET și testat:
<promise>GATA</promise>
```

---

## Reguli de Selecție Pattern

```
SELECTEAZĂ PATTERN BAZAT PE:
1. Keywords în cerere (vezi "Trigger Keywords" pentru fiecare pattern)
2. Context detectat (tip proiect, fișiere modificate)
3. Dacă incert → folosește Template General

PRIORITATE:
1. Match exact pe keywords → Pattern specific
2. Context sugerează tip → Pattern relevant
3. Default → Template General cu adaptări
```

---

## Pattern: NO_TESTS_DETECTED (P1 FIX)

**Când `detect-context.sh` returnează `NO_TESTS_DETECTED`, folosește criterii alternative!**

### Problema

Dacă repo-ul nu are teste, pattern-urile standard spun "când testele trec" - dar nu există teste!
Acest lucru duce la:
1. Ralph nu poate verifica completion
2. Ralph minte ca să iasă din loop
3. Sau loop infinit

### Soluție: Criterii Alternative

**În loc de:**
```
## Criterii de Succes
1. Testele trec
```

**Folosește:**
```
## Criterii de Succes (fără teste în proiect)
1. Build/compile trece fără erori
2. Aplicația pornește fără crash
3. Funcționalitatea poate fi verificată manual
4. Nu apar erori noi în console/logs
5. Codul se comportă conform descrierii
```

### Template pentru NO_TESTS

```markdown
## Task
[descrierea originală]

## Context Detectat
- Fișiere relevante: [auto-detected]
- ⚠️ ATENȚIE: Nu s-au detectat teste în acest proiect

## Criterii de Succes (fără teste automate)
1. Codul compilează/rulează fără erori
2. Funcționalitatea cerută funcționează (verifică manual)
3. Nu s-au introdus erori noi
4. Aplicația pornește și funcționează normal

## Verificare Manuală
Deoarece nu există teste automate:
1. Rulează aplicația
2. Testează funcționalitatea afectată
3. Verifică că nu apar erori în console
4. Confirmă că comportamentul e corect

## Completion
Când task-ul e COMPLET și verificat MANUAL:
<promise>GATA</promise>

IMPORTANT:
- Fără teste automate, TREBUIE să verifici MANUAL
- NU output promise dacă nu ai verificat că funcționează
- Fii FOARTE atent la regresii (nu ai teste care să le detecteze)
```

### Când să folosești acest pattern

```
IF detect-context.sh output conține "NO_TESTS_DETECTED":
    THEN folosește Template NO_TESTS în loc de template-ul standard
    AND adaugă warning în prompt despre verificare manuală
```

---

## Personalizare Prompt

Adaugă întotdeauna:
1. **Limba utilizatorului** - păstrează limba originală în Task
2. **Context specific** - din detect-context.sh
3. **Framework/stack** - pentru instrucțiuni relevante
4. **/cancel-ralph** - reminder pentru escape
5. **(P1 FIX) Test status** - dacă NO_TESTS_DETECTED, folosește criterii alternative

---

## Exemplu complet end-to-end (bug fix)

**Input:** "fix the auth bug, testele failează pe login"
**Scor:** `score=4 matched=[verb,iteration,scope,verify]` → Ralph mode
**Context detectat:** modified: src/auth/login.ts, tests/auth.test.ts; npm test
disponibil; eroare: `TypeError: Cannot read property 'token' of undefined`

**Prompt generat** (scris cu Write tool în `/tmp/ralph-prompt.txt`):

```markdown
## Task
Repară bug-ul de autentificare: testele failează pe login.

## Context Detectat
- Fișiere modificate: src/auth/login.ts, tests/auth.test.ts
- Framework test: npm test disponibil
- Eroare: TypeError: Cannot read property 'token' of undefined

## Criterii de Succes
1. Eroarea "Cannot read property 'token'" nu mai apare
2. Toate testele din tests/auth.test.ts trec
3. Nu s-au introdus regresii în alte teste

## Completion
Când bug-ul e COMPLET REZOLVAT și `npm test` trece:
<promise>GATA</promise>

Pentru a anula loop-ul: /cancel-ralph
```

**Execuție** (mereu prin prompt-file, niciodată prompt inline):

```bash
/ralph-loop --prompt-file /tmp/ralph-prompt.txt --max-iterations 25 --completion-promise "GATA"
```
