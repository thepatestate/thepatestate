"use server";
// The Quad server actions (v2 brief §3.3–§3.5). RLS is the enforcement
// layer — these actions stay thin: validate input, write with the caller's
// own client (so citizens can only do citizen things and staff things need
// a staff row), triage new content with Pate State AI, and log moderation.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCitizen } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { triagePost } from "@/lib/moderate";

export interface ActionState {
  error?: string;
  saved?: boolean;
}

const CITIZEN_TYPES = new Set(["discussion", "question", "prediction", "rumor"]);
const STAFF_TYPES = new Set(["discussion", "question", "prediction", "rumor", "news", "staff"]);

/** High-risk content: hide it and file an auto-report for human review.
 * Uses the service role (moderation columns are staff-only for users). */
async function holdForReview(targetType: "thread" | "post", targetId: string, reason: string) {
  if (!isAdminConfigured) return;
  try {
    const admin = createAdminClient();
    await admin.from(targetType === "thread" ? "threads" : "posts").update({ hidden: true }).eq("id", targetId);
    await admin.from("reports").insert({
      reporter_id: null,
      target_type: targetType,
      target_id: targetId,
      reason: `[Pate State AI triage] ${reason}`.slice(0, 500),
    });
  } catch (err) {
    console.error("[community:holdForReview]", err);
  }
}

/** Medium risk: leave it up, file a report so a human glances at it. */
async function flagForReview(targetType: "thread" | "post", targetId: string, reason: string) {
  if (!isAdminConfigured) return;
  try {
    await createAdminClient().from("reports").insert({
      reporter_id: null,
      target_type: targetType,
      target_id: targetId,
      reason: `[Pate State AI triage — left visible] ${reason}`.slice(0, 500),
    });
  } catch (err) {
    console.error("[community:flagForReview]", err);
  }
}

export async function createThread(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const citizen = await getCitizen();
  if (!citizen) return { error: "Citizenship required — join free to post." };

  const board = String(formData.get("board") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const threadType = String(formData.get("thread_type") ?? "discussion").trim();
  const sourceUrl = String(formData.get("source_url") ?? "").trim() || null;

  if (title.length < 4) return { error: "Give the thread a real title (4+ characters)." };
  if (title.length > 140) return { error: "Titles cap at 140 characters." };
  if (body.length > 10000) return { error: "Posts cap at 10,000 characters." };
  const allowed = citizen.role === "staff" ? STAFF_TYPES : CITIZEN_TYPES;
  if (!allowed.has(threadType)) return { error: "That thread type is staff-only." };
  if (threadType === "news" && !sourceUrl) return { error: "News threads need a source link." };
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) return { error: "Source links must start with http(s)://." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("threads")
    .insert({ board_slug: board, author_id: citizen.id, title, body, thread_type: threadType, source_url: sourceUrl })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[community:createThread]", error?.message);
    return { error: "Couldn't post that — try again." };
  }

  const triage = await triagePost(`${title}\n\n${body}`);
  if (triage.risk === "high") {
    await holdForReview("thread", data.id, triage.reason);
    revalidatePath(`/community/${board}`);
    return { error: "That post was held for review by a human moderator." };
  }
  if (triage.risk === "medium") await flagForReview("thread", data.id, triage.reason);

  revalidatePath("/community");
  revalidatePath(`/community/${board}`);
  redirect(`/community/thread/${data.id}`);
}

