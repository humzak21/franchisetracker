import { describe, expect, it } from "vitest";
import { derivedIsReal, tidiedProvenance } from "./provenance";

describe("derivedIsReal", () => {
  const startYear = 2026;

  it("trusts the import and an ESPN match", () => {
    expect(derivedIsReal({ origin: "import", createdYear: 2035, startYear })).toBe(true);
    expect(derivedIsReal({ origin: "draft", createdYear: 2030, startYear, espnId: 1 })).toBe(true);
    expect(derivedIsReal({ origin: "screenshot", createdYear: 2030, startYear, nflverseId: "x" })).toBe(true);
  });

  it("reads the first season as real rosters and everyone after as created", () => {
    expect(derivedIsReal({ origin: "screenshot", createdYear: 2026, startYear })).toBe(true);
    expect(derivedIsReal({ origin: "screenshot", createdYear: 2027, startYear })).toBe(false);
    expect(derivedIsReal({ origin: "draft", createdYear: 2026, startYear })).toBe(true);
    expect(derivedIsReal({ origin: "draft", createdYear: 2027, startYear })).toBe(false);
  });

  it("leaves a player nothing dates as found", () => {
    expect(derivedIsReal({ origin: "screenshot", createdYear: null, startYear })).toBe(true);
  });
});

describe("tidiedProvenance", () => {
  const facts = { drafted: false, createdYear: 2029, startYear: 2026 };

  it("names where a player came from", () => {
    expect(tidiedProvenance({ isReal: true, nflverseId: "x" }, facts).origin).toBe("import");
    expect(tidiedProvenance({ isReal: true }, { ...facts, drafted: true }).origin).toBe("draft");
    expect(tidiedProvenance({ isReal: true }, facts).origin).toBe("screenshot");
  });

  it("turns a created player fictional, unless matched", () => {
    expect(tidiedProvenance({ isReal: true }, facts).isReal).toBe(false);
    expect(tidiedProvenance({ isReal: true, espnId: 7 }, facts).isReal).toBe(true);
    expect(tidiedProvenance({ isReal: true }, { ...facts, createdYear: 2026 }).isReal).toBe(true);
  });

  it("never turns a fictional player real: the owner marked them so", () => {
    expect(tidiedProvenance({ isReal: false }, { ...facts, createdYear: 2026 }).isReal).toBe(false);
  });
});
