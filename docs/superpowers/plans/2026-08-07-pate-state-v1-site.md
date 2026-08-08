# The Pate State v1 Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A three-page Next.js site (Home, The Show, About) that auto-populates from Josh Pate's YouTube RSS feed via ISR and funnels every click to his channel.

**Architecture:** Next.js App Router at the repo root. One server-side module (`lib/youtube.ts`) fetches and parses the channel's public RSS feed with `revalidate: 21600`; server components consume its typed `Video[]`. No database, no API keys, no client-side fetching. Design system ported verbatim from the static mockups in `thepatestatesite/`.

**Tech Stack:** Next.js (latest, App Router, TypeScript), React, vitest (dev only). No other runtime dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-07-pate-state-site-design.md`. Read it before starting.
- YouTube channel ID: `UCg-q_MDeWQrjizr1VPLEpYg` (handle `@JoshPateCFB`, "Josh Pate's College Football Show"). Feed URL: `https://www.youtube.com/feeds/videos.xml?channel_id=UCg-q_MDeWQrjizr1VPLEpYg`
- Apple Podcasts URL (verified real): `https://podcasts.apple.com/us/podcast/josh-pates-college-football-show/id1485905502`
- Subscribe URL: `https://www.youtube.com/@JoshPateCFB?sub_confirmation=1`
- ISR revalidation: `21600` seconds (6 hours), exactly once, in `lib/youtube.ts`.
- **De-faking rule (from spec):** anything that claims to be live data must actually come from the feed, or it gets cut/reworded as evergreen. No fake view counts, poll rankings, leaderboards, subscriber numbers, citizen counts, or mailbag quotes anywhere.
- Runtime deps limited to `next react react-dom`. Dev deps: `typescript @types/node @types/react @types/react-dom vitest`.
- The repo has a local git identity (`thepatestate <thepatestate@users.noreply.github.com>`) already configured — do not change it, do not commit with any other identity.
- Design source of truth: `thepatestatesite/*.html` mockups. Fonts: Big Shoulders Display (display), Newsreader (body), IBM Plex Mono (mono) — loaded via `next/font/google`, NOT `<link>` tags.
- Node 20+. Commit after every task at minimum.

---

### Task 1: Scaffold the Next.js app at the repo root

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

**Interfaces:**
- Produces: a building Next.js App Router project; `npm run build`, `npm run dev`, `npm test` scripts.

Do NOT use `create-next-app` — the directory is non-empty (mockups, docs, .git). Scaffold by hand.

- [ ] **Step 1: Write `.gitignore`**

```gitignore
node_modules/
.next/
out/
.env*
.DS_Store
*.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 2: Write `package.json`** (versions resolved by install in Step 5)

```json
{
  "name": "thepatestate",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "thepatestatesite"]
}
```

- [ ] **Step 4: Write minimal `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, empty `app/globals.css`**

`next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "*.ytimg.com" }] },
};

export default nextConfig;
```

`app/layout.tsx` (placeholder, replaced in Task 3):
```tsx
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.tsx` (placeholder, replaced in Task 5):
```tsx
export default function Home() {
  return <main>The Pate State</main>;
}
```

- [ ] **Step 5: Install dependencies**

Run: `npm install next@latest react@latest react-dom@latest && npm install -D typescript @types/node @types/react @types/react-dom vitest`

- [ ] **Step 6: Verify build passes**

Run: `npm run build`
Expected: build succeeds, `/` route listed as static.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: scaffold Next.js app"
```

---

### Task 2: YouTube feed library (TDD)

**Files:**
- Create: `lib/youtube.ts`, `lib/youtube.test.ts`, `lib/__fixtures__/feed.xml`

**Interfaces:**
- Produces (consumed by Tasks 4–6):
  - `interface Video { id: string; title: string; published: string; thumbnail: string }`
  - `getVideos(): Promise<Video[]>` — ISR-cached fetch, returns `[]` on any failure
  - `parseFeed(xml: string): Video[]`
  - `isEpisode(v: Video): boolean` — full episodes vs. shorts/clips
  - `videoUrl(id: string): string` — `https://www.youtube.com/watch?v=<id>`
  - Constants: `CHANNEL_URL`, `SUBSCRIBE_URL`, `APPLE_PODCASTS_URL`

