// Copied from prod data.js at 9847549.
export const groups = [
  {
    id: "priority",
    label: "Priority",
    order: 1
  },
  {
    id: "general",
    label: "Tags",
    order: 10,
    disableHelpIfHidden: true,
    layout: "tree"
  }
];

export const meta = {
  info: {
    label: "Info",
    group: "priority",
    order: 4,
    style: {
      background: "#DFF4FF",
      color: "#0A3D5A",
      borderColor: "#0B6FA4",
      borderWidth: "3px",
      fontWeight: "700"
    },
    panelStyle: {
      borderColor: "#0B6FA4",
      borderWidth: "3px",
      boxShadow: "inset 0 0 0 1px rgba(11, 111, 164, 0.42)"
    }
  },
  "pri-1": {
    label: "Priority 1",
    group: "priority",
    order: 1,
    style: {
      background: "#FF7A7A",
      color: "#5B1010",
      borderColor: "#7A1414",
      borderWidth: "3px",
      fontWeight: "700"
    },
    panelStyle: {
      borderColor: "#7A1414",
      borderWidth: "3px",
      boxShadow: "inset 0 0 0 1px rgba(122, 20, 20, 0.40)"
    }
  },
  "pri-2": {
    label: "Priority 2",
    group: "priority",
    order: 2,
    style: {
      background: "#FFD1A1",
      color: "#6B2F00",
      borderColor: "#B45F06",
      borderWidth: "3px",
      fontWeight: "700"
    },
    panelStyle: {
      borderColor: "#B45F06",
      borderWidth: "3px",
      boxShadow: "inset 0 0 0 1px rgba(180, 95, 6, 0.35)"
    }
  },
  "pri-3": {
    label: "Priority 3",
    group: "priority",
    order: 3,
    style: {
      background: "#FFF2A6",
      color: "#5C4300",
      borderColor: "#B68A00",
      borderWidth: "3px",
      fontWeight: "700"
    },
    panelStyle: {
      borderColor: "#B68A00",
      borderWidth: "3px",
      boxShadow: "inset 0 0 0 1px rgba(182, 138, 0, 0.35)"
    }
  }
};
