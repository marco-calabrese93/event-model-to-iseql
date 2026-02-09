// src/core/timeline.ts
// Deterministic helpers for timeline interval operations (create/move/resize).
// Invariants:
// - ticks are treated as integers (normalized with Math.round)
// - start <= end always
// - optional bounds: [minTick, maxTick]
// - move preserves duration when possible; if duration cannot fit into bounds, it clamps to the full bounds.

export type Tick = number;

export type TimelineBounds = Readonly<{
  minTick?: Tick;
  maxTick?: Tick;
}>;

type WithStartEnd = Readonly<{
  start: Tick;
  end: Tick;
}>;

function normalizeTick(t: Tick): Tick {
  // Deterministic integer normalization (UI may provide floats).
  // Math.round keeps behavior stable across positive/negative.
  return Math.round(t);
}

function clampTick(t: Tick, minTick: Tick, maxTick: Tick): Tick {
  if (t < minTick) return minTick;
  if (t > maxTick) return maxTick;
  return t;
}

function boundsOrDefault(bounds?: TimelineBounds): Required<TimelineBounds> {
  const minTick = bounds?.minTick ?? 0;
  const maxTick = bounds?.maxTick ?? Number.POSITIVE_INFINITY;
  return { minTick, maxTick };
}

function normalizeStartEnd(start: Tick, end: Tick): { start: Tick; end: Tick } {
  const s = normalizeTick(start);
  const e = normalizeTick(end);
  return s <= e ? { start: s, end: e } : { start: e, end: s };
}

function clampStartEndToBounds(
  start: Tick,
  end: Tick,
  bounds?: TimelineBounds,
): { start: Tick; end: Tick } {
  const { minTick, maxTick } = boundsOrDefault(bounds);

  // Normalize first, then clamp.
  const norm = normalizeStartEnd(start, end);
  const s = clampTick(norm.start, minTick, maxTick);
  const e = clampTick(norm.end, minTick, maxTick);

  // If clamping inverted them (possible when both outside and crossing), re-normalize.
  return s <= e ? { start: s, end: e } : { start: e, end: s };
}

/**
 * Create a new interval from endpoints.
 * - normalizes ticks to integers
 * - swaps endpoints if needed
 * - clamps to bounds (defaults to min=0, max=+∞)
 */
export function createInterval(
  start: Tick,
  end: Tick,
  bounds?: TimelineBounds,
): {
  start: Tick;
  end: Tick;
} {
  return clampStartEndToBounds(start, end, bounds);
}

/**
 * Move an interval by delta ticks.
 * - preserves duration (end-start)
 * - clamps to bounds; if clamped at an edge, shifts both endpoints to keep duration
 * - if duration cannot fit within bounds, returns [minTick, maxTick]
 */
export function moveInterval<T extends WithStartEnd>(
  interval: T,
  delta: Tick,
  bounds?: TimelineBounds,
): T {
  const { minTick, maxTick } = boundsOrDefault(bounds);

  const start0 = normalizeTick(interval.start);
  const end0 = normalizeTick(interval.end);
  const start = Math.min(start0, end0);
  const end = Math.max(start0, end0);

  const duration = end - start;

  // If bounds are finite and duration doesn't fit, clamp to full bounds.
  if (Number.isFinite(maxTick) && duration > maxTick - minTick) {
    return { ...(interval as object), start: minTick, end: maxTick } as T;
  }

  const d = normalizeTick(delta);

  let movedStart = start + d;
  let movedEnd = movedStart + duration;

  // Clamp by shifting as a block to preserve duration.
  if (movedStart < minTick) {
    movedStart = minTick;
    movedEnd = movedStart + duration;
  }
  if (movedEnd > maxTick) {
    movedEnd = maxTick;
    movedStart = movedEnd - duration;
  }

  // Final safety clamp (handles infinite maxTick etc.)
  movedStart = clampTick(movedStart, minTick, maxTick);
  movedEnd = clampTick(movedEnd, minTick, maxTick);

  // Ensure invariant.
  const normalized =
    movedStart <= movedEnd
      ? { start: movedStart, end: movedEnd }
      : { start: movedEnd, end: movedStart };

  return { ...(interval as object), ...normalized } as T;
}

/**
 * Resize the start (left handle).
 * - clamps to bounds
 * - prevents inversion: start is never set > end
 */
export function resizeStart<T extends WithStartEnd>(
  interval: T,
  newStart: Tick,
  bounds?: TimelineBounds,
): T {
  const { minTick, maxTick } = boundsOrDefault(bounds);

  const start0 = normalizeTick(interval.start);
  const end0 = normalizeTick(interval.end);
  // We only need the normalized "end" here.
  const end = Math.max(start0, end0);

  let s = clampTick(normalizeTick(newStart), minTick, maxTick);
  // Prevent inversion
  if (s > end) s = end;

  return { ...(interval as object), start: s, end } as T;
}

/**
 * Resize the end (right handle).
 * - clamps to bounds
 * - prevents inversion: end is never set < start
 */
export function resizeEnd<T extends WithStartEnd>(
  interval: T,
  newEnd: Tick,
  bounds?: TimelineBounds,
): T {
  const { minTick, maxTick } = boundsOrDefault(bounds);

  const start0 = normalizeTick(interval.start);
  const end0 = normalizeTick(interval.end);
  // We only need the normalized "start" here.
  const start = Math.min(start0, end0);

  let e = clampTick(normalizeTick(newEnd), minTick, maxTick);
  // Prevent inversion
  if (e < start) e = start;

  return { ...(interval as object), start, end: e } as T;
}

/**
 * Generic resize (edge = "start" | "end").
 */
export function resizeInterval<T extends WithStartEnd>(
  interval: T,
  edge: "start" | "end",
  newTick: Tick,
  bounds?: TimelineBounds,
): T {
  return edge === "start"
    ? resizeStart(interval, newTick, bounds)
    : resizeEnd(interval, newTick, bounds);
}
