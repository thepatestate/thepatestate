# Episode Ingest + Companion Pipeline (Sub-project C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every new episode on Josh Pate's channel automatically becomes an AI-drafted companion article in a Sanity approval queue; approved articles publish to thepatestate.com/notebook/<slug> within a minute; backfill the 5 most recent episodes at launch.

**Architecture:** Detection via YouTube PubSubHubbub webhook + pg_cron RSS polling fallback → `lib/ingest.ts` orchestrator (idempotent) → Sanity `episode`+`article` documents (workflowState gates publishing) → Claude (`claude-sonnet-5`) for series classification + companion drafts via structured outputs → hosted Sanity Studio is the approval dashboard → Sanity webhook hits `/api/revalidate` to publish + revalidate ISR tags.

**Tech Stack:** Next.js 16 (existing), `@sanity/client` + `@anthropic-ai/sdk` (new runtime deps), separate `/studio` workspace (sanity v4), Supabase pg_cron + pg_net, YouTube Data API v3, vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-08-episode-pipeline-design.md`. Behavior per operations manual §2/§12/§13/§23 (`docs/pate-state-operations-manual.md`).
- Channel: `UCg-q_MDeWQrjizr1VPLEpYg`. Site: `SITE_URL` from `@/lib/site`.
- **NOTHING publishes without a human click** — the pipeline creates articles ONLY in `workflowState: "ai-drafted"`. The publish transition happens exclusively in `/api/revalidate` in response to a Studio-approved state.
- **Byline is forced from config** — `BYLINE_JOSH = "Josh Pate"` in `lib/generate.ts`; model output NEVER sets the byline.
- **Anthropic API rules (from the claude-api reference — the manual's `claude-sonnet-4-6`/temperature guidance is stale):** model `claude-sonnet-5`; NO `temperature`/`top_p`/`top_k` (they 400 on Sonnet 5); adaptive thinking is the default (omit `thinking`); structured outputs via `output_config: {format: {type: "json_schema", schema}}` with `additionalProperties: false` + `required` everywhere; `max_tokens` 8192 for drafts, 256 for the classifier; classifier runs `output_config: {effort: "low"}`; SDK's built-in retries (default 2) cover 429/5xx; one extra retry on schema/validation failure, then fail soft.
- Runtime deps after this project: `next react react-dom @supabase/supabase-js @supabase/ssr @sanity/client @anthropic-ai/sdk` — nothing else. `/studio` has its OWN package.json (excluded from root tsconfig + Vercel build).
- Prompts live in `/prompts/*.md`, verbatim from manual §12 (global preamble + 12.1 + 12.2) and §23 voice guide, loaded at runtime with `fs.readFileSync` (server-only).
- Internal API routes require header `x-cron-secret: $CRON_SECRET` (except the PuSH webhook GET challenge, which must echo unauthenticated per spec). `/api/revalidate` requires `?secret=$REVALIDATE_SECRET`.
- Secrets in `.env.local` + Vercel env vars only. Never in git, chat, or reports. Never print env values.
- Fail-soft everywhere: caption failure → `lowConfidence: true` draft from title+description; Claude failure → episode saved without article (poll retries); webhook handler returns 200 to YouTube no matter what.
- Branch `build/episode-pipeline` off main. Repo git identity `thepatestate` (configured). Commit per task. `npm run build && npm test` green on every task.
- Existing interfaces: `lib/youtube.ts` (`parseFeed`, `getVideos`, `Video`, `CHANNEL_URL`), `lib/site.ts` (`SITE_URL`), `lib/format.ts` (`formatDate`), components (`PreseasonChip`, etc.), wireframe CSS fully in `app/globals.css`.

---

### Task 1: Secrets + Vercel env wiring (Isaac + controller — NOT a subagent task)

- [ ] **Isaac:** `console.anthropic.com` (new Gmail) → Billing → add card + ~$5 credit → API Keys → create → paste after `ANTHROPIC_API_KEY=` in `.env.local`.
- [ ] **Isaac:** Google Cloud (The Pate State project) → APIs & Services → Library → enable **YouTube Data API v3** → Credentials → Create credentials → API key → paste after `YOUTUBE_API_KEY=`.
- [ ] **Controller:** generate `CRON_SECRET` and `REVALIDATE_SECRET` (32+ random hex each, `openssl rand -hex 32`), append to `.env.local`.
- [ ] **Controller:** push to Vercel env (production+preview) via API with `VERCEL_TOKEN`: `ANTHROPIC_API_KEY`, `YOUTUBE_API_KEY`, `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_WRITE_TOKEN`, `CRON_SECRET`, `REVALIDATE_SECRET` (all `type: "encrypted"` except project id/dataset).
- [ ] **Verify:** `curl -s https://api.anthropic.com/v1/models -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01" | grep -c claude` ≥ 1; a YouTube Data API `videos?part=contentDetails&id=uPSenzdOS6Y&key=...` call returns 200.

Tasks 2–8 may run before this completes (code degrades gracefully); Tasks 9's backfill requires it.

---

### Task 2: Sanity Studio workspace + schemas + hosted deploy

**Files:**
- Create: `studio/package.json`, `studio/sanity.config.ts`, `studio/sanity.cli.ts`, `studio/schemas/episode.ts`, `studio/schemas/article.ts`, `studio/schemas/index.ts`, `studio/.gitignore`
- Modify: root `tsconfig.json` (add `"studio"` to `exclude`), root `.gitignore` (add `studio/node_modules`, `studio/dist`)

**Interfaces:**
- Produces: Sanity document types `episode` and `article` (fields below — Task 3's TS types MUST mirror them exactly); hosted Studio at `https://thepatestate.sanity.studio`.

- [ ] **Step 1: Scaffold `studio/`** (own workspace — NOT a root dependency):

`studio/package.json`:
```json
{
  "name": "thepatestate-studio",
  "private": true,
  "scripts": { "dev": "sanity dev", "deploy": "sanity deploy" },
  "dependencies": {
    "sanity": "^4",
    "@sanity/vision": "^4",
    "react": "^19",
    "react-dom": "^19",
    "styled-components": "^6"
  }
}
```

`studio/sanity.config.ts`:
```ts
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./schemas";

export default defineConfig({
  name: "thepatestate",
  title: "The Pate State",
  projectId: "kuv6jjyo",
  dataset: "production",
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title("The Newsroom")
          .items([
            S.listItem()
              .title("⏳ Approval Queue")
              .child(
                S.documentList()
                  .title("Awaiting Approval")
                  .filter('_type == "article" && workflowState == "ai-drafted"')
              ),
            S.listItem()
              .title("✅ Approved / Published")
              .child(
                S.documentList()
                  .title("Approved & Published")
                  .filter('_type == "article" && workflowState != "ai-drafted"')
              ),
            S.divider(),
            S.documentTypeListItem("episode").title("Episodes"),
          ]),
    }),
    visionTool(),
  ],
  schema: { types: schemaTypes },
});
```

`studio/sanity.cli.ts`:
```ts
import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: { projectId: "kuv6jjyo", dataset: "production" },
  studioHost: "thepatestate",
});
```

- [ ] **Step 2: Write the schemas.**

`studio/schemas/episode.ts`:
```ts
import { defineType, defineField } from "sanity";

export default defineType({
  name: "episode",
  title: "Episode",
  type: "document",
  fields: [
    defineField({ name: "ytId", title: "YouTube ID", type: "string", validation: (r) => r.required() }),
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({ name: "description", type: "text" }),
    defineField({ name: "publishedAt", type: "datetime", validation: (r) => r.required() }),
    defineField({ name: "thumbnailUrl", type: "url" }),
    defineField({ name: "durationSeconds", type: "number" }),
    defineField({ name: "viewCount", type: "number" }),
    defineField({
      name: "series", type: "string",
      options: { list: ["weekend-truths", "poll-day", "sit-down", "picks-drop", "espn-friday", "mailbag", "general"] },
      initialValue: "general",
    }),
    defineField({ name: "transcriptStatus", type: "string", options: { list: ["fetched", "unavailable"] } }),
  ],
  preview: { select: { title: "title", subtitle: "series", media: undefined } },
});
```

`studio/schemas/article.ts`:
```ts
import { defineType, defineField } from "sanity";

export default defineType({
  name: "article",
  title: "Article",
  type: "document",
  fields: [
    defineField({ name: "headline", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", type: "slug", options: { source: "headline", maxLength: 80 }, validation: (r) => r.required() }),
    defineField({ name: "dek", type: "text", rows: 2 }),
    defineField({
      name: "bodyMarkdown", title: "Body (Markdown — [EMBED:HH:MM:SS] and [PULLQUOTE] markers)",
      type: "text", rows: 30, validation: (r) => r.required(),
    }),
    defineField({ name: "pullQuote", type: "text", rows: 2 }),
    defineField({ name: "episode", type: "reference", to: [{ type: "episode" }] }),
    defineField({ name: "byline", type: "string", readOnly: true }),
    defineField({
      name: "workflowState", title: "Workflow",
      type: "string",
      options: { list: ["ai-drafted", "approved", "published"], layout: "radio" },
      initialValue: "ai-drafted",
      validation: (r) => r.required(),
    }),
    defineField({ name: "lowConfidence", title: "⚠ Low confidence (no transcript)", type: "boolean", initialValue: false, readOnly: true }),
    defineField({ name: "primaryTeam", type: "string" }),
    defineField({ name: "teams", type: "array", of: [{ type: "string" }] }),
    defineField({ name: "tags", type: "array", of: [{ type: "string" }] }),
    defineField({ name: "seoTitle", type: "string" }),
    defineField({ name: "seoDescription", type: "text", rows: 2 }),
    defineField({ name: "publishedAt", type: "datetime" }),
  ],
  preview: { select: { title: "headline", subtitle: "workflowState" } },
});
```

`studio/schemas/index.ts`:
```ts
import episode from "./episode";
import article from "./article";

export const schemaTypes = [episode, article];
```

- [ ] **Step 3: Exclude from root build.** Root `tsconfig.json` `exclude` gains `"studio"`; root `.gitignore` gains `studio/node_modules/` and `studio/dist/`. Verify root `npm run build` still passes and does NOT compile studio files.

- [ ] **Step 4: Install + deploy the hosted Studio.** `cd studio && npm install && npx sanity deploy` (CLI is already authenticated; `studioHost` pins `thepatestate.sanity.studio`). Verify the URL loads (curl 200/redirect-to-login).

- [ ] **Step 5: Commit** — `git add studio tsconfig.json .gitignore && git commit -m "feat(studio): sanity schemas + approval-queue structure, hosted deploy"`

---

### Task 3: Sanity client lib + slug util (TDD)

**Files:**
- Create: `lib/sanity.ts`, `lib/slug.ts`, `lib/slug.test.ts`
- Modify: `package.json` (npm install)

**Interfaces:**
- Produces (consumed by Tasks 5, 6, 8):
  - `slugify(headline: string): string` — lowercase kebab, ≤80 chars, no leading/trailing dash
  - Types `SanityEpisode`, `SanityArticle` (mirror Task 2 fields; article includes `episode` dereferenced as `{ ytId, title, durationSeconds } | null` in read queries)
  - `readClient` (CDN, published-only) / `writeClient` (token, no CDN) — writeClient is null-safe: `isSanityWriteConfigured: boolean`
  - `getPublishedArticles(limit?: number): Promise<SanityArticle[]>`
  - `getArticleBySlug(slug: string): Promise<SanityArticle | null>`
  - `getEpisodeByYtId(ytId: string): Promise<{ _id: string } | null>`
  - `getEpisodesWithoutArticles(): Promise<Array<{ _id: string; ytId: string }>>`
  - `articleExistsForEpisode(episodeId: string): Promise<boolean>`

- [ ] **Step 1:** `npm install @sanity/client @anthropic-ai/sdk`

- [ ] **Step 2: Failing tests** — `lib/slug.test.ts`:

```ts
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
```

- [ ] **Step 3:** RED run (`npm test` → module not found), then implement `lib/slug.ts`:

```ts
export function slugify(headline: string): string {
  const s = headline
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return s || "article";
}
```

GREEN run.

- [ ] **Step 4: Implement `lib/sanity.ts`**

```ts
import { createClient } from "@sanity/client";

const projectId = process.env.SANITY_PROJECT_ID || "kuv6jjyo";
const dataset = process.env.SANITY_DATASET || "production";
const token = process.env.SANITY_WRITE_TOKEN;

export const isSanityWriteConfigured = Boolean(token);

export const readClient = createClient({
  projectId, dataset, apiVersion: "2026-08-01", useCdn: true, perspective: "published",
});

export const writeClient = createClient({
  projectId, dataset, apiVersion: "2026-08-01", useCdn: false, token,
});

export interface SanityEpisode {
  _id: string;
  ytId: string;
  title: string;
  description?: string;
  publishedAt: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  viewCount?: number;
  series: string;
  transcriptStatus?: "fetched" | "unavailable";
}

export interface SanityArticle {
  _id: string;
  headline: string;
  slug: { current: string };
  dek?: string;
  bodyMarkdown: string;
  pullQuote?: string;
  byline: string;
  workflowState: "ai-drafted" | "approved" | "published";
  lowConfidence?: boolean;
  primaryTeam?: string;
  teams?: string[];
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  publishedAt?: string;
  episode?: { ytId: string; title: string; durationSeconds?: number; series?: string } | null;
}

const ARTICLE_FIELDS = `_id, headline, slug, dek, bodyMarkdown, pullQuote, byline,
  workflowState, lowConfidence, primaryTeam, teams, tags, seoTitle, seoDescription, publishedAt,
  "episode": episode->{ ytId, title, durationSeconds, series }`;

export async function getPublishedArticles(limit = 20): Promise<SanityArticle[]> {
  try {
    return await readClient.fetch(
      `*[_type == "article" && workflowState == "published"] | order(publishedAt desc)[0...$limit]{ ${ARTICLE_FIELDS} }`,
      { limit },
      { next: { revalidate: 300, tags: ["articles"] } } as never
    );
  } catch {
    return [];
  }
}

export async function getArticleBySlug(slug: string): Promise<SanityArticle | null> {
  try {
    return await readClient.fetch(
      `*[_type == "article" && workflowState == "published" && slug.current == $slug][0]{ ${ARTICLE_FIELDS} }`,
      { slug },
      { next: { revalidate: 300, tags: ["articles", `article:${slug}`] } } as never
    );
  } catch {
    return null;
  }
}

export async function getEpisodeByYtId(ytId: string): Promise<{ _id: string } | null> {
  return writeClient.fetch(`*[_type == "episode" && ytId == $ytId][0]{ _id }`, { ytId });
}

export async function getEpisodesWithoutArticles(): Promise<Array<{ _id: string; ytId: string }>> {
  return writeClient.fetch(
    `*[_type == "episode" && count(*[_type == "article" && references(^._id)]) == 0]{ _id, ytId }`
  );
}

export async function articleExistsForEpisode(episodeId: string): Promise<boolean> {
  const n = await writeClient.fetch(`count(*[_type == "article" && references($id)])`, { id: episodeId });
  return n > 0;
}
```

(Note: `@sanity/client` in Next passes fetch options through; the `as never` cast quiets its option typing without a wrapper. The read functions are the ONLY Sanity access site pages use.)

- [ ] **Step 5:** `npm run build && npm test` green (build must pass with no Sanity env vars — reads hit the public dataset by project id).

- [ ] **Step 6: Commit** — `git add lib package*.json && git commit -m "feat: sanity clients, queries, slug util (TDD)"`

---

### Task 4: Transcript lib (TDD)

**Files:**
- Create: `lib/transcript.ts`, `lib/transcript.test.ts`, `lib/__fixtures__/timedtext.xml`

**Interfaces:**
- Produces: `interface TranscriptSegment { start: number; text: string }`; `parseTimedText(xml: string): TranscriptSegment[]`; `fetchTranscript(ytId: string): Promise<TranscriptSegment[] | null>` (null on ANY failure — never throws); `transcriptToPromptText(segs: TranscriptSegment[]): string` (lines of `[MM:SS] text`, capped at 60,000 chars).

- [ ] **Step 1: Create the fixture** `lib/__fixtures__/timedtext.xml` (representative of YouTube's timedtext format — write it verbatim):

```xml
<?xml version="1.0" encoding="utf-8" ?><transcript><text start="0.32" dur="4.2">welcome back to the front porch</text><text start="4.52" dur="5.1">let&amp;#39;s talk about the top ten &amp;amp; who survives</text><text start="9.62" dur="3.8">first up: Georgia</text></transcript>
```

- [ ] **Step 2: Failing tests** — `lib/transcript.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseTimedText, transcriptToPromptText } from "./transcript";

const xml = readFileSync(new URL("./__fixtures__/timedtext.xml", import.meta.url), "utf8");

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
```

- [ ] **Step 3:** RED run, then implement `lib/transcript.ts`:

```ts
export interface TranscriptSegment {
  start: number;
  text: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function parseTimedText(xml: string): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  const re = /<text start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const text = decodeEntities(decodeEntities(m[2])).replace(/<[^>]+>/g, "").trim();
    if (text) out.push({ start: parseFloat(m[1]), text });
  }
  return out;
}

export function transcriptToPromptText(segs: TranscriptSegment[]): string {
  const lines: string[] = [];
  let total = 0;
  for (const s of segs) {
    const mm = String(Math.floor(s.start / 60)).padStart(2, "0");
    const ss = String(Math.floor(s.start % 60)).padStart(2, "0");
    const line = `[${mm}:${ss}] ${s.text}`;
    if (total + line.length + 1 > 60000) break;
    lines.push(line);
    total += line.length + 1;
  }
  return lines.join("\n");
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";

/** Unofficial caption fetch: watch page -> captionTracks -> timedtext XML. Null on any failure. */
export async function fetchTranscript(ytId: string): Promise<TranscriptSegment[] | null> {
  try {
    const page = await fetch(`https://www.youtube.com/watch?v=${ytId}`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en" },
      cache: "no-store",
    });
    if (!page.ok) return null;
    const html = await page.text();
    const trackMatch = html.match(/"captionTracks":(\[.*?\])/);
    if (!trackMatch) return null;
    const tracks = JSON.parse(trackMatch[1].replace(/\\u0026/g, "&")) as Array<{
      baseUrl: string;
      languageCode?: string;
      kind?: string;
    }>;
    const track =
      tracks.find((t) => t.languageCode?.startsWith("en") && t.kind !== "asr") ??
      tracks.find((t) => t.languageCode?.startsWith("en")) ??
      tracks[0];
    if (!track?.baseUrl) return null;
    const xmlRes = await fetch(track.baseUrl, { headers: { "User-Agent": UA }, cache: "no-store" });
    if (!xmlRes.ok) return null;
    const segs = parseTimedText(await xmlRes.text());
    return segs.length > 0 ? segs : null;
  } catch {
    return null;
  }
}
```

GREEN run.

- [ ] **Step 4 (manual, in report):** run a one-off node/tsx check against the real video `uPSenzdOS6Y` and report whether a transcript came back (either outcome is acceptable — the fallback path exists precisely because this endpoint is unofficial; do NOT fail the task on a null).

- [ ] **Step 5: Commit** — `git add lib && git commit -m "feat: transcript fetch + timedtext parser (TDD)"`

---

### Task 5: Prompts + generation lib (TDD on validation)

**Files:**
- Create: `prompts/global-preamble.md`, `prompts/series-classifier.md`, `prompts/companion-article.md`, `lib/generate.ts`, `lib/generate.test.ts`

**Interfaces:**
- Consumes: `SanityEpisode` shape (Task 3), `transcriptToPromptText` (Task 4).
- Produces (consumed by Task 6):
  - `BYLINE_JOSH = "Josh Pate"`
  - `SERIES_VALUES` (the 7 series slugs)
  - `classifySeries(input: { title: string; description: string; publishedAt: string }): Promise<string>` (falls back to `"general"` on any failure)
  - `interface CompanionDraft { headline: string; dek: string; bodyMarkdown: string; pullQuote: string; primaryTeam: string; teams: string[]; tags: string[]; seo: { title: string; description: string } }`
  - `draftCompanion(input: { title: string; description: string; publishedAt: string; series: string; transcriptText: string | null }): Promise<CompanionDraft | null>` (null after retries — never throws)
  - `validateDraft(raw: unknown): CompanionDraft | null` (pure, TDD-covered)

- [ ] **Step 1: Write the prompt files** — copy VERBATIM from `docs/pate-state-operations-manual.md`:
  - `prompts/global-preamble.md`: the §12 "Global system preamble for ALL generation calls" paragraph, followed by the §23 Voice Guide v2 section (all three paragraphs + Do/Don't + bylines note).
  - `prompts/series-classifier.md`: §12.1 text, expanded to instructions: classify into exactly one of `weekend-truths | poll-day | sit-down | picks-drop | espn-friday | mailbag | general` using title, description, and US-Eastern weekday of the publish date; the §2.3 weekday hints (Mon weekend-truths, Tue poll-day, Wed sit-down, Thu picks-drop, Fri espn-friday); title cues override weekday.
  - `prompts/companion-article.md`: §12.2 schema description + instructions verbatim ("capture Josh's actual takes faithfully — this publishes under his byline after his approval; do not invent takes he didn't say; structure = his strongest argument first, evidence, the honest counterpoint, the kicker line"), plus: 600–1100 words; 1–3 `[EMBED:HH:MM:SS]` markers at the transcript moments being discussed (only when a transcript is provided; otherwise NO embed markers beyond `[EMBED:00:00]` once, at the top); exactly one `[PULLQUOTE]` marker; never fabricate statistics, quotes, or facts not present in the source material; when only title+description are available, keep the piece short (300–500 words) and clearly grounded in what's actually known.

- [ ] **Step 2: Failing tests** — `lib/generate.test.ts` (pure validator only — no API calls in tests):

```ts
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
```

- [ ] **Step 3:** RED run, then implement `lib/generate.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const BYLINE_JOSH = "Josh Pate";
export const SERIES_VALUES = [
  "weekend-truths", "poll-day", "sit-down", "picks-drop", "espn-friday", "mailbag", "general",
] as const;

