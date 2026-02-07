// iseql-event-modeler/tests/serializer.test.ts
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Assunzione minima: questi moduli/esporti esistono come da snapshot.
// Se nel tuo repo i nomi differiscono, cambia SOLO questi import.
import { serializeEventModel } from "../src/core/serializer";

// Se vuoi test end-to-end (schema+resolver) puoi sbloccare:
// import { EventModelSchema } from "../src/core/schema";
// import { resolveEventModel } from "../src/core/resolver";

const FIXTURES_DIR = path.join(__dirname, "fixtures", "serializer");

function readJson(p: string): unknown {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function readText(p: string): string {
  return fs.readFileSync(p, "utf-8").replace(/\r\n/g, "\n");
}

describe("M4.2 serializer — golden JSON → ISEQL", () => {
  const cases = [
    "01-bef-defaults",
    "02-bef-delta",
    "03-dj-delta",
    "04-sp-zeta",
    "05-two-relations",
  ];

  for (const name of cases) {
    it(name, () => {
      const jsonPath = path.join(FIXTURES_DIR, `${name}.json`);
      const expectedPath = path.join(FIXTURES_DIR, `${name}.iseql`);

      const input = readJson(jsonPath);

      // Variante minimal: test solo serializer.
      // Variante end-to-end (consigliata): parse schema + resolve + serialize.
      const out = serializeEventModel(input);

      expect(out).toBe(readText(expectedPath));
    });
  }
});

describe("M4.2 serializer — default omitted / non-default included", () => {
  it("omits all-default params", () => {
    const model = {
      id: "x",
      name: "defaults",
      intervals: [
        { id: "i1", predicate: { name: "p", args: ["a"] } },
        { id: "i2", predicate: { name: "q", args: ["b"] } },
      ],
      constraints: [
        {
          id: "c1",
          leftIntervalId: "i1",
          rightIntervalId: "i2",
          operatorId: "Bef",
          params: { zeta: "≤", eta: "≤", delta: "∞", epsilon: "∞", rho: 0 },
        },
      ],
      temporalExpression: { constraintIds: ["c1"] },
    };

    const out = serializeEventModel(model);
    expect(out).toContain("@i1 Bef @i2");
    expect(out).not.toContain("ζ:");
    expect(out).not.toContain("η:");
    expect(out).not.toContain("δ:");
    expect(out).not.toContain("ε:");
    expect(out).not.toContain("ρ:");
  });

  it("includes non-default params deterministically ordered", () => {
    const model = {
      id: "y",
      name: "nondefaults",
      intervals: [
        { id: "i1", predicate: { name: "p", args: ["a"] } },
        { id: "i2", predicate: { name: "q", args: ["b"] } },
      ],
      constraints: [
        {
          id: "c1",
          leftIntervalId: "i1",
          rightIntervalId: "i2",
          operatorId: "SP",
          params: { rho: 2, delta: 1, zeta: "<" },
        },
      ],
      temporalExpression: { constraintIds: ["c1"] },
    };

    const out = serializeEventModel(model);
    // order must be ζ, η, δ, ε, ρ with omissions
    expect(out).toContain("@i1 SP (ζ:<, δ:1, ρ:2) @i2");
  });
});
