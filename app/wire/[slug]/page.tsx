import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWireStoryBySlug, getWireStories, type SanityWireStory } from "@/lib/sanity";
import { getTeamDirectory } from "@/lib/cfbd";
import { teamLogoUrl } from "@/lib/teams-meta";
import { getVideos, videoUrl, CHANNEL_URL } from "@/lib/youtube";
import { formatDate } from "@/lib/format";
import { Corrections } from "@/components/EditorialLabel";

export const revalidate = 120;

// Wire story page — Production Guide v1.2 design constitution.
// Reference build: docs/content/wire-kansas-state-pastore-v3.html.
// New-format stories render the full architecture; legacy stories (pre-v1.2)
// degrade to their sections inside the same shell.

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  reported: "Reported",
  developing: "Developing",
};

const CATEGORY_LABEL: Record<string, string> = {
  recruiting: "Recruiting", coaching: "Coaching", injury: "Injury report",
  transfer: "Transfer portal", playoff: "Playoff", media: "Media", legal: "Legal", general: "Breaking coverage",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const story = await getWireStoryBySlug(slug).catch(() => null);
  if (!story) return { title: "The Wire" };
  return {
    title: `${story.headline} — The Wire`,
    description: truncateMeta(story.deck ?? story.whatHappened ?? ""),
    alternates: { canonical: `/wire/${slug}` },
  };
}

function truncateMeta(text: string, max = 155): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.]?$/, "") + "…";
}

function SectionHead({ n, kicker, title }: { n: number; kicker: string; title: string }) {
  return (
    <h2><span className="pt">{String(n).padStart(2, "0")} · {kicker}</span>{title}</h2>
  );
}

