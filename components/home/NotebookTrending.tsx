import Link from "next/link";
import Image from "next/image";
import type { SanityArticle } from "@/lib/sanity";
import { createArtPicker } from "@/lib/editorial-art";
import { formatDate } from "@/lib/format";
import RelTime from "@/components/RelTime";
import EmptyState from "@/components/EmptyState";
import { DEMO_MODE } from "@/lib/demo";

// v25 Notebook + Trending: feature card + stacked rows on the left, the
// Trending list + playoff bracket-preview card on the right. The bracket
// seeds come from the latest published JP board (real when present).
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

export interface BracketSeed {
  slug: string;
  name: string;
  logo: string | null;
  seed: number;
}

export default function NotebookTrending({ lead, stack, trending, seeds }: {
  lead: SanityArticle | null;
  stack: SanityArticle[];
  trending: SanityArticle[];
  seeds: BracketSeed[];
}) {
  const art = createArtPicker();
  const leadImg = lead?.heroUrl ? { src: lead.heroUrl, alt: lead.headline } : art.pick("weekend-truths");
  // Mockup pairs are [1v8, 4v5] left · [2v7, 3v6] right.
  const pairs: [number, number][] = [[0, 7], [3, 4]];
  const pairsR: [number, number][] = [[1, 6], [2, 5]];
  const bracketReady = seeds.length === 8;
  return (
    <section className="notebook">
      <div className="wrap">
        <div className="sect-head">
          <div>
            <div className="eyebrow">New Every Weekday</div>
            <h2>The Notebook</h2>
            <div className="sub">Josh&apos;s read on the sport — what the news actually means.</div>
          </div>
          <Link className="more" href="/notebook">All Stories →</Link>
        </div>

        <div className="nb-grid">
          <div>
            {lead ? (
              <>
                <Link className="nb-feat" href={`/notebook/${lead.slug.current}`}>
                  <div className="art">
                    <Image src={leadImg.src} alt={leadImg.alt} fill sizes="(max-width:1080px) 100vw, 780px" style={{ objectFit: "cover" }} />
                    <span className="art-lbl">{seriesLabel(lead.episode?.series)}</span>
                  </div>
                  <div className="pad">
                    <span className="kick">📝 The Notebook</span>
                    <h3>{lead.headline}</h3>
                    {lead.dek && <p>{lead.dek}</p>}
                    <span className="by">
                      {lead.byline}
                      {lead.publishedAt ? ` · ${formatDate(lead.publishedAt)}` : ""}
                    </span>
                  </div>
                </Link>
                {stack.length > 0 && (
                  <div className="nb-stack">
                    {stack.map((a) => {
                      const img = a.heroUrl ? { src: a.heroUrl, alt: a.headline, logo: false } : { ...art.pick("generic", a.headline), logo: false };
                      return (
                        <Link className="nb-row" href={`/notebook/${a.slug.current}`} key={a._id}>
                          <span className="im">
                            <Image src={img.src} alt="" fill sizes="128px" style={{ objectFit: "cover" }} />
                          </span>
                          <div>
                            <span className="t">The Notebook · {seriesLabel(a.episode?.series)}</span>
                            <h4>{a.headline}</h4>
                            <span className="by">
                              {a.byline}
                              {a.publishedAt ? <> · <RelTime iso={a.publishedAt} short /></> : null}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
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

          <div className="tr-col">
            {trending.length > 0 && (
              <>
                <div className="col-title">Trending</div>
                <div className="col-sub">The week&apos;s biggest stories in the State</div>
                {trending.slice(0, 5).map((a, i) => (
                  <Link className="trend" href={`/notebook/${a.slug.current}`} key={a._id}>
                    <span className="n">{i + 1}</span>
                    <div><h4>{a.headline}</h4><span className="by">{a.byline}</span></div>
                  </Link>
                ))}
              </>
            )}
            <div className="rail-brkt">
              <div className="rb-k">
                🏆 Playoffs · Free to Play
                <span className="rb-preview">{bracketReady ? "Seeded by the JP Poll" : "Bracket Preview"}</span>
              </div>
              <h4>Pick the Playoff. Call Your Champ.</h4>
              <p className="rb-sub">Build your bracket and see how you stack up against Josh and the State.</p>
              {bracketReady && (
                <Link href="/playoffs" className="brk brk8" style={{ display: "grid" }}>
                  <div className="brk-col">
                    {pairs.map(([a, b]) => (
                      <div className="qf" key={a}>
                        {[seeds[a], seeds[b]].map((s) => (
                          <div className="tr" key={s.slug}>
                            {s.logo && <Image src={s.logo} alt="" width={19} height={19} />}
                            <span>{s.seed} {s.name}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="brk-mid">
                    <div className="brk-champ"><b>?</b><span>Your Champ</span></div>
                  </div>
                  <div className="brk-col r">
                    {pairsR.map(([a, b]) => (
                      <div className="qf" key={a}>
                        {[seeds[a], seeds[b]].map((s) => (
                          <div className="tr" key={s.slug}>
                            {s.logo && <Image src={s.logo} alt="" width={19} height={19} />}
                            <span>{s.seed} {s.name}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="brk-hint">Tap in to make your first pick</div>
                </Link>
              )}
              <Link className="rb-go" href="/playoffs">Build My Bracket →</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
