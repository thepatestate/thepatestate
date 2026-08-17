import Link from "next/link";
import { CHANNEL_URL, SOCIAL_LINKS, APPLE_PODCASTS_URL, SPOTIFY_URL } from "@/lib/youtube";

// v25 four-column footer (wireframes/v3/pate-state-homepage-v25-LAUNCH.html).
const WATCH = [
  { href: "/show", label: "The Show" },
  { href: `${CHANNEL_URL}/shorts`, label: "Shorts", external: true },
  { href: APPLE_PODCASTS_URL, label: "Apple Podcasts", external: true },
  { href: SPOTIFY_URL, label: "Spotify", external: true },
];

const READ_PLAY = [
  { href: "/wire", label: "Latest / The Wire" },
  { href: "/notebook", label: "The Notebook" },
  { href: "/poll", label: "JP Poll" },
  { href: "/pickem", label: "Pick'Em" },
  { href: "/playoffs", label: "Playoffs" },
];

const BELONG = [
  { href: "/join", label: "Citizenship" },
  { href: "/community", label: "The Porch" },
  { href: "/porch", label: "Porch Tour" },
  { href: "/tailgate", label: "Tailgate" },
  { href: "/shop", label: "Shop" },
  { href: "/report", label: "The Report" },
];

// Trust & legal row (v2 brief §8) — required for sponsorships, commerce,
// email capture, and E-E-A-T.
const TRUST_LINKS = [
  { href: "/standards", label: "Editorial Standards & Corrections" },
  { href: "/standards#ai", label: "AI Disclosure" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];

const SOCIAL = [
  { href: CHANNEL_URL, label: "▶ YouTube" },
  { href: SOCIAL_LINKS.x, label: "𝕏" },
  { href: SOCIAL_LINKS.instagram, label: "Instagram" },
  { href: SOCIAL_LINKS.tiktok, label: "TikTok" },
];

function Col({ title, links }: { title: string; links: { href: string; label: string; external?: boolean }[] }) {
  return (
    <div className="ft-col">
      <h5>{title}</h5>
      {links.map((l) =>
        l.external ? (
          <a key={l.href} href={l.href} target="_blank" rel="noopener">{l.label}</a>
        ) : (
          <Link key={l.href} href={l.href}>{l.label}</Link>
        ),
      )}
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="v5 v5-footer">
      <div className="wrap">
        <div className="ft-top">
          <div className="ft-brand">
            <div className="name">The Pate <em>State</em></div>
            <p>The front porch of college football. All picks logged. All poll results archived.</p>
            <div className="ft-social">
              {SOCIAL.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener">{s.label}</a>
              ))}
            </div>
          </div>
          <Col title="Watch" links={WATCH} />
          <Col title="Read & Play" links={READ_PLAY} />
          <Col title="Belong" links={BELONG} />
        </div>
        <div className="ft-bottom">
          <span className="cr">© The Pate State</span>
          {TRUST_LINKS.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
