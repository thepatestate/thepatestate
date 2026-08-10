// Demo-data policy (v2 brief §0.1 — highest priority): placeholder stats,
// leaderboards, streaks, fake timestamps, poll numbers, and contest results
// may render ONLY when this flag is on. Production leaves it off, so every
// module shows real data or a polished empty state (components/EmptyState).
//
// The flag is baked at build time: set NEXT_PUBLIC_DEMO_MODE=true on Vercel
// Preview (owner walkthroughs) and locally; leave it unset on Production.
// `next dev` always allows demo data so the full layout stays reviewable.
export const DEMO_MODE =
  process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.NODE_ENV === "development";
