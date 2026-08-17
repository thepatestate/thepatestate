import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import GateCard from "@/components/GateCard";
import KeyBadge from "@/components/KeyBadge";
import PreseasonChip from "@/components/PreseasonChip";
import EmptyState from "@/components/EmptyState";
import { DEMO_MODE } from "@/lib/demo";
import { getCitizen } from "@/lib/supabase/server";
import { CHANNEL_URL, SOCIAL_LINKS } from "@/lib/youtube";
import { createArtPicker } from "@/lib/editorial-art";

export const metadata: Metadata = {
  title: "Pate's Porch — Community",
  description: "The community room of The Pate State: the mailbag, watch parties, the tour, and where citizens live between Saturdays.",
  alternates: { canonical: "/porch" },
};

// --- Preseason-preview sample data ---------------------------------------
// Stands in for the citizenship/community engine (mailbag submissions, the
// season ledger/leagues profile, the Wall of Champions leaderboard, and the
// live comment counts). Swap for real queries when citizenship ships; the
// JSX below only touches these arrays.

const DEMO_MAILBAG = [
  {
    q: '"Is it ever okay to leave a blowout early?"',
    from: "— A CITIZEN · TUSCALOOSA, AL",
    a: '"You can leave. You just can\'t complain about traffic AND miss the comeback. Pick one." — JP',
  },
  {
    q: '"My wife scheduled our wedding for the third Saturday in October. Thoughts?"',
    from: "— A CITIZEN · KNOXVILLE, TN",
    a: '"Congratulations on your engagement and my condolences on your kickoff. There are TVs at receptions now. Be creative." — JP',
  },
  {
    q: '"Settle it: best stadium entrance in the sport?"',
    from: "— A CITIZEN · CLEMSON, SC",
    a: '"You asked from Clemson. You know what you did." — JP',
  },
] as const;

const DEMO_CHAMPIONS = [
  { label: "2025 PICK'EM CHAMP", who: "SicEmSaturdays" },
  { label: "2025 LEDGER: MOST GAMES", who: "GroveGoblin · 96" },
  { label: "2025 TRAVELER OF THE YEAR", who: "PorchSwingProphet · 14 STADIUMS" },
] as const;

const DEMO_HOT = [
  {
    title: "Week 1 Overreactions — the comment section is cooking", meta: "THE SHOW · EP 1,204", cc: "🔥 2,418 COMMENTS",
    art: "media",
  },
  {
    title: '"Why the JP Poll Doesn\'t Trust Alabama Yet"', meta: "THE NOTEBOOK · POLL DAY COLUMN", cc: "🔥 1,907 COMMENTS",
    art: "poll",
  },
  {
    title: "The Indiana argument Josh lost to his own audience", meta: "POLL DAY · THE REVEAL", cc: "🔥 1,634 COMMENTS",
    photo: "/img/helmets/indiana.jpg", alt: "Indiana helmet studio photo",
  },
] as const;

const DEMO_TOUR = [
  { date: "SEP 5 — ATHENS, GA", status: "tickets" },
  { date: "SEP 19 — AUSTIN, TX", status: "tickets" },
  { date: "OCT 10 — COLUMBUS, OH", status: "tickets" },
  { date: "NOV 7 — BATON ROUGE, LA", status: "soldout" },
] as const;

const FOLLOW_LINKS = [
  { href: CHANNEL_URL, label: "▶ YOUTUBE — JOSH PATE'S CFB SHOW" },
  { href: SOCIAL_LINKS.x, label: "𝕏 @JOSHPATECFB — DAILY TAKES" },
  { href: SOCIAL_LINKS.instagram, label: "◉ @JOSHPATECFB — BEHIND THE PORCH" },
  { href: SOCIAL_LINKS.tiktok, label: "♪ TIKTOK — 60-SECOND PORCH" },
] as const;

