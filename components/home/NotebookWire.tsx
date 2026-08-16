import Link from "next/link";
import Image from "next/image";
import type { SanityArticle, SanityWireItem } from "@/lib/sanity";
import { createArtPicker } from "@/lib/editorial-art";
import { formatDate } from "@/lib/format";
import RelTime from "@/components/RelTime";
import EmptyState from "@/components/EmptyState";
import { DEMO_MODE } from "@/lib/demo";

// v5 Notebook (featured article + two small cards) beside the live Wire rail.
// Same duplication pattern noted throughout: a small per-file lookup rather
// than a shared lib module (see components/ArticleBody.tsx and the sibling
// copies in app/notebook/page.tsx).
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

export default function NotebookWire({ lead, small, wire }: {
  lead: SanityArticle | null;
  small: SanityArticle[];
  wire: SanityWireItem[];
}) {
  const art = createArtPicker();
  const leadImg = lead?.heroUrl ? { src: lead.heroUrl, alt: lead.headline } : art.pick("weekend-truths");
  const showWire = wire.length >= 3 || DEMO_MODE;
  return (
    <section className="notebook">
      <div className="wrap">
        <div className="sect-head">
          <div>
            <div className="eyebrow">From the Porch · New Every Weekday</div>
            <h2>The Notebook</h2>
          </div>
          <Link className="more" href="/notebook">All Stories →</Link>
        </div>

        <div className="nb-grid">
          <div>
            {lead ? (
              <>
                <Link className="nb-feat" href={`/notebook/${lead.slug.current}`}>
                  <div className="hero">
                    <Image src={leadImg.src} alt={leadImg.alt} fill sizes="(max-width:1080px) 100vw, 760px" style={{ objectFit: "cover" }} />
                  </div>
                  <div className="pad">
                    <span className="kick">📝 {seriesLabel(lead.episode?.series)}</span>
                    <h3>{lead.headline}</h3>
                    {lead.dek && <p>{lead.dek}</p>}
                    <span className="by">
                      {lead.byline}
                      {lead.publishedAt ? ` · ${formatDate(lead.publishedAt)}` : ""}
                    </span>
                  </div>
                </Link>
                {small.length > 0 && (
                  <div className="nb-two">
                    {small.map((a) => (
                      <Link className="nb-sm" href={`/notebook/${a.slug.current}`} key={a._id}>
                        <span className="t">{seriesLabel(a.episode?.series)}</span>
                        <h4>{a.headline}</h4>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : !DEMO_MODE ? (
              <EmptyState
                kicker="NEW EVERY WEEKDAY"
                title="The Notebook opens with the first companion story"
                body="Every episode of the show gets a written companion within hours of upload — takeaways, timestamps, and the quotes that matter."
                cta={{ href: "/notebook", label: "Open the Notebook" }}
              />
            ) : null}
          </div>

          <div className="wire">
            <div className="wh"><h3>The Wire</h3><span className="lv">Live</span></div>
            {!showWire && (
              <EmptyState
                kicker="AROUND THE CLOCK"
                title="The Wire is warming up"
                body="Every move in the sport lands here the minute it breaks — know it before the group chat does."
                cta={{ href: "/wire", label: "All Wire Coverage →" }}
              />
            )}
            {showWire &&
              wire.slice(0, 6).map((w) => {
                const inner = (
                  <>
                    <div className="t"><b><RelTime iso={w.publishedAt} /></b> · {(w.category ?? "news").toUpperCase()}</div>
                    <h4>{w.headline}</h4>
                  </>
                );
                // Every wire item is fully clickable (§1.3): our full story
                // when one exists, otherwise the original source's report.
                return w.storySlug ? (
                  <Link className="wi" href={`/wire/${w.storySlug}`} key={w._id}>{inner}</Link>
                ) : w.sourceUrl ? (
                  <a className="wi" href={w.sourceUrl} target="_blank" rel="noopener" key={w._id}>{inner}</a>
                ) : (
                  <div className="wi" key={w._id}>{inner}</div>
                );
              })}
            <Link className="all" href="/wire">All Wire Coverage →</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
