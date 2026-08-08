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
