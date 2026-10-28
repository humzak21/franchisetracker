import { describe, expect, it } from "vitest";
import { MAX_EDGE, fitWithin } from "./image";

describe("fitWithin", () => {
  it("caps the long edge of a landscape console screenshot", () => {
    expect(fitWithin(3840, 2160)).toEqual({ width: MAX_EDGE, height: 1152 });
  });

  it("caps the long edge of a portrait phone screenshot", () => {
    expect(fitWithin(1179, 2556)).toEqual({ width: 945, height: MAX_EDGE });
  });

  it("never upscales a small image", () => {
    expect(fitWithin(1920, 1080)).toEqual({ width: 1920, height: 1080 });
  });
});
