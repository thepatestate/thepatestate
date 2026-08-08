import Link from "next/link";

export default function GateCard({ next }: { next: string }) {
  return (
    <div
      className="panel"
      style={{ borderColor: "var(--lamp-deep)", borderWidth: 2, textAlign: "center" }}
    >
      <p className="eyebrow">🔑 Citizens only · free</p>
      <h3>Still free, forever.</h3>
      <p>Citizenship is just how the porch knows who&apos;s home.</p>
      <Link className="btn gold" href={`/join?next=${encodeURIComponent(next)}`}>
        Become a Citizen
      </Link>
    </div>
  );
}
