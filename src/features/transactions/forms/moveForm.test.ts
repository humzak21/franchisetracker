import { describe, expect, test } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import {
  contractDraft,
  contractInput,
  defaultPhase,
  fromMovePerson,
  parseMillions,
  parseWhole,
  toPersonInput,
} from "./moveForm";

const id = "p1" as Id<"players">;

describe("move form", () => {
  test("people map to save inputs: an id, or a new player's details", () => {
    expect(toPersonInput({ kind: "existing", playerId: id, name: "A" })).toEqual({ playerId: id });
    expect(toPersonInput({ kind: "new", name: "New Guy", position: "WR", ovr: 70 })).toEqual({
      name: "New Guy",
      position: "WR",
      age: undefined,
      ovr: 70,
    });
    expect(fromMovePerson({ playerId: id, name: "A", position: "QB", headshotUrl: null })).toMatchObject({
      kind: "existing",
      playerId: id,
    });
    expect(
      fromMovePerson({
        playerId: undefined,
        name: "Veteran Linebacker",
        position: undefined,
        headshotUrl: null,
      }),
    ).toEqual({
      kind: "new",
      name: "Veteran Linebacker",
      position: "QB",
    });
  });

  test("new moves start in the phase the season is in", () => {
    expect(defaultPhase("upcoming")).toEqual({ phase: "offseason" });
    expect(defaultPhase("regular")).toEqual({ phase: "regular", weekKey: "w1" });
    expect(defaultPhase("postseason")).toEqual({ phase: "postseason", weekKey: "wc" });
  });

  test("numbers parse from typed text, money in millions", () => {
    expect(parseWhole(" 3 ")).toBe(3);
    expect(parseWhole("")).toBeUndefined();
    expect(parseWhole("abc")).toBeUndefined();
    expect(parseMillions("22.5")).toBe(22_500_000);
    expect(parseMillions(" ")).toBeUndefined();
  });

  test("contracts round-trip through the typed fields", () => {
    const contract = { years: 3, total: 67_500_000, apy: 22_500_000, expiresYear: 2028 };
    const draft = contractDraft(contract);
    expect(draft).toEqual({ years: "3", total: "67.5", apy: "22.5", guaranteed: "" });
    expect(contractInput(draft)).toEqual({ years: 3, total: 67_500_000, apy: 22_500_000 });
    expect(contractInput({ years: "", total: "", apy: "", guaranteed: "" })).toBeUndefined();
  });
});