export async function createPost(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const citizen = await getCitizen();
  if (!citizen) return { error: "Citizenship required — join free to reply." };

  const threadId = String(formData.get("thread_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const quoted = String(formData.get("quoted_post_id") ?? "").trim() || null;
  if (!body) return { error: "Write something first." };
  if (body.length > 10000) return { error: "Replies cap at 10,000 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .insert({ thread_id: threadId, author_id: citizen.id, body, quoted_post_id: quoted })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[community:createPost]", error?.message);
    return { error: "Couldn't reply — the thread may be locked." };
  }

  const triage = await triagePost(body);
  if (triage.risk === "high") {
    await holdForReview("post", data.id, triage.reason);
    revalidatePath(`/community/thread/${threadId}`);
    return { error: "That reply was held for review by a human moderator." };
  }
  if (triage.risk === "medium") await flagForReview("post", data.id, triage.reason);

  revalidatePath(`/community/thread/${threadId}`);
  return { saved: true };
}

export async function toggleUpvote(targetType: "thread" | "post", targetId: string, threadId: string) {
  const citizen = await getCitizen();
  if (!citizen) redirect(`/join?next=/community/thread/${threadId}`);
  const supabase = await createClient();
  const { data } = await supabase
    .from("reactions")
    .select("target_id")
    .eq("user_id", citizen!.id)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();
  if (data) {
    await supabase.from("reactions").delete()
      .eq("user_id", citizen!.id).eq("target_type", targetType).eq("target_id", targetId);
  } else {
    await supabase.from("reactions").insert({ user_id: citizen!.id, target_type: targetType, target_id: targetId });
  }
  revalidatePath(`/community/thread/${threadId}`);
}

export async function reportContent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const citizen = await getCitizen();
  if (!citizen) return { error: "Citizenship required to report." };
  const targetType = String(formData.get("target_type") ?? "");
  const targetId = String(formData.get("target_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) return { error: "Say what's wrong in a few words." };
  if (targetType !== "thread" && targetType !== "post") return { error: "Bad report target." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .insert({ reporter_id: citizen.id, target_type: targetType, target_id: targetId, reason: reason.slice(0, 500) });
  if (error) return { error: "Couldn't file that report — try again." };
  return { saved: true };
}

export async function muteUser(mutedId: string, threadId: string) {
  const citizen = await getCitizen();
  if (!citizen || citizen.id === mutedId) return;
  const supabase = await createClient();
  await supabase.from("mutes").upsert({ user_id: citizen.id, muted_id: mutedId });
  revalidatePath(`/community/thread/${threadId}`);
}

// ---- staff moderation (RLS + column-guard triggers enforce the role) -----

const THREAD_ACTIONS: Record<string, Partial<{ pinned: boolean; locked: boolean; hidden: boolean }>> = {
  pin: { pinned: true }, unpin: { pinned: false },
  lock: { locked: true }, unlock: { locked: false },
  hide: { hidden: true }, unhide: { hidden: false },
};

export async function staffThreadAction(threadId: string, action: string) {
  const patch = THREAD_ACTIONS[action];
  if (!patch) return;
  const citizen = await getCitizen();
  if (!citizen || citizen.role !== "staff") return;
  const supabase = await createClient();
  const { error } = await supabase.from("threads").update(patch).eq("id", threadId);
  if (!error) {
    await supabase.from("moderation_log").insert({
      actor_id: citizen.id, action: `thread:${action}`, target_type: "thread", target_id: threadId,
    });
  }
  revalidatePath(`/community/thread/${threadId}`);
  revalidatePath("/community");
}

export async function staffPostAction(postId: string, threadId: string, action: "hide" | "unhide") {
  const citizen = await getCitizen();
  if (!citizen || citizen.role !== "staff") return;
  const supabase = await createClient();
  const { error } = await supabase.from("posts").update({ hidden: action === "hide" }).eq("id", postId);
  if (!error) {
    await supabase.from("moderation_log").insert({
      actor_id: citizen.id, action: `post:${action}`, target_type: "post", target_id: postId,
    });
  }
  revalidatePath(`/community/thread/${threadId}`);
}

export async function resolveReport(reportId: string, status: "resolved" | "dismissed") {
  const citizen = await getCitizen();
  if (!citizen || citizen.role !== "staff") return;
  const supabase = await createClient();
  await supabase.from("reports").update({ status }).eq("id", reportId);
  await supabase.from("moderation_log").insert({
    actor_id: citizen.id, action: `report:${status}`, target_type: "report", target_id: reportId,
  });
  revalidatePath("/community/mod");
}
