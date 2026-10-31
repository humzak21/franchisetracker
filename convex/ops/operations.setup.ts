/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { vi } from "vitest";
import { api, internal } from "../_generated/api";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

/** The sample franchise, with a way to send a screenshot of a given hash and look its set up. */
export async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR + 1)!._id;
  const franchiseId = active.franchise._id;
  const context = { source: "web", targetKey: "standings", seasonId } as const;
  const image = () =>
    t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(64)], { type: "image/png" })));
  const send = async (hash: string) => {
    const [setKey] = await owner.mutation(api.ingestion.uploads.create, {
      storageIds: [await image()],
      hashes: [hash],
      ...context,
    });
    return setKey!;
  };
  const set = async (setKey: string) =>
    (await owner.query(api.ingestion.inbox.list, {})).find((s) => s.setKey === setKey);
  const finish = () => t.finishAllScheduledFunctions(vi.runAllTimers);
  return { t, owner, franchiseId, seasonId, context, image, send, set, finish };
}
