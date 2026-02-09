// src/ui/store/eventModelStore.ts
import { create } from "zustand";
import type { StateCreator } from "zustand";

import operatorsCatalog from "@/core/operators.json";
import {
  createInterval as coreCreateInterval,
  moveInterval as coreMoveInterval,
  resizeStart as coreResizeIntervalStart,
  resizeEnd as coreResizeIntervalEnd,
} from "@/core/timeline";

/**
 * Store (SSOT UI) — interval-centric
 * - Intervals (tick abstract) + predicate labels
 * - Constraints between intervals with operatorId + editable params
 *
 * NOTE: il core compiler (M4.4) usa un EventModel AST; qui manteniamo un modello UI semplice.
 */

// Evita coupling su type export non presenti nel core: deduciamo il tipo dal parametro 3 di createInterval.
export type IntervalBounds = Parameters<typeof coreCreateInterval>[2];

export type PredicateLabel = {
  name: string;
  args: string[];
};

// UI may provide ASCII comparators (<=, >=); we normalize them to unicode (≤, ≥).
export type Comparator = "<" | "≤" | "=" | "≥" | ">" | "<=" | ">=";
export type Threshold = number | "∞";

export type TemporalParams = {
  zeta: Comparator;
  eta: Comparator;
  delta: Threshold;
  epsilon: Threshold;
  rho: number;
};

export type UiInterval = {
  id: string;
  start: number;
  end: number;
  predicate?: PredicateLabel | null;
};

export type UiConstraint = {
  id: string;
  leftIntervalId: string;
  rightIntervalId: string;
  operatorId: string; // es. "Bef", "DJ", "Allen.Meets", ecc.
  params: TemporalParams;
};

export type UiEventModel = {
  schemaVersion: string;
  intervals: UiInterval[];
  constraints: UiConstraint[];
};

export type EventModelStoreState = {
  model: UiEventModel;

  // contatori deterministici per ids
  nextIntervalSeq: number;
  nextConstraintSeq: number;

  actions: {
    reset: () => void;

    createInterval: (start: number, end: number, bounds?: IntervalBounds) => string;

    moveInterval: (intervalId: string, delta: number, bounds?: IntervalBounds) => void;

    resizeIntervalStart: (intervalId: string, newStart: number, bounds?: IntervalBounds) => void;

    resizeIntervalEnd: (intervalId: string, newEnd: number, bounds?: IntervalBounds) => void;

    // M7.3
    setPredicate: (intervalId: string, name: string, args?: string[]) => void;
    clearPredicate: (intervalId: string) => void;

    // M8.1
    addConstraint: (input: {
      leftIntervalId: string;
      rightIntervalId: string;
      operatorId: string;
    }) => string;

    setOperator: (constraintId: string, operatorId: string) => void;

    /**
     * Update a single temporal parameter on a constraint.
     *
     * NOTE: intentionally non-generic.
     * A generic `<K extends keyof TemporalParams>` makes assignments like `nextParams[key] = ...`
     * problematic because narrowing a generic key via runtime checks does not refine `K`.
     */
    setParam: (
      constraintId: string,
      key: keyof TemporalParams,
      value: Comparator | Threshold | number,
    ) => void;
  };
};

function pad4(n: number): string {
  const s = String(n);
  return s.length >= 4 ? s : "0".repeat(4 - s.length) + s;
}

function makeIntervalId(seq: number): string {
  return `interval_${pad4(seq)}`;
}

function makeConstraintId(seq: number): string {
  return `constraint_${pad4(seq)}`;
}

export const DEFAULT_SCHEMA_VERSION = "1.0";

export function createEmptyModel(): UiEventModel {
  return {
    schemaVersion: DEFAULT_SCHEMA_VERSION,
    intervals: [],
    constraints: [],
  };
}

// ---------- Operators catalog helpers ----------

type OperatorBaseEntry = {
  kind: "operator";
  id: string;
  code: string;
  label?: string;
  arity: number;
  parameters?: {
    supported?: readonly string[];
    defaults?: Partial<TemporalParams>;
  };
};

type OperatorAliasEntry = {
  kind: "alias";
  id: string;
  code: string;
  label?: string;
  arity: number;
  mapsTo?: {
    operatorId: string;
    fixed?: Partial<TemporalParams>;
  };
};

type OperatorEntry = OperatorBaseEntry | OperatorAliasEntry;

type OperatorsCatalog = {
  parameterDefaults: TemporalParams;
  operators: OperatorEntry[];
};

function isOperator(entry: OperatorEntry): entry is OperatorBaseEntry {
  return entry.kind === "operator";
}

function isAlias(entry: OperatorEntry): entry is OperatorAliasEntry {
  return entry.kind === "alias";
}

function getEntryByCode(code: string): OperatorEntry | undefined {
  const cat = operatorsCatalog as unknown as OperatorsCatalog;
  return (cat.operators ?? []).find((o) => o.code === code);
}

function getGlobalDefaults(): TemporalParams {
  const cat = operatorsCatalog as unknown as OperatorsCatalog;
  return (
    cat.parameterDefaults ?? {
      zeta: "≤",
      eta: "≤",
      delta: "∞",
      epsilon: "∞",
      rho: 0,
    }
  );
}

