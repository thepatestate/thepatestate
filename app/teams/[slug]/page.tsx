import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  LAUNCH_TEAMS, getTeamInfo, getTeamSchedule, getRecords, getRoster, getPortalMoves,
  getTeamQuotes, getTeamArticles, getTeamWire, getRecruitingClass,
  fmtHeight, CLASS_YEARS, type TeamGame,
} from "@/lib/team-data";
import { getBoards, getThreads, publicClient } from "@/lib/community";
import { getTeamDirectory } from "@/lib/cfbd";
import { getTeamPollRanks } from "@/lib/espn";
import { getTeamJpRank } from "@/lib/jp-poll";
import { createClient, getCitizen } from "@/lib/supabase/server";
import { followTeam, unfollowTeam } from "@/app/teams/actions";
import { getVideos } from "@/lib/youtube";
import { CHANNEL_URL, SOCIAL_LINKS } from "@/lib/youtube";
import { formatDate } from "@/lib/format";
import RelTime from "@/components/RelTime";
import ThreadCard from "@/components/community/ThreadCard";
import TeamMark from "@/components/TeamMark";
import EmptyState from "@/components/EmptyState";

export function generateStaticParams() {
  return LAUNCH_TEAMS.map((slug) => ({ slug }));
}

// §4.6: hubs stay noindex until they clear the completeness standard
// (several relevant editorial items is the gate most hubs miss today).
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const info = await getTeamInfo(slug);
  if (!info || !LAUNCH_TEAMS.includes(slug)) return { title: "Teams" };
  return {
    title: `${info.school} — Team Hub`,
    description: `${info.school} in The Pate State: the real 2026 schedule, roster, portal moves, what Josh has actually said, and the ${info.school} Porch.`,
    alternates: { canonical: `/teams/${slug}` },
    robots: { index: false },
  };
}

function GameRow({ g, logo }: { g: TeamGame; logo?: string | null }) {
  return (
    <div className="tg-row">
      <span className="tg-date">{g.dateLabel}</span>
      <span className="tg-opp">
        <TeamMark name={g.opponent} slug={g.opponentSlug} logo={logo} size={22} />
        <b>{g.home ? "vs" : "at"} {g.opponent}</b>
      </span>
      <span className="tg-meta">
        {g.result ? <b className={g.result.startsWith("W") ? "tg-w" : "tg-l"}>{g.result}</b> : g.timeLabel}
        {g.tv ? ` · ${g.tv}` : ""}
      </span>
    </div>
  );
}

