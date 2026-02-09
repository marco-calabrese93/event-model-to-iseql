import operatorsCatalogImport from "./operators.json";

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

/**
 * Struttura reale operators.json (minimo necessario al validator)
 */
type OperatorCatalog = {
  schemaVersion: string;
  parameterDefaults: Record<string, unknown>;
  operators: CatalogOperatorEntry[];
};

type CatalogOperatorEntry = {
  kind: "operator" | "alias";
  id: string; // es: "bef"
  code: string; // es: "Bef", "DJ", "LOJ", "Allen.Before"
  constraintCompatibility?: {
    cardinality?: boolean;
    overlapPercentage?: boolean;
    robustness?: boolean;
  };
};

type JsonObject = Record<string, unknown>;

const VALID_COMPARATORS = new Set(["<", "<=", "=", ">=", ">", "≤", "≥"]);

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

function isRecord(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function unwrapJsonDefault(v: unknown): unknown {
  // alcuni setup import JSON => { default: ... }
  if (isRecord(v) && "default" in v) return v.default;
  return v;
}

function asCatalog(v: unknown): OperatorCatalog | null {
  const raw = unwrapJsonDefault(v);
  if (!isRecord(raw)) return null;
  if (typeof raw.schemaVersion !== "string") return null;
  if (!isRecord(raw.parameterDefaults)) return null;
  if (!Array.isArray(raw.operators)) return null;

  for (const op of raw.operators) {
    if (!isRecord(op)) return null;
    if (op.kind !== "operator" && op.kind !== "alias") return null;
    if (typeof op.id !== "string") return null;
    if (typeof op.code !== "string") return null;
  }

  return raw as unknown as OperatorCatalog;
}

type OperatorLookup = {
  byCode: Map<string, CatalogOperatorEntry>;
  byId: Map<string, CatalogOperatorEntry>;
};

function buildOperatorLookup(): OperatorLookup {
  const byCode = new Map<string, CatalogOperatorEntry>();
  const byId = new Map<string, CatalogOperatorEntry>();

  const cat = asCatalog(operatorsCatalogImport as unknown);
  if (!cat) return { byCode, byId };

  for (const op of cat.operators) {
    byId.set(op.id, op);
    byCode.set(op.code, op);
  }

  return { byCode, byId };
}

const OP = buildOperatorLookup();

function findOperator(operatorId: unknown): CatalogOperatorEntry | undefined {
  if (typeof operatorId !== "string" || operatorId.trim() === "") return undefined;

  const byCode = OP.byCode.get(operatorId);
  if (byCode) return byCode;

  const byId = OP.byId.get(operatorId);
  if (byId) return byId;

  return undefined;
}

function exprPath(idx: number) {
  return `$.expressions.${idx}`;
}
function constraintPath(idx: number) {
  return `$.constraints.${idx}`;
}

function push(list: ValidationIssue[], issue: ValidationIssue) {
  list.push(issue);
}

function getConstraintKind(c: unknown): string | undefined {
  if (!isRecord(c)) return undefined;
  const kind = c.kind;
  const type = c.type;
  if (typeof kind === "string") return kind;
  if (typeof type === "string") return type;
  return undefined;
}

function isConstraintRedundant(c: unknown): { redundant: boolean; why?: string } {
  if (!isRecord(c)) return { redundant: false };

  const k = getConstraintKind(c);

  if (k === "overlapPercentage") {
    if (c.value === 0)
      return { redundant: true, why: "overlapPercentage=0 is redundant (no restriction)" };
  }
  if (k === "robustness") {
    if (c.value === 0) return { redundant: true, why: "robustness=0 is redundant (no slack)" };
  }
  if (k === "cardinality") {
    if (c.min === 0)
      return { redundant: true, why: "cardinality.min=0 is redundant (no restriction)" };
  }

  return { redundant: false };
}

function supportsConstraint(op: CatalogOperatorEntry, c: unknown): boolean {
  const compat = op.constraintCompatibility ?? {};
  const k = getConstraintKind(c);

  switch (k) {
    case "cardinality":
      return compat.cardinality === true;
    case "overlapPercentage":
      return compat.overlapPercentage === true;
    case "robustness":
      return compat.robustness === true;
    default:
      return true;
  }
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
 * Estrae constraints in modo compatibile:
 * - pipeline: constraints: Constraint[] (array)
 * - AST: constraints: { constraints: Constraint[] }
 */
function extractConstraintsArray(model: unknown): unknown[] {
  if (!isRecord(model)) return [];

  const c = model.constraints;
  if (Array.isArray(c)) return c;

  if (isRecord(c) && Array.isArray(c.constraints)) return c.constraints;

  // schema-shape: constraints: { temporal, extra }
  if (isRecord(c) && Array.isArray(c.extra)) return c.extra;

  return [];
}

/**
 * Estrae expressions in modo compatibile:
 * - pipeline: expressions: [...]
 * - AST: relations: [...]
 * - schema-shape: constraints.temporal: [...]
 */
function extractExpressionsArray(model: unknown): unknown[] {
  if (!isRecord(model)) return [];

  if (Array.isArray(model.expressions)) return model.expressions;
  if (Array.isArray(model.relations)) return model.relations;

  const c = model.constraints;
  if (isRecord(c) && Array.isArray(c.temporal)) return c.temporal;

  return [];
}

/**
 * Estrae intervals sempre come array (se possibile)
 */
function extractIntervalsArray(model: unknown): unknown[] {
  if (!isRecord(model)) return [];
  return Array.isArray(model.intervals) ? model.intervals : [];
}

/**
 * Validator “umano” oltre Zod.
 * Shape-tolerant: accetta model pipeline o AST.
 */
export function validateModel(model: unknown): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const intervalsArr = extractIntervalsArray(model);
  const intervalIdSet = new Set(
    intervalsArr
      .map((i) => (isRecord(i) ? i.id : undefined))
      .filter((id): id is unknown => id !== undefined)
      .map((id) => String(id)),
  );

  const constraintsArr = extractConstraintsArray(model);
  const constraintIdSet = new Set(
    constraintsArr
      .map((c) => (isRecord(c) ? c.id : undefined))
      .filter((id): id is unknown => id !== undefined)
      .map((id) => String(id)),
  );

  // warnings globali su constraints (ridondanti)
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

  const exprs = extractExpressionsArray(model);

  for (let ei = 0; ei < exprs.length; ei++) {
    const expr = exprs[ei];
    const basePath = exprPath(ei);

    const exprId = getExprField(expr, "id");
    const exprIdStr = typeof exprId === "string" ? exprId : String(exprId ?? "?");

    // operator id/key (pipeline usa operatorId; schema-shape usa operatorKey)
    const operatorId = getExprField(expr, "operatorId") ?? getExprField(expr, "operatorKey");
    const op = findOperator(operatorId);

    if (!op) {
      push(errors, {
        code: "V001_UNKNOWN_OPERATOR",
        severity: "error",
        message: `Unknown operatorId '${String(operatorId)}'`,
        path: `${basePath}.operatorId`,
      });
    }

    // interval refs: pipeline leftIntervalId/rightIntervalId, AST left/right
    const leftIntervalId = getExprField(expr, "leftIntervalId") ?? getExprField(expr, "left");
    if (typeof leftIntervalId === "string" && !intervalIdSet.has(leftIntervalId)) {
      push(errors, {
        code: "V002_UNKNOWN_INTERVAL_REF",
        severity: "error",
        message: `leftIntervalId '${leftIntervalId}' not found`,
        path: `${basePath}.leftIntervalId`,
      });
    }

    const rightIntervalId = getExprField(expr, "rightIntervalId") ?? getExprField(expr, "right");
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

    // params missing => W004 (sempre, anche con errori)
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

    // greek keys warning
    const greek = listGreekKeys(params);
    if (greek.length > 0) {
      push(warnings, {
        code: "W001_NON_CANONICAL_PARAM_KEYS",
        severity: "warning",
        message: `Non-canonical (Greek) param keys: ${greek.join(", ")}`,
        path: `${basePath}.params`,
      });
    }

    // operator/constraint compatibility (se op riconosciuto)
    if (op && Array.isArray(constraintIds) && constraintsArr.length > 0) {
      const byId = new Map<string, unknown>();
      for (const c of constraintsArr) {
        if (isRecord(c) && c.id !== undefined) byId.set(String(c.id), c);
      }

      for (let k = 0; k < constraintIds.length; k++) {
        const cid = constraintIds[k];
        const c = typeof cid === "string" ? byId.get(cid) : undefined;
        if (c && !supportsConstraint(op, c)) {
          const knd = getConstraintKind(c) ?? "unknown";
          push(errors, {
            code: "V004_CONSTRAINT_NOT_SUPPORTED",
            severity: "error",
            message: `Constraint '${knd}' not supported by operator '${String(operatorId)}'`,
            path: `${basePath}.constraintIds.${k}`,
          });
        }
      }
    }

    // param validation (comparator + ranges)
    const zeta =
      (params as Record<string, unknown>).zeta ?? (params as Record<string, unknown>)["ζ"];
    if (zeta !== undefined && (typeof zeta !== "string" || !VALID_COMPARATORS.has(zeta))) {
      push(errors, {
        code: "V006_INVALID_COMPARATOR",
        severity: "error",
        message: `Invalid zeta comparator '${String(zeta)}'`,
        path: `${basePath}.params.zeta`,
      });
    }

    const eta = (params as Record<string, unknown>).eta ?? (params as Record<string, unknown>)["η"];
    if (eta !== undefined && (typeof eta !== "string" || !VALID_COMPARATORS.has(eta))) {
      push(errors, {
        code: "V006_INVALID_COMPARATOR",
        severity: "error",
        message: `Invalid eta comparator '${String(eta)}'`,
        path: `${basePath}.params.eta`,
      });
    }

    const delta =
      (params as Record<string, unknown>).delta ?? (params as Record<string, unknown>)["δ"];
    if (delta !== undefined && !(isNonNegNumber(delta) || isInfinityValue(delta))) {
      push(errors, {
        code: "V005_PARAM_OUT_OF_RANGE",
        severity: "error",
        message: "delta must be >=0 or '∞'",
        path: `${basePath}.params.delta`,
      });
    }

    const epsilon =
      (params as Record<string, unknown>).epsilon ?? (params as Record<string, unknown>)["ε"];
    if (epsilon !== undefined && !(isNonNegNumber(epsilon) || isInfinityValue(epsilon))) {
      push(errors, {
        code: "V005_PARAM_OUT_OF_RANGE",
        severity: "error",
        message: "epsilon must be >=0 or '∞'",
        path: `${basePath}.params.epsilon`,
      });
    }

    const rho = (params as Record<string, unknown>).rho ?? (params as Record<string, unknown>)["ρ"];
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
          message: `Both delta and epsilon are ∞ (fully permissive) for '${String(operatorId)}'`,
          path: `${basePath}`,
        });
      }
    }

    // Snapshot requirement: se params presenti e ci sono errori param-related => warnings [] per questa expr
    const hasParams = paramsOpt !== undefined;
    if (hasParams) {
      const hasParamErrors = errors.some(
        (er) =>
          (er.code === "V005_PARAM_OUT_OF_RANGE" || er.code === "V006_INVALID_COMPARATOR") &&
          er.path.startsWith(`${basePath}.params.`),
      );
      if (hasParamErrors) {
        for (let wi = warnings.length - 1; wi >= 0; wi--) {
          if (warnings[wi].path.startsWith(basePath)) warnings.splice(wi, 1);
        }
      }
    }
  }

  errors.sort(stableSortIssues);
  warnings.sort(stableSortIssues);

  return { errors, warnings };
}
