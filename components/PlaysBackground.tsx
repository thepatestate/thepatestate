"use client";

import { useEffect, useRef } from "react";

// Whiteboard X's-and-O's background (Isaac, 08-11: "add a little pop while
// tying the sections together"). Coach's plays sketch themselves and fade
// like a board that never quite gets erased. Two variants:
//  - "board": fixed, full-viewport, paints the homepage's cream ground and
//    draws ink-marker plays behind the light sections (which go translucent
//    via .plays-page CSS).
//  - "dark": absolutely positioned inside a navy band (hero / Show / tour),
//    drawing the same plays in subtle lamp-gold.
// Subtle by design — the approved intensity from the mockup. Static plays
// under prefers-reduced-motion; draws pause while offscreen.

interface Pt {
  x: number;
  y: number;
}
interface Route {
  pts: Pt[];
  accent: boolean;
}
interface Play {
  cx: number;
  cy: number;
  s: number;
  rot: number;
  os: Pt[];
  xs: Pt[];
  routes: Route[];
  born: number;
  life: number;
}

const DRAW_MS = 2600;
const FADE_MS = 1800;

export default function PlaysBackground({ variant }: { variant: "board" | "dark" }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dark = variant === "dark";
    // Approved intensities: mock "Subtle" for ink; lamp-gold reads a touch
    // dimmer on navy, so it sits slightly higher.
    const INK = dark ? 0.15 : 0.085;
    const ACCENT = dark ? 0.26 : 0.2;

    let W = 0;
    let H = 0;
    const host = dark ? (canvas.parentElement ?? canvas) : null;
    function resize() {
      if (!canvas || !ctx) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = dark ? (host as HTMLElement).clientWidth : innerWidth;
      H = dark ? (host as HTMLElement).clientHeight : innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(dark ? (host as HTMLElement) : document.documentElement);

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const wob = (n: number) => rand(-n, n);

    function makePlay(): Play {
      const s = rand(0.75, 1.2) * (W < 700 ? 0.8 : 1);
      const cx = rand(W * 0.12, W * 0.88);
      const cy = rand(H * 0.2, H * 0.8);
      const os: Pt[] = [];
      const xs: Pt[] = [];
      for (let i = -2; i <= 2; i++) os.push({ x: i * 46 * s + wob(5), y: wob(4) });
      os.push({ x: wob(8), y: 52 * s + wob(5) });
      if (Math.random() > 0.4) os.push({ x: rand(-30, 30), y: 95 * s + wob(6) });
      const nx = 4 + ((Math.random() * 3) | 0);
      for (let i = 0; i < nx; i++) xs.push({ x: rand(-110, 110) * s, y: -rand(38, 95) * s });
      const routes: Route[] = [];
      const used = new Set<number>();
      const count = 2 + (Math.random() > 0.5 ? 1 : 0);
      for (let r = 0; r < count; r++) {
        let oi: number;
        do oi = (Math.random() * 5) | 0;
        while (used.has(oi));
        used.add(oi);
        const o = os[oi];
        const dir = Math.random() > 0.5 ? 1 : -1;
        const stem = rand(60, 120) * s;
        const brk = rand(40, 110) * s;
        const pts: Pt[] = [
          { x: o.x, y: o.y - 14 * s },
          { x: o.x + wob(6), y: o.y - stem },
          { x: o.x + dir * brk, y: o.y - stem - rand(-14, 40) * s },
        ];
        if (Math.random() > 0.55) pts.push({ x: pts[2].x + dir * rand(20, 50) * s, y: pts[2].y - rand(40, 80) * s });
        routes.push({ pts, accent: r === 0 && Math.random() > 0.45 });
      }
      return { cx, cy, s, rot: rand(-0.35, 0.35), os, xs, routes, born: performance.now(), life: reduced ? Infinity : rand(9000, 13000) };
    }

    let plays: Play[] = [];
    function want(): number {
      if (dark) return H > 500 && W > 900 ? 2 : 1;
      return W > 900 ? 3 : 2;
    }
    function ensure() {
      while (plays.length < want()) {
        const p = makePlay();
        if (reduced) p.born -= DRAW_MS;
        plays.push(p);
      }
    }

    function marker(alpha: number, accent: boolean) {
      if (!ctx) return;
      ctx.strokeStyle = dark
        ? `rgba(232,163,61,${alpha})`
        : accent
          ? `rgba(184,115,24,${alpha})`
          : `rgba(24,34,52,${alpha})`;
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }

    function drawPlay(p: Play, now: number): boolean {
      if (!ctx) return false;
      const age = now - p.born;
      let alpha = 1;
      if (age > p.life) alpha = Math.max(0, 1 - (age - p.life) / FADE_MS);
      if (alpha <= 0) return false;
      const prog = reduced ? 1 : Math.min(1, age / DRAW_MS);

      ctx.save();
      ctx.translate(p.cx, p.cy);
      ctx.rotate(p.rot);

      marker(INK * alpha * 0.9, false);
      ctx.setLineDash([7, 8]);
      ctx.beginPath();
      const lw = 150 * p.s * Math.min(1, prog * 2);
      ctx.moveTo(-lw, -20 * p.s);
      ctx.lineTo(lw, -20 * p.s);
      ctx.stroke();
      ctx.setLineDash([]);

      p.os.forEach((o, i) => {
        const t = Math.min(1, Math.max(0, prog * (p.os.length + 2) - i));
        if (t <= 0) return;
        marker(INK * alpha, false);
        ctx.beginPath();
        ctx.arc(o.x, o.y, 11 * p.s * t, 0, Math.PI * 2);
        ctx.stroke();
      });
      p.xs.forEach((x, i) => {
        const t = Math.min(1, Math.max(0, prog * (p.xs.length + 2) - i - 1));
        if (t <= 0) return;
        marker(INK * alpha, false);
        const r = 9 * p.s;
        ctx.beginPath();
        ctx.moveTo(x.x - r, x.y - r);
        ctx.lineTo(x.x - r + 2 * r * t, x.y - r + 2 * r * t);
        ctx.stroke();
        if (t > 0.5) {
          const t2 = (t - 0.5) * 2;
          ctx.beginPath();
          ctx.moveTo(x.x + r, x.y - r);
          ctx.lineTo(x.x + r - 2 * r * t2, x.y - r + 2 * r * t2);
          ctx.stroke();
        }
      });

      const rprog = Math.min(1, Math.max(0, (prog - 0.4) / 0.6));
      for (const route of p.routes) {
        const pts = route.pts;
        const segs: number[] = [];
        let total = 0;
        for (let i = 1; i < pts.length; i++) {
          const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          segs.push(d);
          total += d;
        }
        let remain = total * rprog;
        marker((route.accent ? ACCENT : INK * 1.15) * alpha, route.accent);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length && remain > 0; i++) {
          const d = segs[i - 1];
          const f = Math.min(1, remain / d);
          ctx.lineTo(pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f);
          remain -= d;
        }
        ctx.stroke();
        if (rprog >= 1) {
          const a = pts[pts.length - 1];
          const b = pts[pts.length - 2];
          const ang = Math.atan2(a.y - b.y, a.x - b.x);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(a.x - 10 * Math.cos(ang - 0.45), a.y - 10 * Math.sin(ang - 0.45));
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(a.x - 10 * Math.cos(ang + 0.45), a.y - 10 * Math.sin(ang + 0.45));
          ctx.stroke();
        }
      }
      ctx.restore();
      return age <= p.life + FADE_MS;
    }

    let raf = 0;
    let visible = true;
    function frame(now: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      ensure();
      plays = plays.filter((p) => drawPlay(p, now));
      if (!reduced && visible) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    // Pause offscreen (fixed board is always onscreen; dark bands scroll).
    let io: IntersectionObserver | null = null;
    if (dark) {
      io = new IntersectionObserver(([entry]) => {
        const was = visible;
        visible = entry.isIntersecting;
        if (visible && !was && !reduced) raf = requestAnimationFrame(frame);
        if (!visible) cancelAnimationFrame(raf);
      });
      io.observe(canvas);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io?.disconnect();
    };
  }, [variant]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={variant === "board" ? "plays-board" : "plays-dark"}
    />
  );
}
