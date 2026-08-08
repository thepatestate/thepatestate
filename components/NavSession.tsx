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
