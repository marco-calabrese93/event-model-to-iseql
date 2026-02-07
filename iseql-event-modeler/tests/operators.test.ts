import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

type OperatorKind = "operator" | "alias";

type OperatorEntry = {
  kind: OperatorKind;
  id: string;
  code: string;
  label: string;
  description: string;
  arity: number;
  parameters: {
    supported: string[];
    defaults: Record<string, unknown>;
    domains: Record<string, unknown>;
  };
  constraintCompatibility: {
    cardinality: boolean;
    overlapPercentage: boolean;
    robustness: boolean;
  };
  mapsTo?: {
    operatorId: string;
    fixed: Record<string, unknown>;
  };
};

type OperatorsCatalog = {
  schemaVersion: string;
  parameterDefaults: Record<string, unknown>;
  operators: OperatorEntry[];
};

function loadCatalog(): OperatorsCatalog {
  const url = new URL("../src/core/operators.json", import.meta.url);
  const raw = readFileSync(url, "utf-8");
  return JSON.parse(raw) as OperatorsCatalog;
}

describe("operators.json catalog", () => {
  it("is valid JSON and has top-level required fields", () => {
    const catalog = loadCatalog();

    expect(typeof catalog.schemaVersion).toBe("string");
    expect(catalog.schemaVersion.length).toBeGreaterThan(0);

    expect(catalog.parameterDefaults).toBeTruthy();
    expect(typeof catalog.parameterDefaults).toBe("object");

    expect(Array.isArray(catalog.operators)).toBe(true);
    expect(catalog.operators.length).toBeGreaterThan(0);
  });

  it("every operator entry has mandatory fields and coherent structure", () => {
    const catalog = loadCatalog();

    const ids = new Set<string>();
    for (const op of catalog.operators) {
      expect(op).toBeTruthy();

      // required primitives
      expect(op.kind === "operator" || op.kind === "alias").toBe(true);

      expect(typeof op.id).toBe("string");
      expect(op.id.length).toBeGreaterThan(0);

      expect(typeof op.code).toBe("string");
      expect(op.code.length).toBeGreaterThan(0);

      expect(typeof op.label).toBe("string");
      expect(op.label.length).toBeGreaterThan(0);

      expect(typeof op.description).toBe("string");
      expect(op.description.length).toBeGreaterThan(0);

      expect(typeof op.arity).toBe("number");
      expect(op.arity).toBe(2);

      // uniqueness
      expect(ids.has(op.id)).toBe(false);
      ids.add(op.id);

      // parameters section
      expect(op.parameters).toBeTruthy();
      expect(Array.isArray(op.parameters.supported)).toBe(true);
      expect(op.parameters.defaults).toBeTruthy();
      expect(typeof op.parameters.defaults).toBe("object");
      expect(op.parameters.domains).toBeTruthy();
      expect(typeof op.parameters.domains).toBe("object");

      // constraint compatibility
      expect(op.constraintCompatibility).toBeTruthy();
      expect(typeof op.constraintCompatibility.cardinality).toBe("boolean");
      expect(typeof op.constraintCompatibility.overlapPercentage).toBe("boolean");
      expect(typeof op.constraintCompatibility.robustness).toBe("boolean");

      // alias mapping must exist
      if (op.kind === "alias") {
        expect(op.mapsTo).toBeTruthy();
        expect(typeof op.mapsTo?.operatorId).toBe("string");
        expect(op.mapsTo?.operatorId.length).toBeGreaterThan(0);
        expect(op.mapsTo?.fixed).toBeTruthy();
        expect(typeof op.mapsTo?.fixed).toBe("object");
      }
    }
  });
});
