import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import BallotBuilder, { type BallotTeamOption } from "@/components/poll/BallotBuilder";
import { getNationalRankings, type NationalPoll } from "@/lib/espn";
import { getTeamDirectory } from "@/lib/cfbd";
import { teamLogoUrl } from "@/lib/teams-meta";
import { formatDate } from "@/lib/format";
import {
  getLatestPublished,
  getCurrentBoard,
  getBoardResults,
  getBallotCount,
  getMyBallot,
  boardOpenForVoting,
  type JpResultRow,
} from "@/lib/jp-poll";
import { createClient as createServerClient, getCitizen } from "@/lib/supabase/server";
import { getPublishedArticles, type SanityArticle } from "@/lib/sanity";
import { getVideos, isEpisode, videoUrl } from "@/lib/youtube";

export const metadata: Metadata = {
  title: "The JP Poll — The People's Top 25",
  description: "The power ranking voted by people who actually watch: ballots Sunday, reveal Tuesday, every disagreement with the AP and CFP marked in gold.",
  alternates: { canonical: "/poll" },
};

function etLabel(iso: string): string {
  const d = new Date(iso);
  const day = d
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" })
    .replace(/,/g, "")
    .toUpperCase();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  return `${day} · ${time} ET`;
}

/** Short pill label for the national poll the JP board is compared against. */
function pollShortName(name: string): string {
  if (/\bAP\b/i.test(name)) return "AP";
  if (/coach/i.test(name)) return "COACHES";
  if (/playoff|\bCFP\b/i.test(name)) return "CFP";
  return name.replace(/\s*(top\s*25|poll)\s*$/i, "").toUpperCase() || "NATL";
}

/** One row of a national-poll column (also reused for the full JP board). */
function NatRow({ rank, logo, school, firstPlace, pts }: {
  rank: number;
  logo: string | null;
  school: string;
  firstPlace: number | null;
  pts: string | number | null;
}) {
  return (
    <div className="nrow">
      <span className="rk">{rank}</span>
      {logo && <Image src={logo} alt="" width={21} height={21} />}
      <span className="tn">{school}</span>
      {firstPlace ? <span className="fp">{firstPlace} × 1st</span> : null}
      <span className="pts">{pts ?? "—"}</span>
    </div>
  );
}

