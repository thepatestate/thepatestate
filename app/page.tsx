import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getVideos, isEpisode, getChannelStats, getShorts, compactCount, CHANNEL_URL, SOCIAL_LINKS } from "@/lib/youtube";
import { getPublishedArticles, getWireItems, getWireStories, getHeroSlides } from "@/lib/sanity";
import HeroSlider, { type HeroSlideData } from "@/components/HeroSlider";
import { formatDate } from "@/lib/format";
import RelTime from "@/components/RelTime";
import { slugifyTeam, teamLogoUrl } from "@/lib/teams-meta";
import { createArtPicker, type ArtCategory } from "@/lib/editorial-art";
import PreseasonChip from "@/components/PreseasonChip";
import EmptyState from "@/components/EmptyState";
import { DEMO_MODE } from "@/lib/demo";
import Reveal from "@/components/Reveal";
import SlateStrip from "@/components/SlateStrip";
import ShowSection from "@/components/ShowSection";
import MyTeams from "@/components/MyTeams";
import TrendingPorch from "@/components/TrendingPorch";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// --- Preseason-preview sample data ---------------------------------------
// Every array below stands in for a section that isn't wired to a real
// engine yet (JP Poll ballots, Porch Pick'Em, the Notebook CMS, the Shop,
// tour dates). Swap these for live queries when each engine ships; the JSX
// below only touches these arrays, never inline literals, so the hookup is
// a drop-in replacement.

const DEMO_POLL = [
  { rank: "01", code: "UGA", team: "Georgia", off: 95, def: 97, sos: 8, rating: "96.4", delta: "up", deltaVal: "1" },
  { rank: "02", code: "OSU", team: "Ohio State", off: 98, def: 94, sos: 12, rating: "95.8", delta: "dn", deltaVal: "1" },
  { rank: "03", code: "TEX", team: "Texas", off: 96, def: 92, sos: 5, rating: "94.1", delta: null, deltaVal: null },
  { rank: "04", code: "ORE", team: "Oregon", off: 94, def: 90, sos: 14, rating: "92.7", delta: "up", deltaVal: "2" },
  { rank: "05", code: "PSU", team: "Penn State", off: 91, def: 93, sos: 18, rating: "91.9", delta: null, deltaVal: null },
] as const;

const DEMO_LEADERBOARD = [
  { rank: 1, name: "SicEmSaturdays", pts: "1,842 PTS", streak: "W14" },
  { rank: 2, name: "PorchSwingProphet", pts: "1,791 PTS", streak: "W11" },
  { rank: 3, name: "Josh Pate", pts: "1,764 PTS", streak: "W9" },
  { rank: 4, name: "GroveGoblin", pts: "1,733 PTS", streak: null },
  { rank: 5, name: "ChalkEater88", pts: "1,700 PTS", streak: null },
] as const;

// Same duplication pattern noted throughout this file: a small per-file lookup
// rather than a shared lib module (see components/ArticleBody.tsx and
// app/notebook/page.tsx for the sibling copies).
const SERIES_LABELS: Record<string, string> = {
  "weekend-truths": "Weekend Truths",
  "poll-day": "Poll Day",
  "sit-down": "The Sit-Down",
  "picks-drop": "Picks Drop",
  "espn-friday": "The ESPN Show",
  mailbag: "The Mailbag",
  general: "The Notebook",
};

function seriesLabel(series?: string): string {
  if (!series) return "The Notebook";
  return SERIES_LABELS[series] ?? series;
}

const DEMO_NOTEBOOK_FEATURED = [
  {
    badgeText: "★",
    badgeBg: "var(--navy)",
    badgeColor: "var(--lamp)",
    title: "The Week 1 Honor Roll",
    body: "Ten players ranked by impact, not box scores — and the citizens vote a People's No. 1.",
    by: "STAFF",
    when: "WEDNESDAY",
    citizenBadge: false,
    art: "honor-roll",
  },
  {
    badgeText: "Q&A",
    badgeBg: "var(--field)",
    badgeColor: "var(--chalk)",
    title: "Wedding Season vs. Football Season",
    body: "The citizens write in, Josh answers, and nobody is spared — this week: October weddings.",
    by: "JOSH PATE",
    when: "FRIDAY",
    citizenBadge: true,
    art: "mailbag",
  },
] as const;

