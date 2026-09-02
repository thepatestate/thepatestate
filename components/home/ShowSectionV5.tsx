import Link from "next/link";
import Image from "next/image";
import InlineYouTube from "@/components/InlineYouTube";
import { type Video, CHANNEL_URL, SUBSCRIBE_URL, APPLE_PODCASTS_URL } from "@/lib/youtube";
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
            <div className="ep" key={v.id}>
              {/* Plays in place — homepage video clicks stay on the page
                  (Josh, 2026-08-19). */}
              <InlineYouTube ytId={v.id} title={v.title} className="th">
                <Image src={v.thumbnail} alt="" fill sizes="(max-width:760px) 50vw, 300px" style={{ objectFit: "cover" }} />
                <span className="pl"><span>▶</span></span>
              </InlineYouTube>
              <div className="pad">
                <h4>{v.title.replace(TITLE_SUFFIX, "")}</h4>
                <div className="d">{formatDate(v.published)} · Full Episode</div>
              </div>
            </div>
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
          <h3>Shorts From the Quad</h3>
          <a href={`${CHANNEL_URL}/shorts`} target="_blank" rel="noopener">More on YouTube →</a>
        </div>
        <div className="shorts">
          {shorts.slice(0, 6).map((s) => (
            <InlineYouTube ytId={s.id} title={s.title} className="short" key={s.id}>
              {/* hqdefault exists for every video; oardefault 404s on some
                  shorts and left a grey tile (site review 2026-08-20). The
                  9:16 crop comes from objectFit on the 4:3 source. */}
              <Image src={`https://i.ytimg.com/vi/${s.id}/hqdefault.jpg`} alt="" fill sizes="(max-width:760px) 50vw, 200px" style={{ objectFit: "cover" }} />
              <span className="cap">{s.title}</span>
            </InlineYouTube>
          ))}
        </div>
      </div>
    </div>
  );
}
