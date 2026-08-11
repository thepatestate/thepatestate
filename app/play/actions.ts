"use server";
// Competition-engine server actions (v2 brief §5.1–§5.2). RLS + the DB
// lock-guard triggers are the enforcement layer; these actions stay thin:
// citizenship gate, honest validation (lib/play-validate), writes with the
// caller's own client so a locked competition rejects at every layer.
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCitizen } from "@/lib/supabase/server";
import { getCompetition, compLocked, type Competition, type PlayEntry } from "@/lib/play";
import {
  validatePickem,
  validateBracket,
  type PickemPickInput,
  type BracketInput,
} from "@/lib/play-validate";
import { getTeamDirectory } from "@/lib/cfbd";

export interface PlayActionState {
  error?: string;
  saved?: boolean;
}

async function requireOpenCompetition(slug: string): Promise<Competition | { error: string }> {
  const comp = await getCompetition(slug);
  if (!comp || comp.status !== "open") return { error: "This competition isn't open." };
  if (compLocked(comp)) return { error: "This competition is locked — picks can no longer change." };
  return comp;
}

/** Find or create the citizen's entry for a competition. */
async function ensureEntry(comp: Competition): Promise<{ entry?: PlayEntry; error?: string }> {
  const citizen = await getCitizen();
  if (!citizen) return { error: "join" };
  const db = await createClient();
  const { data: existing } = await db
    .from("play_entries")
    .select("*")
    .eq("competition_slug", comp.slug)
    .eq("user_id", citizen.id)
    .maybeSingle();
  if (existing) return { entry: existing as PlayEntry };
  const { data: rule } = await db
    .from("scoring_rules")
    .select("id, version")
    .eq("id", comp.scoring_rule_id)
    .single();
  const { data, error } = await db
    .from("play_entries")
    .insert({
      competition_slug: comp.slug,
      user_id: citizen.id,
      display_name: citizen.display_handle,
      scoring_rule_id: comp.scoring_rule_id,
      scoring_rule_version: (rule as { version: number } | null)?.version ?? 1,
      terms_version: comp.terms_version,
    })
    .select()
    .single();
  if (error) return { error: error.message };
  return { entry: data as PlayEntry };
}

export async function enterCompetition(slug: string): Promise<void> {
  const citizen = await getCitizen();
  if (!citizen) redirect(`/join?next=/play/${slug}`);
  const comp = await requireOpenCompetition(slug);
  if ("error" in comp) redirect(`/play/${slug}`);
  await ensureEntry(comp);
  revalidateTag("play", { expire: 0 });
  revalidatePath(`/play/${slug}`);
  redirect(`/play/${slug}`);
}

export async function savePickemPicks(
  slug: string,
  picks: PickemPickInput[],
): Promise<PlayActionState> {
  const comp = await requireOpenCompetition(slug);
  if ("error" in comp) return comp;
  if (comp.type !== "pickem") return { error: "Not a pick'em competition." };
  const games = comp.config.games ?? [];
  const errors = validatePickem(games, picks);
  if (errors.length > 0) return { error: errors[0] };

  const made = await ensureEntry(comp);
  if (made.error === "join") redirect(`/join?next=/play/${slug}`);
  if (!made.entry) return { error: made.error ?? "Could not create your entry." };

  const db = await createClient();
  const rows = picks.map((p) => ({
    entry_id: made.entry!.id,
    slot: p.gameId,
    value: { winner: p.winner, confidence: p.confidence },
  }));
  const { error } = await db.from("play_picks").upsert(rows, { onConflict: "entry_id,slot" });
  if (error) return { error: error.message };
  revalidateTag("play", { expire: 0 });
  revalidatePath(`/play/${slug}`);
  return { saved: true };
}

export async function saveBracket(slug: string, input: BracketInput): Promise<PlayActionState> {
  const comp = await requireOpenCompetition(slug);
  if ("error" in comp) return comp;
  if (comp.type !== "bracket") return { error: "Not a bracket competition." };

  const dir = await getTeamDirectory();
  const known = new Set(Object.keys(dir));
  const fieldSize = comp.config.fieldSize ?? 12;
  const errors = validateBracket(input, known, fieldSize);
  if (errors.length > 0) return { error: errors[0] };

  const made = await ensureEntry(comp);
  if (made.error === "join") redirect(`/join?next=/play/${slug}`);
  if (!made.entry) return { error: made.error ?? "Could not create your entry." };

  const db = await createClient();
  const rows: { entry_id: string; slot: string; value: Record<string, unknown> }[] = [];
  for (const [seed, team] of Object.entries(input.seeds)) {
    rows.push({ entry_id: made.entry.id, slot: `seed-${seed}`, value: { team } });
  }
  if (input.champion) {
    rows.push({ entry_id: made.entry.id, slot: "champion", value: { team: input.champion } });
  }
  // Replace-all semantics: a bracket rebuild may drop seeds, so clear first
  // (pre-lock only; RLS + trigger reject this wholesale after lock).
  const { error: delError } = await db.from("play_picks").delete().eq("entry_id", made.entry.id);
  if (delError) return { error: delError.message };
  if (rows.length > 0) {
    const { error } = await db.from("play_picks").insert(rows);
    if (error) return { error: error.message };
  }
  if (input.tiebreaker != null) {
    const { error } = await db
      .from("play_entries")
      .update({ tiebreak_value: input.tiebreaker })
      .eq("id", made.entry.id);
    if (error) return { error: error.message };
  }
  revalidateTag("play", { expire: 0 });
  revalidatePath(`/play/${slug}`);
  return { saved: true };
}

export async function createLeague(
  _prev: PlayActionState,
  formData: FormData,
): Promise<PlayActionState> {
  const citizen = await getCitizen();
  const slug = String(formData.get("competition") ?? "");
  if (!citizen) redirect(`/join?next=/play/${slug}`);
  const comp = await requireOpenCompetition(slug);
  if ("error" in comp) return comp;
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const isPrivate = formData.get("visibility") !== "public";
  if (name.length < 3 || name.length > 60) return { error: "Group name must be 3–60 characters." };
  const db = await createClient();
  const { data, error } = await db
    .from("play_leagues")
    .insert({
      competition_slug: slug,
      name,
      description: description.slice(0, 300),
      is_private: isPrivate,
      created_by: citizen.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidateTag("play", { expire: 0 });
  redirect(`/play/groups/${(data as { id: string }).id}`);
}

export async function joinLeague(code: string): Promise<PlayActionState> {
  const citizen = await getCitizen();
  if (!citizen) redirect(`/join?next=/play/join/${code}`);
  const db = await createClient();
  const { data, error } = await db.rpc("join_league", { code });
  if (error) return { error: error.message.replace(/^.*: /, "") };
  revalidateTag("play", { expire: 0 });
  redirect(`/play/groups/${data as string}`);
}

export async function leaveLeague(leagueId: string): Promise<void> {
  const citizen = await getCitizen();
  if (!citizen) redirect("/join");
  const db = await createClient();
  await db.from("play_league_members").delete().eq("league_id", leagueId).eq("user_id", citizen.id);
  revalidateTag("play", { expire: 0 });
  revalidatePath("/play");
  redirect("/play");
}

export async function removeMember(leagueId: string, userId: string): Promise<void> {
  const db = await createClient();
  // RLS allows this only for the commissioner, pre-lock.
  await db.from("play_league_members").delete().eq("league_id", leagueId).eq("user_id", userId);
  revalidateTag("play", { expire: 0 });
  revalidatePath(`/play/groups/${leagueId}`);
}
