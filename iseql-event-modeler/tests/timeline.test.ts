// tests/timeline.test.ts
import { describe, expect, it } from "vitest";
import {
  createInterval,
  moveInterval,
  resizeEnd,
  resizeInterval,
  resizeStart,
} from "../src/core/timeline";

type Interval = { id: string; start: number; end: number; label?: string };

describe("timeline helpers (create/move/resize)", () => {
  it("createInterval normalizes and swaps when start > end", () => {
    expect(createInterval(10, 3)).toEqual({ start: 3, end: 10 });
  });

  it("createInterval clamps negative ticks to minTick (default 0)", () => {
    expect(createInterval(-5, 2)).toEqual({ start: 0, end: 2 });
  });

  it("createInterval respects custom bounds", () => {
    expect(createInterval(-10, 50, { minTick: 5, maxTick: 20 })).toEqual({ start: 5, end: 20 });
  });

  it("moveInterval preserves duration for normal moves", () => {
    const i: Interval = { id: "a", start: 2, end: 7 };
    const moved = moveInterval(i, 3);
    expect(moved).toEqual({ ...i, start: 5, end: 10 });
  });

  it("moveInterval clamps to minTick by shifting both endpoints (preserve duration)", () => {
    const i: Interval = { id: "a", start: 2, end: 7 }; // duration 5
    const moved = moveInterval(i, -10, { minTick: 0, maxTick: 100 });
    expect(moved.start).toBe(0);
    expect(moved.end).toBe(5);
  });

  it("moveInterval clamps to maxTick by shifting both endpoints (preserve duration)", () => {
    const i: Interval = { id: "a", start: 10, end: 20 }; // duration 10
    const moved = moveInterval(i, 100, { minTick: 0, maxTick: 25 });
    expect(moved.end).toBe(25);
    expect(moved.start).toBe(15);
  });

  it("moveInterval when duration cannot fit into finite bounds returns full bounds", () => {
    const i: Interval = { id: "a", start: 0, end: 50 }; // duration 50
    const moved = moveInterval(i, 1, { minTick: 0, maxTick: 10 }); // available size 10
    expect(moved).toEqual({ ...i, start: 0, end: 10 });
  });

  it("resizeStart clamps and prevents inversion (cannot go past end)", () => {
    const i: Interval = { id: "a", start: 5, end: 10 };
    const resized = resizeStart(i, 999, { minTick: 0, maxTick: 100 });
    expect(resized).toEqual({ ...i, start: 10, end: 10 });
  });

  it("resizeEnd clamps and prevents inversion (cannot go before start)", () => {
    const i: Interval = { id: "a", start: 5, end: 10 };
    const resized = resizeEnd(i, -999, { minTick: 0, maxTick: 100 });
    expect(resized).toEqual({ ...i, start: 5, end: 5 });
  });

  it("resizeInterval + moveInterval are immutable (do not mutate input)", () => {
    const i: Interval = { id: "a", start: 2, end: 7, label: "x" };
    const j = resizeInterval(i, "end", 20);
    const k = moveInterval(i, 5);

    // original unchanged
    expect(i).toEqual({ id: "a", start: 2, end: 7, label: "x" });

    // copies preserve extra fields
    expect(j.label).toBe("x");
    expect(k.label).toBe("x");
  });
});