- [ ] **Step 1: Capture the live feed as a test fixture**

Run: `mkdir -p lib/__fixtures__ && curl -s "https://www.youtube.com/feeds/videos.xml?channel_id=UCg-q_MDeWQrjizr1VPLEpYg" -o lib/__fixtures__/feed.xml && grep -c "<entry>" lib/__fixtures__/feed.xml`
Expected: a count ≥ 10 (feed carries 15 entries).

- [ ] **Step 2: Write the failing tests** — `lib/youtube.test.ts`

Structural assertions only (fixture titles change over time; never assert exact titles):

```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./youtube`.

- [ ] **Step 4: Implement `lib/youtube.ts`**

```ts
const CHANNEL_ID = "UCg-q_MDeWQrjizr1VPLEpYg";
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

export const CHANNEL_URL = "https://www.youtube.com/@JoshPateCFB";
export const SUBSCRIBE_URL = `${CHANNEL_URL}?sub_confirmation=1`;
export const APPLE_PODCASTS_URL =
  "https://podcasts.apple.com/us/podcast/josh-pates-college-football-show/id1485905502";

export interface Video {
  id: string;
  title: string;
  published: string; // ISO 8601
  thumbnail: string;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'",
};

function decodeEntities(s: string): string {
  return s.replace(/&(?:amp|lt|gt|quot|#39|apos);/g, (m) => ENTITIES[m]);
}

export function parseFeed(xml: string): Video[] {
  const videos: Video[] = [];
  for (const entry of xml.split("<entry>").slice(1)) {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = entry.match(/<title>([^<]*)<\/title>/)?.[1];
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
    const thumbnail = entry.match(/<media:thumbnail url="([^"]+)"/)?.[1];
    if (id && title && published && thumbnail) {
      videos.push({ id, title: decodeEntities(title), published, thumbnail });
    }
  }
  return videos;
}

export function isEpisode(v: Video): boolean {
  return /college football show/i.test(v.title);
}

export function videoUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export async function getVideos(): Promise<Video[]> {
  try {
    const res = await fetch(FEED_URL, { next: { revalidate: 21600 } });
    if (!res.ok) return [];
    return parseFeed(await res.text());
  } catch {
    return [];
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add lib && git commit -m "feat: YouTube RSS feed parser with ISR fetch"
```

---

### Task 3: Design system + global chrome (Nav, Ticker, Footer)

**Files:**
- Create: `components/Nav.tsx`, `components/Ticker.tsx`, `components/Footer.tsx`
- Modify: `app/globals.css`, `app/layout.tsx`

**Interfaces:**
- Consumes: `SUBSCRIBE_URL` from `lib/youtube.ts`.
- Produces: `<Nav/>`, `<Ticker/>`, `<Footer/>` (no props); CSS classes from the mockups available globally; font CSS variables `--display`, `--body`, `--mono` wired to `next/font`.

- [ ] **Step 1: Port the stylesheet**

Copy the entire `<style>` block contents of `thepatestatesite/index_43.html` (lines 6–~250, tokens through page sections) into `app/globals.css`. Then:
1. Delete the `--display`, `--body`, `--mono` definitions from `:root` (next/font provides them via the `<html>` className in Step 3).
2. Append any classes used by `show.html` / `about.html` that aren't already present (diff their style blocks; the mockups are per-page copies with heavy overlap — `.player`, `.ep`, `.thumb`, `.chip`, `.page-head` etc. already exist in index_43).
3. Keep the ticker, yardline, nav, drawer, hero, panel, art, footer classes verbatim — the design must be pixel-faithful to the mockups.

- [ ] **Step 2: Write `components/Nav.tsx`** (client component — mobile drawer needs state)

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { SUBSCRIBE_URL } from "@/lib/youtube";

