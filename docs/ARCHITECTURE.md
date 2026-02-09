# ARCHITECTURE — Core (AST) — ISEQL Event Modeler

> Scopo: descrivere **lo schema AST** (core model), come viene validato e come viene usato per generare output ISEQL.
> Questo progetto **non** esegue query su DB: produce solo una stringa ISEQL deterministica.

---

## 1) Panoramica core

Cartelle (source of truth):

- `src/core/`: AST + Zod schema + serializer/validator/resolver/compiler + timeline + deriveParams + (in arrivo) wizard
- `src/ui/`: GUI, store Zustand, form RHF+Zod

Pipeline logica (MVP):

1. UI (timeline editor) crea/modifica intervalli e relazioni
2. UI produce/aggiorna un `EventModel` (AST)
3. `compiler.ts` esegue la pipeline core (unica API per UI):
   - `EventModelSchema.parse` (Zod strict)
   - `validator` (controlli UX/semantici, warnings non bloccanti)
   - `resolver` (normalizzazione operatori + default params + explainability)
   - `serializer` (stringa ISEQL deterministica)
4. UI mostra:
   - output ISEQL + copy/export
   - explainability (ruleId + testo)
   - errors/warnings

Obiettivo chiave: **determinismo**  
Stesso input AST → stesso output (byte-for-byte). Questo è garantito da:

- IdFactory deterministico
- normalizzazione (ordine stabile)
- stable stringify per snapshot test
- serializer deterministico (termina sempre con newline)

---

## 1.1 UI dataflow (Builder → Store → Core compiler) — M6.2

La UI usa uno **Zustand store** come _single source of truth_ (SSOT) per:

- intervalli della timeline (create / move / resize)
- labeling (predicate + args)
- vincoli/relazioni tra intervalli (constraint con operatorId)
- reset dello stato di authoring

File chiave:

- `src/ui/store/eventModelStore.ts` (store Zustand, actions interval-centric)
- `src/core/timeline.ts` (invarianti e trasformazioni deterministiche tick/intervalli)
- `src/core/compiler.ts` (unico entrypoint core per produrre ISEQL)

### Flusso

1. **Builder UI** emette intenti utente:
   - drag to create / move / resize
   - selezione predicate (name + args)
   - creazione relazione (operatorId) tra due intervalli
2. **Store (Zustand)** applica azioni deterministiche:
   - ids deterministici (`interval_0001`, `constraint_0001`, …)
   - trasformazioni ticks deterministiche via `src/core/timeline.ts`
   - ordering stabile degli array (sort per `id`)
3. **Preview/Output UI** leggono lo stesso store (SSOT)
4. Per generare output:
   - la UI passa un modello compatibile con `EventModel` al **core compiler**
   - `compileEventModel(model)` → validate → resolver → serializer
   - errors bloccanti ⇒ `iseql=null`, warnings non bloccanti

### Perché così

- Nessuna logica “core” duplicata nella UI: la timeline usa helper core già testati.
- Determinismo end-to-end: stessi input UI ⇒ stesso modello nello store ⇒ stesso output ISEQL.

---

## 1.2 Timeline invariants (Builder) — M5.1

La timeline è un aid di authoring basato su **tick astratti** (non timestamp reali).
La logica base di editing (create/move/resize) è centralizzata in:

- `src/core/timeline.ts`

Regole/invarianti deterministiche (source of truth per il Builder):

### Tick

- I tick sono normalizzati ad **interi** tramite `Math.round` (input UI può essere float).
- Bounds opzionali:
  - `minTick` (default `0`)
  - `maxTick` (default `+∞`)

### Intervalli

Invariante sempre vero: `start <= end`.

#### Create

`createInterval(start, end, bounds?)`

- normalizza a interi
- se `start > end`, scambia (swap) gli endpoint
- clampa entrambi ai bounds (default `0..+∞`)
- garantisce sempre `start <= end`

#### Move

`moveInterval(interval, delta, bounds?)`

