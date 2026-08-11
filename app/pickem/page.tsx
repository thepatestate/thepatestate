import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PreseasonChip from "@/components/PreseasonChip";
import EmptyState from "@/components/EmptyState";
import VideoGrid from "@/components/VideoGrid";
import { DEMO_MODE } from "@/lib/demo";
import { createArtPicker } from "@/lib/editorial-art";
import { getVideos, SOCIAL_LINKS } from "@/lib/youtube";

export const metadata: Metadata = {
  title: "Porch Pick'Em",
  description: "Ten games a week against Josh and the whole State — free forever, streaks and patches, real prizes. Season champ watches a game with Josh.",
  alternates: { canonical: "/pickem" },
};
export const revalidate = 21600;

// --- Preseason-preview sample data ---------------------------------------
// Stands in for the picks engine (leaderboard) and the pundit-tracker feed.
// Swap for live queries when each engine ships; the JSX below only touches
// these arrays. The prize ladder further down is Josh's actual plan copy,
// not sample data, so it stays un-chipped.

const DEMO_LEADERBOARD = [
  { rank: "1.", name: "SicEmSaturdays", pts: "1,842 PTS", streak: "W14" },
  { rank: "2.", name: "PorchSwingProphet", pts: "1,791 PTS", streak: "W11" },
  { rank: "3.", name: "Josh Pate", pts: "1,764 PTS", streak: "W9" },
  { rank: "4.", name: "GroveGoblin", pts: "1,733 PTS", streak: null },
  { rank: "5.", name: "ChalkEater88", pts: "1,700 PTS", streak: null },
  { rank: "6.", name: "HailStateHattie", pts: "1,688 PTS", streak: null },
  { rank: "7.", name: "DesertSwarm", pts: "1,671 PTS", streak: null },
  { rank: "8.", name: "BuckeyeBev", pts: "1,660 PTS", streak: null },
  { rank: "9.", name: "UpsetUncle", pts: "1,655 PTS", streak: null },
  { rank: "10.", name: "FourthAndForever", pts: "1,649 PTS", streak: null },
] as const;

const DEMO_PRIZES = [
  { tier: "Weekly", title: "Merch + a shoutout on the show", body: "Best score of the week gets State Store gear and your handle read on Monday's episode." },
  { tier: "Monthly", title: "Signed Pate Report + Poll spotlight", body: "Top citizen each month gets a signed annual and their ballot featured on Poll Day." },
  { tier: "Top 10", title: "Game tickets", body: "Finish the season top 10 and pick a game — we cover the tickets." },
  { tier: "Champion", title: "Watch a game with Josh", body: "The season champ gets a seat next to Josh for a Saturday — plus their name on the Wall of Champions, forever." },
] as const;

const DEMO_PUNDITS = [
  { rk: 1, initials: "JP", name: "Josh Pate", aff: "THE PATE STATE", josh: true },
  { rk: 2, initials: "CF", name: 'Chris "The Bear" Fallica', aff: "FOX · BIG NOON", josh: false },
  { rk: 3, initials: "JK", name: "Joel Klatt", aff: "FOX", josh: false },
  { rk: 4, initials: "KH", name: "Kirk Herbstreit", aff: "ESPN · GAMEDAY", josh: false },
  { rk: 5, initials: "NS", name: "Nick Saban", aff: "ESPN · GAMEDAY", josh: false },
  { rk: 6, initials: "BQ", name: "Brady Quinn", aff: "FOX · BIG NOON", josh: false },
  { rk: 7, initials: "DH", name: "Desmond Howard", aff: "ESPN · GAMEDAY", josh: false },
  { rk: 8, initials: "RD", name: "Rece Davis", aff: "ESPN · GAMEDAY", josh: false },
  { rk: 9, initials: "UM", name: "Urban Meyer", aff: "FOX · BIG NOON", josh: false },
  { rk: 10, initials: "TT", name: "Tim Tebow", aff: "ESPN · GAMEDAY", josh: false },
  { rk: 11, initials: "ML", name: "Matt Leinart", aff: "FOX · BIG NOON", josh: false },
  { rk: 12, initials: "PM", name: "Pat McAfee", aff: "ESPN · GAMEDAY", josh: false },
  { rk: 13, initials: "GM", name: "Greg McElroy", aff: "ESPN · SEC NETWORK", josh: false },
  { rk: 14, initials: "DK", name: 'Dan "Big Cat" Katz', aff: "BARSTOOL", josh: false },
  { rk: 15, initials: "DKn", name: "Danny Kanell", aff: "CBS SPORTS", josh: false },
  { rk: 16, initials: "MI", name: "Mark Ingram II", aff: "FOX · BIG NOON", josh: false },
  { rk: 17, initials: "PF", name: "Paul Finebaum", aff: "ESPN · SEC NETWORK", josh: false },
  { rk: 18, initials: "TL", name: "Taylor Lewan", aff: "BUSSIN' WITH THE BOYS", josh: false },
  { rk: 19, initials: "WC", name: "Will Compton", aff: "BUSSIN' WITH THE BOYS", josh: false },
  { rk: 20, initials: "DP", name: "Dave Portnoy", aff: "BARSTOOL", josh: false },
  // Added to bring the leaderboard to an even 24 (12/12 columns) — real
  // on-air CFB analysts, same as everyone above; no invented records.
  // Slots 21–24 replaced per v2 brief §0.5; affiliations verified against
  // each analyst's current employer 2026-08-10 (Rodgers left SEC Saturday
  // Night for ESPN's Friday booth in 2026, so his line reads ESPN, not the
  // brief's SEC Network).
  { rk: 21, initials: "SS", name: "Stanford Steve Coughlin", aff: "ESPN", josh: false },
  { rk: 22, initials: "BE", name: "Bud Elliott", aff: "CBS SPORTS", josh: false },
  { rk: 23, initials: "JR", name: "Jordan Rodgers", aff: "ESPN", josh: false },
  { rk: 24, initials: "AW", name: "Ari Wasserman", aff: "ON3", josh: false },
] as const;

