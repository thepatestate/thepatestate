"use client";

import { useEffect, useRef } from "react";

// ESPN-style article roll: when the reader scrolls past the end of the
// piece, the next article (server-rendered into a hidden container by the
// page) reveals in place and the URL/title quietly update to it — reading
// never has to stop at a dead end. One roll per pageview; the revealed
// article ends in a normal link that starts the next chain.

export default function UpNextRoll({
  contentId,
  nextPath,
  nextTitle,
  nextHeadline,
  nextDek,
}: {
  /** id of the hidden server-rendered next-article container */
  contentId: string;
  nextPath: string;
  nextTitle: string;
  nextHeadline: string;
  nextDek?: string;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const revealed = useRef(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || revealed.current) return;
        const el = document.getElementById(contentId);
        if (!el) return;
        revealed.current = true;
        el.hidden = false;
        history.replaceState(history.state, "", nextPath);
        document.title = nextTitle;
        io.disconnect();
      },
      { rootMargin: "120px 0px" },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [contentId, nextPath, nextTitle]);

  return (
    <div className="upnext-teaser">
      <span className="upnext-kicker">Up Next — Keep Scrolling</span>
      <b className="upnext-headline">{nextHeadline}</b>
      {nextDek && <span className="upnext-dek">{nextDek}</span>}
      <div ref={sentinelRef} aria-hidden="true" />
    </div>
  );
}
