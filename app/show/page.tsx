import type { Metadata } from "next";
import { getVideos, isEpisode, CHANNEL_URL, APPLE_PODCASTS_URL, SPOTIFY_URL, SOCIAL_LINKS } from "@/lib/youtube";
import EpisodeHero from "@/components/EpisodeHero";
import VideoGrid from "@/components/VideoGrid";
import SubscribeCTA from "@/components/SubscribeCTA";

export const metadata: Metadata = { title: "The Show" };

const SERIES = [
  ["MON", "Weekend Truths", "Monday's honest recap"],
  ["TUE", "Poll Day", "the weekly rankings, revealed"],
  ["WED", "The Sit-Down", "long-form interviews"],
  ["THU", "Picks Drop", "the week's board, reasoned out"],
  ["FRI", "The ESPN Friday Show", "from GameDay sites"],
];

export default async function ShowPage() {
  const videos = await getVideos();
  const episodes = videos.filter(isEpisode);
  const clips = videos.filter((v) => !isEpisode(v)).slice(0, 6);
  const latest = episodes[0] ?? videos[0];
  const rest = episodes.filter((v) => v !== latest).slice(0, 8);

  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / The Show</p>
          <h1>The Show</h1>
          <p className="lede">Every episode, every series, every platform — connected straight to YouTube, one tap from anywhere.</p>
        </div>
      </header>

      {latest && (
        <section className="on-dark tight">
          <div className="wrap">
            <p className="eyebrow">Latest — watch on YouTube</p>
            <EpisodeHero video={latest} />
            <div className="platforms">
              <a className="chip" href={CHANNEL_URL} target="_blank" rel="noopener">YouTube</a>
              <a className="chip" href={APPLE_PODCASTS_URL} target="_blank" rel="noopener">Apple Podcasts</a>
              <a className="chip" href={SPOTIFY_URL} target="_blank" rel="noopener">Spotify</a>
            </div>
            <div style={{ marginTop: 18 }}><SubscribeCTA /></div>
            <p className="eyebrow" style={{ marginTop: 24 }}>Follow the Porch Everywhere</p>
            <div className="platforms">
              <a className="chip" href={SOCIAL_LINKS.x} target="_blank" rel="noopener">𝕏 X</a>
              <a className="chip" href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener">Instagram</a>
              <a className="chip" href={SOCIAL_LINKS.tiktok} target="_blank" rel="noopener">TikTok</a>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="wrap">
          <p className="eyebrow">The weekly series</p>
          <h2 className="display">All Week, All Season</h2>
          <table>
            <tbody>
              {SERIES.map(([day, name, desc]) => (
                <tr key={day}><td className="rk">{day}</td><td><b>{name}</b> — {desc}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {rest.length > 0 && (
        <section className="on-soft tight">
          <div className="wrap">
            <p className="eyebrow">Latest drops</p>
            <h2 className="display">Recent Episodes</h2>
            <div className="ep-light"><VideoGrid videos={rest} /></div>
          </div>
        </section>
      )}

      {clips.length > 0 && (
        <section className="tight">
          <div className="wrap">
            <p className="eyebrow">60-second porch</p>
            <h2 className="display">Clips &amp; Shorts</h2>
            <div className="ep-light"><VideoGrid videos={clips} /></div>
            <p style={{ marginTop: 24 }}>
              <a className="btn" href={CHANNEL_URL} target="_blank" rel="noopener">Full Archive on YouTube →</a>
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
