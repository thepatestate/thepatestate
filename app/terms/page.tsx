import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The plain-language terms for using The Pate State and its citizen features.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <main className="v5-lite">
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Terms</p>
          <h1>Terms of Service</h1>
          <p className="lede">Effective August 10, 2026 · The short version: be a good citizen.</p>
        </div>
      </header>
      <section>
        <div className="wrap" style={{ maxWidth: 760, fontSize: 16, lineHeight: 1.65 }}>
          <h2 className="display" style={{ fontSize: 28 }}>The service</h2>
          <p style={{ marginTop: 10 }}>
            The Pate State is the online home of Josh Pate&apos;s College Football Show: articles, news, rankings,
            games, and community features. Citizenship is free. Core coverage stays free.
          </p>
          <h2 className="display" style={{ fontSize: 28, marginTop: 30 }}>Your account</h2>
          <p style={{ marginTop: 10 }}>
            You&apos;re responsible for your account and what&apos;s posted from it. One account per person; no
            impersonation. We can suspend accounts that break these terms or the community rules published on the
            site.
          </p>
          <h2 className="display" style={{ fontSize: 28, marginTop: 30 }}>Your content</h2>
          <p style={{ marginTop: 10 }}>
            What you write is yours. By posting it here (mailbag questions, ballots, community posts) you give The
            Pate State a license to display it on the site and, for mailbag submissions, to read and discuss it on
            the show. Don&apos;t post content you don&apos;t have the right to share.
          </p>
          <h2 className="display" style={{ fontSize: 28, marginTop: 30 }}>Games &amp; contests</h2>
          <p style={{ marginTop: 10 }}>
            Pick&apos;em and bracket competitions are free to play, no purchase necessary, and involve no
            real-money wagering. Locked picks are final and timestamped. Contest-specific rules are published with
            each contest and control if they conflict with this page.
          </p>
          <h2 className="display" style={{ fontSize: 28, marginTop: 30 }}>Content &amp; liability</h2>
          <p style={{ marginTop: 10 }}>
            Coverage is provided as-is. Projections are opinions, not advice — especially not betting advice. Our
            editorial and correction practices are described in the{" "}
            <Link href="/standards" style={{ color: "var(--lamp-deep)" }}>Standards</Link> page. To the extent the
            law allows, The Pate State isn&apos;t liable for damages arising from use of the site.
          </p>
          <h2 className="display" style={{ fontSize: 28, marginTop: 30 }}>Changes</h2>
          <p style={{ marginTop: 10 }}>
            If these terms change materially, the effective date changes and citizens are notified by email before
            the change applies. Questions →{" "}
            <Link href="/contact" style={{ color: "var(--lamp-deep)" }}>contact the desk</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
