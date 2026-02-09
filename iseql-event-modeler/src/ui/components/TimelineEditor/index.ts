export { default as TimelineEditor } from "./TimelineEditor";

// Re-export public types/helpers (compat)
export type { TickBounds, TrackGeometry, DragKind } from "./utils";
export { clampTick, clientXToTick, computeDeltaTicks, makeBounds } from "./utils";
