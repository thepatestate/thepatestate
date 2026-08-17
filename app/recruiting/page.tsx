import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import PreseasonChip from "@/components/PreseasonChip";
import RelTime from "@/components/RelTime";
import { DEMO_MODE } from "@/lib/demo";
import { getRecruitingRankings } from "@/lib/cfbd";
import { getWireItems, getWireStories, type SanityWireItem, type SanityWireStory } from "@/lib/sanity";
import { teamLogoUrl } from "@/lib/teams-meta";

export const metadata: Metadata = {
  title: "Recruiting & Transfer Portal — The Next Wave",
  description: "Recruiting and the portal without the message-board panic: the Pate Index, honest class grades, and Josh's reads.",
  alternates: { canonical: "/recruiting" },
};
// Wire coverage feeds this page now (Sanity fetches revalidate at 120s);
// regenerate every 10 minutes so breaking commitments don't sit stale.
export const revalidate = 600;

// --- Feed assembly ---------------------------------------------------------
// Lead package + feed rows come from the live Wire engine, filtered to the
// recruiting category. Stories (our own written coverage) outrank raw wire
// items; a wire item that already has a full story is deduped in favor of it.

interface FeedEntry {
  id: string;
  kind: "story" | "wire";
  headline: string;
  dek?: string;
  href: string;
  external: boolean;
  publishedAt?: string;
  team?: string;
}

function storyEntry(s: SanityWireStory): FeedEntry {
  return {
    id: s._id,
    kind: "story",
    headline: s.headline,
    dek: s.whatHappened,
    href: `/wire/${s.slug.current}`,
    external: false,
    publishedAt: s.publishedAt,
    team: s.teams?.[0],
  };
}

function itemEntry(it: SanityWireItem): FeedEntry {
  return {
    id: it._id,
    kind: "wire",
    headline: it.headline,
    dek: it.sub,
    href: it.storySlug ? `/wire/${it.storySlug}` : it.sourceUrl ?? "/wire",
    external: !it.storySlug && Boolean(it.sourceUrl),
    publishedAt: it.publishedAt,
    team: it.teams?.[0],
  };
}

function EntryLink({ entry, className, children }: { entry: FeedEntry; className: string; children: React.ReactNode }) {
  return entry.external ? (
    <a className={className} href={entry.href} target="_blank" rel="noopener">{children}</a>
  ) : (
    <Link className={className} href={entry.href}>{children}</Link>
  );
}

// --- DEMO_MODE placeholders (§0.1: never render in production) -------------
// Invented names/teams from the mockup comp, shown only when DEMO_MODE is on
// and the matching live feed is dry, so the full layout stays reviewable.

const DEMO_TICKER = [
  { st: "4★", who: "QB J. Caldwell", to: "georgia", tm: "2h" },
  { st: "5★", who: "EDGE M. Okafor", to: "ohio-state", tm: "5h" },
  { st: "4★", who: "WR T. Brooks", from: "tennessee", to: "ole-miss", tm: "Flip · 1d" },
  { st: "4★", who: "OT D. Reyes", to: "texas", tm: "1d" },
  { st: "3★", who: "CB K. Whitfield", to: "lsu", tm: "2d" },
] as const;

const DEMO_CLASS_BOARD = [
  { rk: 1, slug: "georgia", team: "Georgia", n: "19 commits · 3 × 5★" },
  { rk: 2, slug: "texas", team: "Texas", n: "17 commits · 2 × 5★" },
  { rk: 3, slug: "ohio-state", team: "Ohio State", n: "15 commits · 2 × 5★" },
  { rk: 4, slug: "alabama", team: "Alabama", n: "18 commits · 1 × 5★" },
  { rk: 5, slug: "oregon", team: "Oregon", n: "14 commits · 2 × 5★" },
  { rk: 6, slug: "lsu", team: "LSU", n: "16 commits" },
  { rk: 7, slug: "miami", team: "Miami", n: "15 commits" },
  { rk: 8, slug: "notre-dame", team: "Notre Dame", n: "13 commits" },
  { rk: 9, slug: "tennessee", team: "Tennessee", n: "14 commits" },
  { rk: 10, slug: "texas-am", team: "Texas A&M", n: "12 commits" },
] as const;

