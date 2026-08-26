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

describe("placePullQuoteMarker", () => {
  it("puts a missing marker after the paragraph that shares the most words with the pull quote", async () => {
    const { placePullQuoteMarker } = await import("./generate");
    const out = placePullQuoteMarker({ pullQuote: "Georgia is built to survive a season.", bodyMarkdown: "Opening thought about Texas.\n\nGeorgia is built to survive a whole season and that is the point.\n\nClosing line." }) as { bodyMarkdown: string };
    expect(out.bodyMarkdown.split(/\n{2,}/)[2]).toBe("[PULLQUOTE]");
  });
  it("strips a marker when the pull quote is empty", async () => {
    const { placePullQuoteMarker } = await import("./generate");
    const out = placePullQuoteMarker({ pullQuote: "", bodyMarkdown: "One.\n\n[PULLQUOTE]\n\nTwo." }) as { bodyMarkdown: string };
    expect(out.bodyMarkdown).toBe("One.\n\nTwo.");
  });
});

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
  it("rejects a pull quote whose marker is missing from the body", () => {
    expect(validateDraft({ ...good, bodyMarkdown: "words only" })).toBeNull();
  });
  it("accepts an empty pull quote with no marker (no quote manufactured for the slot)", () => {
    const d = { ...good, pullQuote: "", bodyMarkdown: "Josh opened with the point. [EMBED:00:14:22] More." };
    expect(validateDraft(d)).toEqual(d);
  });
  it("rejects an empty pull quote that still leaves a marker behind", () => {
    expect(validateDraft({ ...good, pullQuote: "" })).toBeNull();
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

  it("passes an interior ellipsis cut when both parts are verbatim", () => {
    const body = 'Pate said, "the Georgia offensive line is a problem … it gets fixed by November." He moved on.';
    expect(findNonVerbatimQuotes(body, transcript)).toEqual([]);
  });

  it("fails an ellipsis cut whose parts are not verbatim", () => {
    const body = 'Pate said, "the Georgia offensive line is elite … fixed well before September." He moved on.';
    expect(findNonVerbatimQuotes(body, transcript)).toEqual([
      "the Georgia offensive line is elite … fixed well before September.",
    ]);
  });

  it("passes a quote that spans a caption-segment boundary (real-world YouTube auto-captions run 2-4 words/line)", () => {
    // transcriptToPromptText() prepends a [MM:SS] marker to every short caption line, so a
    // genuine verbatim quote spanning two adjacent lines has a literal timestamp token
    // landing mid-quote in the raw transcript text — normalizeForCompare must strip it.
    const choppyTranscript = "[00:00] Of course, this is the most all-in of\n[00:01] all-in teams and in the portal going and";
    const body = 'He said, "the most all-in of all-in teams" on air.';
    expect(findNonVerbatimQuotes(body, choppyTranscript)).toEqual([]);
  });

  it("passes a quote interrupted by a non-speech caption annotation like [music]", () => {
    const captionedTranscript = "[00:38] words, when you think back [music] to\n[00:39] Texas Georgia games and you think about";
    const body = 'He said, "when you think back to Texas Georgia games and you think about" it.';
    expect(findNonVerbatimQuotes(body, captionedTranscript)).toEqual([]);
  });

  it("ignores a stray JSON-escaped quote mark left inside a quote block", () => {
    const transcript = "[12:23] the number one game in the country that I'd want to take anyone to this year though is Miami at Notre Dame";
    expect(findNonVerbatimQuotes('[QUOTE:00:12:23]The number one game in the country that I\'d want to take anyone to this year, though, is Miami at Notre Dame.\\"[/QUOTE]', transcript)).toEqual([]);
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

describe("v1.2 quote pipeline", () => {
  const transcript = "[00:10] I think Georgia's line is the [00:12] best in America at the thing [00:15] that matters most and you can [00:18] book that right now folks";

  it("QUOTE marker contents are verbatim-checked", () => {
    const body = `Pate said it plainly. [QUOTE:00:10]I think Georgia's line is the best in America[/QUOTE] and he did not hedge.`;
    expect(findNonVerbatimQuotes(body, transcript)).toEqual([]);
  });

  it("non-verbatim QUOTE marker contents are flagged", () => {
    const body = `[QUOTE:00:10]Georgia has definitely got the greatest line in the country[/QUOTE]`;
    expect(findNonVerbatimQuotes(body, transcript)).toHaveLength(1);
  });

  it("QUOTE markers are stripped before scanning stray quotation marks", () => {
    const body = `He also said "book that right now folks" after [QUOTE:00:12]best in America at the thing that matters most[/QUOTE] ended.`;
    expect(findNonVerbatimQuotes(body, transcript)).toEqual([]);
  });
});