const MODEL = "claude-sonnet-5";

function prompt(name: string): string {
  return readFileSync(join(process.cwd(), "prompts", name), "utf8");
}

function client(): Anthropic | null {
  return process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
}

export interface CompanionDraft {
  headline: string;
  dek: string;
  bodyMarkdown: string;
  pullQuote: string;
  primaryTeam: string;
  teams: string[];
  tags: string[];
  seo: { title: string; description: string };
}

export function validateDraft(raw: unknown): CompanionDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const d = raw as Record<string, unknown>;
  const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
  const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
  const seo = d.seo as Record<string, unknown> | undefined;
  if (
    !isStr(d.headline) || !isStr(d.dek) || !isStr(d.bodyMarkdown) || !isStr(d.pullQuote) ||
    typeof d.primaryTeam !== "string" || !isStrArr(d.teams) || !isStrArr(d.tags) ||
    !seo || !isStr(seo.title) || !isStr(seo.description)
  ) return null;
  if (!d.bodyMarkdown.includes("[PULLQUOTE]")) return null;
  return {
    headline: d.headline, dek: d.dek, bodyMarkdown: d.bodyMarkdown, pullQuote: d.pullQuote,
    primaryTeam: d.primaryTeam, teams: d.teams, tags: d.tags,
    seo: { title: seo.title, description: seo.description },
  };
}

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    dek: { type: "string" },
    bodyMarkdown: { type: "string" },
    pullQuote: { type: "string" },
    primaryTeam: { type: "string" },
    teams: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    seo: {
      type: "object",
      properties: { title: { type: "string" }, description: { type: "string" } },
      required: ["title", "description"],
      additionalProperties: false,
    },
  },
  required: ["headline", "dek", "bodyMarkdown", "pullQuote", "primaryTeam", "teams", "tags", "seo"],
  additionalProperties: false,
} as const;

