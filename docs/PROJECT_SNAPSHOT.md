# PROJECT_SNAPSHOT — ISEQL Event Modeler (Desktop)

## 0) Stato generale

- Data snapshot: 2026-02-07
- Fase corrente: avvio progetto (workflow Snapshot+Prompt attivo)
- Milestone completate:
  - M0 (Setup macchina) ✅
  - M1.2 — Scaffolding Vite + React + TypeScript ✅
  - M1.3 — Aggiungi Tauri e verifica dev desktop ✅
  - M1.4 — Tooling qualità: ESLint + Prettier ✅
  - M1.5 — Husky + lint-staged (guardrail) ✅
  - M1.6 — Struttura cartelle definitiva ✅
  - M1.7 — Prima build release Tauri (packaging minimo) ✅
  - M2.1 — SPEC MVP vs Nice-to-have ✅
  - M2.2 — User story + Acceptance (Given/When/Then) ✅
  - M3 — Core: AST (EventModel, TemporalExpression, ConstraintSet, ecc.) + Gate unit snapshot ✅
  - M3.2 — Zod schema per AST (contratti forti) ✅
  - M3.3 — Catalogo operatori (src/core/operators.json) ✅
  - M3.4 — Doc architettura core ✅
  - M4.1 — Implementa Resolver: normalizzazione operatori + default params ✅
  - M4.2 — Implementa Serializer ISEQL (src/core/serializer.ts) ✅

- Prossimo task (da backlog): M4.3 — Validator (src/core/validator.ts) (TODO)

---

## 1) Visione e obiettivo

Applicazione desktop (eseguibile) che permette di definire modelli di evento tramite GUI e genera una query ISEQL (solo output, nessuna connessione DB).

Output principale:

- stringa ISEQL generata dal modello (pattern/“regex-like”)

Output opzionale:

- export JSON del modello interno (AST)

---

## 2) Stack deciso (NON cambiare senza decisione esplicita qui)

Desktop runtime:

- Tauri

Frontend:

- React + TypeScript + Vite

UI:

- Tailwind CSS
- shadcn/ui

State:

- Zustand

Forms & Validation:

- React Hook Form
- Zod (+ zodResolver)

Testing:

- Vitest (unit/core) ✅ (installato e in uso)
- Playwright (smoke UI)

Quality:

- ESLint
- Prettier
- Husky + lint-staged

---

## 3) Struttura cartelle (source of truth)

- src/
  - core/ (AST, Zod schema, serializer, validator, resolver, wizard)
  - ui/ (layout, panels, components, Zustand store)
- src-tauri/ (Tauri rust project + tauri.conf.json)
- docs/
- templates/
- tests/
- assets/

---

## 4) Script standard (Gate)

Obiettivo: avere comandi ripetibili e “bloccanti”.

Disponibili / attesi:

- npm run lint
- npm run format
- npm run test:unit
- npm run test:smoke
- npm run build
- npm run tauri dev
- npm run tauri build

Gate globale pre-merge: lint + test:unit + build verdi  
Gate globale pre-release: + test:smoke + tauri build verdi

Nota di stato:

- test:unit era mancante, ora presente e funzionante (Vitest installato).

---

## 5) Decisioni UX rilevanti (source of truth)

- Layout 3 pannelli: Builder / Preview / Output
- Modalità: Expert + Wizard
- Builder MUST HAVE (MVP): timeline editor come input (disegno intervalli: create / move / resize) + definizione relazioni/vincoli tra intervalli
- Output panel: query live + Copy + Export .iseql + Validate + Reset
- Explainability: mostra regola usata dal resolver (ruleId + testo)
- Preview: timeline/diagramma degli intervalli (in MVP coincide con timeline editor del Builder)

Decisione da prendere (non ancora fissata):

- Autosave: localStorage (MVP) vs file su disco (Tauri)

Export:

- Export .iseql tramite Tauri save dialog (target MVP)

---

## 6) Contratti core (stato attuale)

- SPEC MVP vs Nice-to-have (docs/SPEC.md): ✅ (M2.1)
- User stories + Acceptance (docs/SPEC.md): ✅ (M2.2)
- Output come “ISEQL pattern/regex-like”
- Supporto completo operatori temporali (ISEQL superset di Allen) + parametri/default + vincoli
- Decisione: modello interno ISEQL-native, Allen come alias UI opzionale
- MVP MUST HAVE: interval drawing su timeline (create/move/resize)
- Resolver: auto-selezione operatore + auto-compilazione parametri + explainability (ruleId)
- OUT OF SCOPE esplicito (no DB runtime, no image/video processing, no ottimizzazioni)

