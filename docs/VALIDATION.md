# VALIDATION — Core Validator (M4.3)

Questo documento descrive la validazione **“umana”** (UX-friendly) che si aggiunge allo **schema Zod strict**.

> Pipeline core: UI → AST JSON → **Zod parse** → **Validator (questo doc)** → Resolver → Serializer

## Obiettivo

- Intercettare errori semantici e incompatibilità che Zod non copre (o che vogliamo esporre con messaggi UX).
- Produrre anche warning (non bloccanti) utili per l’utente.
- Usare **codici stabili** per:
  - UI (mapping i18n / messaggi),
  - snapshot test (Gate).

## API

`validateModel(model) => { errors: ValidationIssue[], warnings: ValidationIssue[] }`

`ValidationIssue`:

- `severity`: `"error"` | `"warning"`
- `code`: stringa stabile
- `message`: testo breve
- `path?`: puntatore JSONPath-like (es. `$.expressions.0.params.delta`)

## Codici ERROR (bloccanti)

- `V001_UNKNOWN_OPERATOR`  
  L’`operatorId` della relazione non è presente nel catalogo `operators.json`.

- `V002_UNKNOWN_INTERVAL_REF`  
  `leftIntervalId` o `rightIntervalId` punta a un intervallo inesistente.

- `V003_UNKNOWN_CONSTRAINT_REF`  
  `constraintIds[]` contiene un id non presente nella lista vincoli.

- `V004_CONSTRAINT_NOT_SUPPORTED`  
  L’operatore non supporta quel tipo di vincolo (cardinality / overlapPercentage / robustness) secondo `operators.json`.

- `V005_PARAM_OUT_OF_RANGE`  
  Parametri fuori dominio:
  - `delta/epsilon` devono essere `>=0` o `"∞"`
  - `rho` deve essere `>=0`
  - vincoli: `overlapPercentage` in `[0..100]`, `robustness>=0`, `cardinality min<=max`

- `V006_INVALID_COMPARATOR`  
  Comparatori non ammessi per `zeta/eta` (ammessi: `<, <=, ≤, =, >=, ≥, >, !=`).

## Codici WARNING (non bloccanti)

- `W001_NON_CANONICAL_PARAM_KEYS`  
  Presenza di chiavi greche `ζ η δ ε ρ` in `params`. Il Resolver normalizza a `zeta/eta/delta/epsilon/rho`.

- `W002_REDUNDANT_CONSTRAINT`  
  Vincolo ridondante (nessuna restrizione reale), es.:
  - `overlapPercentage=0`
  - `robustness=0`
  - `cardinality min=0 max=∞`

- `W003_SUSPICIOUS_THRESHOLDS`  
  Parametri “troppo permissivi” per operatori temporali: `delta=∞` e `epsilon=∞`.

- `W004_MISSING_PARAMS`  
  Mancanza di `params` su una relazione: il Resolver li compilerà con default.

## Determinismo

Gli array `errors` e `warnings` sono ordinati deterministicamente:

1. severity (error prima), 2) code, 3) path, 4) message.

## Note sui default ISEQL

I default parametrici (ζ=≤, η=≤, δ=∞, ε=∞, ρ=0) seguono la definizione ISEQL e sono coerenti con i materiali di riferimento.
