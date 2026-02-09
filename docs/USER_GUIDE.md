# USER_GUIDE — ISEQL Event Modeler

## Timeline Editor (Builder)

La timeline usa **tick astratti** (non timestamp reali). Gli intervalli sono trattati lato UI come **[start, end)**.

---

## Create interval (drag)

1. Clicca e trascina sulla track.
2. Durante il drag vedi una preview dell’intervallo.
3. Al rilascio del mouse/puntatore, l’intervallo viene creato.

### No-overlap policy (solo create)

Per la creazione, il Builder applica una policy MVP “no overlap”:

- gli intervalli sono considerati [start,end) per il calcolo collisioni;
- se la creazione collide, l’intervallo viene **push/clamp** nel primo gap disponibile in direzione del drag;
- se non esiste un gap sufficiente, la creazione è un **noop** (nessun intervallo viene creato).

---

## Move interval (drag)

- Trascina **la barra** dell’intervallo orizzontalmente.
- Il move **preserva la durata** (end-start costante).
- Il move è **clampato** ai bounds della timeline (es. 0–100).

**Invarianti garantite:**

- nessun intervallo “invertito” (start ≤ end);
- durata preservata quando possibile (se l’intervallo non entra nei bounds, viene clampato in modo deterministico).

---

## Resize interval (handles)

Ogni intervallo ha due maniglie:

- **sinistra**: modifica `start`
- **destra**: modifica `end`

Regole:

- il resize è **clampato** ai bounds della timeline;
- la UI (via core helpers) **previene inversione**: se trascini oltre l’altro estremo, l’intervallo non diventa invalido (start ≤ end sempre vero).

---

## Label interval (Predicate + Args) — M7.3

Obiettivo: associare un **PredicateCall** (nome predicato + argomenti) a un intervallo.

### Selezione intervallo

1. Crea almeno un intervallo sulla timeline (drag-to-create).
2. Clicca sull’intervallo per selezionarlo.
3. Una volta selezionato, nel pannello laterale compare l’editor di labeling.

### Editor predicati (catalogo minimo MVP)

- Il predicato viene scelto da un **catalogo statico** (minimo) per MVP.
- Se cambi predicato, l’etichetta dell’intervallo viene aggiornata.

### Args input (array string)

- Gli argomenti del predicato sono gestiti come **array di stringhe**.
- Puoi inserire 0 o più argomenti.
- L’etichetta visualizzata sull’intervallo segue la forma:

`Predicate(arg1,arg2,...)`

(Esempio: `Walk(person1,zoneA)`)

### Persistenza (store)

- L’assegnazione di `predicate + args` viene salvata nello **store Zustand** associato all’intervallo selezionato.
- Se cambi selezione e poi torni sullo stesso intervallo, il labeling resta.

---

## Expert constraints (2 intervalli → 1 relazione) — M8.1

Obiettivo: definire **relazioni esplicite** tra due intervalli (operatori base ISEQL + alias Allen) e modificare i parametri **ζ/η/δ/ε/ρ**.

### Selezione coppia (A → B)

- **Click** su un intervallo: diventa **A (left / primary)**.
- **Click** su un secondo intervallo: diventa **B (right / secondary)**.
- Con 2 intervalli selezionati, nel pannello “Constraints (Expert)” compare l’authoring per la coppia.

Nota: se selezioni un terzo intervallo quando A e B sono già selezionati, la selezione viene **resettata** in modo deterministico (rimane solo l’ultimo click).

### Creazione constraint

1. Seleziona A e B.
2. Scegli un operatore dal dropdown:
   - include operatori base (es. `Bef`, `DJ`, `LOJ`, …)
   - include alias Allen (es. `Allen.Before`, `Allen.Meets`, …)
3. Clicca **Add constraint**.

Risultato: viene creato un constraint `A operatorId B` con `params` inizializzati ai default del catalogo (`operators.json`).
Per gli alias Allen, eventuali parametri “fixed” vengono applicati in modo deterministico.

### Modifica operatorId e parametri

Seleziona un constraint dalla lista “Constraints for A→B”, poi:

- **Operator**: cambia `operatorId` (base o alias).
- **ζ / η**: comparatore (es. `≤`, `<`, `=`, `≥`, `>`; accettate anche `<=`, `>=`).
- **δ / ε**: soglia numerica (>=0) oppure `"∞"`.
- **ρ**: numero (>=0).

Il pannello mostra anche un riquadro “Model (debug)” con lo snapshot JSON del constraint selezionato (utile per smoke/QA).

---

## Smoke checklist (manuale) — aggiornato

1. Crea 3 intervalli distinti.
2. Esegui move su ciascuno (drag sulla barra) e verifica che la **durata resti invariata**.
3. Esegui resize start/end su ciascuno (drag maniglie) e verifica che **non si creino intervalli invertiti**.
4. Seleziona un intervallo e assegna un **predicato** con **almeno 2 args**.
5. Cambia selezione (clic su un altro intervallo) e poi torna al primo: verifica che **predicato+args siano ancora presenti** (label invariata).
6. Seleziona 2 intervalli (A→B), crea un constraint e verifica che nel riquadro “Model (debug)” compaiano:
   - `operatorId`
   - `params` con chiavi `zeta/eta/delta/epsilon/rho`.