Implementazioni:

- AST (src/core/model.ts): ✅ (M3)
  - Tipi: EventModel, PredicateCall, IntervalInstance, TemporalExpression, Constraint/ConstraintSet, TemporalParams (ζ, η, δ, ε, ρ)
  - IdFactory deterministico
  - Helpers deterministici per snapshot: normalize + stable stringify
  - Fix lint: rimosso any in stableStringify (unknown + type guard)
- Zod schema (src/core/schema.ts): ✅ (M3.2)
  - EventModelSchema + sub-schemas (IntervalInstance, TemporalExpression, ConstraintSet, TemporalParams)
  - Validazioni: start<=end, ids unici, refs intervalId esistenti, domini parametri (δ/ε >= 0 o "∞", ρ >= 0, comparator enum)
  - Strict mode: input pulito (no proprietà inattese)
  - Nota compatibilità typing (Zod “classic”): evitati invalid_type_error / errorMap; z.record usa keyType+valueType
- Operators catalog (src/core/operators.json): ✅ (M3.3)
  - Catalogo JSON con schemaVersion + defaults globali parametri
  - Operatori base ISEQL (Bef/Aft/LOJ/ROJ/DJ/RDJ/SP/EF/Eq) e Allen 13 come alias (kind='alias')
  - Metadati per ciascun entry: descrizione, parametri supportati+default, compatibilità vincoli (cardinality/overlapPercentage/robustness)
- Doc architettura core (docs/ARCHITECTURE.md): ✅ (M3.4)
  - Schema AST + come si usa
  - Include 1 esempio JSON minimo + 1 esempio “reale” (BDPE semplificato)
  - Note su determinismo + pipeline (UI → AST → validate → resolver → serializer)
- Resolver (src/core/resolver.ts): ✅ (M4.1)
  - Normalizzazione operatorId alias (Allen) → base ISEQL via mapping da operators.json (supporto robusto varianti `mapsTo`)
  - Completamento TemporalParams mancanti usando defaults globali + per-operatore
  - Garantisce che per ogni nodo con operatorId esista `params` (creato se mancante) con chiavi normalizzate
  - Normalizzazione chiavi params greche → latinizzate (zeta/eta/delta/epsilon/rho)
  - Explainability: explain[] con ruleId + text per decisione
  - Determinismo: sort stabile su array con `{id}` + explain[] ordinato stabilmente
- Serializer (src/core/serializer.ts): ✅ (M4.2)
  - Emissione output deterministico byte-for-byte
  - Serializza predicati (INTERVALS) e relazioni (RELATIONS) usando operatori base
  - Gestione "∞" e comparatori con convenzione canonica
  - Omissione parametri default (policy deterministica basata su defaults globali + per-operatore dal catalogo)
  - Supporto TemporalExpression "constraintIds" per imporre ordine di emissione (fallback stabile per id)
  - Fix determinismo: output termina sempre con newline finale `\n` (golden compat)
  - Fix qualità: rimosso eslint-disable inutile (lint pulito)

TODO (prossimi step core):

- Validator (src/core/validator.ts): TODO
- Wizard (src/core/wizard.ts): TODO

Test:

- Unit snapshot JSON stable: ✅
  - File: tests/model.test.ts
  - Gate: “creo modello minimo → snapshot JSON stable”
- Unit schema parse/invalid: ✅
  - File: tests/schema.test.ts
  - Gate: parse ok su modello valido; errori chiari su invalido
- Unit operators catalog: ✅ (M3.3)
  - File: tests/operators.test.ts
  - Gate: operators.json parseable + campi obbligatori presenti per ogni entry + id unici
- Unit resolver: ✅ (M4.1)
  - File: tests/resolver.test.ts
  - Gate:
    - 10 casi alias reali dal catalogo → base ISEQL + default params applicati
    - stesso input → stesso output (determinismo)
    - normalizzazione chiavi params greche → latinizzate
    - ordering stabile array con id