export default async function PorchPage() {
  const citizen = await getCitizen();
  const art = createArtPicker();

  return (
    <main className="v5-lite">
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Pate&apos;s Porch</p>
          <h1>Pate&apos;s Porch</h1>
          <p className="lede">
            The community room — your mailbag, your ledger, your leagues, the watch parties, and the tour. This is
            where citizens live.
          </p>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="duo">
            <div>
              <p className="eyebrow">From the Mailbag</p>
              <div className="on-light" style={{ marginTop: 10 }}>
                <div className="platforms">
                  <a className="chip" href={CHANNEL_URL} target="_blank" rel="noopener">YouTube</a>
                  <a className="chip" href={SOCIAL_LINKS.x} target="_blank" rel="noopener">𝕏 X</a>
                  <a className="chip" href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener">Instagram</a>
                  <a className="chip" href={SOCIAL_LINKS.tiktok} target="_blank" rel="noopener">TikTok</a>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                {DEMO_MODE ? (
                  <>
                    <span className="note">Preseason preview — the real mailbag opens with citizenship</span>
                    {DEMO_MAILBAG.map((m) => (
                      <div className="mail" key={m.q}>
                        <div className="q">{m.q}</div>
                        <div className="from">{m.from}</div>
                        <div className="a">{m.a}</div>
                      </div>
                    ))}
                  </>
                ) : (
                  <EmptyState
                    kicker="ASK JOSH"
                    title="The mailbag opens with citizenship"
                    body="Citizens write in, Josh answers — the best questions make the Friday show. Submissions open here soon."
                  />
                )}
              </div>
              {citizen ? (
                <div style={{ marginTop: 14 }}>
                  <KeyBadge />
                  <textarea
                    placeholder="Ask Josh something..."
                    disabled
                    rows={3}
                    style={{
                      width: "100%",
                      marginTop: 10,
                      padding: "12px 14px",
                      fontFamily: "var(--mono)",
                      fontSize: 13,
                      border: "1px solid var(--line-l)",
                      borderRadius: 4,
                      resize: "vertical",
                    }}
                  />
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <button className="btn" disabled>Submit Your Question</button>
                    <PreseasonChip label="Mailbag submissions" />
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 14 }}>
                  <GateCard next="/porch" />
                </div>
              )}
            </div>
            <div>
              <div className="panel" style={{ marginBottom: 16 }}>
                <p className="eyebrow">Your Corner of the Porch</p>
                <h3>Ledger · Leagues · Patches</h3>
                <p>
                  Your logged games, your pick&apos;em leagues, your stadium passport, and your poll-vote streak —
                  all in one profile.
                </p>
                <Link href="/me" className="btn" style={{ borderColor: "var(--navy)", color: "var(--navy)" }}>
                  Open My Profile
                </Link>
              </div>
              <div className="panel" style={{ marginBottom: 16 }}>
                <p className="eyebrow">Follow the Mayor</p>
                <h3>Josh, Everywhere</h3>
                <p style={{ fontSize: 14 }}>
                  The show lives on YouTube. The takes live on X. The clips live everywhere else.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12, fontFamily: "var(--mono)", fontSize: 12 }}>
                  {FOLLOW_LINKS.map((l) => (
                    <a key={l.label} href={l.href} target="_blank" rel="noopener" style={{ color: "var(--lamp-deep)" }}>
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>
              <div className="panel">
                <p className="eyebrow">Wall of Champions</p>
                <h3>The Honored Citizens</h3>
                {DEMO_MODE ? (
                  DEMO_CHAMPIONS.map((c) => (
                    <div className="lb-row" key={c.label}>
                      <span>{c.label}</span>
                      <span className="streak">{c.who}</span>
                    </div>
                  ))
                ) : (
                  <p style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-dim)" }}>
                    The first names go on the wall after the 2026 season — pick&apos;em champ, ledger leader, traveler of the year.
                  </p>
                )}
                <Link href="/pickem" className="btn" style={{ marginTop: 14, borderColor: "var(--navy)", color: "var(--navy)" }}>
                  This Year&apos;s Race
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="on-soft tight">
        <div className="wrap">
          <p className="eyebrow">Where the Porch Is Loudest</p>
          <h2 className="display" style={{ fontSize: 32 }}>Join the Conversation</h2>
          {DEMO_MODE && <PreseasonChip />}
          {!DEMO_MODE && (
            <div style={{ maxWidth: 820, marginTop: 14 }}>
              <EmptyState
                kicker="THE BOARDS ARE OPEN"
                title="The Porch is live — pull up a chair"
                body="The national Front Porch, recruiting and portal talk, the Film Room, and a porch for every big fanbase. Citizenship is the only ticket in."
                cta={{ href: "/community", label: "Open the Boards →" }}
              />
            </div>
          )}
          {DEMO_MODE && (
          <div style={{ maxWidth: 820, marginTop: 14 }}>
            {DEMO_HOT.map((h) => {
              const img = "art" in h ? art.pick(h.art, h.title) : { src: h.photo, alt: h.alt };
              return (
                <div className="hot-row" key={h.title}>
                  <div className="hthumb bleed-thumb" style={{ position: "relative" }}>
                    <Image src={img.src} alt={img.alt} fill sizes="104px" style={{ objectFit: "cover" }} />
                  </div>
                  <div className="who">
                    <b>{h.title}</b>
                    <div className="meta">{h.meta}</div>
                  </div>
                  <span className="cc">{h.cc}</span>
                </div>
              );
            })}
          </div>
          )}
          <div className="duo" style={{ marginTop: 26 }}>
            <div className="panel">
              <p className="eyebrow">Find Your People</p>
              <h3>City Chapters</h3>
              <p>
                Citizen-run rooms by city and by team — plan tailgates, fill watch parties, argue in good faith.
                Atlanta, Dallas, Columbus, Nashville and 36 more.
              </p>
              <p style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", color: "var(--ink-dim)" }}>CHAPTERS OPEN THIS SEASON</p>
            </div>
            <div className="panel">
              <p className="eyebrow">Start Something</p>
              <h3>Host a Chapter</h3>
              <p>
                No chapter in your town? Claim it. Hosts get a State Store kit, early tour tickets, and the
                founding-citizen badge.
              </p>
              <p style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", color: "var(--ink-dim)" }}>HOST SIGN-UPS OPEN THIS SEASON</p>
            </div>
          </div>
        </div>
      </section>

      <section className="on-soft tight">
        <div className="wrap">
          <div className="duo">
            <div className="panel panel-accent-field">
              <p className="eyebrow">Saturdays Together</p>
              <h3>Citizen Watch Parties</h3>
              <p>
                Citizen-hosted watch parties are spinning up for the season — find your bar, claim your table,
                wear the flag. Hosts get a State Store kit on us.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a className="btn" href="/tailgate">Find a Watch Party Near You</a>
                <Link href="/tailgate" className="btn">Pate Tailgate: 136 Stadium Guides →</Link>
              </div>
            </div>
            <div className="panel panel-accent-field">
              <p className="eyebrow">The Tour</p>
              <h3>The Porch, Live</h3>
              {DEMO_MODE ? (
                DEMO_TOUR.map((t) => (
                  <div className="tour-row" key={t.date}>
                    <span>{t.date}</span>
                    {t.status === "tickets" ? <span>Tickets soon</span> : <span>Sold Out</span>}
                  </div>
                ))
              ) : (
                <EmptyState
                  kicker="THE PORCH TOUR"
                  title="Tour dates announced soon"
                  body="Campus stops are being booked now — citizens get first dibs the moment dates drop."
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="on-dark">
        <div className="wrap">
          <div style={{ display: "flex", alignItems: "center", gap: 40, flexWrap: "wrap" }}>
            <Image
              src="/citizen-gift-cover.png"
              alt="The 2026 JP Preseason Football Guide cover"
              width={280}
              height={350}
              style={{
                width: 280,
                maxWidth: "80vw",
                height: "auto",
                borderRadius: 6,
                border: "1px solid var(--line-d)",
                boxShadow: "0 18px 50px rgba(0,0,0,.45)",
                transform: "rotate(-2deg)",
              }}
            />
            <div style={{ flex: 1, minWidth: 280 }}>
              <span className="fr">🎁 THE CITIZEN GIFT</span>
              <p className="eyebrow">Free the Moment You Join</p>
              <h2 className="display" style={{ fontSize: "clamp(30px,4vw,44px)" }}>
                Become a Citizen,<br />Get the Guide.
              </h2>
              <p className="lede">
                The 2026 JP Preseason Football Guide — the Top 50 ranked, analyzed, and explained, the playoff
                picture, the X-factors, and the breakout players — yours free (digital edition) the moment you
                claim citizenship.
              </p>
              <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link className="btn gold" href="/join">Claim Free Citizenship</Link>
                <Link href="/report" className="btn">Peek Inside the Guide</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="cta-band">
        <div className="wrap row">
          <div>
            <h3>Who&apos;s In? See the Playoff Picture.</h3>
            <p>THE BRACKET, THE RANKINGS, JOSH&apos;S PICKS — AND AN AI TO RUN YOUR OWN</p>
          </div>
          <Link href="/playoffs" className="btn" style={{ borderColor: "var(--lamp)", color: "var(--lamp)" }}>
            Open the Playoffs Page →
          </Link>
        </div>
      </div>
    </main>
  );
}
