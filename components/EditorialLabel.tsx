import Link from "next/link";

// Editorial label bar (v2 brief §0.4): every published page displays its
// content type and production method. Values come from Sanity when an editor
// sets them; otherwise inferred honestly from the byline — staff companion
// articles are AI-drafted then human-reviewed, and say so.

const METHOD_TEXT: Record<string, string> = {
  josh: "Written by Josh Pate",
  staff: "Written by The Pate State editorial team",
  "ai-reviewed": "Produced with Pate State AI · reviewed by The Pate State editorial team",
  "ai-monitored": "Produced with Pate State AI · verification-checked · monitored by an editor",
  automated: "Automated data update",
};

export default function EditorialLabel({
  contentType,
  productionMethod,
  byline,
  reviewedBy,
  dark,
}: {
  contentType?: string;
  productionMethod?: string;
  byline?: string;
  reviewedBy?: string;
  dark?: boolean;
}) {
  const inferredMethod = productionMethod ?? (byline && /josh pate/i.test(byline) ? "josh" : "ai-reviewed");
  const type = contentType ?? "Analysis";
  let method = METHOD_TEXT[inferredMethod] ?? METHOD_TEXT["ai-reviewed"];
  if (inferredMethod === "ai-reviewed" && reviewedBy) {
    method = `Produced with Pate State AI · reviewed by ${reviewedBy}`;
  }
  return (
    <div className={dark ? "ed-label dark" : "ed-label"}>
      <span className="ed-type">{type.toUpperCase()}</span>
      <span className="ed-method">{method}</span>
      <Link href="/standards" className="ed-standards">Standards</Link>
    </div>
  );
}

/** Timestamped corrections block — appended, never silent (§0.4). */
export function Corrections({ corrections }: { corrections?: { at: string; note: string }[] }) {
  if (!corrections || corrections.length === 0) return null;
  return (
    <div className="corrections">
      <p className="eyebrow" style={{ marginBottom: 6 }}>Corrections</p>
      {corrections.map((c) => (
        <p key={`${c.at}-${c.note.slice(0, 20)}`} style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 6 }}>
          <b style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
            {new Date(c.at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}{" "}
            ET
          </b>{" "}
          — {c.note}
        </p>
      ))}
    </div>
  );
}
