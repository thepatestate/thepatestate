import { Video, videoUrl } from "@/lib/youtube";
import { formatDate } from "@/lib/format";

export default function EpisodeHero({ video, tag }: { video: Video; tag?: string }) {
  return (
    <div>
      <div className="player" style={{ display: "block", aspectRatio: "16/9" }}>
        {tag && <span className="tag">{tag}</span>}
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.id}`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ width: "100%", height: "100%", border: 0, borderRadius: 4 }}
        />
      </div>
      <h3 className="ep-title">{video.title}</h3>
      <p className="lede" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
        {formatDate(video.published)} · <a href={videoUrl(video.id)} target="_blank" rel="noopener">Watch on YouTube →</a>
      </p>
    </div>
  );
}
