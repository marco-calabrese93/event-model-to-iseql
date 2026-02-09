// src/ui/components/TimelineEditor/TimelineEditor.tsx
import React, { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  useEventModelStore,
  type Comparator,
  type Threshold,
  normalizeComparator,
} from "@/ui/store/eventModelStore";
import operatorsCatalog from "@/core/operators.json";
import {
  clientXToTick,
  computeDeltaTicks,
  makeBounds,
  type DragKind,
  type TickBounds,
  type TrackGeometry,
} from "./utils";

import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";

/**
 * TimelineEditor
 * - M7.1: create interval via drag (no-overlap policy, deterministic)
 * - M7.2: move + resize
 * - M7.3: label editor (predicate + args)
 * - M8.1: expert constraints authoring (pair selection + operator/params)
 */

type UiIntervalLike = { id: string; start: number; end: number };

type DragState =
  | { kind: "idle" }
  | {
      kind: "create";
      startTick: number;
      currentTick: number;
      trackGeom: TrackGeometry;
    }
  | {
      // pending -> se non superi soglia movimento: è un "click" (selezione)
      kind: "pendingMove";
      intervalId: string;
      startClientX: number;
      grabTick: number;
      trackGeom: TrackGeometry;
    }
  | {
      kind: DragKind; // move | resizeStart | resizeEnd
      intervalId: string;
      grabTick: number;
      trackGeom: TrackGeometry;
    };

const DEFAULT_MIN_TICK = 0;
const DEFAULT_MAX_TICK = 100;

// soglie minime per distinguere click vs drag
const CLICK_TO_DRAG_PX = 4;

/**
 * Catalogo predicati MVP (statico).
 * Args: array di stringhe.
 */
type PredicateCatalogEntry = {
  id: string;
  name: string;
  label: string;
  argNames: string[];
};

const PREDICATE_CATALOG: readonly PredicateCatalogEntry[] = [
  { id: "in", name: "in", label: "in(personId)", argNames: ["personId"] },
  {
    id: "hasPkg",
    name: "hasPkg",
    label: "hasPkg(personId, pkgId)",
    argNames: ["personId", "pkgId"],
  },
  {
    id: "insideCar",
    name: "insideCar",
    label: "insideCar(personId, carId)",
    argNames: ["personId", "carId"],
  },
] as const;

function getPredicateEntry(name: string): PredicateCatalogEntry | undefined {
  return PREDICATE_CATALOG.find((p) => p.name === name || p.id === name);
}

function formatPredicateLabel(
  predicate: { name: string; args: string[] } | null | undefined,
): string | null {
  if (!predicate) return null;
  const args = Array.isArray(predicate.args) ? predicate.args : [];
  return `${predicate.name}(${args.join(",")})`;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  // [start,end) overlap
  return aStart < bEnd && bStart < aEnd;
}

function sortByStartThenId(a: UiIntervalLike, b: UiIntervalLike): number {
  if (a.start !== b.start) return a.start - b.start;
  return a.id.localeCompare(b.id);
}

/**
 * Deterministic "no-overlap" placement used on CREATE only (M7.1).
 */
function placeNoOverlap(
  desiredStart: number,
  desiredEnd: number,
  intervals: readonly UiIntervalLike[],
  bounds: { minTick: number; maxTick: number },
  direction: "forward" | "backward",
): { start: number; end: number } | null {
  const minTick = bounds.minTick;
  const maxTick = bounds.maxTick;

  let start = Math.round(desiredStart);
  let end = Math.round(desiredEnd);

  // enforce min duration 1 tick
  if (end === start) end = start + 1;

  // clamp to bounds
  start = Math.max(minTick, Math.min(maxTick, start));
  end = Math.max(minTick, Math.min(maxTick, end));

  // ensure [start,end) has at least 1 tick
  if (end <= start) end = Math.min(maxTick, start + 1);

  const sorted = [...intervals].sort(sortByStartThenId);

  const duration = end - start;

  function collides(cs: number, ce: number): boolean {
    return sorted.some((it) => overlaps(cs, ce, it.start, it.end));
  }

  if (!collides(start, end)) return { start, end };

  if (direction === "forward") {
    let cursor = minTick;

    for (const it of sorted) {
      const gapStart = cursor;
      const gapEnd = it.start;

      if (gapEnd - gapStart >= duration) {
        const cs = gapStart;
        const ce = gapStart + duration;
        if (!collides(cs, ce)) return { start: cs, end: ce };
      }

      cursor = Math.max(cursor, it.end);
    }

    if (maxTick - cursor >= duration) {
      const cs = cursor;
      const ce = cursor + duration;
      if (!collides(cs, ce)) return { start: cs, end: ce };
    }

    return null;
  }

  // backward
  {
    let cursor = maxTick;

    for (const it of [...sorted].reverse()) {
      const gapStart = it.end;
      const gapEnd = cursor;

      if (gapEnd - gapStart >= duration) {
        const ce = gapEnd;
        const cs = gapEnd - duration;
        if (!collides(cs, ce)) return { start: cs, end: ce };
      }

      cursor = Math.min(cursor, it.start);
    }

    if (cursor - minTick >= duration) {
      const ce = cursor;
      const cs = cursor - duration;
      if (!collides(cs, ce)) return { start: cs, end: ce };
    }

    return null;
  }
}