const LINKS = [
  { href: "/show", label: "The Show" },
  { href: "/about", label: "About" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <nav>
      <div className="nav-row">
        <Link href="/" className="wordmark">The Pate <em>State</em></Link>
        <div className="nav-links">
          {LINKS.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
        </div>
        <a className="btn gold nav-cta" href={SUBSCRIBE_URL} target="_blank" rel="noopener">
          Subscribe on YouTube
        </a>
        <button className="menu-btn" aria-expanded={open} onClick={() => setOpen(!open)}>Menu</button>
      </div>
      <div className={open ? "drawer open" : "drawer"}>
        {LINKS.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>)}
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Write `components/Ticker.tsx`** — evergreen copy ONLY (de-faking rule: no poll rankings)

```tsx
const COPY = (
  <>
    <span><b>MON</b> Weekend Truths</span><span><b>TUE</b> Poll Day</span>
    <span><b>WED</b> The Sit-Down</span><span><b>THU</b> Picks Drop</span>
    <span><b>FRI</b> The ESPN Show</span><span><b>SAT</b> <em>We Watch Ball</em></span>
    <span>THE FRONT PORCH OF COLLEGE FOOTBALL</span>
  </>
);

export default function Ticker() {
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-inner">{COPY}{COPY}</div>
    </div>
  );
}
```

- [ ] **Step 4: Write `components/Footer.tsx`** — port the footer markup from `index_43.html` (bottom of the body), reduced to: wordmark, the three real links (The Show, About, Subscribe), and the tagline "The Front Porch of College Football". Cut newsletter forms and fake nav sections. Use the mockup's footer classes.

- [ ] **Step 5: Rewrite `app/layout.tsx`** with fonts + chrome

```tsx
import type { Metadata } from "next";
import { Big_Shoulders_Display, Newsreader, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Ticker from "@/components/Ticker";
import Footer from "@/components/Footer";

const display = Big_Shoulders_Display({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--display" });
const body = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], variable: "--body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--mono" });

export const metadata: Metadata = {
  title: { default: "The Pate State — The Front Porch of College Football", template: "%s — The Pate State" },
  description:
    "The online home of Josh Pate's College Football Show. New episodes all week, all season. Pull up a chair.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Ticker />
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
```

Note: `next/font` `variable` emits `--display` etc. as font-family *values* differ from the mockup's raw stacks — in `globals.css`, keep every `font-family:var(--display)` usage as-is; they now resolve to the loaded fonts.

- [ ] **Step 6: Verify visually**

Run: `npm run build && (npm run start &) && sleep 3 && curl -s http://localhost:3000 | grep -o "The Pate" | head -1; kill %1`
Expected: build passes; wordmark present. Then eyeball `npm run dev` against `thepatestatesite/index_43.html` in a browser: fonts, ticker animation, nav layout, mobile drawer at <1080px.

- [ ] **Step 7: Commit**

```bash
git add app components && git commit -m "feat: design system port + global chrome"
```

---

### Task 4: Video presentation components

**Files:**
- Create: `components/EpisodeHero.tsx`, `components/VideoCard.tsx`, `components/VideoGrid.tsx`, `components/SubscribeCTA.tsx`, `lib/format.ts`, `lib/format.test.ts`

**Interfaces:**
- Consumes: `Video`, `videoUrl`, `SUBSCRIBE_URL`, `CHANNEL_URL` from `lib/youtube.ts`.
- Produces:
  - `formatDate(iso: string): string` — `"AUG 7, 2026"`
  - `<EpisodeHero video={Video} />` — on-site embed player
  - `<VideoCard video={Video} />` — thumbnail card deep-linking to YouTube
  - `<VideoGrid videos={Video[]} />` — renders nothing when empty
  - `<SubscribeCTA />` — gold subscribe button

- [ ] **Step 1: Write failing test** — `lib/format.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { formatDate } from "./format";

describe("formatDate", () => {
  it("formats ISO dates as mono-caps", () => {
    expect(formatDate("2026-08-07T17:15:17+00:00")).toBe("AUG 7, 2026");
    expect(formatDate("2026-01-01T00:30:00+00:00")).toBe("JAN 1, 2026");
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npm test` → FAIL (module not found).

- [ ] **Step 3: Implement `lib/format.ts`**

```ts
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
```

- [ ] **Step 4: Run test to verify it passes** — `npm test` → PASS.

- [ ] **Step 5: Write the components**

`components/EpisodeHero.tsx`:
```tsx
import { Video, videoUrl } from "@/lib/youtube";
import { formatDate } from "@/lib/format";

export default function EpisodeHero({ video }: { video: Video }) {
  return (
    <div>
      <div className="player" style={{ display: "block", aspectRatio: "16/9" }}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.id}`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ width: "100%", height: "100%", border: 0, borderRadius: 4 }}
        />
      </div>
      <h3 className="ep-title">{video.title}</h3>
      <p className="lede" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
        {formatDate(video.published)} · <a href={videoUrl(video.id)} target="_blank" rel="noopener">Watch on YouTube →</a>
      </p>
    </div>
  );
}
```

`components/VideoCard.tsx`:
```tsx
import Image from "next/image";
import { Video, videoUrl } from "@/lib/youtube";
import { formatDate } from "@/lib/format";