const DEMO_WIRE = [
  {
    time: "2 HRS AGO",
    category: "RECRUITING",
    headline: "A&M holds No. 1 on both major boards",
    badge: "Full Story Ready",
    body: "26 commits, six five-stars — the 2027 class keeps growing.",
    art: "recruiting",
  },
  {
    time: "THIS WEEK",
    category: "RECRUITING",
    headline: "Last 2027 five-stars come off the board",
    badge: null,
    body: "Indiana lands a five-star WR; Tennessee keeps a five-star RB home.",
    art: "recruiting",
  },
  {
    time: "2 WKS AGO",
    category: "MEDIA",
    headline: "Josh's new ESPN Friday show announced",
    badge: null,
    body: "Fridays this fall, sometimes live from GameDay sites.",
    art: "media",
  },
  {
    time: "TODAY",
    category: "THE STATE",
    headline: "Porch Pick'Em registration opens",
    badge: null,
    body: "Season champ watches a game with Josh.",
    art: "state",
  },
  {
    time: "THIS WEEK",
    category: "THE POLL",
    headline: "Ballots open Sunday 8PM ET",
    badge: null,
    body: "Week 1 reveal comes Tuesday on the show.",
    art: "poll",
  },
  {
    time: "TODAY",
    category: "THE STORE",
    headline: "Creed Tee restock lands",
    badge: null,
    body: "Tri-blend, ridiculously soft — first run sold out in nine days.",
    art: "store",
  },
] as const;

const DEMO_SHOP = [
  { label: "THE CREED TEE — $28 · TRI-BLEND", hero: true, photo: "/img/product-tee.jpg", alt: "The Creed Tee, folded flat" },
  { label: "PORCH FLAG — $34", hero: false, photo: "/img/product-flag.jpg", alt: "The Pate State porch flag" },
  { label: "GAMEDAY HAT — $32", hero: false, photo: "/img/product-hat.jpg", alt: "The Pate State gameday hat" },
] as const;

const DEMO_TOUR = [
  { date: "SEP 5", city: "ATHENS, GA", soldOut: false },
  { date: "SEP 19", city: "AUSTIN, TX", soldOut: false },
  { date: "OCT 10", city: "COLUMBUS, OH", soldOut: false },
  { date: "NOV 7", city: "BATON ROUGE, LA", soldOut: true },
] as const;

const DEMO_GUIDES = [
  { name: "Tiger Stadium", meta: "LSU · NIGHT GAME SURVIVAL", photo: "/img/tailgate-night.jpg", alt: "LSU fans in purple and gold packing Tiger Stadium's night tailgate lot", team: "lsu" },
  { name: "The Grove", meta: "OLE MISS · MASTERCLASS", photo: "/img/tailgate-grove.jpg", alt: "Ole Miss fans tailgating under the oaks of The Grove", team: "ole-miss" },
  { name: "The Horseshoe", meta: "OHIO STATE · FIRST-TIMER", photo: "/img/tailgate-horseshoe.jpg", alt: "Ohio State fans packing The Horseshoe for kickoff", team: "ohio-state" },
  { name: "Camp Randall", meta: "WISCONSIN · JUMP AROUND", photo: "/img/tailgate-jump.jpg", alt: "Wisconsin fans jumping around at Camp Randall", team: "wisconsin" },
] as const;

