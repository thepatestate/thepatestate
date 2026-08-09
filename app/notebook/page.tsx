import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getPublishedArticles } from "@/lib/sanity";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "The Notebook" };
export const revalidate = 300;

// Same duplication pattern as the notebook cards below: a small per-file
// lookup rather than a shared lib module (this codebase doesn't DRY up
// presentational bits — see components/ArticleBody.tsx for the sibling copy).
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

// --- Preseason-preview sample data ---------------------------------------
// Stands in for the Notebook CMS (articles, the wire feed, most-popular
// tracking). Swap for live queries when the CMS ships; the JSX below only
// touches these arrays. Card/tile photos below follow the same
// category→image mapping the homepage's Notebook + Wire sections use (see
// app/page.tsx's DEMO_NOTEBOOK_FEATURED/DEMO_WIRE): recruiting/portal→turf,
// media/coaching→film, poll/state→goalpost, TV/matchups→matchup-helmets,
// store→train-tee. Adjacent cards never repeat the same photo.

const DEMO_CATNAV = ["Latest", "Josh Pate", "News", "Recruiting & Portal", "Rankings", "Teams", "Columns"] as const;

const DEMO_FEATURED = [
  {
    title: "Why the Citizens Jumped Texas to No. 3", meta: "POLL DAY, EXPLAINED · TUE",
    photo: "/img/editorial-goalpost.jpg", alt: "A goalpost silhouetted in fog against the sunrise",
  },
  {
    title: "The Week 1 Honor Roll", meta: "TOP PERFORMERS · WED",
    photo: "/img/matchup-helmets.jpg", alt: "Blank navy and gold helmets facing off before kickoff",
  },
  {
    title: "Wedding Season vs. Football Season", meta: "THE MAILBAG · FRI",
    photo: "/img/editorial-film.jpg", alt: "A film projector beside a chalkboard of X's-and-O's diagrams",
  },
] as const;

type Photo = { src: string; alt: string };

type NewsItem = {
  logoText: string;
  logoBg: string;
  logoColor: string;
  headline: string;
  locked: boolean;
  citizenBadge: string | null;
  by: string;
  date: string;
  nudge: boolean;
  thumb: Photo | null;
};

// Sample headlines only — never linked to article.html (that template
// belongs to sub-project C) or anywhere else; these render as non-link
// cards. Thumbs use a team helmet when the story is about one specific
// team, and an editorial photo otherwise — matching the pattern already
// used for the DEMO_WIRE rail below.
const DEMO_NEWS: readonly NewsItem[] = [
  {
    logoText: "UGA", logoBg: "#BA0C2F", logoColor: "#fff",
    headline: "Georgia's Margin for Error Is a Myth", locked: false, citizenBadge: null,
    by: "Josh Pate", date: "AUG 7, 2026", nudge: false,
    thumb: { src: "/img/helmets/georgia.jpg", alt: "Georgia helmet studio photo" },
  },
  {
    logoText: "JP", logoBg: "var(--navy)", logoColor: "var(--lamp)",
    headline: "The JP Poll Still Doesn't Trust Alabama — Here's the Math", locked: true,
    citizenBadge: "Citizens Only · Free", by: "Staff", date: "AUG 7, 2026", nudge: true,
    thumb: { src: "/img/editorial-goalpost.jpg", alt: "A goalpost silhouetted in fog against the sunrise" },
  },
  {
    logoText: "A&M", logoBg: "#500000", logoColor: "#fff",
    headline: "Aggies Hold No. 1 on Both Boards With Six Five-Stars", locked: false, citizenBadge: null,
    by: "Staff", date: "AUG 6, 2026", nudge: false, thumb: null,
  },
  {
    logoText: "IU", logoBg: "#990000", logoColor: "#fff",
    headline: "Indiana Closes the 2027 Board With a Five-Star WR", locked: false, citizenBadge: null,
    by: "Staff", date: "AUG 6, 2026", nudge: false,
    thumb: { src: "/img/helmets/indiana.jpg", alt: "Indiana helmet studio photo" },
  },
  {
    logoText: "★", logoBg: "var(--field)", logoColor: "var(--lamp)",
    headline: "Watch Parties Expand to 40 Cities — Three New Chapters Open", locked: false, citizenBadge: null,
    by: "The Porch Desk", date: "AUG 6, 2026", nudge: false, thumb: null,
  },
  {
    logoText: "LSU", logoBg: "#461D7C", logoColor: "#FDD023",
    headline: "Night Games in Death Valley: The Survival Guide, Updated", locked: true,
    citizenBadge: "Citizens Only · Free", by: "Staff", date: "AUG 5, 2026", nudge: false,
    thumb: { src: "/img/tailgate-night.jpg", alt: "LSU fans in purple and gold packing Tiger Stadium's night tailgate lot" },
  },
];

