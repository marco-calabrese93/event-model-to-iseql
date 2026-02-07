import operatorsCatalog from "./operators.json";

export type ExplainEntry = {
  ruleId: string;
  text: string;
  targetId?: string;
  meta?: Record<string, unknown>;
};

type OperatorEntry = {
  id: string;
  kind: "base" | "alias";
  mapsTo?: unknown;
  params?: {
    defaults?: Record<string, unknown>;
  };
  [key: string]: unknown;
};

type OperatorsCatalog = {
  schemaVersion: string;
  parameterDefaults: Record<string, unknown>;
  operators: OperatorEntry[];
};

type AnyRecord = Record<string, unknown>;

type ParamKey = "zeta" | "eta" | "delta" | "epsilon" | "rho";

const PARAM_KEY_ALIASES: Record<string, ParamKey> = {
  zeta: "zeta",
  eta: "eta",
  delta: "delta",
  epsilon: "epsilon",
  rho: "rho",
  ζ: "zeta",
  η: "eta",
  δ: "delta",
  ε: "epsilon",
  ρ: "rho",
};

const ORDERED_PARAM_KEYS: ParamKey[] = ["zeta", "eta", "delta", "epsilon", "rho"];
const ORDERED_PARAM_KEY_SET = new Set<string>(ORDERED_PARAM_KEYS);

function isObject(v: unknown): v is AnyRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function cloneDeep<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function sortByIdIfPossible(value: unknown): void {
  if (!Array.isArray(value)) return;
  const arr = value as unknown[];
  if (arr.length === 0) return;

  const allHaveId = arr.every((x) => isObject(x) && typeof x.id === "string");
  if (!allHaveId) return;

  arr.sort((a, b) => {
    const ai = (a as AnyRecord).id as string;
    const bi = (b as AnyRecord).id as string;
    return ai.localeCompare(bi);
  });
}

function normalizeParamKeys(input: unknown): Record<string, unknown> {
  if (!isObject(input)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    const mapped = PARAM_KEY_ALIASES[k];
    if (mapped) out[mapped] = v;
    else out[k] = v;
  }
  return out;
}

function buildDeterministicParams(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ORDERED_PARAM_KEYS) {
    if (k in obj) out[k] = obj[k];
  }

  const extras = Object.keys(obj)
    .filter((k) => !ORDERED_PARAM_KEY_SET.has(k))
    .sort();
  for (const k of extras) out[k] = obj[k];

  return out;
}

function getCatalog(): OperatorsCatalog {
  return operatorsCatalog as unknown as OperatorsCatalog;
}

function extractMapsTo(entry: OperatorEntry): string | undefined {
  const directCandidates: unknown[] = [
    entry.mapsTo,
    entry.mapsToOperatorId,
    entry.mapsToId,
    entry.baseOperatorId,
    entry.targetOperatorId,
  ];

  for (const c of directCandidates) {
    if (typeof c === "string") return c;

    if (Array.isArray(c) && c.length > 0) {
      const first = c[0];
      if (typeof first === "string") return first;
      if (isObject(first) && typeof first.id === "string") return first.id as string;
      if (isObject(first) && typeof first.operatorId === "string")
        return first.operatorId as string;
    }

    if (isObject(c)) {
      if (typeof c.id === "string") return c.id as string;
      if (typeof c.operatorId === "string") return c.operatorId as string;
      if (typeof c.opId === "string") return c.opId as string;
      if (typeof c.baseId === "string") return c.baseId as string;
    }
  }

  return undefined;
}

function buildOperatorIndex(catalog: OperatorsCatalog) {
  const byId = new Map<string, OperatorEntry>();
  for (const op of catalog.operators) byId.set(op.id, op);

  const aliasToBase = new Map<string, string>();
  for (const op of catalog.operators) {
    if (op.kind !== "alias") continue;
    const base = extractMapsTo(op);
    if (typeof base === "string" && base.length > 0) {
      aliasToBase.set(op.id, base);
    }
  }

  return { byId, aliasToBase };
}

