// src/ui/components/TimelineEditor/utils.ts

export type TickBounds = Readonly<{
  minTick?: number;
  maxTick?: number;
}>;

export type DragKind = "move" | "resizeStart" | "resizeEnd";

export type TrackGeometry = {
  left: number;
  width: number;
  minTick: number;
  maxTick: number;
};

export type SimpleInterval = Readonly<{
  id: string;
  start: number;
  end: number;
}>;

export function clampTick(tick: number, minTick: number, maxTick: number): number {
  if (tick < minTick) return minTick;
  if (tick > maxTick) return maxTick;
  return tick;
}

/**
 * Converte un clientX in tick (intero) con clamp dentro bounds.
 */
export function clientXToTick(clientX: number, geom: TrackGeometry): number {
  const { left, width, minTick, maxTick } = geom;
  if (width <= 0) return minTick;

  const ratio = (clientX - left) / width;
  const unclamped = minTick + ratio * (maxTick - minTick);
  const rounded = Math.round(unclamped);

  return clampTick(rounded, minTick, maxTick);
}

export function makeBounds(minTick: number, maxTick: number): TickBounds {
  return { minTick, maxTick };
}

export function computeDeltaTicks(grabTick: number, currentTick: number): number {
  return currentTick - grabTick;
}

function resolveBounds(bounds: TickBounds | undefined): { minTick: number; maxTick: number } {
  const minTick = bounds?.minTick ?? 0;
  const maxTick = bounds?.maxTick ?? Number.POSITIVE_INFINITY;
  return { minTick, maxTick };
}

/**
 * Helper puro usato nei test:
 * - move: preserva durata, clamp ai bounds
 * - resizeStart/resizeEnd: clamp e prevenzione inversione (start <= end)
 *
 * NOTA: questo helper NON applica la policy "no overlap" (quella è solo create, M7.1).
 */
export function applyDragToInterval(
  interval: SimpleInterval,
  drag:
    | { kind: "move"; deltaTicks: number }
    | { kind: "resizeStart"; newTick: number }
    | { kind: "resizeEnd"; newTick: number },
  bounds?: TickBounds,
): SimpleInterval {
  const { minTick, maxTick } = resolveBounds(bounds);

  const start0 = Math.round(interval.start);
  const end0 = Math.round(interval.end);

  if (drag.kind === "move") {
    const dur = end0 - start0;
    const delta = Math.round(drag.deltaTicks);

    let start = start0 + delta;
    let end = end0 + delta;

    // clamp preservando durata quando possibile
    if (start < minTick) {
      start = minTick;
      end = start + dur;
    }
    if (end > maxTick) {
      end = maxTick;
      start = end - dur;
    }

    // se bounds troppo stretti (dur > range), clamp deterministico
    if (start < minTick) start = minTick;
    if (end > maxTick) end = maxTick;

    return { ...interval, start, end };
  }

  if (drag.kind === "resizeStart") {
    let start = clampTick(Math.round(drag.newTick), minTick, maxTick);
    const end = clampTick(end0, minTick, maxTick);

    // anti-inversione
    if (start > end) start = end;

    return { ...interval, start, end };
  }

  // resizeEnd
  {
    const start = clampTick(start0, minTick, maxTick);
    let end = clampTick(Math.round(drag.newTick), minTick, maxTick);

    // anti-inversione
    if (end < start) end = start;

    return { ...interval, start, end };
  }
}
