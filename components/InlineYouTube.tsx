"use client";
import { useState, type ReactNode } from "react";

// Click-to-play YouTube embed (Josh, 2026-08-19: homepage videos "should
// just play, not go to YouTube"). Renders its children (thumbnail + play
// affordance) until clicked, then swaps in an autoplaying privacy-enhanced
// embed filling the same box. The wrapping element keeps whatever layout
// classes the section already uses, so existing CSS applies unchanged.
export default function InlineYouTube({ ytId, title, className, children }: {
  ytId: string;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  const [playing, setPlaying] = useState(false);
  if (playing) {
    return (
      <span className={className ? `${className} yt-inline` : "yt-inline"}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&playsinline=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </span>
    );
  }
  return (
    <span
      className={className ? `${className} yt-inline` : "yt-inline"}
      role="button"
      tabIndex={0}
      aria-label={`Play: ${title}`}
      onClick={() => setPlaying(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setPlaying(true);
        }
      }}
    >
      {children}
    </span>
  );
}
