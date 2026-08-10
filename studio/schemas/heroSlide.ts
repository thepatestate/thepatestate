import { defineField, defineType } from "sanity";

// Homepage hero carousel slides (v2 brief §1.1) — editor-managed, no code
// changes needed to swap promotions. The homepage renders active slides in
// `order` order, after an always-first dynamic slide for the latest episode.
const heroSlide = defineType({
  name: "heroSlide",
  title: "Hero Slide",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required(), description: "Short bold overlay title" }),
    defineField({ name: "kicker", type: "string", description: "Small uppercase label above the title (optional)" }),
    defineField({ name: "link", type: "string", validation: (r) => r.required(), description: "Destination path (/poll) or full URL" }),
    defineField({ name: "image", type: "image", description: "Slide art (upload)" }),
    defineField({
      name: "imageUrl",
      type: "string",
      description: "OR a site image path (/img/cfb-flag.jpg) — used when no upload is set",
    }),
    defineField({ name: "order", type: "number", validation: (r) => r.required(), initialValue: 10 }),
    defineField({ name: "active", type: "boolean", initialValue: true }),
  ],
  preview: { select: { title: "title", subtitle: "link" } },
});

export default heroSlide;
