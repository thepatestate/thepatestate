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
