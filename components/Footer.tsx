import type { CSSProperties } from "react";
import Link from "next/link";
import { CHANNEL_URL, SOCIAL_LINKS } from "@/lib/youtube";

const LINKS = [
  { href: "/show", label: "The Show" },
  { href: "/scores", label: "Scores" },
  { href: "/pickem", label: "Pick'Em" },
  { href: "/poll", label: "JP Poll" },
  { href: "/playoffs", label: "Playoffs" },
  { href: "/teams", label: "Teams" },
  { href: "/recruiting", label: "Recruiting" },
  { href: "/notebook", label: "Notebook" },
  { href: "/porch", label: "The Porch" },
  { href: "/tailgate", label: "Tailgate" },
  { href: "/ledger", label: "Ledger" },
  { href: "/shop", label: "Shop" },
  { href: "/report", label: "The Report" },
  { href: "/about", label: "About" },
];

const SOCIAL = [
  { href: CHANNEL_URL, label: "▶ YOUTUBE" },
  { href: SOCIAL_LINKS.x, label: "𝕏 @JOSHPATECFB" },
  { href: SOCIAL_LINKS.instagram, label: "◉ INSTAGRAM" },
  { href: SOCIAL_LINKS.tiktok, label: "♪ TIKTOK" },
  { href: SOCIAL_LINKS.merch, label: "🛒 STATE STORE" },
];

const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid var(--line-d)",
  borderRadius: 20,
  padding: "8px 16px",
  color: "var(--chalk)",
  fontFamily: "var(--mono)",
  fontSize: 11,
  letterSpacing: ".06em",
};

export default function Footer() {
  return (
    <footer>
      <div className="wrap foot-row">
        <div>
          <div className="wordmark" style={{ fontSize: 20, color: "var(--chalk)" }}>
            THE PATE <em style={{ color: "var(--lamp)" }}>STATE</em>
          </div>
          <p style={{ marginTop: 8 }}>
            The front porch of college football.
            <br />
            &copy; The Pate State. All picks logged. All poll results archived.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 22 }}>
          {SOCIAL.map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener" style={pillStyle}>
              {s.label}
            </a>
          ))}
        </div>
        <div className="foot-links">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