- preserva la durata (`duration = end - start`) quando possibile
- applica `delta` al blocco e poi clampa ai bounds **shiftando l’intervallo** per mantenere la durata:
  - se va sotto `minTick`, si porta `start = minTick` e si ricalcola `end`
  - se va sopra `maxTick`, si porta `end = maxTick` e si ricalcola `start`
- caso limite: se la durata non entra nei bounds **finiti** (`duration > maxTick - minTick`), l’output diventa `[minTick, maxTick]`
- determinismo: stessa input → stesso output; nessuna dipendenza da stato esterno

#### Resize

`resizeStart(interval, newStart, bounds?)` / `resizeEnd(interval, newEnd, bounds?)` / `resizeInterval(...)`

- clampa il nuovo endpoint ai bounds
- previene inversione:
  - se `newStart > end`, allora `start = end`
  - se `newEnd < start`, allora `end = start`
- determinismo: tick normalizzati a interi + clamp + regole anti-inversione

#### Immutabilità

Le funzioni non mutano l’oggetto in input: ritornano una copia con `start/end` aggiornati (preservando eventuali campi extra).

---

## 1.3 Derivazione parametri da geometria (opt-in) — M5.2

Helper opzionale per suggerire soglie a partire dalla geometria (es. gap tra intervalli):

- `src/core/deriveParams.ts`
- API: `deriveParamsFromGeometry({ left, right, operatorId })`

Caratteristiche:

- suggerisce δ/ε/ρ in modo deterministico (clamp >= 0, ρ default 0)
- non modifica ζ/η
- produce `explain[]` con `ruleId + text` per ogni derivazione

---

## 2) Entità principali (AST)

> I nomi qui sotto corrispondono ai tipi/concetti presenti nel core (`model.ts`) e ai contratti Zod (`schema.ts`).

### 2.1 EventModel (root)

Rappresenta un “modello di evento” completo.

Campi tipici:

- `schemaVersion`: versione dello schema (stringa)
- `id`: id deterministico del modello
- `name`: nome umano
- `intervals`: elenco di `IntervalInstance`
- `constraints`: `ConstraintSet` (es. `{ temporal: [...], extra: [...] }`)
- composizione/espressione: estendibile (MVP focalizzato su intervalli + relazioni)

> Nota: l’AST è **ISEQL-native**: le relazioni Allen possono comparire come alias in UI e vengono normalizzate (Resolver).

### 2.2 IntervalInstance (istanza su timeline)

Un intervallo disegnato dall’utente (tick astratti, non timestamp reali).

Campi tipici:

- `id`: id intervallo (unico nel modello)
- `start`: tick iniziale (intero)
- `end`: tick finale (intero, `end >= start`)
- `predicate`: `PredicateCall` (etichetta/semantica dell’intervallo)

### 2.3 PredicateCall

Descrive il predicato associato all’intervallo, con argomenti.

Campi tipici:

- `name`: stringa (es. `hasPkg`, `in`, `insideCar`)
- `args`: lista di argomenti (es. `["p1", "pkg1"]`)

### 2.4 ConstraintSet e relazioni temporali

Nel modello validato dallo schema corrente:

- `constraints.temporal[]` contiene relazioni temporali tra intervalli
- `constraints.extra[]` contiene vincoli extra estendibili

Una relazione temporale tipica contiene:

- `id`
- `leftIntervalId`
- `rightIntervalId`
- `operatorId` (es. `"Bef"`, `"DJ"`, `"LOJ"`; può essere alias che il resolver normalizza)
- `params` (opzionale in input; verrà completato dal resolver)

> Nota: il validator valida `operatorId` principalmente contro `operators[].code` (es. `"Bef"`), con fallback su `operators[].id` per robustezza.

### 2.5 TemporalParams (ζ, η, δ, ε, ρ)

Parametri possibili per le relazioni temporali (ISEQL superset di Allen).

