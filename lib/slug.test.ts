import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("kebab-cases and lowercases", () => {
    expect(slugify("Week 1 Overreactions Are Coming")).toBe("week-1-overreactions-are-coming");
  });
  it("strips punctuation and collapses dashes", () => {
    expect(slugify("Texas — Ready? (Yes... & No!)")).toBe("texas-ready-yes-no");
  });
  it("caps at 80 chars without trailing dash", () => {
    const s = slugify("word ".repeat(40));
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
  });
  it("never returns empty", () => {
    expect(slugify("!!!")).toBe("article");
  });
});
