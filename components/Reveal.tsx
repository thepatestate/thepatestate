"use client";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper: fades + rises its children in once, the first time
 * they enter the viewport. SSR/no-JS-safe by construction — the wrapper
 * renders with the "reveal" class only (fully visible, no transform) until
 * an IntersectionObserver arms in the browser and adds "reveal-armed". Only
 * once armed does the CSS (globals.css) hide/offset the element, so content
 * is never hidden from a crawler, a no-JS client, or a client that never
 * fires the observer for some reason. prefers-reduced-motion is handled in
 * CSS, not here — the "reveal-armed" class is harmless when the media query
 * strips the transition/transform.
 */
export default function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-in");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );

    // Arm on the next frame so the element visibly starts from its
    // pre-reveal state rather than skipping straight to "reveal-in" if
    // it's already in view on mount.
    const raf = requestAnimationFrame(() => {
      el.classList.add("reveal-armed");
      observer.observe(el);
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={className ? `reveal ${className}` : "reveal"}>
      {children}
    </div>
  );
}
