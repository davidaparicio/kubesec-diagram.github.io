window.createFilterPanelInputService = function createFilterPanelInputService(deps) {
  function initialize() {
    deps.openFilterPanelBtn.addEventListener("click", () => {
      deps.setFilterPanelOpen(!deps.getFilterPanelOpen());
    });

    deps.closeFilterPanelBtn.addEventListener("click", () => {
      deps.setFilterPanelOpen(false);
    });

    deps.filterPanelBackdrop.addEventListener("click", () => {
      if (deps.getFilterPanelOpen() && deps.getFilterPanelOverlayMode()) {
        deps.setFilterPanelOpen(false);
      }
    });

    document.addEventListener("mousedown", (e) => {
      if (!deps.getFilterPanelOpen() || !deps.getFilterPanelOverlayMode()) return;
      if (
        deps.filterPanel.contains(e.target) ||
        deps.openFilterPanelBtn.contains(e.target)
      ) {
        return;
      }
      deps.setFilterPanelOpen(false);
    });

    deps.filterSearchInput.addEventListener("input", () => {
      deps.setAnnotationSearchQuery(deps.filterSearchInput.value || "");
      deps.applyAnnotationFilter();
      deps.updateURLState();
    });

    deps.resetFilterBtn.addEventListener("click", () => {
      deps.setAnnotationSearchQuery("");
      deps.filterSearchInput.value = "";

      deps.getTagVisibility().forEach((_, tag) => {
        deps.getTagVisibility().set(tag, true);
      });

      deps.clearTagTreeFilter();
      deps.initializeTagControls();
      deps.applyAnnotationFilter();
      deps.updateURLState();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !deps.getFilterPanelOpen()) return;
      if (deps.isAnyAnnotationModalOpen()) return;
      deps.setFilterPanelOpen(false);
    });
  }

  return {
    initialize,
  };
};
