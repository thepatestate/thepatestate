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
  const { error } = await supabase
    .from("citizens")
    .update({ favorite_team: favoriteTeam })
    .eq("id", user.id);
  return error ? { error: "Save failed — try again." } : { saved: true };
}
