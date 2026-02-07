# ARCHITECTURE — Core (AST) — ISEQL Event Modeler

> Scopo: descrivere **lo schema AST** (core model), come viene validato e come viene usato per generare output ISEQL.
> Questo progetto **non** esegue query su DB: produce solo una stringa ISEQL deterministica.

---

## 1) Panoramica core

Cartelle (source of truth):
- `src/core/`: AST + Zod schema + (in arrivo) serializer/validator/resolver/wizard
- `src/ui/`: GUI, store Zustand, form RHF+Zod

Pipeline logica (MVP):
1) UI (timeline editor) crea/modifica intervalli e relazioni
2) UI produce/aggiorna un `EventModel` (AST)
3) `schema.ts` valida il modello (Zod strict)
4) (in arrivo) `resolver.ts` normalizza alias Allen → operatori ISEQL e completa parametri (ζ/η/δ/ε/ρ)
5) (in arrivo) `serializer.ts` emette la stringa ISEQL (output principale)

Obiettivo chiave: **determinismo**  
Stesso input AST → stesso output (byte-for-byte). Questo è garantito da:
- IdFactory deterministico
- normalizzazione (ordine stabile)
- stable stringify per snapshot test

---

## 2) Entità principali (AST)

> I nomi qui sotto corrispondono ai tipi/concetti già presenti nel core (`model.ts`) e ai contratti Zod (`schema.ts`).

### 2.1 EventModel (root)

Rappresenta un “modello di evento” completo.

Campi tipici:
- `schemaVersion`: versione dello schema (stringa)
- `id`: id deterministico del modello
- `name`: nome umano (opzionale)
- `intervals`: elenco di `IntervalInstance`
- `constraints`: `ConstraintSet`
- `expression`: `TemporalExpression` (radice della composizione; vedi sotto)
- `meta`: metadati opzionali (descrizione, tags, ecc.)

> Nota: l’AST è **ISEQL-native**: le relazioni Allen possono comparire come alias in UI e vengono normalizzate (fase Resolver).

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
- (opzionale) `bindings`: forma alternativa “key/value” se la UI decide di nominare i parametri

### 2.4 ConstraintSet e Constraint

I vincoli collegano **due intervalli** (left/right) tramite un operatore temporale ISEQL (o alias Allen).

Campi tipici:
- `constraints`: lista di `Constraint`

Constraint tipico:
- `id`: id vincolo (unico)
- `leftIntervalId`: id dell’intervallo sinistro
- `rightIntervalId`: id dell’intervallo destro
- `operatorId`: id operatore (es. `Bef`, `DJ`, `LOJ`, `Eq` o alias tipo `Allen.Before`)
- `params`: `TemporalParams` (opzionale; se assente → default applicati dal Resolver)
- `cardinality`: vincoli di cardinalità (opzionale, se supportato dall’operatore)
- `overlapPercentage`: vincoli percentuali di overlap (opzionale, se supportato)
- `robustness`: robustezza (opzionale, se supportata)

### 2.5 TemporalParams (ζ, η, δ, ε, ρ)

Parametri possibili per le relazioni temporali (ISEQL superset di Allen).

- `zeta` (ζ): comparatore per endpoint (default `≤`)
- `eta`  (η): comparatore per endpoint (default `≤`)
- `delta` (δ): soglia (default `∞`, dominio: `>= 0` o `"∞"`)
- `epsilon` (ε): soglia (default `∞`, dominio: `>= 0` o `"∞"`)
- `rho` (ρ): slack/offset (default `0`, dominio: `>= 0`)

Il catalogo operatori (`src/core/operators.json`) definisce:
- quali parametri sono supportati da ciascun operatore
- i default globali e/o per operatore
- mapping alias Allen → operatore base ISEQL (`mapsTo`)

### 2.6 TemporalExpression (composizione)

Descrive come “comporre” predicati/intervalli e vincoli in una struttura di query.

Linee guida:
- i **leaf node** fanno riferimento a uno o più `IntervalInstance`
- i nodi interni rappresentano “join/compose” basati su `Constraint`
- l’output finale (serializer) percorre questa struttura per emettere una query ISEQL completa

> Nel MVP l’espressività deve bastare a comporre pattern deterministici (senza ottimizzazioni).

---

## 3) Validazione (schema.ts)

Il modello è validato in modalità strict (input pulito).

Invarianti principali (enforced):
- ogni `IntervalInstance` rispetta `start <= end`
- `id` unici per intervalli e constraints
- `leftIntervalId`/`rightIntervalId` referenziano intervalli esistenti
- domini parametri:
  - `delta/epsilon` ∈ { numero >= 0, `"∞"` }
  - `rho` numero >= 0
  - comparator enum (per `zeta/eta`)

Se la validazione fallisce:
- l’UI deve bloccare “Validate/Export” e mostrare errori chiari
- in modalità Wizard, la UI dovrebbe guidare la correzione

---

## 4) Catalogo operatori (operators.json)

Il catalogo è un file JSON versionato che definisce:
- operatori base ISEQL (es. `Bef`, `Aft`, `LOJ`, `ROJ`, `DJ`, `RDJ`, `SP`, `EF`, `Eq`)
- alias Allen 13 (kind = `alias`) con `mapsTo`
- supporto a vincoli extra (cardinality/overlapPercentage/robustness)

Regola pratica:
- l’AST può contenere `operatorId` alias (scelta UI),
- il Resolver produce sempre operatori base ISEQL, completando i parametri.

---

## 5) Esempi JSON

### 5.1 Esempio minimo (2 intervalli + 1 relazione)

Obiettivo: il più piccolo modello sensato che esprime “A prima di B”.

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
    "constraints": [
      {
        "id": "c1",
        "leftIntervalId": "i1",
        "rightIntervalId": "i2",
        "operatorId": "Bef",
        "params": { "delta": 5 }
      }
    ]
  },
  "expression": {
    "kind": "root",
    "intervalIds": ["i1", "i2"],
    "constraintIds": ["c1"]
  }
}
