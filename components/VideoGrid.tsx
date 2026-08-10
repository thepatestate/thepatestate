import { Video } from "@/lib/youtube";
import VideoCard from "./VideoCard";

// `variant="stack"` is a single vertical column (homepage Show band's
// 3-episode rail); `variant="grid"` (default) is the dense multi-column
// grid used for /show's full episode list.
export default function VideoGrid({
  videos,
  variant = "grid",
  sizes,
}: {
  videos: Video[];
  variant?: "grid" | "stack";
  sizes?: string;
}) {
  if (videos.length === 0) return null;
  return (
    <div className={variant === "stack" ? "ep-stack" : "ep-grid"}>
      {videos.map((v) => <VideoCard key={v.id} video={v} sizes={sizes} />)}
    </div>
  );
}
