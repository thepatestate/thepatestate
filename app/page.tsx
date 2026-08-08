import Image from "next/image";
import Link from "next/link";
import { getVideos, isEpisode, CHANNEL_URL } from "@/lib/youtube";
import { getPublishedArticles } from "@/lib/sanity";
import { formatDate } from "@/lib/format";
import EpisodeHero from "@/components/EpisodeHero";
import VideoGrid from "@/components/VideoGrid";
import SubscribeCTA from "@/components/SubscribeCTA";
import PreseasonChip from "@/components/PreseasonChip";

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

type IconColors = { bg: string; diag: string; mask: string };

// The wireframe repeats a placeholder "helmet" SVG per news/wire item,
// varying only these three fill colors.
function HelmetIcon({ bg, diag, mask }: IconColors) {
  return (
    <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice">
      <rect width="160" height="100" fill={bg} />
      <path d="M160,0 L160,100 L70,100 Z" fill={diag} opacity=".28" />
      <rect y="86" width="160" height="2" fill="rgba(255,255,255,.35)" />
      <g transform="translate(44,20) scale(1.9)">
        <path
          d="M4,17 C4,8 10,3 18,3 C27,3 33,9 33,17 L33,23 C33,25 31,26 29,26 L24,26 L24,29 L14,29 C8,29 4,24 4,17 Z"
          fill={bg}
        />
        <rect x="15" y="3" width="6" height="23" rx="3" fill={mask} />
        <path
          d="M27,15 L38,15 M27,21 L38,21 M33,12 L33,24"
          stroke="#DADDE2"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

// Same duplication pattern as HelmetIcon above: a small per-file lookup
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
    icon: { bg: "#0F1B2D", diag: "#E8A33D", mask: "#E8A33D" },
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
    icon: { bg: "#1E3B2E", diag: "#F3EFE6", mask: "#F3EFE6" },
  },
] as const;

const DEMO_WIRE = [
  {
    time: "2 HRS AGO",
    category: "RECRUITING",
    headline: "A&M holds No. 1 on both major boards",
    badge: "Full Story Ready",
    body: "26 commits, six five-stars — the 2027 class keeps growing.",
    icon: { bg: "#500000", diag: "#FFFFFF", mask: "#FFFFFF" },
  },
  {
    time: "THIS WEEK",
    category: "RECRUITING",
    headline: "Last 2027 five-stars come off the board",
    badge: null,
    body: "Indiana lands a five-star WR; Tennessee keeps a five-star RB home.",
    icon: { bg: "#990000", diag: "#EEEDEB", mask: "#FFFFFF" },
  },
  {
    time: "2 WKS AGO",
    category: "MEDIA",
    headline: "Josh's new ESPN Friday show announced",
    badge: null,
    body: "Fridays this fall, sometimes live from GameDay sites.",
    icon: { bg: "#0F1B2D", diag: "#E8A33D", mask: "#E8A33D" },
  },
  {
    time: "TODAY",
    category: "THE STATE",
    headline: "Porch Pick'Em registration opens",
    badge: null,
    body: "Season champ watches a game with Josh.",
    icon: { bg: "#1E3B2E", diag: "#E8A33D", mask: "#E8A33D" },
  },
  {
    time: "THIS WEEK",
    category: "THE POLL",
    headline: "Ballots open Sunday 8PM ET",
    badge: null,
    body: "Week 1 reveal comes Tuesday on the show.",
    icon: { bg: "#15243B", diag: "#F3EFE6", mask: "#E8A33D" },
  },
  {
    time: "TODAY",
    category: "THE STORE",
    headline: "Creed Tee restock lands",
    badge: null,
    body: "Tri-blend, ridiculously soft — first run sold out in nine days.",
    icon: { bg: "#1E3B2E", diag: "#E8A33D", mask: "#F3EFE6" },
  },
] as const;

const DEMO_SHOP = [
  { label: "THE CREED TEE — $28 · TRI-BLEND", hero: true },
  { label: "PORCH FLAG — $34", hero: false },
  { label: "GAMEDAY HAT — $32", hero: false },
] as const;

