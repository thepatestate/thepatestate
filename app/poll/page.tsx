import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PreseasonChip from "@/components/PreseasonChip";
import EpisodeLead from "@/components/EpisodeLead";
import EmptyState from "@/components/EmptyState";
import { DEMO_MODE } from "@/lib/demo";
import { slugifyTeam, teamLogoUrl } from "@/lib/teams-meta";
import { getNationalRankings } from "@/lib/espn";
import { getVideos } from "@/lib/youtube";

export const metadata: Metadata = {
  title: "The JP Poll — The People's Top 25",
  description: "The power ranking voted by people who actually watch: ballots Sunday, reveal Tuesday, every disagreement with the AP and CFP marked in gold.",
  alternates: { canonical: "/poll" },
};

// --- Preseason-preview sample data ---------------------------------------
// Stands in for the ballot-tabulation engine (Top 5 rankcards, the JP-vs-
// consensus comparison tables). Swap for live queries when the engine
// ships; the JSX below only touches these arrays.

const DEMO_TOP5 = [
  { rank: "01", code: "UGA", team: "Georgia", rec: "PRESEASON · SEC", off: 95, def: 97, sos: 8, rating: "96.4", delta: "up", deltaVal: "1" },
  { rank: "02", code: "OSU", team: "Ohio State", rec: "PRESEASON · B1G", off: 98, def: 94, sos: 12, rating: "95.8", delta: "dn", deltaVal: "1" },
  { rank: "03", code: "TEX", team: "Texas", rec: "PRESEASON · SEC", off: 96, def: 92, sos: 5, rating: "94.1", delta: null, deltaVal: null },
  { rank: "04", code: "ORE", team: "Oregon", rec: "PRESEASON · B1G", off: 94, def: 90, sos: 14, rating: "92.7", delta: "up", deltaVal: "2" },
  { rank: "05", code: "PSU", team: "Penn State", rec: "PRESEASON · B1G", off: 91, def: 93, sos: 18, rating: "91.9", delta: null, deltaVal: null },
] as const;

type Delta = { sym: string; cls: "up" | "dn" | null };
const UP = (n: number): Delta => ({ sym: `▲${n}`, cls: "up" });
const DN = (n: number): Delta => ({ sym: `▼${n}`, cls: "dn" });
const SAME: Delta = { sym: "↔", cls: null };

// Full JP Top 25, all 25 rows (was previously truncated at 12 with a dead
// "See 13-25" link) — every team here is already mapped in
// lib/teams-meta's TEAM_LOGOS, so the full board can show a real logo
// instead of a letter tile.
const DEMO_DISAGREE = [
  { rk: "01", team: "Georgia", ap: SAME, coaches: SAME, cfp: SAME, star: false },
  { rk: "02", team: "Ohio State", ap: SAME, coaches: DN(1), cfp: SAME, star: false },
  { rk: "03", team: "Texas", ap: UP(2), coaches: UP(1), cfp: UP(2), star: true },
  { rk: "04", team: "Oregon", ap: DN(1), coaches: SAME, cfp: DN(1), star: false },
  { rk: "05", team: "Penn State", ap: UP(1), coaches: UP(2), cfp: UP(3), star: true },
  { rk: "06", team: "LSU", ap: UP(3), coaches: UP(2), cfp: UP(4), star: true },
  { rk: "07", team: "Clemson", ap: DN(2), coaches: DN(1), cfp: DN(2), star: false },
  { rk: "08", team: "Notre Dame", ap: SAME, coaches: SAME, cfp: UP(1), star: false },
  { rk: "09", team: "Alabama", ap: DN(3), coaches: DN(4), cfp: DN(2), star: true },
  { rk: "10", team: "Miami", ap: UP(2), coaches: UP(1), cfp: SAME, star: false },
  { rk: "11", team: "Indiana", ap: UP(4), coaches: UP(5), cfp: UP(3), star: true },
  { rk: "12", team: "Michigan", ap: DN(1), coaches: SAME, cfp: DN(1), star: false },
  { rk: "13", team: "Nebraska", ap: DN(2), coaches: SAME, cfp: DN(1), star: false },
  { rk: "14", team: "Ole Miss", ap: UP(3), coaches: UP(2), cfp: UP(4), star: true },
  { rk: "15", team: "Wisconsin", ap: SAME, coaches: DN(1), cfp: SAME, star: false },
  { rk: "16", team: "USC", ap: UP(1), coaches: SAME, cfp: UP(2), star: false },
  { rk: "17", team: "Oklahoma", ap: DN(4), coaches: DN(3), cfp: DN(2), star: true },
  { rk: "18", team: "Tennessee", ap: UP(2), coaches: UP(1), cfp: SAME, star: false },
  { rk: "19", team: "Florida", ap: SAME, coaches: SAME, cfp: UP(1), star: false },
  { rk: "20", team: "Missouri", ap: UP(5), coaches: UP(4), cfp: UP(6), star: true },
  { rk: "21", team: "Iowa", ap: DN(1), coaches: SAME, cfp: DN(2), star: false },
  { rk: "22", team: "Washington", ap: SAME, coaches: UP(1), cfp: SAME, star: false },
  { rk: "23", team: "Utah", ap: UP(2), coaches: UP(3), cfp: UP(1), star: false },
  { rk: "24", team: "Colorado", ap: DN(3), coaches: DN(2), cfp: DN(4), star: false },
  { rk: "25", team: "BYU", ap: UP(1), coaches: SAME, cfp: UP(2), star: false },
] as const;

