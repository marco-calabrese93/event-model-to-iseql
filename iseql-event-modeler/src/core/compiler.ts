import { ZodError } from "zod";

import type { EventModel } from "./model";
import { EventModelSchema } from "./schema";
import { resolveEventModel } from "./resolver";
import { serializeEventModel } from "./serializer";
import { validateModel } from "./validator";

export type CompilerIssueSeverity = "error" | "warning";

export type CompilerIssue = {
  code: string;
  severity: CompilerIssueSeverity;
  path: string;
  message: string;
};

export type CompilerOutput = {
  iseql: string | null;
  resolvedModel: unknown | null;
  explain: unknown[];
  errors: CompilerIssue[];
  warnings: CompilerIssue[];
};

type JsonObject = Record<string, unknown>;

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasOwn(obj: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function stableSortIssues(a: CompilerIssue, b: CompilerIssue) {
  const ak = `${a.path}|${a.code}|${a.message}`;
  const bk = `${b.path}|${b.code}|${b.message}`;
  return ak.localeCompare(bk);
}

// Zod issue.path è PropertyKey[] (può includere symbol)
function zodPath(path: ReadonlyArray<PropertyKey>): string {
  if (path.length === 0) return "";
  let out = "";
  for (const seg of path) {
    if (typeof seg === "number") out += `[${seg}]`;
    else {
      const s = typeof seg === "symbol" ? (seg.description ?? "symbol") : String(seg);
      out += out === "" ? s : `.${s}`;
    }
  }
  return out;
}

function toZodIssues(err: ZodError): CompilerIssue[] {
  return err.issues.map((i) => ({
    code: `ZOD_${String(i.code).toUpperCase()}`,
    severity: "error" as const,
    path: zodPath(i.path),
    message: i.message,
  }));
}

function dedupeIssues(issues: CompilerIssue[]): CompilerIssue[] {
  const seen = new Set<string>();
  const out: CompilerIssue[] = [];
  for (const it of issues) {
    const k = `${it.severity}|${it.code}|${it.path}|${it.message}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

/**
 * Adapter:
 * schema.ts -> pipeline shape per validator/resolver/serializer
 *
 * schema.ts:
 *   constraints: { temporal: [{ operatorKey, ... }], extra: [...] }
 *
 * pipeline:
 *   expressions[] (operatorId) per validator/resolver
 *   constraintsRel[] per serializer (relazioni temporali)
 */
function adaptSchemaModelToPipelineModel(model: unknown): unknown {
  if (!isObject(model)) return model;

  const constraintsRaw = model.constraints;
  const constraintsObj = isObject(constraintsRaw) ? constraintsRaw : {};

  const temporalRaw = constraintsObj.temporal;
  const extraRaw = constraintsObj.extra;

  const temporalArr = Array.isArray(temporalRaw) ? temporalRaw : [];
  const extraArr = Array.isArray(extraRaw) ? extraRaw : [];

  const expressions = temporalArr
    .map((t) => (isObject(t) ? t : null))
    .filter((t): t is JsonObject => t !== null)
    .map((t) => {
      const out: JsonObject = {
        id: t.id,
        leftIntervalId: t.leftIntervalId,
        rightIntervalId: t.rightIntervalId,
        operatorId: t.operatorKey,
        constraintIds: t.constraintIds,
      };

      // params considerato presente solo se la key esiste e value !== undefined
      if (hasOwn(t, "params") && t.params !== undefined) {
        out.params = t.params;
      }

      return out;
    });

  const constraintsRel = expressions.map((e) => {
    const out: JsonObject = {
      id: e.id,
      leftIntervalId: e.leftIntervalId,
      rightIntervalId: e.rightIntervalId,
      operatorId: e.operatorId,
    };
    if (hasOwn(e, "params") && e.params !== undefined) out.params = e.params;
    return out;
  });

  const pipelineModel: JsonObject = {
    ...model,
    expressions,
    constraints: extraArr, // extra constraints (non temporali) per legacy validator
    constraintsRel, // relazioni temporali per serializer
  };

  return pipelineModel;
}

/**
 * W004 — Missing params (non bloccante)
 * Calcolo deterministico sulla SHAPE DI SCHEMA:
 *   parsed.constraints.temporal[i].params
 *
 * Missing se:
 * - key "params" non esiste (delete nel test)
 * - oppure undefined/null
 */
function computeMissingParamsWarningsFromParsedSchema(parsed: unknown): CompilerIssue[] {
  if (!isObject(parsed)) return [];

  const constraintsRaw = parsed.constraints;
  const constraintsObj = isObject(constraintsRaw) ? constraintsRaw : {};
  const temporalRaw = constraintsObj.temporal;

  if (!Array.isArray(temporalRaw)) return [];

  const warnings: CompilerIssue[] = [];

  for (let i = 0; i < temporalRaw.length; i++) {
    const t = temporalRaw[i];
    if (!isObject(t)) continue;

    const hasKey = hasOwn(t, "params");
    const val = t.params;
    const missing = !hasKey || val === undefined || val === null;
    if (!missing) continue;

    const id = typeof t.id === "string" ? t.id : "?";
    warnings.push({
      code: "W004_MISSING_PARAMS",
      severity: "warning" as const,
      path: `$.constraints.temporal[${i}].params`,
      message: `Missing params for expression '${id}' (resolver will fill defaults)`,
    });
  }

  return warnings;
}

/**
 * M4.4 — Compiler orchestrator
 * 1) Zod parse (strict)
 * 2) validator (semantic/UX)
 * 3) resolver
 * 4) serializer
 *
 * Regola: con errori bloccanti => iseql=null
 */
export function compileEventModel(input: EventModel): CompilerOutput {
  // 1) Zod strict parse
  let parsed: unknown;
  try {
    parsed = EventModelSchema.parse(input);
  } catch (e) {
    if (e instanceof ZodError) {
      const errors = toZodIssues(e).sort(stableSortIssues);
      return { iseql: null, resolvedModel: null, explain: [], errors, warnings: [] };
    }
    return {
      iseql: null,
      resolvedModel: null,
      explain: [],
      errors: [
        {
          code: "ZOD_UNKNOWN_ERROR",
          severity: "error",
          path: "",
          message: e instanceof Error ? e.message : "Unknown error",
        },
      ],
      warnings: [],
    };
  }

  // ✅ W004 calcolato su parsed schema-shape
  const missingWarnings = computeMissingParamsWarningsFromParsedSchema(parsed);

  // 2) Adapt shape
  const pipelineModel = adaptSchemaModelToPipelineModel(parsed);

  // 3) validator (shape-tolerant)
  const v = validateModel(pipelineModel);

  const errors: CompilerIssue[] = (v.errors ?? [])
    .map((it) => ({
      code: it.code,
      severity: "error" as const,
      path: it.path,
      message: it.message,
    }))
    .sort(stableSortIssues);

  const validatorWarnings: CompilerIssue[] = (v.warnings ?? [])
    .map((it) => ({
      code: it.code,
      severity: "warning" as const,
      path: it.path,
      message: it.message,
    }))
    .sort(stableSortIssues);

  const warnings = dedupeIssues([...validatorWarnings, ...missingWarnings]).sort(stableSortIssues);

  // Blocca export se errors
  if (errors.length > 0) {
    return { iseql: null, resolvedModel: null, explain: [], errors, warnings };
  }

  // 4) resolver
  const r = resolveEventModel(pipelineModel as unknown as Parameters<typeof resolveEventModel>[0]);

  // 5) serializer: usa constraintsRel come constraints[]
  const modelObj = r.model as unknown;
  const m = isObject(modelObj) ? modelObj : {};

  const constraintsRel = Array.isArray(m.constraintsRel) ? m.constraintsRel : [];
  const serializeInput: JsonObject = { ...m, constraints: constraintsRel };

  const iseql = serializeEventModel(
    serializeInput as unknown as Parameters<typeof serializeEventModel>[0],
  );

  return {
    iseql,
    resolvedModel: r.model,
    explain: Array.isArray(r.explain) ? r.explain : [],
    errors,
    warnings,
  };
}
