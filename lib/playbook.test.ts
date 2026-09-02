import { describe, it, expect } from "vitest";
import { signUid, verifyUid, renderPlaybookHtml, renderPlaybookText } from "./playbook";

const content = {
  episode: { ytId: "abcdefghijk", title: "Weekend Truths", thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg" },
  articles: [{ headline: "The Case For Texas", dek: "A look.", slug: "the-case-for-texas" }],
};
const opts = { intro: "Here's the Quad this morning.", unsubscribeUrl: "https://thepatestate.com/api/playbook/unsubscribe?uid=u1&sig=s1" };

describe("uid signing", () => {
  it("roundtrips", () => { const s = signUid("user-123"); expect(verifyUid("user-123", s)).toBe(true); });
  it("rejects tampering", () => { expect(verifyUid("user-124", signUid("user-123"))).toBe(false); });
  it("rejects garbage lengths", () => { expect(verifyUid("user-123", "ff")).toBe(false); });
});

describe("renderPlaybookHtml", () => {
  it("includes episode link, article link, intro, unsubscribe once (escaped)", () => {
    const html = renderPlaybookHtml(content, opts);
    expect(html).toContain("youtube.com/watch?v=abcdefghijk");
    expect(html).toContain("/notebook/the-case-for-texas");
    expect(html).toContain(opts.intro);
    // opts.unsubscribeUrl contains "&", which the renderer entity-escapes at
    // its href attribute interpolation site — assert against the escaped form.
    const escapedUnsubscribeUrl = opts.unsubscribeUrl.replace(/&/g, "&amp;");
    expect(html.split(escapedUnsubscribeUrl).length - 1).toBe(1);
  });
  it("omits articles section when empty", () => {
    const html = renderPlaybookHtml({ ...content, articles: [] }, opts);
    expect(html).not.toContain("From the Notebook");
  });
  it("escapes double quotes in episode title to prevent attribute injection", () => {
    const evil = { ...content, episode: { ...content.episode, title: 'He Said "Go" onerror=x' } };
    const html = renderPlaybookHtml(evil, opts);
    expect(html).not.toContain('" onerror=');
    expect(html).toContain("&quot;");
  });
  it("escapes double quotes in thumbnailUrl to prevent attribute injection", () => {
    const evil = {
      ...content,
      episode: { ...content.episode, thumbnailUrl: 'https://i.ytimg.com/vi/x/hq.jpg" onerror=x' },
    };
    const html = renderPlaybookHtml(evil, opts);
    expect(html).not.toContain('" onerror=');
    expect(html).toContain("&quot; onerror=x");
  });
});

describe("renderPlaybookText", () => {
  it("carries the same links", () => {
    const t = renderPlaybookText(content, opts);
    expect(t).toContain("youtube.com/watch?v=abcdefghijk");
    expect(t).toContain("/notebook/the-case-for-texas");
  });
});
