/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { asStranger } from "../lib/testOwner";
import schema from "../schema";
import { blank, seeded } from "./testkit";

const modules = import.meta.glob("/convex/**/*.ts");

async function setup() {
  return await seeded(convexTest(schema, modules));
}

describe("recorded signings and other moves", () => {
  test("a signing adds the player with the contract; a release and its undo follow", async () => {
    const { owner, seasonId, ne, entries, playerNamed } = await setup();
    const signId = await owner.mutation(api.transactions.moves.save, {
      ...blank,
      seasonId,
      type: "sign",
      phase: "free_agency",
      teamId: ne,
      playersIn: [{ name: "Free Agent", position: "CB", ovr: 77 }],
      contract: { years: 2, total: 10_000_000, guaranteed: 4_000_000 },
    });
    const fa = await playerNamed("Free Agent");
    expect(await entries(fa)).toMatchObject([
      {
        teamId: ne,
        status: "active",
        position: "CB",
        ovr: 77,
        acquisition: { type: "free_agent", year: 2026 },
        contract: { years: 2, total: 10_000_000, apy: 5_000_000, guaranteed: 4_000_000, expiresYear: 2027 },
      },
    ]);
    const releaseId = await owner.mutation(api.transactions.moves.save, {
      ...blank,
      seasonId,
      type: "release",
      phase: "regular",
      weekKey: "w9",
      teamId: ne,
      playersOut: [{ playerId: fa }],
    });
    expect(await entries(fa)).toMatchObject([{ status: "released", statusWeekKey: "w9" }]);
    await owner.mutation(api.transactions.moves.remove, { transactionId: releaseId });
    expect(await entries(fa)).toMatchObject([{ status: "active" }]);
    await owner.mutation(api.transactions.moves.remove, { transactionId: signId });
    expect(await entries(fa)).toEqual([]);
  });

  test("undo leaves manual roster edits made since", async () => {
    const { t, owner, seasonId, ne, maye, entries } = await setup();
    const irId = await owner.mutation(api.transactions.moves.save, {
      ...blank,
      seasonId,
      type: "ir",
      phase: "regular",
      weekKey: "w3",
      teamId: ne,
      playersOut: [{ playerId: maye }],
    });
    const [entry] = await entries(maye);
    expect(entry).toMatchObject({ status: "ir", statusWeekKey: "w3", jersey: 10 });
    // The owner fixes the roster by hand: practice squad, not IR.
    await t.run((ctx) => ctx.db.patch("rosterEntries", entry!._id, { status: "practice_squad", jersey: 4 }));
    await owner.mutation(api.transactions.moves.remove, { transactionId: irId });
    const [after] = await entries(maye);
    expect(after).toMatchObject({ status: "practice_squad", jersey: 4 });
    expect(after!.statusWeekKey).toBeUndefined();
  });

  test("retiring flags the player and deleting the move brings him back", async () => {
    const { t, owner, seasonId, ne, maye } = await setup();
    const id = await owner.mutation(api.transactions.moves.save, {
      ...blank,
      seasonId,
      type: "retire",
      phase: "offseason",
      teamId: ne,
      playersOut: [{ playerId: maye }],
    });
    expect((await t.run((ctx) => ctx.db.get("players", maye)))!.retired).toBe(true);
    await owner.mutation(api.transactions.moves.remove, { transactionId: id });
    expect((await t.run((ctx) => ctx.db.get("players", maye)))!.retired).toBe(false);
  });

  test("bad timing and shapes are refused, and strangers are locked out", async () => {
    const { t, owner, seasonId, ne, maye } = await setup();
    const sign = { ...blank, seasonId, type: "sign" as const, teamId: ne, playersIn: [{ playerId: maye }] };
    await expect(owner.mutation(api.transactions.moves.save, { ...sign, phase: "regular" })).rejects.toThrow(
      /week/,
    );
    await expect(
      owner.mutation(api.transactions.moves.save, { ...sign, phase: "draft", weekKey: "w2" }),
    ).rejects.toThrow(/no week/);
    await expect(
      owner.mutation(api.transactions.moves.save, { ...sign, phase: "draft", playersIn: [] }),
    ).rejects.toThrow(/one player/);
    const stranger = await asStranger(t);
    await expect(stranger.mutation(api.transactions.moves.save, { ...sign, phase: "draft" })).rejects.toThrow(
      /owner/i,
    );
    const id = await owner.mutation(api.transactions.moves.save, { ...sign, phase: "draft" });
    await expect(stranger.mutation(api.transactions.moves.remove, { transactionId: id })).rejects.toThrow(
      /owner/i,
    );
    await expect(stranger.query(api.transactions.forms.teamRoster, { seasonId, teamId: ne })).rejects.toThrow(
      /owner/i,
    );
  });

  test("the form roster lists who is still with the team", async () => {
    const { owner, seasonId, ne, maye } = await setup();
    const before = await owner.query(api.transactions.forms.teamRoster, { seasonId, teamId: ne });
    expect(before.map((p) => p.playerId)).toContain(maye);
    expect(before[0]!.position).toBe("QB");
    await owner.mutation(api.transactions.moves.save, {
      ...blank,
      seasonId,
      type: "release",
      phase: "offseason",
      teamId: ne,
      playersOut: [{ playerId: maye }],
    });
    const after = await owner.query(api.transactions.forms.teamRoster, { seasonId, teamId: ne });
    expect(after.map((p) => p.playerId)).not.toContain(maye);
  });
});

describe("injuries by hand", () => {
  test("log, edit and remove an injury; strangers can't", async () => {
    const { t, owner, seasonId, maye } = await setup();
    const id = await owner.mutation(api.transactions.injuries.save, {
      seasonId,
      player: { playerId: maye },
      weekKey: "w7",
      injuryType: " Concussion ",
      lengthWeeks: 1,
      onIr: false,
    });
    const find = async () =>
      (await owner.query(api.transactions.transactions.injuries, { seasonId })).find((i) => i._id === id);
    expect(await find()).toMatchObject({
      player: { name: "Drake Maye" },
      injuryType: "Concussion",
      isUser: true,
    });
    await owner.mutation(api.transactions.injuries.save, {
      injuryId: id,
      seasonId,
      player: { playerId: maye },
      weekKey: "w7",
      injuryType: "Concussion",
      lengthLabel: "Season",
      onIr: true,
      returnWeekKey: "w12",
      notes: "Out until after the bye",
    });
    expect(await find()).toMatchObject({ onIr: true, lengthLabel: "Season", returnWeekKey: "w12" });
    expect((await find())?.lengthWeeks).toBeUndefined();
    const stranger = await asStranger(t);
    await expect(stranger.mutation(api.transactions.injuries.remove, { injuryId: id })).rejects.toThrow(
      /owner/i,
    );
    await owner.mutation(api.transactions.injuries.remove, { injuryId: id });
    expect(await find()).toBeUndefined();
    await expect(
      owner.mutation(api.transactions.injuries.save, {
        seasonId,
        player: { playerId: maye },
        injuryType: "  ",
        onIr: false,
      }),
    ).rejects.toThrow(/Name the injury/);
  });
});
