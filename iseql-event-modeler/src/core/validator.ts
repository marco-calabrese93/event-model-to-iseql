import operatorsCatalogImport from "./operators.json";
import type { Constraint, EventModel } from "./model";

export type ValidationSeverity = "error" | "warning";

export type ValidationIssue = {
  code: string;
  severity: ValidationSeverity;
  message: string;
  path: string;
};

export type ValidationResult = {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

type OperatorEntry = {
  id: string;
  kind: "base" | "alias";
  mapsTo?: string | string[];
  supports?: {
    cardinality?: boolean;
    overlapPercentage?: boolean;
    robustness?: boolean;
  };
};

const VALID_COMPARATORS = new Set(["<", "<=", "=", ">=", ">", "≤", "≥"]);

// fallback minimo (MVP) per evitare V001 quando l'import JSON non viene risolto in Vitest
const FALLBACK_OPERATOR_IDS = new Set(["Bef", "Aft", "LOJ", "ROJ", "DJ", "RDJ", "SP", "EF", "Eq"]);

const GREEK_TO_LATIN: Record<string, string> = {
  ζ: "zeta",
  η: "eta",
  δ: "delta",
  ε: "epsilon",
  ρ: "rho",
};

function stableSortIssues(a: ValidationIssue, b: ValidationIssue) {
  const ak = `${a.path}|${a.code}|${a.message}`;
  const bk = `${b.path}|${b.code}|${b.message}`;
  return ak.localeCompare(bk);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function unwrapJsonDefault(v: unknown): unknown {
  // In alcuni ambienti l'import JSON può essere { default: ... }
  if (isRecord(v) && "default" in v) return v.default;
  return v;
}

function buildOperatorIndex(): Map<string, OperatorEntry> {
  const idx = new Map<string, OperatorEntry>();

  const raw = unwrapJsonDefault(operatorsCatalogImport as unknown);

  // Formati supportati:
  // 1) { operators: [...] }
  // 2) { entries: [...] }
  // 3) [...] (array diretto)
  let ops: unknown = raw;

  if (isRecord(raw) && Array.isArray(raw.operators)) ops = raw.operators;
  else if (isRecord(raw) && Array.isArray(raw.entries)) ops = raw.entries;

  if (!Array.isArray(ops)) return idx;

  for (const op of ops) {
    if (!isRecord(op)) continue;
    const id = op.id;
    const kind = op.kind;
    if (typeof id === "string" && (kind === "base" || kind === "alias")) {
      idx.set(id, op as unknown as OperatorEntry);
    }
  }

  return idx;
}

const OP_INDEX = buildOperatorIndex();

function findOperator(operatorId: unknown): OperatorEntry | undefined {
  if (typeof operatorId !== "string" || operatorId.trim() === "") return undefined;

  const fromCatalog = OP_INDEX.get(operatorId);
  if (fromCatalog) return fromCatalog;

  // fallback solo se catalogo non contiene l'id ma è un base operator noto
  if (FALLBACK_OPERATOR_IDS.has(operatorId)) {
    return { id: operatorId, kind: "base" };
  }

  return undefined;
}

function constraintPath(idx: number) {
  return `$.constraints.${idx}`;
}
function exprPath(idx: number) {
  return `$.expressions.${idx}`;
}

function push(list: ValidationIssue[], issue: ValidationIssue) {
  list.push(issue);
}

function getConstraintKind(c: Constraint): string | undefined {
  const u = c as unknown;
  if (!isRecord(u)) return undefined;

  // nei test usi `kind`
  const kind = u.kind;
  // supportiamo anche `type` per compat interna
  const type = u.type;

  if (typeof kind === "string") return kind;
  if (typeof type === "string") return type;
  return undefined;
}

function supportsConstraint(op: OperatorEntry, c: Constraint): boolean {
  const s = op.supports ?? {};
  const k = getConstraintKind(c);

  switch (k) {
    case "cardinality":
      return s.cardinality === true;
    case "overlapPercentage":
      return s.overlapPercentage === true;
    case "robustness":
      return s.robustness === true;
    default:
      return true;
  }
}

function isConstraintRedundant(c: Constraint): { redundant: boolean; why?: string } {
  const u = c as unknown;
  if (!isRecord(u)) return { redundant: false };

  const k = getConstraintKind(c);

  if (k === "overlapPercentage") {
    const v = u.value;
    if (v === 0)
      return { redundant: true, why: "overlapPercentage=0 is redundant (no restriction)" };
  }

  if (k === "robustness") {
    const v = u.value;
    if (v === 0) return { redundant: true, why: "robustness=0 is redundant (no slack)" };
  }

  if (k === "cardinality") {
    const min = u.min;
    if (min === 0)
      return { redundant: true, why: "cardinality.min=0 is redundant (no restriction)" };
  }

  return { redundant: false };
}

function listGreekKeys(params: Record<string, unknown>): string[] {
  const found: string[] = [];
  for (const k of Object.keys(params)) {
    if (k in GREEK_TO_LATIN) found.push(k);
  }
  return found.sort((a, b) => a.localeCompare(b));
}

function isInfinityValue(v: unknown): v is "∞" {
  return v === "∞";
}
function isNonNegNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

function getExprField(expr: unknown, key: string): unknown {
  if (!isRecord(expr)) return undefined;
  return expr[key];
}

function getParams(expr: unknown): Record<string, unknown> | undefined {
  const p = getExprField(expr, "params");
  if (p === undefined || p === null) return undefined;
  return isRecord(p) ? p : undefined;
}

/**
 * Validator “umano” oltre Zod, allineato agli snapshot in tests/validator.test.ts
 * - W004_MISSING_PARAMS viene emesso quando params mancano (anche se ci sono errori)
 */
export function validateModel(model: EventModel): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const intervalIdSet = new Set(model.intervals.map((i) => i.id));
  const constraintsArr = model.constraints ?? [];
  const constraintIdSet = new Set(constraintsArr.map((c) => c.id));

  // warnings: ridondanze constraints
  for (let ci = 0; ci < constraintsArr.length; ci++) {
    const c = constraintsArr[ci];
    const r = isConstraintRedundant(c);
    if (r.redundant) {
      push(warnings, {
        code: "W002_REDUNDANT_CONSTRAINT",
        severity: "warning",
        message: r.why ?? "Redundant constraint",
        path: constraintPath(ci),
      });
    }
  }

  for (let ei = 0; ei < model.expressions.length; ei++) {
    const expr = model.expressions[ei] as unknown;
    const basePath = exprPath(ei);

    const exprId = getExprField(expr, "id");
    const exprIdStr = typeof exprId === "string" ? exprId : "?";

    const operatorId = getExprField(expr, "operatorId");
    const op = findOperator(operatorId);

    if (!op) {
      push(errors, {
        code: "V001_UNKNOWN_OPERATOR",
        severity: "error",
        message: `Unknown operatorId '${String(operatorId)}'`,
        path: `${basePath}.operatorId`,
      });
    }

    // interval refs
    const leftIntervalId = getExprField(expr, "leftIntervalId");
    if (typeof leftIntervalId === "string" && !intervalIdSet.has(leftIntervalId)) {
      push(errors, {
        code: "V002_UNKNOWN_INTERVAL_REF",
        severity: "error",
        message: `leftIntervalId '${leftIntervalId}' not found`,
        path: `${basePath}.leftIntervalId`,
      });
    }

    const rightIntervalId = getExprField(expr, "rightIntervalId");
    if (typeof rightIntervalId === "string" && !intervalIdSet.has(rightIntervalId)) {
      push(errors, {
        code: "V002_UNKNOWN_INTERVAL_REF",
        severity: "error",
        message: `rightIntervalId '${rightIntervalId}' not found`,
        path: `${basePath}.rightIntervalId`,
      });
    }

    // constraint refs
    const constraintIds = getExprField(expr, "constraintIds");
    if (Array.isArray(constraintIds)) {
      for (let k = 0; k < constraintIds.length; k++) {
        const cid = constraintIds[k];
        if (typeof cid === "string" && !constraintIdSet.has(cid)) {
          push(errors, {
            code: "V003_UNKNOWN_CONSTRAINT_REF",
            severity: "error",
            message: `constraintId '${cid}' not found`,
            path: `${basePath}.constraintIds.${k}`,
          });
        }
      }
    }

    // W004: params mancanti (atteso dagli snapshot anche con errori)
    const paramsOpt = getParams(expr);
    if (paramsOpt === undefined) {
      push(warnings, {
        code: "W004_MISSING_PARAMS",
        severity: "warning",
        message: `Missing params for expression '${exprIdStr}' (resolver will fill defaults)`,
        path: `${basePath}.params`,
      });
    }
    const params = paramsOpt ?? {};

    // W001: greek keys
    const greek = listGreekKeys(params);
    if (greek.length > 0) {
      push(warnings, {
        code: "W001_NON_CANONICAL_PARAM_KEYS",
        severity: "warning",
        message: `Non-canonical (Greek) param keys: ${greek.join(", ")}`,
        path: `${basePath}.params`,
      });
    }

    // operator/constraint compatibility
    if (op && Array.isArray(constraintIds) && constraintsArr.length > 0) {
      const byId = new Map(constraintsArr.map((c) => [c.id, c] as const));
      for (let k = 0; k < constraintIds.length; k++) {
        const cid = constraintIds[k];
        const c = typeof cid === "string" ? byId.get(cid) : undefined;
        if (c && !supportsConstraint(op, c)) {
          const cKind = getConstraintKind(c) ?? "unknown";
          push(errors, {
            code: "V004_CONSTRAINT_NOT_SUPPORTED",
            severity: "error",
            message: `Constraint '${cKind}' not supported by operator '${op.id}'`,
            path: `${basePath}.constraintIds.${k}`,
          });
        }
      }
    }

    // params validation
    const zeta = params.zeta ?? params["ζ"];
    if (zeta !== undefined && (typeof zeta !== "string" || !VALID_COMPARATORS.has(zeta))) {
      push(errors, {
        code: "V006_INVALID_COMPARATOR",
        severity: "error",
        message: `Invalid zeta comparator '${String(zeta)}'`,
        path: `${basePath}.params.zeta`,
      });
    }

    const eta = params.eta ?? params["η"];
    if (eta !== undefined && (typeof eta !== "string" || !VALID_COMPARATORS.has(eta))) {
      push(errors, {
        code: "V006_INVALID_COMPARATOR",
        severity: "error",
        message: `Invalid eta comparator '${String(eta)}'`,
        path: `${basePath}.params.eta`,
      });
    }

    const delta = params.delta ?? params["δ"];
    if (delta !== undefined && !(isNonNegNumber(delta) || isInfinityValue(delta))) {
      push(errors, {
        code: "V005_PARAM_OUT_OF_RANGE",
        severity: "error",
        message: "delta must be >=0 or '∞'",
        path: `${basePath}.params.delta`,
      });
    }

    const epsilon = params.epsilon ?? params["ε"];
    if (epsilon !== undefined && !(isNonNegNumber(epsilon) || isInfinityValue(epsilon))) {
      push(errors, {
        code: "V005_PARAM_OUT_OF_RANGE",
        severity: "error",
        message: "epsilon must be >=0 or '∞'",
        path: `${basePath}.params.epsilon`,
      });
    }

    const rho = params.rho ?? params["ρ"];
    if (rho !== undefined && !isNonNegNumber(rho)) {
      push(errors, {
        code: "V005_PARAM_OUT_OF_RANGE",
        severity: "error",
        message: "rho must be >=0",
        path: `${basePath}.params.rho`,
      });
    }

    // W003 suspicious thresholds (solo se operator riconosciuto)
    if (op) {
      const dInf = delta !== undefined && isInfinityValue(delta);
      const eInf = epsilon !== undefined && isInfinityValue(epsilon);
      if (dInf && eInf) {
        push(warnings, {
          code: "W003_SUSPICIOUS_THRESHOLDS",
          severity: "warning",
          message: `Both delta and epsilon are ∞ (fully permissive) for '${op.id}'`,
          path: `${basePath}`,
        });
      }
    }
  }

  errors.sort(stableSortIssues);
  warnings.sort(stableSortIssues);

  return { errors, warnings };
}
