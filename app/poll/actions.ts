"use server";
// JP Poll server actions. RLS + the DB lock-guard trigger enforce the
// lifecycle; this stays thin: citizenship gate, honest validation, writes
// with the caller's own client.
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCitizen } from "@/lib/supabase/server";
import { getCurrentBoard, boardOpenForVoting, validateBallot, type BallotRank } from "@/lib/jp-poll";
import { getTeamDirectory } from "@/lib/cfbd";

export interface BallotActionState {
  error?: string;
  saved?: boolean;
}

export async function saveBallot(ranks: BallotRank[]): Promise<BallotActionState> {
  const citizen = await getCitizen();
  if (!citizen) redirect("/join?next=/poll");

  const board = await getCurrentBoard();
  if (!board || !boardOpenForVoting(board)) {
    return { error: "Ballots aren't open right now — voting runs Monday through Sunday 8 PM ET." };
  }

  const dir = await getTeamDirectory();
  const errors = validateBallot(ranks, new Set(Object.keys(dir)));
  if (errors.length > 0) return { error: errors[0] };

  const db = await createClient();
  const { data: existing } = await db
    .from("jp_ballots")
    .select("id")
    .eq("board_id", board.id)
    .eq("user_id", citizen.id)
    .maybeSingle();

  let ballotId = (existing as { id: string } | null)?.id;
  if (!ballotId) {
    const { data, error } = await db
      .from("jp_ballots")
      .insert({ board_id: board.id, user_id: citizen.id })
      .select("id")
      .single();
    if (error) return { error: error.message };
    ballotId = (data as { id: string }).id;
  }

  // Replace-all: a re-ranked ballot may move teams between ranks, so clear
  // and rewrite (pre-lock only; guarded at every layer).
  const { error: delError } = await db.from("jp_ballot_ranks").delete().eq("ballot_id", ballotId);
  if (delError) return { error: delError.message };
  if (ranks.length > 0) {
    const { error } = await db
      .from("jp_ballot_ranks")
      .insert(ranks.map((r) => ({ ballot_id: ballotId, rank: r.rank, team_slug: r.team_slug })));
    if (error) return { error: error.message };
  }
  revalidateTag("jp-poll", { expire: 0 });
  revalidatePath("/poll");
  return { saved: true };
}
