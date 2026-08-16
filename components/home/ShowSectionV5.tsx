import Image from "next/image";
import {
  type Video, type Short, shortsThumb, videoUrl,
  CHANNEL_URL, SUBSCRIBE_URL, APPLE_PODCASTS_URL, SPOTIFY_URL,
} from "@/lib/youtube";
import { formatDate } from "@/lib/format";

// v5 "The Show": featured episode + stacked rows, dark Shorts band, platform
// chips. All video links are external to YouTube (the show lives there).
const TITLE_SUFFIX = / - Josh Pate's College Football Show/i;

export default function ShowSectionV5({ featured, rows, shorts }: {
  featured: Video;
  rows: Video[];
  shorts: Short[];
}) {
  return (
    <section className="show" id="show">
      <div className="wrap">
        <div className="sect-head">
          <div>
            <div className="eyebrow">America&apos;s College Football Show</div>
            <h2>The Show</h2>
          </div>
          <a className="more" href={CHANNEL_URL} target="_blank" rel="noopener">Much More on YouTube →</a>
        </div>

        <div className="show-grid">
          <a className="sh-feat" href={videoUrl(featured.id)} target="_blank" rel="noopener">
            <div className="thumb">
              <Image src={featured.thumbnail} alt="" fill sizes="(max-width:1080px) 100vw, 680px" style={{ objectFit: "cover" }} />
              <span className="tag">Full Show</span>
              <div className="playbtn"><span>▶</span></div>
            </div>
            <h3>{featured.title.replace(TITLE_SUFFIX, "")}</h3>
            <span className="by">Josh Pate · {formatDate(featured.published)}</span>
          </a>

          <div className="sh-list">
            {rows.map((v) => (
              <a className="sh-row" href={videoUrl(v.id)} target="_blank" rel="noopener" key={v.id}>
                <span className="th">
                  <Image src={v.thumbnail} alt="" fill sizes="158px" style={{ objectFit: "cover" }} />
                  <span className="pl"><span>▶</span></span>
                </span>
                <div>
                  <h4>{v.title.replace(TITLE_SUFFIX, "")}</h4>
                  <span className="by">The Show · {formatDate(v.published)}</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        {shorts.length > 0 && (
          <div className="shorts-band">
            <div className="shorts-h">
              <h3>Shorts From the Porch</h3>
              <a href={`${CHANNEL_URL}/shorts`} target="_blank" rel="noopener">More Shorts →</a>
            </div>
            <div className="shorts">
              {shorts.slice(0, 6).map((s) => (
                <a className="short" href={`https://www.youtube.com/shorts/${s.id}`} target="_blank" rel="noopener" key={s.id}>
                  <Image src={shortsThumb(s.id)} alt="" fill sizes="(max-width:760px) 50vw, 180px" style={{ objectFit: "cover" }} />
                  <span className="cap">{s.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="platforms">
          <span className="plbl">Listen &amp; Watch:</span>
          <a href={SUBSCRIBE_URL} target="_blank" rel="noopener">▶ YouTube</a>
          <a href={APPLE_PODCASTS_URL} target="_blank" rel="noopener">Apple Podcasts</a>
          <a href={SPOTIFY_URL} target="_blank" rel="noopener">Spotify</a>
        </div>
      </div>
    </section>
  );
}
