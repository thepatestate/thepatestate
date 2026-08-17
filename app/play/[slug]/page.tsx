import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCompetition,
  getEntryCount,
  getMyEntry,
  getMyLeagues,
  getPickemConsensus,
  compLocked,
  type PlayPick,
} from "@/lib/play";
import type { BracketInput, PickemPickInput } from "@/lib/play-validate";
import { getTeamDirectory } from "@/lib/cfbd";
import { createClient as createServerClient, getCitizen } from "@/lib/supabase/server";
import PickemSlate from "@/components/play/PickemSlate";
import BracketBuilder, { type BracketTeamOption } from "@/components/play/BracketBuilder";
import { CreateLeagueForm, JoinLeagueForm } from "@/components/play/LeagueForms";

// Universal competition page (v2 brief §5.1 — one engine, games as rows).
// Renders the right entry sheet for the competition type, the citizen's
// saved entry, the groups module, and (post-lock) the consensus view.

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const comp = await getCompetition(slug);
  if (!comp) return { title: "Play" };
  return {
    title: `${comp.name} — Play`,
    description: `Enter ${comp.name} — free for every citizen of the Pate State.`,
    alternates: { canonical: `/play/${slug}` },
    robots: { index: false },
  };
}

function lockLabel(iso: string): string {
  const d = new Date(iso);
  const day = d
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" })
    .replace(/,/g, "")
    .toUpperCase();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  return `${day} · ${time} ET`;
}

function picksToPickemInput(picks: PlayPick[]): PickemPickInput[] {
  return picks
    .filter((p) => p.slot !== "champion" && !p.slot.startsWith("seed-"))
    .flatMap((p) => {
      const v = p.value as { winner?: "away" | "home"; confidence?: number };
      return v.winner && v.confidence ? [{ gameId: p.slot, winner: v.winner, confidence: v.confidence }] : [];
    });
}

function picksToBracketInput(picks: PlayPick[], tiebreak: number | null): BracketInput {
  const seeds: Record<number, string> = {};
  let champion: string | null = null;
  for (const p of picks) {
    const team = (p.value as { team?: string }).team;
    if (!team) continue;
    if (p.slot.startsWith("seed-")) seeds[Number(p.slot.slice(5))] = team;
    if (p.slot === "champion") champion = team;
  }
  return { seeds, champion, tiebreaker: tiebreak };
}

export default async function CompetitionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const comp = await getCompetition(slug);
  if (!comp) notFound();

  const locked = compLocked(comp);
  const citizen = await getCitizen();
  const db = citizen ? await createServerClient() : null;
  const [entryCount, mine, myLeagues, dir, consensus] = await Promise.all([
    getEntryCount(slug),
    citizen && db ? getMyEntry(db, slug, citizen.id) : null,
    citizen && db ? getMyLeagues(db, citizen.id, slug) : [],
    comp.type === "bracket" ? getTeamDirectory() : Promise.resolve({} as Awaited<ReturnType<typeof getTeamDirectory>>),
    locked && comp.type === "pickem" ? getPickemConsensus(slug) : null,
  ]);

  const teams: BracketTeamOption[] = Object.values(dir)
    .map((t) => ({ slug: t.slug, school: t.school, conference: t.conference, logo: t.logo }))
    .sort((a, b) => a.school.localeCompare(b.school));

  return (
    <main className="v5-lite">
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">
            <Link href="/play" style={{ color: "inherit" }}>The Pate State / Play</Link> / {comp.name}
          </p>
          <h1>{comp.name}</h1>
          <p className="lede">
            Free for every citizen. {locked ? "Locked — picks are final and public." : `Picks lock ${lockLabel(comp.locks_at)}.`}
          </p>
        </div>
      </header>

      <section>
        <div className="wrap" style={{ maxWidth: 860 }}>
          <div className="comp-status">
            <span className="fr fr-field">{locked ? "LOCKED" : `LOCKS ${lockLabel(comp.locks_at)}`}</span>
            <span className="comp-count">{entryCount} {entryCount === 1 ? "ENTRY" : "ENTRIES"}</span>
            <Link href={`/play/${slug}/board`} className="comp-board-link">Leaderboard →</Link>
          </div>

          {mine && !locked && (
            <p className="play-note" style={{ marginTop: 8 }}>
              You&apos;re entered as <b>{mine.entry.display_name}</b> — edit anything below until lock.
            </p>
          )}
          {!citizen && (
            <p className="play-note" style={{ marginTop: 8 }}>
              You can build your entry now — <Link href={`/join?next=/play/${slug}`}>join free</Link> to save it.
            </p>
          )}

          <div style={{ marginTop: 18 }}>
            {comp.type === "pickem" ? (
              <PickemSlate
                slug={slug}
                games={comp.config.games ?? []}
                locked={locked}
                initial={mine ? picksToPickemInput(mine.picks) : []}
                consensus={consensus?.byGame}
                signedIn={Boolean(citizen)}
              />
            ) : (
              <BracketBuilder
                slug={slug}
                teams={teams}
                fieldSize={comp.config.fieldSize ?? 12}
                locked={locked}
                initial={
                  mine
                    ? picksToBracketInput(mine.picks, mine.entry.tiebreak_value)
                    : { seeds: {}, champion: null, tiebreaker: null }
                }
                signedIn={Boolean(citizen)}
              />
            )}
          </div>

          <p className="terms-line">
            Free to play — no paid entry, no wagering. Entering accepts the{" "}
            <Link href="/terms">site terms</Link> (v{comp.terms_version}). Locked entries are final,
            timestamped, and audit-logged; scoring runs from official results only.
          </p>
        </div>
      </section>

      <section className="on-soft">
        <div className="wrap" style={{ maxWidth: 860 }}>
          <p className="eyebrow">Groups</p>
          <h2 className="display" style={{ fontSize: 30 }}>Bring Your Crew</h2>
          <p className="lede" style={{ fontSize: 15.5 }}>
            Family, coworkers, the group chat — same picks, same scoring as the national board, your own
            leaderboard. Create a group and share the invite link.
          </p>

          {myLeagues.length > 0 && (
            <div style={{ margin: "16px 0" }}>
              {myLeagues.map((l) => (
                <Link key={l.id} href={`/play/groups/${l.id}`} className="league-row">
                  <b>{l.name}</b>
                  <span className="league-meta">
                    {l.role === "commissioner" ? "COMMISSIONER" : "MEMBER"} · {l.is_private ? "PRIVATE" : "PUBLIC"} →
                  </span>
                </Link>
              ))}
            </div>
          )}

          {citizen ? (
            <div className="duo" style={{ marginTop: 16 }}>
              <div className="panel">
                <p className="eyebrow">Start a Group</p>
                <CreateLeagueForm competition={slug} />
              </div>
              <div className="panel">
                <p className="eyebrow">Join a Group</p>
                <JoinLeagueForm />
                <p style={{ marginTop: 10, fontSize: 13, color: "var(--ink-dim)" }}>
                  Got a link instead? Just open it — invite links land you straight in the group.
                </p>
              </div>
            </div>
          ) : (
            <p className="play-note">
              <Link href={`/join?next=/play/${slug}`}>Join free</Link> to create or join groups.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
