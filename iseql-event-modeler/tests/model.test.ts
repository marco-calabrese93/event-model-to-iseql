import { describe, expect, it } from "vitest";
import { createMinimalEventModel, toStableModelSnapshot } from "../src/core/model";

describe("core/model", () => {
  it("creo modello minimo → snapshot JSON stable", () => {
    const model = createMinimalEventModel();
    const snap = toStableModelSnapshot(model);

    expect(snap).toMatchInlineSnapshot(`
"{
  "constraints": {
    "constraints": []
  },
  "id": "m_0001",
  "intervals": [
    {
      "end": 1,
      "id": "i_0002",
      "label": "A",
      "predicate": {
        "args": [
          "p1",
          "pkg1"
        ],
        "name": "hasPkg"
      },
      "start": 0
    }
  ],
  "meta": {
    "createdAtISO": "2026-02-06T00:00:00.000Z",
    "name": "MinimalModel"
  },
  "relations": [],
  "schemaVersion": "1.0"
}"
`);
  });
});
