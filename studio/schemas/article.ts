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
  ],
  preview: { select: { title: "headline", subtitle: "workflowState" } },
});
