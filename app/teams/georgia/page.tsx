import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PreseasonChip from "@/components/PreseasonChip";

export const metadata: Metadata = { title: "Georgia — Team Page" };

// --- Preseason-preview sample data ---------------------------------------
// This route is the template the future 136 team pages generalize from —
// every section below is broken into its own component, keyed off a plain
// data object, so parameterizing by team later is mechanical: swap
// GEORGIA for a per-team record fetched by slug and the components don't
// change. Note: the wireframe (team-georgia.html) has no distinct
// "schedule" section — only rank history, Josh's picks record, recruiting,
// the tailgate guide, and articles — so PicksRecord below stands in for
// what the task brief calls "schedule."

const GEORGIA = {
  name: "Georgia",
  stadium: "Sanford Stadium",
  city: "Athens",
  rankHistory: [
    { wk: "1", jp: "01", ap: "1", cfp: "—" },
    { wk: "PRE", jp: "02", ap: "2", cfp: "—" },
  ],
  picksRecord: { ats: "—", atsLabel: "ATS Last 13", current: "—", currentLabel: "Current" },
  recruiting: {
    rank: "No. 13",
    body: "20 commits, two five-stars — including the nation's No. 10 overall, RB Kemon Spell. Quiet cycle by Athens standards, which usually means a December surge.",
  },
  tailgate: {
    body: "Between the Hedges, the Dawg Walk, and where to eat on Milledge — the citizens' complete gameday plan.",
  },
  articles: [
    {
      kick: "THE MONDAY COLUMN", title: "Georgia's Margin for Error Is a Myth", meta: "JOSH PATE · 6 MIN", href: null, navy: true,
      photo: "/img/editorial-turf.jpg", alt: "Frosted turf and a yard line at dawn",
    },
    {
      kick: "POLL DAY", title: "Why the Citizens Kept the Dawgs at No. 1", meta: "TUESDAY", href: "/notebook", navy: false,
      photo: "/img/editorial-goalpost.jpg", alt: "A goalpost silhouetted in fog against the sunrise",
    },
  ],
} as const;

type Team = typeof GEORGIA;

function RankHistory({ team }: { team: Team }) {
  return (
    <div>
      <p className="eyebrow">In the JP Poll</p>
      <table style={{ marginTop: 12 }}>
        <thead><tr><th>WK</th><th>JP</th><th>AP</th><th>CFP</th></tr></thead>
        <tbody>
          {team.rankHistory.map((r) => (
            <tr key={r.wk}>
              <td>{r.wk}</td>
              <td className="rk">{r.jp}</td>
              <td>{r.ap}</td>
              <td>{r.cfp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PicksRecord({ team }: { team: Team }) {
  const { picksRecord } = team;
  return (
    <div>
      <p className="eyebrow" style={{ marginTop: 28 }}>Josh&apos;s Record Picking {team.name}</p>
      <div className="record" style={{ margin: "12px 0 0" }}>
        <div className="stat">
          <div className="num">{picksRecord.ats}</div>
          <div className="lbl">{picksRecord.atsLabel}</div>
        </div>
        <div className="stat">
          <div className="num">{picksRecord.current}</div>
          <div className="lbl">{picksRecord.currentLabel}</div>
        </div>
      </div>
      <p style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)" }}>
        Records start accruing Week 1 — every pick sourced and receipts kept.
      </p>
    </div>
  );
}

function RecruitingClass({ team }: { team: Team }) {
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <p className="eyebrow">The 2027 Class</p>
      <h3>Pate Index: {team.recruiting.rank}</h3>
      <p>{team.recruiting.body}</p>
      <Link className="btn" href="/recruiting" style={{ borderColor: "var(--navy)", color: "var(--navy)" }}>
        Full Recruiting Index
      </Link>
    </div>
  );
}

function TailgateGuide({ team }: { team: Team }) {
  return (
    <div className="panel">
      <p className="eyebrow">Do {team.city} Right</p>
      <h3>{team.stadium} Guide</h3>
      <p>{team.tailgate.body}</p>
      <Link className="btn" href="/tailgate" style={{ borderColor: "var(--navy)", color: "var(--navy)" }}>
        Open the Guide
      </Link>
    </div>
  );
}

function LatestArticles({ team }: { team: Team }) {
  return (
    <div>
      <p className="eyebrow">Latest From the Porch on {team.name}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 760, marginTop: 12 }}>
        {team.articles.map((a) =>
          a.href ? (
            <Link className="art" href={a.href} key={a.title}>
              <div className={a.navy ? "art-thumb navy" : "art-thumb"}>
                <Image src={a.photo} alt={a.alt} fill sizes="104px" style={{ objectFit: "cover" }} />
              </div>
              <div className="art-body">
                <span className="kick">{a.kick}</span>
                <h4>{a.title}</h4>
                <span className="meta">{a.meta}</span>
              </div>
            </Link>
          ) : (
            <div className="art" key={a.title}>
              <div className={a.navy ? "art-thumb navy" : "art-thumb"}>
                <Image src={a.photo} alt={a.alt} fill sizes="104px" style={{ objectFit: "cover" }} />
              </div>
              <div className="art-body">
                <span className="kick">{a.kick}</span>
                <h4>{a.title}</h4>
                <span className="meta">{a.meta}</span>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function GeorgiaTeamPage() {
  const team = GEORGIA;
  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Teams / Georgia</p>
          <h1>{team.name}</h1>
          <p className="lede">
            The Bulldogs in the Pate State: where the citizens rank them, how Josh has picked them, and how to do a
            Saturday in Athens right.
          </p>
          <PreseasonChip />
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="duo">
            <div>
              <RankHistory team={team} />
              <PicksRecord team={team} />
            </div>
            <div>
              <RecruitingClass team={team} />
              <TailgateGuide team={team} />
            </div>
          </div>
        </div>
      </section>

      <section className="on-soft tight">
        <div className="wrap">
          <LatestArticles team={team} />
        </div>
      </section>

      <div className="cta-band">
        <div className="wrap row">
          <div>
            <h3>Who&apos;s In? See the Playoff Picture.</h3>
            <p>THE BRACKET, THE RANKINGS, JOSH&apos;S PICKS — AND AN AI TO RUN YOUR OWN</p>
          </div>
          <Link className="btn" href="/playoffs" style={{ borderColor: "var(--lamp)", color: "var(--lamp)" }}>
            Open the Playoffs Page →
          </Link>
        </div>
      </div>
    </main>
  );
}