const DEMO_TOUR = [
  { date: "SEP 5", city: "ATHENS, GA", soldOut: false },
  { date: "SEP 19", city: "AUSTIN, TX", soldOut: false },
  { date: "OCT 10", city: "COLUMBUS, OH", soldOut: false },
  { date: "NOV 7", city: "BATON ROUGE, LA", soldOut: true },
] as const;

const DEMO_GUIDES = [
  { name: "Tiger Stadium", meta: "LSU · NIGHT GAME SURVIVAL", emoji: "🌙", gradient: "linear-gradient(135deg,#461D7C 0%,#FDD023 100%)" },
  { name: "The Grove", meta: "OLE MISS · MASTERCLASS", emoji: "🥂", gradient: "linear-gradient(135deg,#14213D 0%,#CE1126 100%)" },
  { name: "The Horseshoe", meta: "OHIO STATE · FIRST-TIMER", emoji: "🏟️", gradient: "linear-gradient(135deg,#BB0000 0%,#666666 100%)" },
  { name: "Camp Randall", meta: "WISCONSIN · JUMP AROUND", emoji: "🦡", gradient: "linear-gradient(135deg,#C5050C 0%,#FFFFFF 100%)" },
] as const;

export default async function Home() {
  const videos = await getVideos();
  const episodes = videos.filter(isEpisode);
  const latest = episodes[0] ?? videos[0];
  const recentEpisodes = episodes.filter((v) => v !== latest).slice(0, 3);
  const notebookArticles = await getPublishedArticles(3);
  const notebookLead = notebookArticles[0] ?? null;
  const notebookNext = notebookArticles.slice(1, 3);

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
            <Link className="btn" href="/show">Browse the Show</Link>
          </div>
        </div>
      </section>

      {latest && (
        <section className="on-dark">
          <div className="wrap">
            <p className="eyebrow">America&apos;s College Football Show</p>
            <h2 className="display">The Show</h2>
            <div className="show-grid">
              <div>
                <EpisodeHero video={latest} tag="NEW EPISODE" />
              </div>
              <VideoGrid videos={recentEpisodes} />
            </div>
            <p className="sched">
              <b>MON</b> Weekend Truths · <b>TUE</b> Poll Day · <b>WED</b> The Sit-Down ·{" "}
              <b>THU</b> Picks Drop · <b>FRI</b> The ESPN Show · <b>SAT</b> We Watch Ball
            </p>
            <p style={{ marginTop: 20 }}>
              <a className="btn" href={CHANNEL_URL} target="_blank" rel="noopener">Browse Every Episode</a>
            </p>
          </div>
        </section>
      )}

      <div className="yardline" />

      <section className="on-dark tight">
        <div className="wrap">
          <div className="duo">
            <div className="panel panel-dark">
              <span className="fr">🗳 THE JP POLL</span>
              <p className="eyebrow">Vote Sunday · Reveal Tuesday</p>
              <h3>The People&apos;s Power Ranking</h3>
              <PreseasonChip />
              <p>One board, voted by those who actually watch, revealed every Tuesday. The top of this week&apos;s:</p>
              {DEMO_POLL.map((t) => (
                <div className="rankcard dark" key={t.rank}>
                  <div className="rk-num">{t.rank}</div>
                  <div className="logo-box">{t.code}</div>
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
              ))}
              <Link className="btn" href="/poll" style={{ width: "100%", textAlign: "center" }}>VIEW ALL 136 →</Link>
            </div>

            <div className="panel panel-field">
              <span className="fr">✓ PORCH PICK&apos;EM</span>
              <p className="eyebrow">Free to Play · Bragging Rights Forever</p>
              <h3>Porch Pick&apos;Em</h3>
              <PreseasonChip />
              <p>Ten games a week against Josh and the whole State. Build a streak. Earn your patches.</p>
              {DEMO_LEADERBOARD.map((row) => (
                <div className="lb-row" key={row.rank}>
                  <span>{row.rank}. {row.name}</span>
                  <span className="streak">{row.pts}{row.streak ? ` · 🔥 ${row.streak}` : ""}</span>
                </div>
              ))}
              <div
                style={{
                  marginTop: 12,
                  border: "1px dashed var(--line-d)",
                  borderRadius: 4,
                  padding: "10px 12px",
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  color: "var(--chalk)",
                }}
              >
                🎯 <b style={{ color: "var(--lamp)" }}>ONLY 32% OF CITIZENS BEAT JOSH LAST WEEK.</b> Think you can?
                Picks lock Saturday 11:58 AM ET.
              </div>
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
        </div>
      </section>

      <section>
        <div className="wrap">
          <p className="eyebrow">From the Porch — New Every Weekday</p>
          <h2 className="display">The Notebook</h2>
          {!notebookLead && <PreseasonChip />}
          <div className="duo" style={{ gridTemplateColumns: "2fr 1fr", marginTop: 26 }}>
            {notebookLead ? (
              <div>
                <Link href={`/notebook/${notebookLead.slug.current}`} style={{ display: "block" }}>
                  <div
                    style={{
                      aspectRatio: "16/8",
                      borderRadius: 6,
                      background: "linear-gradient(150deg,var(--navy) 0%,#1A2E47 60%,var(--field) 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid var(--line-l)",
                    }}
                  >
                    <span className="playbtn" aria-hidden="true">▶</span>
                  </div>
                </Link>
                <div style={{ marginTop: 16 }}><span className="fr">📝 {seriesLabel(notebookLead.episode?.series)}</span></div>
                <h3 className="display" style={{ fontSize: "clamp(24px,3vw,33px)", lineHeight: 0.95, margin: "6px 0 8px" }}>
                  <Link href={`/notebook/${notebookLead.slug.current}`}>{notebookLead.headline}</Link>
                </h3>
                {notebookLead.dek && (
                  <p style={{ fontSize: 15, color: "var(--ink-dim)" }}>{notebookLead.dek}</p>
                )}
                <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)", marginTop: 10 }}>
                  <b style={{ color: "var(--ink)" }}>{notebookLead.byline}</b>
                  {notebookLead.publishedAt ? ` · ${formatDate(notebookLead.publishedAt)}` : ""}
                </div>

                {notebookNext.map((a, i) => (
                  <div
                    className="newsitem"
                    key={a._id}
                    style={{ marginTop: i === 0 ? 10 : 0, borderBottom: i === notebookNext.length - 1 ? "none" : undefined }}
                  >
                    <div className="nx">
                      <h4 style={{ fontSize: 21 }}>
                        <Link href={`/notebook/${a.slug.current}`}>{a.headline}</Link>
                      </h4>
                      {a.dek && <p style={{ fontSize: 14, color: "var(--ink-dim)", marginTop: 6 }}>{a.dek}</p>}
                      <div className="by">
                        <b>{a.byline}</b>
                        {a.publishedAt ? ` · ${formatDate(a.publishedAt)}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
                <Link className="btn" href="/notebook">Open the Notebook</Link>
              </div>
            ) : (
              <div>
                <Link href="/notebook" style={{ display: "block" }}>
                  <div
                    style={{
                      aspectRatio: "16/8",
                      borderRadius: 6,
                      background: "linear-gradient(150deg,var(--navy) 0%,#1A2E47 60%,var(--field) 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid var(--line-l)",
                    }}
                  >
                    <span className="playbtn" aria-hidden="true">▶</span>
                  </div>
                </Link>
                <div style={{ marginTop: 16 }}><span className="fr">📝 WEEKEND TRUTHS</span></div>
                <h3 className="display" style={{ fontSize: "clamp(24px,3vw,33px)", lineHeight: 0.95, margin: "6px 0 8px" }}>
                  <Link href="/notebook">What Saturday Actually Told Us</Link>
                </h3>
                <p style={{ fontSize: 15, color: "var(--ink-dim)" }}>
                  Five things that were real, three overreactions to ignore, and the one stat nobody&apos;s talking
                  about — new every Monday at 7AM.
                </p>
                <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)", marginTop: 10 }}>
                  <b style={{ color: "var(--ink)" }}>JOSH PATE</b> · 6 MIN READ · TODAY
                </div>

                {DEMO_NOTEBOOK_FEATURED.map((item, i) => (
                  <div
                    className="newsitem"
                    key={item.title}
                    style={{ marginTop: i === 0 ? 10 : 0, borderBottom: i === DEMO_NOTEBOOK_FEATURED.length - 1 ? "none" : undefined }}
                  >
                    <div className="nx">
                      <div
                        className="logo-box sm"
                        style={{ background: item.badgeBg, color: item.badgeColor, border: "none", width: 36, height: 36, fontSize: 12, marginBottom: 10 }}
                      >
                        {item.badgeText}
                      </div>
                      <h4 style={{ fontSize: 21 }}>
                        <Link href="/notebook">{item.title}</Link>
                        {item.citizenBadge && <span className="cit-badge">Citizens Only · Free</span>}
                      </h4>
                      <p style={{ fontSize: 14, color: "var(--ink-dim)", marginTop: 6 }}>{item.body}</p>
                      <div className="by"><b>{item.by}</b> · {item.when}</div>
                    </div>
                    <div className="newsthumb" style={{ flexBasis: 176 }}>
                      <HelmetIcon {...item.icon} />
                    </div>
                  </div>
                ))}
                <Link className="btn" href="/notebook">Open the Notebook</Link>
              </div>
            )}

            <div className="wire">
              <h3><span className="dot" />The Wire</h3>
              {DEMO_WIRE.map((w) => (
                <div className="wire-item" key={w.headline}>
                  <div className="wire-thumb2"><HelmetIcon {...w.icon} /></div>
                  <div className="wtxt">
                    <span className="t">{w.time} · {w.category}</span>
                    <b>{w.headline}{w.badge && <span className="ai-badge">{w.badge}</span>}</b>
                    <p>{w.body}</p>
                  </div>
                </div>
              ))}
              <Link className="btn gold" href="/notebook" style={{ marginTop: 14, width: "100%", textAlign: "center" }}>
                All Breaking News
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="on-field" id="citizen">
        <div className="wrap" style={{ textAlign: "center" }}>
          <p className="eyebrow">Free Citizenship · The Daily Briefing</p>
          <h2 className="display">The Pate Playbook</h2>
          <PreseasonChip />
          <div className="card">
            <h3>Become a Citizen of the Pate State</h3>
            <p>
              One email every weekday morning: what actually happened in the sport, what it means, and what&apos;s
              worth your Saturday. Written like Josh talks. Free forever.
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
      </section>

      <section className="tight">
        <div className="wrap">
          <div className="split">
            <div>
              <p className="eyebrow">Wear the Flag</p>
              <h2 className="display" style={{ fontSize: 36 }}>The State Store</h2>
              <PreseasonChip />
              <div className="shop-items">
                {DEMO_SHOP.map((item) => (
                  <div
                    key={item.label}
                    className={item.hero ? "item hero-item" : "item"}
                    style={item.hero ? { background: "var(--paper-2)" } : undefined}
                  >
                    <div style={{ flex: 1 }} />
                    <b style={item.hero ? { color: "var(--ink)" } : undefined}>{item.label}</b>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 18 }}><Link className="btn" href="/shop">Shop Everything</Link></div>
            </div>
            <div>
              <p className="eyebrow">The Porch Goes On the Road</p>
              <h2 className="display" style={{ fontSize: 36 }}>Live &amp; On Campus</h2>
              <PreseasonChip />
              {DEMO_TOUR.map((t) => (
                <div className="tour-row" key={`${t.date}-${t.city}`}>
                  <span>{t.date} — {t.city}</span>
                  {t.soldOut ? <span>Sold Out</span> : <Link href="/porch">Tickets →</Link>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="on-field">
        <div className="wrap">
          <p className="eyebrow">Every Stadium. Every Tradition. Every Tailgate.</p>
          <h2 className="display">Pate Tailgate</h2>
          <PreseasonChip />
          <p className="lede">
            The field guide to actually living this sport — where to park, where to eat, what time to arrive, which
            traditions you can&apos;t miss.
          </p>
          <div className="guide-grid">
            {DEMO_GUIDES.map((g) => (
              <Link className="guide" href="/tailgate" key={g.name}>
                <div className="ph" style={{ background: g.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44 }}>
                  {g.emoji}
                </div>
                <div className="body">
                  <h4>{g.name}</h4>
                  <div className="meta">{g.meta}</div>
                </div>
              </Link>
            ))}
          </div>
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
              <PreseasonChip />
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