// Poll Movement rail widget — the JP Poll's own week-over-week risers and
// fallers (not a comparison against another poll, unlike the table above).
const DEMO_POLL_MOVEMENT = [
  { team: "LSU", dir: "up" as const, delta: 3 },
  { team: "Missouri", dir: "up" as const, delta: 5 },
  { team: "Indiana", dir: "up" as const, delta: 4 },
  { team: "Alabama", dir: "dn" as const, delta: 3 },
  { team: "Oklahoma", dir: "dn" as const, delta: 4 },
  { team: "Colorado", dir: "dn" as const, delta: 3 },
] as const;

const DEMO_FOUR_BOARDS = [
  { rk: "01", jp: "Georgia", jpGold: false, cfp: "Georgia", coaches: "Georgia", ap: "Georgia" },
  { rk: "02", jp: "Ohio State", jpGold: false, cfp: "Ohio State", coaches: "Ohio State", ap: "Ohio State" },
  { rk: "03", jp: "Texas", jpGold: true, cfp: "Oregon", coaches: "Oregon", ap: "Oregon" },
  { rk: "04", jp: "Oregon", jpGold: true, cfp: "Texas", coaches: "Texas", ap: "Texas" },
  { rk: "05", jp: "Penn State", jpGold: false, cfp: "Penn State", coaches: "Penn State", ap: "Penn State" },
  { rk: "06", jp: "LSU", jpGold: true, cfp: "Clemson", coaches: "Clemson", ap: "Notre Dame" },
  { rk: "07", jp: "Clemson", jpGold: true, cfp: "Notre Dame", coaches: "LSU", ap: "Clemson" },
  { rk: "08", jp: "Notre Dame", jpGold: false, cfp: "LSU", coaches: "Notre Dame", ap: "LSU" },
  { rk: "09", jp: "Alabama", jpGold: true, cfp: "Miami", coaches: "Alabama", ap: "Miami" },
  { rk: "10", jp: "Miami", jpGold: true, cfp: "Alabama", coaches: "Indiana", ap: "Alabama" },
] as const;

const DEMO_BALLOT_ITEMS = [
  "Your No. 1 team",
  "Most overrated in the AP",
  "Best win of the week",
  "Best atmosphere you attended",
] as const;

// Small inline team mark for table rows — letter tiles die per the client's
// note; every team on this page already has a logo mapped in
// lib/teams-meta, so this never needs a fallback.
function TeamMark({ team }: { team: string }) {
  const logoUrl = teamLogoUrl(slugifyTeam(team));
  if (!logoUrl) return null;
  return <Image src={logoUrl} alt="" width={22} height={22} style={{ objectFit: "contain", verticalAlign: "middle" }} />;
}

