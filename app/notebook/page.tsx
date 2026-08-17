import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  getPublishedArticles,
  getWireItems,
  getWireStories,
  type SanityArticle,
  type SanityWireItem,
  type SanityWireStory,
} from "@/lib/sanity";
import { teamLogoUrl } from "@/lib/teams-meta";
import RelTime from "@/components/RelTime";
import JoinForm from "@/components/JoinForm";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "The Notebook — Articles & Analysis",
  description: "The written record of the sport: companion stories for every episode, breaking coverage, and columns — new every weekday.",
  alternates: { canonical: "/notebook" },
};
export const revalidate = 300;

// Same duplication pattern as the notebook cards below: a small per-file
// lookup rather than a shared lib module (this codebase doesn't DRY up
// presentational bits — see components/ArticleBody.tsx for the sibling copy).
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

// Unified LATEST feed: remaining articles interleaved with wire stories,
// ordered by recency (missing timestamps sink to the bottom).
type FeedEntry =
  | { kind: "article"; ts: number; a: SanityArticle }
  | { kind: "wire"; ts: number; w: SanityWireStory };

const ts = (iso?: string | null) => (iso ? new Date(iso).getTime() : 0);

/** Article thumbnail for a feed row: hero photo (with a team chip when the
 * team is mapped) → team-logo tile → plain navy tile. */
function ArticleThumb({ a, size }: { a: SanityArticle; size: string }) {
  const logo = a.primaryTeam ? teamLogoUrl(a.primaryTeam) : null;
  if (a.heroUrl) {
    return (
      <span className="im">
        <Image src={a.heroUrl} alt="" fill sizes={size} style={{ objectFit: "cover" }} />
        {logo && <Image className="chip" src={logo} alt="" width={22} height={22} />}
      </span>
    );
  }
  return (
    <span className="im logo">
      {logo && <Image className="lg" src={logo} alt="" width={42} height={42} />}
    </span>
  );
}

