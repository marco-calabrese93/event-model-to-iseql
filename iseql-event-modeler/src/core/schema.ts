import { z } from "zod";

/**
 * M3.2 — Zod schema per AST.
 *
 * NOTE: se in src/core/model.ts hai nomi campi diversi, allinea qui le chiavi:
 * - EventModel: intervals / constraints / ...
 * - TemporalExpression: left/right ids + operatorKey + params
 */

export const SchemaVersionSchema = z.literal("1");

/** IDs deterministici (IdFactory) — assumiamo string non vuota */
export const IdSchema = z.string().min(1, "id must be a non-empty string");

/** Timeline ticks: interi >= 0 */
export const TickSchema = z
  .number({ message: "tick must be a number" })
  .int("tick must be an integer")
  .min(0, "tick must be >= 0");

/** Comparatori per ζ / η (da SPEC: default ≤) */
const ComparatorValues = ["<", "≤", "=", "≥", ">"] as const;
export const ComparatorSchema = z.enum(ComparatorValues, {
  message: "comparator must be one of: <, ≤, =, ≥, >",
});

/** δ/ε possono essere numeri >=0 oppure "∞" */
export const InfinityOrNumberSchema = z.union([
  z.literal("∞"),
  z.number({ message: "threshold must be a number or '∞'" }).min(0, "threshold must be >= 0"),
]);

/**
 * TemporalParams (ζ, η, δ, ε, ρ)
 * Defaults a livello di resolver/serializer (non qui), ma qui validiamo domini.
 */
export const TemporalParamsSchema = z
  .object({
    ζ: ComparatorSchema.optional(), // zeta
    η: ComparatorSchema.optional(), // eta
    δ: InfinityOrNumberSchema.optional(), // delta
    ε: InfinityOrNumberSchema.optional(), // epsilon
    ρ: z.number({ message: "rho must be a number" }).min(0, "rho must be >= 0").optional(), // rho
  })
  .strict();

/** PredicateCall: predName(args...) */
export const PredicateCallSchema = z
  .object({
    name: z.string().min(1, "predicate name must be non-empty"),
    args: z.array(z.string().min(1, "arg must be non-empty")).default([]),
  })
  .strict();

/** Interval instance: un intervallo disegnato sulla timeline + predicato */
export const IntervalInstanceSchema = z
  .object({
    id: IdSchema,
    start: TickSchema,
    end: TickSchema,
    predicate: PredicateCallSchema,
    // opzionali utili UI (se esistono nel model.ts; altrimenti rimuovi)
    label: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.start > val.end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end"],
        message: "end must be >= start",
      });
    }
  });

/**
 * TemporalExpression: relazione (operatore ISEQL) tra due intervalId.
 * operatorKey: chiave catalogo (es: "Bef", "DJ", ...), non validata qui (catalogo in M3.3).
 */
export const TemporalExpressionSchema = z
  .object({
    id: IdSchema,
    leftIntervalId: IdSchema,
    rightIntervalId: IdSchema,
    operatorKey: z.string().min(1, "operatorKey must be non-empty"),
    params: TemporalParamsSchema.optional(),
    // alias UI (Allen) opzionale: es "Before", "During", ...
    allenAlias: z.string().min(1).optional(),
  })
  .strict();

/**
 * Constraint: wrapper “aperto” ma strutturato.
 * In MVP può contenere: tipo + payload; qui teniamo un formato minimo ma estendibile.
 */
export const ConstraintSchema = z
  .object({
    id: IdSchema,
    kind: z.string().min(1, "constraint kind must be non-empty"),
    // payload libero ma validato come JSON-safe (record string->unknown)
    payload: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const ConstraintSetSchema = z
  .object({
    temporal: z.array(TemporalExpressionSchema).default([]),
    extra: z.array(ConstraintSchema).default([]),
  })
  .strict();

/**
 * EventModel: root AST
 * - schemaVersion: "1"
 * - intervals: lista di IntervalInstance
 * - constraints: ConstraintSet
 */
export const EventModelSchema = z
  .object({
    schemaVersion: SchemaVersionSchema,
    id: IdSchema,
    name: z.string().min(1, "model name must be non-empty"),
    intervals: z.array(IntervalInstanceSchema),
    constraints: ConstraintSetSchema.default({ temporal: [], extra: [] }),
    // metadati opzionali
    description: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict()
  .superRefine((model, ctx) => {
    // Vincolo: ids intervalli unici
    const ids = model.intervals.map((i) => i.id);
    const dup = ids.find((id, idx) => ids.indexOf(id) !== idx);
    if (dup) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["intervals"],
        message: `duplicate interval id: ${dup}`,
      });
    }

    // Vincolo: left/right intervalId nelle temporal expressions devono esistere
    const idSet = new Set(ids);
    for (const [i, t] of model.constraints.temporal.entries()) {
      if (!idSet.has(t.leftIntervalId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["constraints", "temporal", i, "leftIntervalId"],
          message: `unknown interval id: ${t.leftIntervalId}`,
        });
      }
      if (!idSet.has(t.rightIntervalId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["constraints", "temporal", i, "rightIntervalId"],
          message: `unknown interval id: ${t.rightIntervalId}`,
        });
      }
    }
  });

/** Types helpers */
export type EventModelDTO = z.infer<typeof EventModelSchema>;
export type IntervalInstanceDTO = z.infer<typeof IntervalInstanceSchema>;
export type TemporalExpressionDTO = z.infer<typeof TemporalExpressionSchema>;
export type TemporalParamsDTO = z.infer<typeof TemporalParamsSchema>;
