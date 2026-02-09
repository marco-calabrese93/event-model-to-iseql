import { describe, expect, it } from "vitest";

import type { EventModel } from "../src/core/model";
import { compileEventModel } from "../src/core/compiler";

type TemporalSchemaExpr = {
  id: string;
  leftIntervalId: string;
  rightIntervalId: string;
  operatorKey: string;
  params?: unknown;
};

type SchemaConstraints = {
  temporal: TemporalSchemaExpr[];
  extra: unknown[];
};

type SchemaShapedModel = EventModel & {
  constraints: SchemaConstraints;
};

function makeSchemaValidModel(): SchemaShapedModel {
  return {
    schemaVersion: "1",
    id: "m1",
    name: "Compiler Minimal",
    intervals: [
      { id: "i1", start: 0, end: 10, predicate: { name: "in", args: ["p1"] } },
      { id: "i2", start: 12, end: 20, predicate: { name: "in", args: ["p2"] } },
    ],
    constraints: {
      temporal: [
        {
          id: "t1",
          leftIntervalId: "i1",
          rightIntervalId: "i2",
          operatorKey: "Bef",
          params: {}, // ok-case: params presenti
        },
      ],
      extra: [],
    },
  };
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

describe("compiler", () => {
  it("compilazione OK: produce iseql, resolvedModel e explain (può essere vuoto)", () => {
    const input = makeSchemaValidModel();
    const out = compileEventModel(input);

    expect(out.errors, JSON.stringify(out.errors, null, 2)).toHaveLength(0);
    expect(out.iseql).toBeTypeOf("string");
    expect((out.iseql ?? "").length).toBeGreaterThan(0);
    expect(out.resolvedModel).not.toBeNull();
    expect(Array.isArray(out.explain)).toBe(true);
  });

  it("errori Zod: non produce iseql e riporta errors[]", () => {
    const input = clone(makeSchemaValidModel());
    // Zod: manca schemaVersion
    delete (input as unknown as Record<string, unknown>).schemaVersion;

    const out = compileEventModel(input);

    expect(out.iseql).toBeNull();
    expect(out.resolvedModel).toBeNull();
    expect(out.errors.length).toBeGreaterThan(0);
  });

  it("warnings non bloccanti: produce iseql ma warnings[] non vuoto", () => {
    const input = clone(makeSchemaValidModel());

    // Caso warning deterministico (W004): params assente (delete key)
    delete input.constraints.temporal[0].params;

    const out = compileEventModel(input);

    expect(out.errors, JSON.stringify(out.errors, null, 2)).toHaveLength(0);
    expect(out.iseql).toBeTypeOf("string");
    expect(out.resolvedModel).not.toBeNull();
    expect(out.warnings.length).toBeGreaterThan(0);
  });

  it("determinismo: doppia compilazione identica (deepEqual)", () => {
    const input = makeSchemaValidModel();
    const a = compileEventModel(input);
    const b = compileEventModel(input);

    expect(b).toStrictEqual(a);
  });
});
