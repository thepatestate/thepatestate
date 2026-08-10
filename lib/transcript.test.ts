import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseTimedText, parseSrv3, transcriptToPromptText, fetchTranscriptSupadata } from "./transcript";

const xml = readFileSync(new URL("./__fixtures__/timedtext.xml", import.meta.url), "utf8");
const srv3Xml = readFileSync(new URL("./__fixtures__/srv3.xml", import.meta.url), "utf8");

describe("parseTimedText", () => {
  it("parses segments with numeric starts", () => {
    const segs = parseTimedText(xml);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toEqual({ start: 0.32, text: "welcome back to the front porch" });
  });
  it("decodes double-escaped entities", () => {
    expect(parseTimedText(xml)[1].text).toBe("let's talk about the top ten & who survives");
  });
  it("returns [] for malformed input", () => {
    expect(parseTimedText("")).toEqual([]);
    expect(parseTimedText("<html>nope</html>")).toEqual([]);
  });
});

describe("parseSrv3", () => {
  it("parses <p t> segments, converting ms to seconds", () => {
    const segs = parseSrv3(srv3Xml);
    expect(segs).toHaveLength(3);
    expect(segs[0].start).toBe(0.32);
  });
  it("strips <s> word-fragment tags and joins their text", () => {
    expect(parseSrv3(srv3Xml)[0].text).toBe("welcome back to the front porch");
  });
  it("decodes double-escaped entities", () => {
    expect(parseSrv3(srv3Xml)[1].text).toBe("let's talk about the top ten & who survives");
  });
  it("collapses internal whitespace runs to a single space", () => {
    expect(parseSrv3(srv3Xml)[2].text).toBe("first up: Georgia");
  });
  it("returns [] for malformed input", () => {
    expect(parseSrv3("")).toEqual([]);
    expect(parseSrv3("<html>nope</html>")).toEqual([]);
  });
  it("skips empty segments", () => {
    const xmlWithEmpty = `<timedtext><body><p t="100"></p><p t="200">hi</p></body></timedtext>`;
    const segs = parseSrv3(xmlWithEmpty);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({ start: 0.2, text: "hi" });
  });
});

describe("fetchTranscriptSupadata", () => {
  const originalKey = process.env.SUPADATA_API_KEY;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.SUPADATA_API_KEY = "test-key";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    process.env.SUPADATA_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("maps content[] to segments, converting ms offsets to seconds", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        lang: "en",
        availableLangs: ["en"],
        content: [
          { lang: "en", text: "welcome back to the front porch", offset: 320, duration: 2000 },
          { lang: "en", text: "let's talk ball", offset: 65500, duration: 3000 },
        ],
      }),
    });

    const segs = await fetchTranscriptSupadata("abc123");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("api.supadata.ai/v1/transcript");
    expect(String(url)).toContain(encodeURIComponent("https://www.youtube.com/watch?v=abc123"));
    expect((opts as RequestInit & { headers: Record<string, string> }).headers["x-api-key"]).toBe(
      "test-key"
    );
    expect(segs).toEqual([
      { start: 0.32, text: "welcome back to the front porch" },
      { start: 65.5, text: "let's talk ball" },
    ]);
  });

  it("returns null when content is missing", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ lang: "en" }) });
    expect(await fetchTranscriptSupadata("abc123")).toBeNull();
  });

  it("returns null when content is an empty array", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ content: [] }) });
    expect(await fetchTranscriptSupadata("abc123")).toBeNull();
  });

  it("returns null on a non-200 response", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    expect(await fetchTranscriptSupadata("abc123")).toBeNull();
  });

  it("returns null and never throws when fetch rejects", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    await expect(fetchTranscriptSupadata("abc123")).resolves.toBeNull();
  });

  it("is skipped (null, no fetch call) when SUPADATA_API_KEY is unset", async () => {
    delete process.env.SUPADATA_API_KEY;
    const segs = await fetchTranscriptSupadata("abc123");
    expect(segs).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("polls the job endpoint on a 202/jobId response until completed", async () => {
    vi.useFakeTimers();
    try {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ jobId: "job-1" }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "queued" }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: "completed",
            content: [{ lang: "en", text: "hi", offset: 1000, duration: 500 }],
          }),
        });

      const promise = fetchTranscriptSupadata("abc123");
      // Advance past the two poll-interval sleeps (initial job lookup fires immediately).
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(2000);
      const segs = await promise;
      expect(segs).toEqual([{ start: 1, text: "hi" }]);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns null when a polled job reports failed", async () => {
    vi.useFakeTimers();
    try {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ jobId: "job-1" }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "failed" }) });

      const promise = fetchTranscriptSupadata("abc123");
      await vi.advanceTimersByTimeAsync(2000);
      expect(await promise).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("transcriptToPromptText", () => {
  it("formats [MM:SS] lines", () => {
    const out = transcriptToPromptText([{ start: 65.5, text: "hello porch" }]);
    expect(out).toBe("[01:05] hello porch");
  });
  it("caps total length at 60000 chars", () => {
    const segs = Array.from({ length: 5000 }, (_, i) => ({ start: i, text: "x".repeat(20) }));
    expect(transcriptToPromptText(segs).length).toBeLessThanOrEqual(60000);
  });
});

import { parseSrt } from "./transcript";

describe("parseSrt", () => {
  it("parses standard SubRip blocks into segments", () => {
    const srt = `1
00:00:01,240 --> 00:00:03,900
Welcome back to the show.

2
00:01:02,000 --> 00:01:05,500
Georgia is <i>different</i>
this year.

`;
    const segs = parseSrt(srt);
    expect(segs).toEqual([
      { start: 1.24, text: "Welcome back to the show." },
      { start: 62, text: "Georgia is different this year." },
    ]);
  });

  it("returns [] for garbage input", () => {
    expect(parseSrt("not srt at all")).toEqual([]);
  });
});