- `zeta` (ζ): comparatore per endpoint (default `≤`)
- `eta` (η): comparatore per endpoint (default `≤`)
- `delta` (δ): soglia (default `∞`, dominio: `>= 0` o `"∞"`)
- `epsilon` (ε): soglia (default `∞`, dominio: `>= 0` o `"∞"`)
- `rho` (ρ): slack/offset (default `0`, dominio: `>= 0`)

Il catalogo operatori (`src/core/operators.json`) definisce:

- quali parametri sono supportati da ciascun operatore
- i default globali e/o per operatore
- mapping alias Allen → operatore base ISEQL (`mapsTo`)

---

## 3) Validazione

### 3.1 Zod (schema.ts)

Il modello è validato in modalità strict (input pulito).

Invarianti principali (enforced):

- ogni `IntervalInstance` rispetta `start <= end`
- `id` unici per intervalli
- riferimenti a intervalId esistenti
- domini parametri (soglie, comparatori)

Se la validazione fallisce:

- il compiler ritorna `iseql=null`
- `errors[]` contiene i dettagli (codici `ZOD_*`)

### 3.2 Validator (validator.ts)

Validazione “umana” oltre Zod:

- compatibilità operatore/vincoli (catalogo `constraintCompatibility`)
- ref inesistenti (intervalId / constraintId) -> error
- range parametri (delta/epsilon/rho) + comparatori -> error
- warnings UX (es. params mancanti, chiavi greche, ridondanze)

Nota: il validator è shape-tolerant e supporta anche constraint con `kind` oltre che `type`.

---

## 4) Resolver e Serializer

### 4.1 Resolver (resolver.ts)

- normalizza operatori alias → base ISEQL via catalogo
- completa `params` usando defaults globali + per-operatore
- produce `explain[]` con ruleId + testo
- output deterministico (sorting stabile su array/id + explain)

### 4.2 Serializer (serializer.ts)

- emette stringa ISEQL deterministica
- omissione parametri default (policy deterministica)
- newline finale garantita

---

## 5) Compiler (compiler.ts) — API unica per la UI

Il compiler è l’**unico entrypoint** core chiamato dalla UI: orchestra l’intera pipeline e ritorna un output già pronto per:

- preview/output query
- export `.iseql`
- render di errors/warnings
- explainability

### 5.1 Firma (contract)

**Input**: `EventModel`

**Output**:

- `iseql: string | null`
- `resolvedModel: unknown | null`
- `explain: unknown[]`
- `errors: CompilerIssue[]`
- `warnings: CompilerIssue[]`

### 5.2 Regole (blocking vs non-blocking)

- Se esistono errori bloccanti (`errors.length > 0`) allora:
  - `iseql = null`
  - `resolvedModel = null`
- I warnings **non bloccano** e vengono restituiti anche se l’output è generato.
- Determinismo: stessa input -> stesso output (incl. ordering di issues e explain).

### 5.3 Sequenza esatta della pipeline

1. `EventModelSchema.parse(input)` (Zod strict)
2. `validator(model)` (controlli semantici/UX)
3. `resolver(model)` (normalizzazione + defaults + explainability)
4. `serializer(resolvedModel)` (ISEQL deterministica)

> Policy export: la UI può abilitare “Copy/Export” **solo se** `iseql !== null`.

---

## 6) Esempio JSON minimo (schema corrente)

```json
{
  "schemaVersion": "1",
  "id": "m1",
  "name": "Minimal Example",
  "intervals": [
    {
      "id": "i1",
      "start": 0,
      "end": 10,
      "predicate": { "name": "in", "args": ["p1"] }
    },
    {
      "id": "i2",
      "start": 12,
      "end": 20,
      "predicate": { "name": "in", "args": ["p2"] }
    }
  ],
  "constraints": {
    "temporal": [
      {
        "id": "t1",
        "leftIntervalId": "i1",
        "rightIntervalId": "i2",
        "operatorId": "Bef"
      }
    ],
    "extra": []
  }
}
```
