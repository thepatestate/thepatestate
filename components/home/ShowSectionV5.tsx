import Link from "next/link";
import Image from "next/image";
import { type Video, videoUrl, CHANNEL_URL, SUBSCRIBE_URL, APPLE_PODCASTS_URL } from "@/lib/youtube";
import { formatDate } from "@/lib/format";

// v25 "The Josh Pate Show": centered premium band — four episode cards the
// hero is NOT in, plus watch/listen/all actions.
const TITLE_SUFFIX = / - Josh Pate's College Football Show/i;

export default function ShowSectionV5({ episodes }: { episodes: Video[] }) {
  if (episodes.length === 0) return null;
  return (
    <section className="show" id="show">
      <div className="wrap">
        <div className="head">
          <div className="eyebrow">America&apos;s College Football Show</div>
          <h2>The Josh Pate Show</h2>
          <div className="rule" />
        </div>
        <div className="ep-grid">
          {episodes.slice(0, 4).map((v) => (
            <a className="ep" href={videoUrl(v.id)} target="_blank" rel="noopener" key={v.id}>
              <span className="th">
                <Image src={v.thumbnail} alt="" fill sizes="(max-width:760px) 50vw, 300px" style={{ objectFit: "cover" }} />
                <span className="pl"><span>▶</span></span>
              </span>
              <div className="pad">
                <h4>{v.title.replace(TITLE_SUFFIX, "")}</h4>
                <div className="d">{formatDate(v.published)} · Full Episode</div>
              </div>
            </a>
          ))}
        </div>
        <div className="actions">
          <a className="watch" href={SUBSCRIBE_URL} target="_blank" rel="noopener">▶ Watch on YouTube</a>
          <a className="listen" href={APPLE_PODCASTS_URL} target="_blank" rel="noopener">Listen · Apple &amp; Spotify</a>
          <Link className="all" href="/show">See All Episodes →</Link>
        </div>
      </div>
    </section>
  );
}

export function ShortsStrip({ shorts }: { shorts: { id: string; title: string }[] }) {
  if (shorts.length === 0) return null;
  return (
    <div className="v5 shorts-strip">
      <div className="wrap">
        <div className="shorts-h">
          <h3>Shorts From the Porch</h3>
          <a href={`${CHANNEL_URL}/shorts`} target="_blank" rel="noopener">More on YouTube →</a>
        </div>
        <div className="shorts">
          {shorts.slice(0, 6).map((s) => (
            <a className="short" href={`https://www.youtube.com/shorts/${s.id}`} target="_blank" rel="noopener" key={s.id}>
              <Image src={`https://i.ytimg.com/vi/${s.id}/oardefault.jpg`} alt="" fill sizes="(max-width:760px) 50vw, 200px" style={{ objectFit: "cover" }} />
              <span className="cap">{s.title}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
