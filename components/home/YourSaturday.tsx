"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { teamHubHref } from "@/lib/launch-teams";
import type { SaturdayTeam } from "@/app/api/my-saturday/route";

// v25 "Your Saturday": the personalization section. Signed-in citizens get a
// card per followed team (up to 3) filled with real data from
// /api/my-saturday; visitors get the choose-your-teams prompt. Every row is
// sourced — a card only shows the rows its team actually has (§0.1).

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[&']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function YourSaturday() {
  const [state, setState] = useState<"loading" | "out" | "in">("loading");
  const [teams, setTeams] = useState<SaturdayTeam[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured) { setState("out"); return; }
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) { setState("out"); return; }
      const [{ data: citizen }, { data: follows }] = await Promise.all([
        supabase.from("citizens").select("favorite_team").eq("id", user.id).maybeSingle(),
        supabase.from("team_follows").select("team_slug").order("created_at"),
      ]);
      if (cancelled) return;
      const primary = citizen?.favorite_team ? slugify(citizen.favorite_team) : null;
      const slugs = Array.from(
        new Set([...(primary ? [primary] : []), ...(follows ?? []).map((r) => r.team_slug as string)]),
      ).slice(0, 3);
      if (slugs.length === 0) { setState("in"); setTeams([]); return; }
      const res = await fetch(`/api/my-saturday?teams=${slugs.join(",")}`).then((r) => (r.ok ? r.json() : { teams: [] })).catch(() => ({ teams: [] }));
      if (cancelled) return;
      setTeams((res.teams ?? []) as SaturdayTeam[]);
      setState("in");
    })();
    return () => { cancelled = true; };
  }, []);

  const signedInWithTeams = state === "in" && teams.length > 0;
  return (
    <section className="saturday" id="saturday">
      <div className="wrap">
        <div className="sect-head">
          <div>
            <div className="eyebrow">{signedInWithTeams ? "Signed In · Personalized" : "Make It Yours"}</div>
            <h2>Your Saturday</h2>
            <div className="sub">Your programs&apos; news, games, poll position, and Josh&apos;s latest take — first.</div>
          </div>
          {signedInWithTeams && <Link className="more" href="/me">Manage Teams →</Link>}
        </div>

        {signedInWithTeams && (
          <div className="sat-grid">
            {teams.map((t) => (
              <div className="sat" key={t.slug}>
                <Link className="top" href={teamHubHref(t.slug)} style={{ display: "flex" }}>
                  {t.logo && <Image src={t.logo} alt="" width={44} height={44} style={{ objectFit: "contain" }} />}
                  <div>
                    <div className="nm">{t.school}</div>
                    {t.game && <div className="nx">{t.game.line}</div>}
                  </div>
                  {t.rank && (
                    <div className="rank"><b>#{t.rank.rank}</b><span>JP Poll</span></div>
                  )}
                </Link>
                {t.news && (
                  t.news.external ? (
                    <a className="row" href={t.news.href} target="_blank" rel="noopener">
                      <div className="k">Team News</div><h5>{t.news.headline}</h5>
                    </a>
                  ) : (
                    <Link className="row" href={t.news.href}>
                      <div className="k">Team News</div><h5>{t.news.headline}</h5>
                    </Link>
                  )
                )}
                {t.board && (
                  <Link className="row" href={`/community/${t.board.slug}`}>
                    <div className="k">On the Porch</div><h5>{t.board.title} — pull up a chair</h5>
                  </Link>
                )}
                <Link className="row" href={teamHubHref(t.slug)}>
                  <div className="k">Team Hub</div><h5>Schedule, threads, and everything {t.school} →</h5>
                </Link>
              </div>
            ))}
          </div>
        )}

        <div className="sat-cta">
          <p>
            <b>{signedInWithTeams ? "Want more teams here?" : "Not seeing your teams?"}</b>{" "}
            Pick up to five programs and this section reorders around them — news, games, threads, and Josh&apos;s takes, your teams first.
          </p>
          <Link href={state === "out" ? "/join" : "/me"}>Choose Your Teams →</Link>
        </div>
      </div>
    </section>
  );
}
