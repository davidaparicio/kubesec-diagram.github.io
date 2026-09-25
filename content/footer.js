// From prod index.html at 9847549. The version comes from the README changelog.
import version from "../config/version.generated.js";

const REPO = "https://github.com/kubesec-diagram/kubesec-diagram.github.io";

export default {
  links: [
    { label: "GitHub", href: REPO },
    { label: "issues", href: `${REPO}/issues`, paren: true },
    { label: "⭐", href: `${REPO}/stargazers`, title: "Star this project" },
  ],
  version: `v${version}`,
};
