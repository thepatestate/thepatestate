// Server-only. This client carries the Supabase service-role key, which
// bypasses row-level security entirely. Import it ONLY from route handlers
// under app/api/playbook/** — never from a page, component, or anything
// that could end up in a client bundle.
import { createClient } from "@supabase/supabase-js";

export const isAdminConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
