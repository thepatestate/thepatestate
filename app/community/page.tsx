import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  getBoards,
  getThreads,
  getTrendingThreads,
  publicClient,
  type Board,
  type ThreadSummary,
} from "@/lib/community";
import { teamLogoUrl } from "@/lib/teams-meta";
import RelTime from "@/components/RelTime";

export const metadata: Metadata = {
  title: "The Porch — Community",
  description:
    "The Pate State's community boards: the national Front Porch, recruiting and portal talk, game threads, the Film Room, and a porch for every fanbase.",
  alternates: { canonical: "/community" },
};

// Community home, v3 "The Porch" comp (wireframes/v3/community-v1.html).
// Public reads via publicClient() (anon, Next-cached); RLS hides held
// content from anon, and we filter `hidden` client-side as a belt.
const BOARD_ICONS: Record<string, string> = {
  national: "\u{1FA91}", // 🪑
  recruiting: "\u{1F575}\u{FE0F}", // 🕵️
  gameday: "\u{1F3C8}", // 🏈
  film: "\u{1F3AC}", // 🎬
  fantasy: "\u{1F3B2}", // 🎲
  askjosh: "\u{1F4EC}", // 📬
  team: "\u{1F3DF}", // 🏟
};

const HOUR = 3600_000;

function authorName(t: ThreadSummary): string {
  return t.author_label ?? t.citizens?.display_handle ?? "a citizen";
}

function isHot(t: ThreadSummary): boolean {
  return (
    t.reply_count >= 5 ||
    (t.last_reply_at !== null && Date.now() - new Date(t.last_reply_at).getTime() < HOUR)
  );
}

// publicClient() throws when Supabase env is absent (e.g. bare local
// builds) — every porch read funnels through this guard.
async function loadPorch(): Promise<{
  boards: Board[];
  threads: ThreadSummary[];
  trending: ThreadSummary[];
}> {
  try {
    const db = publicClient();
    const [boards, threads, trending] = await Promise.all([
      getBoards(db),
      getThreads(db, { limit: 12 }),
      getTrendingThreads(4),
    ]);
    return { boards, threads, trending };
  } catch {
    return { boards: [], threads: [], trending: [] };
  }
}

function ThreadRow({ thread, board }: { thread: ThreadSummary; board?: Board }) {
  const logo = board?.kind === "team" && board.team_slug ? teamLogoUrl(board.team_slug) : null;
  const hot = isHot(thread);
  const lastActivity = thread.last_reply_at ?? thread.created_at;
  return (
    <Link className="trow" href={`/community/thread/${thread.id}`}>
      <span className="tg">
        {logo ? (
          <Image src={logo} alt="" width={24} height={24} style={{ objectFit: "contain" }} />
        ) : (
          BOARD_ICONS[board?.kind ?? "national"] ?? BOARD_ICONS.national
        )}
      </span>
      <div>
        <span className="t">
          {hot && <span className="hot">{"\u{1F525}"} Hot · </span>}
          {board?.name ?? thread.board_slug}
          {thread.pinned && " · Pinned"}
          {thread.locked && " · Locked"}
        </span>
        <h4>{thread.title}</h4>
        <span className="by">Started by {authorName(thread)}</span>
      </div>
      <span className="rep">
        <b>{thread.reply_count}</b>
        <span>{thread.reply_count === 1 ? "Reply" : "Replies"}</span>
        <span className="ago">
          <RelTime iso={lastActivity} />
        </span>
      </span>
    </Link>
  );
}

