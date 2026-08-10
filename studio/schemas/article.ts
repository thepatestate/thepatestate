import { defineType, defineField } from "sanity";

export default defineType({
  name: "article",
  title: "Article",
  type: "document",
  fields: [
    defineField({ name: "headline", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", type: "slug", options: { source: "headline", maxLength: 80 }, validation: (r) => r.required() }),
    defineField({ name: "dek", type: "text", rows: 2 }),
    defineField({
      name: "heroImage", title: "Hero Image (auto-generated — BFL FLUX)",
      type: "image", options: { hotspot: true },
    }),
    defineField({
      name: "bodyMarkdown", title: "Body (Markdown — [EMBED:HH:MM:SS] and [PULLQUOTE] markers)",
      type: "text", rows: 30, validation: (r) => r.required(),
    }),
    defineField({ name: "pullQuote", type: "text", rows: 2 }),
    defineField({ name: "episode", type: "reference", to: [{ type: "episode" }] }),
    defineField({ name: "byline", type: "string", readOnly: true }),
    defineField({
      name: "workflowState", title: "Workflow",
      type: "string",
      options: { list: ["ai-drafted", "approved", "published"], layout: "radio" },
      initialValue: "ai-drafted",
      validation: (r) => r.required(),
    }),
    defineField({ name: "lowConfidence", title: "⚠ Low confidence (no transcript)", type: "boolean", initialValue: false, readOnly: true }),
    defineField({ name: "primaryTeam", type: "string" }),
    defineField({ name: "teams", type: "array", of: [{ type: "string" }] }),
    defineField({ name: "tags", type: "array", of: [{ type: "string" }] }),
    defineField({ name: "seoTitle", type: "string" }),
    defineField({ name: "seoDescription", type: "text", rows: 2 }),
    defineField({ name: "publishedAt", type: "datetime" }),
    // Editorial labels (v2 brief §0.4): every published page shows content
    // type + production method. Left unset, the site infers sensible values
    // (Analysis + AI-drafted-reviewed for staff companions).
    defineField({
      name: "contentType", title: "Content type",
      type: "string",
      options: { list: ["News", "Analysis", "Opinion", "Projection", "Data", "Community", "Sponsored"] },
    }),
    defineField({
      name: "productionMethod", title: "Production method",
      type: "string",
      options: {
        list: [
          { title: "Written by Josh Pate", value: "josh" },
          { title: "Written by The Pate State editorial team", value: "staff" },
          { title: "Produced with Pate State AI, reviewed by the editorial team", value: "ai-reviewed" },
          { title: "Automated data update", value: "automated" },
        ],
      },
    }),
    defineField({ name: "reviewedBy", title: "Reviewed by (editor)", type: "string" }),
    // Corrections are appended, timestamped, never silent (§0.4, standards
    // page). Rendered at the end of the article.
    defineField({
      name: "corrections", title: "Corrections",
      type: "array",
      of: [{
        type: "object",
        fields: [
          defineField({ name: "at", type: "datetime", validation: (r) => r.required() }),
          defineField({ name: "note", type: "text", rows: 2, validation: (r) => r.required() }),
        ],
        preview: { select: { title: "note", subtitle: "at" } },
      }],
    }),
  ],
  preview: { select: { title: "headline", subtitle: "workflowState" } },
});
