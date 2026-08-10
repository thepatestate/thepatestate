"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

// Hero rotating banner (v2 brief §1.1): 3–6 clickable slides, ~6s
// auto-advance, pause on hover, swipe on mobile, dot indicators, keyboard
// accessible, and no auto-advance under prefers-reduced-motion. Slides are
// resolved server-side (latest episode + Sanity heroSlide docs) and passed
// in as plain data.

export interface HeroSlideData {
  key: string;
  title: string;
  kicker?: string;
  link: string;
  imageUrl: string;
  external?: boolean;
}

const INTERVAL_MS = 6000;

export default function HeroSlider({ slides }: { slides: HeroSlideData[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);
  const touchX = useRef<number | null>(null);

  const advance = useCallback(
    (delta: number) => setIndex((i) => (i + delta + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (paused || slides.length < 2 || reduced.current) return;
    const t = setInterval(() => advance(1), INTERVAL_MS);
    return () => clearInterval(t);
  }, [paused, advance, slides.length]);

  if (slides.length === 0) return null;

  return (
    <div
      className="hero-slider"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) advance(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") advance(1);
        if (e.key === "ArrowLeft") advance(-1);
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured on The Pate State"
    >
      {slides.map((s, i) => {
        const content = (
          <>
            <Image
              src={s.imageUrl}
              alt=""
              fill
              sizes="(max-width: 900px) 100vw, 480px"
              style={{ objectFit: "cover" }}
              priority={i === 0}
            />
            <div className="hs-scrim" />
            <div className="hs-body">
              {s.kicker && <span className="hs-kicker">{s.kicker}</span>}
              <h3 className="hs-title">{s.title}</h3>
            </div>
          </>
        );
        const cls = i === index ? "hs-slide on" : "hs-slide";
        return s.external ? (
          <a key={s.key} className={cls} href={s.link} target="_blank" rel="noopener" aria-hidden={i !== index} tabIndex={i === index ? 0 : -1}>
            {content}
          </a>
        ) : (
          <Link key={s.key} className={cls} href={s.link} aria-hidden={i !== index} tabIndex={i === index ? 0 : -1}>
            {content}
          </Link>
        );
      })}
      {slides.length > 1 && (
        <div className="hs-dots" role="tablist" aria-label="Slides">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}: ${s.title}`}
              className={i === index ? "hs-dot on" : "hs-dot"}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
