import Image from "next/image";
import Link from "next/link";
import EpisodeLead from "@/components/EpisodeLead";
import ShortsRail from "@/components/ShortsRail";
import MediaRail from "@/components/MediaRail";
import { videoUrl, CHANNEL_URL, APPLE_PODCASTS_URL, SPOTIFY_URL, type Video, type Short } from "@/lib/youtube";
import { formatDate } from "@/lib/format";

// The Show section (v2 brief §1.2), modeled on a best-in-class Watch layout:
// featured episode (~60%) + 3 stacked rows with thumbnails (~40%) + a More
// Episodes row + the Shorts rail — 12–16 clickable videos total, all pulled
// automatically from the channel. Shared by the homepage; /show renders its
// own denser archive.

function StackRow({ v }: { v: Video }) {
  return (
    <a className="epi-row" href={videoUrl(v.id)} target="_blank" rel="noopener">
      <span className="epi-txt">
        <b>{v.title.replace(/ - Josh Pate's College Football Show/i, "")}</b>
        <span className="epi-meta">▶ WATCH NOW · {formatDate(v.published).toUpperCase()}</span>
      </span>
      <span className="epi-thumb">
        <Image src={v.thumbnail} alt="" fill sizes="150px" style={{ objectFit: "cover" }} />
      </span>
    </a>
  );
}

export default function ShowSection({
  latest,
  stacked,
  more,
  shorts,
}: {
  latest: Video;
  stacked: Video[];
  more: Video[];
  shorts: Short[];
}) {
  return (
    <section className="on-dark">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <p className="eyebrow">America&apos;s College Football Show</p>
            <h2 className="display">The Show</h2>
          </div>
          <a className="view-all" href={CHANNEL_URL} target="_blank" rel="noopener">
            MUCH MORE ON YOUTUBE →
          </a>
        </div>
        <div className="show-grid2">
          <div>
            <EpisodeLead video={latest} tag="NEW EPISODE" priority />
            <div className="platforms">
              <a className="chip" href={CHANNEL_URL} target="_blank" rel="noopener">YouTube</a>
              <a className="chip" href={APPLE_PODCASTS_URL} target="_blank" rel="noopener">Apple Podcasts</a>
              <a className="chip" href={SPOTIFY_URL} target="_blank" rel="noopener">Spotify</a>
            </div>
          </div>
          <div className="epi-stack">
            {stacked.map((v) => <StackRow v={v} key={v.id} />)}
          </div>
        </div>

        {more.length > 0 && (
          <MediaRail label="More Episodes">
            {more.map((v) => (
              <a key={v.id} className="more-ep" href={videoUrl(v.id)} target="_blank" rel="noopener">
                <span className="me-thumb">
                  <Image src={v.thumbnail} alt="" fill sizes="220px" style={{ objectFit: "cover" }} />
                </span>
                <b>{v.title.replace(/ - Josh Pate's College Football Show/i, "")}</b>
                <span className="me-date">{formatDate(v.published).toUpperCase()}</span>
              </a>
            ))}
          </MediaRail>
        )}

        <ShortsRail shorts={shorts} />

        <p className="sched">
          <b>MON</b> Weekend Truths · <b>TUE</b> Poll Day · <b>WED</b> The Sit-Down ·{" "}
          <b>THU</b> Picks Drop · <b>FRI</b> The ESPN Show · <b>SAT</b> We Watch Ball
        </p>
        <p style={{ marginTop: 20 }}>
          <Link className="btn" href="/show">Browse Every Episode</Link>
        </p>
      </div>
    </section>
  );
}
