// The page's word count, not the desk's (2026-09-02; Josh: the short
// articles are still too short). A Wire story renders either as its flat
// body or as the module set, so the floor a reader experiences is measured
// on what the page actually prints — mirrors app/wire/[slug]/page.tsx.
import { words } from "./v3-context";

/** The minimum a Wire story renders at, across every section (Isaac, 2026-09-02). */
export const RENDER_FLOOR = 350;

export interface RenderableStory {
  bodyMarkdown?: string | null;
  whatHappened?: string | null;
  whyBody?: string | null;
  missing?: string | null;
  section04Body?: string | null;
  chessboard?: string | null;
  readBody?: string | null;
  watching?: { title?: string | null; body?: string | null }[] | null;
  questions?: { question?: string | null; why?: string | null }[] | null;
}

const w = (s?: string | null) => (s && s.trim() ? words(s) : 0);

/** True when the page takes the flat-body path (no module layout). */
export function rendersFlat(s: RenderableStory): boolean {
  return Boolean(s.bodyMarkdown && !s.whyBody && !s.readBody);
}

/** Words the page prints for this story: the core (flat body or the
 * decomposed modules) plus the add-on sections that render on either path. */
export function renderedWords(s: RenderableStory): number {
  const core = rendersFlat(s)
    ? w(s.bodyMarkdown)
    : w(s.whatHappened) + w(s.whyBody) + w(s.section04Body) + w(s.chessboard) + w(s.readBody);
  const missing = w(s.missing);
  const watching = (s.watching ?? []).reduce((a, x) => a + w(x.title) + w(x.body), 0);
  const questions = (s.questions ?? []).reduce((a, x) => a + w(x.question) + w(x.why), 0);
  return core + missing + watching + questions;
}

/** How much of the desk's body the module decomposition kept (0–1+). The
 * modules are a layout of the story, so anything under ~0.9 has dropped
 * paragraphs on the floor. */
export function moduleCoverage(modules: RenderableStory, bodyMarkdown: string): number {
  const body = w(bodyMarkdown);
  if (!body) return 1;
  const kept = w(modules.whatHappened) + w(modules.whyBody) + w(modules.missing) + w(modules.section04Body) + w(modules.chessboard) + w(modules.readBody);
  return kept / body;
}

/** Words still needed to reach the floor (0 when met). */
export function shortfall(s: RenderableStory, floor = RENDER_FLOOR): number {
  return Math.max(0, floor - renderedWords(s));
}
