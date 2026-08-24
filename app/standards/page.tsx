import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Editorial Standards & AI Disclosure",
  description:
    "How The Pate State reports, verifies, corrects, and labels its coverage — including exactly how Pate State AI is and isn't used.",
  alternates: { canonical: "/standards" },
};

// Trust & Standards page (v2 brief §7.4, §8). The rules stated here mirror
// the ones actually enforced in software — lib/wire.ts's verification stack,
// lib/generate.ts's verbatim-quote gate — so the page describes the system,
// not an aspiration.

const SECTIONS = [
  {
    id: "editorial",
    title: "Editorial Standards",
    body: [
      "The Pate State publishes four kinds of content, and every page says which kind it is: News (verified, sourced reporting), Analysis (interpretation of things that happened), Opinion / Projection (Josh's takes and predictions, always labeled as such), and Community (from citizens, clearly marked).",
      "News is attributed. Every reported story credits and links its original sources — ESPN, CBS Sports, Yahoo, On3, an official program announcement — in the sourcing footer at the end of the story, where the credit is complete rather than squeezed into a lede. Official sources and named reporters are credited in the text when they are the news. We do not claim other outlets' reporting as our own, and we do not publish \"sources tell The Pate State\" — we don't have insider sourcing, so you'll never see it implied.",
      "Rumors are never labeled confirmed. Projections are labeled projections. Records and standings only appear once real games produce them — nothing on this site presents an invented number as a live one.",
    ],
  },
  {
    id: "ai",
    title: "AI Disclosure",
    body: [
      "Pate State AI is built from Josh Pate's owned content archive: show transcripts, rankings philosophy, prediction history, football terminology, and these editorial guidelines. It helps The Pate State organize, draft, and personalize content. Published news and analysis are produced under these standards and monitored by The Pate State editorial team, which can correct or unpublish any piece at any time; drafts that fail the automated checks are held for human review instead of publishing.",
      "Hard rules the system enforces: it never invents an opinion attributed to Josh — every Josh opinion traces to a clip, transcript, article, or explicit approval, and every direct quote is machine-checked verbatim against the transcript, with a timestamp link to the moment it was said.",
      "Wire stories drafted by AI pass an automated verification stack before publishing: sourcing checks (every story carries its original sources in the footer, and the prose never dresses up another outlet's report as our own), banned-inference patterns, a language gate against generated-sounding prose, and a second-model fact check against the source material. Every published story stays under editorial monitoring, and sensitive subjects — injuries, eligibility, legal or disciplinary matters — are labeled by what is confirmed, what is reported, and what is still unresolved, so readers always know how solid each claim is.",
    ],
  },
  {
    id: "corrections",
    title: "Corrections Policy",
    body: [
      "When we get something wrong, we fix it in the open. Corrections are appended to the story with a timestamp and a description of what changed — never silently edited away. Retracted stories stay addressable with a retraction notice rather than disappearing.",
      "Spotted an error? Email the desk — the address is on the contact page — and include the story link. Corrections are reviewed and applied by a human, not the AI.",
    ],
  },
  {
    id: "sourcing",
    title: "Sourcing Rules",
    body: [
      "Third-party reporting always links the original publisher. Scores, schedules, and standings auto-update from licensed data feeds (CollegeFootballData) and are labeled as automated data updates. Quotes from the show link the exact timestamp on YouTube so you can hear them in context.",
    ],
  },
] as const;

export default function StandardsPage() {
  return (
    <main className="v5-lite">
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Standards</p>
          <h1>Editorial Standards</h1>
          <p className="lede">
            How this site reports, verifies, labels, and corrects its coverage — including exactly how Pate State
            AI is and isn&apos;t used. These aren&apos;t aspirations; they&apos;re rules enforced in the publishing
            system itself.
          </p>
        </div>
      </header>

      <section>
        <div className="wrap" style={{ maxWidth: 760 }}>
          {SECTIONS.map((s) => (
            <div key={s.id} id={s.id} style={{ marginBottom: 36 }}>
              <h2 className="display" style={{ fontSize: 30 }}>{s.title}</h2>
              {s.body.map((p) => (
                <p key={p.slice(0, 40)} style={{ marginTop: 12, fontSize: 16, lineHeight: 1.65 }}>{p}</p>
              ))}
            </div>
          ))}
          <p style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-dim)" }}>
            Questions about any of this? <Link href="/contact" style={{ color: "var(--lamp-deep)" }}>Contact the desk</Link>.
            Related: <Link href="/privacy" style={{ color: "var(--lamp-deep)" }}>Privacy Policy</Link> ·{" "}
            <Link href="/terms" style={{ color: "var(--lamp-deep)" }}>Terms of Service</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
