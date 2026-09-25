// Named views for decks and side projects: { title, state }.
export default {
  overview: {
    title: "Overview",
    state: { camera: { fit: true }, level: 0 },
  },
  "api-request": {
    title: "An API request",
    state: {
      camera: { focus: { tags: ["Api"] }, padding: 0.05 },
      onlyTags: ["Api", "Access"],
      level: 2,
      pins: ["KubeApi"],
    },
  },
  rbac: {
    title: "RBAC",
    state: {
      camera: { focus: { slugs: ["Rbac", "SystemMasters"] }, padding: 0.3 },
      pins: ["Rbac"],
      highlight: { slugs: ["Rbac"], mode: "pulse" },
    },
  },
  network: {
    title: "Network",
    state: { camera: { fit: true }, onlyTags: ["Network"] },
  },
  ingress: {
    title: "Ingress routes",
    state: {
      camera: { focus: { tags: ["Ingress"] }, padding: 0.05 },
      onlyTags: ["Ingress", "Network.Ingress"],
      pins: ["Ingress", "Gateway"],
    },
  },
  "supply-chain": {
    title: "Supply chain",
    state: {
      camera: { focus: { tags: ["SupplyChain"] }, padding: 0.05 },
      onlyTags: ["SupplyChain"],
      highlight: { tags: ["SupplyChain.Signing"], mode: "outline" },
    },
  },
  "process-isolation": {
    title: "Process isolation",
    state: {
      camera: { focus: { tags: ["ProcessSecurity"] }, padding: 0.1 },
      onlyTags: ["ProcessSecurity", "Workload"],
      level: 3,
    },
  },
};
