import { describe, expect, it } from "vitest";

describe("isOffTopic (wire feed filter)", async () => {
  const { isOffTopic } = await import("@/lib/wire");
  const it2 = it;
  it2("rejects other sports and high school", () => {
    expect(isOffTopic("Yahoo Sports compiles 2026-27 NCAA D1 wrestling schedules")).toBe(true);
    expect(isOffTopic("Five-star hoops recruit commits", "")).toBe(true);
    expect(isOffTopic("Local high school preview", "")).toBe(true);
    expect(isOffTopic("NBA free agency tracker")).toBe(true);
  });
  it2("keeps college football", () => {
    expect(isOffTopic("Lane Kiffin declines comment on LSU-Ole Miss lawsuit")).toBe(false);
    expect(isOffTopic("Georgia lands five-star EDGE for 2027 class")).toBe(false);
    expect(isOffTopic("Anonymous coaches split on Michigan QB")).toBe(false);
  });
});
