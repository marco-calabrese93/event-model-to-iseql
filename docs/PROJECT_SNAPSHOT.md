# PROJECT_SNAPSHOT — ISEQL Event Modeler (Desktop)

## 0) Stato generale

- Data snapshot: 2026-02-08
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
  - M4.3 — Implementa Validator core (oltre lo schema Zod): compatibilità e warning ✅
  - M4.4 — Implementa Compiler orchestrator (API unica per UI): schema→validator→resolver→serializer ✅
  - M5.1 — Helpers: interval ops + invarianti (move/resize) deterministici ✅
  - M5.2 — Derivazione parametri da geometria (opt-in) ✅
  - M6.1 — Setup Tailwind + shadcn/ui + componenti base ✅
  - M6.2 — Store Zustand per EventModel + actions (interval-centric) ✅
  - M7.1 — Timeline editor: create interval (drag) + no-overlap policy + fix dropdown overlay ✅
  - M7.2 — Timeline editor: move interval (drag) + resize (handles) ✅
  - M7.3 — Interval label editor: predicate + args (panel laterale/modal) ✅
    - Nota: attivato smoke Playwright (config + test) e fissato la creazione intervalli per compatibilità smoke (selezione intervallo + label)

- Prossimo task (da backlog): Wizard (src/core/wizard.ts) (TODO)

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

- Tailwind CSS ✅ (installato e configurato in M6.1)
- shadcn/ui ✅ (componenti base in M6.1)

State:

- Zustand ✅ (dipendenza installata in M6.2)

Forms & Validation:

- React Hook Form
- Zod (+ zodResolver)

Testing:

- Vitest (unit/core) ✅ (installato e in uso)
- Playwright (smoke UI) ✅ (attivato in M7.3)

Quality:

- ESLint
- Prettier
- Husky + lint-staged

---

## 3) Struttura cartelle (source of truth)

- src/
  - core/ (AST, Zod schema, serializer, validator, resolver, compiler, wizard, timeline)
  - ui/ (layout, panels, components, Zustand store)
- src-tauri/ (Tauri rust project + tauri.conf.json)
- docs/
- templates/
- tests/
  - smoke/ (Playwright smoke UI) ✅ (M7.3)
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
- test:unit esclude i test smoke Playwright sotto `tests/smoke/**` (M7.3) per evitare import di `@playwright/test` durante unit.

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
  - Operatori base ISEQL e Allen 13 come alias
  - Metadati per ciascun entry: descrizione, parametri supportati+default, compatibilità vincoli
  - Nota strutturale rilevante:
    - operatori con `kind: "operator"`, `id` lowercase (es. "bef") e `code` (es. "Bef")
    - compat vincoli in `constraintCompatibility`
    - alias Allen mappano via `mapsTo.operatorId` verso `id` lowercase (es. "bef", "dj")
- Doc architettura core (docs/ARCHITECTURE.md): ✅ (M3.4, aggiornato in M4.4, M5.1, M6.2)
  - Schema AST + come si usa
  - Include 1 esempio JSON minimo + 1 esempio “reale” (BDPE semplificato)
  - Note su determinismo + pipeline (UI → compiler → validate → resolver → serializer)
  - Contract compiler: output `{ iseql, resolvedModel, explain, errors, warnings }`, errors bloccanti, warnings non bloccanti
  - Nota timeline (M5.1): invarianti tick/interval e regole deterministiche per create/move/resize (clamp, preserva durata, anti-inversione)
  - Nota dataflow UI (M6.2): Builder → Zustand store (SSOT) → compiler core
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
- Validator (src/core/validator.ts): ✅ (M4.3)
  - Validazione “umana” (UX) oltre lo schema Zod strict:
    - compatibilità operatore/vincoli tramite `constraintCompatibility` da operators.json
    - riferimenti intervalIds / constraintIds inesistenti → error
    - range parametri (delta/epsilon/rho) + comparatori (zeta/eta) incl. simboli Unicode `≤`/`≥`
    - warning UX: chiavi greche non canoniche, vincoli ridondanti, soglie sospette, params mancanti
  - Lookup operatori: valida `operatorId` confrontando prima `operators[].code` (es. "Bef"/"DJ"/"LOJ"), con fallback su `operators[].id` per robustezza.