export default async function PollPage() {
  const [videos, nationalPolls] = await Promise.all([getVideos(), getNationalRankings()]);
  const latestVideo = videos[0] ?? null;
  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / The JP Poll</p>
          <h1>The JP Poll</h1>
          <p className="lede">
            The power ranking of the Pate State — the top 25 voted by the people who actually watch, with every
            disagreement against the AP, Coaches, and CFP polls marked in gold.
          </p>
        </div>
      </header>

      <section className="on-soft">
        <div className="wrap">
          <span className="fr">🗳 THE JP POLL</span>
          <p className="eyebrow">This Week&apos;s Board</p>
          <h2 className="display" style={{ fontSize: 38 }}>The Top 25</h2>
          {DEMO_MODE && <PreseasonChip />}
          {!DEMO_MODE && (
            <div style={{ marginTop: 16, maxWidth: 720 }}>
              <EmptyState
                kicker="FIRST BALLOTS OPEN AUG 24"
                title="The first board of 2026 lands opening week"
                body="Every citizen ranks a top 10; ballots lock Sunday 8PM ET and the reveal airs Tuesday on the show. No editorial panel, no anonymous ballots — and the full vote distribution goes public with the board."
                cta={{ href: "/join", label: "Become a Citizen — Free" }}
              />
            </div>
          )}
          {DEMO_MODE && (
          <div className="duo wide" style={{ marginTop: 16, alignItems: "start" }}>
            <div>
              <p className="eyebrow" style={{ marginBottom: 6 }}>The Top Five</p>
              {DEMO_TOP5.map((t) => {
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
                    <span className="rk-rec">{t.rec}</span>
                    <div className="pills">
                      <span className="pill">OFF {t.off}</span>
                      <span className="pill">DEF {t.def}</span>
                      <span className="pill">SOS {t.sos}</span>
                    </div>
                  </div>
                  <div className="rk-score">
                    <span className="val">{t.rating}</span>
                    {t.delta && (
                      <span className={`dl ${t.delta}`}>{t.delta === "up" ? "▲" : "▼"} {t.deltaVal}</span>
                    )}
                    <span className="lbl">JP RATING</span>
                  </div>
                </div>
                );
              })}
              <div style={{ marginTop: 8 }}><Link className="btn" href="/teams">VIEW ALL 136 →</Link></div>

              <div style={{ marginTop: 34 }}>
                <p className="eyebrow">Week 1 — The Full Board</p>
                <h2 className="display" style={{ fontSize: 30 }}>Where the Porch Disagrees</h2>
                <PreseasonChip />
                <table style={{ marginTop: 14 }}>
                  <thead>
                    <tr><th>JP</th><th>TEAM</th><th>VS. AP</th><th>VS. COACHES</th><th>VS. CFP</th><th></th></tr>
                  </thead>
                  <tbody>
                    {DEMO_DISAGREE.map((r) => (
                      <tr key={r.rk}>
                        <td className="rk">{r.rk}</td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <TeamMark team={r.team} /> <b>{r.team}</b>
                          </span>
                        </td>
                        <td className={r.ap.cls ?? undefined}>{r.ap.sym}</td>
                        <td className={r.coaches.cls ?? undefined}>{r.coaches.sym}</td>
                        <td className={r.cfp.cls ?? undefined}>{r.cfp.sym}</td>
                        <td className={r.star ? "star" : undefined}>{r.star ? "★" : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="legend">
                  <span><b>▲▼</b> spots higher / lower than that poll</span>
                  <span><b>↔</b> same spot</span>
                  <span><b>★</b> biggest disagreement of the week</span>
                </div>
                <div style={{ marginTop: 12, fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-dim)" }}>
                  All 25, full ballot data — the 136-team board and poll archive ship with the season
                </div>
              </div>

              <div style={{ marginTop: 34 }}>
                <p className="eyebrow">Four Boards, Side by Side</p>
                <h2 className="display" style={{ fontSize: 30 }}>JP Poll vs. CFP vs. Coaches vs. AP</h2>
                <PreseasonChip />
                <p className="lede">
                  Same week, four top tens. The gold cells are where the citizens see it differently than everyone
                  else.
                </p>
                <table style={{ marginTop: 14 }}>
                  <thead>
                    <tr><th>RK</th><th>THE JP POLL</th><th>CFP</th><th>COACHES</th><th>AP</th></tr>
                  </thead>
                  <tbody>
                    {DEMO_FOUR_BOARDS.map((r) => (
                      <tr key={r.rk}>
                        <td className="rk">{r.rk}</td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <TeamMark team={r.jp} />{" "}
                            <b style={r.jpGold ? { color: "var(--lamp-deep)" } : undefined}>{r.jp}</b>
                          </span>
                        </td>
                        <td><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><TeamMark team={r.cfp} /> {r.cfp}</span></td>
                        <td><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><TeamMark team={r.coaches} /> {r.coaches}</span></td>
                        <td><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><TeamMark team={r.ap} /> {r.ap}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ marginTop: 12, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)" }}>
                  GOLD = JP POLL DISAGREES WITH THE CONSENSUS AT THAT SPOT · UPDATED EVERY TUESDAY AFTER THE REVEAL
                </p>
              </div>
            </div>

            <aside>
              <div className="rail-card">
                <h4>Poll Movement</h4>
                {DEMO_POLL_MOVEMENT.map((m) => (
                  <div className="rail-row" key={m.team}>
                    <span className="rr-hel">
                      <TeamMark team={m.team} />
                    </span>
                    <span className="rr-name">{m.team}</span>
                    <span className={m.dir}>{m.dir === "up" ? "▲" : "▼"} {m.delta}</span>
                  </div>
                ))}
              </div>
              <div className="rail-card">
                <h4>How the Poll Works</h4>
                <p>
                  Every citizen ranks a top 10 each week. Ballots lock Sunday 8PM ET and the board tabulates
                  Monday night — no editorial panel, no anonymous ballots. The full vote distribution is public;
                  the AP&apos;s isn&apos;t.
                </p>
                <p style={{ marginTop: 10 }}>
                  Reveal airs live every Tuesday, with every disagreement against the AP, Coaches, and CFP polls
                  marked in gold below.
                </p>
              </div>
              <div className="rail-card">
                <h4>Latest From the Show</h4>
                {latestVideo ? (
                  <EpisodeLead video={latestVideo} tag="NEW EPISODE" />
                ) : (
                  <p>Video loads live from the channel — check back once the feed is connected.</p>
                )}
              </div>
            </aside>
          </div>
          )}
        </div>
      </section>

      {/* Real national polls from the live wire (no key, no quota) — the
          boards the JP Poll gets measured against. Renders the moment a
          poll publishes: Coaches in August, AP days later, CFP from
          late October. Never invented; hidden entirely if no poll is out. */}
      {nationalPolls.length > 0 && (
        <section>
          <div className="wrap">
            <p className="eyebrow">The National Boards — {nationalPolls[0].season}</p>
            <h2 className="display" style={{ fontSize: 34 }}>Where the Country Has It</h2>
            <p className="lede">
              The official national polls, live from the wire — the consensus the citizens get to argue with once
              JP Poll ballots open Aug 24.
            </p>
            <div className={nationalPolls.length > 1 ? "duo" : undefined} style={{ marginTop: 18, maxWidth: nationalPolls.length > 1 ? undefined : 720 }}>
              {nationalPolls.map((poll) => (
                <div key={poll.name}>
                  <p className="eyebrow" style={{ marginBottom: 6 }}>
                    {poll.name}
                    {poll.week ? ` · ${poll.week}` : ""}
                  </p>
                  <table>
                    <thead>
                      <tr><th>RK</th><th>TEAM</th><th>REC</th><th style={{ textAlign: "right" }}>PTS</th></tr>
                    </thead>
                    <tbody>
                      {poll.ranks.map((r) => (
                        <tr key={r.rank}>
                          <td className="rk">{String(r.rank).padStart(2, "0")}</td>
                          <td>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              {r.logo && (
                                <Image src={r.logo} alt="" width={22} height={22} style={{ objectFit: "contain" }} />
                              )}
                              <b>{r.school}</b>
                              {r.firstPlace ? (
                                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)" }}>
                                  {r.firstPlace} × 1ST
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{r.record}</td>
                          <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>{r.points ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 12, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)" }}>
              LIVE FROM THE NATIONAL WIRE · NEW BOARDS APPEAR HERE THE DAY THEY DROP
            </p>
          </div>
        </section>
      )}

      <section className="on-soft tight">
        <div className="wrap">
          <div className="duo">
            <div className="art" style={{ height: "100%" }}>
              <span className="kick">THIS WEEK&apos;S COLUMN · TUESDAYS</span>
              <h4 style={{ fontSize: 28 }}>Poll Day, Explained</h4>
              <p style={{ fontSize: 15 }}>
                Why Texas jumped to 3, why the citizens still don&apos;t trust Alabama, and the Indiana argument
                Josh lost to his own audience — the written breakdown of every move on the board.
              </p>
              <span className="meta">JOSH PATE · 7 MIN READ</span>
              <div style={{ marginTop: 14 }}><Link className="btn gold" href="/notebook">Read the Column</Link></div>
            </div>
            <div>
              <p className="eyebrow" style={{ marginBottom: 10 }}>The Reveal · Watch</p>
              <div className="video-slot">
                <span
                  className="tag"
                  style={{ position: "absolute", top: 14, left: 14, fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".12em", background: "var(--lamp)", color: "var(--navy)", padding: "4px 10px", borderRadius: 2 }}
                >
                  POLL DAY SHOW
                </span>
                <button className="playbtn" aria-label="Play the poll reveal" disabled>▶</button>
                <span style={{ position: "absolute", bottom: 14, right: 14, fontFamily: "var(--mono)", fontSize: 12, color: "var(--chalk-dim)" }}>39:12</span>
              </div>
              <p style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)" }}>
                EVERY TUESDAY — THE FULL TOP 25 REVEAL, ARGUED OUT
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="on-dark tight">
        <div className="wrap">
          <div className="panel panel-dark" style={{ maxWidth: 640, margin: "0 auto" }}>
            <p className="eyebrow">Poll voting opens Aug 24 · then every Sunday 8PM ET</p>
            <h3>Cast This Week&apos;s Ballot</h3>
            <p>Rank your top 10. See where the State disagrees with the AP — and with Josh.</p>
            {DEMO_BALLOT_ITEMS.map((label) => (
              <div className="vote-row" key={label}>
                <span>{label}</span>
                <button disabled>Vote</button>
              </div>
            ))}
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
