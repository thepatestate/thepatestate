import { describe, it, expect } from "vitest";
import { formatDate } from "./format";

describe("formatDate", () => {
  it("formats ISO dates as mono-caps", () => {
    expect(formatDate("2026-08-07T17:15:17+00:00")).toBe("AUG 7, 2026");
    expect(formatDate("2026-01-01T00:30:00+00:00")).toBe("JAN 1, 2026");
  });
});
