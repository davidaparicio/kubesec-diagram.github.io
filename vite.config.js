import { defineConfig } from "vite";
import { diagramWebkit } from "diagram-webkit/tools/vite";

export default defineConfig({
  plugins: [
    diagramWebkit({
      definition: "./definition.js",
      tagTree: { file: "METADATA.md", heading: "Tag tree", out: "config/tag-descriptions.generated.js" },
    }),
  ],
});
