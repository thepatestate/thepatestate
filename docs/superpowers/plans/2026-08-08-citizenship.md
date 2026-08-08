# Citizenship (Sub-project B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ≤30-second citizen signup (email magic link + Google OAuth) on thepatestate.com, backed by a `citizens` table with owner-only RLS, plus the reusable gating surfaces (GateCard, 🔑 badge) and the custom-domain wiring.

**Architecture:** Supabase Auth via `@supabase/ssr` cookie sessions. `lib/supabase/{client,server}.ts` are the only modules constructing clients; a root `middleware.ts` refreshes sessions and NEVER redirects. Public pages stay static (Nav checks session client-side); only `/me`, `/welcome`, `/porch`, and `/auth/callback` render dynamically. Schema lives in `supabase/migrations/*.sql`, applied with `npx supabase db push --db-url`.

**Tech Stack:** Next.js 16 App Router (existing), `@supabase/supabase-js` + `@supabase/ssr` (the only new runtime deps), vitest (existing), Supabase Postgres + Auth, Resend SMTP, Cloudflare DNS.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-08-citizenship-design.md`. Read it before starting.
- Runtime deps: exactly `next react react-dom @supabase/supabase-js @supabase/ssr`. No others.
- Middleware NEVER redirects or blocks — all pages stay public; gating is opt-in per surface.
- Public pages must remain statically rendered — do NOT read `cookies()`/session in the root layout or any currently-static page. After deploy, `x-vercel-cache: HIT` must still appear on `/`.
- Secrets live in `.env.local` (gitignored) and Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, plus local-only `SUPABASE_DB_URL`. Never in git, never echoed into chat or reports.
- Handle rules: 3–20 chars, `[a-zA-Z0-9_]`, no leading/trailing underscore, case-insensitive uniqueness (stored lowercase in `handle`, original case in `display_handle`), reserved list blocked.
- Site URL constant: `https://thepatestate.com` via `lib/site.ts` — the only place the production origin appears.
- Copy tone: porch voice ("Still free, forever. Citizenship is just how the porch knows who's home."). No exclamation points.
- Repo git identity `thepatestate` (already configured). Work on branch `build/citizenship` off main. Commit after every task.
- All existing tests must keep passing; `npm run build` is the gate on every task.

---

### Task 1: Provider/console setup (Isaac + controller — NOT a subagent task)

**Files:** `.env.local` (create, gitignored — verify `.gitignore` covers `.env*` — it does)

No code. Isaac clicks in Safari with the controller directing. Checklist:

- [ ] **Supabase:** create project `thepatestate` (org from the new account, US East). From Project Settings → API: copy `URL` and `anon public` key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. From Database → Connection string (URI, direct): copy into `.env.local` as `SUPABASE_DB_URL`.
- [ ] **Supabase Auth URL config:** Authentication → URL Configuration: Site URL `https://thepatestate.com`; Additional redirect URLs: `https://thepatestate.vercel.app/**`, `http://localhost:3000/**`.
- [ ] **Supabase email template:** Authentication → Email Templates → Magic Link: replace the anchor href with `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}` (SSR token-hash flow).
- [ ] **Google OAuth:** Google Cloud console (new account) → OAuth consent screen: External, app name "The Pate State", support + developer email = the new Gmail, publish. Credentials → Create OAuth client ID → Web application; Authorized redirect URI: `https://<supabase-project-ref>.supabase.co/auth/v1/callback`. Paste client ID + secret into Supabase → Authentication → Providers → Google (enable).
- [ ] **Vercel domain:** Vercel project → Settings → Domains → add `thepatestate.com` and `www.thepatestate.com` (www redirects to apex). Vercel shows the required records.
- [ ] **Cloudflare DNS (Vercel):** add the records Vercel displayed — typically `A @ 76.76.21.21` and `CNAME www cname.vercel-dns.com` — with proxy status **DNS only** (gray cloud; Vercel must terminate TLS).
- [ ] **Resend:** Domains → add `thepatestate.com` → add the shown DKIM/SPF records in Cloudflare (DNS only) → wait for Verified. Create SMTP credentials (Settings → SMTP).
- [ ] **Supabase SMTP:** Authentication → Emails → SMTP: host `smtp.resend.com`, port 465, user `resend`, password = Resend API key, sender `The Pate State <porch@thepatestate.com>`.
- [ ] **Vercel env vars:** project → Settings → Environment Variables: add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (production + preview).
- [ ] **Verify:** `dig +short thepatestate.com` returns Vercel's A record; `curl -sI https://thepatestate.com | head -3` returns 200/308 once propagated.