// Team-ish saturated color pairs cycled by rank — gives each monogram
// avatar a distinctive look without tying any real person to a real team's
// actual brand colors (these pairs are generic sports-broadcast palette,
// not any specific school's identity). Josh keeps his own gold/navy
// treatment via .pundit.josh, so he isn't in this cycle.
const AVATAR_COLORS = [
  { bg: "#7A1E2B", fg: "#F4E9D8" },
  { bg: "#0B3B5C", fg: "#F2C744" },
  { bg: "#1E4620", fg: "#E8DCC0" },
  { bg: "#4A2A6B", fg: "#F2B705" },
  { bg: "#8A3B12", fg: "#F5E6C8" },
  { bg: "#0F2E4C", fg: "#C5CBD3" },
  { bg: "#5C1A1A", fg: "#E8B84B" },
  { bg: "#1B4332", fg: "#D8C99B" },
  { bg: "#2B2D82", fg: "#FFFFFF" },
  { bg: "#6B0F1A", fg: "#FFFFFF" },
  { bg: "#243B53", fg: "#E3A857" },
  { bg: "#3D1E6D", fg: "#FFFFFF" },
] as const;

function Pundit({ p }: { p: (typeof DEMO_PUNDITS)[number] }) {
  const colors = AVATAR_COLORS[(p.rk - 1) % AVATAR_COLORS.length];
  return (
    <div className={p.josh ? "pundit josh" : "pundit"}>
      <div className="prk">{p.rk}</div>
      <div
        className="avatar"
        style={p.josh ? undefined : { background: colors.bg, color: colors.fg, borderColor: colors.bg }}
      >
        {p.initials}
      </div>
      <div className="who"><b>{p.name}</b><span className="aff">{p.aff}</span></div>
      <div className="rec">—</div>
    </div>
  );
}

// Video strip + article teaser storylines for the new "Picks Desk" band —
// invented preseason content (PreseasonChip applies), same picks/predictor
// subject matter as the rest of the page.
const DEMO_PICKS_ARTICLES = [
  { headline: "The Model vs. The Gut: Where Josh and the AI Predictor Disagree", dek: "Two different engines, same ten games — the weeks they split are the weeks worth watching.", art: "media" as const },
  { headline: "Upset Radar: Three Lines That Feel Wrong", dek: "The board's biggest mismatches on paper are exactly the games the citizens are piling onto one side of.", art: "rankings-movement" as const },
  { headline: "How the Prize Ladder Actually Pays Out", dek: "Weekly merch, a signed annual, tickets at top 10, a seat next to Josh for the champion — the fine print, explained.", art: "state" as const },
] as const;

