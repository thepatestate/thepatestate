"use client";
import { useRef } from "react";
import Image from "next/image";
import { shortsThumb, type Short } from "@/lib/youtube";

// "Shorts from the Porch" rail (v2 brief §1.2): 6–10 vertical 9:16 thumbs in
// a horizontally scrollable strip — arrow controls on desktop, native swipe
// on mobile. Each opens the Short on YouTube.
export default function ShortsRail({ shorts }: { shorts: Short[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  if (shorts.length === 0) return null;

  const scrollBy = (dir: 1 | -1) => {
    railRef.current?.scrollBy({ left: dir * 420, behavior: "smooth" });
  };

  return (
    <div className="shorts-wrap">
      <div className="sec-head" style={{ marginTop: 30, marginBottom: 10 }}>
        <p className="eyebrow" style={{ margin: 0 }}>Shorts From the Porch</p>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" className="rail-btn" aria-label="Scroll shorts left" onClick={() => scrollBy(-1)}>←</button>
          <button type="button" className="rail-btn" aria-label="Scroll shorts right" onClick={() => scrollBy(1)}>→</button>
          <a
            className="view-all"
            href="https://www.youtube.com/@JoshPateCFB/shorts"
            target="_blank"
            rel="noopener"
          >
            More Shorts →
          </a>
        </span>
      </div>
      <div className="shorts-rail" ref={railRef}>
        {shorts.map((s) => (
          <a
            key={s.id}
            className="short-card"
            href={`https://www.youtube.com/shorts/${s.id}`}
            target="_blank"
            rel="noopener"
          >
            <Image src={shortsThumb(s.id)} alt={s.title} fill sizes="150px" style={{ objectFit: "cover" }} />
            <span className="short-scrim" />
            <span className="short-title">{s.title}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
