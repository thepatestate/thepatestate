import type { Metadata } from "next";
import { getVideos, isEpisode, CHANNEL_URL, APPLE_PODCASTS_URL, SPOTIFY_URL, SOCIAL_LINKS } from "@/lib/youtube";
import EpisodeLead from "@/components/EpisodeLead";
import VideoGrid from "@/components/VideoGrid";
import SubscribeCTA from "@/components/SubscribeCTA";

export const metadata: Metadata = { title: "The Show" };

// The show's actual weekly lineup — not to be confused with per-episode
// "chapters" (there aren't any hosted chapters on the channel, so no such
// section exists on this page).
const SERIES = [
  ["MON", "Weekend Truths", "Monday's honest recap"],
  ["TUE", "Poll Day", "the weekly rankings, revealed"],
  ["WED", "The Sit-Down", "long-form interviews"],
  ["THU", "Picks Drop", "the week's board, reasoned out"],
  ["FRI", "The ESPN Friday Show", "from GameDay sites"],
] as const;

export default async function ShowPage() {
  const videos = await getVideos();
  const episodes = videos.filter(isEpisode);
  const latest = episodes[0] ?? videos[0];
  // Client: "way more videos, thumbnails twice as big... complete overhaul."
  // Everything the feed returns (up to 15) other than the lead goes into one
  // dense grid below — no more splitting episodes from clips into separate,
  // thinner sections.
  const rest = videos.filter((v) => v !== latest);

  return (
    <main>
      <header className="page-head">
        <div className="wrap-wide">
          <p className="crumb">The Pate State / The Show</p>
          <h1>The Show</h1>
          <p className="lede">Every episode, every series, every platform — connected straight to YouTube, one tap from anywhere.</p>
        </div>
      </header>

      {latest && (
        <section className="on-dark tight">
          <div className="wrap-wide">
            <p className="eyebrow">Latest — watch on YouTube</p>
            <EpisodeLead
              video={latest}
              tag="LATEST EPISODE"
              priority
              description="Josh breaks down the biggest storylines of the week, straight from the porch — no debates, no hot takes, just the sport."
            />
            <div className="platforms">
              <a className="chip" href={CHANNEL_URL} target="_blank" rel="noopener">YouTube</a>
              <a className="chip" href={APPLE_PODCASTS_URL} target="_blank" rel="noopener">Apple Podcasts</a>
              <a className="chip" href={SPOTIFY_URL} target="_blank" rel="noopener">Spotify</a>
            </div>
            <div style={{ marginTop: 16 }}><SubscribeCTA /></div>
            <p className="eyebrow" style={{ marginTop: 22 }}>Follow the Porch Everywhere</p>
            <div className="platforms">
              <a className="chip" href={SOCIAL_LINKS.x} target="_blank" rel="noopener">𝕏 X</a>
              <a className="chip" href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener">Instagram</a>
              <a className="chip" href={SOCIAL_LINKS.tiktok} target="_blank" rel="noopener">TikTok</a>
            </div>
          </div>
        </section>
      )}

      <section className="tight">
        <div className="wrap-wide">
          <p className="eyebrow">The weekly series</p>
          <h2 className="display">All Week, All Season</h2>
          <div className="franchise-strip">
            {SERIES.map(([day, name, desc]) => (
              <div className="franchise-chip" key={day}>
                <span className="day">{day}</span>
                <b>{name}</b>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {rest.length > 0 && (
        <section className="on-soft">
          <div className="wrap-wide">
            <div className="sec-head">
              <div>
                <p className="eyebrow">{rest.length} more, straight from the feed</p>
                <h2 className="display">Every Episode</h2>
              </div>
              <a className="view-all" href={CHANNEL_URL} target="_blank" rel="noopener">Full Archive on YouTube →</a>
            </div>
            <VideoGrid videos={rest} sizes="(max-width: 760px) 45vw, (max-width: 1100px) 30vw, 340px" />
          </div>
        </section>
      )}
    </main>
  );
}
