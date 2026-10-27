import { describe, expect, it } from "vitest";
import { entryCellPatch } from "./entryCell";
import { applyEntryPatch, type EntryFields } from "./entryPatch";

const entry: EntryFields = {
  position: "WR",
  jersey: 8,
  ovr: 86,
  status: "ir",
  statusWeekKey: "w5",
  acquisition: { type: "trade", year: 2025, counterparts: ["BUF"] },
  contract: { years: 3, apy: 22_000_000, total: 66_000_000 },
};

describe("applyEntryPatch", () => {
  it("sets and clears plain fields", () => {
    expect(applyEntryPatch(entry, { ovr: 88, jersey: null })).toEqual({
      ok: true,
      fields: { ovr: 88, jersey: undefined },
    });
  });

  it("rejects values out of range", () => {
    expect(applyEntryPatch(entry, { ovr: 100 })).toMatchObject({ ok: false, error: /OVR/ });
    expect(applyEntryPatch(entry, { jersey: 4.5 })).toMatchObject({ ok: false, error: /whole number/ });
    expect(applyEntryPatch(entry, { contractApy: -1 })).toMatchObject({ ok: false, error: /APY/ });
  });

  it("clears the status week when the status changes", () => {
    expect(applyEntryPatch(entry, { status: "active" })).toEqual({
      ok: true,
      fields: { status: "active", statusWeekKey: undefined },
    });
    expect(applyEntryPatch(entry, { status: "ir" })).toEqual({ ok: true, fields: {} });
    expect(applyEntryPatch(entry, { status: "released", statusWeekKey: "w9" })).toEqual({
      ok: true,
      fields: { status: "released", statusWeekKey: "w9" },
    });
  });

  it("merges acquisition fields and keeps the counterparts", () => {
    expect(applyEntryPatch(entry, { acquisitionDetail: "  for a 2nd  " })).toEqual({
      ok: true,
      fields: { acquisition: { type: "trade", year: 2025, detail: "for a 2nd", counterparts: ["BUF"] } },
    });
    expect(applyEntryPatch(entry, { acquisitionType: null })).toEqual({
      ok: true,
      fields: { acquisition: undefined },
    });
  });

  it("needs an acquisition type before a year or detail", () => {
    const bare = { ...entry, acquisition: undefined };
    expect(applyEntryPatch(bare, { acquisitionYear: 2024 })).toMatchObject({ ok: false });
    expect(applyEntryPatch(bare, { acquisitionType: "draft", acquisitionYear: 2024 })).toEqual({
      ok: true,
      fields: { acquisition: { type: "draft", year: 2024 } },
    });
  });

  it("merges contract fields and drops an empty contract", () => {
    expect(applyEntryPatch(entry, { contractExpiresYear: 2028 })).toEqual({
      ok: true,
      fields: { contract: { years: 3, apy: 22_000_000, total: 66_000_000, expiresYear: 2028 } },
    });
    const short = { ...entry, contract: { apy: 1_000_000 } };
    expect(applyEntryPatch(short, { contractApy: null })).toEqual({
      ok: true,
      fields: { contract: undefined },
    });
  });

  it("cleans abilities", () => {
    expect(applyEntryPatch(entry, { abilities: [" Deep Out Elite ", "", "Deep Out Elite"] })).toEqual({
      ok: true,
      fields: { abilities: ["Deep Out Elite"] },
    });
    expect(applyEntryPatch(entry, { abilities: [] })).toEqual({ ok: true, fields: { abilities: undefined } });
    expect(
      applyEntryPatch(entry, { abilities: Array.from({ length: 13 }, (_, i) => `A${i}`) }),
    ).toMatchObject({
      ok: false,
    });
  });
});

describe("entryCellPatch", () => {
  it("maps number, text and choice cells", () => {
    expect(entryCellPatch("ovr", 90)).toEqual({ ok: true, fields: { ovr: 90 } });
    expect(entryCellPatch("gradeNote", null)).toEqual({ ok: true, fields: { gradeNote: null } });
    expect(entryCellPatch("position", "CB")).toEqual({ ok: true, fields: { position: "CB" } });
    expect(entryCellPatch("devTrait", null)).toEqual({ ok: true, fields: { devTrait: null } });
    expect(entryCellPatch("abilities", "A, B")).toEqual({ ok: true, fields: { abilities: ["A", " B"] } });
  });

  it("edits APY in millions", () => {
    expect(entryCellPatch("contractApy", 12.5)).toEqual({ ok: true, fields: { contractApy: 12_500_000 } });
  });

  it("rejects values that do not fit and ignores other columns", () => {
    expect(entryCellPatch("position", "XX")).toMatchObject({ ok: false });
    expect(entryCellPatch("status", null)).toMatchObject({ ok: false });
    expect(entryCellPatch("ovr", "high")).toMatchObject({ ok: false });
    expect(entryCellPatch("player", "Name")).toBeNull();
  });
});
