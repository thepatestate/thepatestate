import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  getVideos,
  getShorts,
  isEpisode,
  videoUrl,
  shortsThumb,
  CHANNEL_URL,
  SUBSCRIBE_URL,
  APPLE_PODCASTS_URL,
  SPOTIFY_URL,
  type Video,
  type Short,
} from "@/lib/youtube";
import { formatDate } from "@/lib/format";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "Josh Pate's College Football Show",
  description: "Every episode of Josh Pate's College Football Show — the latest drop, the weekly rhythm, and the full archive.",
  alternates: { canonical: "/show" },
};

// v3 Show page (mockup: wireframes/v3/show-v2.html; styles: app/styles/
// v3-show.css, scoped .v5.pg-show). Everything on the page is live feed data
// — mockup episode titles/guests are fictional and never ship (§0.1). Chrome
// (rhythm/masthead/footer) comes from the layout.

const TITLE_SUFFIX = /\s*[-–—|·]\s*Josh Pate'?s College Football Show\s*$/i;
const cleanTitle = (t: string) => t.replace(TITLE_SUFFIX, "");

// Honest series tag, derived only from the video's real title.
function seriesTag(v: Video): string {
  if (/speaker series/i.test(v.title)) return "Speaker Series";
  if (/sit.?down/i.test(v.title)) return "The Sit-Down";
  if (/jp poll|poll day/i.test(v.title)) return "Poll Day";
  if (/\bpreview\b/i.test(v.title)) return "Season Preview";
  if (isEpisode(v)) return "Full Episode";
  return "From the Porch";
}

const SIT_RE = /sit.?down|speaker series/i;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function EpCard({ v }: { v: Video }) {
  return (
    <a className="ep" href={videoUrl(v.id)} target="_blank" rel="noopener">
      <span className="th">
        <Image src={v.thumbnail} alt="" fill sizes="(max-width:760px) 92vw, (max-width:1080px) 46vw, 380px" style={{ objectFit: "cover" }} />
        <span className="dur">▶ {isEpisode(v) ? "Full Show" : "Watch"}</span>
      </span>
      <span className="tx">
        <span className="t">{seriesTag(v)}</span>
        <h4>{cleanTitle(v.title)}</h4>
        <span className="by">{formatDate(v.published)}</span>
      </span>
    </a>
  );
}

function RowCard({ v }: { v: Video }) {
  return (
    <a className="ro" href={videoUrl(v.id)} target="_blank" rel="noopener">
      <span className="im">
        <Image src={v.thumbnail} alt="" fill sizes="150px" style={{ objectFit: "cover" }} />
      </span>
      <span className="tx">
        <span className="t">{seriesTag(v)}</span>
        <h4>{cleanTitle(v.title)}</h4>
        <span className="by">{formatDate(v.published)}</span>
      </span>
    </a>
  );
}

