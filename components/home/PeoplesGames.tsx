import Link from "next/link";

// v5 "The People's Games": JP Poll + Porch Pick'Em cards. Row copy mirrors
// the shipped production how-rows — schedule and prizes, no invented stats.
export default function PeoplesGames() {
  return (
    <section className="games-band" id="poll">
      <div className="wrap">
        <div className="sect-head">
          <div>
            <div className="eyebrow">Vote · Play · Argue It Out</div>
            <h2>The People&apos;s Games</h2>
          </div>
          <Link className="more" href="/play">Everything in Play →</Link>
        </div>
        <div className="duo">
          <div className="card-poll">
            <div className="gc-k">🗳 The JP Poll · Ballots Open</div>
            <div className="gc-title">The People&apos;s Power Ranking</div>
            <div className="gc-sub">One board, voted by those who actually watch, revealed every Tuesday.</div>
            <div className="gc-row"><b>Open Now</b> Week 1 ballots are live — every citizen ranks a top 10</div>
            <div className="gc-row"><b>Sun 8PM ET</b> Ballots lock, the board tabulates overnight</div>
            <div className="gc-row"><b>Tuesday</b> The reveal airs live on the show, argued out</div>
            <div className="gc-row"><b>In Gold</b> Every disagreement vs. the AP, Coaches, and CFP — marked</div>
            <Link className="gc-btn" href="/poll#ballot">Cast Your Ballot →</Link>
          </div>
          <div className="card-pick">
            <div className="gc-k">✓ Porch Pick&apos;Em · Free to Play</div>
            <div className="gc-title">Ten Games a Week vs. Josh</div>
            <div className="gc-sub">Pick against Josh and the whole State. Build a streak. Earn your patches.</div>
            <div className="gc-row"><b>Weekly</b> Best score wins merch + a shoutout on Monday&apos;s show</div>
            <div className="gc-row"><b>Monthly</b> Top citizen gets a signed Pate Report + Poll Day spotlight</div>
            <div className="gc-row"><b>Top 10</b> Finish the season top 10 — game tickets covered</div>
            <div className="gc-row"><b>Champion</b> Watches a game with Josh · name on the Wall, forever</div>
            <Link className="gc-btn" href="/play">Make Your Picks — Free →</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
