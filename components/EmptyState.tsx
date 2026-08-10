import Link from "next/link";

// Polished production empty state (v2 brief §0.1) — what renders where demo
// data used to be when DEMO_MODE is off. Copy should be module-specific
// ("Leaderboard opens Week 1", "Poll voting opens Aug 24"), never generic.
export default function EmptyState({
  kicker = "OPENS WITH THE SEASON",
  title,
  body,
  cta,
  dark,
}: {
  kicker?: string;
  title: string;
  body?: string;
  cta?: { href: string; label: string };
  dark?: boolean;
}) {
  return (
    <div className={dark ? "empty-state dark" : "empty-state"}>
      <span className="es-kicker">{kicker}</span>
      <h4 className="es-title">{title}</h4>
      {body && <p className="es-body">{body}</p>}
      {cta && (
        <Link className="btn" href={cta.href} style={{ marginTop: 12 }}>
          {cta.label}
        </Link>
      )}
    </div>
  );
}
