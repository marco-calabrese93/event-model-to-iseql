// src/core/deriveParams.ts
import type { TemporalParams } from "./model";

export type IntervalEndpoints = Readonly<{
  start: number;
  end: number;
}>;

export type DeriveExplainEntry = Readonly<{
  ruleId: string;
  text: string;
}>;

export type DeriveParamsInput = Readonly<{
  left: IntervalEndpoints;
  right: IntervalEndpoints;
  /**
   * operator identifier (robust): can be ISEQL code (e.g. "Bef") or id (e.g. "bef")
   * and can be an alias code/id that already got normalized elsewhere.
   */
  operatorId: string;
}>;

export type DeriveParamsResult = Readonly<{
  paramsSuggested: Partial<TemporalParams>;
  explain: DeriveExplainEntry[];
}>;

type OperatorFamily = "bef" | "aft" | "loj" | "roj" | "dj" | "rdj" | "sp" | "ef" | "eq" | "unknown";

/**
 * Deterministic, opt-in helper:
 * derive δ/ε/ρ suggestions from timeline geometry (ticks) for a relation between 2 intervals.
 *
 * Notes:
 * - We only propose numeric thresholds (δ/ε) and ρ (slack). ζ/η are comparators and remain defaults.
 * - All derived thresholds are clamped to >= 0.
 * - The function is pure/deterministic: no randomness, no reliance on Date/locale, stable explain ordering.
 */
export function deriveParamsFromGeometry(input: DeriveParamsInput): DeriveParamsResult {
  const left = normalizeEndpoints(input.left);
  const right = normalizeEndpoints(input.right);

  const family = normalizeOperatorFamily(input.operatorId);

  const explain: DeriveExplainEntry[] = [];
  const paramsSuggested: Partial<TemporalParams> = {};

  // ρ is not geometry-derivable in a universally correct way in MVP:
  // keep it deterministic and explicit.
  paramsSuggested.rho = 0;
  explain.push({
    ruleId: "DERIVE_RHO_DEFAULT_ZERO",
    text: "ρ (robustness/slack) is not derived from geometry in MVP; suggested value is the deterministic default 0.",
  });

  switch (family) {
    case "bef": {
      // Bef: 0 < (right.start - left.end) <= δ  => suggest δ = gap (clamped to >=0)
      const gap = clampNonNeg(right.start - left.end);
      paramsSuggested.delta = gap;
      explain.push({
        ruleId: "DERIVE_BEF_DELTA_FROM_GAP",
        text: `Bef: suggested δ equals the gap (right.start - left.end) = ${gap}, clamped to >= 0.`,
      });
      return { paramsSuggested, explain };
    }

    case "aft": {
      // Aft is symmetric of Bef: 0 < (left.start - right.end) <= δ
      const gap = clampNonNeg(left.start - right.end);
      paramsSuggested.delta = gap;
      explain.push({
        ruleId: "DERIVE_AFT_DELTA_FROM_GAP",
        text: `Aft: suggested δ equals the gap (left.start - right.end) = ${gap}, clamped to >= 0.`,
      });
      return { paramsSuggested, explain };
    }

    case "loj": {
      // LOJ: 0 <= (right.start - left.start) <= δ AND 0 <= (right.end - left.end) <= ε
      const d = clampNonNeg(right.start - left.start);
      const e = clampNonNeg(right.end - left.end);
      paramsSuggested.delta = d;
      paramsSuggested.epsilon = e;
      explain.push({
        ruleId: "DERIVE_LOJ_FROM_ENDPOINT_DIFFS",
        text: `LOJ: suggested δ=(right.start-left.start)=${d}, ε=(right.end-left.end)=${e}, both clamped to >= 0.`,
      });
      return { paramsSuggested, explain };
    }

    case "roj": {
      // ROJ: swap roles compared to LOJ (or apply same diffs with left/right swapped)
      const d = clampNonNeg(left.start - right.start);
      const e = clampNonNeg(left.end - right.end);
      paramsSuggested.delta = d;
      paramsSuggested.epsilon = e;
      explain.push({
        ruleId: "DERIVE_ROJ_FROM_ENDPOINT_DIFFS",
        text: `ROJ: suggested δ=(left.start-right.start)=${d}, ε=(left.end-right.end)=${e}, both clamped to >= 0.`,
      });
      return { paramsSuggested, explain };
    }

    case "dj": {
      // DJ: 0 <= (left.start - right.start) <= δ AND 0 <= (right.end - left.end) <= ε
      const d = clampNonNeg(left.start - right.start);
      const e = clampNonNeg(right.end - left.end);
      paramsSuggested.delta = d;
      paramsSuggested.epsilon = e;
      explain.push({
        ruleId: "DERIVE_DJ_FROM_CONTAINMENT_MARGINS",
        text: `DJ: suggested δ=(left.start-right.start)=${d}, ε=(right.end-left.end)=${e}, both clamped to >= 0.`,
      });
      return { paramsSuggested, explain };
    }

    case "rdj": {
      // RDJ: reverse during (swap roles)
      const d = clampNonNeg(right.start - left.start);
      const e = clampNonNeg(left.end - right.end);
      paramsSuggested.delta = d;
      paramsSuggested.epsilon = e;
      explain.push({
        ruleId: "DERIVE_RDJ_FROM_CONTAINMENT_MARGINS",
        text: `RDJ: suggested δ=(right.start-left.start)=${d}, ε=(left.end-right.end)=${e}, both clamped to >= 0.`,
      });
      return { paramsSuggested, explain };
    }

    case "sp": {
      // SP: 0 <= (right.start - left.start) <= δ and overlap condition (not parameterized with ε)
      const d = clampNonNeg(right.start - left.start);
      paramsSuggested.delta = d;
      explain.push({
        ruleId: "DERIVE_SP_DELTA_FROM_START_DIFF",
        text: `SP: suggested δ=(right.start-left.start)=${d}, clamped to >= 0.`,
      });
      return { paramsSuggested, explain };
    }

    case "ef": {
      // EF: 0 <= (left.end - right.end) <= ε and overlap condition (not parameterized with δ)
      const e = clampNonNeg(left.end - right.end);
      paramsSuggested.epsilon = e;
      explain.push({
        ruleId: "DERIVE_EF_EPSILON_FROM_END_DIFF",
        text: `EF: suggested ε=(left.end-right.end)=${e}, clamped to >= 0.`,
      });
      return { paramsSuggested, explain };
    }

    case "eq": {
      // Eq: we can suggest δ=0 and ε=0 to reflect exact alignment (deterministic and safe)
      paramsSuggested.delta = 0;
      paramsSuggested.epsilon = 0;
      explain.push({
        ruleId: "DERIVE_EQ_ZERO_THRESHOLDS",
        text: "Eq: suggested δ=0 and ε=0 (exact alignment).",
      });
      return { paramsSuggested, explain };
    }

    default: {
      explain.push({
        ruleId: "DERIVE_UNKNOWN_NO_THRESHOLDS",
        text: `Unknown operatorId "${input.operatorId}": no δ/ε derivation applied (ρ default suggestion kept).`,
      });
      return { paramsSuggested, explain };
    }
  }
}

