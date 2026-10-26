import { describe, expect, test } from "vitest";
import { prepareForRestore, remapDoc } from "./backup";

describe("remapDoc", () => {
  const map = new Map([
    ["oldSeason", "newSeason"],
    ["oldPlayer", "newPlayer"],
  ]);

  test("drops system fields and rewrites ids anywhere in the row", () => {
    const { doc, deferred } = remapDoc(
      {
        _id: "oldGame",
        _creationTime: 1,
        seasonId: "oldSeason",
        weekKey: "w1",
        stars: [{ playerId: "oldPlayer", caption: "3 TD" }, { rawName: "Someone" }],
        notes: "Not an id",
      },
      map,
      new Set(),
    );
    expect(doc).toEqual({
      seasonId: "newSeason",
      weekKey: "w1",
      stars: [{ playerId: "newPlayer", caption: "3 TD" }, { rawName: "Someone" }],
      notes: "Not an id",
    });
    expect(deferred).toEqual([]);
  });

  test("leaves out references to rows not inserted yet and defers their fields", () => {
    const pending = new Set(["oldInventory", "oldTransaction"]);
    const { doc, deferred } = remapDoc(
      {
        _id: "oldTransaction",
        seasonId: "oldSeason",
        picksIn: [{ year: 2027, round: 2, inventoryId: "oldInventory" }],
        picksOut: [],
        acquiredTransactionId: "oldTransaction",
      },
      map,
      pending,
    );
    expect(doc).toEqual({ seasonId: "newSeason", picksIn: [{ year: 2027, round: 2 }], picksOut: [] });
    expect(deferred).toEqual(["picksIn", "acquiredTransactionId"]);

    // Once everything is in, the deferred fields are remapped again with the full map.
    const full = new Map([...map, ["oldInventory", "newInventory"]]);
    expect(remapDoc({ _id: "x", picksIn: [{ inventoryId: "oldInventory" }] }, full, pending).doc).toEqual({
      picksIn: [{ inventoryId: "newInventory" }],
    });
  });
});

describe("prepareForRestore", () => {
  test("restored franchises are inactive and labelled; a running import stops", () => {
    expect(
      prepareForRestore("franchises", { _id: "f", name: "Dynasty", isActive: true }, "restored"),
    ).toEqual({
      _id: "f",
      name: "Dynasty (restored)",
      isActive: false,
    });
    expect(prepareForRestore("historyImports", { _id: "h", status: "running" }, "x")).toMatchObject({
      status: "failed",
    });
    expect(prepareForRestore("games", { _id: "g", status: "played" }, "x")).toEqual({
      _id: "g",
      status: "played",
    });
  });
});
