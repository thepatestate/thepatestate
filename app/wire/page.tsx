import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getWireItems, getWireStories } from "@/lib/sanity";
import { teamLogoUrl } from "@/lib/teams-meta";
import { formatDate } from "@/lib/format";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "The Wire — Breaking College Football News",
  description: "What just happened in the sport, with the football consequences — verified, attributed, and fast.",
};

export default async function WirePage() {
  const [items, stories] = await Promise.all([
    getWireItems(30).catch(() => []),
    getWireStories(12).catch(() => []),
  ]);

  return (
    <main>
      <header className="page-head" style={{ paddingBottom: 18 }}>
        <div className="wrap">
          <p className="crumb">The Pate State / The Wire</p>
          <h1>The Wire</h1>
          <p className="lede" style={{ maxWidth: 640 }}>
            Don&apos;t just read what happened — read what changed because it happened. Drafted by the Wire
            Desk from cited sources, verified before publish, receipts from Josh&apos;s own archive.
          </p>
        </div>
      </header>

      <section style={{ paddingTop: 24 }}>
        <div className="wrap">
          {stories.length > 0 && (
            <>
              <p className="eyebrow">Full Stories</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14, marginTop: 10, marginBottom: 34 }}>
                {stories.map((s) => (
                  <Link key={s._id} href={`/wire/${s.slug.current}`} className="panel" style={{ textDecoration: "none", padding: 16, display: "grid", gap: 8, alignContent: "start" }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".08em", color: "var(--gold, #B8842C)" }}>
                      {(s.verification ?? "reported").toUpperCase()} · {s.category?.toUpperCase() ?? "NEWS"}
                      {s.publishedAt ? ` · ${formatDate(s.publishedAt)}` : ""}
                    </span>
                    <b className="display" style={{ fontSize: 19, lineHeight: 1.15 }}>{s.headline}</b>
                    <span style={{ fontSize: 14, color: "var(--ink-dim)", lineHeight: 1.5 }}>
                      {s.whatHappened?.slice(0, 120)}…
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}

          <p className="eyebrow">Every Item</p>
          {items.length === 0 ? (
            <p style={{ marginTop: 10, color: "var(--ink-dim)" }}>
              The Wire is warming up — items land here the moment the monitors catch real news.
            </p>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 0 }}>
              {items.map((it) => {
                const logo = it.teams?.[0] ? teamLogoUrl(it.teams[0]) : null;
                const inner = (
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 0", borderBottom: "1px solid var(--line-l)" }}>
                    {logo && <Image src={logo} alt="" width={34} height={34} style={{ borderRadius: "50%", background: "#fff", padding: 3, flexShrink: 0 }} />}
                    <div style={{ display: "grid", gap: 3 }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".08em", color: "var(--gold, #B8842C)" }}>
                        {it.category?.toUpperCase() ?? "NEWS"}
                        {it.publishedAt ? ` · ${formatDate(it.publishedAt)}` : ""}
                        {it.storySlug ? " · ⚡ FULL STORY" : ""}
                      </span>
                      <b style={{ fontSize: 16, lineHeight: 1.3 }}>{it.headline}</b>
                      {it.sub && <span style={{ fontSize: 14, color: "var(--ink-dim)" }}>{it.sub}</span>}
                    </div>
                  </div>
                );
                return it.storySlug ? (
                  <Link key={it._id} href={`/wire/${it.storySlug}`} style={{ textDecoration: "none", color: "inherit" }}>{inner}</Link>
                ) : (
                  <div key={it._id}>{inner}</div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
