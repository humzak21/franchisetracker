import { afterEach, describe, expect, test } from "vitest";
import { TEST_OWNER_EMAIL, isOwnerEmail } from "./owner";

afterEach(() => {
  delete process.env.OWNER_EMAILS;
  delete process.env.AUTH_TEST_MODE;
});

describe("isOwnerEmail", () => {
  test("fails closed with no allowlist", () => {
    expect(isOwnerEmail("owner@example.com")).toBe(false);
  });
  test("matches the allowlist case-insensitively", () => {
    process.env.OWNER_EMAILS = " Owner@Example.com , other@example.com";
    expect(isOwnerEmail("owner@example.com")).toBe(true);
    expect(isOwnerEmail("OTHER@example.com")).toBe(true);
    expect(isOwnerEmail("stranger@example.com")).toBe(false);
    expect(isOwnerEmail(undefined)).toBe(false);
  });
  test("admits the test owner only in test mode", () => {
    expect(isOwnerEmail(TEST_OWNER_EMAIL)).toBe(false);
    process.env.AUTH_TEST_MODE = "true";
    expect(isOwnerEmail(TEST_OWNER_EMAIL)).toBe(true);
  });
});
