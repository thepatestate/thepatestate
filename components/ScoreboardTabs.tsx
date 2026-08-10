"use client";

import { useState } from "react";
import Image from "next/image";
import { slugifyTeam, teamLogoUrl } from "@/lib/teams-meta";
import { teamNameFromLabel, type ScoreCardData, type Conference } from "@/lib/scores-demo";

// Client component: the /scores scoreboard's conference-filter tabs. Default
// tab is TOP 25 (matches useState's initial value), so the server-rendered
// HTML already contains the TOP 25 games before any JS runs — a JS-off
// visitor sees a real scoreboard, not an empty shell.
const TABS = ["TOP 25", "SEC", "BIG TEN", "BIG 12", "ACC", "G5", "ALL 136"] as const;
type Tab = (typeof TABS)[number];

function isRanked(card: ScoreCardData): boolean {
  return card.teams.some((t) => /^#\d+/.test(t.label));
}

// Real CFBD games carry no "#N" rank prefixes (polls drop later in August),
// so the TOP 25 tab falls back to marquee games: both teams recognizable
// (mapped in the logo set). Demo data keeps the rank-prefix behavior.
function isMarquee(card: ScoreCardData): boolean {
  return card.teams.every((t) => teamLogoUrl(slugifyTeam(teamNameFromLabel(t.label))) !== null);
}

function matchesTab(card: ScoreCardData, tab: Tab, anyRanked: boolean): boolean {
  if (tab === "ALL 136") return true;
  if (tab === "TOP 25") return anyRanked ? isRanked(card) : isMarquee(card);
  return card.conf === (tab as Conference);
}

function ScoreCard({ card }: { card: ScoreCardData }) {
  return (
    <div className="score-card">
      <div className="st">
        {card.live ? <span className="live">{card.st}</span> : <span>{card.st}</span>}
        <span>{card.net}</span>
      </div>
      {card.teams.map((t) => {
        const logoUrl = t.logo ?? teamLogoUrl(slugifyTeam(teamNameFromLabel(t.label)));
        return (
          <div className={t.lead ? "tm lead" : "tm"} key={t.label}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {logoUrl && <Image src={logoUrl} alt="" width={20} height={20} style={{ objectFit: "contain" }} />}
              <b>{t.label}</b>
            </span>
            <span className="pts">{t.pts}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ScoreboardTabs({ games }: { games: readonly ScoreCardData[] }) {
  const [tab, setTab] = useState<Tab>("TOP 25");
  const anyRanked = games.some(isRanked);
  const filtered = games.filter((g) => matchesTab(g, tab, anyRanked));

  return (
    <>
      <div className="conf-tabs" role="tablist" aria-label="Filter scores by conference">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "conf-tab active" : "conf-tab"}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "ALL 136" && (
        <span className="note" style={{ display: "inline-block" }}>
          Every demo game is shown above — the real 136-team slate arrives with the season
        </span>
      )}
      <div className="score-strip">
        {filtered.map((c) => (
          <ScoreCard card={c} key={c.id} />
        ))}
      </div>
    </>
  );
}
