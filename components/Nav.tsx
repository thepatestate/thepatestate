"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SUBSCRIBE_URL } from "@/lib/youtube";

const LINKS = [
  { href: "/show", label: "The Show" },
  { href: "/scores", label: "Scores" },
  { href: "/pickem", label: "Pick'Em" },
  { href: "/poll", label: "JP Poll" },
  { href: "/playoffs", label: "Playoffs" },
  { href: "/recruiting", label: "Recruiting" },
  { href: "/notebook", label: "Notebook" },
  { href: "/porch", label: "The Porch" },
  { href: "/tailgate", label: "Tailgate" },
  { href: "/shop", label: "Shop" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <nav>
      <div className="nav-row">
        <Link href="/" className="wordmark">The Pate <em>State</em></Link>
        <div className="nav-links">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : undefined}>
              {l.label}
            </Link>
          ))}
        </div>
        <a className="btn gold nav-cta" href={SUBSCRIBE_URL} target="_blank" rel="noopener">
          Subscribe on YouTube
        </a>
        <button className="menu-btn" aria-expanded={open} onClick={() => setOpen(!open)}>Menu</button>
      </div>
      <div className={open ? "drawer open" : "drawer"}>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={pathname === l.href ? "active" : undefined}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
