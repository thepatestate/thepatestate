import Image from "next/image";
import { Video, videoUrl } from "@/lib/youtube";
import { formatDate } from "@/lib/format";

// Thumbnail-ON-TOP episode card — photo above, title + date below — per the
// client's "ESPN Watch" reference (thumbnails twice as big, no side-by-side
// rows). `sizes` is a prop so callers in different grid widths (homepage
// rail vs. /show's dense multi-column grid) can size the responsive image
// correctly instead of over-fetching.
export default function VideoCard({ video, sizes = "(max-width: 760px) 90vw, 320px" }: { video: Video; sizes?: string }) {
  return (
    <a className="ep-card" href={videoUrl(video.id)} target="_blank" rel="noopener">
      <span className="ep-thumb">
        <Image src={video.thumbnail} alt="" fill sizes={sizes} style={{ objectFit: "cover" }} />
      </span>
      <h4>{video.title}</h4>
      <span className="meta">{formatDate(video.published)} · YOUTUBE</span>
    </a>
  );
}
