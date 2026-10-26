/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { asOwner, asStranger } from "./lib/testOwner";
import schema from "./schema";

const modules = import.meta.glob("/convex/**/*.ts");

afterEach(() => {
  delete process.env.OWNER_EMAILS;
  delete process.env.AUTH_TEST_MODE;
});

describe("owner gate", () => {
  test("signed-out callers are refused", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.league.seed.seedTeams, {});
    await expect(t.query(api.franchise.franchises.getActive, {})).rejects.toThrow(/Sign in required/);
    await expect(t.query(api.league.teams.list, {})).rejects.toThrow(/Sign in required/);
  });

  test("a signed-in account that is not the owner is refused", async () => {
    const t = convexTest(schema, modules);
    const stranger = await asStranger(t);
    await expect(stranger.query(api.league.teams.list, {})).rejects.toThrow(/Not the owner/);
  });

  test("removing the owner's email from the allowlist locks them out", async () => {
    const t = convexTest(schema, modules);
    const owner = await asOwner(t);
    await expect(owner.query(api.account.me, {})).resolves.toMatchObject({ email: "owner@example.com" });
    process.env.OWNER_EMAILS = "someone-else@example.com";
    await expect(owner.query(api.account.me, {})).rejects.toThrow(/Not the owner/);
  });
});

describe("account:authInfo", () => {
  test("offers test sign-in only when AUTH_TEST_MODE is on", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.account.authInfo, {})).toEqual({ testSignIn: false });
    process.env.AUTH_TEST_MODE = "true";
    expect(await t.query(api.account.authInfo, {})).toEqual({ testSignIn: true });
  });
});
