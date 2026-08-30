import { describe, it, expect, vi, beforeEach } from "vitest";
import { ingestEpisode } from "./ingest";

// Bare vi.fn() (no initial implementation) so the mocks stay loosely typed —
// every call shape below is set explicitly per test/beforeEach via
// mockImplementation/mockResolvedValue, so there's nothing to infer from.
const mocks = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  createIfNotExistsMock: vi.fn(),
  patchCommitMock: vi.fn(),
  articleExistsForEpisode: vi.fn(),
  classifySeries: vi.fn(),
  draftCompanion: vi.fn(),
  fetchTranscript: vi.fn(),
  patchSetMock: vi.fn(),
  v3JoshColumn: vi.fn(),
  v3MayWrite: vi.fn(() => false),
  joshAutoPublish: vi.fn(() => true),
}));

vi.mock("@/lib/sanity", () => ({
  isSanityWriteConfigured: true,
  writeClient: {
    fetch: mocks.fetchMock,
    createIfNotExists: mocks.createIfNotExistsMock,
    patch: (id: string) => ({ set: (fields: Record<string, unknown>) => { mocks.patchSetMock(id, fields); return { commit: mocks.patchCommitMock }; } }),
  },
  articleExistsForEpisode: mocks.articleExistsForEpisode,
  uploadHeroImage: vi.fn(async () => null),
  setArticleHeroImage: vi.fn(async () => undefined),
}));

vi.mock("@/lib/editorial-v3/flags", () => ({ v3MayWrite: mocks.v3MayWrite, joshAutoPublish: mocks.joshAutoPublish }));
vi.mock("@/lib/editorial-v3/production", () => ({ v3JoshColumn: mocks.v3JoshColumn }));
vi.mock("@/lib/hero-image", () => ({ generateArticleHero: vi.fn(async () => null) }));
vi.mock("@/lib/fact-sheet", () => ({ teamFactSheet: vi.fn(async () => "") }));
vi.mock("@/lib/quotes", () => ({ storeQuotes: vi.fn(async () => undefined) }));

vi.mock("@/lib/generate", () => ({
  BYLINE_STAFF: "The Pate State Staff",
  classifySeries: mocks.classifySeries,
  draftCompanion: mocks.draftCompanion,
  extractQuotes: vi.fn(async () => []),
}));

vi.mock("@/lib/transcript", () => ({
  fetchTranscript: mocks.fetchTranscript,
  transcriptToPromptText: vi.fn(() => "[00:00] Josh talks ball for a while."),
}));

const video = {
  id: "abc12345678",
  title: "Weekend Truths: Week 1",
  published: "2026-08-01T00:00:00Z",
  thumbnail: "https://i.ytimg.com/vi/abc12345678/hqdefault.jpg",
};

const GOOD_DRAFT = {
  headline: "Test Headline",
  dek: "Test dek.",
  bodyMarkdown: "Josh opened strong. [PULLQUOTE] End.",
  pullQuote: "You can't fake Saturdays.",
  primaryTeam: "georgia",
  teams: ["georgia"],
  tags: ["week-1"],
  seo: { title: "Test Headline", description: "A test description." },
};

// Default: neither the episode nor the article exists yet.
function defaultFetchImpl() {
  return Promise.resolve(null);
}

describe("ingestEpisode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchMock.mockImplementation(defaultFetchImpl);
    mocks.createIfNotExistsMock.mockResolvedValue({});
    mocks.patchCommitMock.mockResolvedValue({});
    mocks.articleExistsForEpisode.mockResolvedValue(false);
    mocks.classifySeries.mockResolvedValue("general");
    mocks.fetchTranscript.mockResolvedValue(null);
    mocks.draftCompanion.mockResolvedValue(GOOD_DRAFT);
  });

  it("forces byline and workflowState on the article even when the draft tries to smuggle its own", async () => {
    // A buggy or compromised draftCompanion mock tries to sneak in fields
    // that would let a draft self-publish or reassign authorship. ingestEpisode
    // builds the article doc field-by-field rather than spreading the draft,
    // so these must never survive into the write.
    const forged: Record<string, unknown> = {
      ...GOOD_DRAFT,
      byline: "Someone Else",
      workflowState: "published",
    };
    mocks.draftCompanion.mockResolvedValue(forged);

    const result = await ingestEpisode(video);
    expect(result).toBe("created");

    const articleCall = mocks.createIfNotExistsMock.mock.calls.find(
      (call: unknown[]) => (call[0] as { _type?: string })._type === "article"
    );
    expect(articleCall).toBeTruthy();
    const articleDoc = articleCall![0] as Record<string, unknown>;
    // Josh, 2026-08-26: his show columns carry his byline in his voice.
    expect(articleDoc.byline).toBe("Josh Pate");
    expect(articleDoc.workflowState).toBe("ai-drafted");
  });

  it("returns skipped when the deterministic article id already exists", async () => {
    mocks.fetchMock.mockImplementation((_query: string, params?: { id?: string }) => {
      const id = params?.id ?? "";
      if (id.startsWith("episode-")) return Promise.resolve({ _id: id, series: "general" });
      if (id.startsWith("article-")) return Promise.resolve(id); // pre-check finds an existing article
      return Promise.resolve(null);
    });

    const result = await ingestEpisode(video);
    expect(result).toBe("skipped");
    expect(mocks.draftCompanion).not.toHaveBeenCalled();
    expect(
      mocks.createIfNotExistsMock.mock.calls.some(
        (call: unknown[]) => (call[0] as { _type?: string })._type === "article"
      )
    ).toBe(false);
  });

  it("returns failed when draftCompanion throws", async () => {
    mocks.draftCompanion.mockRejectedValue(new Error("anthropic boom"));
    const result = await ingestEpisode(video);
    expect(result).toBe("failed");
  });
