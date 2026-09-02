import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { DEMO_MODE } from "@/lib/demo";
import {
  getCompetitions,
  getEntryCount,
  getLeaderboard,
  compLocked,
  type Competition,
  type PickemGame,
  type PlayEntry,
} from "@/lib/play";
import { teamLogoUrl } from "@/lib/teams-meta";
import { JOSH_BRACKET_ARTICLE, JOSH_BRACKET_LABEL, joshBracketRounds } from "@/lib/josh-bracket";
import TourneyBracket from "@/components/TourneyBracket";
import { championOf } from "@/lib/bracket-rounds";

export const metadata: Metadata = {
  title: "Play — Games & Competitions",
  description:
    "The Pate State games hub: Week 1 Pick'Em, the Playoff Challenge, and the competitions arriving through the season. Free forever.",
  alternates: { canonical: "/play" },
  // Thin hub until more of the roadmap ships (v2 brief §4.6 indexing
  // standard) — lift this once several competitions have run.
  robots: { index: false },
};

// /play — the games hub, rebuilt to wireframes/v3/play.html (Task 7).
// Live competition-engine data everywhere (§0.1): real games from the
// pick'em competition config, real entry counts, real leaderboard rows.
// "Josh vs. The Pros" carries fictional records from the mockup, so it
// renders ONLY under DEMO_MODE — lib/score-play.ts exposes no pundit
// record source (pure scoring functions only).

const TYPE_BLURBS: Record<string, string> = {
  pickem:
    "Ten marquee games, straight up, weighted by how sure you are — confidence 1 to 10, each used once. One lock, receipts kept all season.",
  bracket:
    "Call the 12-team field, seed it, crown your champion. +10 for every team that makes the real field, +25 per exact seed, +100 if your champ wins it all.",
};

function lockLabel(iso: string): string {
  const d = new Date(iso);
  const day = d
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" })
    .replace(/,/g, "")
    .toUpperCase();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  return `${day} · ${time} ET`;
}

function kickLabel(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "America/New_York" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  return `${day} · ${time} ET`;
}

// --- DEMO_MODE-only pundit board (fictional records/picks from the mockup;
// lib/score-play.ts has no real pundit-record source, so production omits
// the section entirely) --------------------------------------------------
const DEMO_PROS: {
  rk: string;
  name: string;
  aff: string;
  rec: string;
  josh?: boolean;
  picks: string[];
}[] = [
  { rk: "🎙", name: "Josh Pate", aff: "The Pate State", rec: "131–49", josh: true, picks: ["georgia", "oklahoma", "notre-dame", "lsu", "ohio-state", "alabama", "oregon", "tennessee", "texas-tech", "miami"] },
  { rk: "1", name: 'Chris "The Bear" Fallica', aff: "FOX · Top Pro", rec: "129–51", picks: ["georgia", "michigan", "notre-dame", "lsu", "ohio-state", "florida-state", "oregon", "tennessee", "byu", "miami"] },
  { rk: "2", name: "Joel Klatt", aff: "FOX", rec: "127–53", picks: ["clemson", "oklahoma", "texas-am", "lsu", "ohio-state", "alabama", "oregon", "tennessee", "texas-tech", "wisconsin"] },
  { rk: "3", name: "Kirk Herbstreit", aff: "ESPN", rec: "126–54", picks: ["georgia", "michigan", "notre-dame", "ole-miss", "texas", "alabama", "oregon", "nebraska", "byu", "miami"] },
  { rk: "4", name: "Greg McElroy", aff: "ESPN", rec: "124–56", picks: ["georgia", "oklahoma", "texas-am", "lsu", "texas", "alabama", "usc", "tennessee", "texas-tech", "miami"] },
  { rk: "5", name: "Desmond Howard", aff: "ESPN", rec: "122–58", picks: ["clemson", "michigan", "notre-dame", "ole-miss", "ohio-state", "florida-state", "oregon", "nebraska", "byu", "wisconsin"] },
  { rk: "6", name: "David Pollack", aff: "See Ball Get Ball", rec: "121–59", picks: ["georgia", "oklahoma", "notre-dame", "lsu", "ohio-state", "alabama", "oregon", "tennessee", "texas-tech", "miami"] },
  { rk: "7", name: "Paul Finebaum", aff: "ESPN", rec: "119–61", picks: ["georgia", "michigan", "texas-am", "lsu", "texas", "alabama", "usc", "tennessee", "byu", "miami"] },
];

