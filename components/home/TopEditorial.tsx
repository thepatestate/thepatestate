import Link from "next/link";
import Image from "next/image";
import type { Video } from "@/lib/youtube";
import { formatDate } from "@/lib/format";

// v5 top editorial grid: Trending (numbered articles) | Featured episode |
// Latest (mixed show + wire). Columns drop independently when a source is dry.
export type LatestItem = {
  key: string;
  title: string;
  href: string;
  external: boolean;
  thumb: { src: string; logo: boolean };
  tag: string;
};

type Article = { _id: string; slug: { current: string }; headline: string; byline: string; publishedAt?: string };

export default function TopEditorial({ featured, trending, latest }: {
  featured: Video | null;
  trending: Article[];
  latest: LatestItem[];
}) {
  if (!featured && trending.length === 0 && latest.length === 0) return null;
  return (
    <section className="top-ed">
      <div className="wrap">
        <div className="top-grid">
          <div>
            <div className="col-title">Trending</div>
            {trending.map((a, i) => (
              <Link className="trend" href={`/notebook/${a.slug.current}`} key={a._id}>
                <span className="n">{String(i + 1).padStart(2, "0")}</span>
                <div><h4>{a.headline}</h4><span className="by">{a.byline}</span></div>
              </Link>
            ))}
          </div>
          {featured && (
            <a className="feat" href={`https://www.youtube.com/watch?v=${featured.id}`} target="_blank" rel="noopener">
              <div className="thumb">
                <Image src={featured.thumbnail} alt="" fill sizes="(max-width:1080px) 100vw, 600px" style={{ objectFit: "cover" }} priority />
                <span className="tag">Today&apos;s Show</span>
                <div className="playbtn"><span>▶</span></div>
              </div>
              <div className="under">
                <h1>{featured.title.replace(/ - Josh Pate's College Football Show/i, "")}</h1>
                <span className="by">Josh Pate · {formatDate(featured.published)}</span>
              </div>
            </a>
          )}
          <div className="top-col-latest">
            <div className="col-title">Latest</div>
            {latest.map((it) => {
              const [tagLead, ...tagRest] = it.tag.split("·");
              const inner = (
                <>
                  <span className={it.thumb.logo ? "th logo" : "th"}>
                    <Image src={it.thumb.src} alt="" fill sizes="88px" style={{ objectFit: it.thumb.logo ? "contain" : "cover", ...(it.thumb.logo ? { padding: 8 } : {}) }} />
                  </span>
                  <div><h4>{it.title}</h4><span className="t"><b>{tagLead.trim()}</b> · {tagRest.join("·").trim()}</span></div>
                </>
              );
              return it.external ? (
                <a className="latest-item" href={it.href} target="_blank" rel="noopener" key={it.key}>{inner}</a>
              ) : (
                <Link className="latest-item" href={it.href} key={it.key}>{inner}</Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