// Isaac, 2026-08-30: "I want to auto publish. It doesn't make sense to gate
  // on a human, there is no human to check it right now." A V3 column that
  // passed every gate is promoted to published after creation; a
  // low-confidence one keeps waiting in ai-drafted.
  describe("V3 Josh column auto-publish", () => {
    beforeEach(() => {
      mocks.v3MayWrite.mockReturnValue(true);
      mocks.joshAutoPublish.mockReturnValue(true);
      mocks.fetchTranscript.mockResolvedValue([{ start: 0, dur: 5, text: "Josh talks ball." }]);
    });

    it("publishes a column whose gates all passed", async () => {
      mocks.v3JoshColumn.mockResolvedValue({ ok: true, lowConfidence: false, fields: { headline: "Sol Headline", dek: "Sol dek.", bodyMarkdown: "Body. [PULLQUOTE] More.", pullQuote: "Quote.", primaryTeam: "georgia", teams: ["georgia"], tags: ["engine:v3-additive"], seoTitle: "Sol Headline", seoDescription: "Desc." }, run: {} });
      expect(await ingestEpisode(video)).toBe("created");
      const created = mocks.createIfNotExistsMock.mock.calls.find((c: unknown[]) => (c[0] as { _type?: string })._type === "article")![0] as Record<string, unknown>;
      expect(created.workflowState).toBe("ai-drafted"); // always created drafted first
      const publish = mocks.patchSetMock.mock.calls.find((c: unknown[]) => (c[1] as { workflowState?: string }).workflowState === "published");
      expect(publish).toBeTruthy();
      expect(publish![0]).toBe(created._id);
      expect(typeof (publish![1] as { publishedAt?: string }).publishedAt).toBe("string");
    });

    it("leaves a low-confidence column in ai-drafted", async () => {
      mocks.v3JoshColumn.mockResolvedValue({ ok: true, lowConfidence: true, fields: { headline: "Sol Headline", dek: "Sol dek.", bodyMarkdown: "Body. [PULLQUOTE] More.", pullQuote: "Quote.", primaryTeam: "georgia", teams: ["georgia"], tags: ["engine:v3-additive"], seoTitle: "Sol Headline", seoDescription: "Desc." }, run: {} });
      expect(await ingestEpisode(video)).toBe("created");
      expect(mocks.patchSetMock.mock.calls.some((c: unknown[]) => (c[1] as { workflowState?: string }).workflowState === "published")).toBe(false);
    });

    it("respects EDITORIAL_JOSH_AUTOPUBLISH=false", async () => {
      mocks.joshAutoPublish.mockReturnValue(false);
      mocks.v3JoshColumn.mockResolvedValue({ ok: true, lowConfidence: false, fields: { headline: "Sol Headline", dek: "Sol dek.", bodyMarkdown: "Body. [PULLQUOTE] More.", pullQuote: "Quote.", primaryTeam: "georgia", teams: ["georgia"], tags: ["engine:v3-additive"], seoTitle: "Sol Headline", seoDescription: "Desc." }, run: {} });
      expect(await ingestEpisode(video)).toBe("created");
      expect(mocks.patchSetMock.mock.calls.some((c: unknown[]) => (c[1] as { workflowState?: string }).workflowState === "published")).toBe(false);
    });
  });
});
