import Link from "next/link";
import type { Video } from "@/lib/youtube";

// v5 Playbook band: pitch + a live preview of the actual daily briefing built
// from the real latest episode and wire headlines. Email capture stays with
// the /join flow — no dead input fields.
export default function PlaybookSection({ latest, wireHeads }: {
  latest: Video | null;
  wireHeads: string[];
}) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York",
  });
  const items = [
    ...(latest ? [`Yesterday's show: ${latest.title.replace(/ - Josh Pate's College Football Show/i, "")}`] : []),
    ...wireHeads,
  ];
  return (
    <section className="playbook" id="citizen">
      <div className="wrap pb-grid">
        <div className="pb-copy">
          <div className="sect-head" style={{ marginBottom: 0 }}>
            <div><div className="eyebrow">Free Citizenship · The Daily Briefing</div></div>
          </div>
          <h2>The Pate Playbook</h2>
          <p>
            This exact briefing, in your inbox every weekday at 6 AM: what actually happened in the sport,
            what it means, and what&apos;s worth your Saturday. Written like Josh talks. Free forever.
          </p>
          <Link className="pb-cta" href="/join">Become a Citizen — Free</Link>
          <p className="perks">
            <b>Citizens get:</b> early poll access · pick&apos;em invites · first dibs on tour tickets ·
            the digital Pate Report free every July
          </p>
        </div>
        <div className="inbox">
          <div className="from">FROM: <b>The Pate State</b> &lt;porch@thepatestate.com&gt; · {today} · 6:00 AM</div>
          <div className="subj">Today on the porch</div>
          {items.length > 0 && (
            <ul>
              {items.slice(0, 4).map((h) => <li key={h}>{h}</li>)}
            </ul>
          )}
          <div className="ritual">Today&apos;s ritual → make your picks before Saturday 11:58 AM ET.</div>
        </div>
      </div>
    </section>
  );
}
