import { describe, it, expect } from "vitest";
import { validateDraft, BYLINE_JOSH, SERIES_VALUES } from "./generate";

const good = {
  headline: "Week 1 Truths",
  dek: "What actually mattered.",
  bodyMarkdown: "Josh opened with the point. [EMBED:00:14:22] More. [PULLQUOTE] End.",
  pullQuote: "You can't fake Saturdays.",
  primaryTeam: "georgia",
  teams: ["georgia", "ohio-state"],
  tags: ["week-1"],
  seo: { title: "Week 1 Truths", description: "What mattered in week one." },
};

describe("validateDraft", () => {
  it("accepts a complete draft", () => {
    expect(validateDraft(good)).toEqual(good);
  });
  it("rejects missing fields", () => {
    const { headline, ...rest } = good;
    expect(validateDraft(rest)).toBeNull();
  });
  it("rejects wrong types", () => {
    expect(validateDraft({ ...good, teams: "georgia" })).toBeNull();
  });
  it("rejects empty body", () => {
    expect(validateDraft({ ...good, bodyMarkdown: " " })).toBeNull();
  });
  it("rejects a body with no PULLQUOTE marker", () => {
    expect(validateDraft({ ...good, bodyMarkdown: "words only" })).toBeNull();
  });
});

describe("constants", () => {
  it("byline is fixed", () => expect(BYLINE_JOSH).toBe("Josh Pate"));
  it("seven series", () => expect(SERIES_VALUES).toHaveLength(7));
});