const DEMO_POPULAR = [
  { n: "01", title: "The 5 Programs Under the Most Pressure This Fall", meta: "48K READS · PAIRS WITH EP 1,204" },
  { n: "02", title: "Why the JP Poll Doesn't Trust Alabama Yet", meta: "31K READS · POLL DAY COLUMN" },
  { n: "03", title: "The Grove, Ranked: A Tailgate Masterclass", meta: "27K READS · PATE TAILGATE" },
  { n: "04", title: "Portal Winners Nobody's Pricing In", meta: "22K READS · THE NEXT WAVE" },
] as const;

const DEMO_WIRE = [
  {
    time: "2 HRS AGO", category: "RECRUITING", headline: "Texas A&M holds No. 1 on both major boards",
    badge: "Full Story Ready", body: "26 commits and six five-stars in the 2027 class.",
    photo: "/img/editorial-turf.jpg", alt: "Frosted turf and a yard line at dawn",
  },
  {
    time: "THIS WEEK", category: "RECRUITING", headline: "Final 2027 five-stars commit", badge: null,
    body: "A five-star WR picks Indiana; a five-star RB stays with Tennessee.",
    photo: "/img/editorial-goalpost.jpg", alt: "A goalpost silhouetted in fog against the sunrise",
  },
  {
    time: "2 WKS AGO", category: "MEDIA", headline: "New ESPN Friday show announced", badge: null,
    body: "Josh pairs with Bussin' With The Boys, sometimes live from GameDay sites.",
    photo: "/img/editorial-film.jpg", alt: "A film projector beside a chalkboard of X's-and-O's diagrams",
  },
  {
    time: "TODAY", category: "THE STATE", headline: "Porch Pick'Em opens for the season", badge: null,
    body: "Season champion watches a game with Josh; top 10 win tickets.",
    photo: "/img/editorial-goalpost.jpg", alt: "A goalpost silhouetted in fog against the sunrise",
  },
  {
    time: "THIS WEEK", category: "THE POLL", headline: "Ballots open Sunday 8PM ET", badge: null,
    body: "Week 1 reveal comes Tuesday on the show.",
    photo: "/img/editorial-film.jpg", alt: "A film projector beside a chalkboard of X's-and-O's diagrams",
  },
  {
    time: "TODAY", category: "COACHING", headline: "Hot-seat watch: three ADs go quiet", badge: null,
    body: "Buyout math is moving in two SEC towns and one in the Big 12.",
    photo: "/img/editorial-turf.jpg", alt: "Frosted turf and a yard line at dawn",
  },
  {
    time: "YESTERDAY", category: "PORTAL", headline: "August portal ripple begins", badge: null,
    body: "Two projected starters enter; three contenders circle.",
    photo: "/img/editorial-goalpost.jpg", alt: "A goalpost silhouetted in fog against the sunrise",
  },
  {
    time: "YESTERDAY", category: "THE STATE", headline: "Watch parties hit 40 cities", badge: null,
    body: "New chapters open in Charlotte, Boise, and San Diego.",
    photo: "/img/matchup-helmets.jpg", alt: "Blank navy and gold helmets facing off before kickoff",
  },
  {
    time: "THIS WEEK", category: "TV", headline: "Week 1 kick times locked", badge: "Full Story Ready",
    body: "Georgia–Bama gets the 7:30 CBS window; Oregon–Michigan at 3:30.",
    photo: "/img/editorial-turf.jpg", alt: "Frosted turf and a yard line at dawn",
  },
] as const;