export default async function NotebookPage({
  searchParams,
}: {
  searchParams: Promise<{ series?: string | string[] }>;
}) {
  const sp = await searchParams;
  const requested = typeof sp.series === "string" ? sp.series : undefined;

  const [articles, wireStories, wireItems] = await Promise.all([
    getPublishedArticles(12).catch(() => [] as SanityArticle[]),
    getWireStories(12).catch(() => [] as SanityWireStory[]),
    getWireItems(8).catch(() => [] as SanityWireItem[]),
  ]);

  // Browsing filters render ONLY for episode.series values actually present
  // in the fetched articles (§0.3 — no dead filters).
  const seriesPresent: string[] = [];
  for (const a of articles) {
    const s = a.episode?.series;
    if (s && !seriesPresent.includes(s)) seriesPresent.push(s);
  }
  const activeSeries = requested && seriesPresent.includes(requested) ? requested : undefined;
  const filtered = activeSeries ? articles.filter((a) => a.episode?.series === activeSeries) : articles;

  // Lead package: 1 feature + 4 supporting; the rest flow into the feed.
  const lead = filtered[0] ?? null;
  const supporting = filtered.slice(1, 5);
  const feed: FeedEntry[] = [
    ...filtered.slice(5).map((a): FeedEntry => ({ kind: "article", ts: ts(a.publishedAt), a })),
    // Wire stories don't carry a series — a series-filtered view is articles only.
    ...(activeSeries ? [] : wireStories).map((w): FeedEntry => ({ kind: "wire", ts: ts(w.publishedAt), w })),
  ]
    .sort((x, y) => y.ts - x.ts)
    .slice(0, 14);

  const newestIso = [lead?.publishedAt, supporting[0]?.publishedAt, wireStories[0]?.publishedAt]
    .filter((x): x is string => Boolean(x))
    .sort()
    .pop();

  return (
    <main className="v5 pg-notebook">
      {/* PAGE HEAD + BROWSING FILTERS */}
      <div className="phead">
        <div className={seriesPresent.length > 0 ? "wrap" : "wrap no-cats"}>
          <div className="crumb">The Pate State / <b>The Notebook</b></div>
          <h1>The Notebook</h1>
          <p className="sub">College football, on the record — Josh&apos;s analysis and the news moving the sport.</p>
          <p className="sub2">Breaking news, deep reads, recruiting, rankings and the arguments worth having. Updated throughout the day.</p>
          {seriesPresent.length > 0 && (
            <div className="cats">
              <Link className={activeSeries ? "cat" : "cat on"} href="/notebook">Latest</Link>
              {seriesPresent.map((s) => (
                <Link
                  key={s}
                  className={activeSeries === s ? "cat on" : "cat"}
                  href={`/notebook?series=${encodeURIComponent(s)}`}
                >
                  {seriesLabel(s)}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* LEAD PACKAGE: 1 feature + 4 supporting */}
      <section className="lead">
        <div className="wrap">
          {lead ? (
            <div className="lead-grid">
              <Link className="feat" href={`/notebook/${lead.slug.current}`}>
                <div className="art">
                  {lead.heroUrl && (
                    <Image src={lead.heroUrl} alt="" fill sizes="(max-width: 1080px) 100vw, 760px" style={{ objectFit: "cover" }} />
                  )}
                  <span className="tag">{seriesLabel(lead.episode?.series)}</span>
                  <div className="rule" />
                </div>
                <div className="tx">
                  <span className="k">Featured</span>
                  <h2>{lead.headline}</h2>
                  {lead.dek && <p className="dek">{lead.dek}</p>}
                  <span className="by">
                    {lead.byline}
                    {lead.publishedAt && <> · <RelTime iso={lead.publishedAt} short /></>}
                  </span>
                </div>
              </Link>
              {supporting.length > 0 && (
                <div className="side">
                  <span className="sh">More from the Notebook</span>
                  {supporting.map((a) => {
                    const logo = a.primaryTeam ? teamLogoUrl(a.primaryTeam) : null;
                    return (
                      <Link className="srow" href={`/notebook/${a.slug.current}`} key={a._id}>
                        <span className="im">
                          {a.heroUrl ? (
                            <Image src={a.heroUrl} alt="" fill sizes="70px" style={{ objectFit: "cover" }} />
                          ) : logo ? (
                            <Image className="lg" src={logo} alt="" width={32} height={32} />
                          ) : null}
                        </span>
                        <div>
                          <span className="t">{seriesLabel(a.episode?.series)}</span>
                          <h4>{a.headline}</h4>
                          <span className="by">
                            {a.byline}
                            {a.publishedAt && <> · <RelTime iso={a.publishedAt} short /></>}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              kicker="NEW EVERY WEEKDAY"
              title="The first companion stories are on the way"
              body="Every episode of the show gets its written companion within hours of upload."
            />
          )}
        </div>
      </section>

      {/* LATEST: unified mixed feed + rail */}
      <section className="feedsec">
        <div className="wrap">
          <div className="feed-grid">
            <div>
              <div className="fh">
                <h3>Latest</h3>
                {newestIso && <span className="live">Updated <RelTime iso={newestIso} /></span>}
                <div className="ln" />
              </div>
              {feed.length > 0 ? (
                <div className="nb-stack">
                  {feed.map((e) =>
                    e.kind === "article" ? (
                      <Link className="nb-row" href={`/notebook/${e.a.slug.current}`} key={e.a._id}>
                        <ArticleThumb a={e.a} size="128px" />
                        <div>
                          <span className="t">
                            {seriesLabel(e.a.episode?.series)}
                            {e.a.publishedAt && <> · <RelTime iso={e.a.publishedAt} short /></>}
                          </span>
                          <h4>{e.a.headline}</h4>
                          {e.a.dek && <p className="dek">{e.a.dek}</p>}
                          <span className="by">{e.a.byline}</span>
                        </div>
                      </Link>
                    ) : (
                      <Link className="nb-row" href={`/wire/${e.w.slug.current}`} key={e.w._id}>
                        <span className="im logo">
                          {(() => {
                            const logo = e.w.teams?.[0] ? teamLogoUrl(e.w.teams[0]) : null;
                            return logo ? <Image className="lg" src={logo} alt="" width={42} height={42} /> : null;
                          })()}
                        </span>
                        <div>
                          <span className="t t-wire">
                            ⚡ The Wire{e.w.category ? ` · ${e.w.category}` : ""}
                            {e.w.publishedAt && <> · <RelTime iso={e.w.publishedAt} short /></>}
                          </span>
                          <h4>{e.w.headline}</h4>
                          {e.w.whatHappened && <p className="dek">{e.w.whatHappened}</p>}
                          <span className="by">The Wire Desk</span>
                        </div>
                      </Link>
                    )
                  )}
                </div>
              ) : (
                <EmptyState
                  kicker="THE ARCHIVE IS BUILDING"
                  title="More stories land daily"
                  body="Companion stories, wire coverage, and columns stack up here as the season goes."
                  cta={{ href: "/wire", label: "Read the Wire →" }}
                />
              )}
              <Link className="more" href="/wire">All Wire Coverage →</Link>
              <p className="wire-note">
                ⚡ Wire stories are fast-turn news reports. <Link href="/standards#ai">How The Wire Works →</Link>
              </p>
            </div>

            <div className="rail">
              <div className="fh"><h3>The Wire</h3><div className="ln" /></div>
              {wireItems.length > 0 ? (
                wireItems.map((w, i) => {
                  const inner = (
                    <>
                      <span className="n">{i + 1}</span>
                      <div>
                        <h4>{w.headline}</h4>
                        <span className="by">
                          {w.category ?? "News"}
                          {w.publishedAt && <> · <RelTime iso={w.publishedAt} short /></>}
                        </span>
                      </div>
                    </>
                  );
                  // Headlines never leave the site (client directive
                  // 2026-08-17): on-site story → /wire/[slug]; storyless
                  // items render unlinked here (outbound credit lives on the
                  // /wire index and inside stories).
                  return w.storySlug ? (
                    <Link className="trend" href={`/wire/${w.storySlug}`} key={w._id}>{inner}</Link>
                  ) : (
                    <div className="trend" key={w._id}>{inner}</div>
                  );
                })
              ) : (
                <EmptyState
                  kicker="AROUND THE CLOCK"
                  title="The Wire is warming up"
                  body="Every move in the sport lands here the minute it breaks."
                />
              )}

              <div className="rail-pb">
                <span className="k">📬 The Pate Playbook · Free Every Weekday</span>
                <h4>The Whole Sport.<br /><em>Four Minutes. Every Morning.</em></h4>
                <p>Wake up knowing what changed, what actually matters, and what to watch next — in Josh&apos;s voice, by 6 AM.</p>
                <div className="form">
                  <JoinForm next="/welcome" />
                </div>
                <div className="proof">Free. Weekdays at 6 AM. Unsubscribe anytime.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SMALL CITIZEN CTA */}
      <section className="cit">
        <div className="wrap">
          <div className="row">
            <div>
              <div className="k">More for Citizens</div>
              <p>
                Free membership gets you <b>the mailbag, the ballot data, the deep guides</b> — and the 2026 JP
                Preseason Football Guide the moment you join.
              </p>
            </div>
            <Link className="go" href="/join">Join the State →</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
