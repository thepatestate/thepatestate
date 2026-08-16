import Link from "next/link";

// v5 action strip under the top editorial grid. Copy stays count-free in
// production — no invented citizen numbers (§0.1).
export default function ActionStrip() {
  return (
    <div className="wrap">
      <div className="action-strip">
        <Link className="as-item" href="/poll#ballot"><span className="ico">🗳</span><div><div className="k live">Live · Poll Open</div><h4>Weekly JP Poll ballots are live for every citizen</h4></div></Link>
        <Link className="as-item" href="/play"><span className="ico">✓</span><div><div className="k">Pick&apos;Em</div><h4>Make your picks — free, against Josh and the whole State</h4></div></Link>
        <Link className="as-item" href="/community"><span className="ico">🪑</span><div><div className="k">The Porch</div><h4>Citizens are talking ball right now — pull up a chair</h4></div></Link>
        <div className="as-cta"><Link href="/poll#ballot">Cast Your Ballot →</Link></div>
      </div>
    </div>
  );
}