- Unit serializer: ✅ (M4.2)
  - File: tests/serializer.test.ts
  - Gate:
    - golden tests JSON→ISEQL (>=5)
    - test “default omessi / non-default inclusi”
  - Fixtures:
    - tests/fixtures/serializer/_.json + _.iseql

---

## 7) Templates / Fixtures (stato)

Template target (da materiali):

- BDPE: TODO
- DPE: TODO
- IPE: TODO
- UP: TODO

Fixture testing:

- Golden tests: IN PROGRESS
  - Primo golden: snapshot JSON stabile modello minimo ✅
  - Golden ISEQL serializer (>=5) ✅ (M4.2)

---

## 8) Issue, assunzioni, limiti

Assunzioni correnti:

- Il progetto non richiede connessione DB: solo generazione stringa ISEQL.
- La timeline è un aid di authoring (tick astratti), non un clock reale; serve a derivare relazioni/vincoli e compilare parametri.
- Gli operatori/parametri supportati sono definiti in SPEC e materializzati in src/core/operators.json.
- La “scelta automatica” del Resolver in MVP è rule-based (catalogo + regole), deterministica (non ML).
- (M3) Rappresentazione di ∞ per soglie δ/ε come stringa "∞" nel modello; mapping finale demandato al serializer.
- (M3.3) Alcuni alias Allen (Meets/Starts/Finishes) includono mapping “approx” via fixed params; semantica finale deterministica da Resolver/Serializer.
- (M3.4) La doc descrive `TemporalExpression` con una forma generica “root + intervalIds/constraintIds”;
  l’implementazione concreta resta la source of truth nel core.
- (M4.1) Il resolver accetta input params sia con chiavi greche (ζηδερ) sia latinizzate, ma emette sempre chiavi latinizzate per stabilità.
- (M4.2) Il serializer usa policy deterministica per omissione default basata su defaults globali+per-operatore dal catalogo e termina sempre con newline finale.

Debiti tecnici (se emergono):

- (vuoto)

Decisioni rimandate:

- autosave storage (localStorage vs file)
- livello di supporto chaining (A op B op C) in MVP (da SPEC)

---

## 9) Storico ultimo task completato

- Task ID: M4.2 — Implementa Serializer: AST risolto → stringa ISEQL ✅
- Data: 2026-02-07
- Dettagli:
  - Creato src/core/serializer.ts:
    - output deterministico byte-for-byte
    - serializzazione predicati (INTERVALS) e relazioni (RELATIONS) con operatori base
    - gestione "∞" e comparatori con convenzione canonica
    - omissione parametri default (deterministica) via defaults globali + per-operatore (operators.json)
    - supporto TemporalExpression.constraintIds per ordine di emissione
  - Fix: output termina sempre con newline finale `\n` per compatibilità golden
  - Fix: rimosso eslint-disable non necessario (lint pulito)
  - Creato docs/ISEQL_OUTPUT.md:
    - policy default omit
    - convenzioni parametri/∞/comparatori
    - esempi
  - Creato tests/serializer.test.ts + fixtures golden:
    - > =5 casi JSON→ISEQL
    - test default omessi / non-default inclusi
- Gate risultati (attesi / da eseguire localmente):
  - npm run lint → PASS
  - npm run test:unit → PASS
  - npm run build → PASS
- File creati/modificati principali:
  - iseql-event-modeler/src/core/serializer.ts (nuovo)
  - iseql-event-modeler/tests/serializer.test.ts (nuovo)
  - iseql-event-modeler/tests/fixtures/serializer/\* (nuovi)
  - iseql-event-modeler/docs/ISEQL_OUTPUT.md (nuovo)
  - iseql-event-modeler/docs/PROJECT_SNAPSHOT.md (aggiornato)

---

## Storico task precedenti (immutato, mantenuto completo)

- Task ID: M4.1 — Implementa Resolver: normalizzazione operatori + default params ✅
- Data: 2026-02-07
- Dettagli:
  - Creato/aggiornato src/core/resolver.ts:
    - normalizzazione operatorId alias → base ISEQL usando mapping dal catalogo (`mapsTo` e varianti)
    - completamento TemporalParams con defaults (globali + per-operatore)
    - creazione forzata di `params` se assente (per ogni nodo con operatorId), output con chiavi latinizzate
    - explain[] con ruleId + text per decisione
    - determinismo: sort stabile di array con `{id}` e explain[] ordinato stabilmente
  - Creato/aggiornato tests/resolver.test.ts:
    - 10 casi alias reali dal catalogo (data-driven) → base + defaults
    - determinismo (stesso input → stesso output)
    - normalizzazione chiavi params greche → latinizzate
    - ordering stabile array con id
  - Creato docs/OPERATOR_RULES.md:
    - regole resolver + esempi (alias → base, default params, determinismo)
