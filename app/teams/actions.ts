"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCitizen } from "@/lib/supabase/server";

// Follow Team button on the hubs (v2 §4.2), backed by the Phase 1
// team_follows table (primary flag + up to 5 follows).
export async function followTeam(slug: string) {
  const citizen = await getCitizen();
  if (!citizen) redirect(`/join?next=/teams/${slug}`);
  const supabase = await createClient();
  const { count } = await supabase
    .from("team_follows")
    .select("team_slug", { count: "exact", head: true });
  if ((count ?? 0) >= 5) {
    // Cap reached — /me is where follows get managed.
    redirect(`/me`);
  }
  await supabase.from("team_follows").upsert({ user_id: citizen!.id, team_slug: slug });
  revalidatePath(`/teams/${slug}`);
}

export async function unfollowTeam(slug: string) {
  const citizen = await getCitizen();
  if (!citizen) return;
  const supabase = await createClient();
  await supabase.from("team_follows").delete().eq("user_id", citizen.id).eq("team_slug", slug);
  revalidatePath(`/teams/${slug}`);
}
