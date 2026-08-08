const COPY = (
  <>
    <span><b>MON</b> Weekend Truths</span><span><b>TUE</b> Poll Day</span>
    <span><b>WED</b> The Sit-Down</span><span><b>THU</b> Picks Drop</span>
    <span><b>FRI</b> The ESPN Show</span><span><b>SAT</b> <em>We Watch Ball</em></span>
    <span>THE FRONT PORCH OF COLLEGE FOOTBALL</span>
  </>
);

export default function Ticker() {
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-inner">{COPY}{COPY}</div>
    </div>
  );
}
