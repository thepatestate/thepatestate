import { describe, expect, it } from "vitest";

describe("isOffTopic (wire feed filter)", async () => {
  const { isOffTopic } = await import("@/lib/wire");
  const it2 = it;
  it2("rejects other sports and high school", () => {
    expect(isOffTopic("Yahoo Sports compiles 2026-27 NCAA D1 wrestling schedules")).toBe(true);
    expect(isOffTopic("Five-star hoops recruit commits", "")).toBe(true);
    expect(isOffTopic("Local high school preview", "")).toBe(true);
    expect(isOffTopic("NBA free agency tracker")).toBe(true);
    expect(isOffTopic("LSU Adds Donovan Dent to Run Will Wade's 2026-27 Backcourt")).toBe(true);
    expect(isOffTopic("IMG Academy's opening win", "The prep football powerhouse opened its season Friday")).toBe(true);
    expect(isOffTopic("Riggs stays in Trucks for 2027 as Front Row delays his Cup debut", "The Truck Series driver will wait a year")).toBe(true);
  });
  it2("keeps college football", () => {
    expect(isOffTopic("Lane Kiffin declines comment on LSU-Ole Miss lawsuit")).toBe(false);
    expect(isOffTopic("Georgia lands five-star EDGE for 2027 class")).toBe(false);
    expect(isOffTopic("Anonymous coaches split on Michigan QB")).toBe(false);
  });
});
