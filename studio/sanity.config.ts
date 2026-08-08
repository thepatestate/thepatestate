import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./schemas";

export default defineConfig({
  name: "thepatestate",
  title: "The Pate State",
  projectId: "kuv6jjyo",
  dataset: "production",
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title("The Newsroom")
          .items([
            S.listItem()
              .title("⏳ Approval Queue")
              .child(
                S.documentList()
                  .title("Awaiting Approval")
                  .filter('_type == "article" && workflowState == "ai-drafted"')
              ),
            S.listItem()
              .title("✅ Approved / Published")
              .child(
                S.documentList()
                  .title("Approved & Published")
                  .filter('_type == "article" && workflowState != "ai-drafted"')
              ),
            S.divider(),
            S.documentTypeListItem("episode").title("Episodes"),
          ]),
    }),
    visionTool(),
  ],
  schema: { types: schemaTypes },
});
