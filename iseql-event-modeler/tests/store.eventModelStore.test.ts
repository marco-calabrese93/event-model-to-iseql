import { describe, expect, it } from "vitest";
import { createEventModelStoreForTests } from "@/ui/store/eventModelStore";

describe("eventModelStore", () => {
  it("creates deterministic interval ids and keeps intervals sorted by id", () => {
    const store = createEventModelStoreForTests();

    const a = store.getState().actions.createInterval(10, 20, { minTick: 0, maxTick: 100 });
    const b = store.getState().actions.createInterval(30, 40, { minTick: 0, maxTick: 100 });

    expect(a).toBe("interval_0001");
    expect(b).toBe("interval_0002");

    const ids = store.getState().model.intervals.map((x) => x.id);
    expect(ids).toEqual(["interval_0001", "interval_0002"]);
  });

  it("supports predicate set/clear (labeling)", () => {
    const store = createEventModelStoreForTests();

    const id = store.getState().actions.createInterval(10, 20, { minTick: 0, maxTick: 100 });

    store.getState().actions.setPredicate(id, "in", ["p1"]);
    expect(store.getState().model.intervals[0].predicate).toEqual({ name: "in", args: ["p1"] });

    store.getState().actions.clearPredicate(id);
    expect(store.getState().model.intervals[0].predicate).toBeNull();
  });

  it("creates a constraint with default params", () => {
    const store = createEventModelStoreForTests();

    const left = store.getState().actions.createInterval(10, 20, { minTick: 0, maxTick: 100 });
    const right = store.getState().actions.createInterval(30, 40, { minTick: 0, maxTick: 100 });

    const cId = store.getState().actions.addConstraint({
      leftIntervalId: left,
      rightIntervalId: right,
      operatorId: "Bef",
    });

    expect(cId).toBe("constraint_0001");

    const c = store.getState().model.constraints[0];
    expect(c.leftIntervalId).toBe(left);
    expect(c.rightIntervalId).toBe(right);
    expect(c.operatorId).toBe("Bef");

    expect(c.params).toEqual({
      zeta: "≤",
      eta: "≤",
      delta: "∞",
      epsilon: "∞",
      rho: 0,
    });
  });

  it("setOperator preserves user params when possible, but alias fixed params win", () => {
    const store = createEventModelStoreForTests();

    const left = store.getState().actions.createInterval(10, 20, { minTick: 0, maxTick: 100 });
    const right = store.getState().actions.createInterval(30, 40, { minTick: 0, maxTick: 100 });

    const cId = store.getState().actions.addConstraint({
      leftIntervalId: left,
      rightIntervalId: right,
      operatorId: "Bef",
    });

    store.getState().actions.setParam(cId, "delta", 2);
    expect(store.getState().model.constraints[0].params.delta).toBe(2);

    // alias con fixed params (dal catalogo: Allen.Meets => zeta="=" e delta=1)
    store.getState().actions.setOperator(cId, "Allen.Meets");

    const c = store.getState().model.constraints[0];
    expect(c.operatorId).toBe("Allen.Meets");
    expect(c.params.delta).toBe(1);
    expect(c.params.zeta).toBe("=");
  });

  it("setParam normalizes/clamps rho>=0 and thresholds to >=0 or ∞", () => {
    const store = createEventModelStoreForTests();

    const left = store.getState().actions.createInterval(10, 20, { minTick: 0, maxTick: 100 });
    const right = store.getState().actions.createInterval(30, 40, { minTick: 0, maxTick: 100 });

    const cId = store.getState().actions.addConstraint({
      leftIntervalId: left,
      rightIntervalId: right,
      operatorId: "Bef",
    });

    store.getState().actions.setParam(cId, "rho", -10);
    expect(store.getState().model.constraints[0].params.rho).toBe(0);

    store.getState().actions.setParam(cId, "delta", -5);
    expect(store.getState().model.constraints[0].params.delta).toBe(0);

    store.getState().actions.setParam(cId, "epsilon", "∞");
    expect(store.getState().model.constraints[0].params.epsilon).toBe("∞");
  });
});