- Gate risultati (attesi / da eseguire localmente):
  - npm run lint → PASS
  - npm run test:unit → PASS
  - npm run build → PASS
- File creati/modificati principali:
  - iseql-event-modeler/src/core/resolver.ts (nuovo/aggiornato)
  - iseql-event-modeler/tests/resolver.test.ts (nuovo/aggiornato)
  - iseql-event-modeler/docs/OPERATOR_RULES.md (nuovo)
  - iseql-event-modeler/docs/PROJECT_SNAPSHOT.md (aggiornato)

---

## Storico task precedenti (immutato, mantenuto completo)

- Task ID: M3.4 — Doc architettura core ✅
- Data: 2026-02-06
- Dettagli:
  - Creato docs/ARCHITECTURE.md con:
    - panoramica pipeline core (UI → AST → validate → resolver → serializer)
    - descrizione schema AST (EventModel, IntervalInstance, PredicateCall, ConstraintSet/Constraint, TemporalParams, TemporalExpression)
    - note su validazione Zod e determinismo
    - 1 esempio JSON minimo + 1 esempio “reale” (BDPE semplificato)
- Gate risultati (attesi / da eseguire localmente):
  - npm run lint → PASS
  - npm run test:unit → PASS
  - npm run build → PASS
- File creati/modificati principali:
  - iseql-event-modeler/docs/ARCHITECTURE.md (nuovo)

- Task ID: M3.3 — Catalogo operatori operators.json ✅
- Data: 2026-02-06
- Dettagli:
  - Creato src/core/operators.json con:
    - schemaVersion + parameterDefaults (ζ=≤, η=≤, δ=∞, ε=∞, ρ=0)
    - operatori base ISEQL (Bef/Aft/LOJ/ROJ/DJ/RDJ/SP/EF/Eq)
    - Allen 13 come alias (kind='alias') con mapping verso operatori base
    - compatibilità vincoli per entry (cardinality/overlapPercentage/robustness)
  - Creato tests/operators.test.ts:
    - JSON parseable
    - campi obbligatori presenti per ogni entry
    - id unici
- Gate risultati (attesi / da eseguire localmente):
  - npm run lint → PASS
  - npm run test:unit → PASS
  - npm run build → PASS
- File creati/modificati principali:
  - iseql-event-modeler/src/core/operators.json (nuovo)
  - iseql-event-modeler/tests/operators.test.ts (nuovo)

- Task ID: M3.2 — Zod schema per AST (contratti forti) ✅
- Data: 2026-02-06
- Dettagli:
  - Creato src/core/schema.ts con EventModelSchema + sub-schemas e validazioni:
    - start<=end
    - ids intervalli unici
    - left/right intervalId esistenti
    - domini parametri (δ/ε>=0 o "∞", ρ>=0, comparator enum)
    - strict mode
  - Fix compatibilità TypeScript/Zod typings:
    - rimosso uso di opzioni non supportate (invalid_type_error, errorMap)
    - z.record usa firma z.record(z.string(), z.unknown())
  - Creato tests/schema.test.ts:
    - parse ok su modello valido
    - errori chiari su invalido (end<start, refs mancanti, domini parametri)
- Gate risultati (attesi / da eseguire localmente):
  - npm run lint → PASS
  - npm run test:unit → PASS
  - npm run build → PASS
- File creati/modificati principali:
  - iseql-event-modeler/src/core/schema.ts (nuovo)
  - iseql-event-modeler/tests/schema.test.ts (nuovo)

- Task ID: M2.2 — User story + Acceptance (Given/When/Then) ✅
- Data: 2026-02-06
- Dettagli:
  - Aggiornato docs/SPEC.md aggiungendo 3 user story MVP con criteri Given/When/Then e Gate per-story:
    - US1: authoring intervalli su timeline (create/move/resize + labeling)
    - US2: generazione ISEQL via Resolver + explainability + determinismo
    - US3: save/load block AST JSON + collision handling + export .iseql
  - Gate risultati (attesi):
    - npm run lint → PASS
    - npm run test:unit → PASS
    - npm run build → PASS
  - File modificati principali:
    - iseql-event-modeler/docs/SPEC.md (aggiornato)

