import type { Metadata } from "next";
import Link from "next/link";
import { getCitizen } from "@/lib/supabase/server";
import { joinLeague } from "@/app/play/actions";

// Invite-link landing (v2 brief §5.2): /play/join/<code>. Joining is an
// explicit button press (never a side effect of loading a link), and the
// actual membership insert happens in a security-definer RPC where the
// code is the credential.

export const metadata: Metadata = { title: "Join a Group — Play", robots: { index: false } };

export default async function JoinByCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const citizen = await getCitizen();

  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Play / Join a Group</p>
          <h1>You&apos;re Invited</h1>
          <p className="lede">Someone wants you in their group. One tap and you&apos;re on their board.</p>
        </div>
      </header>
      <section>
        <div className="wrap" style={{ maxWidth: 560 }}>
          <div className="panel panel-accent-field">
            <p className="eyebrow">Invite Code</p>
            <p style={{ fontFamily: "var(--mono)", fontSize: 15, margin: "6px 0 16px" }}>{code}</p>
            {citizen ? (
              <form
                action={async () => {
                  "use server";
                  await joinLeague(code);
                }}
              >
                <button className="btn gold" type="submit">Join the Group</button>
              </form>
            ) : (
              <>
                <p style={{ marginBottom: 14 }}>Citizenship is free — join the State, then you&apos;re in the group.</p>
                <Link className="btn gold" href={`/join?next=/play/join/${code}`}>Become a Citizen — Free</Link>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
