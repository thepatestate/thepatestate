"use client";
import { useEffect, useState } from "react";
import { relTime, relTimeShort } from "@/lib/format";

// Auto-refreshing relative timestamp (v2 brief §1.3): re-renders every
// minute so "2 MIN AGO" never goes stale on a long-open tab. Server renders
// the same relTime() string, so hydration starts correct. `short` renders
// the compact chip form ("6m") for tight layouts.
export default function RelTime({ iso, short }: { iso?: string; short?: boolean }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  return <>{short ? relTimeShort(iso) : relTime(iso)}</>;
}
