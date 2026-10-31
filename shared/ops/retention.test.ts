import { describe, expect, it } from "vitest";
import { DEFAULT_KEEP_DAYS, KEEP_FOREVER, retentionCutoffs } from "./retention";

const DAY = 86_400_000;
const NOW = 1000 * DAY;

describe("retentionCutoffs", () => {
  it("keeps committed screenshots for the default until told otherwise", () => {
    expect(retentionCutoffs(undefined, NOW)?.committed).toBe(NOW - DEFAULT_KEEP_DAYS * DAY);
  });

  it("drops rejected ones sooner, never later than the owner's setting", () => {
    expect(retentionCutoffs(90, NOW)?.rejected).toBe(NOW - 30 * DAY);
    expect(retentionCutoffs(10, NOW)?.rejected).toBe(NOW - 10 * DAY);
  });

  it("deletes nothing when set to keep forever", () => {
    expect(retentionCutoffs(KEEP_FOREVER, NOW)).toBeNull();
  });
});
