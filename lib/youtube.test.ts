import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseFeed, isEpisode, videoUrl } from "./youtube";

const xml = readFileSync(new URL("./__fixtures__/feed.xml", import.meta.url), "utf8");

describe("parseFeed", () => {
  it("parses every entry in the real feed", () => {
    const videos = parseFeed(xml);
    expect(videos.length).toBeGreaterThanOrEqual(10);
    for (const v of videos) {
      expect(v.id).toMatch(/^[\w-]{11}$/);
      expect(v.title.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(v.published))).toBe(false);
      expect(v.thumbnail).toMatch(/^https:\/\//);
    }
  });

  it("returns newest first", () => {
    const videos = parseFeed(xml);
    const times = videos.map((v) => Date.parse(v.published));
    expect(times[0]).toBeGreaterThanOrEqual(times[times.length - 1]);
  });

  it("decodes XML entities in titles", () => {
    const entry = `<feed><entry><yt:videoId>abcdefghijk</yt:videoId><title>Pate&amp;#39;s &amp;quot;Truth&amp;quot; &amp;amp; More</title><published>2026-08-07T00:00:00+00:00</published><media:thumbnail url="https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg"/></entry></feed>`
      .replaceAll("&amp;", "&"); // literal &#39; &quot; &amp; in the XML
    expect(parseFeed(entry)[0].title).toBe(`Pate's "Truth" & More`);
  });

  it("returns [] for malformed input", () => {
    expect(parseFeed("")).toEqual([]);
    expect(parseFeed("<html>not a feed</html>")).toEqual([]);
    expect(parseFeed("<feed><entry><title>no id</title></entry></feed>")).toEqual([]);
  });
});

describe("isEpisode", () => {
  const base = { id: "abcdefghijk", published: "2026-08-07T00:00:00+00:00", thumbnail: "https://x" };
  it("treats show-branded titles as episodes", () => {
    expect(isEpisode({ ...base, title: "Week 1 Recap - Josh Pate's College Football Show" })).toBe(true);
  });
  it("treats other uploads as clips", () => {
    expect(isEpisode({ ...base, title: "Texas is about to GO OFF 📈" })).toBe(false);
  });
});

describe("videoUrl", () => {
  it("builds a watch URL", () => {
    expect(videoUrl("abcdefghijk")).toBe("https://www.youtube.com/watch?v=abcdefghijk");
  });
});