- Task ID: M2.1 — SPEC MVP vs Nice-to-have ✅
- Data: 2026-02-06
- Dettagli:
  - Creato/aggiornato docs/SPEC.md con perimetro MVP vs nice-to-have e allineamento consegna:
    - output “ISEQL pattern/regex-like”
    - supporto completo operatori temporali (ISEQL superset di Allen) + parametri/default + vincoli
    - decisione: modello interno ISEQL-native, Allen come alias UI opzionale
    - requisito MVP: timeline editor come input (disegno intervalli create/move/resize)
    - introdotto Resolver per auto-selezione operatore + parametri/default + explainability
    - OUT OF SCOPE esplicito (no DB runtime, no image processing, no ottimizzazioni)
  - Gate risultati (attesi):
    - npm run lint → PASS
    - npm run test:unit → PASS
    - npm run build → PASS
  - File modificati principali:
    - iseql-event-modeler/docs/SPEC.md (aggiornato)

- Task ID: M1.7 — Prima build release Tauri (packaging minimo) ✅
- Data: 2026-02-05
- Dettagli:
  - Configurati nome app (productName) e bundle identifier in src-tauri/tauri.conf.json
  - Generato set icone src-tauri/icons/\* tramite npm run tauri icon
  - Su Windows: configurato NSIS come installer brandizzato; MSI generato con limite icona taskbar durante install (accettato)
  - Build release con npm run tauri build e generazione bundle/installer
  - Gate risultati:
    - npm run tauri build → PASS (bundle generati in src-tauri/target/release/bundle/)
    - Avvio eseguibile/installer → PASS
- File modificati principali:
  - iseql-event-modeler/src-tauri/tauri.conf.json (modificato)
  - iseql-event-modeler/src-tauri/icons/\* (generati)

- Task ID: M1.6 — Struttura cartelle definitiva ✅
- Data: 2026-02-05
- Dettagli:
  - Create cartelle: src/core, src/ui, docs, templates, tests, assets
  - Aggiunti placeholder .gitkeep per versionare directory vuote
  - Gate risultati:
    - npm run dev → PASS
    - npm run tauri dev → PASS
- File modificati principali:
  - iseql-event-modeler/src/core/.gitkeep (nuovo)
  - iseql-event-modeler/src/ui/.gitkeep (nuovo)
  - iseql-event-modeler/templates/.gitkeep (nuovo)
  - iseql-event-modeler/tests/.gitkeep (nuovo)
  - iseql-event-modeler/assets/.gitkeep (nuovo)

- Task ID: M1.5 — Husky + lint-staged (guardrail) ✅
- Data: 2026-02-05
- Dettagli:
  - Aggiunti husky + lint-staged come devDependencies
  - Configurato Git hooks via git config core.hooksPath iseql-event-modeler/.husky
  - Creato hook .husky/pre-commit che esegue npx lint-staged (con cd iseql-event-modeler)
  - Aggiunto .gitattributes per forzare LF sugli hook/script
- File modificati principali:
  - iseql-event-modeler/package.json
  - iseql-event-modeler/.husky/pre-commit
  - .gitattributes

- Task ID: M1.4 — Tooling qualità: ESLint + Prettier ✅
- Data: 2026-02-05
- Dettagli:
  - Aggiunto ESLint flat config + Prettier config
  - Aggiornati script npm: lint, lint:fix, format, format:check
- File modificati principali:
  - package.json
  - eslint.config.js
  - .prettierrc.json
  - .prettierignore

- Task ID: M1.3 — Aggiungi Tauri e verifica dev desktop ✅
- Data: 2026-02-04
- Dettagli:
  - Aggiunto Tauri al progetto (tauri init) con cartella src-tauri/
  - Configurato tauri.conf.json per Vite dev server e build output
  - Script npm tauri per npm run tauri dev

- Task ID: M1.2 — Scaffolding Vite + React + TypeScript ✅
- Data: 2026-02-04
- Dettagli:
  - Creato progetto Vite (template React + TypeScript)
  - Installate dipendenze npm
  - Dev server avviato e pagina base verificata