export default async function TeamHubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!LAUNCH_TEAMS.includes(slug)) notFound();
  const info = await getTeamInfo(slug);
  if (!info) notFound();

  const [schedule, records, roster, portal, quotes, articles, wire, recruiting, boards, citizen, videos, dir, pollRanks, jpRank] =
    await Promise.all([
      getTeamSchedule(info.school),
      getRecords(info.school),
      getRoster(info.school),
      getPortalMoves(info.school),
      getTeamQuotes(slug),
      getTeamArticles(slug),
      getTeamWire(slug),
      getRecruitingClass(info.school),
      getBoards(),
      getCitizen(),
      getVideos(),
      getTeamDirectory(),
      getTeamPollRanks(slug),
      getTeamJpRank(slug),
    ]);

  const board = boards.find((b) => b.kind === "team" && b.team_slug === slug);
  const boardThreads = board ? await getThreads(publicClient(), { board: board.slug, limit: 4 }) : [];

  let following = false;
  if (citizen) {
    const db = await createClient();
    const { data } = await db.from("team_follows").select("team_slug").eq("team_slug", slug).maybeSingle();
    following = Boolean(data);
  }

  const now = Date.now();
  const nextGame = schedule.find((g) => !g.completed && new Date(g.kickoff).getTime() > now - 6 * 3600_000) ?? null;
  // Game-thread link (§4.3): today's auto thread for this matchup, if one exists.
  let gameThreadId: string | null = null;
  if (nextGame) {
    const { data } = await publicClient()
      .from("threads")
      .select("id, title")
      .eq("board_slug", "game-day")
      .ilike("title", `%${info.school}%`)
      .order("created_at", { ascending: false })
      .limit(1);
    gameThreadId = (data as { id: string }[] | null)?.[0]?.id ?? null;
  }

  const teamVideo = videos.find((v) => v.title.toLowerCase().includes(info.school.toLowerCase())) ?? null;
  const seasonStarted = schedule.some((g) => g.completed);
  const cur = records.current;
  const last = records.last;
  const accent = info.color ?? "var(--lamp)";

  return (
    <main>
      {/* Team header (§4.2): brand stays dominant, team color accents. */}
      <div className="board-bar team" style={{ borderBottomColor: accent }}>
        <div className="wrap">
          <p className="kicker">The Pate State · Team Hub · {info.conference}</p>
          <h1 style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ background: "#fff", borderRadius: "50%", padding: 6, display: "inline-flex" }}>
              <Image src={info.logo} alt={`${info.school} logo`} width={52} height={52} style={{ objectFit: "contain" }} />
            </span>
            {info.school}
          </h1>
          <p className="sub" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <span>
              <b style={{ color: "#fff" }}>2026:</b> {cur ? `${cur.wins}–${cur.losses}` : "0–0"}
              {!seasonStarted && " · season opens Aug 29"}
            </span>
            {last && (
              <span>
                <b style={{ color: "#fff" }}>2025 final:</b> {last.wins}–{last.losses} ({last.confWins}–{last.confLosses} conf)
              </span>
            )}
            {nextGame && (
              <span>
                <b style={{ color: "#fff" }}>Next:</b> {nextGame.home ? "vs" : "at"} {nextGame.opponent}, {nextGame.dateLabel}
              </span>
            )}
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            {citizen ? (
              <form action={(following ? unfollowTeam : followTeam).bind(null, slug)}>
                <button className="btn gold" type="submit">
                  {following ? "★ Following — Unfollow" : "☆ Follow Team"}
                </button>
              </form>
            ) : (
              <Link className="btn gold" href={`/join?next=/teams/${slug}`}>☆ Follow Team — Free</Link>
            )}
            {board && (
              <Link className="btn" href={`/community/${board.slug}`} style={{ borderColor: "rgba(243,239,230,.5)", color: "var(--chalk)" }}>
                💬 The {info.school} Porch
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="porch-page">
        <div className="wrap">
          <div className="hub-grid">
            <div className="hub-main">

              {/* Next game (§4.3) */}
              {nextGame && (
                <div className="hub-card">
                  <p className="eyebrow">Next Game</p>
                  <div className="ng-row">
                    <TeamMark name={info.school} slug={slug} logo={info.logo} size={44} />
                    <b className="ng-vs">{nextGame.home ? "vs" : "at"}</b>
                    <TeamMark name={nextGame.opponent} slug={nextGame.opponentSlug} logo={dir[nextGame.opponentSlug]?.logo} size={44} />
                    <div className="ng-body">
                      <b>{nextGame.home ? `${nextGame.opponent} at ${info.school}` : `${info.school} at ${nextGame.opponent}`}</b>
                      <span>
                        {nextGame.dateLabel} · {nextGame.timeLabel}
                        {nextGame.tv ? ` · ${nextGame.tv}` : ""} · {nextGame.venue}
                      </span>
                    </div>
                  </div>
                  {gameThreadId ? (
                    <Link className="btn" href={`/community/thread/${gameThreadId}`} style={{ marginTop: 12 }}>
                      Open the Game Thread →
                    </Link>
                  ) : (
                    <p className="hub-src">Game thread opens automatically on gameday · Josh&apos;s pick appears when picks season starts</p>
                  )}
                </div>
              )}

              {/* Josh on this team — real receipts */}
              <div className="hub-card">
                <p className="eyebrow">Josh On {info.school}</p>
                {quotes.length === 0 && !teamVideo ? (
                  <EmptyState
                    kicker="THE ARCHIVE IS LISTENING"
                    title={`Nothing on the record about ${info.school} yet`}
                    body="Every episode gets mined for verbatim quotes — when Josh talks about this team, the receipts land here with timestamps."
                  />
                ) : (
                  <>
                    {quotes.map((q) => (
                      <blockquote className="hub-quote" key={`${q.ytId}-${q.tsSeconds}`}>
                        <p>&ldquo;{q.quote}&rdquo;</p>
                        <footer>
                          — Josh Pate ·{" "}
                          <a href={`https://www.youtube.com/watch?v=${q.ytId}&t=${q.tsSeconds}s`} target="_blank" rel="noopener">
                            watch the moment
                          </a>{" "}
                          · {q.topic.toUpperCase()}
                        </footer>
                      </blockquote>
                    ))}
                    {teamVideo && (
                      <a className="hub-video" href={`https://www.youtube.com/watch?v=${teamVideo.id}`} target="_blank" rel="noopener">
                        <span className="hv-thumb">
                          <Image src={teamVideo.thumbnail} alt="" fill sizes="140px" style={{ objectFit: "cover" }} />
                        </span>
                        <span>
                          <b>{teamVideo.title.replace(/ - Josh Pate's College Football Show/i, "")}</b>
                          <em>▶ WATCH · {formatDate(teamVideo.published).toUpperCase()}</em>
                        </span>
                      </a>
                    )}
                    <p className="hub-src">Quotes machine-verified verbatim against episode transcripts</p>
                  </>
                )}
              </div>

              {/* Latest news (§4.3): articles + wire, auto by team */}
              <div className="hub-card">
                <p className="eyebrow">Latest {info.school} Coverage</p>
                {articles.length === 0 && wire.length === 0 ? (
                  <EmptyState
                    kicker="COVERAGE BUILDS DAILY"
                    title="No stories tagged for this team yet"
                    body="Companion stories and wire items auto-file here the moment coverage mentions this program."
                    cta={{ href: "/wire", label: "Read the Wire →" }}
                  />
                ) : (
                  <>
                    {articles.map((a) => (
                      <Link key={a._id} href={`/notebook/${a.slug.current}`} className="hub-news">
                        <b>{a.headline}</b>
                        <span>{a.byline.toUpperCase()}{a.publishedAt ? ` · ${formatDate(a.publishedAt)}` : ""}</span>
                      </Link>
                    ))}
                    {wire.map((w) => (
                      <Link key={w._id} href={w.storySlug ? `/wire/${w.storySlug}` : "/wire"} className="hub-news">
                        <b>{w.headline}</b>
                        <span>THE WIRE · {(w.category ?? "news").toUpperCase()} · <RelTime iso={w.publishedAt} /></span>
                      </Link>
                    ))}
                  </>
                )}
              </div>

              {/* Team porch (§4.3) */}
              <div className="hub-card">
                <div className="sec-head" style={{ marginBottom: 8 }}>
                  <p className="eyebrow" style={{ margin: 0 }}>The {info.school} Porch</p>
                  {board && <Link className="view-all" href={`/community/${board.slug}`}>Start a thread →</Link>}
                </div>
                {board ? (
                  boardThreads.length > 0 ? (
                    <div className="thread-list" style={{ marginTop: 6 }}>
                      {boardThreads.map((t) => <ThreadCard thread={t} key={t.id} />)}
                    </div>
                  ) : (
                    <EmptyState
                      kicker="FIRST CHAIR IS OPEN"
                      title={`Nobody's said a word on the ${info.school} Porch yet`}
                      body="Start the first thread — the porch remembers its founders."
                      cta={{ href: `/community/${board.slug}`, label: "Open the board →" }}
                    />
                  )
                ) : (
                  <EmptyState
                    kicker="COMING SOON"
                    title={`The ${info.school} Porch opens with demand`}
                    body="Team boards open as their fanbases show up — meanwhile the Front Porch is everyone's."
                    cta={{ href: "/community", label: "Join the Front Porch →" }}
                  />
                )}
              </div>

              {/* Schedule (§4.3) — full real slate */}
              <div className="hub-card" id="schedule">
                <p className="eyebrow">2026 Schedule</p>
                {schedule.length === 0 ? (
                  <EmptyState kicker="LIVE FROM THE FEED" title="Schedule loading" body="The full 2026 slate loads from the live data feed." />
                ) : (
                  <div style={{ marginTop: 6 }}>
                    {schedule.map((g) => <GameRow g={g} logo={dir[g.opponentSlug]?.logo} key={g.id} />)}
                  </div>
                )}
                <p className="hub-src">Schedule &amp; results via CollegeFootballData · scores flow in live on gamedays</p>
              </div>

              {/* Roster snapshot (§4.3) — real, grouped, zero invented depth */}
              <div className="hub-card" id="roster">
                <p className="eyebrow">2026 Roster — {roster.total} Players</p>
                {roster.total === 0 ? (
                  <EmptyState kicker="LIVE FROM THE FEED" title="Roster loading" body="The full roster loads from the live data feed." />
                ) : (
                  <>
                    {([["Offense", roster.offense], ["Defense", roster.defense], ["Specialists & More", roster.special]] as const).map(([label, group]) =>
                      group.length === 0 ? null : (
                        <details key={label} className="hub-roster">
                          <summary>{label} ({group.length})</summary>
                          <table>
                            <thead><tr><th>PLAYER</th><th>POS</th><th>HT/WT</th><th>CLASS</th><th>HOMETOWN</th></tr></thead>
                            <tbody>
                              {group.map((p) => (
                                <tr key={`${p.name}-${p.position}-${p.hometown}`}>
                                  <td><b>{p.name}</b></td>
                                  <td>{p.position}</td>
                                  <td>{fmtHeight(p.heightIn)} / {p.weight ?? "—"}</td>
                                  <td>{p.year ? CLASS_YEARS[p.year] ?? p.year : "—"}</td>
                                  <td>{p.hometown || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </details>
                      ),
                    )}
                    <p className="hub-src">Roster via CollegeFootballData · updated daily · depth charts arrive when programs publish them</p>
                  </>
                )}
              </div>

              {/* Transfer portal (§4.3) — real moves */}
              <div className="hub-card" id="portal">
                <p className="eyebrow">Transfer Portal — 2026 Cycle</p>
                {portal.incoming.length === 0 && portal.outgoing.length === 0 ? (
                  <EmptyState kicker="QUIET FOR NOW" title="No tracked portal moves this cycle" body="Additions and departures appear here as they're logged in the national feed." />
                ) : (
                  <div className="hub-portal">
                    <div>
                      <b className="hp-head">Additions ({portal.incoming.length})</b>
                      {portal.incoming.map((p) => (
                        <div className="hp-row" key={`in-${p.name}`}>
                          <b>{p.name}</b> · {p.position}{p.stars ? ` · ${"★".repeat(p.stars)}` : ""} <span>from {p.from}</span>
                        </div>
                      ))}
                      {portal.incoming.length === 0 && <p className="hub-src">None tracked</p>}
                    </div>
                    <div>
                      <b className="hp-head">Departures ({portal.outgoing.length})</b>
                      {portal.outgoing.map((p) => (
                        <div className="hp-row" key={`out-${p.name}`}>
                          <b>{p.name}</b> · {p.position}{p.stars ? ` · ${"★".repeat(p.stars)}` : ""} <span>{p.to ? `to ${p.to}` : "uncommitted"}</span>
                        </div>
                      ))}
                      {portal.outgoing.length === 0 && <p className="hub-src">None tracked</p>}
                    </div>
                  </div>
                )}
                <p className="hub-src">Portal entries via CollegeFootballData · updated through the cycle</p>
              </div>

              {/* Recruiting (§4.3) — last real cycle, labeled */}
              <div className="hub-card" id="recruiting">
                <p className="eyebrow">Recruiting</p>
                {recruiting ? (
                  <p style={{ fontSize: 15.5 }}>
                    <b>{recruiting.year} class:</b> No. {recruiting.rank} nationally ({recruiting.points.toFixed(1)} pts).{" "}
                    <span style={{ color: "var(--ink-dim)" }}>The 2027 board populates when services publish it.</span>
                  </p>
                ) : (
                  <EmptyState kicker="AWAITING THE SERVICES" title="2027 class data isn't published yet" body="Class ranks land here the moment the composite boards go live." />
                )}
                <p className="hub-src">Class ranks via 247Sports Composite (through CollegeFootballData)</p>
              </div>

              {/* Rankings (§4.4) — real national placements only; the JP
                  Poll line stays a promise (ballots open Aug 24), never an
                  invented number. pollRanks === null means no national poll
                  is published at all; [] means published-but-unranked. */}
              <div className="hub-card" id="rankings">
                <p className="eyebrow">In the Rankings</p>
                {pollRanks === null ? (
                  <EmptyState
                    kicker="FIRST BOARD — WEEK 1"
                    title="Poll placement starts with the first JP Poll"
                    body="Where the citizens rank this team — tracked weekly against the AP and CFP once ballots open Aug 24."
                    cta={{ href: "/poll", label: "How the JP Poll works →" }}
                  />
                ) : (
                  <>
                    {jpRank && (
                      <p style={{ fontSize: 15.5, margin: "0 0 6px" }}>
                        <b style={{ color: accent }}>No. {jpRank.rank}</b> — The JP Poll ({jpRank.label},{" "}
                        {jpRank.ballots} {jpRank.ballots === 1 ? "ballot" : "ballots"})
                      </p>
                    )}
                    {pollRanks.length > 0 ? (
                      pollRanks.map((p) => (
                        <p key={p.poll} style={{ fontSize: 15.5, margin: "0 0 6px" }}>
                          <b style={{ color: accent }}>No. {p.rank}</b> — {p.poll}
                          {p.week ? ` (${p.week})` : ""}
                        </p>
                      ))
                    ) : (
                      <p style={{ fontSize: 15.5, margin: 0 }}>
                        Outside the national top 25 on every published board — for now.
                      </p>
                    )}
                    <p style={{ fontSize: 14, color: "var(--ink-dim)", marginTop: 10 }}>
                      {jpRank
                        ? "The JP Poll re-tabulates weekly — every citizen's ballot counts the same."
                        : "The citizens' own board — the JP Poll — opens for ballots Aug 24."}{" "}
                      <Link href="/poll" style={{ color: "var(--lamp-deep)" }}>
                        {jpRank ? "See the full board →" : "See every national board →"}
                      </Link>
                    </p>
                  </>
                )}
                <p className="hub-src">National polls via the live wire</p>
              </div>
            </div>

            {/* Sidebar */}
            <aside className="hub-side">
              {/* Quick Links (§4.5) */}
              <div className="hub-card quick-links" style={{ borderTopColor: accent }}>
                <p className="eyebrow">Quick Links</p>
                <a href={CHANNEL_URL} target="_blank" rel="noopener">▶ <b>YouTube</b></a>
                <a href={SOCIAL_LINKS.x} target="_blank" rel="noopener">𝕏 <b>X / Twitter</b></a>
                <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener">◉ <b>Instagram</b></a>
                <a href={SOCIAL_LINKS.tiktok} target="_blank" rel="noopener">♪ <b>TikTok</b></a>
                {board ? (
                  <Link href={`/community/${board.slug}`}>💬 <b>The {info.school} Porch</b></Link>
                ) : (
                  <Link href="/community">💬 <b>The Boards</b></Link>
                )}
                <Link href="/scores">🏈 <b>Scores &amp; Schedule</b></Link>
              </div>

              <div className="hub-card">
                <p className="eyebrow">Gameday &amp; Tailgate</p>
                <p style={{ fontSize: 14, lineHeight: 1.55 }}>
                  The citizens&apos; guide to doing a {info.school} Saturday right — parking, food, traditions —
                  publishes with the tailgate program this season.
                </p>
                <Link className="btn" href="/tailgate" style={{ marginTop: 10, borderColor: "var(--navy)", color: "var(--navy)" }}>
                  Pate Tailgate →
                </Link>
              </div>

              <div className="hub-card">
                <p className="eyebrow">Fantasy</p>
                <p style={{ fontSize: 14, lineHeight: 1.55 }}>
                  Team fantasy leaders and most-drafted players arrive with Saturday Slate Fantasy.
                </p>
                <Link className="btn" href="/play" style={{ marginTop: 10, borderColor: "var(--navy)", color: "var(--navy)" }}>
                  The games hub →
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <div className="board-foot">
        <Link href="/teams">All Teams →</Link>
      </div>
    </main>
  );
}
