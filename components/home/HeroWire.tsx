import Link from "next/link";
import Image from "next/image";
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
            <a className="hero" href={`https://www.youtube.com/watch?v=${featured.id}`} target="_blank" rel="noopener">
              <div className="thumb">
                <Image src={featured.thumbnail} alt="" fill sizes="(max-width:1080px) 100vw, 780px" style={{ objectFit: "cover" }} priority />
                <span className="tag">Today&apos;s Show</span>
                <div className="playbtn"><span>▶</span></div>
              </div>
              <h1>{featured.title.replace(/ - Josh Pate's College Football Show/i, "")}</h1>
              <span className="by">Josh Pate · {formatDate(featured.published)} · ▶ Watch</span>
            </a>
          )}
          {wire.length > 0 && (
            <div className="lw lwA">
              <div className="col-title">Latest</div>
              <div className="col-sub"><span className="lv">Live</span> What&apos;s happening now · from The Wire</div>
              {wire.slice(0, 5).map((w, i) => {
                const inner = (
                  <>
                    <span className={i === 0 ? "tmchip hot" : "tmchip"}><RelTime iso={w.publishedAt} short /></span>
                    <div>
                      <h4>{w.headline}</h4>
                      <span className="c">
                        {w.category ?? "News"}
                        {/* Headlines never leave the site (client directive
                            2026-08-17); outbound credit is a small explicit
                            chip on storyless items only. */}
                        {!w.storySlug && w.sourceUrl && (
                          <> · <a href={w.sourceUrl} target="_blank" rel="noopener" style={{ color: "var(--gold-dk)" }}>via {w.sourceOutlet ?? "source"} ↗</a></>
                        )}
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