export default function VideoCard({ video }: { video: Video }) {
  return (
    <a className="ep" href={videoUrl(video.id)} target="_blank" rel="noopener">
      <span className="thumb" style={{ position: "relative", overflow: "hidden" }}>
        <Image src={video.thumbnail} alt="" fill style={{ objectFit: "cover" }} sizes="96px" />
      </span>
      <span>
        <h4>{video.title}</h4>
        <span className="meta">{formatDate(video.published)} · YOUTUBE</span>
      </span>
    </a>
  );
}
```

`components/VideoGrid.tsx`:
```tsx
import { Video } from "@/lib/youtube";
import VideoCard from "./VideoCard";

export default function VideoGrid({ videos }: { videos: Video[] }) {
  if (videos.length === 0) return null;
  return (
    <div className="ep-list">
      {videos.map((v) => <VideoCard key={v.id} video={v} />)}
    </div>
  );
}
```

`components/SubscribeCTA.tsx`:
```tsx
import { SUBSCRIBE_URL } from "@/lib/youtube";

export default function SubscribeCTA({ label = "Subscribe on YouTube" }: { label?: string }) {
  return (
    <a className="btn gold" href={SUBSCRIBE_URL} target="_blank" rel="noopener">{label}</a>
  );
}
```

- [ ] **Step 6: Verify build** — `npm run build` → passes (components unused yet; that's fine).

- [ ] **Step 7: Commit**

```bash
git add components lib && git commit -m "feat: video components + date formatting"
```

---

### Task 5: Home page

**Files:**
- Modify: `app/page.tsx`
- Reference: `thepatestatesite/index_43.html` (design), sections to KEEP: hero, "the show is the anchor tenant" episode block, weekly schedule; CUT: JP Poll ticker/board, pick'em panels, notebook/art grid, shop, porch, citizen CTA.

**Interfaces:**
- Consumes: `getVideos`, `isEpisode`, `CHANNEL_URL` from `lib/youtube.ts`; `EpisodeHero`, `VideoGrid`, `SubscribeCTA` components.

- [ ] **Step 1: Implement `app/page.tsx`**

```tsx
import { getVideos, isEpisode, CHANNEL_URL } from "@/lib/youtube";
import EpisodeHero from "@/components/EpisodeHero";
import VideoGrid from "@/components/VideoGrid";
import SubscribeCTA from "@/components/SubscribeCTA";