Code tasks 2–8 can proceed before this completes (they degrade gracefully without env vars); Task 9 requires it done.

---

### Task 2: Supabase client modules + session middleware

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts` (repo root)
- Modify: `package.json` (via npm install)

**Interfaces:**
- Produces (consumed by Tasks 5–8):
  - `lib/supabase/client.ts`: `createClient()` (browser), `isSupabaseConfigured: boolean`
  - `lib/supabase/server.ts`: `createClient(): Promise<SupabaseClient>`, `getUser(): Promise<User | null>`, `getCitizen(): Promise<Citizen | null>`, `type Citizen = { id: string; handle: string; display_handle: string; favorite_team: string | null; joined_at: string }`

- [ ] **Step 1: Install deps**

Run: `npm install @supabase/supabase-js @supabase/ssr`

- [ ] **Step 2: Write `lib/supabase/client.ts`**

```ts
import { createBrowserClient } from "@supabase/ssr";

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Write `lib/supabase/server.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export interface Citizen {
  id: string;
  handle: string;
  display_handle: string;
  favorite_team: string | null;
  joined_at: string;
}

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no response — middleware handles refresh.
          }
        },
      },
    }
  );
}

export async function getUser(): Promise<User | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCitizen(): Promise<Citizen | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("citizens")
    .select("id, handle, display_handle, favorite_team, joined_at")
    .eq("id", user.id)
    .maybeSingle();
  return (data as Citizen) ?? null;
}
```

- [ ] **Step 4: Write `middleware.ts`** (repo root — refresh only, NEVER redirect)

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|opengraph-image|sitemap.xml|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)",
  ],
};
```

- [ ] **Step 5: Verify builds both ways**

Run: `npm run build && npm test` (with `.env.local` if present)
Then: `env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY npm run build` — must also pass (graceful unconfigured mode).
Expected: both green; no route flips from Static to Dynamic in the build output.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: supabase clients + session-refresh middleware"`

---

### Task 3: SITE_URL constant + domain swap

**Files:**
- Create: `lib/site.ts`
- Modify: `app/layout.tsx` (metadataBase), `app/sitemap.ts`, `app/robots.ts`

**Interfaces:**
- Produces: `SITE_URL = "https://thepatestate.com"` from `lib/site.ts` (consumed anywhere the production origin is needed).

- [ ] **Step 1: Write `lib/site.ts`**

```ts
export const SITE_URL = "https://thepatestate.com";
```

- [ ] **Step 2: Swap the three hardcoded `https://thepatestate.vercel.app` occurrences** in `app/layout.tsx` (`metadataBase: new URL(SITE_URL)`), `app/sitemap.ts` (`const BASE = SITE_URL`), `app/robots.ts` (sitemap field: `` `${SITE_URL}/sitemap.xml` ``) to import from `@/lib/site`. Grep to confirm zero `vercel.app` literals remain in `app/`.

- [ ] **Step 3: Verify** — `npm run build && npm test` pass.

- [ ] **Step 4: Commit** — `git add lib app && git commit -m "feat: single SITE_URL constant on thepatestate.com"`

---

### Task 4: Citizens migration + handle validation lib (TDD)

**Files:**
- Create: `supabase/migrations/0001_citizens.sql`, `lib/handle.ts`, `lib/handle.test.ts`

**Interfaces:**
- Produces: `validateHandle(raw: string): { ok: true; handle: string; display: string } | { ok: false; error: "length" | "charset" | "underscore" | "reserved" }`; the `citizens` table with owner-only RLS.

- [ ] **Step 1: Write `supabase/migrations/0001_citizens.sql`**

