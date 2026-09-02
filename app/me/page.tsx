import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCitizen, getUser, createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/me/actions";
import ProfileForm from "@/components/ProfileForm";
import TeamFollowForm from "@/components/TeamFollowForm";
import { getTeamDirectory } from "@/lib/cfbd";

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
  const supabase = await createClient();
  const [{ data: followRows }, dir] = await Promise.all([
    supabase.from("team_follows").select("team_slug").order("created_at"),
    getTeamDirectory(),
  ]);
  const follows = (followRows ?? []).map((r) => r.team_slug as string);
  const teamOptions = Object.values(dir)
    .sort((a, b) => a.school.localeCompare(b.school))
    .map((t) => ({ value: t.slug, label: t.school }));

  return (
    <main className="v5-lite">
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / Your Seat</p>
          <h1>Your Seat</h1>
          <p className="lede">This is your Quad. Your handle, your flag, your key.</p>
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
          <div className="panel" style={{ marginBottom: 20 }}>
            <TeamFollowForm teams={teamOptions} current={follows} />
          </div>
          <form action={signOut}>
            <button className="btn" type="submit">Hand In My Key</button>
          </form>
        </div>
      </section>
    </main>
  );
}
