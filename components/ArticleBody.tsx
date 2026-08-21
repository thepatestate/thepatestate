import type { ReactNode } from "react";
import { parseMarkers, tsToSeconds } from "@/lib/markers";
import { formatDate } from "@/lib/format";
import type { SanityArticle } from "@/lib/sanity";

// Same duplication pattern as HelmetIcon in app/page.tsx and
// app/notebook/page.tsx: small, per-file lookups rather than a shared
// lib module, since this codebase doesn't DRY up presentational bits.
const SERIES_LABELS: Record<string, string> = {
  "weekend-truths": "Weekend Truths",
  "poll-day": "Poll Day",
  "sit-down": "The Sit-Down",
  "picks-drop": "Picks Drop",
  "espn-friday": "The ESPN Show",
  mailbag: "The Mailbag",
  general: "The Notebook",
};

function seriesLabel(series?: string): string {
  if (!series) return "The Notebook";
  return SERIES_LABELS[series] ?? series;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Tiny inline formatter for **bold** / *italic* — no markdown dependency.
function renderInline(raw: string): ReactNode[] {
  // Writers occasionally emit stray marker tokens ("[/PULLQUOTE]", an
  // unclosed "[QUOTE:…]") that upstream parsing can't consume — they must
  // never reach the reader as literal text (Josh, 2026-08-21).
  const text = raw.replace(/\[\/?(?:PULLQUOTE|QUOTE|EMBED)[^\]]*\]/g, "").replace(/ {2,}/g, " ");
  const nodes: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) nodes.push(<b key={key++}>{m[1]}</b>);
    else nodes.push(<i key={key++}>{m[2]}</i>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// v1.2 §2.4a: [QUOTE:HH:MM:SS]verbatim words[/QUOTE] renders as a quoted span
// deep-linked to that moment of the episode on YouTube. Runs before the
// bold/italic pass so quote text still gets inline formatting.
function renderWithQuotes(text: string, ytId?: string): ReactNode[] {
  const re = /\[QUOTE:([\d:]+)\]([\s\S]+?)\[\/QUOTE\]/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(...renderInline(text.slice(last, m.index)));
    const seconds = tsToSeconds(m[1]);
    const quoted = <>&ldquo;{renderInline(m[2].trim())}&rdquo;</>;
    nodes.push(
      ytId ? (
        <a
          key={`q${key++}`}
          className="quote-link"
          href={`https://www.youtube.com/watch?v=${ytId}&t=${seconds}s`}
          target="_blank"
          rel="noopener"
          title={`Watch this moment (${m[1]})`}
        >
          {quoted}
        </a>
      ) : (
        <span key={`q${key++}`}>{quoted}</span>
      )
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(...renderInline(text.slice(last)));
  return nodes;
}

function TextBlocks({ markdown, ytId }: { markdown: string; ytId?: string }) {
  const blocks = markdown.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <>
      {blocks.map((block, i) =>
        block.startsWith("## ") ? (
          <h3 className="display" key={i}>
            {renderInline(block.slice(3).trim())}
          </h3>
        ) : (
          <p key={i}>{renderWithQuotes(block, ytId)}</p>
        )
      )}
    </>
  );
}

export default function ArticleBody({ article }: { article: SanityArticle }) {
  const segments = parseMarkers(article.bodyMarkdown);

  return (
    <>
      <span className="fr" style={{ marginBottom: 0 }}>
        📝 {seriesLabel(article.episode?.series)}
      </span>
      <div className="byline">
        <div className="avatar">{initials(article.byline)}</div>
        <div className="who">
          <b>{article.byline}</b>
          {article.publishedAt && <span>{formatDate(article.publishedAt)}</span>}
        </div>
      </div>
      <div className="story-body">
        {segments.map((seg, i) => {
          if (seg.type === "text") return <TextBlocks markdown={seg.markdown} ytId={article.episode?.ytId} key={i} />;
          if (seg.type === "pullquote") {
            if (!article.pullQuote) return null;
            // Pull quotes are Josh's verbatim takes from the show (§26) — always
            // his attribution, regardless of the article byline.
            return (
              <div className="pullquote" key={i}>
                &ldquo;{article.pullQuote}&rdquo;
                <span className="who">— Josh Pate</span>
              </div>
            );
          }
          if (!article.episode) return null;
          return (
            <div className="story-media" key={i} style={{ background: "none" }}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${article.episode.ytId}?start=${seg.seconds}`}
                title={article.episode.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ width: "100%", height: "100%", border: 0, borderRadius: 6 }}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}
