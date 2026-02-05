# PROJECT_SNAPSHOT — ISEQL Event Modeler (Desktop)

## 0) Stato generale

- Data snapshot: 2026-02-05
- Fase corrente: avvio progetto (da M1.2 in poi si usa workflow Snapshot+Prompt)
- Milestone completate: M0 (Setup macchina) ✅, M1.2 — Scaffolding Vite + React + TypeScript ✅, M1.3 — Aggiungi Tauri e verifica dev desktop ✅, M1.4 — Tooling qualità: ESLint + Prettier ✅, M1.5 — Husky + lint-staged (guardrail) ✅, M1.6 — Struttura cartelle definitiva ✅
- Prossimo task: (da backlog) successivo da definire

---

## 1) Visione e obiettivo

Applicazione desktop (eseguibile) che permette di definire modelli di evento tramite GUI e genera una query ISEQL (solo output, nessuna connessione DB).

Output principale:

- stringa ISEQL generata dal modello  
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

- Vitest (unit/core)
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

- npm run lint
- npm run format
- npm run test:unit
- npm run test:smoke
- npm run build
- npm run tauri dev
- npm run tauri build

Gate globale pre-merge: lint + test:unit + build verdi  
Gate globale pre-release: + test:smoke + tauri build verdi

---

## 5) Decisioni UX rilevanti (source of truth)

- Layout 3 pannelli: Builder / Preview / Output
- Modalità: Expert + Wizard
- Output panel: query live + Copy + Export .iseql + Validate + Reset
- Explainability: mostra regola usata dal resolver (ruleId + testo)
- Preview: timeline/diagramma minimale degli intervalli

Decisione da prendere (non ancora fissata):

- Autosave: localStorage (MVP) vs file su disco (Tauri)

Export:

- Export .iseql tramite Tauri save dialog (target MVP)

---

## 6) Contratti core (stato attuale)

NOTA: da qui in poi ogni task aggiorna questa sezione con link ai file e stato.

- AST (src/core/model.ts): TODO
- Zod schema (src/core/schema.ts): TODO
- Operators catalog (src/core/operators.json): TODO
- Serializer ISEQL (src/core/serializer.ts): TODO
- Validator (src/core/validator.ts): TODO
- Resolver (src/core/resolver.ts): TODO
- Wizard (src/core/wizard.ts): TODO

---

## 7) Templates / Fixtures (stato)

Template target (da materiali):

- BDPE: TODO
- DPE: TODO
- IPE: TODO
- UP: TODO

Fixture testing:

- Golden tests: TODO (JSON -> ISEQL expected)

---

## 8) Issue, assunzioni, limiti

Assunzioni correnti:

- Il progetto non richiede connessione DB: solo generazione stringa ISEQL.
- Gli operatori/parametri supportati verranno definiti in SPEC (M2).
- Prerequisiti Tauri (Rust toolchain + dipendenze OS) completati in M0.

Debiti tecnici (se emergono):

- (vuoto)

Decisioni rimandate:

- autosave storage (localStorage vs file)
- livello di supporto chaining (A op B op C) in MVP (da SPEC)

---

## 9) Storico ultimo task completato

- Task ID: M1.6 — Struttura cartelle definitiva ✅
- Data: 2026-02-05
- Dettagli:
  - Create cartelle: `src/core`, `src/ui`, `docs`, `templates`, `tests`, `assets`
  - Aggiunti placeholder `.gitkeep` per versionare directory vuote
- Gate risultati:
  - `npm run dev` → PASS (dev server ok)
  - `npm run tauri dev` → PASS (app desktop ok)
- File modificati principali:
  - iseql-event-modeler/src/core/.gitkeep (nuovo)
  - iseql-event-modeler/src/ui/.gitkeep (nuovo)
  - iseql-event-modeler/templates/.gitkeep (nuovo)
  - iseql-event-modeler/tests/.gitkeep (nuovo)
  - iseql-event-modeler/assets/.gitkeep (nuovo)

- Task ID: M1.5 — Husky + lint-staged (guardrail) ✅
- Data: 2026-02-05
- Dettagli:
  - Aggiunti `husky` + `lint-staged` come devDependencies
  - Husky CLI mostra messaggi “DEPRECATED” per comandi legacy (non bloccanti)
  - Configurato Git hooks via `git config core.hooksPath iseql-event-modeler/.husky`
  - Creato hook `iseql-event-modeler/.husky/pre-commit` che esegue `npx lint-staged` (con `cd iseql-event-modeler`)
  - Aggiunto `.gitattributes` per forzare LF sugli hook/script (evita problemi CRLF su Windows)
- Gate risultati:
  - `git commit` con file non formattato → `lint-staged` esegue task sugli staged e applica fix (PASS)
- File modificati principali:
  - iseql-event-modeler/package.json (devDependencies + config lint-staged)
  - iseql-event-modeler/.husky/pre-commit (nuovo/modificato)
  - .gitattributes (nuovo, repo root)

- Task ID: M1.4 — Tooling qualità: ESLint + Prettier ✅
- Data: 2026-02-05
- Dettagli:
  - Aggiunto ESLint con flat config (`eslint.config.js`) per TypeScript + React Hooks + React Refresh
  - Aggiunto Prettier con config (`.prettierrc.json`) e ignore (`.prettierignore`)
  - Aggiornati script npm: `lint`, `lint:fix`, `format`, `format:check`
- Gate risultati:
  - `npm run lint` → PASS (0 errori)
  - `npm run format` → PASS (nessun errore; eventuali file riscritti)
  - `npm run build` → PASS
- File modificati principali:
  - package.json (devDependencies + scripts)
  - eslint.config.js
  - .prettierrc.json
  - .prettierignore

- Task ID: M1.3 — Aggiungi Tauri e verifica dev desktop ✅
- Data: 2026-02-04
- Dettagli:
  - Aggiunto Tauri al progetto (tauri init) con cartella `src-tauri/`
  - Configurato `src-tauri/tauri.conf.json` per usare Vite dev server (`devUrl`) e build output (`frontendDist`)
  - Aggiunto script npm `tauri` per abilitare `npm run tauri dev`
- Gate risultati:
  - `npm run tauri dev` → finestra desktop aperta e app caricata (PASS)
- File modificati principali:
  - package.json (deps + script tauri)
  - src-tauri/tauri.conf.json
  - src-tauri/\*\* (file generati da init)

- Task ID: M1.2 — Scaffolding Vite + React + TypeScript ✅
- Data: 2026-02-04
- Dettagli:
  - Creato progetto Vite (template React + TypeScript)
  - Installate dipendenze npm
  - Dev server avviato e pagina base verificata (Gate)
- Gate risultati:
  - `npm run dev` → pagina base Vite+React visibile (PASS)
- File modificati principali:
  - (nuovo) progetto scaffold Vite React+TS (cartella creata da `npm create vite@latest`)