function textOf(res: Anthropic.Message): string {
  const block = res.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

export async function classifySeries(input: {
  title: string; description: string; publishedAt: string;
}): Promise<string> {
  const c = client();
  if (!c) return "general";
  try {
    const weekday = new Date(input.publishedAt).toLocaleDateString("en-US", {
      weekday: "long", timeZone: "America/New_York",
    });
    const res = await c.messages.create({
      model: MODEL,
      max_tokens: 256,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: { series: { type: "string", enum: [...SERIES_VALUES] } },
            required: ["series"],
            additionalProperties: false,
          },
        },
      },
      system: prompt("series-classifier.md"),
      messages: [{
        role: "user",
        content: `Title: ${input.title}\nWeekday (ET): ${weekday}\nDescription:\n${input.description.slice(0, 1500)}`,
      }],
    });
    const parsed = JSON.parse(textOf(res)) as { series?: string };
    return SERIES_VALUES.includes(parsed.series as never) ? (parsed.series as string) : "general";
  } catch {
    return "general";
  }
}

export async function draftCompanion(input: {
  title: string; description: string; publishedAt: string; series: string; transcriptText: string | null;
}): Promise<CompanionDraft | null> {
  const c = client();
  if (!c) return null;
  const system = `${prompt("global-preamble.md")}\n\n${prompt("companion-article.md")}`;
  const user = [
    `Episode title: ${input.title}`,
    `Series: ${input.series}`,
    `Published: ${input.publishedAt}`,
    `Description:\n${input.description.slice(0, 3000)}`,
    input.transcriptText
      ? `Transcript (timestamped):\n${input.transcriptText}`
      : `NO TRANSCRIPT AVAILABLE — draft from the title and description only, per your instructions.`,
  ].join("\n\n");

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await c.messages.create({
        model: MODEL,
        max_tokens: 8192,
        output_config: { format: { type: "json_schema", schema: DRAFT_SCHEMA } },
        system,
        messages: [{ role: "user", content: user }],
      });
      const draft = validateDraft(JSON.parse(textOf(res)));
      if (draft) return draft;
    } catch {
      // SDK already retried 429/5xx internally; loop covers schema/parse misses
    }
  }
  return null;
}
```

GREEN run.

- [ ] **Step 4 (live smoke, only if ANTHROPIC_API_KEY present):** a one-off tsx script calls `classifySeries` on the real latest episode title and reports the series in the task report (do not commit the script). If the key is absent, note it and move on.

- [ ] **Step 5:** `npm run build && npm test` green. **Commit** — `git add prompts lib && git commit -m "feat: prompt library + claude generation with structured outputs (TDD validation)"`

---

### Task 6: Ingest orchestrator + API routes

**Files:**
- Create: `lib/ingest.ts`, `app/api/youtube/webhook/route.ts`, `app/api/ingest/poll/route.ts`, `app/api/ingest/backfill/route.ts`, `app/api/youtube/subscribe/route.ts`, `app/api/ingest/enrich/route.ts`, `lib/cron-auth.ts`

**Interfaces:**
- Consumes: Tasks 3–5 exports; `parseFeed` + `Video` from `@/lib/youtube`; `slugify`.
- Produces: `ingestEpisode(v: Video): Promise<"created" | "skipped" | "episode-only">`; the five routes (contract in each step). All fail-soft.

- [ ] **Step 1: `lib/cron-auth.ts`**

```ts
import { NextResponse } from "next/server";

