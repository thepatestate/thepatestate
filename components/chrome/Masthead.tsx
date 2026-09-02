"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NavSession from "@/components/NavSession";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

// Live followed-team count for the My Teams pill — real number or nothing.
function useMyTeamsCount(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      const { count: n } = await supabase
        .from("team_follows")
        .select("*", { count: "exact", head: true });
      if (!cancelled && typeof n === "number" && n > 0) setCount(n);
    })();
    return () => { cancelled = true; };
  }, []);
  return count;
}

// v5 masthead. Wayfinding labels stay plain (v2 brief §2.1): "Latest" → the
// Notebook, "Rankings" → the JP Poll, "Community" → the Quad.
const LINKS = [
  { href: "/notebook", label: "Latest" },
  { href: "/show", label: "Show" },
  { href: "/scores", label: "Scores" },
  { href: "/poll", label: "Rankings" },
  { href: "/recruiting", label: "Recruiting" },
  { href: "/play", label: "Play" },
  { href: "/community", label: "Community" },
] as const;

const MORE_LINKS = [
  { href: "/teams", label: "Teams" },
  { href: "/tailgate", label: "Tailgate" },
  { href: "/quad", label: "The Quad Tour" },
  { href: "/report", label: "The Report" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
  { href: "/standards", label: "Standards" },
  { href: "/contact", label: "Contact" },
] as const;

export default function Masthead() {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const teamCount = useMyTeamsCount();

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [moreOpen]);

  return (
    <header className="v5 v5-header">
      <div className="wrap mast">
        <Link className="logo" href="/">
          <span className="name">The Pate <em>State</em></span>
          <span className="kicker">College Football's Common Ground</span>
        </Link>
        <nav className="main">
          {LINKS.map((l) => (
            <Link key={l.label} href={l.href} className={pathname === l.href ? "active" : undefined}>
              {l.label}
            </Link>
          ))}
          <div ref={moreRef} style={{ position: "relative" }}>
            <button type="button" aria-expanded={moreOpen} aria-haspopup="menu" onClick={() => setMoreOpen(!moreOpen)}>
              More ▾
            </button>
            {moreOpen && (
              <div className="more-menu" role="menu">
                {MORE_LINKS.map((l) => (
                  <Link key={l.label} href={l.href} role="menuitem" onClick={() => setMoreOpen(false)}>
                    {l.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>
        <div className="right">
          <Link className="myteams" href="/me">
            ♡ My Teams{teamCount ? <> · <b>{teamCount}</b></> : null}
          </Link>
          <Link className="search" href="/search" aria-label="Search">⌕</Link>
          <NavSession fallback={<Link className="join" href="/join">Join Free</Link>} />
          <button className="menu-btn" aria-expanded={open} onClick={() => setOpen(!open)}>Menu</button>
        </div>
      </div>
      <div className={open ? "drawer open" : "drawer"}>
        {[...LINKS, ...MORE_LINKS].map((l) => (
          <Link key={l.label} href={l.href} className={pathname === l.href ? "active" : undefined} onClick={() => setOpen(false)}>
            {l.label}
          </Link>
        ))}
        <Link href="/join" onClick={() => setOpen(false)}>Join Free</Link>
      </div>
    </header>
  );
}
