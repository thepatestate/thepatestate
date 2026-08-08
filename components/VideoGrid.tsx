import { Video } from "@/lib/youtube";
import VideoCard from "./VideoCard";

export default function VideoGrid({ videos }: { videos: Video[] }) {
  if (videos.length === 0) return null;
  return (
    <div className="ep-list">
      {videos.map((v) => <VideoCard key={v.id} video={v} />)}
    </div>
  );
}
