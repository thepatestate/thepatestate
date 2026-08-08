import { defineType, defineField } from "sanity";

export default defineType({
  name: "episode",
  title: "Episode",
  type: "document",
  fields: [
    defineField({ name: "ytId", title: "YouTube ID", type: "string", validation: (r) => r.required() }),
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({ name: "description", type: "text" }),
    defineField({ name: "publishedAt", type: "datetime", validation: (r) => r.required() }),
    defineField({ name: "thumbnailUrl", type: "url" }),
    defineField({ name: "durationSeconds", type: "number" }),
    defineField({ name: "viewCount", type: "number" }),
    defineField({
      name: "series", type: "string",
      options: { list: ["weekend-truths", "poll-day", "sit-down", "picks-drop", "espn-friday", "mailbag", "general"] },
      initialValue: "general",
    }),
    defineField({ name: "transcriptStatus", type: "string", options: { list: ["fetched", "unavailable"] } }),
  ],
  preview: { select: { title: "title", subtitle: "series" } },
});