// Mockup-marked "FLIP WATCH — PLACEHOLDER names": DEMO_MODE only, omitted
// entirely in production.
const DEMO_FLIP_WATCH = [
  { who: "4★ QB T. Brooks", note: "Official visit · Aug 22", from: "tennessee", to: "ole-miss" },
  { who: "4★ WR C. Dunbar", note: "Trending · two visits set", from: "florida-state", to: "georgia" },
  { who: "5★ OT R. Maddox", note: "Recommitted · watch anyway", from: "texas", to: "oklahoma" },
] as const;

const FEED_ART = ["p1", "p4", "p3", "p2", "p5", "p6"] as const;

export default async function RecruitingPage() {
  const [board, allStories, allItems] = await Promise.all([
    getRecruitingRankings().catch(() => null),
    getWireStories(24).catch(() => [] as SanityWireStory[]),
    getWireItems(40).catch(() => [] as SanityWireItem[]),
  ]);

  const stories = allStories.filter((s) => s.category === "recruiting");
  const items = allItems.filter((it) => it.category === "recruiting");
  const storySlugs = new Set(stories.map((s) => s.slug.current));
  const entries: FeedEntry[] = [
    ...stories.map(storyEntry),
    ...items.filter((it) => !it.storySlug || !storySlugs.has(it.storySlug)).map(itemEntry),
  ].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

  const lead = entries[0] ?? null;
  const side = entries.slice(1, 5);
  const feedRows = entries.slice(1 + side.length, 13);
  const leadLogo = lead?.team ? teamLogoUrl(lead.team) : null;

  return (
    <main className="v5 pg-recruiting">
      {/* Commit ticker — live recruiting wire items; demo chips only in DEMO_MODE. */}
      {items.length > 0 ? (
        <div className="ctick"><div className="wrap">
          <span className="lbl">Commit Wire</span>
          {items.slice(0, 6).map((it) => {
            const e = itemEntry(it);
            const logo = e.team ? teamLogoUrl(e.team) : null;
            return (
              <EntryLink key={it._id} entry={e} className="cmt">
                {logo && <Image src={logo} alt="" width={19} height={19} />}
                <span className="who">{it.headline}</span>
                {it.publishedAt && <span className="tm"><RelTime iso={it.publishedAt} short /></span>}
              </EntryLink>
            );
          })}
        </div></div>
      ) : DEMO_MODE ? (
        <div className="ctick"><div className="wrap">
          <span className="lbl">Commit Wire</span>
          {DEMO_TICKER.map((c) => {
            const from = "from" in c && c.from ? teamLogoUrl(c.from) : null;
            const to = teamLogoUrl(c.to);
            return (
              <span className="cmt" key={c.who}>
                <span className="st">{c.st}</span>
                <span className="who">{c.who}</span>
                {from && <Image src={from} alt="" width={19} height={19} />}
                <span className="arr">→</span>
                {to && <Image src={to} alt="" width={19} height={19} />}
                <span className="tm">{c.tm}</span>
              </span>
            );
          })}
        </div></div>
      ) : null}

      {/* Page head */}
      <div className="phead"><div className="wrap">
        <p className="crumb">The Pate State / <b>Recruiting</b></p>
        <h1>Recruiting</h1>
        <p className="sub">
          The commits, the flips, and the portal — with Josh&apos;s read on which classes are actually
          being built to win, not just ranked.
        </p>
        <div className="cats">
          <a className="cat on" href="#feed">Latest</a>
          <a className="cat" href="#class-board">The Class Board</a>
          {board && <a className="cat" href="#full-top-25">Full Top 25</a>}
          <a className="cat" href="#portal">The Portal</a>
          <Link className="cat" href="/wire">The Wire</Link>
          <Link className="cat" href="/teams">Teams</Link>
        </div>
      </div></div>

      {/* Lead package — top recruiting stories from the live Wire */}
      {lead && (
        <section className="leadsec"><div className="wrap">
          <div className="lead-grid">
            <EntryLink entry={lead} className="feat">
              <div className="f-art">
                <span className="tag">Recruiting</span>
                {leadLogo && <Image src={leadLogo} alt="" width={84} height={84} />}
                <div className="rule" />
              </div>
              <div className="tx">
                <span className="k">Recruiting · {lead.kind === "story" ? "Full Story" : "The Wire"}</span>
                <h2>{lead.headline}</h2>
                {lead.dek && <p className="dek">{lead.dek}</p>}
                <span className="by">The Wire Desk{lead.publishedAt && <> · <RelTime iso={lead.publishedAt} short /></>}</span>
              </div>
            </EntryLink>
            {side.length > 0 && (
              <div className="side">
                <span className="sh">Also New</span>
                {side.map((e) => {
                  const logo = e.team ? teamLogoUrl(e.team) : null;
                  return (
                    <EntryLink key={e.id} entry={e} className="srow">
                      <span className="im">{logo && <Image src={logo} alt="" width={32} height={32} />}</span>
                      <div>
                        <span className="t">{e.kind === "story" ? "Recruiting · Full Story" : "Recruiting · The Wire"}</span>
                        <h4>{e.headline}</h4>
                        <span className="by">The Wire Desk{e.publishedAt && <> · <RelTime iso={e.publishedAt} short /></>}</span>
                      </div>
                    </EntryLink>
                  );
                })}
              </div>
            )}
          </div>
        </div></section>
      )}

      {/* Feed + rail */}
      <section className="feedsec" id="feed"><div className="wrap">
        <div className="feed-grid">
          <div>
            <div className="fh">
              <h3>Latest</h3>
              {lead?.publishedAt && <span className="live">Live · Updated <RelTime iso={lead.publishedAt} /></span>}
              <div className="ln" />
            </div>
            {entries.length === 0 ? (
              <EmptyState
                kicker="VERIFIED NEWS ONLY"
                title="Recruiting news flows in from the Wire"
                body="Commitments, decommitments, flips, and portal moves — sourced and attributed, never message-board rumors. Coverage stacks up here as the cycle heats up."
                cta={{ href: "/wire", label: "Read the Wire →" }}
              />
            ) : (
              <div className="nb-stack">
                {(feedRows.length > 0 ? feedRows : entries.slice(0, 8)).map((e, i) => {
                  const logo = e.team ? teamLogoUrl(e.team) : null;
                  return (
                    <EntryLink key={e.id} entry={e} className="nb-row">
                      <span className={`im ${FEED_ART[i % FEED_ART.length]}`}>
                        {logo && <Image className="chip" src={logo} alt="" width={22} height={22} />}
                      </span>
                      <div>
                        <span className={e.kind === "wire" ? "t is-wire" : "t"}>
                          {e.kind === "story" ? "Recruiting · Full Story" : "⚡ The Wire · Recruiting"}
                          {e.publishedAt && <> · <RelTime iso={e.publishedAt} short /></>}
                        </span>
                        <h4>{e.headline}</h4>
                        {e.dek && <p className="dek">{e.dek}</p>}
                        <span className="by">The Wire Desk</span>
                      </div>
                    </EntryLink>
                  );
                })}
              </div>
            )}
            <Link className="more" href="/wire">More on the Wire →</Link>
          </div>

          <div className="rail">
            {/* Class board — real 247Sports Composite via CFBD, never invented. */}
            <div className="rc" id="class-board">
              <div className="rh">
                <div>
                  <span className="k">{board ? `${board.year} Class Rankings` : "Class Rankings"}</span>
                  <h4>The Class Board</h4>
                </div>
                {board && <span className="yr">{board.year}</span>}
              </div>
              {board ? (<>
                {board.ranks.slice(0, 10).map((t) => (
                  <div className={t.rank <= 5 ? "crow top" : "crow"} key={t.rank}>
                    <span className="rk">{t.rank}</span>
                    {t.logo && <Image src={t.logo} alt="" width={20} height={20} />}
                    <span className="tn">{t.team}</span>
                    <span className="n"><b>{t.points.toFixed(1)}</b> 247 pts</span>
                  </div>
                ))}
                <a className="rf" href="#full-top-25">Full Top 25 ↓</a>
              </>) : DEMO_MODE ? (<>
                <div className="empty-pad" style={{ paddingBottom: 0 }}><PreseasonChip /></div>
                {DEMO_CLASS_BOARD.map((t) => {
                  const logo = teamLogoUrl(t.slug);
                  return (
                    <div className={t.rk <= 5 ? "crow top" : "crow"} key={t.rk}>
                      <span className="rk">{t.rk}</span>
                      {logo && <Image src={logo} alt="" width={20} height={20} />}
                      <span className="tn">{t.team}</span>
                      <span className="n">{t.n}</span>
                    </div>
                  );
                })}
              </>) : (
                <div className="empty-pad">
                  <EmptyState
                    kicker="PULLED NIGHTLY IN SEASON"
                    title="The class board goes live with the data feed"
                    body="Class rankings from the 247Sports Composite, pulled from the live data feed — never invented."
                  />
                </div>
              )}
            </div>

            {/* FLIP WATCH — mockup-marked PLACEHOLDER names: DEMO_MODE only,
                omitted entirely in production. */}
            {DEMO_MODE && (
              <div className="flip">
                <span className="k">🔄 Flip Watch</span>
                <h4>Names to Know This Month</h4>
                <PreseasonChip />
                {DEMO_FLIP_WATCH.map((f) => {
                  const from = teamLogoUrl(f.from);
                  const to = teamLogoUrl(f.to);
                  return (
                    <div className="fr" key={f.who}>
                      <div className="who">{f.who}<span>{f.note}</span></div>
                      <div className="sw">
                        {from && <Image src={from} alt="" width={20} height={20} />}
                        <i>→</i>
                        {to && <Image src={to} alt="" width={20} height={20} />}
                      </div>
                    </div>
                  );
                })}
                <Link className="go" href="/wire">Every Flip, Tracked →</Link>
              </div>
            )}
          </div>
        </div>
      </div></section>

      {/* Full top 25 — the complete real board the rail links to */}
      {board && (
        <section className="fullrank" id="full-top-25"><div className="wrap">
          <p className="fh2">The Full Top 25 — Class of {board.year}</p>
          <table className="rank-table">
            <thead>
              <tr><th>RK</th><th>Team</th><th>Conference</th><th style={{ textAlign: "right" }}>247 PTS</th></tr>
            </thead>
            <tbody>
              {board.ranks.map((r) => (
                <tr key={r.rank}>
                  <td className="rk">{String(r.rank).padStart(2, "0")}</td>
                  <td>
                    <span className="tcell">
                      {r.logo && <Image src={r.logo} alt="" width={22} height={22} style={{ objectFit: "contain" }} />}
                      {r.team}
                    </span>
                  </td>
                  <td className="conf">{r.conference || "—"}</td>
                  <td className="pts">{r.points.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="srcline">
            Source: 247Sports Composite team rankings via the live data feed · On3/Rivals merge into the
            index with the 2027 cycle.
          </p>
        </div></section>
      )}

      {/* The Portal — honest structural copy + links only; no invented names. */}
      <section className="portal" id="portal"><div className="wrap">
        <div className="p-head">
          <span className="eb">Transfers</span>
          <h3>The Portal Never Really Closes</h3>
          <Link href="/wire">All Portal Moves →</Link>
        </div>
        <div className="pgrid">
          <Link className="pitem" href="/wire">
            <span className="tm">The Wire</span>
            <h5>Portal entries and commitments land on the Wire the minute they&apos;re confirmed — sourced and attributed, never message-board rumors.</h5>
            <span className="pgo">Open the Wire →</span>
          </Link>
          <Link className="pitem" href="/teams">
            <span className="tm">Team Pages</span>
            <h5>Every departure and arrival is logged on your team&apos;s page, next to the schedule and the class it changes.</h5>
            <span className="pgo">Find Your Team →</span>
          </Link>
          <Link className="pitem" href="/show">
            <span className="tm">The Show</span>
            <h5>Josh&apos;s portal reads run all cycle long — who actually needed the help, and which fits he doesn&apos;t buy.</h5>
            <span className="pgo">Watch the Show →</span>
          </Link>
          <Link className="pitem" href="/community">
            <span className="tm">The Porch</span>
            <h5>Argue the fits with the rest of the porch — the portal conversation never sleeps in the community boards.</h5>
            <span className="pgo">Pull Up a Chair →</span>
          </Link>
        </div>
      </div></section>

      {/* Citizens line */}
      <section className="cit"><div className="wrap">
        <div className="row">
          <div>
            <div className="k">More for Citizens</div>
            <p>Recruiting intel lands in <b>the Playbook every weekday morning</b> — what changed overnight, in Josh&apos;s voice, by 6 AM.</p>
          </div>
          <Link className="go" href="/join">Send Me the Playbook →</Link>
        </div>
      </div></section>
    </main>
  );
}
