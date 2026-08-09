import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mocks.create };
  },
}));

import { validateDraft, findNonVerbatimQuotes, draftCompanion, BYLINE_STAFF, SERIES_VALUES } from "./generate";

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
  it("byline is fixed", () => expect(BYLINE_STAFF).toBe("The Pate State Staff"));
  it("seven series", () => expect(SERIES_VALUES).toHaveLength(7));
});

describe("findNonVerbatimQuotes", () => {
  const transcript = `[00:14] Pate said the Georgia offensive line is a problem and I don't think it gets fixed by November.\n[00:22] He also talked about the schedule.`;

  it("passes a verbatim quote", () => {
    const body = 'Pate said, "the Georgia offensive line is a problem and I don\'t think it gets fixed by November." He moved on.';
    expect(findNonVerbatimQuotes(body, transcript)).toEqual([]);
  });

  it("fails a paraphrase dressed as a quote", () => {
    const body = 'Pate said, "Georgia\'s O-line is broken and will not be fixed before November." He moved on.';
    expect(findNonVerbatimQuotes(body, transcript)).toEqual([
      "Georgia's O-line is broken and will not be fixed before November.",
    ]);
  });

  it("passes with curly quotes and comma/period differences", () => {
    const body = "Pate said, “the Georgia offensive line is a problem and I don’t think it gets fixed by November”, and left it there.";
    expect(findNonVerbatimQuotes(body, transcript)).toEqual([]);
  });

  it("exempts short scare-quotes under 5 words", () => {
    const body = 'Pate called it a "total mess" on air.';
    expect(findNonVerbatimQuotes(body, transcript)).toEqual([]);
  });

});

describe("draftCompanion verbatim-quote gate", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const textRes = (obj: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(obj) }] });
  const input = { title: "t", description: "d", publishedAt: "2026-08-01", series: "general" };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });
  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("skips the verbatim-quote check entirely when no transcript was provided (no retry)", async () => {
    const draft = { ...good, bodyMarkdown: 'Pate said, "this quote appears in no transcript at all." [PULLQUOTE]' };
    mocks.create.mockResolvedValueOnce(textRes(draft));

    const result = await draftCompanion({ ...input, transcriptText: null });

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual(draft);
  });

  it("retries once on a non-verbatim quote, then accepts with lowConfidence: true if still bad", async () => {
    const transcriptText = "[00:10] Pate said the defense is fine and will hold up.";
    const badDraft = { ...good, bodyMarkdown: 'Pate said, "this exact phrase never appears anywhere at all." [PULLQUOTE]' };
    mocks.create.mockResolvedValueOnce(textRes(badDraft)).mockResolvedValueOnce(textRes(badDraft));

    const result = await draftCompanion({ ...input, transcriptText });

    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(result?.lowConfidence).toBe(true);
  });

  it("accepts a clean retry draft without lowConfidence", async () => {
    const transcriptText = "[00:10] Pate said the defense is fine and will hold up in November against anyone.";
    const badDraft = { ...good, bodyMarkdown: 'Pate said, "this exact phrase never appears anywhere at all." [PULLQUOTE]' };
    const cleanDraft = { ...good, bodyMarkdown: "Pate said the defense is fine and will hold up in November against anyone. [PULLQUOTE]" };
    mocks.create.mockResolvedValueOnce(textRes(badDraft)).mockResolvedValueOnce(textRes(cleanDraft));

    const result = await draftCompanion({ ...input, transcriptText });

    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(result?.lowConfidence).toBeUndefined();
  });
});
