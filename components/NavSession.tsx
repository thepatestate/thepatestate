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
    async function loadHandle(userId: string | undefined) {
      if (!userId) { setHandle(null); setResolved(true); return; }
      const { data } = await supabase
        .from("citizens").select("display_handle").eq("id", userId).maybeSingle();
      if (!cancelled) { setHandle(data?.display_handle ?? null); setResolved(true); }
    }
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      loadHandle(user?.id);
    }
    load();
    // Use the session passed to the callback instead of re-calling load()/getUser()
    // here — calling back into the Supabase client from inside this callback is a
    // documented deadlock hazard, and it would double-fetch on every auth event.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      loadHandle(session?.user?.id);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  if (!resolved || !handle) return <>{fallback}</>;
  return (
    <Link href="/me" className="btn gold nav-cta">🔑 {handle}</Link>
  );
}
