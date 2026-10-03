import { describe, expect, it } from "vitest";
import { matchOffsetAfterDeletion } from "./AltMatches";

describe("Alt match deletion refresh", () => {
  it("keeps the current page when other matches remain", () => {
    expect(matchOffsetAfterDeletion({ offset: 25, limit: 25, total: 30 }, 5)).toBe(25);
  });

  it("returns to the preceding page after deleting the last visible match", () => {
    expect(matchOffsetAfterDeletion({ offset: 25, limit: 25, total: 26 }, 1)).toBe(0);
  });

  it("does not move before the first page", () => {
    expect(matchOffsetAfterDeletion({ offset: 0, limit: 25, total: 1 }, 1)).toBe(0);
  });
});
