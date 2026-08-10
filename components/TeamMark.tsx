import Image from "next/image";
import { helmetLightUrl, teamLogoUrl } from "@/lib/teams-meta";

// The one shared team mark (v2 brief §1.4). Default everywhere is the
// official team logo; the helmet variant exists solely for the Top 10 Games
// of the Week module. The fallback for a team with no resolvable art is its
// abbreviation on a team-color disc — never a blank shell, never a broken
// image. Purely presentational (no fetching), so it renders in server and
// client components alike; callers resolve art via lib/cfbd's
// getTeamDirectory() or the static lib/teams-meta map and pass it in.

export type TeamMarkProps = {
  name: string;
  /** Resolved logo URL; when omitted, falls back to the static ESPN-id map, then the disc. */
  logo?: string | null;
  /** Broadcast abbreviation for the fallback disc (defaults to first 3 letters). */
  abbrev?: string;
  /** Team brand color for the fallback disc. */
  color?: string | null;
  slug?: string;
  size?: number;
  variant?: "logo" | "helmet";
  /** Helmet variant only: mirror the (rightward-facing) helmet art to face left. */
  flip?: boolean;
  /** Render the logo on a light tile — for placement over dark surfaces. */
  tile?: boolean;
};

export default function TeamMark({
  name,
  logo,
  abbrev,
  color,
  slug,
  size = 22,
  variant = "logo",
  flip,
  tile,
}: TeamMarkProps) {
  const resolvedSlug = slug ?? name.toLowerCase().replace(/[&']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  if (variant === "helmet") {
    const helmet = helmetLightUrl(resolvedSlug);
    if (helmet) {
      return (
        <span className="teammark-helmet" style={{ width: size, height: size }}>
          <Image
            src={helmet}
            alt={`${name} helmet`}
            width={size}
            height={size}
            style={{ objectFit: "cover", transform: flip ? "scale(1.18) scaleX(-1)" : "scale(1.18)" }}
          />
        </span>
      );
    }
    // No helmet art — fall through to the logo treatment below.
  }

  const src = logo ?? teamLogoUrl(resolvedSlug);
  if (src) {
    return (
      <span
        className="teammark"
        style={{ width: size, height: size, ...(tile ? { background: "#fff", borderRadius: "50%", padding: Math.max(2, Math.round(size * 0.1)) } : {}) }}
      >
        <Image src={src} alt={`${name} logo`} width={size} height={size} style={{ objectFit: "contain", width: "100%", height: "100%" }} />
      </span>
    );
  }

  return (
    <span
      className="teammark-disc"
      style={{
        width: size,
        height: size,
        background: color ?? "var(--navy, #10243E)",
        fontSize: Math.max(7, Math.round(size * 0.32)),
      }}
      aria-label={`${name} logo`}
    >
      {(abbrev ?? name.slice(0, 3)).slice(0, 4).toUpperCase()}
    </span>
  );
}
