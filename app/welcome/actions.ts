"use server";
import { redirect } from "next/navigation";
import { validateHandle } from "@/lib/handle";
import { createClient } from "@/lib/supabase/server";

export interface WelcomeState {
  error?: string;
}

const ERROR_COPY: Record<string, string> = {
  length: "Handles run 3 to 20 characters.",
  charset: "Letters, numbers, and underscores only.",
  underscore: "Can't start or end with an underscore.",
  reserved: "That one's taken by the State.",
  taken: "That handle's already on the porch — try another.",
  auth: "Your session expired — head back to the join page.",
};

export async function createCitizen(
  _prev: WelcomeState,
  formData: FormData
): Promise<WelcomeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ERROR_COPY.auth };

  const result = validateHandle(String(formData.get("handle") ?? ""));
  if (!result.ok) return { error: ERROR_COPY[result.error] };

  const favoriteTeam = String(formData.get("favorite_team") ?? "") || null;
  const { error } = await supabase.from("citizens").insert({
    id: user.id,
    handle: result.handle,
    display_handle: result.display,
    favorite_team: favoriteTeam,
  });

  if (error) {
    return { error: error.code === "23505" ? ERROR_COPY.taken : "Something hiccuped — try again." };
  }

  const rawNext = String(formData.get("next") ?? "/");
  redirect(rawNext.startsWith("/") ? rawNext : "/");
}
