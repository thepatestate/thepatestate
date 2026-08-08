import type { Metadata } from "next";
import Link from "next/link";
import SubscribeCTA from "@/components/SubscribeCTA";

export const metadata: Metadata = { title: "About" };

// The weekly rhythm — same cadence described on /show, restated here as
// context for what "the Pate State" actually is day to day.
const SCHEDULE = [
  { day: "MON", name: "Weekend Truths", desc: "the honest recap of what just happened" },
  { day: "TUE", name: "Poll Day", desc: "the JP Poll, revealed" },
  { day: "WED", name: "The Sit-Down", desc: "long-form interviews" },
  { day: "THU", name: "Picks Drop", desc: "the week's board, reasoned out" },
  { day: "FRI", name: "The ESPN Friday Show", desc: "sometimes live from GameDay sites" },
  { day: "SAT", name: "We Watch Ball", desc: "gameday, together, all day" },
] as const;

export default function AboutPage() {
  return (
    <main>
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / About</p>
          <h1>The Pate State</h1>
          <p className="lede">Not the biggest site in college football. The closest one.</p>
        </div>
      </header>

      <section>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <p className="lede" style={{ fontSize: 19, maxWidth: "none" }}>
            The Pate State isn&apos;t trying to out-headline anybody. It&apos;s a place — built around Josh
            Pate&apos;s shows and owned by the people who live for Saturdays in the fall. The citizens vote the
            poll, write the tailgate guides, fill the mailbag, and keep the leaderboards honest. Josh keeps the
            receipts. Everything here runs on one bargain: no debates, no hot takes, no paywalled opinions — just
            the sport, all year, together.
          </p>
          <div className="duo" style={{ marginTop: 34 }}>
            <div className="panel">
              <p className="eyebrow">Say Hello</p>
              <h3>Contact &amp; Mailbag</h3>
              <p>
                Questions for Friday&apos;s mailbag, corrections, or just a good tailgate tip — the door&apos;s
                open.
              </p>
              <Link className="btn" href="/porch" style={{ borderColor: "var(--navy)", color: "var(--navy)" }}>
                Go to the Porch
              </Link>
            </div>
            <div className="panel">
              <p className="eyebrow">Work With Us</p>
              <h3>Partners &amp; Advertising</h3>
              <p>Sponsor Pick&apos;Em, the Playbook, or the tour. One audience, deeply engaged, all season long.</p>
              <button className="btn" disabled>Partnerships Open Soon</button>
            </div>
          </div>
        </div>
      </section>

      <section className="on-soft">
        <div className="wrap" style={{ maxWidth: 820 }}>
          <p className="eyebrow">Every Week, All Season</p>
          <h2 className="display">How the Porch Runs</h2>
          <p className="lede">
            No offseason lulls, no reruns — just the same rhythm, week after week, from kickoff to the last
            bracket.
          </p>
          <div className="panel" style={{ marginTop: 26 }}>
            {SCHEDULE.map((s) => (
              <div className="sched-row" key={s.day}>
                <span className="d">{s.day}</span>
                <span className="e">
                  <b>{s.name}</b>
                  <p>{s.desc}</p>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="on-field">
        <div className="wrap" style={{ textAlign: "center" }}>
          <p className="eyebrow">Pull Up a Chair</p>
          <h2 className="display">Watch the Show</h2>
          <p className="lede" style={{ margin: "0 auto 24px" }}>
            New episodes all week, all season — every one of them on YouTube, free, no debates, no hot takes.
          </p>
          <SubscribeCTA />
        </div>
      </section>
    </main>
  );
}