export default async function Home() {
  const videos = await getVideos();
  const latest = videos.find(isEpisode) ?? videos[0];
  const recent = videos.filter((v) => v !== latest).slice(0, 6);

  return (
    <main>
      <section className="hero">
        <div className="wrap">
          <p className="eyebrow">Est. in Columbus, GA — population: everyone who lives for Saturdays</p>
          <h1 className="display">The Front Porch<span className="row2">of College Football.</span></h1>
          <p className="lede">
            No debates. No hot takes. Just the sport, all year long — the show, every week,
            and a seat that&apos;s always open. Pull up a chair.
          </p>
          <div className="hero-ctas">
            <SubscribeCTA label="▶ Watch on YouTube" />
            <a className="btn" href="/show">Browse the Show</a>
          </div>
        </div>
      </section>

      {latest && (
        <section className="on-dark">
          <div className="wrap">
            <p className="eyebrow">America&apos;s College Football Show</p>
            <h2 className="display">The Latest Episode</h2>
            <EpisodeHero video={latest} />
            <p className="sched">
              <b>MON</b> Weekend Truths · <b>TUE</b> Poll Day · <b>WED</b> The Sit-Down ·{" "}
              <b>THU</b> Picks Drop · <b>FRI</b> The ESPN Show · <b>SAT</b> We Watch Ball
            </p>
          </div>
        </section>
      )}

      <div className="yardline" />

      {recent.length > 0 && (
        <section>
          <div className="wrap">
            <p className="eyebrow">Fresh off the porch</p>
            <h2 className="display">Recent Drops</h2>
            <div className="ep-light"><VideoGrid videos={recent} /></div>
            <p style={{ marginTop: 24 }}>
              <a className="btn" href={CHANNEL_URL} target="_blank" rel="noopener">Every Episode on YouTube →</a>
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Visual pass against the mockup** — run `npm run dev`, compare with `index_43.html` in a browser. Adjust spacing/section classes (`on-dark`, `yardline`, `tight`) to match the mockup's rhythm. Fix any missing CSS classes by porting them from the mockup style block.

- [ ] **Step 3: Verify build + tests** — `npm run build && npm test` → both pass.

- [ ] **Step 4: Commit**

```bash
git add app && git commit -m "feat: home page with live latest episode + recent drops"
```

---

### Task 6: The Show page

**Files:**
- Create: `app/show/page.tsx`
- Reference: `thepatestatesite/show.html` — KEEP: latest-episode block, platform chips, weekly series list, latest drops, clips row; CUT: fake view counts, "Most Popular — All Time" (fake), mailbag submit, episode archive table (fake), "500K+ Citizens" claim.

**Interfaces:**
- Consumes: `getVideos`, `isEpisode`, `videoUrl`, `CHANNEL_URL`, `APPLE_PODCASTS_URL` from `lib/youtube.ts`; `EpisodeHero`, `VideoGrid`, `SubscribeCTA`, `formatDate`.

- [ ] **Step 1: Try to resolve the real Spotify show URL**

Search the web for `"Josh Pate's College Football Show" site:open.spotify.com` (or query the Spotify web search). If a canonical `open.spotify.com/show/<id>` URL is confirmed, add `export const SPOTIFY_URL = "..."` to `lib/youtube.ts` and include a Spotify chip. If not confirmed, OMIT the Spotify chip entirely (de-faking rule — no guessed links).

- [ ] **Step 2: Implement `app/show/page.tsx`**

```tsx
import type { Metadata } from "next";
import { getVideos, isEpisode, CHANNEL_URL, APPLE_PODCASTS_URL } from "@/lib/youtube";
import EpisodeHero from "@/components/EpisodeHero";
import VideoGrid from "@/components/VideoGrid";
import VideoCard from "@/components/VideoCard";
import SubscribeCTA from "@/components/SubscribeCTA";

export const metadata: Metadata = { title: "The Show" };

const SERIES = [
  ["MON", "Weekend Truths", "Monday's honest recap"],
  ["TUE", "Poll Day", "the weekly rankings, revealed"],
  ["WED", "The Sit-Down", "long-form interviews"],
  ["THU", "Picks Drop", "the week's board, reasoned out"],
  ["FRI", "The ESPN Friday Show", "from GameDay sites"],
];

export default async function ShowPage() {
  const videos = await getVideos();
  const episodes = videos.filter(isEpisode);
  const clips = videos.filter((v) => !isEpisode(v)).slice(0, 6);
  const latest = episodes[0] ?? videos[0];
  const rest = episodes.filter((v) => v !== latest).slice(0, 8);

  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / The Show</p>
          <h1>The Show</h1>
          <p className="lede">Every episode, every series, every platform — connected straight to YouTube, one tap from anywhere.</p>
        </div>
      </header>

      {latest && (
        <section className="on-dark tight">
          <div className="wrap">
            <p className="eyebrow">Latest — watch on YouTube</p>
            <EpisodeHero video={latest} />
            <div className="platforms">
              <a className="chip" href={CHANNEL_URL} target="_blank" rel="noopener">YouTube</a>
              <a className="chip" href={APPLE_PODCASTS_URL} target="_blank" rel="noopener">Apple Podcasts</a>
            </div>
            <div style={{ marginTop: 18 }}><SubscribeCTA /></div>
          </div>
        </section>
      )}

      <section>
        <div className="wrap">
          <p className="eyebrow">The weekly series</p>
          <h2 className="display">All Week, All Season</h2>
          <table>
            <tbody>
              {SERIES.map(([day, name, desc]) => (
                <tr key={day}><td className="rk">{day}</td><td><b>{name}</b> — {desc}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {rest.length > 0 && (
        <section className="on-soft tight">
          <div className="wrap">
            <p className="eyebrow">Latest drops</p>
            <h2 className="display">Recent Episodes</h2>
            <div className="ep-light"><VideoGrid videos={rest} /></div>
          </div>
        </section>
      )}

      {clips.length > 0 && (
        <section className="tight">
          <div className="wrap">
            <p className="eyebrow">60-second porch</p>
            <h2 className="display">Clips &amp; Shorts</h2>
            <div className="ep-light"><VideoGrid videos={clips} /></div>
            <p style={{ marginTop: 24 }}>
              <a className="btn" href={CHANNEL_URL} target="_blank" rel="noopener">Full Archive on YouTube →</a>
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Visual pass** against `show.html` in dev mode; port any missing classes.

- [ ] **Step 4: Verify build + tests** — `npm run build && npm test` → pass. Also verify `/show` renders with the dev server.

- [ ] **Step 5: Commit**

```bash
git add app lib && git commit -m "feat: show page with live episodes, clips, platform links"
```

---

### Task 7: About page

**Files:**
- Create: `app/about/page.tsx`
- Reference: `thepatestatesite/about.html`

**Interfaces:**
- Consumes: `SubscribeCTA`, `CHANNEL_URL`.

- [ ] **Step 1: Read `thepatestatesite/about.html`** and port its narrative sections (who Josh Pate is, what the Pate State is, the show's ethos). Rules:
  - Keep: page-head, the story/ethos prose, the weekly-schedule panel, final CTA band.
  - Cut: any subscriber counts, citizen counts, fake stats blocks (`.record .stat .num` numbers), fake press quotes, team/staff sections with invented names.
  - Reword any claim that implies live data into evergreen copy (e.g., "half a million citizens" → "a porch that's always open").
  - Structure: `page-head` header + 2–3 `section` blocks using existing classes (`panel`, `duo`, `on-soft`) + closing `<section className="on-field">` with `<SubscribeCTA />`.
  - Set `export const metadata: Metadata = { title: "About" };`

- [ ] **Step 2: Visual pass** against `about.html` in dev mode.

- [ ] **Step 3: Verify build + tests** — `npm run build && npm test` → pass.

- [ ] **Step 4: Commit**

```bash
git add app && git commit -m "feat: about page, evergreen copy only"
```

---

### Task 8: SEO, OG image, sitemap, icon

**Files:**
- Create: `app/opengraph-image.tsx`, `app/icon.svg`, `app/sitemap.ts`, `app/robots.ts`

**Interfaces:**
- Consumes: nothing new. Produces: crawlable metadata; OG card on every share.

- [ ] **Step 1: Write `app/opengraph-image.tsx`** (code-generated — no binary assets)

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "The Pate State — The Front Porch of College Football";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", background: "#0F1B2D",
        color: "#F3EFE6", fontFamily: "sans-serif",
      }}>
        <div style={{ fontSize: 96, fontWeight: 800, textTransform: "uppercase", letterSpacing: -2 }}>
          The Pate <span style={{ color: "#E8A33D" }}>State</span>
        </div>
        <div style={{ fontSize: 32, color: "#B9B4A6", marginTop: 16, letterSpacing: 4, textTransform: "uppercase" }}>
          The Front Porch of College Football
        </div>
      </div>
    ),
    size
  );
}
```

- [ ] **Step 2: Write `app/icon.svg`** — lamp-gold "PS" monogram on navy:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="8" fill="#0F1B2D"/>
  <text x="32" y="44" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="30" font-weight="900" fill="#E8A33D">PS</text>
</svg>
```

- [ ] **Step 3: Write `app/sitemap.ts` and `app/robots.ts`**

```ts
// app/sitemap.ts
import type { MetadataRoute } from "next";

const BASE = "https://thepatestate.vercel.app"; // update when custom domain lands

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/show", "/about"].map((p) => ({ url: `${BASE}${p}`, changeFrequency: "daily" as const }));
}
```

```ts
// app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: "https://thepatestate.vercel.app/sitemap.xml" };
}
```

Also add to the `metadata` export in `app/layout.tsx`: `metadataBase: new URL("https://thepatestate.vercel.app")` (silences OG warnings; update alongside the domain later).

- [ ] **Step 4: Verify** — `npm run build` → routes for `/opengraph-image`, `/sitemap.xml`, `/robots.txt`, `/icon.svg` appear. `curl -s http://localhost:3000/opengraph-image -o /tmp/og.png && file /tmp/og.png` after `npm start` → PNG 1200x630.

- [ ] **Step 5: Commit**

```bash
git add app && git commit -m "feat: OG image, icon, sitemap, robots"
```

---

### Task 9: Push + Vercel deploy + production verification

**Files:** none (operations task)

**Prereq (user):** `gh auth` must include the `thepatestate` account (user runs `gh auth login -h github.com -w` and authorizes in the browser profile signed in as thepatestate). Vercel account exists and is connected to the GitHub account.

- [ ] **Step 1: Push**

Run: `cd "/Users/isaacmeek/Claude/Projects/Pate State" && gh auth switch -u thepatestate && git push -u origin main`
(If the default branch is `master` locally, rename first: `git branch -m main`.)
Expected: repo visible at github.com/thepatestate/thepatestate with all commits authored by `thepatestate`.

- [ ] **Step 2: Import to Vercel** — user (or Claude with browser tools) imports the repo in the Vercel dashboard: Add New → Project → thepatestate/thepatestate → Framework preset auto-detects Next.js → Deploy. No env vars needed.

- [ ] **Step 3: Verify production**

- Home, /show, /about all render with real video titles and thumbnails.
- Latest-episode embed plays.
- Video cards open youtube.com/watch in a new tab.
- Subscribe button lands on the channel with the sub-confirmation dialog.
- `curl -sI https://<prod-url>/ | grep -i x-vercel-cache` → `HIT` or `STALE` on second request (ISR working).
- OG check: paste the prod URL into an OG debugger (e.g. opengraph.xyz) → card shows.
- Mobile: drawer nav works at phone width.

- [ ] **Step 4: Confirm autonomy** — in Vercel project settings, confirm no cron/queues exist (nothing to babysit); note in the PR/commit message that content freshness is ISR-only.

- [ ] **Step 5: Commit any fixes + final commit**

```bash
git add -A && git commit -m "chore: production deploy verified" --allow-empty
```

---

## Self-review notes

- Spec coverage: 3 pages (Tasks 5–7), feed engine + error fallback (Task 2: `getVideos` returns `[]`, grids render null), design port (Task 3), traffic mechanics (embed in Task 4, deep links in VideoCard, sub_confirmation in Nav/SubscribeCTA), metadata (Task 8), accounts/deploy/handoff (Task 9). Empty-state handling: every video section is conditionally rendered.
- Type consistency: `Video { id, title, published, thumbnail }` used identically in Tasks 2, 4, 5, 6. `videoUrl`, `isEpisode`, `getVideos` signatures match across tasks.
- No placeholder steps; the two "port from mockup" steps (Footer, About) name their exact source file, keep/cut lists, and target classes.
