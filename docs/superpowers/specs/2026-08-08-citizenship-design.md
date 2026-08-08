# Sub-project B: Citizenship — Design

**Date:** 2026-08-08
**Status:** Approved by Isaac (2026-08-08)
**Parent:** `2026-08-07-pate-state-weeks-1-2-design.md` (sub-project B) · behavior per
operations manual §9
**Site:** live at thepatestate.vercel.app; custom domain thepatestate.com purchased,
DNS on the project's new Cloudflare account.

## Purpose

Registered citizens are the manual's #1 metric. Ship ≤30-second signup (email
magic link + Google OAuth), a `citizens` profile table, and the reusable gating
surfaces (GateCard, 🔑 badge) the later engines hang content on. Also wire the
custom domain end-to-end, since branded auth email requires it.

## Architecture

- **Auth:** Supabase Auth via `@supabase/ssr` cookie sessions (first new runtime
  deps: `@supabase/supabase-js`, `@supabase/ssr`).
  - `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server
    components / route handlers) — the only modules that construct clients.
  - `middleware.ts` refreshes sessions; it NEVER redirects or blocks — all pages
    stay public (manual: never gate cold-traffic surfaces). Gating is opt-in per
    surface via server-side session checks.
- **Data:** `citizens` table — `id uuid PK references auth.users on delete cascade`,
  `handle text unique not null` (stored lowercase; display case preserved in
  `display_handle`), `favorite_team text null`, `joined_at timestamptz default now()`.
  RLS: owner-only select/insert/update; no public read yet (leaderboard views
  arrive with pick'em). Schema lives in `supabase/migrations/*.sql` in the repo —
  versioned, never dashboard-edited.
- **Email:** Resend is Supabase's custom SMTP; auth mail sends from
  `porch@thepatestate.com` after the domain verifies in Resend (DKIM/SPF in
  Cloudflare). Welcome/Citizen-Gift email deferred to sub-project D.
- **Domain:** thepatestate.com added to the Vercel project; Cloudflare DNS
  records per Vercel; all hardcoded `thepatestate.vercel.app` URLs collapse to
  one `SITE_URL` constant (`lib/site.ts`) consumed by layout metadataBase,
  sitemap, and robots (closes the Task-8 deferred minor).

## Flows

- **/join** — email input → `signInWithOtp` magic link, plus "Continue with
  Google" (`signInWithOAuth`). Copy tone matches the porch ("Still free,
  forever."). Expired/invalid links land back here with a retry message.
- **/auth/callback** — code exchange; if no `citizens` row exists → `/welcome`;
  else → `next` param or home.
- **/welcome** — one screen: pick handle + optional favorite team (dropdown of
  the 136, JP-Top-25 group first, reusing the scores-page team list); creates the
  `citizens` row; handle collisions surface inline.
- **/me** — handle, email, favorite team (editable), sign out. Porch "Open My
  Profile" points here.
- **Nav:** signed-out → "Become a Citizen" CTA → `/join`; signed-in → handle
  chip → `/me`. (Nav is already a client component; it checks the session
  client-side after hydration. Reading cookies in the root layout would force
  every route dynamic and destroy ISR caching — only individually gated
  surfaces, e.g. `/porch`, `/me`, `/welcome`, may render dynamically.)

## Handle rules (pure lib, `lib/handle.ts`, vitest-covered)

3–20 chars, `[a-zA-Z0-9_]`, no leading/trailing underscore, case-insensitive
uniqueness, reserved list (josh, joshpate, pate, admin, mod, thepatestate,
wiredesk, official + obvious slurs handled by a conservative blocklist).

## Gating components (built now, wired to one example)

- `GateCard` — gold-bordered card: first lines of gated content visible above it,
  copy "Still free, forever. Citizenship is just how the porch knows who's home.",
  inline join CTA carrying a `next` return path.
- `KeyBadge` (🔑) — marks citizens-only surfaces.
- Example wiring: porch mailbag submit — signed-out sees GateCard; signed-in sees
  the form (still PreseasonChip'd and engine-less; submission arrives with C/D).
- All other disabled "Become a Citizen" CTAs sitewide → live links to `/join`.

## Provider/console setup (Isaac clicks, Claude directs)

Vercel add-domain; Cloudflare DNS (Vercel records + Resend DKIM/SPF); Supabase
project keys → `.env.local` + Vercel env vars (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`; service_role stays local-only, unused by the
app); Google Cloud OAuth consent screen + web client (redirect URI
`https://<project-ref>.supabase.co/auth/v1/callback`) → Supabase Google
provider; Supabase SMTP → Resend. Secrets never in git or chat.

## Error handling

- Supabase unreachable → public pages unaffected (session resolves null);
  `/join` shows a retry message on failed OTP send.
- Magic-link expiry → `/join?error=expired` copy.
- Duplicate handle → inline error, field preserved.
- RLS denies all cross-user access by construction.

## Testing

- vitest: `lib/handle.ts` validation matrix (valid, length, charset, reserved,
  case-insensitive collisions — pure functions only).
- Auth flows verified manually against the dev server with a real inbox +
  Google account (documented in the plan's verification steps); `npm run build`
  gate as before.

## Out of scope

Apple OAuth ($99 dev account), welcome/gift email (D), any gated CONTENT beyond
the mailbag example (C/D), public citizen counts, leaderboards, badges beyond 🔑,
account deletion UI (Supabase dashboard handles support cases for now).

## Success criteria

A stranger with a Gmail account can become a citizen in under 30 seconds on
thepatestate.com, from a branded email or one Google tap; their handle survives
sign-out/sign-in; nothing public got slower or gated.
