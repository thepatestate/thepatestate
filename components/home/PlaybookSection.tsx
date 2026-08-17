import JoinForm from "@/components/JoinForm";

// v25 Pate Playbook: full-width navy conversion band. The form is the REAL
// email capture — JoinForm's magic-link flow — restyled by the .pb-form
// wrapper. The mail preview card is a static structural mock of the
// briefing's sections (no fabricated headlines).
export default function PlaybookSection() {
  return (
    <section className="playbook" id="citizen">
      <div className="wrap">
        <div className="pb-grid2">
          <div className="pb-left">
            <div className="pb-eyebrow">📬 The Pate Playbook · Free Every Weekday</div>
            <h2>The Whole Sport.<br /><em>Four Minutes. Every Morning.</em></h2>
            <p className="pb-sub">
              Wake up knowing what changed, what actually matters, and what to watch next — in Josh&apos;s
              voice, in your inbox by 6 AM.
            </p>
            <div className="pb-form">
              <JoinForm next="/welcome" />
            </div>
            <div className="pb-perks">
              <span>✓ Early JP Poll Access</span>
              <span>✓ Pick&apos;Em Reminders &amp; Invites</span>
              <span>✓ Free Pate Report</span>
            </div>
            <div className="pb-proof">Free. Weekdays at 6 AM. Unsubscribe anytime.</div>
          </div>
          <div className="pb-right">
            <div className="pb-mail ghost" />
            <div className="pb-mail">
              <div className="pm-chrome"><i /><i /><i /></div>
              <div className="pm-from">
                <span className="pm-av">JP</span>
                <div><b>The Pate Playbook</b><span>to you · Weekdays · 6:00 AM</span></div>
                <span className="pm-day">6 AM</span>
              </div>
              <span className="pm-badge">Free</span>
              <div className="pm-mast">The Pate <em>Playbook</em><div className="pm-rule" /></div>
              <div className="pm-line"><b>🏈 What Changed</b>The biggest moves, news, and recruiting developments since yesterday</div>
              <div className="pm-line"><b>🎙 Josh&apos;s Read</b>The biggest story of the day — and Josh&apos;s read on what it really means</div>
              <div className="pm-line"><b>👀 What&apos;s Next</b>The games, decisions, deadlines, and storylines worth watching today</div>
              <div className="pm-foot">☕ The whole sport in four minutes · in your inbox by 6 AM</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
