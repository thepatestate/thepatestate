import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleBySlug } from "@/lib/sanity";
import ArticleBody from "@/components/ArticleBody";
import { CHANNEL_URL, SOCIAL_LINKS } from "@/lib/youtube";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};

  const title = article.seoTitle || article.headline;
  const description = article.seoDescription || article.dek;
  // Prefer the article's own generated hero; fall back to the episode's
  // YouTube thumbnail. If neither exists, leave openGraph/twitter unset so
  // the route inherits the site-wide app/opengraph-image.tsx + twitter-image.tsx.
  const imageUrl = article.heroUrl || article.episode?.thumbnailUrl || null;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      ...(imageUrl ? { images: [{ url: imageUrl, width: 1200, height: 630, alt: article.headline }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const teamHref = article.primaryTeam === "georgia" ? "/teams/georgia" : "/teams";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.headline,
    datePublished: article.publishedAt,
    author: { "@type": "Person", name: article.byline },
  };

  const videoJsonLd = article.episode
    ? {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: article.episode.title,
        description: article.episode.description || article.dek || article.episode.title,
        thumbnailUrl: article.episode.thumbnailUrl ? [article.episode.thumbnailUrl] : undefined,
        uploadDate: article.episode.publishedAt,
        embedUrl: `https://www.youtube-nocookie.com/embed/${article.episode.ytId}`,
      }
    : null;

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {videoJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd).replace(/</g, "\\u003c") }}
        />
      )}

      <div className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / The Notebook</p>
        </div>
      </div>

      <section style={{ paddingTop: 36 }}>
        <div className="wrap">
          <div className="story-grid">
            <article className="story">
              {article.heroUrl && (
                <Image
                  src={article.heroUrl}
                  alt={article.headline}
                  width={1152}
                  height={640}
                  priority
                  sizes="(max-width: 960px) 100vw, 820px"
                  className="cover-img"
                  style={{ marginBottom: 20 }}
                />
              )}
              <h1>{article.headline}</h1>
              {article.dek && <p className="dek">{article.dek}</p>}

              <ArticleBody article={article} />

              {article.episode && (
                <a
                  className="videobox"
                  href={`https://www.youtube.com/watch?v=${article.episode.ytId}`}
                  target="_blank"
                  rel="noopener"
                  style={{ textDecoration: "none" }}
                >
                  <div className="vthumb">
                    <span className="playbtn" style={{ position: "static", width: 44, height: 44 }} aria-hidden="true">
                      ▶
                    </span>
                  </div>
                  <div>
                    <h4>Watch the Full Episode</h4>
                    <div className="meta">{article.episode.title}</div>
                  </div>
                </a>
              )}

              <p style={{ marginTop: 20, opacity: 0.55, fontSize: 12.5, lineHeight: 1.5 }}>
                Articles are drafted from Josh Pate&apos;s College Football Show and reviewed before publishing.
              </p>
            </article>

            <aside className="aside-sticky">
              <div className="aside-card">
                <h4>Keep Exploring</h4>
                <Link
                  className="btn"
                  href="/poll"
                  style={{ width: "100%", textAlign: "center", display: "block", marginBottom: 10 }}
                >
                  See the Full JP Poll
                </Link>
                <Link className="btn" href={teamHref} style={{ width: "100%", textAlign: "center", display: "block" }}>
                  {article.primaryTeam === "georgia" ? "Georgia's Team Page" : "Browse All Teams"}
                </Link>
              </div>

              <div className="aside-card" style={{ marginTop: 16 }}>
                <h4>Follow the Porch</h4>
                <div className="on-light">
                  <div className="platforms">
                    <a className="chip" href={CHANNEL_URL} target="_blank" rel="noopener">YouTube</a>
                    <a className="chip" href={SOCIAL_LINKS.x} target="_blank" rel="noopener">𝕏 X</a>
                    <a className="chip" href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener">Instagram</a>
                    <a className="chip" href={SOCIAL_LINKS.tiktok} target="_blank" rel="noopener">TikTok</a>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
