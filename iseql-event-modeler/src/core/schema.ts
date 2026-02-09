import { z } from "zod";

/**
 * Zod schema per AST.
 *
 * IMPORTANT:
 * - Il progetto ha avuto due shape in parallelo:
 *   A) legacy DTO (schemaVersion "1") con constraints: { temporal, extra } e operatorKey.
 *   B) canonical core (model.ts) (schemaVersion "1.0") con meta, relations e constraints: { constraints: [...] }.
 *
 * Per garantire compatibilità e non rompere i test esistenti, EventModelSchema accetta entrambe
 * le shape distinguendole tramite schemaVersion literal.
 */

// -----------------------------
// Common primitives
// -----------------------------

export const IdSchema = z.string().min(1, "id must be a non-empty string");

export const TickSchema = z
  .number({ message: "tick must be a number" })
  .int("tick must be an integer")
  .min(0, "tick must be >= 0");

const ComparatorValues = ["<", "≤", "=", "≥", ">"] as const;
export const ComparatorSchema = z.enum(ComparatorValues, {
  message: "comparator must be one of: <, ≤, =, ≥, >",
});

export const InfinityOrNumberSchema = z.union([
  z.literal("∞"),
  z.number({ message: "threshold must be a number or '∞'" }).min(0, "threshold must be >= 0"),
]);

export const PredicateCallSchema = z
  .object({
    name: z.string().min(1, "predicate name must be non-empty"),
    args: z.array(z.string().min(1, "arg must be non-empty")).default([]),
  })
  .strict();

export const IntervalInstanceSchema = z
  .object({
    id: IdSchema,
    start: TickSchema,
    end: TickSchema,
    predicate: PredicateCallSchema,
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

// -----------------------------
// Legacy DTO shape (schemaVersion "1")
// - constraints: { temporal, extra }
// - temporal relations use operatorKey + leftIntervalId/rightIntervalId
// - params uses greek keys ζηδερ
// -----------------------------

export const SchemaVersionLegacySchema = z.literal("1");

export const TemporalParamsLegacySchema = z
  .object({
    ζ: ComparatorSchema.optional(),
    η: ComparatorSchema.optional(),
    δ: InfinityOrNumberSchema.optional(),
    ε: InfinityOrNumberSchema.optional(),
    ρ: z.number({ message: "rho must be a number" }).min(0, "rho must be >= 0").optional(),
  })
  .strict();

export const TemporalExpressionLegacySchema = z
  .object({
    id: IdSchema,
    leftIntervalId: IdSchema,
    rightIntervalId: IdSchema,
    operatorKey: z.string().min(1, "operatorKey must be non-empty"),
    params: TemporalParamsLegacySchema.optional(),
    allenAlias: z.string().min(1).optional(),
  })
  .strict();

export const ConstraintLegacySchema = z
  .object({
    id: IdSchema,
    kind: z.string().min(1, "constraint kind must be non-empty"),
    payload: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const ConstraintSetLegacySchema = z
  .object({
    temporal: z.array(TemporalExpressionLegacySchema).default([]),
    extra: z.array(ConstraintLegacySchema).default([]),
  })
  .strict();

export const EventModelLegacySchema = z
  .object({
    schemaVersion: SchemaVersionLegacySchema,
    id: IdSchema,
    name: z.string().min(1, "model name must be non-empty"),
    intervals: z.array(IntervalInstanceSchema),
    constraints: ConstraintSetLegacySchema.default({ temporal: [], extra: [] }),
    description: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict()
  .superRefine((model, ctx) => {
    const ids = model.intervals.map((i) => i.id);
    const dup = ids.find((id, idx) => ids.indexOf(id) !== idx);
    if (dup) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["intervals"],
        message: `duplicate interval id: ${dup}`,
      });
    }

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

// -----------------------------
// Canonical core shape (model.ts) (schemaVersion "1.0")
// - meta { name, createdAtISO, ... }
// - relations[] uses left/right + operatorId + params (latin keys)
// - constraints: { constraints: [...] }
// -----------------------------

export const SchemaVersionCanonicalSchema = z.literal("1.0");

export const TemporalParamsCanonicalSchema = z
  .object({
    zeta: ComparatorSchema.optional(),
    eta: ComparatorSchema.optional(),
    delta: InfinityOrNumberSchema.optional(),
    epsilon: InfinityOrNumberSchema.optional(),
    rho: z.number({ message: "rho must be a number" }).min(0, "rho must be >= 0").optional(),
  })
  .strict();

export const TemporalExpressionCanonicalSchema = z
  .object({
    id: IdSchema,
    left: IdSchema,
    right: IdSchema,
    operatorId: z.string().min(1, "operatorId must be non-empty"),
    params: TemporalParamsCanonicalSchema.optional(),
    allenAlias: z.string().min(1).optional(),
  })
  .strict();

export const ConstraintCanonicalSchema = z.union([
  z
    .object({
      id: IdSchema,
      kind: z.literal("relationParam"),
      relationId: IdSchema,
      key: z.string().min(1),
      value: z.union([z.string(), z.number(), z.boolean()]),
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      kind: z.literal("note"),
      message: z.string().min(1),
    })
    .strict(),
]);

export const ConstraintSetCanonicalSchema = z
  .object({
    constraints: z.array(ConstraintCanonicalSchema).default([]),
  })
  .strict();

export const EventModelCanonicalSchema = z
  .object({
    schemaVersion: SchemaVersionCanonicalSchema,
    id: IdSchema,
    meta: z
      .object({
        name: z.string().min(1, "meta.name must be non-empty"),
        description: z.string().optional(),
        createdAtISO: z.string().min(1, "meta.createdAtISO must be non-empty"),
      })
      .strict(),
    intervals: z.array(IntervalInstanceSchema),
    relations: z.array(TemporalExpressionCanonicalSchema).default([]),
    constraints: ConstraintSetCanonicalSchema.default({ constraints: [] }),
  })
  .strict()
  .superRefine((model, ctx) => {
    const ids = model.intervals.map((i) => i.id);
    const dup = ids.find((id, idx) => ids.indexOf(id) !== idx);
    if (dup) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["intervals"],
        message: `duplicate interval id: ${dup}`,
      });
    }

    const idSet = new Set(ids);
    for (const [i, r] of model.relations.entries()) {
      if (!idSet.has(r.left)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["relations", i, "left"],
          message: `unknown interval id: ${r.left}`,
        });
      }
      if (!idSet.has(r.right)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["relations", i, "right"],
          message: `unknown interval id: ${r.right}`,
        });
      }
    }
  });

// -----------------------------
// Unified root schema (accept legacy + canonical)
// -----------------------------

export const EventModelSchema = z.union([EventModelLegacySchema, EventModelCanonicalSchema]);

export type EventModelDTO = z.infer<typeof EventModelSchema>;
export type IntervalInstanceDTO = z.infer<typeof IntervalInstanceSchema>;
