import Link from "next/link";
import Image from "next/image";
import InlineYouTube from "@/components/InlineYouTube";
import type { Video } from "@/lib/youtube";
import type { SanityWireItem } from "@/lib/sanity";
import { formatDate } from "@/lib/format";
import RelTime from "@/components/RelTime";

// v25 top: today's episode as the hero (65%) + the live wire as a
// utilitarian Latest column (35%). No content repeats below the fold.
export default function HeroWire({ featured, wire }: {
  featured: Video | null;
  wire: SanityWireItem[];
}) {
  if (!featured && wire.length === 0) return null;
  return (
    <section className="top-ed">
      <div className="wrap">
        <div className="top-grid">
          {featured && (
            <div className="hero">
              {/* Plays in place — homepage video clicks stay on the page
                  (Josh, 2026-08-19). */}
              <InlineYouTube ytId={featured.id} title={featured.title} className="thumb">
                <Image src={featured.thumbnail} alt="" fill sizes="(max-width:1080px) 100vw, 780px" style={{ objectFit: "cover" }} priority />
                <span className="tag">Today&apos;s Show</span>
                <div className="playbtn"><span>▶</span></div>
              </InlineYouTube>
              <h1>{featured.title.replace(/ - Josh Pate's College Football Show/i, "")}</h1>
              <span className="by">Josh Pate · {formatDate(featured.published)} · ▶ Watch</span>
            </div>
          )}
          {wire.length > 0 && (
            <div className="lw lwA">
              <div className="col-title">Latest</div>
              <div className="col-sub"><span className="lv">Live</span> What&apos;s happening now · from The Wire</div>
              {/* Homepage shows ONLY clickable items (Josh via Isaac,
                  2026-08-20), and low-impact stories never occupy the top
                  five (Brief v2 scope filter) — they stay on /wire. */}
              {/* 2026-08-30: the desk pipeline rates most stories "low" by
                  depth, which emptied this rail after the catalog reset;
                  triage on the item's importance instead (fluff is ≤ 3). */}
              {wire.filter((w) => w.storySlug && (w.impact !== "low" || (w.importance ?? 0) >= 4)).slice(0, 5).map((w, i) => {
                const inner = (
                  <>
                    <span className={i === 0 ? "tmchip hot" : "tmchip"}><RelTime iso={w.publishedAt} short /></span>
                    <div>
                      <h4>{w.headline}</h4>
                      <span className="c">
                        {w.category ?? "News"}
                        {/* Nothing in this section leaves the site (Josh,
                            2026-08-19 — the Latest rail was "leading people
                            away"). Outbound credit is plain text; the linked
                            citation lives inside the full story only. */}
                        {!w.storySlug && w.sourceOutlet && <> · via {w.sourceOutlet}</>}
                      </span>
                    </div>
                  </>
                );
                return w.storySlug ? (
                  <Link className="lw-item" href={`/wire/${w.storySlug}`} key={w._id}>{inner}</Link>
                ) : (
                  <div className="lw-item" key={w._id}>{inner}</div>
                );
              })}
              <Link className="all" href="/wire">All Wire Coverage →</Link>
            </div>
          )}
        </div>

        <div className="action-strip">
          <Link className="as-item" href="/poll#ballot">
            <span className="ico">🗳</span>
            <div>
              <div className="k live">JP Poll · Open</div>
              <h4>The people&apos;s Top 25 — ballots close Sunday 8 PM ET</h4>
              <span className="go">Cast Your Ballot →</span>
            </div>
          </Link>
          <Link className="as-item" href="/play">
            <span className="ico">✓</span>
            <div>
              <div className="k">Porch Pick&apos;Em</div>
              <h4>Ten games a week against Josh and the whole State</h4>
              <span className="go">Make Your Picks →</span>
            </div>
          </Link>
          <Link className="as-item" href="/community">
            <span className="ico">🪑</span>
            <div>
              <div className="k">The Porch</div>
              <h4>Citizens are talking ball right now</h4>
              <span className="go">Pull Up a Chair →</span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