export default async function PickemPage() {
  const art = createArtPicker();
  const videos = await getVideos();

  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Porch Pick&apos;Em</p>
          <h1>Porch Pick&apos;Em</h1>
          <p className="lede">Ten games a week against Josh and the whole State. Free forever. The prizes are real.</p>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="duo">
            <div>
              <p className="eyebrow">How It Works</p>
              <h2 className="display" style={{ fontSize: 34 }}>Pick. Streak. Climb.</h2>
              {DEMO_MODE && <PreseasonChip />}
              <p className="lede">
                Every Thursday the board drops — ten games, straight up or against the spread. Points for wins,
                bonuses for streaks and upsets, small-group leagues for your crew, and one big season leaderboard
                for the whole State.
              </p>
              {DEMO_MODE ? (
                <>
                  <div style={{ marginTop: 22 }}>
                    {DEMO_LEADERBOARD.map((row) => (
                      <div className="lb-row" key={row.rank}>
                        <span>{row.rank} {row.name}</span>
                        <span className="streak">{row.pts}{row.streak ? <> · <span style={{ fontSize: 15 }}>🔥</span> {row.streak}</> : ""}</span>
                      </div>
                    ))}
                    <div className="lb-row" style={{ background: "var(--field-lt)", borderRadius: 4, paddingLeft: 10, paddingRight: 10 }}>
                      <span><b>212. You</b></span>
                      <span className="streak"><b>1,214 PTS</b></span>
                    </div>
                  </div>
                  <div style={{ marginTop: 20, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                    <Link className="btn solid" href="/play/pickem-week-1">Make Your Week 1 Picks</Link>
                  </div>
                </>
              ) : (
                <div style={{ marginTop: 22 }}>
                  <EmptyState
                    kicker="WEEK 1 IS OPEN NOW"
                    title="Every citizen starts 0–0 — including Josh"
                    body="The Week 1 slate is live: ten marquee games, confidence points 1–10, picks lock Saturday 11:58 AM ET. Free for every citizen."
                    cta={{ href: "/play/pickem-week-1", label: "Make Your Week 1 Picks →" }}
                  />
                </div>
              )}
            </div>
            <div>
              <p className="eyebrow">The Prize Ladder</p>
              <h2 className="display" style={{ fontSize: 34 }}>Win the Porch</h2>
              <div style={{ marginTop: 10 }}>
                {DEMO_PRIZES.map((p) => (
                  <div className="prize-row" key={p.tier}>
                    <div className="tier">{p.tier}</div>
                    <div className="what"><b>{p.title}</b><p>{p.body}</p></div>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 16, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)" }}>
                FREE TO PLAY · NO PURCHASE NECESSARY · PARTNER/SPONSOR SLOT LIVES HERE
              </p>
              <p style={{ marginTop: 10, fontSize: 14 }}>
                Want a second trophy chase?{" "}
                <Link href="/playoffs" style={{ color: "var(--lamp-deep)", fontWeight: 600 }}>The Citizens&apos; Bracket Challenge →</Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="on-soft">
        <div className="wrap">
          <p className="eyebrow">The Other Leaderboard</p>
          <h2 className="display" style={{ fontSize: 38 }}>Josh vs. The Pros</h2>
          <p className="lede">
            Up top it&apos;s Josh against the citizens. Down here it&apos;s Josh against the pros — 24 of the
            biggest names on your TV, GameDay to FOX to Barstool to CBS. Season records against the spread will be
            tracked all year, starting Week 1, receipts kept.
          </p>
          <p style={{ marginTop: 12, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)" }}>
            Records start accruing Week 1 — every pick sourced and receipts kept.
          </p>
          <div className="pundit-grid" style={{ marginTop: 18 }}>
            <div className="wire">
              {DEMO_PUNDITS.slice(0, 12).map((p) => <Pundit p={p} key={p.rk} />)}
            </div>
            <div className="wire">
              {DEMO_PUNDITS.slice(12, 24).map((p) => <Pundit p={p} key={p.rk} />)}
            </div>
          </div>
          <p style={{ marginTop: 14, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)" }}>
            SEASON ATS · UPDATED EVERY SUNDAY NIGHT · SHARE GRAPHIC AUTO-GENERATES AFTER WEEK 6
          </p>
        </div>
      </section>

      <section>
        <div className="wrap">
          <p className="eyebrow">The Picks Desk</p>
          <h2 className="display" style={{ fontSize: 34 }}>More Board, More Breakdown</h2>
          {DEMO_MODE && <PreseasonChip />}
          {videos.length > 0 && (
            <>
              <p className="lede" style={{ marginTop: 4 }}>Straight from the show — no separate feed to maintain.</p>
              <VideoGrid videos={videos.slice(0, 3)} sizes="(max-width: 760px) 90vw, 360px" />
            </>
          )}
          <div className="tile-grid" style={{ marginTop: 30 }}>
            {(DEMO_MODE ? DEMO_PICKS_ARTICLES : []).map((a) => {
              const img = art.pick(a.art, a.headline);
              return (
                <div className="tile" key={a.headline}>
                  <div className="tile-media">
                    <Image src={img.src} alt={img.alt} fill sizes="(max-width: 860px) 100vw, 380px" style={{ objectFit: "cover" }} />
                  </div>
                  <div className="tile-scrim" />
                  <div className="tile-body">
                    <h4 className="tile-headline" style={{ fontSize: "clamp(16px,1.8vw,20px)" }}>{a.headline}</h4>
                    <span className="tile-meta">{a.dek}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="x-card" style={{ marginTop: 30 }}>
            <div className="x-mark" aria-hidden="true">𝕏</div>
            <div className="x-body">
              <span className="x-handle">@JoshPateCFB on X</span>
              <p className="x-sub">Follow for live pick reactions</p>
            </div>
            <a className="btn" href={SOCIAL_LINKS.x} target="_blank" rel="noopener">Follow on X →</a>
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
