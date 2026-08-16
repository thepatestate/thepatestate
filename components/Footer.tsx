import Link from "next/link";
import { CHANNEL_URL, SOCIAL_LINKS } from "@/lib/youtube";

// v5 four-column footer (wireframes/homepage-v5.html). Rendered site-wide.
const WATCH_READ = [
  { href: "/show", label: "The Show" },
  { href: "/notebook", label: "The Notebook" },
  { href: "/wire", label: "The Wire" },
  { href: "/report", label: "The Report" },
];

const PLAY_VOTE = [
  { href: "/poll", label: "JP Poll" },
  { href: "/pickem", label: "Pick'Em" },
  { href: "/playoffs", label: "Playoffs" },
  { href: "/community", label: "The Porch" },
];

const THE_STATE = [
  { href: "/teams", label: "Teams" },
  { href: "/scores", label: "Scores" },
  { href: "/recruiting", label: "Recruiting" },
  { href: "/tailgate", label: "Tailgate" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
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

function Col({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="ft-col">
      <h5>{title}</h5>
      {links.map((l) => (
        <Link key={l.href} href={l.href}>{l.label}</Link>
      ))}
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
          <Col title="Watch & Read" links={WATCH_READ} />
          <Col title="Play & Vote" links={PLAY_VOTE} />
          <Col title="The State" links={THE_STATE} />
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
