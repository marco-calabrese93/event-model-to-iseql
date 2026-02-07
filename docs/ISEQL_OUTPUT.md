# ISEQL_OUTPUT — Convenzioni di serializzazione (M4.2)

Questo documento definisce le **convenzioni di output** usate dal serializer (`src/core/serializer.ts`).
Obiettivo: emissione **byte-for-byte deterministica**.

## 1) Input atteso (post-Resolver)

Il serializer riceve un AST già compilato dal Resolver (M4.1):

- `operatorId` già normalizzato a operatori **base** (Bef/Aft/LOJ/ROJ/DJ/RDJ/SP/EF/Eq)
- `params` presenti e con chiavi latinizzate: `zeta, eta, delta, epsilon, rho`

I default globali sono quelli del catalogo operatori:

- ζ=≤, η=≤, δ=∞, ε=∞, ρ=0  
  (v. catalogo e materiali ISEQL) :contentReference[oaicite:0]{index=0} :contentReference[oaicite:1]{index=1}

## 2) Formato di output

L’output è testuale, con due sezioni:

```text
# <name|id>
# intervals: N, relations: M

INTERVALS
@<intervalId>: <predicate>(<args...>)

RELATIONS
@<leftId> <OP>(<params?>) @<rightId>
```
