import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleBySlug, getPublishedArticles, getJoshArticles } from "@/lib/sanity";
import UpNextRoll from "@/components/UpNextRoll";
import { getBoards } from "@/lib/community";
import { teamHubHref, LAUNCH_TEAMS } from "@/lib/launch-teams";
import { getTeamDirectory } from "@/lib/cfbd";
import { teamLogoUrl } from "@/lib/teams-meta";
import ArticleBody from "@/components/ArticleBody";
import EditorialLabel, { Corrections } from "@/components/EditorialLabel";
import { formatDate } from "@/lib/format";

export const revalidate = 300;

// Notebook article page — the approved 2026-09-01 column mockup (Isaac:
// "only use this format or a variant of it moving forward"). Rides on the
// wire page's design constitution: className carries pg-wirestory for the
// architecture and pg-column for the column-specific parts.

function truncateMeta(text: string, max = 155): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.]?$/, "") + "…";
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};
  const title = article.seoTitle || article.headline;
  const description = truncateMeta(article.seoDescription || article.dek || "");
  const imageUrl = article.heroUrl || article.episode?.thumbnailUrl || null;
  return {
    title, description,
    alternates: { canonical: `/notebook/${slug}` },
    openGraph: { title, description, type: "article", ...(imageUrl ? { images: [{ url: imageUrl, width: 1200, height: 630, alt: article.headline }] } : {}) },
    twitter: { card: "summary_large_image", title, description, ...(imageUrl ? { images: [imageUrl] } : {}) },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();
  const isJosh = /josh pate/i.test(article.byline);

  const [boards, all, joshLatest, dir] = await Promise.all([
    getBoards().catch(() => []),
    getPublishedArticles(30).catch(() => []),
    getJoshArticles(3).catch(() => []),
    getTeamDirectory().catch(() => ({}) as Awaited<ReturnType<typeof getTeamDirectory>>),
  ]);

  const idx = all.findIndex((a) => a.slug.current === slug);
  const nextArticle = idx >= 0 ? (all[idx + 1] ?? all[0]) : null;
  const rollNext = nextArticle && nextArticle.slug.current !== slug ? nextArticle : null;
  const afterNext = rollNext ? (all[all.findIndex((a) => a.slug.current === rollNext.slug.current) + 1] ?? null) : null;

  const teamHref = teamHubHref(article.primaryTeam);
  const team = article.primaryTeam || null;
  const teamInfo = team ? dir[team] : undefined;
  const teamLogo = team ? (teamInfo?.logo ?? teamLogoUrl(team)) : null;
  const authorSlug = isJosh ? "josh-pate" : "the-pate-state-staff";
  const canonicalUrl = `https://thepatestate.com/notebook/${article.slug.current}`;
  const coverSrc = article.heroUrl || article.episode?.thumbnailUrl || null;
  // The Line Worth Keeping: the column's falsifiable claim. Rendered up top
  // only when the body doesn't already place it via its [PULLQUOTE] marker.
  const lineWorthKeeping = isJosh && article.pullQuote && !article.bodyMarkdown.includes("[PULLQUOTE]") ? article.pullQuote : null;
  const otherJosh = joshLatest.filter((a) => a.slug.current !== slug).slice(0, 2);
  // Visual modules for long-form staff analysis (2026-09-02): drawn from the
  // body by lib/editorial-v3/article-visuals.ts; Josh's columns keep their
  // own shape (the Line Worth Keeping).
  const stats = !isJosh ? (article.stats ?? []).filter((x) => x.value && x.label).slice(0, 3) : [];
  const facts = !isJosh ? (article.facts ?? []).filter((x) => x.label && x.value) : [];
  const watching = !isJosh ? (article.watching ?? []).filter((x) => x.title) : [];
  const questions = !isJosh ? (article.questions ?? []).filter((x) => x.question && x.why) : [];
  const callout = !isJosh && article.callout ? article.callout : null;
  const bodyParagraphs = article.bodyMarkdown.split(/\n{2,}/).map((b) => b.trim()).filter((b) => b && !b.startsWith("## ") && !/^\[(EMBED|PULLQUOTE)/.test(b)).length;
  const inserts = callout && bodyParagraphs >= 4 ? [{ afterParagraph: 3, node: <div className="pull"><p>&ldquo;{callout}&rdquo;</p><span>{article.calloutSpeaker || "From the story"}</span></div> }] : [];
  let n = 0;
  const next = () => ++n;

  const jsonLd = {
    "@context": "https://schema.org", "@type": "NewsArticle",
    headline: article.headline,
    description: truncateMeta(article.seoDescription || article.dek || ""),
    datePublished: article.publishedAt, dateModified: article.publishedAt,
    mainEntityOfPage: canonicalUrl,
    ...(article.heroUrl ? { image: [article.heroUrl] } : {}),
    author: { "@type": isJosh ? "Person" : "Organization", name: article.byline, url: `https://thepatestate.com/authors/${authorSlug}` },
    publisher: { "@type": "Organization", name: "The Pate State", url: "https://thepatestate.com" },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "The Pate State", item: "https://thepatestate.com" },
      { "@type": "ListItem", position: 2, name: "The Notebook", item: "https://thepatestate.com/notebook" },
      { "@type": "ListItem", position: 3, name: article.headline, item: canonicalUrl },
    ],
  };
  const videoJsonLd = article.episode ? {
    "@context": "https://schema.org", "@type": "VideoObject",
    name: article.episode.title,
    description: article.episode.description || article.dek || article.episode.title,
    thumbnailUrl: article.episode.thumbnailUrl ? [article.episode.thumbnailUrl] : undefined,
    uploadDate: article.episode.publishedAt,
    embedUrl: `https://www.youtube-nocookie.com/embed/${article.episode.ytId}`,
  } : null;

  return (
    <main className={isJosh ? "v5 pg-wirestory pg-column" : "v5 pg-wirestory pg-column pg-analysis"}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      {videoJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd).replace(/</g, "\\u003c") }} />
      )}

      <div className="wrap"><div className="art-grid">
        <article className="article">
          <div className="a-crumb">
            <Link href="/">Read</Link> / <Link href="/notebook">The Notebook</Link> / <b>{isJosh ? "Josh’s Read" : "Analysis"}</b>
          </div>

          <div className="a-kick">
            <span className="nb">{isJosh ? "The Notebook · From Josh" : "The Notebook"}</span>
            {isJosh
              ? <span className="imp">Josh’s Read · Logged to the Ledger</span>
              : <span className="imp">{article.contentType ?? "Analysis"}</span>}
            {team && (
              <span className="team">
                {teamLogo && <img src={teamLogo} alt="" width={22} height={22} />}
                {teamInfo?.school ?? team.replace(/-/g, " ")}
              </span>
            )}
          </div>

          <h1 className="a-hl">{article.headline}</h1>
          {article.dek && <p className="a-dek">{article.dek}</p>}

          <div className="a-by">
            <div className="av">{isJosh ? "JP" : "PS"}</div>
            <div className="who">
              <Link href={`/authors/${authorSlug}`} style={{ textDecoration: "none", color: "inherit" }}><b>{article.byline}</b></Link>
              <span>{isJosh ? "The mayor’s desk · every take timestamped, every pick graded" : "Analysis from the desk · monitored by an editor"}</span>
            </div>
            <div className="upd">
              <b>● {isJosh ? "On the Ledger" : "Published"}</b><br />
              {article.publishedAt ? formatDate(article.publishedAt) : ""}
            </div>
          </div>

          {coverSrc && (
            <div className="a-hero">
              <img className="article-hero-image" src={coverSrc} alt={article.headline} />
              <span className="lbl">{article.heroCredit ? `Photo: ${article.heroCredit}` : "The Pate State"}</span>
            </div>
          )}

          {stats.length > 0 && (
            <div className="nums">
              {stats.map((x, i) => (
                <div className="num" key={i}>
                  <div className={x.critical ? "n crit" : "n"}>{x.value}</div>
                  <p>{x.label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="a-body">
            {lineWorthKeeping && (
              <div className="linebox">
                <div className="eb">The Line Worth Keeping</div>
                <p>&ldquo;{lineWorthKeeping}&rdquo;</p>
                <small>Logged {article.publishedAt ? formatDate(article.publishedAt) : ""} · On the Ledger</small>
              </div>
            )}

            <ArticleBody article={article} bare hideKicker inserts={inserts} />

            {questions.length > 0 && (
              <>
                <h2><span className="pt">{String(next()).padStart(2, "0")} · The Open Questions</span>Questions to Be Answered</h2>
                <div className="wl qa">
                  {questions.map((q, i) => (
                    <div key={i}><div className="n">{i + 1}</div><div><h3>{q.question}</h3><p>{q.why}</p></div></div>
                  ))}
                </div>
              </>
            )}

            {watching.length > 0 && (
              <>
                <h2><span className="pt">{String(next()).padStart(2, "0")} · The Watch List</span>What to Watch Next</h2>
                <div className="wl">
                  {watching.map((w, i) => (
                    <div key={i}><div className="n">{i + 1}</div><div><h3>{w.title}</h3>{w.body && <p>{w.body}</p>}</div></div>
                  ))}
                </div>
              </>
            )}

            <Corrections corrections={article.corrections} />

            <EditorialLabel
              contentType={article.contentType}
              productionMethod={article.productionMethod}
              byline={article.byline}
              reviewedBy={article.reviewedBy}
            />

            {(() => {
              const teamBoard = article.primaryTeam
                ? boards.find((b) => b.kind === "team" && b.team_slug === article.primaryTeam)
                : null;
              const target = teamBoard ?? boards.find((b) => b.slug === "front-porch");
              return target ? (
                <div style={{ marginTop: 24 }}>
                  <Link className="btn" href={`/community/${target.slug}`} style={{ borderColor: "var(--w-navy)", color: "var(--w-navy)" }}>
                    💬 Argue it out on {teamBoard ? `the ${target.name}` : "the Quad"} →
                  </Link>
                </div>
              ) : null;
            })()}

            {article.episode && (
              <a className="videobox" href={`https://www.youtube.com/watch?v=${article.episode.ytId}`} target="_blank" rel="noopener" style={{ textDecoration: "none" }}>
                <div className="vthumb">
                  <span className="playbtn" style={{ position: "static", width: 44, height: 44 }} aria-hidden="true">▶</span>
                </div>
                <div>
                  <h4>Watch the Companion</h4>
                  <div className="meta">{article.episode.title}</div>
                </div>
              </a>
            )}

            <div className="stdnote">
              <b>On the record:</b> {isJosh
                ? "This column reflects Josh’s public positions from the show. Published under the approved Josh Pate byline per "
                : "Drafted from the cited reporting under "}
              <Link href="/standards">our editorial standards</Link>. Corrections are timestamped, never silent.
            </div>

            {rollNext && (
              <>
                <UpNextRoll
                  contentId={`upnext-${rollNext.slug.current}`}
                  nextPath={`/notebook/${rollNext.slug.current}`}
                  nextTitle={`${rollNext.headline} — The Pate State`}
                  nextHeadline={rollNext.headline}
                  nextDek={rollNext.dek}
                />
                <div id={`upnext-${rollNext.slug.current}`} hidden className="upnext-body">
                  <div className="upnext-divider">CONTINUED FROM THE NOTEBOOK</div>
                  <Link href={`/notebook/${rollNext.slug.current}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <h1 className="a-hl" style={{ fontSize: "clamp(26px,3.4vw,36px)" }}>{rollNext.headline}</h1>
                  </Link>
                  {rollNext.dek && <p className="a-dek" style={{ marginTop: 10 }}>{rollNext.dek}</p>}
                  <ArticleBody article={rollNext} bare hideKicker />
                  <EditorialLabel
                    contentType={rollNext.contentType}
                    productionMethod={rollNext.productionMethod}
                    byline={rollNext.byline}
                    reviewedBy={rollNext.reviewedBy}
                  />
                  <div style={{ marginTop: 26 }}>
                    <Link className="btn" href={afterNext ? `/notebook/${afterNext.slug.current}` : "/notebook"} style={{ borderColor: "var(--w-navy)", color: "var(--w-navy)" }}>
                      {afterNext ? `Keep Reading: ${afterNext.headline} →` : "Back to the Notebook →"}
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        </article>

        <aside className="rail">
          {facts.length > 0 && (
            <div className="rc">
              <div className="hd">The Facts</div>
              <div className="bd"><ul>
                {facts.map((f, i) => (
                  <li key={i}><b>{f.label}</b><i style={{ fontStyle: "normal" }}>{f.value}</i></li>
                ))}
              </ul></div>
            </div>
          )}
          <div className="rc">
            <div className="hd">{isJosh ? "Josh’s Read" : "The Notebook"}</div>
            <div className="bd"><div className="impact">
              <span className="lbadge">{isJosh ? "On the Ledger" : "Analysis"}</span>
              <p>{isJosh ? "Every take timestamped, every pick graded, every miss printed first." : "What the news actually means — argued from the numbers."}</p>
            </div></div>
            {otherJosh.map((a) => (
              <Link className="nx" href={`/notebook/${a.slug.current}`} key={a._id}>
                <small>Josh’s Read</small>
                <b>{a.headline}</b>
              </Link>
            ))}
          </div>
          <div className="rc">
            <div className="hd">Keep Exploring</div>
            <Link className="cta" href="/poll">See the Full JP Poll</Link>
            <p className="sub">
              <Link href={teamHref} style={{ color: "inherit", fontWeight: 600 }}>
                {article.primaryTeam && LAUNCH_TEAMS.includes(article.primaryTeam) ? "Open the Team Hub →" : "Browse All Teams →"}
              </Link>
            </p>
          </div>
          <div className="rc">
            <div className="hd">Citizenship</div>
            <Link className="cta" href="/join">Join Free</Link>
            <p className="sub">Picks logged. Polls archived. The Quad gets the last word.</p>
          </div>
        </aside>
      </div></div>
    </main>
  );
}
