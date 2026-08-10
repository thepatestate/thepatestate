// The Porch community data layer (v2 brief §3). Two access paths:
//  - publicClient(): cookie-less anon client whose fetches opt into Next's
//    data cache (short revalidate) — used by static surfaces (homepage
//    Trending) and public reads. RLS hides hidden content from anon.
//  - the per-request server client (lib/supabase/server) — used by the
//    community pages themselves so staff see hidden content inline and
//    authors see their own held posts.
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Board {
  slug: string;
  name: string;
  kind: string;
  team_slug: string | null;
  description: string;
  sort: number;
}

export interface AuthorInfo {
  display_handle: string;
  favorite_team: string | null;
  role: string;
}

export interface ThreadSummary {
  id: string;
  board_slug: string;
  title: string;
  thread_type: string;
  pinned: boolean;
  locked: boolean;
  hidden: boolean;
  reply_count: number;
  view_count: number;
  last_reply_at: string | null;
  created_at: string;
  author_label: string | null;
  citizens: AuthorInfo | null;
}

export interface ThreadFull extends ThreadSummary {
  body: string;
  source_url: string | null;
}

export interface PostRow {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  quoted_post_id: string | null;
  hidden: boolean;
  created_at: string;
  edited_at: string | null;
  citizens: AuthorInfo | null;
}

const THREAD_COLS =
  "id, board_slug, title, thread_type, pinned, locked, hidden, reply_count, view_count, last_reply_at, created_at, author_label, citizens(display_handle, favorite_team, role)";

let cachedPublic: SupabaseClient | null = null;

/** Anonymous, cookie-less client with Next-cached fetches (120s). */
export function publicClient(): SupabaseClient {
  if (cachedPublic) return cachedPublic;
  cachedPublic = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: {
        fetch: (url, opts) =>
          fetch(url, { ...opts, next: { revalidate: 120, tags: ["community"] } } as RequestInit),
      },
    },
  );
  return cachedPublic;
}

export async function getBoards(client?: SupabaseClient): Promise<Board[]> {
  const db = client ?? publicClient();
  const { data } = await db.from("boards").select("*").order("sort");
  return (data as Board[] | null) ?? [];
}

/** Latest threads across all boards (or one board), pinned first for board
 * views, then by most recent activity. */
export async function getThreads(
  db: SupabaseClient,
  opts: { board?: string; limit?: number } = {},
): Promise<ThreadSummary[]> {
  let q = db.from("threads").select(THREAD_COLS);
  if (opts.board) q = q.eq("board_slug", opts.board).order("pinned", { ascending: false });
  const { data, error } = await q
    .order("last_reply_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 30);
  if (error) console.error("[community:getThreads]", error.message);
  return (data as unknown as ThreadSummary[] | null) ?? [];
}

export async function getThread(db: SupabaseClient, id: string): Promise<ThreadFull | null> {
  const { data } = await db
    .from("threads")
    .select(`${THREAD_COLS}, body, source_url`)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as ThreadFull | null) ?? null;
}

export async function getPosts(db: SupabaseClient, threadId: string): Promise<PostRow[]> {
  const { data } = await db
    .from("posts")
    .select("id, thread_id, author_id, body, quoted_post_id, hidden, created_at, edited_at, citizens(display_handle, favorite_team, role)")
    .eq("thread_id", threadId)
    .order("created_at")
    .limit(500);
  return (data as unknown as PostRow[] | null) ?? [];
}

/** Upvote counts for a set of targets, plus which the viewer upvoted. */
export async function getUpvotes(
  db: SupabaseClient,
  targetType: "thread" | "post",
  targetIds: string[],
  viewerId?: string | null,
): Promise<{ counts: Record<string, number>; mine: Set<string> }> {
  const counts: Record<string, number> = {};
  const mine = new Set<string>();
  if (targetIds.length === 0) return { counts, mine };
  const { data } = await db
    .from("reactions")
    .select("target_id, user_id")
    .eq("target_type", targetType)
    .in("target_id", targetIds);
  for (const r of (data as { target_id: string; user_id: string }[] | null) ?? []) {
    counts[r.target_id] = (counts[r.target_id] ?? 0) + 1;
    if (viewerId && r.user_id === viewerId) mine.add(r.target_id);
  }
  return { counts, mine };
}

/** Trending threads for the homepage (real data only — returns [] until the
 * porch has genuine activity: at least one reply or 3+ threads). */
export async function getTrendingThreads(limit = 4): Promise<ThreadSummary[]> {
  try {
    const db = publicClient();
    const { data } = await db
      .from("threads")
      .select(THREAD_COLS)
      .order("reply_count", { ascending: false })
      .order("last_reply_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    const threads = (data as unknown as ThreadSummary[] | null) ?? [];
    const active = threads.some((t) => t.reply_count > 0);
    return active || threads.length >= 3 ? threads : [];
  } catch {
    return [];
  }
}

/** The muted-author set for a viewer (client-filtered; RLS scopes rows). */
export async function getMutedIds(db: SupabaseClient): Promise<Set<string>> {
  const { data } = await db.from("mutes").select("muted_id");
  return new Set(((data as { muted_id: string }[] | null) ?? []).map((m) => m.muted_id));
}

export const THREAD_TYPE_LABELS: Record<string, string> = {
  discussion: "Discussion",
  question: "Question",
  poll: "Poll",
  prediction: "Prediction",
  news: "Breaking News",
  rumor: "Rumor",
  game: "Game Thread",
  staff: "Staff",
};