```sql
create table public.citizens (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null,
  display_handle text not null,
  favorite_team text,
  joined_at timestamptz not null default now(),
  constraint handle_format check (handle ~ '^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$')
);

create unique index citizens_handle_key on public.citizens (handle);

alter table public.citizens enable row level security;

create policy "citizens_select_own" on public.citizens
  for select using (auth.uid() = id);

create policy "citizens_insert_own" on public.citizens
  for insert with check (auth.uid() = id);

create policy "citizens_update_own" on public.citizens
  for update using (auth.uid() = id) with check (auth.uid() = id);
```

- [ ] **Step 2: Write the failing tests** — `lib/handle.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { validateHandle, RESERVED_HANDLES } from "./handle";

describe("validateHandle", () => {
  it("accepts valid handles and normalizes case", () => {
    const r = validateHandle("SicEmSaturdays");
    expect(r).toEqual({ ok: true, handle: "sicemsaturdays", display: "SicEmSaturdays" });
  });
  it("accepts underscores mid-handle and digits", () => {
    expect(validateHandle("porch_prophet_88").ok).toBe(true);
  });
  it("rejects too short and too long", () => {
    expect(validateHandle("ab")).toEqual({ ok: false, error: "length" });
    expect(validateHandle("a".repeat(21))).toEqual({ ok: false, error: "length" });
    expect(validateHandle("abc").ok).toBe(true);
    expect(validateHandle("a".repeat(20)).ok).toBe(true);
  });
  it("rejects bad charset", () => {
    for (const bad of ["hey there", "porch-swing", "josé", "state!"]) {
      expect(validateHandle(bad)).toEqual({ ok: false, error: "charset" });
    }
  });
  it("rejects leading/trailing underscore", () => {
    expect(validateHandle("_porch")).toEqual({ ok: false, error: "underscore" });
    expect(validateHandle("porch_")).toEqual({ ok: false, error: "underscore" });
  });
  it("rejects reserved names case-insensitively", () => {
    for (const r of ["josh", "JoshPate", "ADMIN", "thepatestate", "WireDesk"]) {
      expect(validateHandle(r)).toEqual({ ok: false, error: "reserved" });
    }
  });
  it("every reserved entry is itself lowercase", () => {
    for (const r of RESERVED_HANDLES) expect(r).toBe(r.toLowerCase());
  });
});
```

- [ ] **Step 3: Run to verify FAIL** — `npm test` → cannot resolve `./handle`.

- [ ] **Step 4: Implement `lib/handle.ts`**

```ts
export const RESERVED_HANDLES = [
  "josh", "joshpate", "pate", "patestate", "thepatestate", "admin", "administrator",
  "mod", "moderator", "official", "staff", "support", "wiredesk", "thewire",
  "citizen", "porch", "mayor", "help", "api", "root", "system",
] as const;

export type HandleResult =
  | { ok: true; handle: string; display: string }
  | { ok: false; error: "length" | "charset" | "underscore" | "reserved" };

export function validateHandle(raw: string): HandleResult {
  const display = raw.trim();
  if (display.length < 3 || display.length > 20) return { ok: false, error: "length" };
  if (!/^[a-zA-Z0-9_]+$/.test(display)) return { ok: false, error: "charset" };
  if (display.startsWith("_") || display.endsWith("_")) return { ok: false, error: "underscore" };
  const handle = display.toLowerCase();
  if ((RESERVED_HANDLES as readonly string[]).includes(handle)) return { ok: false, error: "reserved" };
  return { ok: true, handle, display };
}
```

- [ ] **Step 5: Run to verify PASS** — `npm test` → all green (8 existing + these).

