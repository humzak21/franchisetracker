import { describe, expect, test } from "vitest";
import { planRoster, type MoveInput } from "./plan";

const base: MoveInput<string, string> = {
  type: "sign",
  year: 2026,
  teamId: "NE",
  playersIn: [],
  playersOut: [],
  teamLabel: "NE",
  assetsIn: [],
  assetsOut: [],
};

describe("roster sync plan", () => {
  test("a trade marks each player traded on the old team and adds them to the new one", () => {
    const ops = planRoster({
      ...base,
      type: "trade",
      weekKey: "w6",
      counterpartTeamId: "KC",
      counterpartLabel: "KC",
      playersIn: ["kelce"],
      playersOut: ["maye"],
      assetsIn: ["Travis Kelce"],
      assetsOut: ["Drake Maye", "2027 R1"],
    });
    expect(ops).toEqual([
      { kind: "update", playerId: "maye", teamId: "NE", set: { status: "traded", statusWeekKey: "w6" } },
      {
        kind: "ensure",
        playerId: "maye",
        teamId: "KC",
        fromTeamId: "NE",
        set: {
          status: "active",
          statusWeekKey: "w6",
          acquisition: { type: "trade", year: 2026, detail: "From NE", counterparts: ["Travis Kelce"] },
        },
      },
      { kind: "update", playerId: "kelce", teamId: "KC", set: { status: "traded", statusWeekKey: "w6" } },
      {
        kind: "ensure",
        playerId: "kelce",
        teamId: "NE",
        fromTeamId: "KC",
        set: {
          status: "active",
          statusWeekKey: "w6",
          acquisition: {
            type: "trade",
            year: 2026,
            detail: "From KC",
            counterparts: ["Drake Maye", "2027 R1"],
          },
        },
      },
    ]);
  });

  test("a trade without a partner touches nothing", () => {
    expect(planRoster({ ...base, type: "trade", playersIn: ["a"] })).toEqual([]);
  });

  test("a signing adds an active free agent with the contract; offseason clears the status week", () => {
    const contract = { years: 2, apy: 5_000_000 };
    const [op] = planRoster({ ...base, playersIn: ["fa"], contract });
    expect(op).toEqual({
      kind: "ensure",
      playerId: "fa",
      teamId: "NE",
      set: {
        status: "active",
        statusWeekKey: undefined,
        acquisition: { type: "free_agent", year: 2026 },
        contract,
      },
    });
    expect(op && "set" in op && "statusWeekKey" in op.set).toBe(true);
  });

  test("a waiver claim releases the player from the team that waived him", () => {
    const ops = planRoster({
      ...base,
      type: "waiver_claim",
      weekKey: "w2",
      counterpartTeamId: "BUF",
      counterpartLabel: "BUF",
      playersIn: ["p"],
    });
    expect(ops.map((o) => [o.kind, "teamId" in o ? o.teamId : null])).toEqual([
      ["update", "BUF"],
      ["ensure", "NE"],
    ]);
    expect(ops[1]).toMatchObject({ set: { acquisition: { type: "waiver", detail: "From BUF" } } });
  });

  test("status moves change only the status and its week", () => {
    expect(planRoster({ ...base, type: "release", weekKey: "w9", playersOut: ["p"] })).toEqual([
      { kind: "update", playerId: "p", teamId: "NE", set: { status: "released", statusWeekKey: "w9" } },
    ]);
    expect(planRoster({ ...base, type: "ir", weekKey: "w3", playersOut: ["p"] })[0]).toMatchObject({
      kind: "ensure",
      set: { status: "ir", statusWeekKey: "w3" },
    });
    expect(planRoster({ ...base, type: "activate", weekKey: "w8", playersIn: ["p"] })[0]).toMatchObject({
      kind: "ensure",
      set: { status: "active", statusWeekKey: "w8" },
    });
  });

  test("contract moves keep the original acquisition; a re-sign names it only on a new entry", () => {
    const contract = { years: 4 };
    expect(planRoster({ ...base, type: "resign", playersIn: ["p"], contract })).toEqual([
      {
        kind: "ensure",
        playerId: "p",
        teamId: "NE",
        set: { contract },
        createWith: { acquisition: { type: "resign", year: 2026 } },
      },
    ]);
    expect(planRoster({ ...base, type: "extension", playersIn: ["p"] })).toEqual([
      { kind: "ensure", playerId: "p", teamId: "NE", set: {} },
    ]);
  });

  test("retiring flags the player and takes them off the team", () => {
    expect(planRoster({ ...base, type: "retire", weekKey: "w3", playersOut: ["p"] })).toEqual([
      { kind: "retire", playerId: "p" },
      { kind: "update", playerId: "p", teamId: "NE", set: { status: "released", statusWeekKey: "w3" } },
    ]);
  });
});
