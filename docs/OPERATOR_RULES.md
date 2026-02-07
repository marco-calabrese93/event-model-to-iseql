# OPERATOR_RULES — Resolver (M4.1)

Questo documento descrive le regole **deterministiche** applicate dal Resolver per:

1. normalizzare operatori (alias Allen → base ISEQL)
2. completare i parametri temporali con i default

> Scope: solo normalizzazione + default params (nessuna inferenza geometrica da timeline in M4.1).

---

## 1) Normalizzazione operatorId (alias → base)

### Regola: `R-OP-ALIAS-TO-BASE`

- Se un nodo dell’AST contiene `operatorId` che corrisponde a un entry in `operators.json` con `kind="alias"`,
  allora `operatorId` viene sostituito con `mapsTo` (operatore base ISEQL).

Output:

- `operatorId` diventa sempre un **base operator** (es. `Bef`, `DJ`, `LOJ`, ...).
- Viene aggiunta una voce in `explain[]`:
  - `ruleId = R-OP-ALIAS-TO-BASE`
  - testo con alias e base scelto.

Esempio:

```json
{ "operatorId": "Allen.Before" }
```

diventa:
{ "operatorId": "Bef" }