export default async function ShowPage() {
  const [videos, shorts] = await Promise.all([
    getVideos().catch((): Video[] => []),
    getShorts(6).catch((): Short[] => []),
  ]);

  const episodes = videos.filter(isEpisode);
  const latest = episodes[0] ?? videos[0] ?? null;
  const rest = videos.filter((v) => v.id !== latest?.id);

  // Sit-Down / Speaker Series band: real interviews from the feed only.
  const sitDowns = rest.filter((v) => SIT_RE.test(v.title)).slice(0, 2);
  const sitIds = new Set(sitDowns.map((v) => v.id));

  const now = Date.now();
  const pool = rest.filter((v) => !sitIds.has(v.id));
  const thisWeek = pool.filter((v) => now - Date.parse(v.published) < WEEK_MS).slice(0, 6);
  const weekIds = new Set(thisWeek.map((v) => v.id));
  const more = pool.filter((v) => !weekIds.has(v.id)).slice(0, 6);

  const newToday = latest !== null && now - Date.parse(latest.published) < DAY_MS;

  return (
    <main className="v5 pg-show">
      {/* PAGE HEAD */}
      <div className="phead">
        <div className="wrap">
          <div className="crumb">
            The Pate State / <b>The Show</b>
          </div>
          <div className="toprow">
            <h1>The Show</h1>
            <div className="plat">
              <a className="yt" href={SUBSCRIBE_URL} target="_blank" rel="noopener">▶ Subscribe on YouTube</a>
              <a href={APPLE_PODCASTS_URL} target="_blank" rel="noopener">Apple Podcasts</a>
              <a href={SPOTIFY_URL} target="_blank" rel="noopener">Spotify</a>
            </div>
          </div>
          <p className="sub">America&apos;s college football show — every episode and every series, new all week, all season.</p>
          {/* Section jump chips — every link goes somewhere real */}
          <div className="cats">
            {latest && <a className="cat on" href="#latest">Latest Episode</a>}
            {thisWeek.length > 0 && <a className="cat" href="#this-week">This Week</a>}
            <a className="cat" href="#sitdown">Sit-Downs &amp; Interviews</a>
            {more.length > 0 && <a className="cat" href="#more">More Episodes</a>}
            {shorts.length > 0 && <a className="cat" href="#shorts">Shorts</a>}
            <a className="cat" href={CHANNEL_URL} target="_blank" rel="noopener">Full Archive ↗</a>
          </div>
        </div>
      </div>

      {/* HERO: LATEST EPISODE */}
      <section className="heroep" id="latest">
        <div className="wrap">
          {latest ? (
            <div className="hero-grid">
              <a className="hthumb" href={videoUrl(latest.id)} target="_blank" rel="noopener">
                <Image src={latest.thumbnail} alt={cleanTitle(latest.title)} fill priority sizes="(max-width:1080px) 100vw, 700px" style={{ objectFit: "cover" }} />
                <span className="tag">{newToday ? "New Today" : "Latest Episode"}</span>
                <span className="play"><i>▶</i></span>
              </a>
              <div className="hcopy">
                <span className="k">{seriesTag(latest)}{newToday ? " · New Today" : ""}</span>
                <h2>{cleanTitle(latest.title)}</h2>
                <p className="dek">
                  Josh&apos;s honest read on the sport, straight from the porch — no debates, no manufactured
                  hot takes, just college football the way it deserves to be talked about.
                </p>
                <div className="meta">{formatDate(latest.published)}{isEpisode(latest) ? " · Full Episode" : ""}</div>
                <div className="ctas">
                  <a className="go" href={videoUrl(latest.id)} target="_blank" rel="noopener">▶ Watch on YouTube</a>
                  <a className="alt" href={SPOTIFY_URL} target="_blank" rel="noopener">Listen Instead</a>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              kicker="THE SHOW"
              title="The feed is catching its breath"
              body="New episodes drop all week, all season. The full archive is always live on YouTube."
              cta={{ href: CHANNEL_URL, label: "Watch on YouTube" }}
            />
          )}
        </div>
      </section>

      {/* THIS WEEK */}
      {thisWeek.length > 0 && (
        <section className="sect" id="this-week">
          <div className="wrap">
            <div className="sect-head">
              <span className="eb">New This Week</span>
              <h3>This Week on the Porch</h3>
              <a href={CHANNEL_URL} target="_blank" rel="noopener">Full Archive on YouTube →</a>
            </div>
            <div className="ep-grid">
              {thisWeek.map((v) => (
                <EpCard v={v} key={v.id} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* THE SIT-DOWN / SPEAKER SERIES */}
      <section className="sit" id="sitdown">
        <div className="wrap">
          <div className="sect-head">
            <span className="eb">Long-Form · One-on-One</span>
            <h3>The Sit-Down &amp; Speaker Series</h3>
            <a href={CHANNEL_URL} target="_blank" rel="noopener">All Interviews →</a>
          </div>
          {sitDowns.length > 0 ? (
            <div className="sit-grid">
              {sitDowns.map((v) => (
                <a className="sitc" href={videoUrl(v.id)} target="_blank" rel="noopener" key={v.id}>
                  <span className="im">
                    <Image src={v.thumbnail} alt="" fill sizes="168px" style={{ objectFit: "cover" }} />
                  </span>
                  <span className="tx">
                    <span className="t">{seriesTag(v)}</span>
                    <h4>{cleanTitle(v.title)}</h4>
                    <span className="by">{formatDate(v.published)} · One-on-One</span>
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <div className="sit-empty">
              <p>
                The Sit-Down is Josh one-on-one with the people who shape college football — coaches,
                players, and the sport&apos;s biggest voices — and the Pate State Speaker Series runs
                long-form, no clock. New conversations land here the moment they hit the channel.
              </p>
              <a href={CHANNEL_URL} target="_blank" rel="noopener">Browse Interviews on YouTube →</a>
            </div>
          )}
        </div>
      </section>

      {/* MORE EPISODES */}
      {more.length > 0 && (
        <section className="sect" id="more">
          <div className="wrap">
            <div className="sect-head">
              <span className="eb">Keep Watching</span>
              <h3>More Episodes</h3>
            </div>
            <div className="ro-stack">
              {more.map((v) => (
                <RowCard v={v} key={v.id} />
              ))}
            </div>
            <a className="more" href={CHANNEL_URL} target="_blank" rel="noopener">More Episodes on YouTube →</a>
          </div>
        </section>
      )}

      {/* SHORTS */}
      {shorts.length > 0 && (
        <section className="shorts-band" id="shorts">
          <div className="wrap">
            <div className="sect-head">
              <span className="eb">60 Seconds of Ball</span>
              <h3>Shorts From the Porch</h3>
              <a href={`${CHANNEL_URL}/shorts`} target="_blank" rel="noopener">More Shorts →</a>
            </div>
            <div className="sh-grid">
              {shorts.slice(0, 6).map((s) => (
                <a className="short" href={`https://www.youtube.com/shorts/${s.id}`} target="_blank" rel="noopener" key={s.id}>
                  <Image src={shortsThumb(s.id)} alt="" fill sizes="(max-width:760px) 46vw, (max-width:1080px) 31vw, 190px" style={{ objectFit: "cover" }} />
                  <span className="lbl">{s.title}</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* WATCH + READ CONVERSION BAND */}
      <section className="wb">
        <div className="wrap">
          <div className="wb-grid">
            <div className="wbc yt">
              <span className="k">▶ Never Miss an Episode</span>
              <h4>New Shows All Week, All Season.</h4>
              <p>
                Weekend Truths on Monday, Poll Day on Tuesday, the Sit-Down, Picks Drop, and the ESPN
                Friday Show — subscribe once, catch it all.
              </p>
              <a className="go" href={SUBSCRIBE_URL} target="_blank" rel="noopener">Subscribe on YouTube →</a>
            </div>
            <div className="wbc">
              <span className="k">📬 The Show, in Writing</span>
              <h4>The Whole Sport. Four Minutes. Every Morning.</h4>
              <p>
                Wake up knowing what changed, what actually matters, and what to watch next — in
                Josh&apos;s voice, in your inbox by 6 AM.
              </p>
              <Link className="go" href="/join">Send Me the Playbook →</Link>
              <Link className="alt-link" href="/notebook">Or read The Notebook →</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
