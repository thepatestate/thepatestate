import Image from "next/image";
import { Video, videoUrl } from "@/lib/youtube";
import { formatDate } from "@/lib/format";

export default function VideoCard({ video }: { video: Video }) {
  return (
    <a className="ep" href={videoUrl(video.id)} target="_blank" rel="noopener">
      <span className="thumb" style={{ position: "relative", overflow: "hidden" }}>
        <Image src={video.thumbnail} alt="" fill style={{ objectFit: "cover" }} sizes="96px" />
      </span>
      <span>
        <h4>{video.title}</h4>
        <span className="meta">{formatDate(video.published)} · YOUTUBE</span>
      </span>
    </a>
  );
}
