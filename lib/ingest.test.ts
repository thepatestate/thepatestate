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
}));

vi.mock("@/lib/sanity", () => ({
  isSanityWriteConfigured: true,
  writeClient: {
    fetch: mocks.fetchMock,
    createIfNotExists: mocks.createIfNotExistsMock,
    patch: () => ({ set: () => ({ commit: mocks.patchCommitMock }) }),
  },
  articleExistsForEpisode: mocks.articleExistsForEpisode,
}));

vi.mock("@/lib/generate", () => ({
  BYLINE_STAFF: "The Pate State Staff",
  classifySeries: mocks.classifySeries,
  draftCompanion: mocks.draftCompanion,
}));

vi.mock("@/lib/transcript", () => ({
  fetchTranscript: mocks.fetchTranscript,
  transcriptToPromptText: vi.fn(() => ""),
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
    // Brief v2 Rule 1: episode adaptations carry the Josh Pate byline (the
    // page renders the "Adapted from The Josh Pate Show" label beside it).
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
});
