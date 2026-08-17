import type { Metadata } from "next";
import Link from "next/link";
import { searchSite } from "@/lib/search";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Search",
  description: "Search The Pate State — articles, wire coverage, episodes, and what Josh has actually said, with timestamps.",
  alternates: { canonical: "/search" },
  robots: { index: false },
};

// Search results are per-query — never cached statically.
export const dynamic = "force-dynamic";

function fmtTs(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const results = q ? await searchSite(q) : null;
  const total = results
    ? results.articles.length + results.wireStories.length + results.episodes.length + results.quotes.length
    : 0;

  return (
    <main className="v5-lite">
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Search</p>
          <h1>Search the State</h1>
          <p className="lede">Articles, wire coverage, episodes — and what Josh has actually said, timestamped.</p>
          <form action="/search" method="get" className="search-form" role="search">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Try a team, a coach, a topic…"
              aria-label="Search query"
              autoFocus
            />
            <button className="btn gold" type="submit">Search</button>
          </form>
        </div>
      </header>

      <section>
        <div className="wrap" style={{ maxWidth: 860 }}>
          {!q && (
            <p style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink-dim)" }}>
              Search covers the Notebook, the Wire, the show archive, and the quote archive — more surfaces (teams,
              community threads, recruiting) join as they launch.
            </p>
          )}
          {q && total === 0 && (
            <p style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink-dim)" }}>
              Nothing found for &ldquo;{q}&rdquo; yet — the archive grows every day.
            </p>
          )}

          {results && results.quotes.length > 0 && (
            <div style={{ marginBottom: 34 }}>
              <p className="eyebrow">Josh, On the Record</p>
              {results.quotes.map((r) => (
                <blockquote key={`${r.ytId}-${r.tsSeconds}`} style={{ borderLeft: "3px solid var(--lamp-deep)", margin: "14px 0", padding: "4px 0 4px 14px" }}>
                  <p style={{ fontStyle: "italic", fontSize: 16 }}>&ldquo;{r.quote}&rdquo;</p>
                  <footer style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)", marginTop: 6 }}>
                    — Josh Pate ·{" "}
                    <a
                      href={`https://www.youtube.com/watch?v=${r.ytId}&t=${r.tsSeconds}s`}
                      target="_blank"
                      rel="noopener"
                      style={{ color: "var(--lamp-deep)" }}
                    >
                      watch the moment ({fmtTs(r.tsSeconds)})
                    </a>{" "}
                    · {r.topic.toUpperCase()}
                  </footer>
                </blockquote>
              ))}
            </div>
          )}

          {results && results.articles.length > 0 && (
            <div style={{ marginBottom: 34 }}>
              <p className="eyebrow">From the Notebook</p>
              {results.articles.map((a) => (
                <div key={a.slug} style={{ padding: "12px 0", borderBottom: "1px solid var(--line-l)" }}>
                  <Link href={`/notebook/${a.slug}`} style={{ fontWeight: 700, fontSize: 17, color: "inherit", textDecoration: "none" }}>
                    {a.headline}
                  </Link>
                  {a.dek && <p style={{ fontSize: 14, color: "var(--ink-dim)", marginTop: 4 }}>{a.dek}</p>}
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)" }}>
                    {a.byline.toUpperCase()}
                    {a.publishedAt ? ` · ${formatDate(a.publishedAt)}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}

          {results && results.wireStories.length > 0 && (
            <div style={{ marginBottom: 34 }}>
              <p className="eyebrow">From the Wire</p>
              {results.wireStories.map((w) => (
                <div key={w.slug} style={{ padding: "12px 0", borderBottom: "1px solid var(--line-l)" }}>
                  <Link href={`/wire/${w.slug}`} style={{ fontWeight: 700, fontSize: 16, color: "inherit", textDecoration: "none" }}>
                    {w.headline}
                  </Link>
                  <span style={{ display: "block", fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)", marginTop: 4 }}>
                    {(w.category ?? "news").toUpperCase()}
                    {w.publishedAt ? ` · ${formatDate(w.publishedAt)}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}

          {results && results.episodes.length > 0 && (
            <div style={{ marginBottom: 34 }}>
              <p className="eyebrow">From the Show</p>
              {results.episodes.map((e) => (
                <div key={e.ytId} style={{ padding: "12px 0", borderBottom: "1px solid var(--line-l)" }}>
                  <a
                    href={`https://www.youtube.com/watch?v=${e.ytId}`}
                    target="_blank"
                    rel="noopener"
                    style={{ fontWeight: 700, fontSize: 16, color: "inherit", textDecoration: "none" }}
                  >
                    ▶ {e.title}
                  </a>
                  {e.publishedAt && (
                    <span style={{ display: "block", fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)", marginTop: 4 }}>
                      {formatDate(e.publishedAt)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
