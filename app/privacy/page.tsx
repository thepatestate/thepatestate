import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What The Pate State collects, what it never collects, and how citizen data is handled.",
  alternates: { canonical: "/privacy" },
};

// Plain-language privacy policy reflecting what the site actually does:
// Supabase auth (email / Google OAuth), the Playbook email list via Resend,
// no ad-tech, no data sales. Reviewed copy — update this page whenever data
// practices change, and bump the date below.

export default function PrivacyPage() {
  return (
    <main className="v5-lite">
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Privacy</p>
          <h1>Privacy Policy</h1>
          <p className="lede">Effective August 10, 2026 · Written to be read, not skimmed past.</p>
        </div>
      </header>
      <section>
        <div className="wrap" style={{ maxWidth: 760, fontSize: 16, lineHeight: 1.65 }}>
          <h2 className="display" style={{ fontSize: 28 }}>What we collect</h2>
          <p style={{ marginTop: 10 }}>
            When you become a citizen we store your email address, your display name if you set one, and the
            preferences you choose (favorite team, followed teams, notification settings). If you sign in with
            Google, we receive your email and name from Google — nothing else. As you use citizen features we
            store what you create: picks, ballots, logged games, and mailbag submissions.
          </p>
          <h2 className="display" style={{ fontSize: 28, marginTop: 30 }}>What we don&apos;t do</h2>
          <p style={{ marginTop: 10 }}>
            We don&apos;t sell your data. We don&apos;t run third-party ad-tech trackers. We don&apos;t buy data
            about you from anyone. Sponsorships on this site, when they exist, are labeled placements — not
            surveillance.
          </p>
          <h2 className="display" style={{ fontSize: 28, marginTop: 30 }}>Email</h2>
          <p style={{ marginTop: 10 }}>
            The Pate Playbook arrives weekday mornings only if you signed up for it. Every email has a working
            one-click unsubscribe. Unsubscribing takes effect immediately.
          </p>
          <h2 className="display" style={{ fontSize: 28, marginTop: 30 }}>Where data lives</h2>
          <p style={{ marginTop: 10 }}>
            Citizen accounts and their data are stored with Supabase; emails send through Resend; the site runs on
            Vercel. Each processes data only to provide this service.
          </p>
          <h2 className="display" style={{ fontSize: 28, marginTop: 30 }}>Your controls</h2>
          <p style={{ marginTop: 10 }}>
            You can update your profile at any time, unsubscribe from any email, or ask us to delete your account
            and its data entirely — <Link href="/contact" style={{ color: "var(--lamp-deep)" }}>contact the desk</Link>{" "}
            and deletion is processed within 30 days.
          </p>
          <h2 className="display" style={{ fontSize: 28, marginTop: 30 }}>Changes</h2>
          <p style={{ marginTop: 10 }}>
            If this policy changes materially, the effective date above changes with it and citizens are notified
            by email before the change applies.
          </p>
        </div>
      </section>
    </main>
  );
}