- Compiler (src/core/compiler.ts): ✅ (M4.4)
  - API unica per UI: `compileEventModel(input: EventModel)`
  - Pipeline: Zod parse strict → validator (UX/semantica) → resolver (normalizzazione + defaults + explain) → serializer (ISEQL deterministico)
  - Policy: se `errors.length > 0` → `iseql=null` e `resolvedModel=null`
  - Warnings non bloccanti: `iseql` prodotto anche con warnings presenti
  - Determinismo: ordering stabile (sort su issues) + output deterministico
- Timeline helpers (src/core/timeline.ts): ✅ (M5.1)
  - createInterval(start/end) con normalizzazione tick, swap se necessario, clamp a bounds
  - moveInterval preserva durata, clamp con shift dell’intervallo come blocco; se la durata non entra nei bounds finiti → clamp a `[minTick,maxTick]`
  - resizeStart/resizeEnd con clamp e prevenzione start>end (snap al bordo opposto)
  - determinismo: tick normalizzati a interi (Math.round), output immutabile (ritorna copia preservando campi extra)
- Derive params helper (src/core/deriveParams.ts): ✅ (M5.2)
  - helper opt-in: `deriveParamsFromGeometry({ left, right, operatorId })`
  - propone soglie δ/ε in base a distanze tra endpoints (gap/diff), clamp a >=0
  - propone ρ deterministico (default 0) con explain dedicato
  - explainability: `ruleId + text` per ogni derivazione
  - determinismo: output e ordering explain stabili
- Timeline editor (src/ui/components/TimelineEditor/\*): ✅ (M7.1, M7.2, M7.3)
  - create interval via drag su track (snapping tick + clamp a bounds)
  - policy MVP “no overlap” applicata in UI (preview + commit) per evitare intervalli sovrapposti in creazione
    - overlap check trattato come [start,end) per determinismo
    - in collisione: push/clamp nel primo gap disponibile secondo direzione drag
    - se nessuno spazio disponibile: noop (nessun intervallo creato)
  - move interval via drag (M7.2)
    - preserva durata (store action delega a core moveInterval)
    - clamp bounds UI (default 0–100)
  - resize interval via handles (M7.2)
    - handles UI: sinistra = resize start, destra = resize end
    - store actions usate: `resizeIntervalStart` e `resizeIntervalEnd`
    - clamp e prevenzione inversione garantite dai core helpers
  - label editor (M7.3)
    - selezione intervallo (click)
    - editor predicati (catalogo minimo statico per MVP)
    - args input (array string)
    - persistenza sullo store Zustand (labeling ok)
  - fix overlay dropdown (Radix Select) (M7.1):
    - `SelectContent` portal con z-index alto
    - pannello “Selection” sopra la track
  - compatibilità TS/build (M7.2):
    - `TickBounds` re-export pubblico dal modulo TimelineEditor
    - evitato `JSX.Element` (usa `React.ReactElement`)
    - UI timeline evita tipi branded dal core (IntervalId/IntervalInstance) usando shape UI `{ id: string; start; end }`

Smoke UI (Playwright) ✅ (M7.3)

