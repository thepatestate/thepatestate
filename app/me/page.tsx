import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCitizen, getUser } from "@/lib/supabase/server";
import { signOut } from "@/app/me/actions";
import ProfileForm from "@/components/ProfileForm";

export const metadata: Metadata = {
  title: "Your Seat",
  description: "Your citizen profile.",
  alternates: { canonical: "/me" },
  robots: { index: false },
};

export default async function MePage() {
  const citizen = await getCitizen();
  if (!citizen) redirect("/welcome?next=/me");
  const user = await getUser();

  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Your Seat</p>
          <h1>Your Seat</h1>
          <p className="lede">This is your porch. Your handle, your flag, your key.</p>
        </div>
      </header>
      <section className="tight">
        <div className="wrap" style={{ maxWidth: 560 }}>
          <div className="panel" style={{ marginBottom: 20 }}>
            <p className="eyebrow">Your Handle</p>
            <h2 className="display" style={{ fontSize: 32, margin: "6px 0 10px" }}>
              {citizen.display_handle}
            </h2>
            <p className="note">{user?.email}</p>
          </div>
          <div className="panel" style={{ marginBottom: 20 }}>
            <ProfileForm favoriteTeam={citizen.favorite_team} />
          </div>
          <form action={signOut}>
            <button className="btn" type="submit">Hand In My Key</button>
          </form>
        </div>
      </section>
    </main>
  );
}
