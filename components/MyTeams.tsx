"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

// "My Teams" homepage module (v2 brief §1.3, §6): signed-in citizens see the
// teams they follow (primary flag first); signed-out visitors get the
// personalization prompt. Runs client-side so the homepage stays statically
// rendered — session + follows come from the browser Supabase client (RLS
// scopes to own rows) and team art from the cached /api/team-directory.

interface TeamInfo {
  school: string;
  abbrev: string;
  color: string | null;
  logo: string;
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[&']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function MyTeams() {
  const [state, setState] = useState<"loading" | "out" | "in">("loading");
  const [slugs, setSlugs] = useState<string[]>([]);
  const [dir, setDir] = useState<Record<string, TeamInfo>>({});

  useEffect(() => {
    if (!isSupabaseConfigured) { setState("out"); return; }
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) { setState("out"); return; }
      const [{ data: citizen }, { data: follows }, dirRes] = await Promise.all([
        supabase.from("citizens").select("favorite_team").eq("id", user.id).maybeSingle(),
        supabase.from("team_follows").select("team_slug").order("created_at"),
        fetch("/api/team-directory").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
      ]);
      if (cancelled) return;
      const primary = citizen?.favorite_team ? slugify(citizen.favorite_team) : null;
      const followSlugs = (follows ?? []).map((r) => r.team_slug as string);
      setSlugs(Array.from(new Set([...(primary ? [primary] : []), ...followSlugs])).slice(0, 6));
      setDir(dirRes as Record<string, TeamInfo>);
      setState("in");
    })();
    return () => { cancelled = true; };
  }, []);

  // While resolving, render the signed-out bar (the common case for new
  // visitors) — it swaps in place once the session lands.
  if (state !== "in") {
    return (
      <section className="tight" style={{ padding: "22px 0" }}>
        <div className="wrap">
          <div className="myteams-bar">
            <span>
              <b>Make it yours.</b> Choose your teams and personalize The Pate State — your programs&apos; news,
              games, and threads first.
            </span>
            <Link className="btn gold" href="/join">Become a Citizen — Free</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="tight" style={{ padding: "22px 0" }}>
      <div className="wrap">
        <div className="myteams-bar">
          <span className="eyebrow" style={{ margin: 0 }}>My Teams</span>
          {slugs.length === 0 ? (
            <span style={{ fontSize: 14 }}>
              No teams followed yet — <Link href="/me" style={{ color: "var(--lamp-deep)", fontWeight: 600 }}>pick your programs</Link> and they&apos;ll live here.
            </span>
          ) : (
            <span className="myteams-row">
              {slugs.map((slug) => {
                const info = dir[slug];
                return (
                  <Link key={slug} href="/scores" className="myteams-chip" title={info?.school ?? slug}>
                    {info?.logo ? (
                      <Image src={info.logo} alt="" width={26} height={26} style={{ objectFit: "contain" }} />
                    ) : (
                      <span
                        className="teammark-disc"
                        style={{ width: 26, height: 26, background: info?.color ?? "var(--navy)", fontSize: 8 }}
                      >
                        {(info?.abbrev ?? slug.slice(0, 3)).slice(0, 4).toUpperCase()}
                      </span>
                    )}
                    <b>{info?.abbrev ?? slug.slice(0, 4).toUpperCase()}</b>
                  </Link>
                );
              })}
            </span>
          )}
          <Link href="/me" className="view-all" style={{ marginLeft: "auto" }}>Edit →</Link>
        </div>
      </div>
    </section>
  );
}