- installata dipendenza `@playwright/test`
- aggiunto `playwright.config.ts` (webServer Vite su http://localhost:5173)
- aggiunto test `tests/smoke/labeling.spec.ts` (drag-to-create interval → assign predicate+args → verifica persistenza)
- esclusione dei test smoke dalla run `npm run test:unit`

TODO (prossimi step core):

- Wizard (src/core/wizard.ts): TODO

Test: (aggiornato)

- Unit snapshot JSON stable: ✅
- Unit schema parse/invalid: ✅
- Unit operators catalog: ✅
- Unit resolver: ✅
- Unit serializer: ✅
- Unit validator: ✅
- Unit compiler: ✅
- Unit timeline helpers: ✅
- Unit derive params: ✅
- Unit timeline editor utils (snapping + no-overlap + move/resize helpers): ✅ (M7.1, M7.2)

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
- (M4.4) Il compiler è l’unico entrypoint per la UI e applica la policy blocking/non-blocking (errors bloccano export; warnings no).
- (M5.1) Timeline helpers normalizzano ticks a interi (Math.round) e applicano clamp bounds (default min=0, max=∞); move preserva durata quando possibile e resize previene inversione.
- (M5.2) Derive params è un helper opt-in: propone δ/ε da geometria endpoint (clamp >=0) e ρ=0 deterministico; non modifica ζ/η.
- (M7.1) La policy “no overlap” è implementata lato UI per la sola creazione intervalli (preview + commit). L’azione store `createInterval` resta general-purpose e non impedisce overlap se chiamata direttamente da altro codice.
- (M7.2) Move/Resize non applicano una policy “no overlap” (non richiesta dal task). Le invarianti garantite sono clamp bounds e prevenzione inversione via core helpers (attraverso store actions dedicate).
- (M7.3) Il catalogo predicati è statico per MVP; args sono gestiti come array di stringhe; il label è persistito nello store.

Issue/Note consolidate (da M4.3):

- `operators.json` distingue tra `id` (lowercase, es. "bef") e `code` (UI, es. "Bef"). Il validator deve validare `operatorId` principalmente contro `code`.
- Compatibilità vincoli in `constraintCompatibility` (non `supports`).
- I constraint in alcuni payload/test usano `kind` (non `type`): validator supporta entrambi.
- Comparatori validi includono `≤` e `≥` oltre a <= / >=.

Debiti tecnici (se emergono):

- (vuoto)

Decisioni rimandate:

- autosave storage (localStorage vs file)
- livello di supporto chaining (A op B op C) in MVP (da SPEC)

---

## 9) Storico ultimo task completato

- Task ID: M7.3 — Interval label editor: predicate + args (panel laterale/modal) ✅
- Data: 2026-02-08
- Dettagli:
  - Obiettivo: associare PredicateCall agli intervalli.
  - Timeline editor:
    - selezione intervallo (click)
    - editor predicati con catalogo minimo statico MVP
    - args input come array string (anche solo array string)
    - label renderizzata sul blocco intervallo (es. `Pred(a,b)`)
  - Store:
    - `setPredicate(intervalId, name, args)` per assegnare label
    - `clearPredicate(intervalId)` per reset label
  - Smoke UI (Playwright):
    - aggiunto `playwright.config.ts` con webServer Vite (URL dev: http://localhost:5173/)
    - creato `tests/smoke/labeling.spec.ts`
    - Gate smoke: assegno predicate+args a un interval e resta salvato
  - Documentazione:
    - aggiornato `docs/USER_GUIDE.md` (Label interval)

- Gate risultati (attesi / da eseguire localmente per pre-merge):
  - npm run test:unit → PASS
  - npm run test:smoke → PASS
  - npm run lint → PASS
  - npm run build → PASS
  - npm run tauri dev → PASS

- File creati/modificati principali:
  - iseql-event-modeler/src/ui/components/TimelineEditor/TimelineEditor.tsx (aggiornato: label editor)
  - iseql-event-modeler/src/ui/store/eventModelStore.ts (aggiornato: clearPredicate)
  - iseql-event-modeler/tests/store.eventModelStore.test.ts (aggiornato: test clearPredicate)
  - iseql-event-modeler/tests/smoke/labeling.spec.ts (nuovo)
  - iseql-event-modeler/playwright.config.ts (nuovo)
  - iseql-event-modeler/vite.config.ts (aggiornato: vitest exclude tests/smoke/\*\*)
  - iseql-event-modeler/eslint.config.js (aggiornato: ignore playwright-report/test-results)
  - iseql-event-modeler/package.json (aggiornato: devDependency @playwright/test)

---

## Storico task precedenti (immutato, mantenuto completo)

- Task ID: M7.2 — Timeline editor: move interval (drag) + resize (handles) ✅
- Data: 2026-02-08
- Dettagli:
  - Timeline editor:
    - Move interval via drag sulla barra:
      - preserva durata (store action delega a core moveInterval)
      - clamp a bounds UI (default 0–100)
    - Resize interval via handles:
      - maniglia sinistra: chiama store action `resizeIntervalStart`
      - maniglia destra: chiama store action `resizeIntervalEnd`
      - clamp e prevenzione inversione (start ≤ end sempre vero) garantite dai core helpers
  - Fix compatibilità TS/build:
    - `TickBounds` esportato dal modulo TimelineEditor (index.ts)
    - evitato `JSX.Element` (usa `React.ReactElement`)
    - UI non dipende da branded ids del core (IntervalId)
    - ripristinato helper puro `applyDragToInterval` in utils per unit test (senza branded types)
  - Test unit:
    - aggiornati test su utilities (clientX→tick, clamp, move/resize invariants)
  - Documentazione:
    - aggiornato `docs/USER_GUIDE.md` con Move/Resize
- Gate risultati (attesi / da eseguire localmente per pre-merge):
  - npm run test:unit → PASS
  - npm run lint → PASS
  - npm run build → PASS
  - npm run tauri dev → PASS
- File creati/modificati principali:
  - iseql-event-modeler/src/ui/components/TimelineEditor/TimelineEditor.tsx (aggiornato: resizeIntervalStart/End)
  - iseql-event-modeler/src/ui/components/TimelineEditor/utils.ts (aggiornato: TickBounds + applyDragToInterval)
  - iseql-event-modeler/src/ui/components/TimelineEditor/index.ts (aggiornato: export TickBounds)
  - iseql-event-modeler/tests/timelineEditor.utils.test.ts (aggiornato)
  - iseql-event-modeler/docs/USER_GUIDE.md (aggiornato)

---

## Storico task precedenti (immutato, mantenuto completo)

- Task ID: M7.1 — Timeline editor: create interval (drag) + no-overlap policy + fix dropdown overlay ✅
- Data: 2026-02-08
- Dettagli:
  - Timeline editor:
    - drag-to-create su track con snapping a tick interi e clamp bounds (default 0–100)
    - preview durante drag e commit su mouseup
  - Policy MVP “no overlap” (deterministica, in UI):
    - intervalli trattati come [start,end) per overlap checks
    - in caso di collisione: push/clamp nel primo gap disponibile secondo direzione drag
    - se non c’è spazio disponibile: noop (nessun intervallo creato)
    - garantito `start < end` quando possibile (durata minima 1 tick)
  - Fix UI overlay (dropdown Select):
    - `SelectContent` con z-index alto in portal (non si sovrappone più agli intervalli)
    - pannello “Selection” reso stacking context sopra la track
  - Test unit:
    - aggiunti test per utilities del timeline editor (snapping + no-overlap)
  - Documentazione:
    - aggiunto `docs/USER_GUIDE.md` con regole di create interval e no-overlap
- Gate risultati (attesi / da eseguire localmente per pre-merge):
  - npm run test:unit → PASS
  - npm run lint → PASS
  - npm run build → PASS
  - npm run tauri dev → PASS
- File creati/modificati principali:
  - iseql-event-modeler/src/ui/components/TimelineEditor/TimelineEditor.tsx (aggiornato)
  - iseql-event-modeler/src/ui/components/TimelineEditor/utils.ts (nuovo/aggiornato)
  - iseql-event-modeler/src/ui/components/ui/select.tsx (aggiornato: z-index portal)
  - iseql-event-modeler/tests/timelineEditor.utils.test.ts (nuovo)
  - iseql-event-modeler/docs/USER_GUIDE.md (nuovo)

---

## Storico task precedenti (immutato, mantenuto completo)

- Task ID: M6.2 — Store Zustand per EventModel + actions (interval-centric) ✅
- Data: 2026-02-08
- Dettagli:
  - Creato store Zustand come SSOT UI per timeline + constraints:
    - `src/ui/store/eventModelStore.ts`:
      - actions: create/move/resize interval, set predicate, add constraint, set operator, reset
      - ids deterministici: `interval_0001…`, `constraint_0001…`
      - trasformazioni tick tramite helpers core `src/core/timeline.ts` (determinismo e invarianti)
      - fix build TS: rimosso import type non esportato dal core (`IntervalBounds`) e dedotto il tipo bounds dalla firma di `createInterval`
    - `src/ui/store/index.ts` export barrel
  - Dipendenze:
    - aggiunta/installata `zustand` (necessaria per import in UI e test)
  - Test unit (Vitest):
    - aggiunti 8 test sulle actions (stabilità, determinismo ids, invarianti resize/move, reset, replay deterministico)
  - Doc:
    - aggiornato `docs/ARCHITECTURE.md` con sezione “UI dataflow (Builder → Store → Core compiler)”
- Gate risultati (attesi / da eseguire localmente per pre-merge):
  - npm run test:unit → PASS
  - npm run lint → PASS
  - npm run build → PASS
- File creati/modificati principali:
  - iseql-event-modeler/src/ui/store/eventModelStore.ts (nuovo + fix typing build)
  - iseql-event-modeler/src/ui/store/index.ts (nuovo)
  - iseql-event-modeler/tests/store.eventModelStore.test.ts (nuovo)
  - iseql-event-modeler/docs/ARCHITECTURE.md (aggiornato)
  - iseql-event-modeler/package.json (aggiornato: dipendenza zustand)
  - iseql-event-modeler/package-lock.json (aggiornato)

---

## Storico task precedenti (immutato, mantenuto completo)

- Task ID: M6.1 — Setup Tailwind + shadcn/ui + componenti base ✅
- Data: 2026-02-08
- Dettagli:
  - Tailwind setup:
    - Config: `tailwind.config.cjs` (scelto per compatibilità in build)
    - PostCSS (Tailwind v4): plugin `@tailwindcss/postcss` in `postcss.config.cjs`
    - Entry CSS: `src/index.css` con `@tailwind base/components/utilities` + design tokens (CSS variables)
    - Fix build Tailwind v4: evitato `@apply` su utilities tokenizzate (es. `border-border`, `bg-background`) sostituendo con CSS puro basato su variables per `border-color`, `background-color`, `color`
    - Alias `@/*` in `tsconfig.json` e `vite.config.ts`
  - shadcn/ui setup:
    - `components.json`
    - util `cn()` in `src/lib/utils.ts` (clsx + tailwind-merge)
    - componenti base aggiunti:
      - Button, Input, Select, Tabs, Accordion, Tooltip, Toast (+ Toaster)
    - Fix ESLint:
      - `postcss.config.cjs` usa `/* global module */` (flat config)
      - disable locale `react-refresh/only-export-components` in `button.tsx` e `use-toast.tsx`
      - `InputProps` definito come type alias per evitare `no-empty-object-type`
      - `use-toast` rinominato a `use-toast.tsx` (JSX)
  - Smoke UI:
    - aggiunto `src/ui/ToolkitDemo.tsx` e wiring in `src/App.tsx` per render check
  - Documentazione:
    - creato `docs/UI_OVERVIEW.md` (toolkit + convenzioni)

- Gate risultati (attesi / da eseguire localmente per pre-merge):
  - npm run lint → PASS
  - npm run test:unit → PASS
  - npm run build → PASS
  - npm run tauri dev → PASS

- File creati/modificati principali:
  - iseql-event-modeler/tailwind.config.cjs (nuovo)
  - iseql-event-modeler/postcss.config.cjs (aggiornato)
  - iseql-event-modeler/components.json (nuovo/aggiornato)
  - iseql-event-modeler/src/index.css (aggiornato)
  - iseql-event-modeler/src/lib/utils.ts (nuovo)
  - iseql-event-modeler/src/ui/components/ui/button.tsx (nuovo/aggiornato)
  - iseql-event-modeler/src/ui/components/ui/input.tsx (nuovo/aggiornato)
  - iseql-event-modeler/src/ui/components/ui/select.tsx (nuovo)
  - iseql-event-modeler/src/ui/components/ui/tabs.tsx (nuovo)
  - iseql-event-modeler/src/ui/components/ui/accordion.tsx (nuovo)
  - iseql-event-modeler/src/ui/components/ui/tooltip.tsx (nuovo)
  - iseql-event-modeler/src/ui/components/ui/toast.tsx (nuovo)
  - iseql-event-modeler/src/ui/components/ui/use-toast.tsx (nuovo/aggiornato)
  - iseql-event-modeler/src/ui/components/ui/toaster.tsx (nuovo/aggiornato)
  - iseql-event-modeler/src/ui/ToolkitDemo.tsx (nuovo)
  - iseql-event-modeler/src/App.tsx (aggiornato)
  - iseql-event-modeler/docs/UI_OVERVIEW.md (nuovo)

---

## Storico task precedenti (immutato, mantenuto completo)

- Task ID: M5.2 — (Opzionale MVP, ma previsto in SPEC) Derivazione parametri da geometria (opt-in) ✅
- Data: 2026-02-08
- Dettagli:
  - Creato `src/core/deriveParams.ts`:
    - `deriveParamsFromGeometry({ left, right, operatorId })` → suggerisce δ/ε/ρ
    - regole deterministiche per famiglie (Bef/Aft/LOJ/ROJ/DJ/RDJ/SP/EF/Eq)
    - clamp soglie a >=0
    - explainability: `ruleId + text` per ogni scelta (incl. `ρ` default 0)
    - determinismo: ordering explain stabile; funzione pura (no random/clock)
  - Creato `tests/deriveParams.test.ts`:
    - 5 casi geometrico → parametri attesi (Bef/Aft/LOJ/DJ/EF)
  - Aggiornato `docs/OPERATOR_RULES.md`:
    - aggiunta sezione “Derive thresholds from timeline (opt-in)” con regole + ruleId

- Gate risultati (attesi / da eseguire localmente per pre-merge):
  - npm run test:unit → PASS
  - npm run lint → PASS
  - npm run build → PASS

- File creati/modificati principali:
  - iseql-event-modeler/src/core/deriveParams.ts (nuovo)
  - iseql-event-modeler/tests/deriveParams.test.ts (nuovo)
  - iseql-event-modeler/docs/OPERATOR_RULES.md (aggiornato)
  - iseql-event-modeler/docs/PROJECT_SNAPSHOT.md (aggiornato)

---

## Storico task precedenti (immutato, mantenuto completo)

- Task ID: M5.1 — Helpers: interval ops + invarianti (move/resize) deterministici ✅
- Data: 2026-02-08
- Dettagli:
  - Creato src/core/timeline.ts:
    - createInterval(start/end,bounds?) con normalizzazione tick, swap se necessario, clamp a bounds (default min=0, max=∞)
    - moveInterval(interval,delta,bounds?) preserva durata e clampa shiftando l’intervallo come blocco; se la durata non entra nei bounds finiti → clamp a `[minTick,maxTick]`
    - resizeStart/resizeEnd/resizeInterval con clamp e prevenzione inversione (start<=end)
    - determinismo: ticks normalizzati a interi via Math.round, output immutabile (ritorna copia preservando campi extra)
  - Creato tests/timeline.test.ts:
    - 10 test edge-case: negativi/clamp, maxTick, crossing resize, durata non-fitting, immutabilità
  - Aggiornato docs/ARCHITECTURE.md:
    - aggiunta sezione “Timeline invariants (Builder)” con policy deterministiche
  - Fix quality:
    - rimossi unused vars in timeline.ts che causavano warning ESLint e errore TS6133 in build

- Gate risultati (eseguiti):
  - npm run test:unit → PASS (44 passed)
  - npm run lint → PASS
  - npm run build → PASS

- File creati/modificati principali:
  - iseql-event-modeler/src/core/timeline.ts (nuovo, poi fix lint/build)
  - iseql-event-modeler/tests/timeline.test.ts (nuovo)
  - iseql-event-modeler/docs/ARCHITECTURE.md (aggiornato)
  - iseql-event-modeler/docs/PROJECT_SNAPSHOT.md (aggiornato)

---

## Storico task precedenti (immutato, mantenuto completo)

- Task ID: M4.4 — Implementa Compiler orchestrator (API unica per UI) ✅
- Data: 2026-02-08
- Dettagli:
  - Creato/aggiornato src/core/compiler.ts:
    - API unica per UI: `compileEventModel(input: EventModel)`
    - Zod strict parse (`EventModelSchema.parse`)
    - validator (UX/semantico) → errors/warnings
    - resolver (normalizzazione alias + default params + explainability)
    - serializer (ISEQL deterministico, newline finale)
    - policy: con errors bloccanti → `iseql=null` e `resolvedModel=null`; warnings non bloccanti
    - determinismo: ordering stabile di issues + output deterministico; deepEqual su doppia compilazione
  - Creato/aggiornato tests/compiler.test.ts:
    - compilazione OK (iseql/resolvedModel/explain)
    - errori Zod (iseql null, errors presenti)
    - warnings non bloccanti (iseql prodotto + warnings non vuoto)
    - determinismo (deepEqual)
  - Aggiornato docs/ARCHITECTURE.md:
    - pipeline aggiornata: UI → compiler → validate/resolver/serialize
    - contract output + regole blocking/non-blocking

- Gate risultati (eseguiti):
  - npm run test:unit → PASS

- Gate risultati (attesi / da eseguire localmente per pre-merge):
  - npm run lint → PASS
  - npm run test:unit → PASS
  - npm run build → PASS

- File creati/modificati principali:
  - iseql-event-modeler/src/core/compiler.ts (nuovo/aggiornato)
  - iseql-event-modeler/tests/compiler.test.ts (nuovo/aggiornato)
  - iseql-event-modeler/docs/ARCHITECTURE.md (aggiornato)
  - iseql-event-modeler/docs/PROJECT_SNAPSHOT.md (aggiornato)

---

## Storico task precedenti (immutato, mantenuto completo)

- Task ID: M4.3 — Implementa Validator core (oltre lo schema Zod): compatibilità e warning ✅
- Data: 2026-02-07
- Dettagli:
  - Creato/aggiornato src/core/validator.ts:
    - validazione “umana” oltre Zod:
      - compatibilità operatore/vincoli usando `constraintCompatibility` da operators.json
      - refs intervalIds/constraintIds inesistenti → error
      - range parametri (delta/epsilon/rho) → error
      - comparatori (zeta/eta) con supporto simboli `≤`/`≥`
      - warnings UX: chiavi greche non canoniche, vincoli ridondanti, soglie sospette, params mancanti
    - lookup operatori allineato alla struttura reale del catalogo:
      - match su `operators[].code` (Bef/DJ/LOJ) + fallback su `operators[].id`
    - determinismo: ordinamento stabile di errors/warnings (path|code|message)
  - Aggiornato tests/validator.test.ts:
    - rimosso `any` (lint compliance) usando `unknown` senza modificare snapshot
  - Creato/aggiornato docs/VALIDATION.md:
    - codici stabili + regole di lookup (`code` vs `id`) + note comportamentali per UX/snapshot

- Gate risultati (eseguiti):
  - npm run test:unit → PASS (30/30)

- Gate risultati (attesi / da eseguire localmente per pre-merge):
  - npm run lint → PASS
  - npm run test:unit → PASS
  - npm run build → PASS

- File creati/modificati principali:
  - iseql-event-modeler/src/core/validator.ts (nuovo/aggiornato)
  - iseql-event-modeler/tests/validator.test.ts (aggiornato)
  - iseql-event-modeler/docs/VALIDATION.md (nuovo/aggiornato)
  - iseql-event-modeler/docs/PROJECT_SNAPSHOT.md (aggiornato)

---

## Storico task precedenti (immutato, mantenuto completo)

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
    - descrizione schema AST (EventModel, IntervalInstance, PredicateCall, TemporalExpression, ConstraintSet/Constraint, TemporalParams, TemporalExpression)
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
    - operatori base ISEQL (Bef/Aft/LOJ/ROJ/DJ/RDJ/SP/EF/Eq) e Allen 13 come alias (kind='alias')
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