function resolveOperatorId(
  operatorId: string,
  aliasToBase: Map<string, string>,
  explain: ExplainEntry[],
  targetId?: string,
): string {
  const mapped = aliasToBase.get(operatorId);
  if (!mapped) return operatorId;

  explain.push({
    ruleId: "R-OP-ALIAS-TO-BASE",
    text: `Normalized operatorId alias '${operatorId}' → base '${mapped}' using operators.json mapping.`,
    targetId,
    meta: { from: operatorId, to: mapped },
  });

  return mapped;
}

function resolveParamsForOperator(
  operatorId: string,
  currentParams: unknown,
  catalog: OperatorsCatalog,
  byId: Map<string, OperatorEntry>,
  explain: ExplainEntry[],
  targetId?: string,
): Record<string, unknown> {
  const globalDefaults = normalizeParamKeys(catalog.parameterDefaults ?? {});
  const opDefaultsRaw = byId.get(operatorId)?.params?.defaults ?? {};
  const opDefaults = normalizeParamKeys(opDefaultsRaw);
  const userParams = normalizeParamKeys(currentParams);

  const merged: Record<string, unknown> = {
    ...globalDefaults,
    ...opDefaults,
    ...userParams,
  };

  const hadAny = isObject(currentParams) && Object.keys(currentParams).length > 0;
  const missingKeys = ORDERED_PARAM_KEYS.filter((k) => !(k in userParams));

  if (!hadAny) {
    explain.push({
      ruleId: "R-PARAM-DEFAULTS-ALL",
      text: `Applied default TemporalParams for operator '${operatorId}' (global + per-operator).`,
      targetId,
      meta: { operatorId },
    });
  } else if (missingKeys.length > 0) {
    explain.push({
      ruleId: "R-PARAM-DEFAULTS-MISSING",
      text: `Completed missing TemporalParams keys [${missingKeys.join(
        ", ",
      )}] for operator '${operatorId}' (global + per-operator).`,
      targetId,
      meta: { operatorId, missingKeys },
    });
  }

  return buildDeterministicParams(merged);
}

function traverseAndResolve(
  node: unknown,
  catalog: OperatorsCatalog,
  byId: Map<string, OperatorEntry>,
  aliasToBase: Map<string, string>,
  explain: ExplainEntry[],
): unknown {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      node[i] = traverseAndResolve(node[i], catalog, byId, aliasToBase, explain);
    }
    sortByIdIfPossible(node);
    return node;
  }

  if (!isObject(node)) return node;

  const out = node as AnyRecord;
  const targetId = typeof out.id === "string" ? (out.id as string) : undefined;

  if (typeof out.operatorId === "string") {
    const original = out.operatorId as string;
    const normalized = resolveOperatorId(original, aliasToBase, explain, targetId);
    out.operatorId = normalized;

    // ✅ FIX: se non esistono params/temporalParams, creiamo sempre "params"
    const chosenKey =
      "params" in out ? "params" : "temporalParams" in out ? "temporalParams" : "params";

    // se stiamo creando "params" da zero, assicuriamo la presenza della chiave prima del resolve
    if (!(chosenKey in out)) out[chosenKey] = undefined;

    const resolvedParams = resolveParamsForOperator(
      normalized,
      out[chosenKey],
      catalog,
      byId,
      explain,
      targetId,
    );

    // ✅ Normalizziamo sempre su "params" (deterministico e UI-friendly)
    out.params = resolvedParams;
    if (chosenKey === "temporalParams") delete out.temporalParams;
  }

  for (const k of Object.keys(out)) {
    out[k] = traverseAndResolve(out[k], catalog, byId, aliasToBase, explain);
  }

  return out;
}

export function resolveEventModel<T extends object>(
  model: T,
): { model: T; explain: ExplainEntry[] } {
  const catalog = getCatalog();
  const { byId, aliasToBase } = buildOperatorIndex(catalog);

  const explain: ExplainEntry[] = [];
  const cloned = cloneDeep(model);

  const resolved = traverseAndResolve(cloned, catalog, byId, aliasToBase, explain) as T;

  explain.sort((a, b) => {
    const ta = a.targetId ?? "";
    const tb = b.targetId ?? "";
    const c1 = ta.localeCompare(tb);
    if (c1 !== 0) return c1;
    const c2 = a.ruleId.localeCompare(b.ruleId);
    if (c2 !== 0) return c2;
    return (a.text ?? "").localeCompare(b.text ?? "");
  });

  return { model: resolved, explain };
}
