// Sanity checks on the built-in test targets.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { TEST_TARGETS } from "./targets";

describe("test targets", () => {
  it("lists the five NASA targets with valid coordinates", () => {
    expect(TEST_TARGETS).toHaveLength(5);
    for (const t of TEST_TARGETS) {
      expect(t.ra).toBeGreaterThanOrEqual(0);
      expect(t.ra).toBeLessThan(360);
      expect(Math.abs(t.dec)).toBeLessThanOrEqual(90);
    }
  });
});
