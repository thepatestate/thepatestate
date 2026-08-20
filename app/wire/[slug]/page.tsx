import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWireStoryBySlug, getWireStories } from "@/lib/sanity";
import { teamLogoUrl } from "@/lib/teams-meta";
import { getVideos, videoUrl, CHANNEL_URL } from "@/lib/youtube";
import { formatDate } from "@/lib/format";
import EditorialLabel, { Corrections } from "@/components/EditorialLabel";
import Image from "next/image";

export const revalidate = 120;

const VERIFICATION_STYLE: Record<string, { label: string; bg: string }> = {
  confirmed: { label: "CONFIRMED", bg: "var(--field, #1E3B2E)" },
  reported: { label: "REPORTED", bg: "var(--navy, #16213A)" },
  developing: { label: "DEVELOPING", bg: "#7A5C1E" },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const story = await getWireStoryBySlug(slug).catch(() => null);
  if (!story) return { title: "The Wire" };
  return {
    title: `${story.headline} — The Wire`,
    description: story.whatHappened?.slice(0, 155),
    alternates: { canonical: `/wire/${slug}` },
  };
}

export default async function WireStoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = await getWireStoryBySlug(slug);
  if (!story) notFound();

  const v = VERIFICATION_STYLE[story.verification ?? "reported"] ?? VERIFICATION_STYLE.reported;
  const latest = (await getVideos().catch(() => []))[0] ?? null;
  const receiptHref = story.joshReceipt?.ytId
    ? `https://www.youtube.com/watch?v=${story.joshReceipt.ytId}&t=${story.joshReceipt.tsSeconds ?? 0}s`
    : null;

  const storyUrl = `https://thepatestate.com/wire/${story.slug.current}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: story.headline,
      description: story.whatHappened?.slice(0, 300),
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

  return (
    <main className="v5-lite">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <header className="page-head" style={{ paddingBottom: 18 }}>
        <div className="wrap">
          <p className="crumb">The Pate State / The Wire</p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ background: v.bg, color: "var(--chalk, #F3EFE6)", fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", padding: "4px 10px", borderRadius: 3 }}>
              THE WIRE · {v.label}
            </span>
            {story.teams?.slice(0, 3).map((t) => {
              const logo = teamLogoUrl(t);
              return logo ? (
                <Image key={t} src={logo} alt={t} width={26} height={26} style={{ borderRadius: "50%", background: "#fff", padding: 2 }} />
              ) : null;
            })}
            {story.updatedAt && (
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)" }}>
                Updated {formatDate(story.updatedAt)}
              </span>
            )}
          </div>
          <h1 style={{ maxWidth: 900 }}>{story.headline}</h1>
          <EditorialLabel contentType="News" productionMethod="ai-monitored" />
        </div>
      </header>

      <section style={{ paddingTop: 24 }}>
        <div className="wrap" style={{ maxWidth: 860 }}>
          <h2 className="display" style={{ fontSize: 22 }}>What Happened</h2>
          <p className="lede" style={{ marginTop: 6 }}>{story.whatHappened}</p>

          {story.whyItMatters && story.whyItMatters.length > 0 && (
            <>
              <h2 className="display" style={{ fontSize: 22, marginTop: 28 }}>Why It Matters</h2>
              <ul style={{ marginTop: 8, paddingLeft: 20, display: "grid", gap: 8 }}>
                {story.whyItMatters.map((b, i) => (
                  <li key={i} style={{ fontSize: 16, lineHeight: 1.55 }}>{b}</li>
                ))}
              </ul>
            </>
          )}

          {story.joshReceipt?.quote && (
            <>
              <h2 className="display" style={{ fontSize: 22, marginTop: 28 }}>Josh&apos;s Receipt</h2>
              <div className="pullquote" style={{ marginTop: 8 }}>
                &ldquo;{story.joshReceipt.quote}&rdquo;
                <span className="who">
                  — Josh Pate{receiptHref && (
                    <>
                      {" · "}
                      <a href={receiptHref} target="_blank" rel="noopener" style={{ color: "var(--gold, #E8A33D)" }}>
                        watch the moment →
                      </a>
                    </>
                  )}
                </span>
              </div>
            </>
          )}

          <h2 className="display" style={{ fontSize: 22, marginTop: 28 }}>
            {story.readLabel ?? "THE PATE STATE READ"}
          </h2>
          <p style={{ marginTop: 6, fontSize: 16, lineHeight: 1.6 }}>
            {story.readBody}
            {story.readLabel !== "JOSH'S READ" && (
              <em style={{ display: "block", marginTop: 6, fontSize: 13, color: "var(--ink-dim)" }}>
                (Josh has not yet commented.)
              </em>
            )}
          </p>

          {story.whatsNext && story.whatsNext.length > 0 && (
            <>
              <h2 className="display" style={{ fontSize: 22, marginTop: 28 }}>What&apos;s Next</h2>
              <ul style={{ marginTop: 8, paddingLeft: 20, display: "grid", gap: 6 }}>
                {story.whatsNext.map((w, i) => (
                  <li key={i} style={{ fontSize: 15 }}>{w}</li>
                ))}
              </ul>
            </>
          )}

          <Corrections corrections={story.corrections} />

          <div style={{ marginTop: 32, borderTop: "1px solid var(--line-l)", paddingTop: 16, display: "grid", gap: 8 }}>
            <a
              href={receiptHref ?? (latest ? videoUrl(latest.id) : CHANNEL_URL)}
              target="_blank"
              rel="noopener"
              className="btn gold"
              style={{ justifySelf: "start" }}
            >
              ▶ {receiptHref ? "Watch Josh's take" : "Watch the latest show"}
            </a>
            {/* Source credit lives here — below the article, greyed, small,
                italic (Josh via Isaac, 2026-08-20) — never in the prose. */}
            {story.sources && story.sources.length > 0 && (
              <p style={{ fontSize: 11.5, fontStyle: "italic", color: "var(--ink-dim)", opacity: 0.85 }}>
                Reported by{" "}
                {story.sources.map((s, i) => (
                  <span key={i}>
                    {i > 0 && " · "}
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noopener" style={{ color: "inherit", textDecoration: "underline" }}>
                        {s.outlet ?? "source"}
                      </a>
                    ) : (
                      s.outlet
                    )}
                  </span>
                ))}
              </p>
            )}
            <p style={{ fontSize: 11.5, fontStyle: "italic", color: "var(--ink-dim)", opacity: 0.85 }}>
              Drafted by The Pate State&apos;s Wire Desk AI from the cited sources under the site&apos;s
              verification rules, monitored by an editor — corrections are timestamped, never silent.
            </p>
            <p style={{ fontSize: 14 }}>
              <Link href="/wire" style={{ color: "var(--gold, #E8A33D)" }}>← All wire coverage</Link>
            </p>

            {/* Reading never dead-ends: chain to the next stories on the
                wire (the notebook's scroll-roll pattern lands here once
                story volume supports it). */}
            {(await getWireStories(6).catch(() => []))
              .filter((s) => s.slug.current !== story.slug.current)
              .slice(0, 3)
              .map((s, i) => (
                <Link
                  key={s._id}
                  href={`/wire/${s.slug.current}`}
                  className="upnext-teaser"
                  style={{ textDecoration: "none", color: "inherit", marginTop: i === 0 ? 30 : 18 }}
                >
                  <span className="upnext-kicker">{i === 0 ? "Up Next on the Wire" : "Then"}</span>
                  <b className="upnext-headline" style={{ fontSize: 20 }}>{s.headline}</b>
                </Link>
              ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export async function generateStaticParams() {
  const stories = await getWireStories(20).catch(() => []);
  return stories.map((s) => ({ slug: s.slug.current }));
}
