// iseql-event-modeler/src/core/serializer.ts

/**
 * Serializer M4.2
 * Obiettivo: output ISEQL "pattern-like" deterministico byte-for-byte.
 *
 * NOTE:
 * - Input atteso: AST già "resolved" (operatorId base; params con chiavi latinizzate: zeta/eta/delta/epsilon/rho)
 * - Policy default: ometti parametri uguali ai default (globali + per-operatore) in modo deterministico.
 * - Gestione "∞": preservata come stringa "∞" in output (policy documentata).
 * - NEWLINE FINALE: l’output termina SEMPRE con '\n' per matchare i golden file.
 */

import operatorsCatalog from "./operators.json";

type Comparator = "<" | "≤" | "=" | "≥" | ">";
type InfinityLiteral = "∞";
type Threshold = number | InfinityLiteral;

type TemporalParams = Partial<{
  zeta: Comparator;
  eta: Comparator;
  delta: Threshold;
  epsilon: Threshold;
  rho: number;
}>;

type PredicateCall = {
  name: string;
  args?: unknown[];
};

type IntervalInstance = {
  id: string;
  predicate?: PredicateCall;
};

type Constraint = {
  id: string;
  leftIntervalId: string;
  rightIntervalId: string;
  operatorId: string; // base operator (Bef/Aft/LOJ/ROJ/DJ/RDJ/SP/EF/Eq)
  params?: TemporalParams;
  // optional extra constraints (if your AST carries them)
  cardinality?: unknown;
  overlapPercentage?: unknown;
  robustness?: unknown;
};

type TemporalExpressionLike =
  | {
      // "doc form": root + intervalIds/constraintIds
      root?: string;
      intervalIds?: string[];
      constraintIds?: string[];
    }
  | unknown;

type EventModelLike = {
  id?: string;
  name?: string;
  intervals?: IntervalInstance[];
  constraints?: Constraint[];
  constraintSet?: { constraints?: Constraint[] };
  temporalExpression?: TemporalExpressionLike;
};

type OperatorEntry = {
  id: string;
  kind: "base" | "alias";
  params?: Partial<TemporalParams>;
  defaults?: Partial<TemporalParams>;
};

type OperatorsCatalog = {
  schemaVersion: string;
  parameterDefaults: Required<TemporalParams>;
  operators: OperatorEntry[];
};

const CATALOG = operatorsCatalog as unknown as OperatorsCatalog;

