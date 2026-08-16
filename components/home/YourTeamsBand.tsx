"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { teamHubHref } from "@/lib/launch-teams";

// v5 "Your Teams" band (mirrors components/MyTeams.tsx's data path): signed-in
// citizens see the teams they follow (primary flag first); signed-out visitors
// get the personalization prompt. Client-side so the homepage stays statically
// rendered — session + follows come from the browser Supabase client (RLS
// scopes to own rows) and team art from the cached /api/team-directory.
// No unread-count badges: no unread engine exists yet (§0.1).

interface TeamInfo {
  school: string;
  abbrev: string;
  color: string | null;
  logo: string;
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[&']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function YourTeamsBand() {
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

  // While resolving, render the signed-out band (the common case for new
  // visitors) — it swaps in place once the session lands.
  if (state !== "in") {
    return (
      <div className="yours" id="yourteams">
        <div className="wrap">
          <div className="lbl">♡ Your Teams</div>
          <span style={{ fontSize: 14 }}>
            <b>Make it yours.</b> Choose your teams — your programs&apos; news, games, and threads first.
          </span>
          <Link className="team" href="/join" style={{ justifyContent: "center", fontWeight: 700, flex: "0 1 auto" }}>
            Become a Citizen — Free
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="yours" id="yourteams">
      <div className="wrap">
        <div className="lbl">♡ Your Teams<Link href="/me">Edit</Link></div>
        {slugs.length === 0 ? (
          <span style={{ fontSize: 14 }}>
            No teams followed yet — <Link href="/me" style={{ color: "var(--gold-dk)", fontWeight: 600 }}>pick your programs</Link> and they&apos;ll live here.
          </span>
        ) : (
          slugs.slice(0, 4).map((slug) => {
            const info = dir[slug];
            return (
              <Link className="team" href={teamHubHref(slug)} key={slug} title={info?.school ?? slug}>
                {info?.logo && <Image src={info.logo} alt="" width={36} height={36} style={{ objectFit: "contain" }} />}
                <div><div className="nm">{info?.school ?? slug}</div><div className="nx">Your team hub →</div></div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
