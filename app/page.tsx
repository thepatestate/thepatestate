import type { Metadata } from "next";
import { getVideos, isEpisode, getShorts, getChannelStats, compactCount } from "@/lib/youtube";
import { getPublishedArticles, getWireItems } from "@/lib/sanity";
import { getSlateGames } from "@/lib/cfbd";
import { getThreads, publicClient } from "@/lib/community";
import { teamLogoUrl } from "@/lib/teams-meta";
import { createArtPicker } from "@/lib/editorial-art";
import ScoresTicker from "@/components/home/ScoresTicker";
import TopEditorial, { type LatestItem } from "@/components/home/TopEditorial";
import ActionStrip from "@/components/home/ActionStrip";
import YourTeamsBand from "@/components/home/YourTeamsBand";
import ShowSectionV5 from "@/components/home/ShowSectionV5";
import NotebookWire from "@/components/home/NotebookWire";
import PeoplesGames from "@/components/home/PeoplesGames";
import PorchSection from "@/components/home/PorchSection";
import PlaybookSection from "@/components/home/PlaybookSection";
import { StoreSection, CampusSection, TailgateSection, GiftSection, FollowSection, PlayoffsRibbon } from "@/components/home/StaticBands";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// v5 "Final Direction" homepage (spec: docs/superpowers/specs/
// 2026-08-16-homepage-v5-design.md). Every section degrades honestly: dead
// feed → EmptyState or nothing; fictional content only under DEMO_MODE.
export default async function Home() {
  const [videos, shorts, articles, wire, slate, stats, threads] = await Promise.all([
    getVideos().catch(() => []),
    getShorts(6).catch(() => []),
    getPublishedArticles(8).catch(() => []),
    getWireItems(12).catch(() => []),
    getSlateGames(1, 6).catch(() => []),
    getChannelStats().catch(() => null),
    // publicClient() itself throws when Supabase env is absent — wrap the
    // whole expression so a bare env still renders the porch join panel.
    (async () => getThreads(publicClient(), { limit: 4 }))().catch(() => []),
  ]);
  const episodes = videos.filter(isEpisode);
  const featured = episodes[0] ?? videos[0] ?? null;
  const art = createArtPicker();

  // Latest rail: the newest upload + the freshest wire items, each fully
  // clickable (story → on-site, otherwise the original source).
  const latest: LatestItem[] = [
    ...(videos[0]
      ? [{
          key: `yt-${videos[0].id}`,
          title: videos[0].title.replace(/ - Josh Pate's College Football Show/i, ""),
          href: `https://www.youtube.com/watch?v=${videos[0].id}`,
          external: true,
          thumb: { src: videos[0].thumbnail, logo: false },
          tag: "New · The Show",
        }]
      : []),
    ...wire.slice(0, 3).map((w) => {
      const logo = w.teams?.[0] ? teamLogoUrl(w.teams[0]) : null;
      return {
        key: w._id,
        title: w.headline,
        href: w.storySlug ? `/wire/${w.storySlug}` : (w.sourceUrl ?? "/wire"),
        external: !w.storySlug && Boolean(w.sourceUrl),
        thumb: logo ? { src: logo, logo: true } : { src: art.pick("generic", w.headline).src, logo: false },
        tag: `New · ${(w.category ?? "Wire").replace(/^\w/, (c: string) => c.toUpperCase())}`,
      };
    }),
  ];

  return (
    <main className="v5 v5-page">
      <ScoresTicker games={slate} />
      <TopEditorial featured={featured} trending={articles.slice(0, 4)} latest={latest} />
      <ActionStrip />
      <YourTeamsBand />
      {featured && (
        <ShowSectionV5
          featured={featured}
          rows={episodes.filter((v) => v.id !== featured.id).slice(0, 5)}
          shorts={shorts}
        />
      )}
      <NotebookWire lead={articles[0] ?? null} small={articles.slice(1, 3)} wire={wire.slice(0, 6)} />
      <PeoplesGames />
      <PorchSection threads={threads} />
      <PlaybookSection latest={featured} wireHeads={wire.slice(0, 3).map((w) => w.headline)} />
      <StoreSection />
      <CampusSection />
      <TailgateSection />
      <GiftSection />
      <FollowSection subs={stats ? compactCount(stats.subscribers) : undefined} />
      <PlayoffsRibbon />
    </main>
  );
}