- [ ] **Step 6: Apply the migration** (requires Task 1's `SUPABASE_DB_URL` in `.env.local`; if absent, mark this step deferred in your report and continue — Task 9 applies it):

Run: `set -a && source .env.local && set +a && npx supabase db push --db-url "$SUPABASE_DB_URL"` (accept the CLI download). Verify: `npx supabase db diff --db-url "$SUPABASE_DB_URL"` reports no differences, or query `select count(*) from public.citizens;` succeeds via the CLI.

- [ ] **Step 7: Commit** — `git add supabase lib && git commit -m "feat: citizens schema + handle validation (TDD)"`

---

### Task 5: /join page + /auth/callback route

**Files:**
- Create: `app/join/page.tsx`, `components/JoinForm.tsx`, `app/auth/callback/route.ts`

**Interfaces:**
- Consumes: `createClient` (browser) from `@/lib/supabase/client`; `createClient` (server) from `@/lib/supabase/server`.
- Produces: `/join?next=<path>&error=<code>` contract; callback redirects: existing citizen → `next`, new user → `/welcome?next=<path>`, failure → `/join?error=expired`.

- [ ] **Step 1: Write `app/join/page.tsx`** (server shell; static-safe — reads searchParams only)

```tsx
import type { Metadata } from "next";
import JoinForm from "@/components/JoinForm";

export const metadata: Metadata = { title: "Become a Citizen" };

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = "/", error } = await searchParams;
  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Citizenship</p>
          <h1>Become a Citizen</h1>
          <p className="lede">
            Still free, forever. Citizenship is just how the porch knows who&apos;s home.
          </p>
        </div>
      </header>
      <section className="tight">
        <div className="wrap" style={{ maxWidth: 560 }}>
          {error === "expired" && (
            <p className="note" style={{ marginBottom: 16 }}>
              That link expired or was already used — request a fresh one below.
            </p>
          )}
          <JoinForm next={next} />
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Write `components/JoinForm.tsx`** (client)

```tsx
"use client";
import { useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function JoinForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (!isSupabaseConfigured) {
    return <p className="lede">Citizenship opens shortly — the porch is still being wired.</p>;
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setState(error ? "error" : "sent");
  }

  async function google() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  if (state === "sent") {
    return (
      <div className="panel">
        <p className="eyebrow">Check your email</p>
        <h3>Your key is on the way</h3>
        <p>We sent a sign-in link to {email}. It works once and expires in an hour.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <form onSubmit={sendLink}>
        <label className="eyebrow" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{ display: "block", width: "100%", padding: "12px 14px", margin: "8px 0 14px", fontFamily: "var(--mono)", fontSize: 14, border: "1.5px solid var(--line-l)", borderRadius: 2, background: "#fff", color: "var(--ink)" }}
        />
        <button className="btn solid" type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Email Me a Sign-In Link"}
        </button>
        {state === "error" && (
          <p className="note" style={{ marginTop: 12 }}>
            That didn&apos;t send — check the address and try again.
          </p>
        )}
      </form>
      <p style={{ margin: "18px 0 10px", fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".1em", color: "var(--ink-dim)" }}>OR</p>
      <button className="btn" onClick={google}>Continue with Google</button>
    </div>
  );
}
```

- [ ] **Step 3: Write `app/auth/callback/route.ts`** (handles both PKCE `code` and email `token_hash` flows)

```ts
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") ? rawNext : "/";

  const supabase = await createClient();
  let authed = false;

  if (code) {
    authed = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    authed = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  if (!authed) return NextResponse.redirect(`${origin}/join?error=expired`);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: citizen } = await supabase
    .from("citizens")
    .select("id")
    .eq("id", user!.id)
    .maybeSingle();

  return NextResponse.redirect(
    `${origin}${citizen ? next : `/welcome?next=${encodeURIComponent(next)}`}`
  );
}
```

- [ ] **Step 4: Verify** — `npm run build && npm test` pass; `/join` renders (curl against dev/prod server shows the form shell, or the unconfigured fallback without env vars). Confirm in build output that `/join` is static and `/auth/callback` is dynamic.

- [ ] **Step 5: Commit** — `git add app components && git commit -m "feat: join page with magic link + google oauth, auth callback"`

---

### Task 6: /welcome — handle + favorite team

**Files:**
- Create: `app/welcome/page.tsx`, `app/welcome/actions.ts`, `lib/teams.ts`
- Modify: `app/scores/page.tsx` (import team lists from `lib/teams.ts` instead of local consts)

**Interfaces:**
- Consumes: `validateHandle` from `@/lib/handle`; server `createClient`/`getUser` from `@/lib/supabase/server`.
- Produces: `lib/teams.ts` exporting `TEAMS_TOP25: ReadonlyArray<{ value: string; label: string }>` and `TEAMS_ALL: ReadonlyArray<{ value: string; label: string }>` (moved verbatim from `app/scores/page.tsx`'s `DEMO_TEAM_TOP25`/`DEMO_TEAM_ALL`, values de-suffixed of `-all`); server action `createCitizen(prevState, formData)` usable with `useActionState`.

- [ ] **Step 1: Create `lib/teams.ts`** by MOVING the two team-list consts out of `app/scores/page.tsx` (keep label text identical; strip the `-all` value suffixes — uniqueness across the two lists is not needed here; scores keeps its select behavior by importing these and re-suffixing locally where required). Update `app/scores/page.tsx` imports; `npm run build` must stay green.

- [ ] **Step 2: Write `app/welcome/actions.ts`**

```ts
"use server";
import { redirect } from "next/navigation";
import { validateHandle } from "@/lib/handle";
import { createClient } from "@/lib/supabase/server";

