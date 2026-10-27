import { describe, expect, test } from "vitest";
import { errorFingerprint, isExpectedError } from "./errors";

describe("errorFingerprint", () => {
  test("groups repeats whose numbers, ids and line numbers differ", () => {
    const a = errorFingerprint(
      "Cannot read properties of undefined (reading 'year') in game jd7abc123def456ghi789jkl0",
      "TypeError: x\n    at ScheduleRow (http://localhost/assets/index-abc.js:12:345)\n    at div",
    );
    const b = errorFingerprint(
      "Cannot read properties of undefined (reading 'year') in game kx9zzz123def456ghi789jkl1",
      "TypeError: x\n    at ScheduleRow (http://localhost/assets/index-abc.js:99:1)",
    );
    expect(a).toBe(b);
    expect(errorFingerprint("Week 3 failed")).toBe(errorFingerprint("Week 12 failed"));
    expect(errorFingerprint("A")).not.toBe(errorFingerprint("B"));
  });
});

describe("isExpectedError", () => {
  test("app errors with a code are expected; anything else is a bug", () => {
    expect(isExpectedError({ data: { code: "not_found", message: "Game not found" } })).toBe(true);
    expect(isExpectedError({ data: { code: "unauthenticated" } })).toBe(true);
    expect(isExpectedError(new TypeError("x is undefined"))).toBe(false);
    expect(isExpectedError("boom")).toBe(false);
  });
});