export default async function CommunityPage() {
  const { boards, threads, trending } = await loadPorch();

  const visible = threads.filter((t) => !t.hidden);
  const hotNow = visible.some(
    (t) => t.last_reply_at !== null && Date.now() - new Date(t.last_reply_at).getTime() < HOUR,
  );
  const national = boards.filter((b) => b.kind !== "team");
  const teamBoards = boards.filter((b) => b.kind === "team");
  const teamTiles = teamBoards
    .map((b) => ({ board: b, logo: b.team_slug ? teamLogoUrl(b.team_slug) : null }))
    .filter((x): x is { board: Board; logo: string } => x.logo !== null)
    .slice(0, 8);
  const gamedayBoards = boards.filter((b) => b.kind === "gameday");
  const startBoard = national[0] ?? boards[0] ?? null;
  const introHref = startBoard ? `/community/${startBoard.slug}` : "/join?next=/community";
  const boardFor = (slug: string) => boards.find((b) => b.slug === slug);
  const trendingVisible = trending.filter((t) => !t.hidden);

  return (
    <main className="v5 pg-community">
      {/* ── page head ── */}
      <div className="phead">
        <div className="wrap">
          <div className="crumb">
            The Pate State / <b>The Porch</b>
          </div>
          <h1>The Porch</h1>
          <p className="sub">
            The comment section, if the comment section had manners — team threads, poll arguments,
            and gameday chats, moderated like a front porch, not a mosh pit.
          </p>
          <div className="status">
            {/* No presence service yet — the honest pill, never an invented count. */}
            <span className="st live">The Porch Is Open</span>
            <span className="st rule">Every Take Signed · House Rules Apply</span>
          </div>
          <div className="cats">
            <Link className="cat on" href="/community">
              All Threads
            </Link>
            {national.map((b) => (
              <Link key={b.slug} className="cat" href={`/community/${b.slug}`}>
                {b.name}
              </Link>
            ))}
            {teamTiles.length > 0 && (
              <a className="cat" href="#team-porches">
                Team Porches
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── start here ── */}
      <section className="start">
        <div className="wrap">
          <div className="shd">{"\u{1FA91}"} New to the Porch? Start Here</div>
          <div className="start-grid">
            <Link className="stc" href="/standards">
              <span className="ic">{"\u{1F4DC}"}</span>
              <div>
                <h4>House Rules, Short Version</h4>
                <span>Two minutes. Signed takes, no bots, no brawls.</span>
              </div>
            </Link>
            <Link className="stc" href={introHref}>
              <span className="ic">{"\u{1F44B}"}</span>
              <div>
                <h4>Introduce Yourself</h4>
                <span>Name, team, and the take you&apos;ll defend all season.</span>
              </div>
            </Link>
            {teamTiles.length > 0 ? (
              <a className="stc" href="#team-porches">
                <span className="ic">{"\u{1F3DF}"}</span>
                <div>
                  <h4>Find Your Team&apos;s Porch</h4>
                  <span>Pick your program&apos;s board and claim your seat.</span>
                </div>
              </a>
            ) : (
              <Link className="stc" href="/me">
                <span className="ic">{"\u{1F3DF}"}</span>
                <div>
                  <h4>Set My Teams</h4>
                  <span>Follow your programs and your porches rise to the top.</span>
                </div>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── threads + rail ── */}
      <section className="feedsec">
        <div className="wrap">
          <div className="feed-grid">
            <div>
              <div className="fh">
                <h3>{hotNow ? "Live Threads" : "Latest Threads"}</h3>
                {hotNow && <span className="live">Active Now</span>}
                <div className="ln" />
                <Link className="new" href={introHref}>
                  {"＋"} Start a Thread
                </Link>
              </div>
              {visible.length === 0 ? (
                <div className="porch-empty">
                  <span className="k">The Porch Is Open</span>
                  <h4>Somebody has to say the first word</h4>
                  <p>
                    Pick a board and start the first thread — the porch remembers its founders.
                    Citizenship is free, and that&apos;s the only ticket in.
                  </p>
                </div>
              ) : (
                <div className="th-stack">
                  {visible.map((t) => (
                    <ThreadRow key={t.id} thread={t} board={boardFor(t.board_slug)} />
                  ))}
                </div>
              )}
              {startBoard && visible.length > 0 && (
                <Link className="morelink" href={`/community/${startBoard.slug}`}>
                  More Threads {"→"}
                </Link>
              )}
            </div>

            <div className="rail">
              <div className="rules">
                <span className="k">{"\u{1F4DC}"} The Short Version</span>
                <h4>How the Porch Stays the Porch</h4>
                <div className="r">
                  <b>01</b>Every take is signed. No anonymous drive-bys, no bots.
                </div>
                <div className="r">
                  <b>02</b>Argue the take, not the person. Rivals welcome; jerks aren&apos;t.
                </div>
                <div className="r">
                  <b>03</b>Moderated like a front porch — the Porch Desk keeps the peace.
                </div>
                <Link className="ln" href="/standards">
                  Full House Rules {"→"}
                </Link>
              </div>

              {trendingVisible.length > 0 && (
                <div className="trend">
                  <span className="k">{"\u{1F525}"} Trending</span>
                  <h4>Loudest on the Porch</h4>
                  {trendingVisible.map((t) => (
                    <Link key={t.id} className="ti" href={`/community/thread/${t.id}`}>
                      <b>{t.title}</b>
                      <span>
                        {t.reply_count} {t.reply_count === 1 ? "reply" : "replies"}
                        {t.last_reply_at && (
                          <>
                            {" · "}
                            <RelTime iso={t.last_reply_at} />
                          </>
                        )}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {teamTiles.length > 0 && (
                <div className="tp" id="team-porches">
                  <span className="k">{"\u{1F3DF}"} Team Porches</span>
                  <h4>Find Your Program&apos;s Thread</h4>
                  <div className="tp-grid">
                    {teamTiles.map(({ board, logo }) => (
                      <Link key={board.slug} href={`/community/${board.slug}`} title={board.name}>
                        <Image src={logo} alt={board.name} width={26} height={26} />
                      </Link>
                    ))}
                  </div>
                  <p className="note">
                    More team porches open as their fanbases show up ·{" "}
                    <Link href="/me">set My Teams</Link> and yours rise to the top.
                  </p>
                </div>
              )}

              <div className="jc">
                <span className="k">{"\u{1FA91}"} Citizens Only</span>
                <h4>Pull Up a Chair.</h4>
                <p>
                  Posting is free with citizenship — every take signed, every citizen accountable.
                  Reading is open to everybody.
                </p>
                <Link className="go" href="/join?next=/community">
                  Join Free &amp; Post {"→"}
                </Link>
                <div className="pf">Free forever · house rules apply</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── gameday band ── */}
      <section className="gd">
        <div className="wrap">
          <div className="gd-grid">
            <div>
              <span className="k">Saturdays on the Porch</span>
              <h3>Every Saturday Gets a Live Porch.</h3>
              <p>
                Live game threads for the big Saturday slates, argued out in real time with the
                whole State. Rooms open on gameday mornings.
              </p>
            </div>
            {gamedayBoards.length > 0 ? (
              <div className={gamedayBoards.length < 3 ? "win-grid solo" : "win-grid"}>
                {gamedayBoards.map((b) => (
                  <Link key={b.slug} className="win" href={`/community/${b.slug}`}>
                    <div className="tm">{b.name}</div>
                    <div className="lb">Live Game Threads</div>
                    <div className="op">{b.description}</div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="win-grid solo">
                <Link className="win" href="/community">
                  <div className="tm">Saturdays</div>
                  <div className="lb">Game Threads Live Here</div>
                  <div className="op">Rooms open when the slate kicks off</div>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