export function requireCronSecret(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
```

- [ ] **Step 2: `lib/ingest.ts`**

```ts
import type { Video } from "@/lib/youtube";
import { writeClient, isSanityWriteConfigured, getEpisodeByYtId, articleExistsForEpisode } from "@/lib/sanity";
import { fetchTranscript, transcriptToPromptText } from "@/lib/transcript";
import { classifySeries, draftCompanion, BYLINE_JOSH } from "@/lib/generate";
import { slugify } from "@/lib/slug";

export interface IngestVideo extends Video {
  description?: string;
}

/**
 * Idempotent per-episode pipeline: upsert episode -> classify -> transcript ->
 * draft -> article in "ai-drafted". Returns what happened. Never throws.
 */
export async function ingestEpisode(v: IngestVideo): Promise<"created" | "skipped" | "episode-only"> {
  if (!isSanityWriteConfigured) return "skipped";
  try {
    // 1. Upsert episode
    let episode = await getEpisodeByYtId(v.id);
    if (!episode) {
      const series = await classifySeries({
        title: v.title, description: v.description ?? "", publishedAt: v.published,
      });
      const created = await writeClient.create({
        _type: "episode",
        ytId: v.id,
        title: v.title,
        description: v.description ?? "",
        publishedAt: v.published,
        thumbnailUrl: v.thumbnail,
        series,
      });
      episode = { _id: created._id };
    }

    // 2. Skip if an article already exists (idempotency)
    if (await articleExistsForEpisode(episode._id)) return "skipped";

    // 3. Transcript (fail-soft)
    const segs = await fetchTranscript(v.id);
    const transcriptText = segs ? transcriptToPromptText(segs) : null;
    await writeClient.patch(episode._id).set({ transcriptStatus: segs ? "fetched" : "unavailable" }).commit();

    // 4. Draft
    const ep = await writeClient.fetch<{ series?: string }>(
      `*[_id == $id][0]{ series }`, { id: episode._id }
    );
    const draft = await draftCompanion({
      title: v.title, description: v.description ?? "", publishedAt: v.published,
      series: ep?.series ?? "general", transcriptText,
    });
    if (!draft) return "episode-only"; // poll cycle retries later

    // 5. Article in the approval queue — NEVER any state but ai-drafted here
    await writeClient.create({
      _type: "article",
      headline: draft.headline,
      slug: { _type: "slug", current: slugify(draft.headline) },
      dek: draft.dek,
      bodyMarkdown: draft.bodyMarkdown,
      pullQuote: draft.pullQuote,
      episode: { _type: "reference", _ref: episode._id },
      byline: BYLINE_JOSH,
      workflowState: "ai-drafted",
      lowConfidence: !transcriptText,
      primaryTeam: draft.primaryTeam,
      teams: draft.teams,
      tags: draft.tags,
      seoTitle: draft.seo.title,
      seoDescription: draft.seo.description,
    });
    return "created";
  } catch {
    return "episode-only";
  }
}
```

- [ ] **Step 3: PuSH webhook** — `app/api/youtube/webhook/route.ts`

```ts
import { NextResponse } from "next/server";
import { ingestEpisode } from "@/lib/ingest";

export const maxDuration = 300;

// PubSubHubbub subscription verification: echo hub.challenge (unauthenticated by spec)
export async function GET(request: Request) {
  const challenge = new URL(request.url).searchParams.get("hub.challenge");
  if (challenge) return new Response(challenge, { status: 200 });
  return NextResponse.json({ ok: true });
}

// Notification: Atom entry for the channel. Always 200 (never trigger PuSH unsubscribe).
export async function POST(request: Request) {
  try {
    const xml = await request.text();
    if (!xml.includes("UCg-q_MDeWQrjizr1VPLEpYg")) return new Response("ignored", { status: 200 });
    const id = xml.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1];
    const title = xml.match(/<title>([^<]+)<\/title>/g)?.slice(-1)[0]?.replace(/<\/?title>/g, "");
    const published = xml.match(/<published>([^<]+)<\/published>/)?.[1];
    if (id) {
      await ingestEpisode({
        id,
        title: title ?? "New episode",
        published: published ?? new Date().toISOString(),
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      });
    }
  } catch {
    // swallow — always 200
  }
  return new Response("ok", { status: 200 });
}
```

- [ ] **Step 4: Poll + backfill** — `app/api/ingest/poll/route.ts`

```ts
import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { parseFeed } from "@/lib/youtube";
import { ingestEpisode } from "@/lib/ingest";

