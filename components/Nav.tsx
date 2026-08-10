"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NavSession from "@/components/NavSession";

// Primary nav per v2 brief §2.1: plain wayfinding labels in the bar, branded
// names stay on-page ("Latest" → The Notebook, "Community" → The Porch,
// "Rankings" → The JP Poll). Secondary destinations live in the More menu.
const LINKS = [
  { href: "/notebook", label: "Latest" },
  { href: "/scores", label: "Scores" },
  { href: "/teams", label: "Teams" },
  { href: "/recruiting", label: "Recruiting" },
  { href: "/poll", label: "Rankings" },
  { href: "/porch", label: "Community" },
  { href: "/play", label: "Play" },
  { href: "/show", label: "Show" },
] as const;

const MORE_LINKS = [
  { href: "/tailgate", label: "Tailgate" },
  { href: "/porch", label: "The Porch Tour" },
  { href: "/report", label: "The Report" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
  { href: "/standards", label: "Standards" },
  { href: "/contact", label: "Contact" },
] as const;

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [moreOpen]);

  return (
    <nav>
      <div className="nav-row">
        <Link href="/" className="wordmark">The Pate <em>State</em></Link>
        <div className="nav-links">
          {LINKS.map((l) => (
            <Link key={l.label} href={l.href} className={pathname === l.href ? "active" : undefined}>
              {l.label}
            </Link>
          ))}
          <div className="nav-more" ref={moreRef}>
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              onClick={() => setMoreOpen(!moreOpen)}
            >
              More ▾
            </button>
            {moreOpen && (
              <div className="nav-more-menu" role="menu">
                {MORE_LINKS.map((l) => (
                  <Link key={l.label} href={l.href} role="menuitem" onClick={() => setMoreOpen(false)}>
                    {l.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
        <Link href="/search" className="nav-search" aria-label="Search the site" title="Search">
          ⌕
        </Link>
        <NavSession
          fallback={
            <Link className="btn gold nav-cta" href="/join">
              Become a Citizen
            </Link>
          }
        />
        <button className="menu-btn" aria-expanded={open} onClick={() => setOpen(!open)}>Menu</button>
      </div>
      <div className={open ? "drawer open" : "drawer"}>
        {LINKS.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            className={pathname === l.href ? "active" : undefined}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </Link>
        ))}
        {MORE_LINKS.map((l) => (
          <Link key={`m-${l.label}`} href={l.href} onClick={() => setOpen(false)}>
            {l.label}
          </Link>
        ))}
        <Link href="/search" onClick={() => setOpen(false)}>Search</Link>
        <Link href="/join" className={pathname === "/join" ? "active" : undefined} onClick={() => setOpen(false)}>
          Become a Citizen
        </Link>
      </div>
    </nav>
  );
}
