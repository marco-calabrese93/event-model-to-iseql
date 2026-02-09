// tests/deriveParams.test.ts
import { describe, expect, it } from "vitest";
import { deriveParamsFromGeometry } from "../src/core/deriveParams";

describe("deriveParamsFromGeometry (M5.2)", () => {
  it("Bef: derives delta from gap (right.start - left.end)", () => {
    const res = deriveParamsFromGeometry({
      left: { start: 10, end: 20 },
      right: { start: 26, end: 30 },
      operatorId: "Bef",
    });

    expect(res.paramsSuggested.delta).toBe(6);
    expect(res.paramsSuggested.rho).toBe(0);
    expect(res.explain.map((e) => e.ruleId)).toContain("DERIVE_BEF_DELTA_FROM_GAP");
  });

  it("Aft: derives delta from gap (left.start - right.end)", () => {
    const res = deriveParamsFromGeometry({
      left: { start: 50, end: 60 },
      right: { start: 40, end: 47 },
      operatorId: "aft",
    });

    expect(res.paramsSuggested.delta).toBe(3);
    expect(res.paramsSuggested.rho).toBe(0);
    expect(res.explain.map((e) => e.ruleId)).toContain("DERIVE_AFT_DELTA_FROM_GAP");
  });

  it("LOJ: derives delta/epsilon from endpoint diffs", () => {
    const res = deriveParamsFromGeometry({
      left: { start: 10, end: 20 },
      right: { start: 13, end: 23 },
      operatorId: "LOJ",
    });

    expect(res.paramsSuggested.delta).toBe(3);
    expect(res.paramsSuggested.epsilon).toBe(3);
    expect(res.paramsSuggested.rho).toBe(0);
    expect(res.explain.map((e) => e.ruleId)).toContain("DERIVE_LOJ_FROM_ENDPOINT_DIFFS");
  });

  it("DJ: derives delta/epsilon from containment margins", () => {
    const res = deriveParamsFromGeometry({
      left: { start: 12, end: 18 },
      right: { start: 10, end: 25 },
      operatorId: "DJ",
    });

    // left.start-right.start=2, right.end-left.end=7
    expect(res.paramsSuggested.delta).toBe(2);
    expect(res.paramsSuggested.epsilon).toBe(7);
    expect(res.paramsSuggested.rho).toBe(0);
    expect(res.explain.map((e) => e.ruleId)).toContain("DERIVE_DJ_FROM_CONTAINMENT_MARGINS");
  });

  it("EF: derives epsilon from end diff (left.end - right.end), clamps to >=0", () => {
    const res = deriveParamsFromGeometry({
      left: { start: 10, end: 19 },
      right: { start: 12, end: 25 },
      operatorId: "EF",
    });

    // 19-25 = -6 -> clamp to 0
    expect(res.paramsSuggested.epsilon).toBe(0);
    expect(res.paramsSuggested.rho).toBe(0);
    expect(res.explain.map((e) => e.ruleId)).toContain("DERIVE_EF_EPSILON_FROM_END_DIFF");
  });
});
