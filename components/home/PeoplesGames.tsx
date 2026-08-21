import Link from "next/link";
import Image from "next/image";
import { getLatestPublished, getBoardResults, getBallotCount, type JpBoard, type JpResultRow } from "@/lib/jp-poll";
import { getCompetitions, getLeaderboard, getEntryCount, type Competition, type PlayEntry } from "@/lib/play";
import { getTeamDirectory } from "@/lib/cfbd";
import { teamLogoUrl } from "@/lib/teams-meta";
import { JOSH_BRACKET_FIELD } from "@/lib/josh-bracket";

// v25 "The People's Games": the JP Poll card shows the LIVE board top 5 when
// one is published; the Pick'Em card shows the real leaderboard once scores
// exist. Both fall back to the honest schedule/prize rows (§0.1 — no
// invented ballots, records, or handles).

async function pollData(): Promise<{ board: JpBoard; rows: JpResultRow[]; ballots: number } | null> {
  const board = await getLatestPublished().catch(() => null);
  if (!board) return null;
  const [rows, ballots] = await Promise.all([
    getBoardResults(board.id).catch(() => [] as JpResultRow[]),
    getBallotCount(board.id).catch(() => 0),
  ]);
  if (rows.length < 5) return null;
  return { board, rows: rows.slice(0, 5), ballots };
}

async function pickData(): Promise<{ comp: Competition; rows: PlayEntry[]; entries: number } | null> {
  const comps = await getCompetitions().catch(() => [] as Competition[]);
  const comp = comps.find((c) => c.type === "pickem") ?? comps[0];
  if (!comp) return null;
  const [rows, entries] = await Promise.all([
    getLeaderboard(comp.slug, { limit: 3 }).catch(() => [] as PlayEntry[]),
    getEntryCount(comp.slug).catch(() => 0),
  ]);
  const scored = rows.filter((r) => typeof r.points === "number");
  return { comp, rows: scored, entries };
}

export default async function PeoplesGames() {
  const [poll, pick, dir] = await Promise.all([
    pollData(),
    pickData(),
    getTeamDirectory().catch(() => ({}) as Awaited<ReturnType<typeof getTeamDirectory>>),
  ]);
  return (
    <section className="games-band" id="games">
      <div className="wrap">
        <div className="sect-head">
          <div>
            <div className="eyebrow">What the State Thinks</div>
            <h2>The People&apos;s Games</h2>
            <div className="sub">One ballot. Ten picks. And Josh on the other side.</div>
          </div>
          <Link className="more" href="/play">Everything in Play →</Link>
        </div>
        <div className="duo">
          <div className="card-poll">
            <div className="gc-k">🗳 The People&apos;s Power Ranking</div>
            <div className="gc-title">{poll ? `The People's Top 25 — ${poll.board.label}` : "Rank Your Top 10. Stack Up Against Josh, the Coaches, and the Press."}</div>
            {poll ? (
              <>
                <div className="gc-sub">
                  {poll.ballots > 0 ? `${poll.ballots.toLocaleString()} ballots in. ` : ""}The board, as the State voted it:
                </div>
                <div className="board">
                  {poll.rows.map((r) => {
                    const logo = dir[r.team_slug]?.logo ?? teamLogoUrl(r.team_slug);
                    const name = dir[r.team_slug]?.school ?? r.team_slug.replace(/-/g, " ");
                    return (
                      <div className="br" key={r.team_slug}>
                        <span className="rk">{r.rank}</span>
                        {logo && <Image src={logo} alt="" width={24} height={24} />}
                        <span className="tn">{name}</span>
                        {r.first_place > 0 && <span className="ap">{r.first_place} FIRST-PLACE</span>}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="gc-sub">One board, voted by those who actually watch, revealed every Tuesday — with every disagreement vs. Josh, the AP, and the Coaches marked in gold.</div>
                {/* Real data, not invented ballots: Josh's on-the-record
                    preseason top seeds as the argument-starter. */}
                <div className="jt5">
                  <span className="jt5-k">Josh&apos;s top 5, on the record:</span>
                  <span className="jt5-row">
                    {JOSH_BRACKET_FIELD.slice(0, 5).map((t) => {
                      const logo = dir[t.slug]?.logo ?? teamLogoUrl(t.slug);
                      return logo ? <Image src={logo} alt={t.name} title={`${t.seed}. ${t.name}`} width={30} height={30} key={t.slug} /> : null;
                    })}
                  </span>
                  <span className="jt5-q">Think he&apos;s wrong? Put it on a ballot.</span>
                </div>
                <div className="gc-row"><b>Open Now</b> Ballots are live — every citizen ranks a top 10</div>
                <div className="gc-row"><b>Tuesday</b> The reveal airs live on the show, argued out</div>
              </>
            )}
            <Link className="gc-btn" href="/poll#ballot">Add Your Ballot to the Board →</Link>
          </div>

          <div className="card-pick">
            <div className="gc-k">✓ Porch Pick&apos;Em{pick ? ` · ${pick.comp.name}` : " · Free to Play"}</div>
            <div className="gc-title">Beat Josh. Climb the Board.</div>
            {pick && pick.rows.length >= 3 ? (
              <>
                <div className="gc-sub">The board right now{pick.entries > 0 ? ` · ${pick.entries.toLocaleString()} citizens in` : ""}:</div>
                <div className="lb">
                  {pick.rows.map((r, i) => (
                    <div className="lb-r" key={r.id}>
                      <span className="med">{["🥇", "🥈", "🥉"][i] ?? "•"}</span>
                      <span className="who">{r.display_name}</span>
                      <span className="rec">{r.points} pts</span>
                    </div>
                  ))}
                  <div className="lb-r you"><span className="med">—</span><span className="who">You</span><span className="rec">Make your picks →</span></div>
                </div>
              </>
            ) : (
              <>
                <div className="gc-sub">
                  Pick against Josh and the whole State. Build a streak. Earn your patches.
                  {pick && pick.entries > 0 ? ` ${pick.entries.toLocaleString()} ${pick.entries === 1 ? "citizen" : "citizens"} already in.` : ""}
                </div>
                {/* The podium is real the moment Week 1 scores — until then
                    the medals show what's at stake, never invented names. */}
                <div className="lb podium-preview">
                  <div className="lb-r"><span className="med">🥇</span><span className="who open">Gold — open until Week 1 scores</span><span className="rec">Merch + Monday shoutout</span></div>
                  <div className="lb-r"><span className="med">🥈</span><span className="who open">Silver — the podium fills fast</span><span className="rec">Signed Pate Report</span></div>
                  <div className="lb-r"><span className="med">🥉</span><span className="who open">Bronze — somebody&apos;s spot</span><span className="rec">Poll Day spotlight</span></div>
                  <div className="lb-r you"><span className="med">—</span><span className="who">You</span><span className="rec">Make your picks →</span></div>
                </div>
                <div className="gc-row"><b>Champion</b> Watches a game with Josh · name on the Wall, forever</div>
              </>
            )}
            <Link className="gc-btn" href="/play">Beat Josh →</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
