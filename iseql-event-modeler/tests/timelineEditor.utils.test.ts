// tests/timelineEditor.utils.test.ts
import { describe, expect, test } from "vitest";
import { makeBounds } from "@/ui/components/TimelineEditor/utils";
import {
  applyDragToInterval,
  clampTick,
  clientXToTick,
  computeDeltaTicks,
} from "@/ui/components/TimelineEditor/utils";

describe("timeline editor utils (M7.1 + M7.2)", () => {
  test("clampTick clamps into bounds", () => {
    expect(clampTick(-10, 0, 100)).toBe(0);
    expect(clampTick(10, 0, 100)).toBe(10);
    expect(clampTick(999, 0, 100)).toBe(100);
  });

  test("clientXToTick maps to ticks with rounding + clamp", () => {
    const geom = { left: 0, width: 200, minTick: 0, maxTick: 100 };
    expect(clientXToTick(0, geom)).toBe(0);
    expect(clientXToTick(200, geom)).toBe(100);
    expect(clientXToTick(100, geom)).toBe(50);
    expect(clientXToTick(-999, geom)).toBe(0);
    expect(clientXToTick(999, geom)).toBe(100);
  });

  test("computeDeltaTicks is current - grab", () => {
    expect(computeDeltaTicks(10, 15)).toBe(5);
    expect(computeDeltaTicks(10, 3)).toBe(-7);
  });

  test("applyDragToInterval(move) preserves duration and clamps", () => {
    const bounds = makeBounds(0, 100);
    const i = { id: "interval_0001", start: 10, end: 20 };

    const moved = applyDragToInterval(i, { kind: "move", deltaTicks: 7 }, bounds);
    expect(moved.start).toBe(17);
    expect(moved.end).toBe(27);
    expect(moved.end - moved.start).toBe(10);

    const movedLeft = applyDragToInterval(i, { kind: "move", deltaTicks: -50 }, bounds);
    expect(movedLeft.start).toBe(0);
    expect(movedLeft.end).toBe(10);
  });

  test("applyDragToInterval(resizeStart) clamps and prevents inversion", () => {
    const bounds = makeBounds(0, 100);
    const i = { id: "interval_0001", start: 10, end: 20 };

    const r1 = applyDragToInterval(i, { kind: "resizeStart", newTick: 5 }, bounds);
    expect(r1.start).toBe(5);
    expect(r1.end).toBe(20);

    const r2 = applyDragToInterval(i, { kind: "resizeStart", newTick: 999 }, bounds);
    expect(r2.start).toBeLessThanOrEqual(r2.end);
    expect(r2.start).toBe(20);
  });

  test("applyDragToInterval(resizeEnd) clamps and prevents inversion", () => {
    const bounds = makeBounds(0, 100);
    const i = { id: "interval_0001", start: 10, end: 20 };

    const r1 = applyDragToInterval(i, { kind: "resizeEnd", newTick: 30 }, bounds);
    expect(r1.start).toBe(10);
    expect(r1.end).toBe(30);

    const r2 = applyDragToInterval(i, { kind: "resizeEnd", newTick: -999 }, bounds);
    expect(r2.start).toBeLessThanOrEqual(r2.end);
    expect(r2.end).toBe(10);
  });
});
