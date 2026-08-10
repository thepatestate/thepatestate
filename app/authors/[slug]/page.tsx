import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedArticles } from "@/lib/sanity";
import { formatDate } from "@/lib/format";
import { CHANNEL_URL, SOCIAL_LINKS } from "@/lib/youtube";
import { SITE_URL } from "@/lib/site";

// Author pages (v2 brief §8): every article links its author; each author
// entity gets a real page with structured data. Two authors exist today —
// Josh and the staff desk. Contributors get added here as they're hired.

const AUTHORS = {
  "josh-pate": {
    name: "Josh Pate",
    type: "Person" as const,
    role: "Host, Josh Pate's College Football Show",
    bio: "Josh Pate hosts Josh Pate's College Football Show — daily college football analysis watched by half a million subscribers — and appears across ESPN's college football coverage. The Pate State is his written home: every ranking, every pick, and every take, logged and kept.",
    matches: (byline: string) => /josh pate/i.test(byline),
  },
  "the-pate-state-staff": {
    name: "The Pate State Staff",
    type: "Organization" as const,
    role: "The editorial desk",
    bio: "The Pate State Staff byline covers the site's editorial desk: companion stories drafted from the show's transcripts with Pate State AI, then reviewed before publishing. Every direct quote is machine-verified verbatim against the transcript and linked to its timestamp. How that works — and the rules the system enforces — is documented on the Standards page.",
    matches: (byline: string) => !/josh pate/i.test(byline),
  },
} as const;

type Slug = keyof typeof AUTHORS;

export function generateStaticParams() {
  return Object.keys(AUTHORS).map((slug) => ({ slug }));
}

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const author = AUTHORS[slug as Slug];
  if (!author) return {};
  return {
    title: `${author.name} — Author`,
    description: author.bio.slice(0, 155),
    alternates: { canonical: `/authors/${slug}` },
  };
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const author = AUTHORS[slug as Slug];
  if (!author) notFound();

  const articles = (await getPublishedArticles(50).catch(() => [])).filter((a) => author.matches(a.byline));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": author.type,
    "@id": `${SITE_URL}/authors/${slug}#${author.type === "Person" ? "person" : "org"}`,
    name: author.name,
    url: `${SITE_URL}/authors/${slug}`,
    description: author.bio,
    ...(author.type === "Person"
      ? {
          jobTitle: author.role,
          sameAs: [CHANNEL_URL, SOCIAL_LINKS.x, SOCIAL_LINKS.instagram, SOCIAL_LINKS.tiktok],
        }
      : { parentOrganization: { "@type": "Organization", name: "The Pate State", url: SITE_URL } }),
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Authors / {author.name}</p>
          <h1>{author.name}</h1>
          <p className="lede">{author.role}</p>
        </div>
      </header>
      <section>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 16, lineHeight: 1.65 }}>{author.bio}</p>
          {slug === "the-pate-state-staff" && (
            <p style={{ marginTop: 12, fontFamily: "var(--mono)", fontSize: 12 }}>
              <Link href="/standards" style={{ color: "var(--lamp-deep)" }}>Read the editorial standards →</Link>
            </p>
          )}
          <div style={{ marginTop: 34 }}>
            <p className="eyebrow">Stories by {author.name}</p>
            {articles.length === 0 && (
              <p style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink-dim)", marginTop: 10 }}>
                Published stories appear here — the archive grows every weekday.
              </p>
            )}
            {articles.map((a) => (
              <div key={a._id} style={{ padding: "12px 0", borderBottom: "1px solid var(--line-l)" }}>
                <Link href={`/notebook/${a.slug.current}`} style={{ fontWeight: 700, fontSize: 17, color: "inherit", textDecoration: "none" }}>
                  {a.headline}
                </Link>
                <span style={{ display: "block", fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)", marginTop: 4 }}>
                  {a.publishedAt ? `Published ${formatDate(a.publishedAt)}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