export interface WelcomeState {
  error?: string;
}

const ERROR_COPY: Record<string, string> = {
  length: "Handles run 3 to 20 characters.",
  charset: "Letters, numbers, and underscores only.",
  underscore: "Can't start or end with an underscore.",
  reserved: "That one's taken by the State.",
  taken: "That handle's already on the porch — try another.",
  auth: "Your session expired — head back to the join page.",
};

export async function createCitizen(
  _prev: WelcomeState,
  formData: FormData
): Promise<WelcomeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ERROR_COPY.auth };

  const result = validateHandle(String(formData.get("handle") ?? ""));
  if (!result.ok) return { error: ERROR_COPY[result.error] };

  const favoriteTeam = String(formData.get("favorite_team") ?? "") || null;
  const { error } = await supabase.from("citizens").insert({
    id: user.id,
    handle: result.handle,
    display_handle: result.display,
    favorite_team: favoriteTeam,
  });

  if (error) {
    return { error: error.code === "23505" ? ERROR_COPY.taken : "Something hiccuped — try again." };
  }

  const rawNext = String(formData.get("next") ?? "/");
  redirect(rawNext.startsWith("/") ? rawNext : "/");
}
```

- [ ] **Step 3: Write `app/welcome/page.tsx`** — server component: `getUser()`; if no user, redirect to `/join`; if `getCitizen()` already exists, redirect to `/me`. Renders a client form component (inline in the same file with a `"use client"` child extracted to `components/WelcomeForm.tsx` if you prefer — keep it one screen):

```tsx
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUser, getCitizen } from "@/lib/supabase/server";
import WelcomeForm from "@/components/WelcomeForm";

export const metadata: Metadata = { title: "Claim Your Handle" };

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "/" } = await searchParams;
  const user = await getUser();
  if (!user) redirect(`/join?next=${encodeURIComponent(next)}`);
  if (await getCitizen()) redirect("/me");
  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Citizenship</p>
          <h1>Claim Your Handle</h1>
          <p className="lede">One more step and your seat on the porch is saved.</p>
        </div>
      </header>
      <section className="tight">
        <div className="wrap" style={{ maxWidth: 560 }}>
          <WelcomeForm next={next} />
        </div>
      </section>
    </main>
  );
}
```

And `components/WelcomeForm.tsx` (client, `useActionState`):

```tsx
"use client";
import { useActionState } from "react";
import { createCitizen, type WelcomeState } from "@/app/welcome/actions";
import { TEAMS_TOP25, TEAMS_ALL } from "@/lib/teams";