export default function TimelineEditor(): React.ReactElement {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const intervals = useEventModelStore((s) => s.model.intervals);
  const constraints = useEventModelStore((s) => s.model.constraints);

  const createIntervalAction = useEventModelStore((s) => s.actions.createInterval);
  const moveIntervalAction = useEventModelStore((s) => s.actions.moveInterval);
  const resizeIntervalStartAction = useEventModelStore((s) => s.actions.resizeIntervalStart);
  const resizeIntervalEndAction = useEventModelStore((s) => s.actions.resizeIntervalEnd);

  // M7.3
  const setPredicateAction = useEventModelStore((s) => s.actions.setPredicate);
  const clearPredicateAction = useEventModelStore((s) => s.actions.clearPredicate);

  // M8.1
  const addConstraintAction = useEventModelStore((s) => s.actions.addConstraint);
  const setOperatorAction = useEventModelStore((s) => s.actions.setOperator);
  const setParamAction = useEventModelStore((s) => s.actions.setParam);

  const minTick = DEFAULT_MIN_TICK;
  const maxTick = DEFAULT_MAX_TICK;

  const bounds: TickBounds = useMemo(() => makeBounds(minTick, maxTick), [minTick, maxTick]);

  const [drag, setDrag] = useState<DragState>({ kind: "idle" });

  // Selection (M7.3, M8.1):
  // - selectedIntervalIds[0] = primary selection (label editor)
  // - when length==2 => pair selection (constraint authoring)
  const [selectedIntervalIds, setSelectedIntervalIds] = useState<readonly string[]>([]);
  const primaryIntervalId = selectedIntervalIds[0] ?? null;
  const secondaryIntervalId = selectedIntervalIds.length > 1 ? selectedIntervalIds[1] : null;

  const selectedInterval = useMemo(() => {
    if (!primaryIntervalId) return null;
    return intervals.find((it) => it.id === primaryIntervalId) ?? null;
  }, [intervals, primaryIntervalId]);

  function toggleSelectInterval(id: string) {
    setSelectedIntervalIds((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((x) => x !== id);
      if (prev.length === 0) return [id];
      if (prev.length === 1) return prev[0] === id ? prev : [prev[0], id];
      return [id];
    });
  }

  function getTrackGeometry(): TrackGeometry | null {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      left: rect.left,
      width: rect.width,
      minTick,
      maxTick,
    };
  }

  function tickToPct(tick: number): number {
    const span = maxTick - minTick;
    if (span <= 0) return 0;
    return ((tick - minTick) / span) * 100;
  }

  function captureOnTrack(pointerId: number) {
    const el = trackRef.current;
    if (!el) return;
    try {
      el.setPointerCapture(pointerId);
    } catch {
      // ignore
    }
  }

  function releaseOnTrack(pointerId: number) {
    const el = trackRef.current;
    if (!el) return;
    try {
      el.releasePointerCapture(pointerId);
    } catch {
      // ignore
    }
  }

  // ---- CREATE (M7.1) ----
  function startCreate(e: React.PointerEvent) {
    const geom = getTrackGeometry();
    if (!geom) return;

    // solo background track (non children)
    if (e.currentTarget !== e.target) return;

    // click su track vuota = deselect (non crea intervallo se non trascini)
    setSelectedIntervalIds([]);

    captureOnTrack(e.pointerId);

    const t = clientXToTick(e.clientX, geom);

    setDrag({
      kind: "create",
      startTick: t,
      currentTick: t,
      trackGeom: geom,
    });
  }

  function updateCreate(e: React.PointerEvent) {
    if (drag.kind !== "create") return;
    const t = clientXToTick(e.clientX, drag.trackGeom);
    setDrag({ ...drag, currentTick: t });
  }

  function commitCreate() {
    if (drag.kind !== "create") return;

    const startTick = drag.startTick;
    const currentTick = drag.currentTick;

    // IMPORTANT: se non hai trascinato (click), NON creare nulla.
    if (startTick === currentTick) return;

    const direction: "forward" | "backward" = currentTick >= startTick ? "forward" : "backward";

    const desiredStart = Math.min(startTick, currentTick);
    const desiredEnd = Math.max(startTick, currentTick) + 1; // end exclusive, min duration 1

    const placed = placeNoOverlap(
      desiredStart,
      desiredEnd,
      intervals,
      { minTick, maxTick },
      direction,
    );

    if (!placed) return;

    const id = createIntervalAction(placed.start, placed.end, bounds);
    setSelectedIntervalIds([id]);
  }

  // ---- CLICK vs MOVE (M7.2) ----
  function startPendingMove(e: React.PointerEvent, intervalId: string) {
    const geom = getTrackGeometry();
    if (!geom) return;

    // non far partire create del track
    e.stopPropagation();

    captureOnTrack(e.pointerId);

    const t = clientXToTick(e.clientX, geom);

    setDrag({
      kind: "pendingMove",
      intervalId,
      startClientX: e.clientX,
      grabTick: t,
      trackGeom: geom,
    });
  }

  function startResize(
    e: React.PointerEvent,
    interval: { id: string; start: number; end: number },
    kind: "resizeStart" | "resizeEnd",
  ) {
    const geom = getTrackGeometry();
    if (!geom) return;

    e.stopPropagation();

    // resize = selezione singola (deterministica)
    setSelectedIntervalIds([interval.id]);

    captureOnTrack(e.pointerId);

    const t = clientXToTick(e.clientX, geom);

    setDrag({
      kind,
      intervalId: interval.id,
      grabTick: t,
      trackGeom: geom,
    });
  }

  function updateDragInterval(e: React.PointerEvent) {
    if (drag.kind === "idle") return;

    if (drag.kind === "create") {
      updateCreate(e);
      return;
    }

    const interval = intervals.find((x) => x.id === drag.intervalId);
    if (!interval) return;

    // pendingMove: se superi soglia -> passa a move; altrimenti resta pending
    if (drag.kind === "pendingMove") {
      const dx = Math.abs(e.clientX - drag.startClientX);
      if (dx < CLICK_TO_DRAG_PX) return;

      // entra in move
      setSelectedIntervalIds([drag.intervalId]);
      setDrag({
        kind: "move",
        intervalId: drag.intervalId,
        grabTick: drag.grabTick,
        trackGeom: drag.trackGeom,
      });
      return;
    }

    const t = clientXToTick(e.clientX, drag.trackGeom);
    const delta = computeDeltaTicks(t, drag.grabTick);

    if (drag.kind === "move") {
      moveIntervalAction(interval.id, delta, bounds);
      setDrag({ ...drag, grabTick: t });
      return;
    }

    if (drag.kind === "resizeStart") {
      resizeIntervalStartAction(interval.id, interval.start + delta, bounds);
      setDrag({ ...drag, grabTick: t });
      return;
    }

    if (drag.kind === "resizeEnd") {
      resizeIntervalEndAction(interval.id, interval.end + delta, bounds);
      setDrag({ ...drag, grabTick: t });
      return;
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    updateDragInterval(e);
  }

  function endDrag(e: React.PointerEvent) {
    releaseOnTrack(e.pointerId);

    // se era pendingMove e non sei entrato in move, allora è un click -> toggle selection
    if (drag.kind === "pendingMove") {
      toggleSelectInterval(drag.intervalId);
      setDrag({ kind: "idle" });
      return;
    }

    if (drag.kind === "create") {
      commitCreate();
      setDrag({ kind: "idle" });
      return;
    }

    setDrag({ kind: "idle" });
  }

  // ---- Label editor helpers (M7.3) ----
  const selectedPredicateName = selectedInterval?.predicate?.name ?? "";
  const selectedPredicateEntry = selectedPredicateName
    ? getPredicateEntry(selectedPredicateName)
    : undefined;
  const argNames = selectedPredicateEntry?.argNames ?? [];
  const args = selectedInterval?.predicate?.args ?? [];

  function onChangePredicate(nextName: string) {
    if (!selectedInterval) return;
    const entry = getPredicateEntry(nextName);
    const nextArgs = entry ? entry.argNames.map((_, idx) => args[idx] ?? "") : [];
    setPredicateAction(selectedInterval.id, nextName, nextArgs);
  }

  function onChangeArg(idx: number, value: string) {
    if (!selectedInterval) return;
    if (!selectedInterval.predicate) return;
    const nextArgs = [...(selectedInterval.predicate.args ?? [])];
    nextArgs[idx] = value;
    setPredicateAction(selectedInterval.id, selectedInterval.predicate.name, nextArgs);
  }

  // ---- Constraints (M8.1) ----
  const operatorOptions = useMemo(() => {
    const all = (operatorsCatalog.operators ?? [])
      .filter((op) => op.arity === 2)
      .map((op) => ({
        code: op.code,
        label: op.label ?? op.code,
        kind: op.kind,
      }));

    const base = all
      .filter((x) => x.kind === "operator")
      .sort((a, b) => a.code.localeCompare(b.code));
    const alias = all
      .filter((x) => x.kind === "alias")
      .sort((a, b) => a.code.localeCompare(b.code));

    return [...base, ...alias];
  }, []);

  const [operatorChoice, setOperatorChoice] = useState<string>(
    () => operatorOptions[0]?.code ?? "Bef",
  );
  const [selectedConstraintId, setSelectedConstraintId] = useState<string | null>(null);

  const pairLeft = primaryIntervalId;
  const pairRight = secondaryIntervalId;

  const pairConstraints = useMemo(() => {
    if (!pairLeft || !pairRight) return [];
    return constraints
      .filter((c) => c.leftIntervalId === pairLeft && c.rightIntervalId === pairRight)
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [constraints, pairLeft, pairRight]);

  const selectedConstraint = useMemo(() => {
    if (!selectedConstraintId) return null;
    return constraints.find((c) => c.id === selectedConstraintId) ?? null;
  }, [constraints, selectedConstraintId]);

  function addConstraintForPair() {
    if (!pairLeft || !pairRight) return;
    const id = addConstraintAction({
      leftIntervalId: pairLeft,
      rightIntervalId: pairRight,
      operatorId: operatorChoice,
    });
    setSelectedConstraintId(id);
  }

  const comparatorOptions = ["<", "≤", "=", "≥", ">", "<=", ">="] as const;

  function toComparator(raw: string): Comparator {
    return normalizeComparator(raw);
  }

  function onChangeConstraintParam(key: "zeta" | "eta" | "delta" | "epsilon" | "rho", raw: string) {
    if (!selectedConstraint) return;

    if (key === "zeta" || key === "eta") {
      const cmp = toComparator(raw);
      setParamAction(selectedConstraint.id, key, cmp);
      return;
    }

    if (key === "rho") {
      const n = Number(raw);
      setParamAction(selectedConstraint.id, key, Number.isFinite(n) ? Math.max(0, n) : 0);
      return;
    }

    const trimmed = raw.trim();
    if (trimmed === "∞") {
      setParamAction(selectedConstraint.id, key, "∞" as Threshold);
      return;
    }
    const n = Number(trimmed);
    if (Number.isFinite(n)) {
      setParamAction(selectedConstraint.id, key, Math.max(0, n));
      return;
    }
  }

  const createPreview =
    drag.kind === "create" && drag.startTick !== drag.currentTick
      ? placeNoOverlap(
          Math.min(drag.startTick, drag.currentTick),
          Math.max(drag.startTick, drag.currentTick) + 1,
          intervals,
          { minTick, maxTick },
          drag.currentTick >= drag.startTick ? "forward" : "backward",
        )
      : null;

  return (
    <div className="flex w-full gap-4">
      {/* Track */}
      <div className="flex-1">
        <div
          ref={trackRef}
          data-testid="timeline-track"
          className={cn(
            "relative h-28 w-full rounded-xl border bg-background",
            "select-none touch-none",
          )}
          onPointerDown={startCreate}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* Preview create */}
          {createPreview ? (
            <div
              className="absolute top-6 h-10 rounded-lg border border-dashed bg-muted/30"
              style={{
                left: `${tickToPct(createPreview.start)}%`,
                width: `${Math.max(0, tickToPct(createPreview.end) - tickToPct(createPreview.start))}%`,
              }}
            />
          ) : null}

          {intervals.map((it) => {
            const leftPct = tickToPct(it.start);
            const rightPct = tickToPct(it.end);
            const widthPct = Math.max(0, rightPct - leftPct);

            const isSelected = selectedIntervalIds.includes(it.id);
            const isSecondary = secondaryIntervalId === it.id;
            const label = formatPredicateLabel(it.predicate);

            return (
              <div
                key={it.id}
                data-testid={`interval-${it.id}`}
                className={cn(
                  "absolute top-6 h-10 rounded-lg border bg-muted shadow-sm",
                  isSelected
                    ? isSecondary
                      ? "ring-2 ring-primary/60"
                      : "ring-2 ring-foreground/30"
                    : null,
                )}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                onPointerDown={(e) => startPendingMove(e, it.id)}
              >
                <div className="relative h-full w-full">
                  <div className="absolute inset-0 flex items-center px-2 text-xs text-foreground/80">
                    <span className="truncate">
                      {label ?? it.id}{" "}
                      <span className="text-muted-foreground">
                        [{it.start},{it.end})
                      </span>
                    </span>
                  </div>

                  {/* handle sinistro */}
                  <div
                    className={cn(
                      "absolute left-0 top-0 h-full w-2 cursor-ew-resize",
                      "rounded-l-lg bg-foreground/10 hover:bg-foreground/15",
                    )}
                    onPointerDown={(e) => startResize(e, it, "resizeStart")}
                    aria-label="Resize start"
                    title="Resize start"
                  />

                  {/* handle destro */}
                  <div
                    className={cn(
                      "absolute right-0 top-0 h-full w-2 cursor-ew-resize",
                      "rounded-r-lg bg-foreground/10 hover:bg-foreground/15",
                    )}
                    onPointerDown={(e) => startResize(e, it, "resizeEnd")}
                    aria-label="Resize end"
                    title="Resize end"
                  />
                </div>
              </div>
            );
          })}

          <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[10px] text-muted-foreground">
            <span>{minTick}</span>
            <span>{maxTick}</span>
          </div>
        </div>

        <div className="mt-2 text-xs text-muted-foreground">
          Drag sullo sfondo per creare. Drag sulla barra per spostare. Drag sulle maniglie per
          ridimensionare. Click per selezionare e modificare label e constraints.
        </div>
      </div>

      {/* Side panel: Constraints (M8.1) + Label (M7.3) */}
      <div className="w-[360px] shrink-0 space-y-3">
        {/* Constraints */}
        <div className="rounded-xl border bg-card p-3">
          <div className="mb-2 text-sm font-semibold">Constraints (Expert)</div>

          <div className="mb-2 text-xs text-muted-foreground">
            Seleziona 2 intervalli (click) per creare un constraint. L&apos;ordine è A (primary) → B
            (secondary).
          </div>

          <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border bg-muted/30 px-2 py-1">
              <div className="text-[10px] text-muted-foreground">A (left)</div>
              <div className="font-mono">{pairLeft ?? "—"}</div>
            </div>
            <div className="rounded-md border bg-muted/30 px-2 py-1">
              <div className="text-[10px] text-muted-foreground">B (right)</div>
              <div className="font-mono">{pairRight ?? "—"}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Operator (base + Allen alias)</div>
              <Select value={operatorChoice} onValueChange={setOperatorChoice}>
                <SelectTrigger data-testid="constraint-operator-choice">
                  <SelectValue placeholder="Choose operator..." />
                </SelectTrigger>
                <SelectContent>
                  {operatorOptions.map((op) => (
                    <SelectItem key={op.code} value={op.code}>
                      {op.code} — {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              data-testid="constraint-add"
              disabled={!pairLeft || !pairRight || pairLeft === pairRight}
              onClick={addConstraintForPair}
            >
              Add constraint
            </Button>
          </div>

          {/* Existing constraints for the selected pair */}
          {pairLeft && pairRight ? (
            <div className="mt-3 space-y-2">
              <div className="text-xs font-semibold">Constraints for A→B</div>
              {pairConstraints.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  Nessun constraint per questa coppia.
                </div>
              ) : (
                <div className="space-y-1">
                  {pairConstraints.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      data-testid={`constraint-item-${c.id}`}
                      className={cn(
                        "w-full rounded-md border px-2 py-1 text-left text-xs",
                        c.id === selectedConstraintId ? "bg-muted/50" : "bg-background",
                      )}
                      onClick={() => setSelectedConstraintId(c.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono">{c.id}</span>
                        <span className="text-muted-foreground">{c.operatorId}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* Editor params */}
          {selectedConstraint ? (
            <div className="mt-3 space-y-3 border-t pt-3">
              <div className="text-xs font-semibold">Edit selected constraint</div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Operator</div>
                <Select
                  value={selectedConstraint.operatorId}
                  onValueChange={(op) => setOperatorAction(selectedConstraint.id, op)}
                >
                  <SelectTrigger data-testid="constraint-operator">
                    <SelectValue placeholder="Operator..." />
                  </SelectTrigger>
                  <SelectContent>
                    {operatorOptions.map((op) => (
                      <SelectItem key={op.code} value={op.code}>
                        {op.code} — {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">ζ (zeta)</div>
                  <Select
                    value={String(selectedConstraint.params.zeta)}
                    onValueChange={(v) => onChangeConstraintParam("zeta", v)}
                  >
                    <SelectTrigger data-testid="param-zeta">
                      <SelectValue placeholder="ζ" />
                    </SelectTrigger>
                    <SelectContent>
                      {comparatorOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">η (eta)</div>
                  <Select
                    value={String(selectedConstraint.params.eta)}
                    onValueChange={(v) => onChangeConstraintParam("eta", v)}
                  >
                    <SelectTrigger data-testid="param-eta">
                      <SelectValue placeholder="η" />
                    </SelectTrigger>
                    <SelectContent>
                      {comparatorOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">δ (delta)</div>
                  <Input
                    data-testid="param-delta"
                    value={String(selectedConstraint.params.delta)}
                    onChange={(e) => onChangeConstraintParam("delta", e.target.value)}
                    placeholder="∞ or number"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">ε (epsilon)</div>
                  <Input
                    data-testid="param-epsilon"
                    value={String(selectedConstraint.params.epsilon)}
                    onChange={(e) => onChangeConstraintParam("epsilon", e.target.value)}
                    placeholder="∞ or number"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <div className="text-xs text-muted-foreground">ρ (rho)</div>
                  <Input
                    data-testid="param-rho"
                    type="number"
                    value={String(selectedConstraint.params.rho)}
                    onChange={(e) => onChangeConstraintParam("rho", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Model (debug)</div>
                <pre
                  data-testid="constraint-model"
                  className="max-h-40 overflow-auto rounded-md border bg-muted/30 p-2 text-[10px]"
                >
                  {JSON.stringify(selectedConstraint, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </div>

        {/* Label */}
        <div className="rounded-xl border bg-card p-3">
          <div className="mb-2 text-sm font-semibold">Label</div>

          {!selectedInterval ? (
            <div className="text-sm text-muted-foreground">
              Seleziona un intervallo per assegnare un predicato.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Predicate</div>
                <Select
                  value={selectedPredicateName || undefined}
                  onValueChange={onChangePredicate}
                >
                  <SelectTrigger data-testid="predicate-select">
                    <SelectValue placeholder="Choose a predicate..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PREDICATE_CATALOG.map((p) => (
                      <SelectItem key={p.id} value={p.name}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {argNames.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Args</div>
                  <div className="space-y-2">
                    {argNames.map((name, idx) => (
                      <div key={name} className="space-y-1">
                        <div className="text-[10px] text-muted-foreground">{name}</div>
                        <Input
                          data-testid={`predicate-arg-${idx}`}
                          value={args[idx] ?? ""}
                          onChange={(e) => onChangeArg(idx, e.target.value)}
                          placeholder={name}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Nessun argomento.</div>
              )}

              <div className="pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="predicate-clear"
                  onClick={() => clearPredicateAction(selectedInterval.id)}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
