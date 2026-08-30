import type { Metadata } from "next";
import { getVideos, isEpisode, getShorts, getChannelStats, compactCount } from "@/lib/youtube";
import { getPublishedArticles, getJoshArticles, getWireItems } from "@/lib/sanity";
import { getSlateGames, getTeamDirectory } from "@/lib/cfbd";
import { getThreads, publicClient } from "@/lib/community";
import { getLatestPublished, getBoardResults } from "@/lib/jp-poll";
import { teamLogoUrl } from "@/lib/teams-meta";
import { JOSH_BRACKET_FIELD } from "@/lib/josh-bracket";
import ScoresTicker from "@/components/home/ScoresTicker";
import HeroWire from "@/components/home/HeroWire";
import ShowSectionV5, { ShortsStrip } from "@/components/home/ShowSectionV5";
import PeoplesGames from "@/components/home/PeoplesGames";
import NotebookTrending, { type BracketSeed } from "@/components/home/NotebookTrending";
import PorchSection from "@/components/home/PorchSection";
import PlaybookSection from "@/components/home/PlaybookSection";
import { AnnualsSection, StoreSection, GiftSection, FollowSection } from "@/components/home/StaticBands";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// v25 "LAUNCH" homepage (spec: docs/superpowers/specs/
// 2026-08-17-v3-site-rollout-design.md). Every section degrades honestly:
// dead feed → EmptyState or nothing; fictional content only in DEMO_MODE.
export default async function Home() {
  const [videos, shorts, articles, joshArticles, wire, slate, stats, threads, jpBoard] = await Promise.all([
    getVideos().catch(() => []),
    getShorts(6).catch(() => []),
    getPublishedArticles(12).catch(() => []),
    getJoshArticles(2).catch(() => []),
    // 40-deep so the Latest rail's clickable + non-low-impact filter still
    // fills five slots on brief-heavy news days.
    getWireItems(40).catch(() => []),
    getSlateGames(1, 6).catch(() => []),
    getChannelStats().catch(() => null),
    // publicClient() itself throws when Supabase env is absent — wrap the
    // whole expression so a bare env still renders the porch join panel.
    (async () => getThreads(publicClient(), { limit: 4 }))().catch(() => []),
    getLatestPublished().catch(() => null),
  ]);
  // The Notebook holds two slots for Josh: his newest column is the feature
  // card, his second-newest takes the first stack row; staff analysis fills
  // the rest (Isaac, 2026-08-30). Falls back to the plain newest-first order
  // when no Josh-bylined article exists.
  const joshIds = new Set(joshArticles.map((a) => a._id));
  const staffArticles = articles.filter((a) => !joshIds.has(a._id));
  const notebookLead = joshArticles[0] ?? articles[0] ?? null;
  const notebookStack = [joshArticles[1], ...staffArticles].filter((a): a is NonNullable<typeof a> => Boolean(a)).filter((a) => a._id !== notebookLead?._id).slice(0, 4);
  const usedIds = new Set([notebookLead?._id, ...notebookStack.map((a) => a._id)]);
  const notebookRest = articles.filter((a) => !usedIds.has(a._id));
  const notebookTrending = notebookRest.length >= 3 ? notebookRest.slice(0, 5) : articles.slice(0, 5);
  const episodes = videos.filter(isEpisode);
  const featured = episodes[0] ?? videos[0] ?? null;
  const showEpisodes = episodes.filter((v) => v.id !== featured?.id);

  // Bracket-preview seeds: JP board top 8 when one is published; otherwise
  // Josh's on-the-record preseason bracket (Josh, 2026-08-19: the bracket
  // card always shows a bracket, never an empty slot).
  let seeds: BracketSeed[] = [];
  let seedSource: "poll" | "josh" = "poll";
  const dir = await getTeamDirectory().catch(() => ({}) as Awaited<ReturnType<typeof getTeamDirectory>>);
  if (jpBoard) {
    const results = await getBoardResults(jpBoard.id).catch(() => []);
    seeds = results.slice(0, 8).map((r) => ({
      slug: r.team_slug,
      seed: r.rank,
      name: dir[r.team_slug]?.abbrev ?? dir[r.team_slug]?.school ?? r.team_slug.replace(/-/g, " "),
      logo: dir[r.team_slug]?.logo ?? teamLogoUrl(r.team_slug),
    }));
    if (seeds.length !== 8) seeds = [];
  }
  if (seeds.length !== 8) {
    seedSource = "josh";
    seeds = JOSH_BRACKET_FIELD.slice(0, 8).map((t) => ({
      slug: t.slug,
      seed: t.seed,
      name: dir[t.slug]?.abbrev ?? t.name,
      logo: dir[t.slug]?.logo ?? teamLogoUrl(t.slug),
    }));
  }

  return (
    <main className="v5 v5-page">
      <ScoresTicker games={slate} />
      <HeroWire featured={featured} wire={wire} />
      <ShowSectionV5 episodes={showEpisodes} />
      {/* Josh, 2026-08-21: Your Saturday removed; The Notebook sits above
          The People's Games. */}
      <NotebookTrending
        lead={notebookLead}
        stack={notebookStack}
        trending={notebookTrending}
        seeds={seeds}
        seedSource={seedSource}
      />
      <PeoplesGames />
      <PorchSection threads={threads} />
      <ShortsStrip shorts={shorts} />
      <PlaybookSection />
      <AnnualsSection />
      <StoreSection />
      <GiftSection />
      <FollowSection subs={stats ? compactCount(stats.subscribers) : undefined} />
    </main>
  );
}
