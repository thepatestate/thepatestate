import { defineField, defineType } from "sanity";

// Wire Desk (ops manual §3, wire-desk manual v2.0). Items are the short rail
// entries; stories are the full product-template articles for importance >= 7.

export const wireItem = defineType({
  name: "wireItem",
  title: "Wire Item",
  type: "document",
  fields: [
    defineField({ name: "headline", type: "string", validation: (r) => r.required() }),
    defineField({ name: "sub", type: "string" }),
    defineField({
      name: "category",
      type: "string",
      options: { list: ["recruiting", "coaching", "injury", "transfer", "playoff", "media", "legal", "general"] },
    }),
    defineField({ name: "teams", type: "array", of: [{ type: "string" }] }),
    defineField({ name: "importance", type: "number", validation: (r) => r.min(1).max(10) }),
    defineField({ name: "sourceUrls", type: "array", of: [{ type: "url" }] }),
    defineField({ name: "sourceOutlets", type: "array", of: [{ type: "string" }] }),
    defineField({ name: "story", type: "reference", to: [{ type: "wireStory" }] }),
    defineField({ name: "publishedAt", type: "datetime" }),
  ],
  preview: {
    select: { title: "headline", subtitle: "category" },
  },
});

export const wireStory = defineType({
  name: "wireStory",
  title: "Wire Story",
  type: "document",
  fields: [
    defineField({ name: "headline", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", type: "slug", options: { source: "headline" } }),
    defineField({
      name: "verification",
      title: "Verification label",
      type: "string",
      options: { list: ["confirmed", "reported", "developing"] },
    }),
    defineField({ name: "category", type: "string" }),
    defineField({ name: "teams", type: "array", of: [{ type: "string" }] }),
    defineField({ name: "whatHappened", type: "text", description: "80–120 words of verified facts, stated directly — no in-prose attribution (sources render in the footer)" }),
    defineField({ name: "whyItMatters", type: "array", of: [{ type: "string" }], description: "2–3 mechanism bullets" }),
    defineField({
      name: "joshReceipt",
      title: "Josh's Receipt (archive quote)",
      type: "object",
      fields: [
        defineField({ name: "quote", type: "text" }),
        defineField({ name: "ytId", type: "string" }),
        defineField({ name: "tsSeconds", type: "number" }),
      ],
    }),
    defineField({
      name: "readLabel",
      title: "Read label",
      type: "string",
      options: { list: ["THE PATE STATE READ", "JOSH'S READ"] },
      description: "JOSH'S READ only when he has actually said it",
    }),
    defineField({ name: "readBody", type: "text" }),
    defineField({ name: "whatsNext", type: "array", of: [{ type: "string" }], description: "Dated, specific events" }),
    defineField({
      name: "sources",
      type: "array",
      of: [{
        type: "object",
        fields: [
          defineField({ name: "outlet", type: "string" }),
          defineField({ name: "url", type: "url" }),
        ],
      }],
    }),
    defineField({ name: "publishedAt", type: "datetime" }),
    defineField({ name: "updatedAt", type: "datetime" }),
    defineField({
      name: "corrections", title: "Corrections (timestamped, never silent)",
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
  preview: {
    select: { title: "headline", subtitle: "verification" },
  },
});