export default async function NotebookPage() {
  const articles = await getPublishedArticles(7);
  const lead = articles[0] ?? null;
  const featured = articles.slice(1, 4);

  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / The Notebook</p>
          <h1>The Notebook</h1>
          <p className="lede">
            Breaking news, the newest columns, and what the citizens are reading most — the written record of the
            sport, new every weekday.
          </p>
          {/* Hardcoded: PreseasonChip always appends "— live data arrives with the
              season", which would duplicate the trailing clause here. Once real
              articles exist the page is no longer a preseason preview, so the
              chip drops entirely rather than swapping to different copy. */}
          {!lead && <span className="note">Preseason preview — the Notebook opens with the season</span>}
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="duo" style={{ gridTemplateColumns: "2fr 1fr" }}>
            <div>
              <div className="catnav">
                {DEMO_CATNAV.map((c, i) => (
                  <Link key={c} href="/#" className={i === 0 ? "on" : undefined}>{c}</Link>
                ))}
              </div>

              {lead ? (
                <Link href={`/notebook/${lead.slug.current}`} className="lead-story" style={{ textDecoration: "none", color: "inherit" }}>
                  <div className="ph">
                    <Image
                      src={lead.heroUrl || "/img/editorial-film.jpg"}
                      alt={lead.heroUrl ? lead.headline : "A film projector beside a chalkboard of X's-and-O's diagrams"}
                      fill
                      sizes="(max-width: 860px) 100vw, 500px"
                      style={{ objectFit: "cover" }}
                    />
                    <div className="overlay" />
                    <span className="playbtn" aria-hidden="true">▶</span>
                  </div>
                  <div>
                    <span className="fr">📝 {seriesLabel(lead.episode?.series)}</span>
                    <h3>{lead.headline}</h3>
                    {lead.dek && <p className="deck">{lead.dek}</p>}
                    <div className="meta">
                      {lead.byline.toUpperCase()}
                      {lead.publishedAt ? ` · ${formatDate(lead.publishedAt)}` : ""}
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="lead-story">
                  <div className="ph">
                    <Image
                      src="/img/editorial-film.jpg"
                      alt="A film projector beside a chalkboard of X's-and-O's diagrams"
                      fill
                      sizes="(max-width: 860px) 100vw, 500px"
                      style={{ objectFit: "cover" }}
                    />
                    <div className="overlay" />
                    <button className="playbtn" aria-label="Play" disabled>▶</button>
                  </div>
                  <div>
                    <span className="fr">📝 WEEKEND TRUTHS</span>
                    <h3>What Saturday Actually Told Us</h3>
                    <p className="deck">
                      Five things that were real, three overreactions to ignore, and the one stat nobody&apos;s
                      talking about — the written spine of the whole week.
                    </p>
                    <div className="meta">JOSH PATE · 6 MIN READ · TODAY 7:00 AM</div>
                  </div>
                </div>
              )}

              {lead && featured.length > 0 ? (
                <div className="feat-grid">
                  {featured.map((a) => (
                    <Link className="feat" href={`/notebook/${a.slug.current}`} key={a._id}>
                      <div className="ph" style={a.heroUrl ? { position: "relative" } : undefined}>
                        {a.heroUrl && (
                          <Image src={a.heroUrl} alt={a.headline} fill sizes="(max-width: 860px) 33vw, 280px" style={{ objectFit: "cover" }} />
                        )}
                      </div>
                      <div className="bd">
                        <h4>{a.headline}</h4>
                        <div className="meta">
                          {a.byline}
                          {a.publishedAt ? ` · ${formatDate(a.publishedAt)}` : ""}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : !lead ? (
                <div className="feat-grid">
                  {DEMO_FEATURED.map((f) => (
                    <div className="feat" key={f.title}>
                      <div className="ph" style={{ position: "relative" }}>
                        <Image src={f.photo} alt={f.alt} fill sizes="(max-width: 860px) 33vw, 280px" style={{ objectFit: "cover" }} />
                      </div>
                      <div className="bd">
                        <h4>{f.title}</h4>
                        <div className="meta">{f.meta}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <p className="eyebrow" style={{ marginTop: 38 }}>Latest News</p>
              {lead && <span className="note">Sample content below — more real stories coming</span>}
              <div style={{ marginTop: 4 }}>
                {DEMO_NEWS.map((n) => (
                  <div className={n.locked ? "newsitem locked" : "newsitem"} key={n.headline}>
                    <div className="nx">
                      <div
                        className="logo-box sm"
                        style={{ background: n.logoBg, color: n.logoColor, border: "none", width: 36, height: 36, fontSize: 12, marginBottom: 10 }}
                      >
                        {n.logoText}
                      </div>
                      <h4>
                        {n.headline}
                        {n.citizenBadge && <span className="cit-badge">{n.citizenBadge}</span>}
                      </h4>
                      <div className="by"><b>{n.by}</b> · {n.date}</div>
                      {n.nudge && (
                        <div className="cit-nudge">
                          Full ballot data &amp; the vote breakdown —{" "}
                          <Link href="/#citizen">claim free citizenship to read</Link>.
                        </div>
                      )}
                    </div>
                    {n.thumb && (
                      <div className="newsthumb" style={{ position: "relative" }}>
                        <Image src={n.thumb.src} alt={n.thumb.alt} fill sizes="200px" style={{ objectFit: "cover" }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14 }}><Link className="btn" href="/#">Load More Articles</Link></div>

              <p className="eyebrow" style={{ marginTop: 38 }}>Most Popular This Week</p>
              {lead && <span className="note">Sample content below — more real stories coming</span>}
              <div style={{ marginTop: 8 }}>
                {DEMO_POPULAR.map((p) => (
                  <div className="perf" key={p.n}>
                    <div className="n">{p.n}</div>
                    <div className="who">
                      <b>{p.title}</b>
                      <div className="meta">{p.meta}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14 }}><Link className="btn" href="/#">More Popular Articles</Link></div>
            </div>

            <div className="wire">
              <h3><span className="dot" />Breaking News</h3>
              {lead && <span className="note">Sample content below — more real stories coming</span>}
              {DEMO_WIRE.map((w) => (
                <div className="wire-item" key={w.headline}>
                  <div className="wire-thumb2" style={{ position: "relative" }}>
                    <Image src={w.photo} alt={w.alt} fill sizes="86px" style={{ objectFit: "cover" }} />
                  </div>
                  <div className="wtxt">
                    <span className="t">{w.time} · {w.category}</span>
                    <b>{w.headline}{w.badge && <span className="ai-badge">{w.badge}</span>}</b>
                    <p>{w.body}</p>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 14, padding: 12, border: "1px dashed var(--line-l)", borderRadius: 4, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)", lineHeight: 1.6 }}>
                ⚡ <b style={{ color: "var(--field)" }}>THE WIRE DESK</b> — when news is big enough, our AI drafts
                the full story within minutes and an editor signs off before it publishes. Speed of a wire service,
                standards of the porch.
              </div>
              <Link className="btn gold" href="/#" style={{ marginTop: 14, width: "100%", textAlign: "center" }}>
                Load More News
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="on-dark tight">
        <div className="wrap">
          <p className="eyebrow">Why This Exists</p>
          <h2 className="display" style={{ fontSize: 32 }}>Video Builds the Audience. Words Build the Archive.</h2>
          <p className="lede">
            Search engines and AI assistants can&apos;t quote a video. Every episode&apos;s written companion is
            what gets found, cited, and shared — and every article embeds its clips, so there&apos;s no separate
            social feed to maintain.
          </p>
          <p className="lede" style={{ marginTop: 14 }}>
            And a few columns each week — the mailbag, the ballot data, the deep guides — are{" "}
            <b style={{ color: "var(--lamp)" }}>Citizens Only</b>. Still free, forever. Citizenship is just how the
            porch knows who&apos;s home.
          </p>
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
                picture, the X-factors, and the breakout players — yours free (digital edition) the moment you
                claim citizenship.
              </p>
              <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link className="btn gold" href="/join">Claim Free Citizenship</Link>
                <Link className="btn" href="/report">Peek Inside the Guide</Link>
              </div>
            </div>
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