export default async function PollPage() {
  // Every fetch guarded — a dead feed degrades a section, never the page.
  const [videos, nationalPolls, latestBoard, currentBoard, dir, citizen, articles] = await Promise.all([
    getVideos().catch(() => []),
    getNationalRankings().catch<NationalPoll[]>(() => []),
    getLatestPublished().catch(() => null),
    getCurrentBoard().catch(() => null),
    getTeamDirectory().catch((): Awaited<ReturnType<typeof getTeamDirectory>> => ({})),
    getCitizen().catch(() => null),
    getPublishedArticles(24).catch<SanityArticle[]>(() => []),
  ]);

  // Live JP board results + ballot state. getBallotCount only runs when a
  // board actually exists — the count is never invented.
  const [results, ballotCount, myBallot] = await Promise.all([
    latestBoard ? getBoardResults(latestBoard.id).catch<JpResultRow[]>(() => []) : [],
    currentBoard ? getBallotCount(currentBoard.id).catch(() => 0) : 0,
    citizen && currentBoard
      ? getMyBallot(await createServerClient(), currentBoard.id, citizen.id).catch(() => null)
      : null,
  ]);

  const now = Date.now();
  const voting = currentBoard ? boardOpenForVoting(currentBoard) : false;
  const preOpen = currentBoard ? now < new Date(currentBoard.opens_at).getTime() : false;
  const tabulating = currentBoard
    ? now >= new Date(currentBoard.locks_at).getTime() && currentBoard.status !== "published"
    : false;

  // Ballot component inputs (existing BallotBuilder, re-mounted as-is).
  const teams: BallotTeamOption[] = Object.values(dir)
    .map((t) => ({ slug: t.slug, school: t.school, conference: t.conference, logo: t.logo }))
    .sort((a, b) => a.school.localeCompare(b.school));
  const quickPicks = (nationalPolls[0]?.ranks ?? []).map((r) => r.slug);

  // Comparison poll for the hero board's gold pills (AP if published, else
  // the first live national poll). No poll out → no pills.
  const cmpPoll = nationalPolls.find((p) => /\bAP\b/i.test(p.name)) ?? nationalPolls[0] ?? null;
  const cmpLabel = cmpPoll ? pollShortName(cmpPoll.name) : null;
  const cmpMap = new Map<string, number>(cmpPoll ? cmpPoll.ranks.map((r) => [r.slug, r.rank]) : []);

  const heroRows = results.slice(0, 10);
  const totalBallots = results[0]?.ballots ?? 0;
  const teamName = (slug: string) => dir[slug]?.school ?? slug.replace(/-/g, " ");
  const teamLogo = (slug: string) => dir[slug]?.logo ?? teamLogoUrl(slug);

  // Poll Day duo: the live poll-day column + the latest episode.
  const pollDayArticle =
    articles.find((a) => a.episode?.series === "poll-day") ?? null;
  const latestEpisode = videos.find(isEpisode) ?? videos[0] ?? null;

  return (
    <main className="v5 pg-poll">
      {/* ── PAGE HEAD ── */}
      <div className="phead">
        <div className="wrap">
          <div className="crumb">The Pate State / <b>The JP Poll</b></div>
          <h1>The JP Poll</h1>
          <p className="sub">
            The power ranking of the Pate State — the Top 25 voted by the people who actually watch, with
            every disagreement against the AP, Coaches, and CFP marked in gold.
          </p>
          {currentBoard && (
            <div className="status">
              {voting && (
                <span className="st open">{currentBoard.label} Ballots Open · Lock {etLabel(currentBoard.locks_at)}</span>
              )}
              {preOpen && (
                <span className="st rev">{currentBoard.label} Ballots Open {etLabel(currentBoard.opens_at)}</span>
              )}
              {tabulating && <span className="st rev">Ballots Locked · Board Tabulating</span>}
              <span className="st rev">Reveal · {etLabel(currentBoard.reveals_at)} on the Show</span>
            </div>
          )}
        </div>
      </div>

      {/* ── HERO: THE JP BOARD (live citizen votes, real math) ── */}
      <section className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div className="board">
              {latestBoard && heroRows.length > 0 ? (
                <>
                  <div className="bh">
                    <div>
                      <span className="k">🗳 The People&apos;s Top 25</span>
                      <h2>JP Poll · {latestBoard.label}</h2>
                    </div>
                    <span className="n">
                      Revealed {formatDate(latestBoard.reveals_at)}
                      <br />
                      From {totalBallots} {totalBallots === 1 ? "ballot" : "ballots"} · full data public
                    </span>
                  </div>
                  {heroRows.map((r) => {
                    const logo = teamLogo(r.team_slug);
                    const natRank = cmpMap.get(r.team_slug);
                    return (
                      <div className={r.rank <= 5 ? "brow top5" : "brow"} key={r.rank}>
                        <span className="rk">{r.rank}</span>
                        {logo && <Image src={logo} alt="" width={26} height={26} />}
                        <span className="tn">{teamName(r.team_slug)}</span>
                        {r.rank === 1 && r.first_place > 0 && r.ballots > 0 && (
                          <span className="fp">▲ {Math.round((r.first_place / r.ballots) * 100)}% of 1st-place votes</span>
                        )}
                        <span className="pts">{r.points}</span>
                        {cmpLabel && (
                          <span className={natRank === r.rank ? "ap same" : "ap diff"}>
                            {cmpLabel} {natRank == null ? "NR" : `#${natRank}`}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  <div className="bf">
                    {results.length > heroRows.length ? (
                      <a href="#full-board">Full Top 25 + Every Ballot ↓</a>
                    ) : (
                      <a href="#ballot">Cast Your Ballot ↓</a>
                    )}
                    {cmpLabel && (
                      <span className="leg"><b>Gold</b> = the State disagrees with the {cmpLabel}</span>
                    )}
                  </div>
                </>
              ) : (
                <EmptyState
                  kicker="🗳 THE PEOPLE'S TOP 25"
                  title="The First Board Tabulates With the Season"
                  body="Every citizen ranks a top 10. Ballots lock Sunday 8 PM ET, the board tabulates overnight, and the People's Top 25 publishes with the Tuesday reveal — full ballot data public."
                  cta={{ href: "#ballot", label: "Cast Your Ballot" }}
                />
              )}
            </div>

            <div className="how">
              <span className="k">How the Board Gets Made</span>
              <h3>One Board. Voted by People Who Watch.</h3>
              {voting && currentBoard ? (
                <div className="step"><b>Open Now</b><span>{currentBoard.label} ballots are live — every citizen ranks a top 10</span></div>
              ) : (
                <div className="step"><b>Ballots</b><span>Every citizen ranks a top 10 when the week&apos;s ballots open</span></div>
              )}
              <div className="step"><b>Sun 8 PM</b><span>Ballots lock, the board tabulates overnight</span></div>
              <div className="step"><b>Tuesday</b><span>The reveal airs live on the show, argued out</span></div>
              <div className="step"><b>In Gold</b><span>Every disagreement vs. the AP, Coaches, and CFP — marked</span></div>
              <a className="go" href="#ballot">Cast Your Ballot →</a>
              <div className="note">Free with citizenship · every ballot goes public with the board</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BALLOT (anchor contract: the homepage links to /poll#ballot) ── */}
      <section className="ballot" id="ballot">
        <div className="wrap">
          <div className="bal-grid">
            <div className="bal">
              <span className="k">
                {voting && currentBoard
                  ? `🗳 ${currentBoard.label} · Ballots Open`
                  : preOpen && currentBoard
                    ? `🗳 Ballots Open ${etLabel(currentBoard.opens_at)}`
                    : tabulating
                      ? "🗳 Ballots Locked — Tabulating"
                      : "🗳 The Weekly Ballot"}
              </span>
              <h3>
                {preOpen ? "Your Ballot Awaits" : voting ? "Cast This Week's Ballot" : "This Week's Ballot"}
              </h3>
              {voting ? (
                <p>
                  Rank your top 10 — {ballotCount} {ballotCount === 1 ? "ballot is" : "ballots are"} in so far.
                  Edit any time before the Sunday lock. <b>Every ballot goes public with the Tuesday board</b> —
                  no anonymous votes, full distribution shown. That&apos;s the whole point.
                </p>
              ) : preOpen ? (
                <p>
                  Rank your top 10 the moment ballots open. Every citizen votes, every ballot counts the same,
                  and <b>the full distribution goes public with the board</b>.
                </p>
              ) : tabulating ? (
                <p>
                  Ballots are locked and the board is tabulating. The reveal airs Tuesday on the show — then
                  <b> every ballot and the full point distribution go public</b>.
                </p>
              ) : (
                <p>
                  Every citizen ranks a top 10 each week. Ballots lock Sunday 8 PM ET, the reveal airs Tuesday,
                  and <b>every ballot goes public with the board</b> — no anonymous votes.
                </p>
              )}
            </div>
            <div className="balcard">
              {currentBoard ? (
                <>
                  <div className="bt">
                    <h4>Your {currentBoard.label} Ballot</h4>
                    <span className="pr">{voting ? "Lock " + etLabel(currentBoard.locks_at) : preOpen ? "Opens " + etLabel(currentBoard.opens_at) : "Locked"}</span>
                  </div>
                  <BallotBuilder
                    teams={teams}
                    quickPicks={quickPicks}
                    initial={myBallot ?? []}
                    editable={voting}
                    signedIn={Boolean(citizen)}
                  />
                </>
              ) : (
                <EmptyState
                  kicker="THE WEEKLY BALLOT"
                  title="Ballots Open With the Season"
                  body="The first board's ballots open here — rank your top 10, free with citizenship."
                  cta={{ href: "/join?next=/poll", label: "Join Free" }}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FULL JP BOARD (only when the live board runs past the hero's 10) ── */}
      {results.length > heroRows.length && latestBoard && (
        <section className="full" id="full-board">
          <div className="wrap">
            <div className="sect-head">
              <span className="eb">Every Ballot Counted</span>
              <h3>The Full Board · {latestBoard.label}</h3>
              <span className="live">Points: 10 for a 1st-place vote down to 1 for 10th</span>
            </div>
            <div className="nat-grid">
              {[results.slice(0, Math.ceil(results.length / 2)), results.slice(Math.ceil(results.length / 2))].map(
                (col, i) => (
                  <div className="ncol" key={i}>
                    {col.map((r) => (
                      <NatRow
                        key={r.rank}
                        rank={r.rank}
                        logo={teamLogo(r.team_slug)}
                        school={teamName(r.team_slug)}
                        firstPlace={r.first_place || null}
                        pts={r.points}
                      />
                    ))}
                  </div>
                ),
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── NATIONAL BOARDS — live from the wire; only polls that exist ── */}
      {nationalPolls.length > 0 && (
        <section className="nat">
          <div className="wrap">
            <div className="sect-head">
              <span className="eb">The Consensus to Argue With</span>
              <h3>The National Boards</h3>
              <span className="live">Live from the national wire</span>
            </div>
            {nationalPolls.map((poll) => (
              <div key={poll.name}>
                <div className="tabs">
                  <span className="tab on">
                    {poll.name}
                    {poll.week ? ` · ${poll.week}` : ""}
                  </span>
                </div>
                <div className="nat-grid">
                  {[
                    poll.ranks.slice(0, Math.ceil(poll.ranks.length / 2)),
                    poll.ranks.slice(Math.ceil(poll.ranks.length / 2)),
                  ].map((col, i) => (
                    <div className="ncol" key={i}>
                      {col.map((r) => (
                        <NatRow
                          key={r.rank}
                          rank={r.rank}
                          logo={r.logo}
                          school={r.school}
                          firstPlace={r.firstPlace}
                          pts={r.points}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p className="src">Source: National wire · Boards appear here the day they drop</p>
          </div>
        </section>
      )}

      {/* ── POLL DAY: THE COLUMN + THE EPISODE ── */}
      <section className="pd">
          <div className="wrap">
            <div className="sect-head">
              <span className="eb">Every Tuesday</span>
              <h3>Poll Day, Argued Out</h3>
            </div>
            <div className="pd-grid">
              {pollDayArticle ? (
                <Link className="pdc" href={`/notebook/${pollDayArticle.slug.current}`}>
                  {pollDayArticle.heroUrl ? (
                    <span className="th">
                      <Image src={pollDayArticle.heroUrl} alt="" fill sizes="(max-width:1080px) 100vw, 50vw" />
                    </span>
                  ) : (
                    <span className="art" />
                  )}
                  <span className="tx">
                    <span className="t">📝 The Column · Poll Day</span>
                    <h4>{pollDayArticle.headline}</h4>
                    <span className="by">
                      {pollDayArticle.byline}
                      {pollDayArticle.publishedAt ? ` · ${formatDate(pollDayArticle.publishedAt)}` : ""}
                    </span>
                  </span>
                </Link>
              ) : (
                <Link className="pdc" href="/notebook">
                  <span className="art" />
                  <span className="tx">
                    <span className="t">📝 The Column · Tuesdays</span>
                    <h4>Poll Day, Explained — Every Move on the Board, in Writing</h4>
                    <span className="by">The written breakdown lands in the Notebook after the reveal</span>
                  </span>
                </Link>
              )}
              {latestEpisode && (
                <a className="pdc" href={videoUrl(latestEpisode.id)} target="_blank" rel="noopener noreferrer">
                  <span className="th">
                    <Image src={latestEpisode.thumbnail} alt="" fill sizes="(max-width:1080px) 100vw, 50vw" />
                    <span className="play"><i>▶</i></span>
                  </span>
                  <span className="tx">
                    <span className="t">▶ The Show · Latest Episode</span>
                    <h4>{latestEpisode.title}</h4>
                    <span className="by">{formatDate(latestEpisode.published)} · Watch on YouTube</span>
                  </span>
                </a>
              )}
            </div>
          </div>
      </section>

      {/* ── CITIZENS LINE ── */}
      <section className="cit">
        <div className="wrap">
          <div className="row">
            <div>
              <div className="k">More for Citizens</div>
              <p>
                Citizens vote the board — <b>rank your top 10 every week</b>, and your public ballot counts
                the same as everyone else&apos;s in the full published distribution.
              </p>
            </div>
            <Link className="go" href="/join?next=/poll">Join the State →</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
