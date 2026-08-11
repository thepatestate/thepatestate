import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { tabulateBallots, type BallotRank, type JpBoard } from "@/lib/jp-poll";

export const maxDuration = 60;

// JP Poll lifecycle cron (hourly): locked open boards tabulate (the count
// is pure, deterministic code — lib/jp-poll.tabulateBallots), and
// tabulated boards publish once their Tuesday reveal time passes. Results
// stay RLS-hidden until publication, matching the on-show reveal.

export async function POST(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;
  if (!isAdminConfigured) return NextResponse.json({ error: "no admin client" }, { status: 500 });
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const summary: Record<string, unknown> = {};

  // 1. Tabulate: open boards past lock.
  const { data: toTabulate } = await admin
    .from("jp_boards")
    .select("*")
    .eq("status", "open")
    .lte("locks_at", nowIso);
  for (const board of ((toTabulate as JpBoard[] | null) ?? [])) {
    try {
      const { data: ballots } = await admin
        .from("jp_ballots")
        .select("id, jp_ballot_ranks(rank, team_slug)")
        .eq("board_id", board.id);
      const ballotRanks: BallotRank[][] = (
        (ballots as { jp_ballot_ranks: BallotRank[] }[] | null) ?? []
      ).map((b) => b.jp_ballot_ranks ?? []);
      const complete = ballotRanks.filter((b) => b.length === 10);
      const tally = tabulateBallots(complete);

      await admin.from("jp_results").delete().eq("board_id", board.id);
      if (tally.length > 0) {
        await admin.from("jp_results").insert(
          tally.map((t, i) => ({
            board_id: board.id,
            rank: i + 1,
            team_slug: t.team_slug,
            points: t.points,
            first_place: t.first_place,
            ballots: complete.length,
          })),
        );
      }
      await admin.from("jp_boards").update({ status: "tabulated" }).eq("id", board.id);
      summary[board.id] = { tabulated: true, ballots: complete.length, teams: tally.length };
    } catch (err) {
      summary[board.id] = { error: String(err) };
    }
  }

  // 2. Publish: tabulated boards past reveal time.
  const { data: toPublish } = await admin
    .from("jp_boards")
    .select("id")
    .eq("status", "tabulated")
    .lte("reveals_at", nowIso);
  for (const board of ((toPublish as { id: string }[] | null) ?? [])) {
    await admin.from("jp_boards").update({ status: "published" }).eq("id", board.id);
    summary[board.id] = { ...(summary[board.id] as object | undefined), published: true };
  }

  console.log("[jp-poll:tabulate]", JSON.stringify(summary));
  return NextResponse.json({ ok: true, summary });
}
