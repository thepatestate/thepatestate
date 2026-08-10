"use client";
import { useRef } from "react";

// Generic horizontal media rail with arrow controls — used where a grid
// would strand orphan tiles on a second row (e.g. More Episodes). Children
// are fixed-width cards; the rail scrolls, so any count of items lays out
// clean at any viewport width.
export default function MediaRail({ children, label }: { children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * 640, behavior: "smooth" });
  return (
    <div>
      <div className="sec-head" style={{ marginTop: 26, marginBottom: 10 }}>
        <p className="eyebrow" style={{ margin: 0 }}>{label}</p>
        <span style={{ display: "flex", gap: 10 }}>
          <button type="button" className="rail-btn" aria-label={`Scroll ${label} left`} onClick={() => scrollBy(-1)}>←</button>
          <button type="button" className="rail-btn" aria-label={`Scroll ${label} right`} onClick={() => scrollBy(1)}>→</button>
        </span>
      </div>
      <div className="media-rail" ref={ref}>
        {children}
      </div>
    </div>
  );
}