export default async function WireStoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story: SanityWireStory | null = await getWireStoryBySlug(slug);
  if (!story) notFound();

  const [dir, latestVideos, moreStories] = await Promise.all([
    getTeamDirectory().catch(() => ({}) as Awaited<ReturnType<typeof getTeamDirectory>>),
    getVideos().catch(() => []),
    getWireStories(8).catch(() => []),
  ]);
  const team = story.teams?.[0];
  const teamInfo = team ? dir[team] : undefined;
  const teamLogo = team ? (teamInfo?.logo ?? teamLogoUrl(team)) : null;
  const teamColor = teamInfo?.color ? `#${teamInfo.color.replace(/^#/, "")}` : "#1A2C55";
  const latest = latestVideos[0] ?? null;
  const related = moreStories.filter((s) => s.slug.current !== story.slug.current).slice(0, 3);

  const receiptHref = story.joshReceipt?.ytId
    ? `https://www.youtube.com/watch?v=${story.joshReceipt.ytId}&t=${story.joshReceipt.tsSeconds ?? 0}s`
    : null;
  const status = STATUS_LABEL[story.verification ?? "reported"] ?? "Reported";
  const stats = (story.stats ?? []).filter((s) => s.value && s.label);
  const watching = (story.watching ?? []).filter((w) => w.title);
  const boardRows = story.board?.rows?.filter((r) => r.name) ?? [];

  const storyUrl = `https://thepatestate.com/wire/${story.slug.current}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: story.headline,
      description: (story.deck ?? story.whatHappened)?.slice(0, 300),
      datePublished: story.publishedAt,
      dateModified: story.updatedAt ?? story.publishedAt,
      mainEntityOfPage: storyUrl,
      author: {
        "@type": "Organization",
        name: "The Pate State Wire Desk",
        url: "https://thepatestate.com/authors/the-pate-state-staff",
      },
      publisher: { "@type": "Organization", name: "The Pate State", url: "https://thepatestate.com" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "The Pate State", item: "https://thepatestate.com" },
        { "@type": "ListItem", position: 2, name: "The Wire", item: "https://thepatestate.com/wire" },
        { "@type": "ListItem", position: 3, name: story.headline, item: storyUrl },
      ],
    },
  ];

  // Section numbering only counts sections that actually render.
  let n = 0;
  const next = () => ++n;

  return (
    <main className="v5 pg-wirestory">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <div className="wirestrip"><div className="wrap">
        <span className="dot" /><b>The Wire</b>
        <span>{CATEGORY_LABEL[story.category ?? "general"] ?? "Breaking coverage"}{teamInfo?.conference ? ` · ${teamInfo.conference}` : ""}</span>
        <span className="t">UPDATED {formatDate(story.updatedAt ?? story.publishedAt ?? "").toUpperCase()}</span>
      </div></div>

      <div className="wrap"><div className="art-grid">
        <article className="article">
          <div className="a-crumb"><Link href="/">The Pate State</Link> / <Link href="/wire"><b>The Wire</b></Link></div>

          <div className="a-kick">
            <span className="k">The Wire</span>
            <span className="st">Status · {status}</span>
            {story.impact && <span className="imp">Impact · {story.impact.replace("-", " ")}</span>}
            {team && (
              <span className="team">
                {teamLogo && <img src={teamLogo} alt="" width={22} height={22} />}
                {teamInfo?.school ?? team.replace(/-/g, " ")}{teamInfo?.conference ? ` · ${teamInfo.conference}` : ""}
              </span>
            )}
          </div>

          <h1 className="a-hl">{story.headline}</h1>
          {story.deck && <p className="a-dek">{story.deck}</p>}

          <div className="a-by">
            <div className="av">JP</div>
            <div className="who">
              <b>Josh Pate</b>
              <span>The Wire · drafted from the cited sources in Josh&apos;s voice · verified and monitored by an editor</span>
            </div>
            <div className="upd"><b>● {status}</b><br />{formatDate(story.publishedAt ?? "")}</div>
          </div>

          {teamLogo && (
            <div className="a-hero">
              <div
                className="ph"
                style={{
                  background: `radial-gradient(640px 340px at 70% 12%, ${teamColor}66, transparent 58%), linear-gradient(140deg, ${teamColor}40 0%, var(--w-navy-deep) 62%, #1A2C55 100%)`,
                }}
              >
                {/* Team logo on a tinted field — the Wire graphic (guide §2:
                    team color is a garnish, never an identity). */}
                <img src={teamLogo} alt="" width={150} height={150} />
              </div>
              <span className="lbl">The Pate State · Wire Graphic</span>
            </div>
          )}

          {stats.length > 0 && (
            <div className="nums">
              {stats.slice(0, 3).map((s, i) => (
                <div className="num" key={i}>
                  <div className={s.critical ? "n crit" : "n"}>{s.value}</div>
                  <p>{s.label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="a-body">
            {/* Wire Editorial System v2.0 §47–48: headers adapt to the story; the
                writer's title wins, the label below is the fallback. */}
            <SectionHead n={next()} kicker="The News" title={story.openTitle || "What Happened"} />
            <p>{story.whatHappened}</p>

            {(story.whyBody || (story.whyItMatters?.length ?? 0) > 0) && (
              <>
                <SectionHead n={next()} kicker="The Stakes" title={story.whyTitle || "Why This One Matters"} />
                {story.whyBody ? (
                  <p>{story.whyBody}</p>
                ) : (
                  <ul className="legacy">
                    {story.whyItMatters!.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                )}
              </>
            )}

            {story.missing && (
              <>
                <SectionHead n={next()} kicker="The Detail Beneath the Headline" title={story.missingTitle || "What Most People Are Missing"} />
                <div className="missbox">
                  <p>{story.missing}</p>
                </div>
              </>
            )}

            {story.callout && (
              <div className="pull"><p>&ldquo;{story.callout}&rdquo;</p><span>The Wire Desk</span></div>
            )}

            {story.section04Body && (
              <>
                <SectionHead n={next()} kicker="The Personnel" title={story.section04Title || "What Changes Now"} />
                <p>{story.section04Body}</p>
              </>
            )}

            {boardRows.length > 0 && (
              <div className="p22">
                <div className="hd"><b>{story.board?.title || "The Replacement Board"}</b><span>Pate State projection — not a confirmed depth chart</span></div>
                {boardRows.map((r, i) => (
                  <div className="row" key={i}>
                    <div className="pos">{r.name}<small>{r.meta}</small></div>
                    <div className="who">{r.note}</div>
                  </div>
                ))}
                {story.board?.summary && <div className="sum"><b>The tell:</b> {story.board.summary}</div>}
              </div>
            )}

            {story.chessboard && (
              <>
                <SectionHead n={next()} kicker="The Chessboard" title={story.chessboardTitle || "What the Coaches Can Actually Change"} />
                <div className="chessbox"><p>{story.chessboard}</p></div>
              </>
            )}

            {story.readBody && (
              <>
                {/* Kit 04 §4 module 12: a small label when Josh hasn't spoken on today's
                    news — never a closer. */}
                <SectionHead n={next()} kicker={story.joshReceipt?.quote ? "The Thesis" : "Desk Analysis · Josh Has Not Yet Commented on Today's News"} title="The Pate State Read" />
                <div className="readcard">
                  <p>{story.readBody}</p>
                </div>
              </>
            )}

            {story.joshReceipt?.quote && (
              <div className="joshtake">
                <div className="eb">Josh&apos;s Take · on the record</div>
                <p>&ldquo;{story.joshReceipt.quote}&rdquo;</p>
                <span className="who">
                  — Josh Pate{receiptHref && <> · <a href={receiptHref} target="_blank" rel="noopener">watch the moment →</a></>}
                </span>
              </div>
            )}

            {(watching.length > 0 || (story.whatsNext?.length ?? 0) > 0) && (
              <>
                <SectionHead n={next()} kicker="The Watch List" title="What We're Watching" />
                <div className="wl">
                  {watching.length > 0
                    ? watching.map((w, i) => (
                        <div key={i}><div className="n">{i + 1}</div><div><h3>{w.title}</h3>{w.body && <p>{w.body}</p>}</div></div>
                      ))
                    : story.whatsNext!.map((w, i) => (
                        <div key={i}><div className="n">{i + 1}</div><div><h3>{w}</h3></div></div>
                      ))}
                </div>
              </>
            )}

            <Corrections corrections={story.corrections} />

            <div className="stdnote">
              <b>Sourcing &amp; standards:</b>{" "}
              {story.sources && story.sources.length > 0 && (
                <>
                  Reporting via{" "}
                  {story.sources.map((s, i) => (
                    <span key={i}>
                      {i > 0 && " · "}
                      {s.url ? <a href={s.url} target="_blank" rel="noopener">{s.outlet ?? "source"}</a> : s.outlet}
                    </span>
                  ))}
                  .{" "}
                </>
              )}
              Produced by the Pate State Wire Desk under the site&apos;s{" "}
              <Link href="/standards">verification rules</Link>, monitored by an editor. Corrections are
              timestamped, never silent.
            </div>
          </div>
        </article>

        <aside className="rail">
          {/* Impact Rating rail card removed (Isaac, 2026-08-21) — the
              impact chip in the kicker row carries the rating; the
              rationale lives in the data for Studio/QA. */}
          {(story.facts?.length ?? 0) > 0 && (
            <div className="rc">
              <div className="hd">The Facts</div>
              <div className="bd"><ul>
                {story.facts!.map((f, i) => (
                  <li key={i}><b>{f.label}</b><i style={{ fontStyle: "normal" }}>{f.value}</i></li>
                ))}
              </ul></div>
            </div>
          )}
          <div className="rc">
            <div className="hd">Citizenship</div>
            <Link className="cta" href="/join">Join Free</Link>
            <p className="sub">Picks logged. Polls archived. The Porch gets the last word.</p>
          </div>
        </aside>
      </div></div>

      <div className="wrn"><div className="wrap">
        <h2>What to Read &amp; Watch Next</h2>
        <p className="sub">The story continues on the show and across the Wire.</p>
        <div className="grid">
          <a className="vid" href={latest ? videoUrl(latest.id) : CHANNEL_URL} target="_blank" rel="noopener">
            <small>▶ Video · The Show</small>
            <b>{latest ? latest.title.replace(/ - Josh Pate's College Football Show/i, "") : "Watch the latest episode of Josh Pate's College Football Show"}</b>
          </a>
          {related.map((s) => (
            <Link href={`/wire/${s.slug.current}`} key={s._id}>
              <small>{CATEGORY_LABEL[s.category ?? "general"] ?? "The Wire"}</small>
              <b>{s.headline}</b>
            </Link>
          ))}
        </div>
      </div></div>
    </main>
  );
}

export async function generateStaticParams() {
  const stories = await getWireStories(20).catch(() => []);
  return stories.map((s) => ({ slug: s.slug.current }));
}
