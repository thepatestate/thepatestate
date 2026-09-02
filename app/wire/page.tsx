import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getWireItems, getWireStories } from "@/lib/sanity";
import { teamLogoUrl } from "@/lib/teams-meta";
import { getTeamDirectory } from "@/lib/cfbd";
import { formatDate } from "@/lib/format";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "The Wire — Breaking College Football News",
  description:
    "Every move in the sport, the minute it breaks — and what it actually means for your team. The feed the Quad runs on.",
};

export default async function WirePage() {
  const [items, stories, dir] = await Promise.all([
    getWireItems(30).catch(() => []),
    getWireStories(12).catch(() => []),
    getTeamDirectory().catch(() => ({}) as Awaited<ReturnType<typeof getTeamDirectory>>),
  ]);

  return (
    <main className="v5-lite">
      <header className="page-head" style={{ paddingBottom: 18 }}>
        <div className="wrap">
          <p className="crumb">The Pate State / The Wire</p>
          <h1>The Wire</h1>
          <p className="lede" style={{ maxWidth: 640 }}>
            Know it before the group chat does. Every move in the sport lands here the minute it breaks —
            coaching dominoes, portal bombs, recruiting flips — with what it actually means for your
            Saturday. This is the feed the Quad runs on.
          </p>
        </div>
      </header>

      <section style={{ paddingTop: 24 }}>
        <div className="wrap">
          {stories.length > 0 && (
            <>
              <p className="eyebrow">Full Stories</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14, marginTop: 10, marginBottom: 34 }}>
                {stories.map((s) => {
                  const team = s.teams?.[0];
                  const info = team ? dir[team] : undefined;
                  const logo = team ? (info?.logo ?? teamLogoUrl(team)) : null;
                  const color = info?.color ? `#${info.color.replace(/^#/, "")}` : "#1A2C55";
                  return (
                  <Link key={s._id} href={`/wire/${s.slug.current}`} className="panel wire-card" style={{ textDecoration: "none", padding: 0, display: "grid", gap: 8, alignContent: "start", overflow: "hidden" }}>
                    {/* Every story carries an AI illustration (2026-09-02); the
                        team logo on a tinted field is the fallback. */}
                    {s.heroUrl ? (
                      <img className="wire-card-img" src={s.heroUrl} alt="" width={1152} height={640} loading="lazy" style={{ width: "100%", height: "auto", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                    ) : (
                      <span className="wire-card-img" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", aspectRatio: "16/9", background: `radial-gradient(420px 220px at 70% 12%, ${color}66, transparent 58%), linear-gradient(140deg, ${color}40 0%, #0A1730 62%, #1A2C55 100%)` }}>
                        {logo && <img src={logo} alt="" width={72} height={72} style={{ width: 72, height: 72, objectFit: "contain", filter: "drop-shadow(0 10px 30px rgba(0,0,0,.5))" }} />}
                      </span>
                    )}
                    <span style={{ display: "grid", gap: 8, padding: "10px 16px 16px" }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".08em", color: "var(--lamp-deep)" }}>
                      {(s.verification ?? "reported").toUpperCase()} · {s.category?.toUpperCase() ?? "NEWS"}
                      {s.publishedAt ? ` · ${formatDate(s.publishedAt)}` : ""}
                    </span>
                    <b className="display" style={{ fontSize: 19, lineHeight: 1.15 }}>{s.headline}</b>
                    <span style={{ fontSize: 14, color: "var(--ink-dim)", lineHeight: 1.5 }}>
                      {(s.deck ?? s.whatHappened ?? "").slice(0, 120)}…
                    </span>
                    </span>
                  </Link>
                  );
                })}
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
                    {it.storyHero ? (
                      <img src={it.storyHero} alt="" width={96} height={54} loading="lazy" style={{ width: 96, height: 54, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                    ) : logo && <Image src={logo} alt="" width={34} height={34} style={{ borderRadius: "50%", background: "#fff", padding: 3, flexShrink: 0 }} />}
                    <div style={{ display: "grid", gap: 3 }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".08em", color: "var(--lamp-deep)" }}>
                        {it.category?.toUpperCase() ?? "NEWS"}
                        {it.publishedAt ? ` · ${formatDate(it.publishedAt)}` : ""}
                        {it.storySlug ? " · ⚡ FULL STORY" : ""}
                      </span>
                      <b style={{ fontSize: 16, lineHeight: 1.3 }}>{it.headline}</b>
                      {it.sub && <span style={{ fontSize: 14, color: "var(--ink-dim)" }}>{it.sub}</span>}
                      {/* Wire list surfaces never link off-site (Josh,
                          2026-08-19): storyless items carry a plain-text
                          credit; linked citations live inside full stories. */}
                      {!it.storySlug && it.sourceOutlet && (
                        <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".08em", color: "var(--lamp-deep)" }}>
                          VIA {it.sourceOutlet.toUpperCase()}
                        </span>
                      )}
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
