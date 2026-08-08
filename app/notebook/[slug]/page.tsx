import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleBySlug } from "@/lib/sanity";
import ArticleBody from "@/components/ArticleBody";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};
  return {
    title: article.seoTitle || article.headline,
    description: article.seoDescription || article.dek,
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

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <div className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / The Notebook</p>
        </div>
      </div>

      <section style={{ paddingTop: 36 }}>
        <div className="wrap">
          <div className="story-grid">
            <article className="story">
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
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