export default async function Home() {
  const videos = await getVideos();
  const [stats, shorts] = await Promise.all([getChannelStats(), getShorts(8)]);
  const episodes = videos.filter(isEpisode);
  const latest = episodes[0] ?? videos[0];
  const recentEpisodes = episodes.filter((v) => v !== latest).slice(0, 3);
  // More Episodes row (§1.2): the next 6 uploads beyond the featured + 3
  // stacked — Shorts arrive via their own rail, so filter nothing here
  // beyond what's already shown.
  const shown = new Set([latest?.id, ...recentEpisodes.map((v) => v.id)]);
  const moreEpisodes = videos.filter((v) => !shown.has(v.id) && !shorts.some((s) => s.id === v.id)).slice(0, 6);
  const notebookArticles = await getPublishedArticles(3);
  // Live Wire items take over from the demo rail once the Wire Desk has real
  // coverage flowing (v1.2 §3) — demo stays only while the wire warms up.
  // Density per v2 §1.3: 8–10 items on the homepage, every one clickable.
  const liveWire = await getWireItems(10).catch(() => []);
  // Real full stories: fill the notebook bento + the numbered strip so the
  // left column carries as much genuine click-through density as the rail.
  const wireStories = await getWireStories(8).catch(() => []);
  const notebookLead = notebookArticles[0] ?? null;
  const notebookNext = notebookArticles.slice(1, 3);
  // Hero banner (§1.1): the latest episode always leads, then the
  // Sanity-managed heroSlide docs — editors change the rotation without code.
  const sanitySlides = await getHeroSlides().catch(() => []);
  const heroSlides: HeroSlideData[] = [
    ...(latest
      ? [{
          key: "latest-episode",
          title: latest.title.replace(/ - Josh Pate's College Football Show/i, ""),
          kicker: "NEW EPISODE",
          link: `https://www.youtube.com/watch?v=${latest.id}`,
          imageUrl: latest.thumbnail,
          external: true,
        }]
      : []),
    ...sanitySlides
      .filter((s) => s.imageUrl)
      .map((s) => ({
        key: s._id,
        title: s.title,
        kicker: s.kicker,
        link: s.link,
        imageUrl: s.imageUrl as string,
        external: /^https?:/i.test(s.link),
      })),
  ].slice(0, 6);
  const art = createArtPicker();
  // Computed once (not inline in JSX) so a missing heroUrl never causes the
  // src and alt attributes to resolve from two different art.pick() calls.
  const leadImg = notebookLead?.heroUrl
    ? { src: notebookLead.heroUrl, alt: notebookLead.headline }
    : art.pick("weekend-truths");

  return (
    <main>
      <SlateStrip />
      <section className="hero">
        {/* Ambient hero video (public/video/hero-ambient.mp4) removed for now —
            reintroduce when the client asks for more life up top. */}
        <div className="wrap">
          <div className="hero-split">
            <div>
              <p className="eyebrow">Est. in Columbus, GA — population: everyone who lives for Saturdays</p>
              <h1 className="display">The Front Porch<span className="row2">of College Football.</span></h1>
              <p className="lede">
                No debates. No hot takes. Just the sport, all year long — the show, every week,
                and a seat that&apos;s always open. Pull up a chair.
              </p>
              <div className="hero-ctas">
                <Link className="btn gold" href="/show">Browse the Show</Link>
                <Link className="btn" href="/join" style={{ borderColor: "rgba(243,239,230,.5)", color: "var(--chalk, #F3EFE6)" }}>Become a Citizen — Free</Link>
              </div>
              {/* Real, verifiable social proof from the YouTube Data API (§0.2) —
                  omitted entirely if the stats call fails, never invented. */}
              {stats && (
                <p className="hero-proof">
                  {compactCount(stats.subscribers)} subscribers · {compactCount(stats.videos)} videos ·{" "}
                  {compactCount(stats.views)} views · Every pick logged
                </p>
              )}
            </div>
            <HeroSlider slides={heroSlides} />
          </div>
        </div>
      </section>

      <MyTeams />

      {latest && (
        <ShowSection latest={latest} stacked={recentEpisodes} more={moreEpisodes} shorts={shorts} />
      )}

      <div className="yardline" />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div>
              <p className="eyebrow">From the Porch — New Every Weekday</p>
              <h2 className="display">The Notebook</h2>
            </div>
            <Link className="view-all" href="/notebook">View All Stories →</Link>
          </div>
          {!notebookLead && <PreseasonChip />}
          <Reveal>
          <div className="duo wide" style={{ marginTop: 26, alignItems: "start" }}>
            <div>
              {notebookLead ? (
                <div className="bento">
                  <Link href={`/notebook/${notebookLead.slug.current}`} className="tile tile-lead">
                    <div className="tile-media">
                      <Image
                        src={leadImg.src}
                        alt={leadImg.alt}
                        fill
                        sizes="(max-width: 860px) 100vw, 560px"
                        style={{ objectFit: "cover" }}
                        priority
                      />
                    </div>
                    <div className="tile-scrim" />
                    <span className="tile-badge">📝 {seriesLabel(notebookLead.episode?.series)}</span>
                    <div className="tile-body">
                      <span className="tile-kicker">
                        {notebookLead.byline}
                        {notebookLead.publishedAt ? ` · ${formatDate(notebookLead.publishedAt)}` : ""}
                      </span>
                      <h3 className="tile-headline">{notebookLead.headline}</h3>
                      {notebookLead.dek && (
                        <p style={{ fontSize: 14, color: "var(--chalk-dim)", marginTop: 8, maxWidth: "46ch" }}>
                          {notebookLead.dek}
                        </p>
                      )}
                    </div>
                  </Link>
                  <div className="bento-stack">
                    {notebookNext.map((a) => {
                      const img = a.heroUrl ? { src: a.heroUrl, alt: a.headline } : art.pick("generic", a.headline);
                      return (
                        <Link href={`/notebook/${a.slug.current}`} className="tile" key={a._id}>
                          <div className="tile-media">
                            <Image src={img.src} alt={img.alt} fill sizes="(max-width: 860px) 50vw, 280px" style={{ objectFit: "cover" }} />
                          </div>
                          <div className="tile-scrim" />
                          <div className="tile-body">
                            <span className="tile-kicker">
                              {a.byline}
                              {a.publishedAt ? ` · ${formatDate(a.publishedAt)}` : ""}
                            </span>
                            <h4 className="tile-headline" style={{ fontSize: "clamp(15px,1.6vw,19px)" }}>{a.headline}</h4>
                          </div>
                        </Link>
                      );
                    })}
                    {/* Real wire stories backfill the stack in production —
                        genuine click-throughs instead of dead space (§0.1
                        compliant: every headline is a real published story). */}
                    {!DEMO_MODE &&
                      wireStories.slice(0, Math.max(0, 2 - notebookNext.length)).map((w) => {
                        const img = art.pick(
                          ["recruiting", "coaching", "media", "playoffs"].includes(w.category ?? "") ? (w.category as ArtCategory) : "generic",
                          w.headline,
                        );
                        const logo = w.teams?.[0] ? teamLogoUrl(w.teams[0]) : null;
                        return (
                          <Link href={`/wire/${w.slug.current}`} className="tile" key={w._id}>
                            <div className="tile-media">
                              <Image src={img.src} alt={img.alt} fill sizes="(max-width: 860px) 50vw, 280px" style={{ objectFit: "cover" }} />
                            </div>
                            <div className="tile-scrim" />
                            <span className="tile-badge">⚡ The Wire</span>
                            {logo && (
                              <span className="tile-team-chip">
                                <Image src={logo} alt="" width={24} height={24} style={{ objectFit: "contain" }} />
                              </span>
                            )}
                            <div className="tile-body">
                              <span className="tile-kicker">
                                {(w.category ?? "news").toUpperCase()} · <RelTime iso={w.publishedAt} />
                              </span>
                              <h4 className="tile-headline" style={{ fontSize: "clamp(15px,1.6vw,19px)" }}>{w.headline}</h4>
                            </div>
                          </Link>
                        );
                      })}
                    {!DEMO_MODE && notebookNext.length < 2 && wireStories.length === 0 && (
                      <div className="tile" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <EmptyState
                          kicker="NEW EVERY WEEKDAY"
                          title="More stories on the way"
                          body="Every episode gets its written companion within hours of upload."
                        />
                      </div>
                    )}
                    {(DEMO_MODE ? DEMO_NOTEBOOK_FEATURED.slice(0, Math.max(0, 2 - notebookNext.length)) : []).map((item) => {
                      const img = art.pick(item.art, item.title);
                      return (
                        <Link href="/notebook" className="tile" key={item.title}>
                          <div className="tile-media">
                            <Image src={img.src} alt={img.alt} fill sizes="(max-width: 860px) 50vw, 280px" style={{ objectFit: "cover" }} />
                          </div>
                          <div className="tile-scrim" />
                          <span className="tile-badge" style={{ background: item.badgeBg, color: item.badgeColor }}>
                            {item.badgeText}
                          </span>
                          <div className="tile-body">
                            <span className="tile-kicker">
                              {item.by} · {item.when}
                              {item.citizenBadge ? " · Citizens Only" : ""}
                            </span>
                            <h4 className="tile-headline" style={{ fontSize: "clamp(15px,1.6vw,19px)" }}>{item.title}</h4>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : !DEMO_MODE ? (
                <EmptyState
                  kicker="NEW EVERY WEEKDAY"
                  title="The Notebook opens with the first companion story"
                  body="Every episode of the show gets a written companion within hours of upload — takeaways, timestamps, and the quotes that matter."
                  cta={{ href: "/notebook", label: "Open the Notebook" }}
                />
              ) : (
                <div className="bento">
                  <Link href="/notebook" className="tile tile-lead">
                    <div className="tile-media">
                      <Image
                        src="/img/editorial-film.jpg"
                        alt="A film projector beside a chalkboard of X's-and-O's diagrams"
                        fill
                        sizes="(max-width: 860px) 100vw, 560px"
                        style={{ objectFit: "cover" }}
                        priority
                      />
                    </div>
                    <div className="tile-scrim" />
                    <span className="tile-badge">📝 Weekend Truths</span>
                    <div className="tile-body">
                      <span className="tile-kicker">JOSH PATE · 6 MIN READ · TODAY</span>
                      <h3 className="tile-headline">What Saturday Actually Told Us</h3>
                      <p style={{ fontSize: 14, color: "var(--chalk-dim)", marginTop: 8, maxWidth: "46ch" }}>
                        Five things that were real, three overreactions to ignore, and the one stat nobody&apos;s
                        talking about — new every Monday at 7AM.
                      </p>
                    </div>
                  </Link>
                  <div className="bento-stack">
                    {DEMO_NOTEBOOK_FEATURED.map((item) => {
                      const img = art.pick(item.art, item.title);
                      return (
                        <Link href="/notebook" className="tile" key={item.title}>
                          <div className="tile-media">
                            <Image src={img.src} alt={img.alt} fill sizes="(max-width: 860px) 50vw, 280px" style={{ objectFit: "cover" }} />
                          </div>
                          <div className="tile-scrim" />
                          <span className="tile-badge" style={{ background: item.badgeBg, color: item.badgeColor }}>
                            {item.badgeText}
                          </span>
                          <div className="tile-body">
                            <span className="tile-kicker">
                              {item.by} · {item.when}
                              {item.citizenBadge ? " · Citizens Only" : ""}
                            </span>
                            <h4 className="tile-headline" style={{ fontSize: "clamp(15px,1.6vw,19px)" }}>{item.title}</h4>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Numbered strip balances the column against the Wire rail.
                  Production: the latest REAL full wire stories with live
                  timestamps. Demo keeps the Most Read mock (§0.1). */}
              {!DEMO_MODE && wireStories.length >= 2 && (
                <div style={{ marginTop: 22 }}>
                  <p className="eyebrow" style={{ marginBottom: 8 }}>The Latest Full Stories</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px 22px" }}>
                    {wireStories.slice(0, 4).map((w, i) => (
                      <Link key={w._id} href={`/wire/${w.slug.current}`} style={{ display: "flex", gap: 12, alignItems: "baseline", textDecoration: "none", color: "inherit", borderBottom: "1px solid var(--line-l)", paddingBottom: 8 }}>
                        <span className="display" style={{ fontSize: 26, color: "transparent", WebkitTextStroke: "1.5px var(--gold, #B8842C)", flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                        <span>
                          <b style={{ fontSize: 14, lineHeight: 1.3, display: "block" }}>{w.headline}</b>
                          <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".06em", color: "var(--ink-dim)" }}>
                            {(w.category ?? "news").toUpperCase()} · <RelTime iso={w.publishedAt} />
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {DEMO_MODE && (
              <div style={{ marginTop: 22 }}>
                <p className="eyebrow" style={{ marginBottom: 8 }}>Most Read This Week <PreseasonChip /></p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px 22px" }}>
                  {[
                    { n: "01", t: "The 5 Programs Under the Most Pressure This Fall", m: "PAIRS WITH EP 1,204" },
                    { n: "02", t: "Why the JP Poll Doesn't Trust Alabama Yet", m: "POLL DAY COLUMN" },
                    { n: "03", t: "The Grove, Ranked: A Tailgate Masterclass", m: "PATE TAILGATE" },
                    { n: "04", t: "Portal Winners Nobody's Pricing In", m: "THE NEXT WAVE" },
                  ].map((p) => (
                    <Link key={p.n} href="/notebook" style={{ display: "flex", gap: 12, alignItems: "baseline", textDecoration: "none", color: "inherit", borderBottom: "1px solid var(--line-l)", paddingBottom: 8 }}>
                      <span className="display" style={{ fontSize: 26, color: "transparent", WebkitTextStroke: "1.5px var(--gold, #B8842C)", flexShrink: 0 }}>{p.n}</span>
                      <span>
                        <b style={{ fontSize: 14, lineHeight: 1.3, display: "block" }}>{p.t}</b>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".06em", color: "var(--ink-dim)" }}>{p.m}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
              )}
              <div style={{ marginTop: 18 }}><Link className="btn" href="/notebook">Open the Notebook</Link></div>
            </div>

            <div className="wire">
              <h3><span className="dot" />The Wire</h3>
              {liveWire.length < 3 && !DEMO_MODE && (
                <EmptyState
                  kicker="VERIFIED NEWS ONLY"
                  title="The Wire is warming up"
                  body="Sourced, attributed college football news lands here as it breaks — monitored around the clock."
                  cta={{ href: "/wire", label: "All Wire Coverage →" }}
                />
              )}
              {liveWire.length >= 3
                ? liveWire.map((w) => {
                    const logo = w.teams?.[0] ? teamLogoUrl(w.teams[0]) : null;
                    const wireArt: ArtCategory = w.category && ["recruiting", "coaching", "media", "playoffs"].includes(w.category) ? (w.category as ArtCategory) : "generic";
                    const img = logo ?? art.pick(wireArt, w.headline).src;
                    const inner = (
                      <div className="wire-item" key={w._id}>
                        <div className="wire-thumb2 bleed-thumb" style={{ position: "relative", ...(logo ? { background: "#fff" } : {}) }}>
                          <Image src={img} alt="" fill sizes="96px" style={{ objectFit: logo ? "contain" : "cover", ...(logo ? { padding: 8 } : {}) }} />
                        </div>
                        <div className="wtxt">
                          <span className="t"><RelTime iso={w.publishedAt} /> · {w.category?.toUpperCase() ?? "NEWS"}</span>
                          <b>{w.headline}{w.storySlug && <span className="ai-badge">⚡ FULL STORY READY</span>}</b>
                          {w.sub && <p>{w.sub}</p>}
                        </div>
                      </div>
                    );
                    // Every wire item is fully clickable (§1.3): to our full
                    // story when one exists, otherwise straight to the
                    // original source's report.
                    return w.storySlug ? (
                      <Link href={`/wire/${w.storySlug}`} key={w._id} style={{ textDecoration: "none", color: "inherit" }}>{inner}</Link>
                    ) : w.sourceUrl ? (
                      <a href={w.sourceUrl} target="_blank" rel="noopener" key={w._id} style={{ textDecoration: "none", color: "inherit" }}>{inner}</a>
                    ) : (
                      inner
                    );
                  })
                : !DEMO_MODE ? null : DEMO_WIRE.map((w) => {
                    const img = art.pick(w.art, `${w.category} — ${w.headline}`);
                    return (
                      <div className="wire-item" key={w.headline}>
                        <div className="wire-thumb2 bleed-thumb" style={{ position: "relative" }}>
                          <Image src={img.src} alt={img.alt} fill sizes="96px" style={{ objectFit: "cover" }} />
                        </div>
                        <div className="wtxt">
                          <span className="t">{w.time} · {w.category}</span>
                          <b>{w.headline}{w.badge && <span className="ai-badge">{w.badge}</span>}</b>
                          <p>{w.body}</p>
                        </div>
                      </div>
                    );
                  })}
              <Link className="btn gold" href="/wire" style={{ marginTop: 14, width: "100%", textAlign: "center" }}>
                All Wire Coverage →
              </Link>
            </div>
          </div>
          </Reveal>
        </div>
      </section>

      <TrendingPorch />

      <section className="tight poll-band">
        <div className="wrap">
          <Reveal>
          <div className="duo">
            <div className="panel panel-accent-navy">
              <span className="fr">🗳 THE JP POLL</span>
              <p className="eyebrow">Vote Sunday · Reveal Tuesday</p>
              <h3>The People&apos;s Power Ranking</h3>
              {DEMO_MODE && <PreseasonChip />}
              <p>One board, voted by those who actually watch, revealed every Tuesday.{DEMO_MODE ? " The top of this week's:" : ""}</p>
              {!DEMO_MODE && (
                <div className="how-rows">
                  <div className="how-row"><b>AUG 24</b><span>First ballots open — every citizen ranks a top 10</span></div>
                  <div className="how-row"><b>SUN 8PM ET</b><span>Ballots lock, the board tabulates overnight</span></div>
                  <div className="how-row"><b>TUESDAY</b><span>The reveal airs live on the show, argued out</span></div>
                  <div className="how-row"><b>ALWAYS</b><span>Full vote distribution goes public — the AP&apos;s never does</span></div>
                  <div className="how-row"><b>IN GOLD</b><span>Every disagreement vs. the AP, Coaches, and CFP, marked</span></div>
                </div>
              )}
              {DEMO_MODE && DEMO_POLL.map((t) => {
                const logoUrl = teamLogoUrl(slugifyTeam(t.team));
                return (
                <div className="rankcard" key={t.rank}>
                  <div className="rk-num">{t.rank}</div>
                  {logoUrl ? (
                    <Image src={logoUrl} alt={`${t.team} logo`} width={60} height={60} className="logo-img" />
                  ) : (
                    <div className="logo-box">{t.code}</div>
                  )}
                  <div className="rk-main">
                    <b>{t.team}</b>
                    <span className="rk-rec">PRESEASON</span>
                    <div className="pills">
                      <span className="pill">OFF {t.off}</span>
                      <span className="pill">DEF {t.def}</span>
                      <span className="pill">SOS {t.sos}</span>
                    </div>
                  </div>
                  <div className="rk-score">
                    <span className="val">{t.rating}</span>
                    {t.delta && (
                      <span className={`dl ${t.delta}`}>
                        {t.delta === "up" ? "▲" : "▼"} {t.deltaVal}
                      </span>
                    )}
                    <span className="lbl">JP RATING</span>
                  </div>
                </div>
                );
              })}
              <Link className="btn" href="/poll" style={{ width: "100%", textAlign: "center" }}>VIEW ALL 136 →</Link>
            </div>

            <div className="panel panel-accent-field">
              <span className="fr fr-field">✓ PORCH PICK&apos;EM</span>
              <p className="eyebrow">Free to Play · Bragging Rights Forever</p>
              <h3>Porch Pick&apos;Em</h3>
              {DEMO_MODE && <PreseasonChip />}
              <p>Ten games a week against Josh and the whole State. Build a streak. Earn your patches.</p>
              {DEMO_MODE ? (
                <>
                  {DEMO_LEADERBOARD.map((row) => (
                    <div className="lb-row" key={row.rank}>
                      <span>{row.rank}. {row.name}</span>
                      <span className="streak">{row.pts}{row.streak ? ` · 🔥 ${row.streak}` : ""}</span>
                    </div>
                  ))}
                  <div
                    style={{
                      marginTop: 12,
                      border: "1px dashed var(--line-l)",
                      borderRadius: 4,
                      padding: "10px 12px",
                      fontFamily: "var(--mono)",
                      fontSize: 12,
                      color: "var(--ink)",
                    }}
                  >
                    🎯 <b style={{ color: "var(--field)" }}>ONLY 32% OF CITIZENS BEAT JOSH LAST WEEK.</b> Think you can?
                    Picks lock Saturday 11:58 AM ET.
                  </div>
                </>
              ) : (
                <div className="how-rows">
                  <div className="how-row"><b>WEEKLY</b><span>Best score wins merch + a shoutout on Monday&apos;s show</span></div>
                  <div className="how-row"><b>MONTHLY</b><span>Top citizen gets a signed Pate Report + Poll Day spotlight</span></div>
                  <div className="how-row"><b>TOP 10</b><span>Finish the season top 10, pick a game — tickets covered</span></div>
                  <div className="how-row"><b>CHAMPION</b><span>Watches a game with Josh · name on the Wall, forever</span></div>
                  <div className="how-row"><b>WEEK 1</b><span>Everyone starts 0–0 — including Josh. Picks lock Sat 11:58 AM ET</span></div>
                </div>
              )}
              <div className="badges">
                <div className="badge">🏆</div>
                <div className="badge">🎯</div>
                <div className="badge">🗳️</div>
                <div className="badge locked">🏟️</div>
              </div>
              <p style={{ marginTop: 14, fontSize: 13 }}>
                Season champion watches a game with Josh. Top 10 win game tickets.
              </p>
              <Link className="btn" href="/pickem">Play Free — See the Prizes</Link>
            </div>
          </div>
          </Reveal>
        </div>
      </section>

      <section className="on-soft" id="citizen">
        <div className="wrap">
          <p className="eyebrow">Free Citizenship · The Daily Briefing</p>
          <h2 className="display">The Pate Playbook</h2>
          <div className="duo" style={{ marginTop: 18, alignItems: "stretch", gap: 22 }}>
            {/* Live preview of the actual daily email — real episode, real wire. */}
            <div className="playbook-preview">
              <div className="pb-chrome">
                <span className="pb-dot" /><span className="pb-dot" /><span className="pb-dot" />
                <span style={{ marginLeft: 10 }}>
                  The Playbook · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/New_York" })} · 6:00 AM ET
                </span>
              </div>
              <div className="pb-body">
                <p className="pb-from">FROM: The Pate State &lt;porch@thepatestate.com&gt;</p>
                <p className="pb-subject">Today on the porch</p>
                {latest && (
                  <a className="pb-episode" href={`https://www.youtube.com/watch?v=${latest.id}`} target="_blank" rel="noopener">
                    <span className="pb-thumb" style={{ position: "relative" }}>
                      <Image src={latest.thumbnail} alt="" fill sizes="120px" style={{ objectFit: "cover" }} />
                    </span>
                    <span>
                      <b>Yesterday&apos;s show</b>
                      <em>{latest.title.replace(/ - Josh Pate's College Football Show/i, "")}</em>
                    </span>
                  </a>
                )}
                {(liveWire.length >= 3 || DEMO_MODE) && (
                  <>
                    <p className="pb-label">The three stories that matter:</p>
                    <ul className="pb-wire">
                      {(liveWire.length >= 3 ? liveWire.slice(0, 3).map((w) => w.headline) : DEMO_WIRE.slice(0, 3).map((w) => w.headline)).map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="pb-cta">Today&apos;s ritual → make your picks before Saturday 11:58 AM ET.</p>
              </div>
            </div>
            <div className="card" style={{ textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <h3>Become a Citizen of the Pate State</h3>
              <p>
                This exact briefing, in your inbox every weekday morning: what actually happened in the sport,
                what it means, and what&apos;s worth your Saturday. Written like Josh talks. Free forever.
              </p>
              <div className="signup">
                <Link className="btn gold" href="/join">Become a Citizen — Free</Link>
              </div>
              <p style={{ margin: "16px 0 0", fontSize: 13 }}>
                Citizens get early poll access, pick&apos;em invites, first dibs on tour tickets — and the digital
                Pate Report free every July.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="tight">
        <div className="wrap">
          <Reveal>
          <div className="split">
            <div>
              <p className="eyebrow">Wear the Flag</p>
              <h2 className="display" style={{ fontSize: 36 }}>The State Store</h2>
              <div className="shop-items">
                {DEMO_SHOP.map((item) => (
                  <div key={item.label} className={item.hero ? "item hero-item has-photo" : "item has-photo"}>
                    <Image src={item.photo} alt={item.alt} fill sizes="(max-width: 700px) 33vw, 260px" style={{ objectFit: "cover" }} />
                    <div className="item-scrim" />
                    <div style={{ flex: 1 }} />
                    <b>{item.label}</b>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 18 }}><Link className="btn" href="/shop">Shop Everything</Link></div>
            </div>
            <div>
              <p className="eyebrow">The Porch Goes On the Road</p>
              <h2 className="display" style={{ fontSize: 36 }}>Live &amp; On Campus</h2>
              <div style={{ position: "relative", aspectRatio: "16/9", borderRadius: 6, overflow: "hidden", marginBottom: 16 }}>
                <Image
                  src="/img/campus-live.jpg"
                  alt="The Pate State broadcast desk set up live on a college quad"
                  fill
                  sizes="(max-width: 900px) 100vw, 560px"
                  style={{ objectFit: "cover" }}
                />
              </div>
              {DEMO_MODE ? (
                DEMO_TOUR.map((t) => (
                  <div className="tour-row" key={`${t.date}-${t.city}`}>
                    <span>{t.date} — {t.city}</span>
                    {t.soldOut ? <span>Sold Out</span> : <Link href="/porch">Tickets →</Link>}
                  </div>
                ))
              ) : (
                <>
                  <div className="tour-row">
                    <span>Campus stops are being booked now</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>DATES SOON</span>
                  </div>
                  <div className="tour-row">
                    <span>Citizens get first dibs the moment tickets drop</span>
                    <Link href="/join">Join free →</Link>
                  </div>
                </>
              )}
            </div>
          </div>
          </Reveal>
        </div>
      </section>

      <section className="on-soft">
        <div className="wrap">
          <p className="eyebrow">Every Stadium. Every Tradition. Every Tailgate.</p>
          <h2 className="display">Pate Tailgate</h2>
          <p className="lede">
            The field guide to actually living this sport — where to park, where to eat, what time to arrive, which
            traditions you can&apos;t miss.
          </p>
          <Reveal>
          <div className="guide-grid">
            {DEMO_GUIDES.map((g) => {
              const badgeUrl = teamLogoUrl(g.team);
              return (
                <Link className="guide" href="/tailgate" key={g.name}>
                  <div className="ph">
                    <Image src={g.photo} alt={g.alt} fill sizes="(max-width: 900px) 50vw, 280px" style={{ objectFit: "cover" }} />
                    {badgeUrl && (
                      <span className="team-chip">
                        <Image src={badgeUrl} alt={`${g.name} team logo`} width={26} height={26} style={{ objectFit: "contain" }} />
                      </span>
                    )}
                  </div>
                  <div className="body">
                    <h4>{g.name}</h4>
                    <div className="meta">{g.meta}</div>
                  </div>
                </Link>
              );
            })}
          </div>
          </Reveal>
          <div style={{ marginTop: 24 }}><Link className="btn" href="/tailgate">Open the Full Guide — 136 Stadiums</Link></div>
        </div>
      </section>

      <section className="on-dark">
        <div className="wrap">
          <div style={{ display: "flex", alignItems: "center", gap: 40, flexWrap: "wrap" }}>
            <Image
              src="/citizen-gift-cover.png"
              alt="The 2026 JP Preseason Football Guide cover"
              width={280}
              height={350}
              style={{
                width: 280,
                maxWidth: "80vw",
                height: "auto",
                borderRadius: 6,
                border: "1px solid var(--line-d)",
                boxShadow: "0 18px 50px rgba(0,0,0,.45)",
                transform: "rotate(-2deg)",
              }}
            />
            <div style={{ flex: 1, minWidth: 280 }}>
              <span className="fr">🎁 THE CITIZEN GIFT</span>
              <p className="eyebrow">Free the Moment You Join</p>
              <h2 className="display" style={{ fontSize: "clamp(30px,4vw,44px)" }}>
                Become a Citizen,<br />Get the Guide.
              </h2>
              <p className="lede">
                The 2026 JP Preseason Football Guide — the Top 50 ranked, analyzed, and explained, the playoff
                picture, the X-factors, and the breakout players — yours free (digital edition) the moment you claim
                citizenship.
              </p>
              <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link className="btn gold" href="/join">Claim Free Citizenship</Link>
                <Link className="btn" href="/report">Peek Inside the Guide</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="tight on-soft on-light">
        <div className="wrap" style={{ textAlign: "center" }}>
          <p className="eyebrow">Follow the Porch Everywhere</p>
          <div className="platforms" style={{ justifyContent: "center" }}>
            <a className="chip" href={CHANNEL_URL} target="_blank" rel="noopener">YouTube</a>
            <a className="chip" href={SOCIAL_LINKS.x} target="_blank" rel="noopener">𝕏 X</a>
            <a className="chip" href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener">Instagram</a>
            <a className="chip" href={SOCIAL_LINKS.tiktok} target="_blank" rel="noopener">TikTok</a>
          </div>
        </div>
      </section>

      <div className="cta-band">
        <div className="wrap row">
          <div>
            <h3>Who&apos;s In? See the Playoff Picture.</h3>
            <p>THE BRACKET, THE RANKINGS, JOSH&apos;S PICKS — AND AN AI TO RUN YOUR OWN</p>
          </div>
          <Link className="btn" href="/playoffs" style={{ borderColor: "var(--lamp)", color: "var(--lamp)" }}>
            Open the Playoffs Page →
          </Link>
        </div>
      </div>
    </main>
  );
}
