import { defineDiagram } from "diagram-webkit";
import annotations from "./config/annotations.js";
import descriptions from "./config/tag-descriptions.generated.js";
import { groups, meta } from "./config/tags.js";
import { camera, ui } from "./config/ui.js";
import about from "./content/about.js";
import css from "./content/css.js";
import footer from "./content/footer.js";
import page from "./content/page.js";
import views from "./views.js";

const svg = new URL("./kubesec-diagram.svg", import.meta.url).href;

export default defineDiagram({
  id: "kubesec",
  requires: "^0.1.0",
  source: { production: svg, debug: svg },
  tags: { groups, meta, descriptions },
  annotations,
  camera,
  ui,
  content: {
    page,
    about,
    license: "MIT",
    repository: "https://github.com/kubesec-diagram/kubesec-diagram.github.io",
    footer,
    css,
    texts: { diagramLabel: "Kubernetes security diagram", aboutTitle: "Kubernetes security diagram" },
  },
  storage: { namespace: "kubesec" },
  features: "app",
  views,
});
