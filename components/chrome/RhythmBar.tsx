// v25 rhythm bar: the weekly programming schedule with today highlighted.
// Server component — "today" is computed in ET at request/build time.
const SCHEDULE = [
  { day: 1, label: "MON", show: "Weekend Truths" },
  { day: 2, label: "TUE", show: "Poll Day" },
  { day: 3, label: "WED", show: "The Sit-Down" },
  { day: 4, label: "THU", show: "Picks Drop" },
  { day: 5, label: "FRI", show: "The ESPN Show" },
  { day: 6, label: "SAT", show: "We Watch Ball" },
] as const;

export default function RhythmBar() {
  // Day-of-week in ET (0=Sun … 6=Sat): parse the wall-clock string re-rendered
  // in the target zone — the same trick the playbook preview already uses.
  const etDay = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" })).getDay();
  return (
    <div className="v5 rhythm">
      <div className="wrap">
        {SCHEDULE.map((s) => (
          <span key={s.label} className={s.day === etDay ? "today" : undefined}>
            <b>{s.label}</b> {s.show}
          </span>
        ))}
      </div>
    </div>
  );
}
