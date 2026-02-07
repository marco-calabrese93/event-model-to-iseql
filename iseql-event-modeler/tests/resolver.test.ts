import { describe, expect, it } from "vitest";
import { resolveEventModel, type ExplainEntry } from "../src/core/resolver";
import operatorsCatalog from "../src/core/operators.json";

type OperatorEntry = {
  id: string;
  kind: "base" | "alias";
  mapsTo?: unknown;
  [key: string]: unknown;
};

type OperatorsCatalog = {
  parameterDefaults: Record<string, unknown>;
  operators: OperatorEntry[];
};

type TemporalExpressionLike = {
  id: string;
  operatorId: string;
  params?: Record<string, unknown>;
  temporalParams?: Record<string, unknown>;
};

type TestModel = {
  schemaVersion: string;
  temporalExpressions: TemporalExpressionLike[];
  constraints?: TemporalExpressionLike[];
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function extractMapsTo(entry: OperatorEntry): string | undefined {
  const candidates: unknown[] = [
    entry.mapsTo,
    entry.mapsToOperatorId,
    entry.mapsToId,
    entry.baseOperatorId,
    entry.targetOperatorId,
  ];

  for (const c of candidates) {
    if (typeof c === "string") return c;

    if (Array.isArray(c) && c.length > 0) {
      const first = c[0];
      if (typeof first === "string") return first;
      if (isObject(first) && typeof first.id === "string") return first.id as string;
      if (isObject(first) && typeof first.operatorId === "string")
        return first.operatorId as string;
    }

    if (isObject(c)) {
      if (typeof c.id === "string") return c.id as string;
      if (typeof c.operatorId === "string") return c.operatorId as string;
      if (typeof c.opId === "string") return c.opId as string;
      if (typeof c.baseId === "string") return c.baseId as string;
    }
  }

  return undefined;
}

function makeModel(operatorId: string, params?: Record<string, unknown>): TestModel {
  return {
    schemaVersion: "test",
    temporalExpressions: [{ id: "T1", operatorId, params }],
  };
}

describe("M4.1 Resolver — alias → base + default params (data-driven from operators.json)", () => {
  const catalog = operatorsCatalog as unknown as OperatorsCatalog;

  // seleziono 10 alias reali dal catalogo, in ordine stabile
  const aliasOps = catalog.operators
    .filter((op) => op.kind === "alias")
    .map((op) => ({ aliasId: op.id, baseId: extractMapsTo(op) }))
    .filter((x) => typeof x.baseId === "string" && x.baseId.length > 0)
    .sort((a, b) => a.aliasId.localeCompare(b.aliasId))
    .slice(0, 10);

  it("has at least 10 alias operators in operators.json (for the gate)", () => {
    expect(aliasOps.length).toBeGreaterThanOrEqual(10);
  });

  it.each(aliasOps)(
    "normalizes alias '%s' → base '%s' and applies defaults",
    ({ aliasId, baseId }) => {
      const model = makeModel(aliasId);
      const { model: resolved, explain } = resolveEventModel(model);

      const t1 = resolved.temporalExpressions[0];
      expect(t1.operatorId).toBe(baseId);

      // default keys attese (valori vengono dal catalogo; qui controlliamo presenza + compatibilità)
      expect(t1.params).toBeDefined();
      expect(t1.params).toMatchObject({
        zeta: expect.anything(),
        eta: expect.anything(),
        delta: expect.anything(),
        epsilon: expect.anything(),
        rho: expect.anything(),
      });

      const ruleIds = explain.map((e: ExplainEntry) => e.ruleId);
      expect(ruleIds).toContain("R-OP-ALIAS-TO-BASE");
      expect(ruleIds.some((r) => r.startsWith("R-PARAM-DEFAULTS"))).toBe(true);
    },
  );

  it("keeps explicit params and fills only missing ones (deterministic)", () => {
    // prendo un alias valido dal catalogo
    const sample = aliasOps[0];
    const model = makeModel(sample.aliasId, { delta: 3 });

    const r1 = resolveEventModel(model);
    const r2 = resolveEventModel(model);

    expect(r1.model).toEqual(r2.model);
    expect(r1.explain).toEqual(r2.explain);

    const t1 = r1.model.temporalExpressions[0];
    expect(t1.operatorId).toBe(sample.baseId);
    expect(t1.params?.delta).toBe(3);
    expect(t1.params?.zeta).toBeDefined();
    expect(t1.params?.eta).toBeDefined();
    expect(t1.params?.epsilon).toBeDefined();
    expect(t1.params?.rho).toBeDefined();
  });

  it("accepts greek param keys and normalizes them to latin keys", () => {
    const sample = aliasOps[0];
    const model = makeModel(sample.aliasId, { δ: 2, ρ: 1 });

    const { model: resolved } = resolveEventModel(model);
    const t1 = resolved.temporalExpressions[0];

    expect(t1.operatorId).toBe(sample.baseId);
    expect(t1.params).toMatchObject({
      delta: 2,
      rho: 1,
      zeta: expect.anything(),
      eta: expect.anything(),
      epsilon: expect.anything(),
    });
  });

  it("produces stable ordering for arrays with id", () => {
    const sample = aliasOps[0];

    const input: TestModel = {
      schemaVersion: "test",
      temporalExpressions: [
        { id: "T2", operatorId: sample.aliasId },
        { id: "T1", operatorId: sample.aliasId },
      ],
      constraints: [
        { id: "C9", operatorId: sample.aliasId },
        { id: "C1", operatorId: sample.aliasId },
      ],
    };

    const { model: resolved } = resolveEventModel(input);

    expect(resolved.temporalExpressions.map((x) => x.id)).toEqual(["T1", "T2"]);
    expect((resolved.constraints ?? []).map((x) => x.id)).toEqual(["C1", "C9"]);
  });
});
