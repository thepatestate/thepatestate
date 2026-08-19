"use client";
import { useState } from "react";
import Image from "next/image";
import type { RecruitPlayer } from "@/lib/cfbd";

// Position-filterable player rankings table (Josh, 2026-08-19: "be able to
// segment per position"). Server HTML renders the full board (ALL tab) so
// JS-off visitors still get real content — same pattern as ScoreboardTabs.
const GROUPS: { key: string; label: string; positions: string[] | null }[] = [
  { key: "all", label: "All", positions: null },
  { key: "qb", label: "QB", positions: ["QB"] },
  { key: "rb", label: "RB", positions: ["RB", "FB", "APB"] },
  { key: "wr", label: "WR", positions: ["WR"] },
  { key: "te", label: "TE", positions: ["TE"] },
  { key: "ol", label: "OL", positions: ["OT", "IOL", "OG", "OC", "OL", "C"] },
  { key: "edge", label: "EDGE", positions: ["EDGE", "WDE", "SDE"] },
  { key: "dl", label: "DL", positions: ["DL", "DT", "NT", "DE"] },
  { key: "lb", label: "LB", positions: ["LB", "ILB", "OLB"] },
  { key: "db", label: "DB", positions: ["CB", "S", "DB", "ATH-S"] },
  { key: "ath", label: "ATH/ST", positions: ["ATH", "K", "P", "LS"] },
];

export default function PlayerRankBoard({ players }: { players: RecruitPlayer[] }) {
  const [group, setGroup] = useState("all");
  const active = GROUPS.find((g) => g.key === group) ?? GROUPS[0];
  const rows = active.positions
    ? players.filter((p) => active.positions!.includes(p.position.toUpperCase()))
    : players;
  return (
    <>
      <div className="pos-pills">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            className={g.key === group ? "pill on" : "pill"}
            onClick={() => setGroup(g.key)}
          >
            {g.label}
          </button>
        ))}
      </div>
      <table className="rank-table players">
        <thead>
          <tr><th>RK</th><th>Player</th><th>POS</th><th>HT / WT</th><th>Hometown</th><th>High School</th><th>Committed</th></tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.ranking}>
              <td className="rk">{String(p.ranking).padStart(2, "0")}</td>
              <td><span className="tcell"><b>{p.name}</b><span className="stars">{"★".repeat(p.stars)}</span></span></td>
              <td className="conf">{p.position}</td>
              <td className="conf">{p.heightIn ? `${Math.floor(p.heightIn / 12)}'${p.heightIn % 12}"` : "—"}{p.weightLb ? ` · ${p.weightLb}` : ""}</td>
              <td className="conf">{p.city && p.state ? `${p.city}, ${p.state}` : p.state || "—"}</td>
              <td className="conf">{p.highSchool || "—"}</td>
              <td>
                <span className="tcell">
                  {p.committedLogo && <Image src={p.committedLogo} alt="" width={20} height={20} style={{ objectFit: "contain" }} />}
                  {p.committedTo ?? "Uncommitted"}
                </span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={7} className="conf" style={{ textAlign: "center", padding: 24 }}>No {active.label} prospects inside the Top 100 this cycle.</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}