export default async function PlayPage() {
  const comps: Competition[] = await getCompetitions().catch(() => []);
  const pickem = comps.find((c) => c.type === "pickem") ?? null;
  const bracket = comps.find((c) => c.type === "bracket") ?? null;
  const active = pickem ?? bracket ?? comps[0] ?? null;

  const [pickemEntries, leaderboard] = await Promise.all([
    pickem ? getEntryCount(pickem.slug).catch(() => 0) : Promise.resolve(0),
    active ? getLeaderboard(active.slug, { limit: 10 }).catch(() => [] as PlayEntry[]) : Promise.resolve([] as PlayEntry[]),
  ]);

  const games: PickemGame[] = pickem?.config.games ?? [];
  const pickemLocked = pickem ? compLocked(pickem) : false;
  const bracketLocked = bracket ? compLocked(bracket) : false;
  const scoredRows = leaderboard.filter((e) => e.points != null);
  const joshRounds = joshBracketRounds();

  return (
    <main className="v5 pg-play">
      {/* page head */}
      <div className="phead">
        <div className="wrap">
          <div className="ph-eyebrow">The People&apos;s Games · Free to Play</div>
          <h1>Play The State.</h1>
          <p className="sub">
            Pick against Josh every week. Build your playoff bracket. One citizen account — every game on
            this page, free forever, no real-money wagering.
          </p>
          <div className="jumps">
            <a href="#pickem">🏈 This Week&apos;s Pick&apos;Em</a>
            <a href="#bracket">🏆 Playoff Bracket</a>
            <a href="#leaderboard">📊 The Board</a>
            {DEMO_MODE && <a href="#pros">📺 Josh vs. The Pros</a>}
          </div>
        </div>
      </div>

      {/* PICK'EM */}
      <section className="sect" id="pickem">
        <div className="wrap">
          <div className="sect-head">
            <span className="k">{pickem ? pickem.name : "Weekly Pick'Em"}</span>
            <h2>{games.length === 10 ? "Beat Josh. Ten Picks." : "Beat Josh."}</h2>
            {pickem && (
              <span className="right">
                {pickemLocked ? "Picks are locked" : `Picks lock ${lockLabel(pickem.locks_at)}`}
              </span>
            )}
          </div>
          {pickem ? (
            <>
              <p className="pk-note">{TYPE_BLURBS.pickem}</p>
              {games.length > 0 && (
                <div className="pk-grid">
                  {games.map((g, i) => (
                    <div className="game" key={g.id}>
                      <div className="g-meta">
                        <span>Game {i + 1} · {kickLabel(g.kickoff)}</span>
                        {g.net && <span className="l">{g.net}</span>}
                      </div>
                      <div className="sides">
                        <div className="side">
                          <Image src={g.awayLogo} alt="" width={26} height={26} style={{ objectFit: "contain" }} />
                          <span>{g.away}<small>Away</small></span>
                        </div>
                        <span className="vs">VS</span>
                        <div className="side b">
                          <Image src={g.homeLogo} alt="" width={26} height={26} style={{ objectFit: "contain" }} />
                          <span>{g.home}<small>Home</small></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="pk-bar">
                {pickemEntries > 0 && (
                  <span className="cnt">
                    <em>{pickemEntries}</em> {pickemEntries === 1 ? "entry" : "entries"} so far
                  </span>
                )}
                <span className="hint">
                  {pickemLocked
                    ? "Picks are locked for this slate — see how the board shakes out."
                    : "Lock your picks on the entry sheet — Josh's picks reveal at lock."}
                </span>
                <Link className="pk-lock" href={`/play/${pickem.slug}`}>
                  {pickemLocked ? "See the Board →" : "Make Your Picks →"}
                </Link>
              </div>
            </>
          ) : (
            <EmptyState
              kicker="BETWEEN SLATES"
              title="The next board opens with the coming week"
              body="Ten marquee games, confidence points 1 to 10, one lock before kickoff. Free for every citizen."
              cta={{ href: "/pickem", label: "How Quad Pick'Em Works →" }}
            />
          )}
        </div>
      </section>

      {/* BRACKET */}
      <section className="sect" id="bracket">
        <div className="wrap">
          <div className="sect-head">
            <span className="k">Season-Long</span>
            <h2>Pick the Playoff. Call Your Champ.</h2>
            <span className="right">
              <span className="pill">
                {bracket ? `${bracket.config.fieldSize ?? 12}-Team Playoff` : "12-Team Playoff"}
              </span>
            </span>
          </div>
          <p className="brk-note">{TYPE_BLURBS.bracket}</p>
          <div className="brk-card">
            <div className="brk-live">
              <div className="champ-col">
                <div className="rd-lbl">National Champion</div>
                <div className="champ"><b>?</b><span>Your Champ</span></div>
              </div>
              <p className="brk-copy">
                <b>Build the field, seed it, and crown one champion.</b> Your bracket scores against Josh and
                the whole State once the committee reveals the real field — every pick is yours to change
                until the field locks.
              </p>
            </div>
            {/* Josh's on-the-record field renders until the real one exists
                (Josh, 2026-08-19: "at least see a bracket somewhere"). */}
            {/* Josh's on-the-record bracket, drawn as a real two-sided bracket
                (Josh, 2026-08-26: "look like a playoff bracket that comes in
                from both sides"). Built from his column's picks. */}
            <div className="jb-mini">
              <div className="jb-mini-h">
                <span className="k">{JOSH_BRACKET_LABEL}</span>
                <Link href={JOSH_BRACKET_ARTICLE}>The Full Argument →</Link>
              </div>
              <TourneyBracket rounds={joshRounds} champTitle="JOSH'S CHAMPION" champName={championOf(joshRounds)} />
              <div className="jb-champ">Josh&apos;s champ, locked: <b>{championOf(joshRounds)}</b> · Think he&apos;s wrong? Build yours.</div>
            </div>
            <div className="brk-foot">
              <span className="brk-hint2">
                {bracket
                  ? bracketLocked
                    ? "The field is locked — scoring runs against the real bracket."
                    : `Change any pick any time before the field locks — ${lockLabel(bracket.locks_at)}.`
                  : "The Citizens' Bracket Challenge lives on the Playoffs page."}
              </span>
              {bracket ? (
                <Link className="brk-save" href={`/play/${bracket.slug}`}>
                  {bracketLocked ? "See the Board →" : "Build Your Bracket →"}
                </Link>
              ) : (
                <Link className="brk-save" href="/playoffs">Open the Playoffs Page →</Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* LEADERBOARD */}
      <section className="sect" id="leaderboard">
        <div className="wrap">
          <div className="sect-head">
            <span className="k">Season Standings</span>
            <h2>The Board.</h2>
            <span className="right">Updated after every slate</span>
          </div>
          {scoredRows.length > 0 ? (
            <div className="lb-wrap">
              {scoredRows.map((e, i) => (
                <div className="lbr" key={e.id}>
                  <span className="n">{i + 1}</span>
                  <span className="who">{e.display_name}</span>
                  <span className="rec">{e.points} PTS</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              kicker="SEASON STANDINGS"
              title="Everyone starts 0–0"
              body="The Board fills in after the first slate is scored — every citizen, Josh included, starts from zero. Lock a sheet and you're on it."
              cta={
                active
                  ? { href: `/play/${active.slug}`, label: "Get On the Board →" }
                  : { href: "/join", label: "Become a Citizen — Free" }
              }
            />
          )}
        </div>
      </section>

      {/* JOSH VS THE PROS — fictional mockup records: DEMO_MODE only */}
      {DEMO_MODE && (
        <section className="sect" id="pros">
          <div className="wrap">
            <div className="sect-head">
              <span className="k">The Other Leaderboard</span>
              <h2>Josh vs. The Pros.</h2>
              <span className="right">Same games · straight up · receipts kept</span>
            </div>
            <p className="pros-note">
              Every week, Josh&apos;s ten picks go up against <b>the biggest names in college football media</b> —
              their picks post here every Saturday morning, records tracked all season.
            </p>
            <div className="pboard">
              <div className="pb-head"><span></span><span>Pundit</span><span>Season</span><span>This Week&apos;s Ten</span></div>
              {DEMO_PROS.map((p) => (
                <div className={p.josh ? "prow josh" : "prow"} key={p.name}>
                  <span className="rk">{p.rk}</span>
                  <span className="nm">
                    <b>{p.name}{p.josh && <span className="tag">The Man Himself</span>}</b>
                    <span>{p.aff}</span>
                  </span>
                  <span className="rec">{p.rec}</span>
                  <span className="picks">
                    {p.picks.map((slug, i) => {
                      const logo = teamLogoUrl(slug);
                      return logo ? <Image src={logo} alt="" title="pick" width={20} height={20} key={`${slug}-${i}`} /> : null;
                    })}
                  </span>
                </div>
              ))}
              <Link className="pmore" href="/pickem">The Full Pundit Board →</Link>
            </div>
          </div>
        </section>
      )}

      {/* poll band */}
      <div className="pollband">
        <div className="wrap">
          <div>
            <h3>One more ballot belongs to you.</h3>
            <p>The JP Poll — the people&apos;s Top 25 — opens every Monday on the Rankings page.</p>
          </div>
          <Link href="/poll">Cast Your Ballot →</Link>
        </div>
      </div>
    </main>
  );
}