const PARAM_ORDER: (keyof TemporalParams)[] = ["zeta", "eta", "delta", "epsilon", "rho"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function stableSortById<T extends { id: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function getGlobalDefaults(): Required<TemporalParams> {
  return CATALOG.parameterDefaults;
}

function buildOperatorDefaultsMap(): Map<string, Partial<TemporalParams>> {
  const map = new Map<string, Partial<TemporalParams>>();
  for (const op of CATALOG.operators) {
    if (op.kind !== "base") continue;
    const d = (op.defaults ?? op.params ?? {}) as Partial<TemporalParams>;
    map.set(op.id, d);
  }
  return map;
}

const GLOBAL_DEFAULTS = getGlobalDefaults();
const OP_DEFAULTS = buildOperatorDefaultsMap();

function normalizeComparator(v: unknown): Comparator | undefined {
  if (v === "<" || v === "≤" || v === "=" || v === "≥" || v === ">") return v;
  if (v === "<=") return "≤";
  if (v === ">=") return "≥";
  return undefined;
}

function normalizeThreshold(v: unknown): Threshold | undefined {
  if (v === "∞") return "∞";
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === "string" && v.trim() !== "" && /^[0-9]+(?:\.[0-9]+)?$/.test(v.trim())) {
    const n = Number(v.trim());
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return undefined;
}

function normalizeRho(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === "string" && v.trim() !== "" && /^[0-9]+(?:\.[0-9]+)?$/.test(v.trim())) {
    const n = Number(v.trim());
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return undefined;
}

function normalizeParams(params: unknown): TemporalParams {
  if (!isRecord(params)) return {};
  const out: TemporalParams = {};

  if ("zeta" in params) out.zeta = normalizeComparator(params.zeta);
  if ("eta" in params) out.eta = normalizeComparator(params.eta);
  if ("delta" in params) out.delta = normalizeThreshold(params.delta);
  if ("epsilon" in params) out.epsilon = normalizeThreshold(params.epsilon);
  if ("rho" in params) out.rho = normalizeRho(params.rho);

  for (const k of Object.keys(out) as (keyof TemporalParams)[]) {
    if (out[k] === undefined) delete out[k];
  }
  return out;
}

function getDefaultForParam(operatorId: string, key: keyof TemporalParams): unknown {
  const opD = OP_DEFAULTS.get(operatorId);
  if (opD && key in opD) return opD[key];
  return GLOBAL_DEFAULTS[key];
}

function shouldOmitParam(operatorId: string, key: keyof TemporalParams, value: unknown): boolean {
  const def = getDefaultForParam(operatorId, key);
  return value === def;
}

function serializeParamKV(key: keyof TemporalParams, value: unknown): string {
  const greek =
    key === "zeta"
      ? "ζ"
      : key === "eta"
        ? "η"
        : key === "delta"
          ? "δ"
          : key === "epsilon"
            ? "ε"
            : "ρ";

  if (key === "zeta" || key === "eta") return `${greek}:${value as string}`;
  if (key === "delta" || key === "epsilon")
    return `${greek}:${value === "∞" ? "∞" : String(value)}`;
  return `${greek}:${String(value)}`;
}

function serializeParams(operatorId: string, params: TemporalParams | undefined): string {
  const p = normalizeParams(params);
  const parts: string[] = [];

  for (const key of PARAM_ORDER) {
    const v = p[key];
    if (v === undefined) continue;
    if (shouldOmitParam(operatorId, key, v)) continue;
    parts.push(serializeParamKV(key, v));
  }

  if (parts.length === 0) return "";
  return ` (${parts.join(", ")})`;
}

function escapeAtom(v: unknown): string {
  if (typeof v === "string") {
    const safe = /^[A-Za-z_][A-Za-z0-9_:-]*$/.test(v);
    return safe ? v : JSON.stringify(v);
  }
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v == null) return "null";
  return stableJson(v);
}

function stableJson(v: unknown): string {
  const seen = new WeakSet<object>();

  const recur = (x: unknown): unknown => {
    if (!isRecord(x)) {
      if (Array.isArray(x)) return x.map(recur);
      return x;
    }
    if (seen.has(x as object)) return "[Circular]";
    seen.add(x as object);
    const keys = Object.keys(x).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = recur((x as Record<string, unknown>)[k]);
    return out;
  };

  return JSON.stringify(recur(v));
}

function serializePredicateCall(call: PredicateCall | undefined): string {
  if (!call) return "UNKNOWN()";
  const args = asArray<unknown>(call.args);
  return `${call.name}(${args.map(escapeAtom).join(", ")})`;
}

function coerceBaseOperatorId(operatorId: string): string {
  const base = new Set(["Bef", "Aft", "LOJ", "ROJ", "DJ", "RDJ", "SP", "EF", "Eq"]);
  return base.has(operatorId) ? operatorId : operatorId;
}

function serializeConstraint(c: Constraint): string {
  const op = coerceBaseOperatorId(c.operatorId);
  const params = serializeParams(op, c.params);

  const extras: string[] = [];
  if (c.cardinality !== undefined) extras.push(`cardinality=${stableJson(c.cardinality)}`);
  if (c.overlapPercentage !== undefined) extras.push(`overlap=${stableJson(c.overlapPercentage)}`);
  if (c.robustness !== undefined) extras.push(`robustness=${stableJson(c.robustness)}`);

  const extrasStr = extras.length ? ` [${extras.join(", ")}]` : "";
  return `@${c.leftIntervalId} ${op}${params} @${c.rightIntervalId}${extrasStr}`;
}

function pickConstraintsInExpression(model: EventModelLike, all: Constraint[]): Constraint[] {
  const te = model.temporalExpression;
  if (!isRecord(te)) return stableSortById(all);

  const ids = Array.isArray(te.constraintIds) ? te.constraintIds : undefined;
  if (!ids || ids.length === 0) return stableSortById(all);

  const map = new Map(all.map((c) => [c.id, c]));
  const picked: Constraint[] = [];
  for (const id of ids) {
    const c = map.get(id);
    if (c) picked.push(c);
  }

  const seen = new Set<string>();
  return picked.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

/**
 * Main entry
 */
export function serializeEventModel(resolvedModel: unknown): string {
  const m = (resolvedModel ?? {}) as EventModelLike;

  const intervals = stableSortById(asArray<IntervalInstance>(m.intervals));
  const constraintsAll =
    asArray<Constraint>(m.constraints).length > 0
      ? asArray<Constraint>(m.constraints)
      : asArray<Constraint>(m.constraintSet?.constraints);

  const constraints = pickConstraintsInExpression(m, constraintsAll);

  const headerName = (m.name ?? m.id ?? "EVENT_MODEL") as string;

  const lines: string[] = [];
  lines.push(`# ${headerName}`);
  lines.push(`# intervals: ${intervals.length}, relations: ${constraints.length}`);
  lines.push("");

  lines.push("INTERVALS");
  for (const it of intervals) {
    lines.push(`@${it.id}: ${serializePredicateCall(it.predicate)}`);
  }

  lines.push("");
  lines.push("RELATIONS");
  for (const c of constraints) {
    lines.push(serializeConstraint(c));
  }

  return `${lines.join("\n")}\n`;
}