export const maxDuration = 300;
const FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=UCg-q_MDeWQrjizr1VPLEpYg";

export async function POST(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  try {
    const res = await fetch(FEED_URL, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ ok: false }, { status: 200 });
    const videos = parseFeed(await res.text());
    const results: Record<string, string> = {};
    for (const v of videos.slice(0, 5)) {
      results[v.id] = await ingestEpisode(v);
    }
    return NextResponse.json({ ok: true, results });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
```

`app/api/ingest/backfill/route.ts` — same shape, but `?count=N` (default 5, max 10) and it processes `videos.filter(isEpisode).slice(0, count)` (import `isEpisode` from `@/lib/youtube` — backfill full episodes, not shorts). Same cron-secret guard, same result map.

- [ ] **Step 5: PuSH subscribe** — `app/api/youtube/subscribe/route.ts`

```ts
import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { SITE_URL } from "@/lib/site";

export async function POST(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  const body = new URLSearchParams({
    "hub.mode": "subscribe",
    "hub.topic": "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UCg-q_MDeWQrjizr1VPLEpYg",
    "hub.callback": `${SITE_URL}/api/youtube/webhook`,
    "hub.verify": "async",
  });
  const res = await fetch("https://pubsubhubbub.appspot.com/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return NextResponse.json({ ok: res.ok, status: res.status });
}
```

- [ ] **Step 6: Enrich** — `app/api/ingest/enrich/route.ts`: cron-secret guarded; fetch all episode `ytId`s from Sanity (`*[_type == "episode"]{ _id, ytId }`), chunk by 50, call `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=<ids>&key=$YOUTUBE_API_KEY`, parse ISO8601 durations (`PT1H12M44S` → seconds — small inline parser), patch `durationSeconds` + `viewCount` per episode. Fail-soft per chunk; skip entirely (200, `{ok:false, reason:"no-key"}`) when `YOUTUBE_API_KEY` is unset.

- [ ] **Step 7:** `npm run build && npm test` — all routes listed as dynamic (ƒ), all existing pages untouched (static). Curl checks with the dev server: webhook GET echoes `hub.challenge=abc123`; poll without secret → 401; poll with wrong secret → 401.

- [ ] **Step 8: Commit** — `git add lib app && git commit -m "feat: ingest engine — webhook, poll, backfill, subscribe, enrich routes"`

---

### Task 7: pg_cron schedules (SQL migration)

**Files:**
- Create: `supabase/migrations/0002_pipeline_cron.sql`

**Interfaces:** the cron jobs call Task 6's routes with the `x-cron-secret` header.

- [ ] **Step 1: Write `supabase/migrations/0002_pipeline_cron.sql`.** The secret cannot live in versioned SQL — the migration reads it from a Vault-style settings table populated once by the controller:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- One-row config table holding the cron secret (populated out-of-band, never in git)
create table if not exists private_cron_config (
  id int primary key default 1 check (id = 1),
  cron_secret text not null
);
alter table private_cron_config enable row level security;
-- no policies: service-role/superuser only

create or replace function call_site_endpoint(path text) returns void
language plpgsql security definer as $$
declare
  secret text;
begin
  select cron_secret into secret from private_cron_config where id = 1;
  if secret is null then return; end if;
  perform net.http_post(
    url := 'https://thepatestate.com' || path,
    headers := jsonb_build_object('x-cron-secret', secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

select cron.schedule('poll-youtube', '*/15 * * * *', $$select call_site_endpoint('/api/ingest/poll')$$);
select cron.schedule('enrich-episodes', '0 10 * * *', $$select call_site_endpoint('/api/ingest/enrich')$$);
select cron.schedule('renew-push-lease', '0 8 * * 1', $$select call_site_endpoint('/api/youtube/subscribe')$$);
```

(Times are UTC: 10:00 UTC ≈ 6 AM ET, 08:00 UTC Monday for lease renewal. pg_cron runs in UTC on Supabase.)

- [ ] **Step 2: Apply** — `set -a && source .env.local && set +a && npx -y supabase db push --db-url "$SUPABASE_DB_URL" --yes`. Then insert the secret (controller runs via the Supabase Management API query endpoint — NOT the subagent; mark deferred in the report and the controller does it): `insert into private_cron_config (id, cron_secret) values (1, '<CRON_SECRET>') on conflict (id) do update set cron_secret = excluded.cron_secret;`

- [ ] **Step 3: Verify** — query `select jobname, schedule from cron.job;` (3 rows) via the same mechanism (controller step; subagent notes it).

- [ ] **Step 4: Commit** — `git add supabase && git commit -m "feat: pg_cron schedules for poll, enrich, push-lease renewal"`

---

### Task 8: Article route + Notebook/home integration + revalidate

**Files:**
- Create: `app/notebook/[slug]/page.tsx`, `components/ArticleBody.tsx`, `lib/markers.ts`, `lib/markers.test.ts`, `app/api/revalidate/route.ts`
- Modify: `app/notebook/page.tsx` (real lead/grid when published articles exist), `app/page.tsx` (notebook section real articles when available), `app/sitemap.ts` (append published article URLs)
- Reference: `wireframes/article.html` (design source for the article page)

**Interfaces:**
- Consumes: `getPublishedArticles`, `getArticleBySlug`, `SanityArticle` (Task 3); `formatDate`; existing CSS classes (article.html's style block is the same shared block, already in globals.css).
- Produces: `parseMarkers(body: string): MarkerSegment[]` where `MarkerSegment = { type: "text"; markdown: string } | { type: "embed"; seconds: number } | { type: "pullquote" }`; `tsToSeconds("HH:MM:SS" | "MM:SS"): number`.

- [ ] **Step 1: TDD `lib/markers.ts`** — failing tests first:

```ts
import { describe, it, expect } from "vitest";
import { parseMarkers, tsToSeconds } from "./markers";

describe("tsToSeconds", () => {
  it("parses HH:MM:SS", () => expect(tsToSeconds("01:02:03")).toBe(3723));
  it("parses MM:SS", () => expect(tsToSeconds("14:22")).toBe(862));
  it("returns 0 for junk", () => expect(tsToSeconds("nope")).toBe(0));
});

describe("parseMarkers", () => {
  it("splits text, embeds, and pullquote in order", () => {
    const segs = parseMarkers("Intro. [EMBED:00:14:22] Middle. [PULLQUOTE] End.");
    expect(segs).toEqual([
      { type: "text", markdown: "Intro." },
      { type: "embed", seconds: 862 },
      { type: "text", markdown: "Middle." },
      { type: "pullquote" },
      { type: "text", markdown: "End." },
    ]);
  });
  it("handles a body with no markers", () => {
    expect(parseMarkers("Just words.")).toEqual([{ type: "text", markdown: "Just words." }]);
  });
});
```

Implementation:

```ts
export type MarkerSegment =
  | { type: "text"; markdown: string }
  | { type: "embed"; seconds: number }
  | { type: "pullquote" };

export function tsToSeconds(ts: string): number {
  const parts = ts.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function parseMarkers(body: string): MarkerSegment[] {
  const out: MarkerSegment[] = [];
  const re = /\[EMBED:([\d:]+)\]|\[PULLQUOTE\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const before = body.slice(last, m.index).trim();
    if (before) out.push({ type: "text", markdown: before });
    out.push(m[0] === "[PULLQUOTE]" ? { type: "pullquote" } : { type: "embed", seconds: tsToSeconds(m[1]) });
    last = m.index + m[0].length;
  }
  const tail = body.slice(last).trim();
  if (tail) out.push({ type: "text", markdown: tail });
  return out;
}
```

- [ ] **Step 2: `components/ArticleBody.tsx`** — server component: takes `{ article: SanityArticle }`; renders `parseMarkers(article.bodyMarkdown)` — text segments as paragraphs (split on double newline; render `**bold**`/`*italic*` with a tiny inline formatter — no markdown dependency; headings `## ` → `h3.display`), embed segments as the episode's youtube-nocookie iframe with `?start=<seconds>` (skip if no episode ref), pullquote segment as the wireframe's pull-quote block styled from `wireframes/article.html` (use its classes). Byline row: `article.byline` + `formatDate(article.publishedAt)` + series badge.

- [ ] **Step 3: `app/notebook/[slug]/page.tsx`** — port the article page frame from `wireframes/article.html` (page-head with kicker/headline/dek, article column, episode card at the foot linking `youtube.com/watch?v=<ytId>`, related links to `/poll` and `/teams/<primaryTeam>` if it's `georgia` else `/teams`). `generateMetadata` from seoTitle/seoDescription; NewsArticle JSON-LD (`headline`, `datePublished`, `author: { "@type": "Person", "name": article.byline }`); `notFound()` when `getArticleBySlug` returns null. ISR: `export const revalidate = 300` + the fetch tags from Task 3.

- [ ] **Step 4: Notebook index + homepage integration.** In `app/notebook/page.tsx`: fetch `getPublishedArticles(7)`; when non-empty, the lead-story slot renders articles[0] (headline/dek/link) and the feat-grid renders the next up-to-3 as real links to `/notebook/<slug>`, and the page-head chip changes to plain (no "opens with the season" label); the wire strip and other engine-less sections keep their demo+chip state. When empty: page unchanged. Same pattern in `app/page.tsx`'s notebook section (latest 3). Keep all DEMO fallbacks intact.

- [ ] **Step 5: `app/api/revalidate/route.ts`** — the publish gate:

```ts
import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { writeClient, isSanityWriteConfigured } from "@/lib/sanity";

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!process.env.REVALIDATE_SECRET || url.searchParams.get("secret") !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    if (isSanityWriteConfigured) {
      // Promote approved -> published (sets publishedAt once)
      const approved = await writeClient.fetch<Array<{ _id: string }>>(
        `*[_type == "article" && workflowState == "approved"]{ _id }`
      );
      for (const a of approved) {
        await writeClient
          .patch(a._id)
          .set({ workflowState: "published", publishedAt: new Date().toISOString() })
          .commit();
      }
    }
    revalidateTag("articles");
    revalidatePath("/notebook");
    revalidatePath("/");
    revalidatePath("/sitemap.xml");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
```

- [ ] **Step 6: Sitemap** — `app/sitemap.ts` becomes async; appends `getPublishedArticles(100)` as `${SITE_URL}/notebook/${slug.current}` entries after the static routes.

- [ ] **Step 7:** `npm run build && npm test` green; `/notebook/[slug]` present in build output; static pages still static (`/notebook` may go ISR — acceptable: it must re-render as articles publish; verify `/` stays static/ISR). Curl: `/api/revalidate` without secret → 401.

- [ ] **Step 8: Commit** — `git add lib app components && git commit -m "feat: article pages, notebook/home live integration, publish+revalidate gate"`

---

### Task 9: Deploy, wire, backfill, E2E (controller + Isaac)

**Files:** none (operations; docs update allowed)

Prereqs: Task 1 keys live; all code tasks merged to `build/episode-pipeline`.

- [ ] **Step 1:** Final whole-branch review (per SDD skill), fix wave, then merge → main → push → Vercel deploy green.
- [ ] **Step 2:** Insert `CRON_SECRET` into `private_cron_config` + verify 3 cron jobs scheduled (Task 7's deferred controller steps).
- [ ] **Step 3:** Create the Sanity webhook via API (controller, CLI token): `POST https://api.sanity.io/v2021-06-07/hooks/projects/kuv6jjyo` with `{ "type": "document", "name": "publish-approved", "url": "https://thepatestate.com/api/revalidate?secret=<REVALIDATE_SECRET>", "dataset": "production", "httpMethod": "POST", "apiVersion": "v2025-02-19", "includeDrafts": false, "filter": "_type == 'article' && workflowState == 'approved'" }`.
- [ ] **Step 4:** Subscribe PuSH: `curl -X POST https://thepatestate.com/api/youtube/subscribe -H "x-cron-secret: $CRON_SECRET"` → verify YouTube calls the GET challenge (check Vercel logs / hub diagnostics at `https://pubsubhubbub.appspot.com/subscription-details?...`).
- [ ] **Step 5:** **Backfill:** `curl -X POST "https://thepatestate.com/api/ingest/backfill?count=5" -H "x-cron-secret: $CRON_SECRET"` → expect 5 `created` results (minutes; maxDuration 300). Verify 5 articles sit in the Studio approval queue.
- [ ] **Step 6:** **Isaac approves one article** at `thepatestate.sanity.studio` (open the Approval Queue → read → set Workflow to `approved` → Publish the document). Within a minute: article live at `/notebook/<slug>`, Notebook lead story shows it, homepage notebook section shows it.
- [ ] **Step 7:** Verify embeds deep-link with `?start=`, JSON-LD present, sitemap includes the article, `x-vercel-cache` still HIT on `/`.
- [ ] **Step 8:** Append a "Runbook" section to `docs/pate-state-operations-manual-notes.md` (new file): §18 seeds — transcript endpoint breakage symptom (`lowConfidence` articles), poll retry behavior, PuSH lease renewal, how to re-run backfill. Commit `docs: pipeline runbook seeds`.
