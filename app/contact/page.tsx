import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact",
  description: "Reach The Pate State desk — corrections, business, privacy requests, and everything else.",
  alternates: { canonical: "/contact" },
};

const ROWS = [
  { label: "Corrections & editorial", detail: "Spotted an error? Send the story link and what's wrong — a human reviews every report.", addr: "porch@thepatestate.com" },
  { label: "Business & sponsorships", detail: "Sponsorable surfaces are always labeled and never influence editorial.", addr: "porch@thepatestate.com" },
  { label: "Privacy & account requests", detail: "Data deletion and export requests are processed within 30 days.", addr: "porch@thepatestate.com" },
] as const;

export default function ContactPage() {
  return (
    <main className="v5-lite">
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Contact</p>
          <h1>Contact the Desk</h1>
          <p className="lede">One address, read by a human. Say which of these it&apos;s about and it gets routed right.</p>
        </div>
      </header>
      <section>
        <div className="wrap" style={{ maxWidth: 760 }}>
          {ROWS.map((r) => (
            <div key={r.label} className="panel" style={{ marginBottom: 16 }}>
              <p className="eyebrow">{r.label}</p>
              <p style={{ fontSize: 15 }}>{r.detail}</p>
              <a href={`mailto:${r.addr}`} style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--lamp-deep)", fontWeight: 600 }}>
                {r.addr}
              </a>
            </div>
          ))}
          <p style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-dim)", marginTop: 8 }}>
            Mailbag questions for the show don&apos;t go here — those live on{" "}
            <Link href="/porch" style={{ color: "var(--lamp-deep)" }}>the Porch</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