export default function WelcomeForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<WelcomeState, FormData>(
    createCitizen,
    {}
  );
  return (
    <form action={formAction} className="panel">
      <input type="hidden" name="next" value={next} />
      <label className="eyebrow" htmlFor="handle">Handle</label>
      <input
        id="handle" name="handle" required minLength={3} maxLength={20}
        placeholder="PorchSwingProphet"
        style={{ display: "block", width: "100%", padding: "12px 14px", margin: "8px 0 14px", fontFamily: "var(--mono)", fontSize: 14, border: "1.5px solid var(--line-l)", borderRadius: 2, background: "#fff", color: "var(--ink)" }}
      />
      <label className="eyebrow" htmlFor="favorite_team">Favorite team (optional)</label>
      <select
        id="favorite_team" name="favorite_team" defaultValue=""
        style={{ display: "block", width: "100%", padding: "12px 14px", margin: "8px 0 18px", fontFamily: "var(--mono)", fontSize: 14, border: "1.5px solid var(--line-l)", borderRadius: 2, background: "#fff", color: "var(--ink)" }}
      >
        <option value="">No flag on my porch</option>
        <optgroup label="The JP Top 25">
          {TEAMS_TOP25.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </optgroup>
        <optgroup label="All Teams A–Z">
          {TEAMS_ALL.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </optgroup>
      </select>
      {state.error && <p className="note" style={{ marginBottom: 12 }}>{state.error}</p>}
      <button className="btn solid" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Take My Seat"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Verify** — `npm run build && npm test`; `/welcome` shows as dynamic in build output; scores page still renders identically (curl check for the team selector options).

- [ ] **Step 5: Commit** — `git add app components lib && git commit -m "feat: welcome flow — claim handle + favorite team"`

---

### Task 7: /me profile + Nav session state

**Files:**
- Create: `app/me/page.tsx`, `app/me/actions.ts`, `components/NavSession.tsx`
- Modify: `components/Nav.tsx` (mount NavSession in the CTA slot), `app/porch/page.tsx` ("Open My Profile" → `/me`, enabled)

**Interfaces:**
- Consumes: `getCitizen`, `getUser`, server `createClient`; browser `createClient`, `isSupabaseConfigured`.
- Produces: `signOut()` server action; `<NavSession />` (client) rendering either the Subscribe CTA fallback children or handle chip.

- [ ] **Step 1: Write `app/me/actions.ts`**

```ts
"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateHandle } from "@/lib/handle";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export interface ProfileState { error?: string; saved?: boolean }

export async function updateFavoriteTeam(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expired — sign in again." };
  const favoriteTeam = String(formData.get("favorite_team") ?? "") || null;
  const { error } = await supabase
    .from("citizens")
    .update({ favorite_team: favoriteTeam })
    .eq("id", user.id);
  return error ? { error: "Save failed — try again." } : { saved: true };
}
```

(`validateHandle` import is intentionally absent from updateFavoriteTeam — handle changes are NOT in scope; remove the unused import if your linter complains — i.e. don't import it at all.)

- [ ] **Step 2: Write `app/me/page.tsx`** — server component: `getCitizen()`; null → `redirect("/join?next=/me")`. Render page-head ("The Porch / Your Seat"), a `panel` with `display_handle` (big `.display` type), email (from `getUser()`), favorite-team select form (client child using `useActionState` + `updateFavoriteTeam`, same select markup as WelcomeForm importing from `lib/teams.ts`), and a sign-out `<form action={signOut}><button className="btn">Hand In My Key</button></form>`. Set `export const metadata = { title: "Your Seat" }`.

- [ ] **Step 3: Write `components/NavSession.tsx`** (client — keeps every page static)

```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function NavSession({ fallback }: { fallback: React.ReactNode }) {
  const [handle, setHandle] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) { setResolved(true); return; }
    const supabase = createClient();
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) { setHandle(null); setResolved(true); return; }
      const { data } = await supabase
        .from("citizens").select("display_handle").eq("id", user.id).maybeSingle();
      if (!cancelled) { setHandle(data?.display_handle ?? null); setResolved(true); }
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  if (!resolved || !handle) return <>{fallback}</>;
  return (
    <Link href="/me" className="btn gold nav-cta">🔑 {handle}</Link>
  );
}
```

- [ ] **Step 4: Modify `components/Nav.tsx`** — replace the existing Subscribe anchor in the nav-row with:

```tsx
<NavSession
  fallback={
    <a className="btn gold nav-cta" href={SUBSCRIBE_URL} target="_blank" rel="noopener">
      Subscribe on YouTube
    </a>
  }
/>
```

(the anchor moves inside the `fallback` prop unchanged). Signed-out users keep seeing Subscribe; citizens see their 🔑 handle chip. Also add a "Become a Citizen" entry to both the nav-links array rendering and the drawer, pointing to `/join` (a plain `Link`, styled like the other nav links).

- [ ] **Step 5: Modify `app/porch/page.tsx`** — "Open My Profile" disabled button → `<Link className="btn" href="/me">Open My Profile</Link>`.

- [ ] **Step 6: Verify** — `npm run build && npm test`; build output: `/me` dynamic, `/`, `/show`, all preview pages STILL static (this is the regression the constraint exists for).

- [ ] **Step 7: Commit** — `git add app components && git commit -m "feat: profile page, sign-out, nav session chip"`

---

### Task 8: GateCard + KeyBadge + sitewide CTA activation

**Files:**
- Create: `components/GateCard.tsx`, `components/KeyBadge.tsx`
- Modify: `app/porch/page.tsx` (mailbag gate example — this page becomes dynamic), `app/page.tsx` (citizen band CTAs → `/join`), `app/pickem/page.tsx`, `app/ledger/page.tsx`, `app/notebook/page.tsx` (any "Become a Citizen"/"Claim Citizenship" disabled buttons → `Link` to `/join`)

**Interfaces:**
- Consumes: `getCitizen` (server) on the porch page only.
- Produces: `<GateCard next={string} />`, `<KeyBadge />` for future gated surfaces (C/D).

- [ ] **Step 1: Write `components/KeyBadge.tsx`**

```tsx
export default function KeyBadge() {
  return (
    <span className="note" title="Citizens only — free">🔑 Citizens Only · Free</span>
  );
}
```

- [ ] **Step 2: Write `components/GateCard.tsx`**

```tsx
import Link from "next/link";

export default function GateCard({ next }: { next: string }) {
  return (
    <div
      className="panel"
      style={{ borderColor: "var(--lamp-deep)", borderWidth: 2, textAlign: "center" }}
    >
      <p className="eyebrow">🔑 Citizens only · free</p>
      <h3>Still free, forever.</h3>
      <p>Citizenship is just how the porch knows who&apos;s home.</p>
      <Link className="btn gold" href={`/join?next=${encodeURIComponent(next)}`}>
        Become a Citizen
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Wire the porch mailbag example** in `app/porch/page.tsx`: make the page async-dynamic via `const citizen = await getCitizen()`. Signed-out: mailbag Q&As remain visible, the submit area renders `<GateCard next="/porch" />`. Signed-in: render the submit form area (textarea + button) still `disabled` with the existing PreseasonChip (engine lands in C/D) plus `<KeyBadge />` above it. Do NOT touch the rest of the page.

- [ ] **Step 4: Activate remaining citizen CTAs sitewide** — grep `app/` for disabled buttons whose labels mention Citizen/Citizenship ("Become a Citizen", "Claim Citizenship", "Claim Free Citizenship") and replace each with `<Link className="btn gold" href="/join">…same label…</Link>` (keep surrounding copy). The homepage signup `<input>` in the citizen band: replace the input+disabled button combo with a single `Link` to `/join` labeled "Become a Citizen — Free".

- [ ] **Step 5: Verify** — `npm run build && npm test`; build output: `/porch` now dynamic; all other preview pages still static; curl `/porch` (no session) shows the GateCard copy.

- [ ] **Step 6: Commit** — `git add app components && git commit -m "feat: gate card, key badge, live citizen CTAs; porch mailbag gate example"`

---

### Task 9: Deploy + end-to-end verification (controller + Isaac)

**Files:** none (operations)

Prereqs: Task 1 fully complete (domain live, SMTP verified, Google provider on, Vercel envs set); migration applied (Task 4 Step 6 or now).

- [ ] **Step 1:** Merge `build/citizenship` → `main`, push. Vercel auto-deploys. Confirm deploy green in dashboard.
- [ ] **Step 2:** `curl -sI https://thepatestate.com/ | grep -iE "HTTP|x-vercel-cache"` → 200; repeat → `HIT` (static/ISR regression gate).
- [ ] **Step 3:** Magic-link E2E with a real inbox: /join → email arrives FROM `porch@thepatestate.com` → link → /welcome → claim handle → redirected; Nav shows 🔑 handle; /me renders; sign out returns Subscribe CTA.
- [ ] **Step 4:** Google OAuth E2E with a second account → second citizen row.
- [ ] **Step 5:** RLS check: in Supabase SQL editor as `anon` (or via a signed-in browser console query for the OTHER user's id) confirm cross-user select returns zero rows.
- [ ] **Step 6:** Duplicate-handle check: second account attempts the first account's handle → inline "already on the porch" error.
- [ ] **Step 7:** Expired-link check: reuse a consumed magic link → lands on `/join?error=expired` with the retry copy.
- [ ] **Step 8:** Update `docs/` if any console values changed; commit `chore: citizenship live` (allow-empty ok).
