"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export interface ProfileState { error?: string; saved?: boolean }

export async function updateFavoriteTeam(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expired — sign in again." };
  const favoriteTeam = String(formData.get("favorite_team") ?? "") || null;
  const { data, error } = await supabase
    .from("citizens")
    .update({ favorite_team: favoriteTeam })
    .eq("id", user.id)
    .select("id");
  if (error || !data || data.length === 0) return { error: "Save failed — try again." };
  return { saved: true };
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/;

/** Replaces the citizen's followed-team set (v2 brief §6: up to 5 beyond the
 * primary). RLS restricts every statement to the caller's own rows. */
export async function updateTeamFollows(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expired — sign in again." };
  const slugs = Array.from(
    new Set(
      formData
        .getAll("follow")
        .map((v) => String(v).trim())
        .filter((v) => v && SLUG_RE.test(v))
    )
  ).slice(0, 5);
  const { error: delError } = await supabase.from("team_follows").delete().eq("user_id", user.id);
  if (delError) return { error: "Save failed — try again." };
  if (slugs.length > 0) {
    const { error } = await supabase
      .from("team_follows")
      .insert(slugs.map((team_slug) => ({ user_id: user.id, team_slug })));
    if (error) return { error: "Save failed — try again." };
  }
  return { saved: true };
}
