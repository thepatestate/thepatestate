import Image from "next/image";
import { Video, videoUrl } from "@/lib/youtube";
import { formatDate } from "@/lib/format";

// ESPN-Watch-style lead video: a big clickable thumbnail (never an embedded
// iframe) that opens the episode straight on YouTube, with the title/date
// rendered below it. Replaces the old EpisodeHero <iframe> lead wherever the
// client asked for a thumbnail-driven browse experience (homepage Show band,
// /show page lead). `priority` loads the thumbnail eagerly for above-the-fold
// placements.
export default function EpisodeLead({
  video,
  tag = "NEW EPISODE",
  priority = false,
  description,
}: {
  video: Video;
  tag?: string;
  priority?: boolean;
  description?: string;
}) {
  return (
    <div>
      <a className="player" href={videoUrl(video.id)} target="_blank" rel="noopener" aria-label={`Watch ${video.title} on YouTube`}>
        <span className="tag">{tag}</span>
        <Image
          src={video.thumbnail}
          alt=""
          fill
          sizes="(max-width: 900px) 100vw, 720px"
          style={{ objectFit: "cover" }}
          priority={priority}
        />
        <span className="playbtn">▶</span>
      </a>
      <h3 className="ep-title">
        <a href={videoUrl(video.id)} target="_blank" rel="noopener">{video.title}</a>
      </h3>
      {description && <p className="lede" style={{ marginTop: 4, marginBottom: 10 }}>{description}</p>}
      <p className="lede" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
        {formatDate(video.published)} · <a href={videoUrl(video.id)} target="_blank" rel="noopener">Watch on YouTube →</a>
      </p>
    </div>
  );
}