export function normalizeComparator(raw: string): Comparator {
  const trimmed = raw.trim();
  if (trimmed === "<=") return "≤";
  if (trimmed === ">=") return "≥";

  if (trimmed === "<" || trimmed === "≤" || trimmed === "=" || trimmed === "≥" || trimmed === ">") {
    return trimmed;
  }

  return "≤";
}

function normalizeThreshold(v: Threshold): Threshold {
  if (v === "∞") return "∞";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function normalizeRho(v: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function normalizeParams(p: TemporalParams): TemporalParams {
  return {
    zeta: normalizeComparator(String(p.zeta)),
    eta: normalizeComparator(String(p.eta)),
    delta: normalizeThreshold(p.delta),
    epsilon: normalizeThreshold(p.epsilon),
    rho: normalizeRho(p.rho),
  };
}

function buildDefaultParamsForOperator(operatorCode: string): TemporalParams {
  const global = getGlobalDefaults();
  const entry = getEntryByCode(operatorCode);

  const base: TemporalParams = { ...global };

  // per-operator defaults (SOLO per kind="operator")
  if (entry && isOperator(entry) && entry.parameters?.defaults) {
    const d = entry.parameters.defaults;
    if (d.zeta !== undefined) base.zeta = normalizeComparator(String(d.zeta));
    if (d.eta !== undefined) base.eta = normalizeComparator(String(d.eta));
    if (d.delta !== undefined) base.delta = normalizeThreshold(d.delta as Threshold);
    if (d.epsilon !== undefined) base.epsilon = normalizeThreshold(d.epsilon as Threshold);
    if (d.rho !== undefined) base.rho = normalizeRho(d.rho);
  }

  // alias fixed params win
  if (entry && isAlias(entry) && entry.mapsTo?.fixed) {
    const f = entry.mapsTo.fixed;
    if (f.zeta !== undefined) base.zeta = normalizeComparator(String(f.zeta));
    if (f.eta !== undefined) base.eta = normalizeComparator(String(f.eta));
    if (f.delta !== undefined) base.delta = normalizeThreshold(f.delta as Threshold);
    if (f.epsilon !== undefined) base.epsilon = normalizeThreshold(f.epsilon as Threshold);
    if (f.rho !== undefined) base.rho = normalizeRho(f.rho);
  }

  return normalizeParams(base);
}

function applyOperatorChangePreservingParams(
  prev: TemporalParams,
  nextOperatorCode: string,
): TemporalParams {
  // preserva quanto possibile, ma applica fixed se alias
  const next: TemporalParams = normalizeParams({ ...getGlobalDefaults(), ...prev });

  const entry = getEntryByCode(nextOperatorCode);

  if (entry && isAlias(entry) && entry.mapsTo?.fixed) {
    const f = entry.mapsTo.fixed;
    if (f.zeta !== undefined) next.zeta = normalizeComparator(String(f.zeta));
    if (f.eta !== undefined) next.eta = normalizeComparator(String(f.eta));
    if (f.delta !== undefined) next.delta = normalizeThreshold(f.delta as Threshold);
    if (f.epsilon !== undefined) next.epsilon = normalizeThreshold(f.epsilon as Threshold);
    if (f.rho !== undefined) next.rho = normalizeRho(f.rho);
  }

  return normalizeParams(next);
}

// ---------- Store ----------

const creator: StateCreator<EventModelStoreState> = (set, get) => ({
  model: createEmptyModel(),
  nextIntervalSeq: 1,
  nextConstraintSeq: 1,

  actions: {
    reset: () => {
      set({
        model: createEmptyModel(),
        nextIntervalSeq: 1,
        nextConstraintSeq: 1,
      });
    },

    createInterval: (start: number, end: number, bounds?: IntervalBounds) => {
      const { nextIntervalSeq, model } = get();
      const id = makeIntervalId(nextIntervalSeq);

      const interval = coreCreateInterval(start, end, bounds);

      const next: UiInterval = {
        id,
        start: interval.start,
        end: interval.end,
        predicate: null,
      };

      set({
        model: {
          ...model,
          intervals: [...model.intervals, next].sort((a, b) => a.id.localeCompare(b.id)),
        },
        nextIntervalSeq: nextIntervalSeq + 1,
      });

      return id;
    },

    moveInterval: (intervalId: string, delta: number, bounds?: IntervalBounds) => {
      const { model } = get();
      const idx = model.intervals.findIndex((x) => x.id === intervalId);
      if (idx < 0) return;

      const current = model.intervals[idx];
      const moved = coreMoveInterval({ start: current.start, end: current.end }, delta, bounds);

      const updated: UiInterval = { ...current, start: moved.start, end: moved.end };

      const nextIntervals = model.intervals.slice();
      nextIntervals[idx] = updated;

      set({
        model: {
          ...model,
          intervals: nextIntervals.sort((a, b) => a.id.localeCompare(b.id)),
        },
      });
    },

    resizeIntervalStart: (intervalId: string, newStart: number, bounds?: IntervalBounds) => {
      const { model } = get();
      const idx = model.intervals.findIndex((x) => x.id === intervalId);
      if (idx < 0) return;

      const current = model.intervals[idx];
      const resized = coreResizeIntervalStart(
        { start: current.start, end: current.end },
        newStart,
        bounds,
      );

      const updated: UiInterval = { ...current, start: resized.start, end: resized.end };

      const nextIntervals = model.intervals.slice();
      nextIntervals[idx] = updated;

      set({
        model: {
          ...model,
          intervals: nextIntervals.sort((a, b) => a.id.localeCompare(b.id)),
        },
      });
    },

    resizeIntervalEnd: (intervalId: string, newEnd: number, bounds?: IntervalBounds) => {
      const { model } = get();
      const idx = model.intervals.findIndex((x) => x.id === intervalId);
      if (idx < 0) return;

      const current = model.intervals[idx];
      const resized = coreResizeIntervalEnd(
        { start: current.start, end: current.end },
        newEnd,
        bounds,
      );

      const updated: UiInterval = { ...current, start: resized.start, end: resized.end };

      const nextIntervals = model.intervals.slice();
      nextIntervals[idx] = updated;

      set({
        model: {
          ...model,
          intervals: nextIntervals.sort((a, b) => a.id.localeCompare(b.id)),
        },
      });
    },

    setPredicate: (intervalId: string, name: string, args?: string[]) => {
      const { model } = get();
      const idx = model.intervals.findIndex((x) => x.id === intervalId);
      if (idx < 0) return;

      const current = model.intervals[idx];
      const updated: UiInterval = {
        ...current,
        predicate: { name, args: args ?? [] },
      };

      const nextIntervals = model.intervals.slice();
      nextIntervals[idx] = updated;

      set({
        model: {
          ...model,
          intervals: nextIntervals.sort((a, b) => a.id.localeCompare(b.id)),
        },
      });
    },

    clearPredicate: (intervalId: string) => {
      const { model } = get();
      const idx = model.intervals.findIndex((x) => x.id === intervalId);
      if (idx < 0) return;

      const current = model.intervals[idx];
      const updated: UiInterval = { ...current, predicate: null };

      const nextIntervals = model.intervals.slice();
      nextIntervals[idx] = updated;

      set({
        model: {
          ...model,
          intervals: nextIntervals.sort((a, b) => a.id.localeCompare(b.id)),
        },
      });
    },

    addConstraint: (input: {
      leftIntervalId: string;
      rightIntervalId: string;
      operatorId: string;
    }) => {
      const { model, nextConstraintSeq } = get();
      const id = makeConstraintId(nextConstraintSeq);

      const params = buildDefaultParamsForOperator(input.operatorId);

      const next: UiConstraint = {
        id,
        leftIntervalId: input.leftIntervalId,
        rightIntervalId: input.rightIntervalId,
        operatorId: input.operatorId,
        params,
      };

      set({
        model: {
          ...model,
          constraints: [...model.constraints, next].sort((a, b) => a.id.localeCompare(b.id)),
        },
        nextConstraintSeq: nextConstraintSeq + 1,
      });

      return id;
    },

    setOperator: (constraintId: string, operatorId: string) => {
      const { model } = get();
      const idx = model.constraints.findIndex((x) => x.id === constraintId);
      if (idx < 0) return;

      const current = model.constraints[idx];
      const nextParams = applyOperatorChangePreservingParams(current.params, operatorId);

      const updated: UiConstraint = { ...current, operatorId, params: nextParams };

      const nextConstraints = model.constraints.slice();
      nextConstraints[idx] = updated;

      set({
        model: {
          ...model,
          constraints: nextConstraints.sort((a, b) => a.id.localeCompare(b.id)),
        },
      });
    },

    setParam: (constraintId, key, value) => {
      const { model } = get();
      const idx = model.constraints.findIndex((x) => x.id === constraintId);
      if (idx < 0) return;

      const current = model.constraints[idx];
      const nextParams: TemporalParams = { ...current.params };

      // Avoid indexed assignment to keep TS happy.
      switch (key) {
        case "zeta": {
          nextParams.zeta = normalizeComparator(String(value));
          break;
        }
        case "eta": {
          nextParams.eta = normalizeComparator(String(value));
          break;
        }
        case "delta": {
          nextParams.delta = normalizeThreshold(value as Threshold);
          break;
        }
        case "epsilon": {
          nextParams.epsilon = normalizeThreshold(value as Threshold);
          break;
        }
        case "rho": {
          nextParams.rho = normalizeRho(value as number);
          break;
        }
      }

      const updated: UiConstraint = { ...current, params: normalizeParams(nextParams) };

      const nextConstraints = model.constraints.slice();
      nextConstraints[idx] = updated;

      set({
        model: {
          ...model,
          constraints: nextConstraints.sort((a, b) => a.id.localeCompare(b.id)),
        },
      });
    },
  },
});

export const useEventModelStore = create<EventModelStoreState>(creator);

/**
 * Factory per test: evita coupling tra test e singleton hook.
 */
export function createEventModelStoreForTests() {
  return create<EventModelStoreState>(creator);
}