function normalizeEndpoints(ep: IntervalEndpoints): IntervalEndpoints {
  // Keep behavior deterministic and tolerant: if start > end, swap (like timeline helpers).
  const s = Math.round(ep.start);
  const e = Math.round(ep.end);
  return s <= e ? { start: s, end: e } : { start: e, end: s };
}

function clampNonNeg(n: number): number {
  const v = Math.round(n);
  return v < 0 ? 0 : v;
}

function normalizeOperatorFamily(operatorIdRaw: string): OperatorFamily {
  const raw = (operatorIdRaw ?? "").trim();
  if (!raw) return "unknown";

  const low = raw.toLowerCase();

  // Accept both code-ish and id-ish forms, plus common variants.
  // Keep mapping minimal and explicit (MVP).
  const map: Record<string, OperatorFamily> = {
    // before/after
    bef: "bef",
    before: "bef",
    aft: "aft",
    after: "aft",

    // overlap joins
    loj: "loj",
    leftoverlapjoin: "loj",
    roj: "roj",
    rightoverlapjoin: "roj",

    // during joins
    dj: "dj",
    duringjoin: "dj",
    rdj: "rdj",
    reverseduringjoin: "rdj",

    // start preceding / end following
    sp: "sp",
    startpreceding: "sp",
    ef: "ef",
    endfollowing: "ef",

    // equals
    eq: "eq",
    equals: "eq",
  };

  // Also support ISEQL "Code" format that might be passed in (e.g., "Bef", "DJ", "LOJ")
  // -> lowercasing already handles those.
  return map[low] ?? "unknown";
}
