import { describe, expect, it } from "vitest";
import { EventModelSchema } from "../src/core/schema";

describe("M3.2 — Zod schema AST", () => {
  it("parses a valid minimal EventModel", () => {
    const valid = {
      schemaVersion: "1",
      id: "m1",
      name: "Minimal model",
      intervals: [
        {
          id: "i1",
          start: 0,
          end: 10,
          predicate: { name: "hasPkg", args: ["p1", "pkg1"] },
        },
        {
          id: "i2",
          start: 11,
          end: 20,
          predicate: { name: "hasPkg", args: ["p2", "pkg1"] },
        },
      ],
      constraints: {
        temporal: [
          {
            id: "t1",
            leftIntervalId: "i1",
            rightIntervalId: "i2",
            operatorKey: "Bef",
            params: { δ: 3, ζ: "≤" },
          },
        ],
        extra: [],
      },
    };

    const parsed = EventModelSchema.parse(valid);
    expect(parsed.id).toBe("m1");
    expect(parsed.intervals).toHaveLength(2);
    expect(parsed.constraints.temporal).toHaveLength(1);
  });

  it("fails with clear error when interval end < start", () => {
    const invalid = {
      schemaVersion: "1",
      id: "m1",
      name: "Bad model",
      intervals: [
        {
          id: "i1",
          start: 10,
          end: 5,
          predicate: { name: "in", args: ["p1"] },
        },
      ],
      constraints: { temporal: [], extra: [] },
    };

    const res = EventModelSchema.safeParse(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      const msg = res.error.issues.map((i) => i.message).join(" | ");
      expect(msg).toContain("end must be >= start");
    }
  });

  it("fails with clear error when temporal expression references unknown interval ids", () => {
    const invalid = {
      schemaVersion: "1",
      id: "m1",
      name: "Bad refs",
      intervals: [
        {
          id: "i1",
          start: 0,
          end: 1,
          predicate: { name: "in", args: ["p1"] },
        },
      ],
      constraints: {
        temporal: [
          {
            id: "t1",
            leftIntervalId: "i1",
            rightIntervalId: "missing",
            operatorKey: "Bef",
          },
        ],
        extra: [],
      },
    };

    const res = EventModelSchema.safeParse(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      const msg = res.error.issues.map((i) => i.message).join(" | ");
      expect(msg).toContain("unknown interval id: missing");
    }
  });

  it("fails with clear error when params are out of domain", () => {
    const invalid = {
      schemaVersion: "1",
      id: "m1",
      name: "Bad params",
      intervals: [
        {
          id: "i1",
          start: 0,
          end: 1,
          predicate: { name: "in", args: ["p1"] },
        },
        {
          id: "i2",
          start: 2,
          end: 3,
          predicate: { name: "in", args: ["p2"] },
        },
      ],
      constraints: {
        temporal: [
          {
            id: "t1",
            leftIntervalId: "i1",
            rightIntervalId: "i2",
            operatorKey: "Bef",
            params: { δ: -1, ρ: -5 },
          },
        ],
        extra: [],
      },
    };

    const res = EventModelSchema.safeParse(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      const msg = res.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | ");
      expect(msg).toContain("threshold must be >= 0");
      expect(msg).toContain("rho must be >= 0");
    }
  });
});
