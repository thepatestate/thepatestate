export default function PreseasonChip({ label = "Preseason preview" }: { label?: string }) {
  return <span className="note">{label} — live data arrives with the season</span>;
}
