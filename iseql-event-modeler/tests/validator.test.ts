import { describe, expect, test } from "vitest";
import { validateModel } from "../src/core/validator";

describe("core/validator", () => {
  test("6 invalid cases (errors) snapshot", () => {
    const cases: Array<{ name: string; model: unknown }> = [
      {
        name: "unknown operator",
        model: {
          intervals: [{ id: "i1" }, { id: "i2" }],
          expressions: [
            { id: "e1", leftIntervalId: "i1", rightIntervalId: "i2", operatorId: "NOPE" },
          ],
          constraints: [],
        },
      },
      {
        name: "missing left interval ref",
        model: {
          intervals: [{ id: "i2" }],
          expressions: [
            { id: "e1", leftIntervalId: "i1", rightIntervalId: "i2", operatorId: "Bef" },
          ],
          constraints: [],
        },
      },
      {
        name: "missing right interval ref",
        model: {
          intervals: [{ id: "i1" }],
          expressions: [
            { id: "e1", leftIntervalId: "i1", rightIntervalId: "i2", operatorId: "Bef" },
          ],
          constraints: [],
        },
      },
      {
        name: "unknown constraint ref",
        model: {
          intervals: [{ id: "i1" }, { id: "i2" }],
          expressions: [
            {
              id: "e1",
              leftIntervalId: "i1",
              rightIntervalId: "i2",
              operatorId: "Bef",
              constraintIds: ["c404"],
            },
          ],
          constraints: [],
        },
      },
      {
        name: "invalid param range (delta negative)",
        model: {
          intervals: [{ id: "i1" }, { id: "i2" }],
          expressions: [
            {
              id: "e1",
              leftIntervalId: "i1",
              rightIntervalId: "i2",
              operatorId: "Bef",
              params: { delta: -1 },
            },
          ],
          constraints: [],
        },
      },
      {
        name: "invalid comparator",
        model: {
          intervals: [{ id: "i1" }, { id: "i2" }],
          expressions: [
            {
              id: "e1",
              leftIntervalId: "i1",
              rightIntervalId: "i2",
              operatorId: "DJ",
              params: { zeta: "??" },
            },
          ],
          constraints: [],
        },
      },
    ];

    const results = cases.map((c) => ({ name: c.name, result: validateModel(c.model) }));
    expect(results).toMatchInlineSnapshot(`
      [
        {
          "name": "unknown operator",
          "result": {
            "errors": [
              {
                "code": "V001_UNKNOWN_OPERATOR",
                "message": "Unknown operatorId 'NOPE'",
                "path": "$.expressions.0.operatorId",
                "severity": "error",
              },
            ],
            "warnings": [
              {
                "code": "W004_MISSING_PARAMS",
                "message": "Missing params for expression 'e1' (resolver will fill defaults)",
                "path": "$.expressions.0.params",
                "severity": "warning",
              },
            ],
          },
        },
        {
          "name": "missing left interval ref",
          "result": {
            "errors": [
              {
                "code": "V002_UNKNOWN_INTERVAL_REF",
                "message": "leftIntervalId 'i1' not found",
                "path": "$.expressions.0.leftIntervalId",
                "severity": "error",
              },
            ],
            "warnings": [
              {
                "code": "W004_MISSING_PARAMS",
                "message": "Missing params for expression 'e1' (resolver will fill defaults)",
                "path": "$.expressions.0.params",
                "severity": "warning",
              },
            ],
          },
        },
        {
          "name": "missing right interval ref",
          "result": {
            "errors": [
              {
                "code": "V002_UNKNOWN_INTERVAL_REF",
                "message": "rightIntervalId 'i2' not found",
                "path": "$.expressions.0.rightIntervalId",
                "severity": "error",
              },
            ],
            "warnings": [
              {
                "code": "W004_MISSING_PARAMS",
                "message": "Missing params for expression 'e1' (resolver will fill defaults)",
                "path": "$.expressions.0.params",
                "severity": "warning",
              },
            ],
          },
        },
        {
          "name": "unknown constraint ref",
          "result": {
            "errors": [
              {
                "code": "V003_UNKNOWN_CONSTRAINT_REF",
                "message": "constraintId 'c404' not found",
                "path": "$.expressions.0.constraintIds.0",
                "severity": "error",
              },
            ],
            "warnings": [
              {
                "code": "W004_MISSING_PARAMS",
                "message": "Missing params for expression 'e1' (resolver will fill defaults)",
                "path": "$.expressions.0.params",
                "severity": "warning",
              },
            ],
          },
        },
        {
          "name": "invalid param range (delta negative)",
          "result": {
            "errors": [
              {
                "code": "V005_PARAM_OUT_OF_RANGE",
                "message": "delta must be >=0 or '∞'",
                "path": "$.expressions.0.params.delta",
                "severity": "error",
              },
            ],
            "warnings": [],
          },
        },
        {
          "name": "invalid comparator",
          "result": {
            "errors": [
              {
                "code": "V006_INVALID_COMPARATOR",
                "message": "Invalid zeta comparator '??'",
                "path": "$.expressions.0.params.zeta",
                "severity": "error",
              },
            ],
            "warnings": [],
          },
        },
      ]
    `);
  });

  test("4 warning cases snapshot", () => {
    const models: Array<{ name: string; model: unknown }> = [
      {
        name: "greek keys warning",
        model: {
          intervals: [{ id: "i1" }, { id: "i2" }],
          expressions: [
            {
              id: "e1",
              leftIntervalId: "i1",
              rightIntervalId: "i2",
              operatorId: "Bef",
              params: { δ: 1, ζ: "≤" },
            },
          ],
          constraints: [],
        },
      },
      {
        name: "redundant overlapPercentage=0",
        model: {
          intervals: [{ id: "i1" }, { id: "i2" }],
          expressions: [
            {
              id: "e1",
              leftIntervalId: "i1",
              rightIntervalId: "i2",
              operatorId: "LOJ",
              params: { delta: "∞", epsilon: "∞" },
              constraintIds: ["c1"],
            },
          ],
          constraints: [{ id: "c1", kind: "overlapPercentage", value: 0 }],
        },
      },
      {
        name: "redundant robustness=0",
        model: {
          intervals: [{ id: "i1" }, { id: "i2" }],
          expressions: [
            {
              id: "e1",
              leftIntervalId: "i1",
              rightIntervalId: "i2",
              operatorId: "DJ",
              params: { delta: "∞", epsilon: "∞" },
              constraintIds: ["c1"],
            },
          ],
          constraints: [{ id: "c1", kind: "robustness", value: 0 }],
        },
      },
      {
        name: "suspicious thresholds (both ∞ on temporal op)",
        model: {
          intervals: [{ id: "i1" }, { id: "i2" }],
          expressions: [
            {
              id: "e1",
              leftIntervalId: "i1",
              rightIntervalId: "i2",
              operatorId: "Bef",
              params: { delta: "∞", epsilon: "∞" },
            },
          ],
          constraints: [],
        },
      },
    ];

    const out = models.map((m) => ({ name: m.name, result: validateModel(m.model) }));
    expect(out).toMatchInlineSnapshot(`
      [
        {
          "name": "greek keys warning",
          "result": {
            "errors": [],
            "warnings": [
              {
                "code": "W001_NON_CANONICAL_PARAM_KEYS",
                "message": "Non-canonical (Greek) param keys: δ, ζ",
                "path": "$.expressions.0.params",
                "severity": "warning",
              },
            ],
          },
        },
        {
          "name": "redundant overlapPercentage=0",
          "result": {
            "errors": [],
            "warnings": [
              {
                "code": "W002_REDUNDANT_CONSTRAINT",
                "message": "overlapPercentage=0 is redundant (no restriction)",
                "path": "$.constraints.0",
                "severity": "warning",
              },
              {
                "code": "W003_SUSPICIOUS_THRESHOLDS",
                "message": "Both delta and epsilon are ∞ (fully permissive) for 'LOJ'",
                "path": "$.expressions.0",
                "severity": "warning",
              },
            ],
          },
        },
        {
          "name": "redundant robustness=0",
          "result": {
            "errors": [],
            "warnings": [
              {
                "code": "W002_REDUNDANT_CONSTRAINT",
                "message": "robustness=0 is redundant (no slack)",
                "path": "$.constraints.0",
                "severity": "warning",
              },
              {
                "code": "W003_SUSPICIOUS_THRESHOLDS",
                "message": "Both delta and epsilon are ∞ (fully permissive) for 'DJ'",
                "path": "$.expressions.0",
                "severity": "warning",
              },
            ],
          },
        },
        {
          "name": "suspicious thresholds (both ∞ on temporal op)",
          "result": {
            "errors": [],
            "warnings": [
              {
                "code": "W003_SUSPICIOUS_THRESHOLDS",
                "message": "Both delta and epsilon are ∞ (fully permissive) for 'Bef'",
                "path": "$.expressions.0",
                "severity": "warning",
              },
            ],
          },
        },
      ]
    `);
  });
});
