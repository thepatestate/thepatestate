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
    defineField({ name: "bodyMarkdown", title: "Body (Editorial Engine V3 — one story at the depth the reporting supports)", type: "text", rows: 18 }),
    defineField({ name: "whatHappened", type: "text", description: "100–175 words of verified facts — official source or named reporter, never another website (Production Guide §5)" }),
    defineField({ name: "whyItMatters", type: "array", of: [{ type: "string" }], description: "LEGACY bullets (pre-v1.2 stories)" }),
    // Production Guide v1.2 fields (reference: docs/content/wire-kansas-state-pastore-v3.html)
    defineField({ name: "deck", type: "text", description: "35–60 words — the layer the headline doesn't show" }),
    defineField({ name: "impact", type: "string", options: { list: ["low", "moderate", "significant", "major", "season-shaping"] } }),
    defineField({ name: "impactRationale", type: "text", description: "One sentence justifying the impact rating" }),
    defineField({
      name: "stats", type: "array",
      of: [{ type: "object", fields: [
        defineField({ name: "value", type: "string" }),
        defineField({ name: "label", type: "string" }),
        defineField({ name: "critical", type: "boolean", initialValue: false }),
      ] }],
      description: "At-a-Glance strip — 3 numbers that establish scale (critical renders red)",
    }),
    defineField({ name: "whyBody", type: "text", description: "Why This One Matters — 100–175 words" }),
    defineField({ name: "missing", type: "text", description: "What Most People Are Missing — the signature discovery module" }),
    defineField({ name: "section04Title", type: "string", description: "Adaptive: Next Man Up / What Changes Now / …" }),
    defineField({ name: "section04Body", type: "text" }),
    defineField({ name: "chessboard", type: "text", description: "What the coaches can actually change — only when a schematic angle exists" }),
    // Wire Editorial System v2.0 §47–48 (2026-08-23): per-story section headers; empty = page default.
    defineField({ name: "openTitle", type: "string", description: "Opening header (What Happened / The Injury / The Move / The Ruling …); empty = What Happened" }),
    defineField({ name: "whyTitle", type: "string", description: "Significance header; empty = Why This One Matters" }),
    defineField({ name: "missingTitle", type: "string", description: "Hidden-layer header; empty = What Most People Are Missing" }),
    defineField({ name: "chessboardTitle", type: "string", description: "Football header; empty = What the Coaches Can Actually Change" }),
    defineField({
      name: "board", type: "object",
      fields: [
        defineField({ name: "title", type: "string" }),
        defineField({ name: "rows", type: "array", of: [{ type: "object", fields: [
          defineField({ name: "name", type: "string" }),
          defineField({ name: "meta", type: "string" }),
          defineField({ name: "note", type: "text" }),
        ] }] }),
        defineField({ name: "summary", type: "text" }),
      ],
      description: "Replacement Board — Pate State projection, never a confirmed depth chart",
    }),
    defineField({
      name: "watching", type: "array",
      of: [{ type: "object", fields: [
        defineField({ name: "title", type: "string" }),
        defineField({ name: "body", type: "text" }),
      ] }],
      description: "What We're Watching — 3–4 concrete tells",
    }),
    defineField({
      name: "facts", type: "array",
      of: [{ type: "object", fields: [
        defineField({ name: "label", type: "string" }),
        defineField({ name: "value", type: "string" }),
      ] }],
      description: "Facts rail rows (label ≤ 2 words)",
    }),
    defineField({ name: "callout", type: "text", description: "The story's own sharpest line — renders as the bold pull quote (verbatim from the story text)" }),
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
