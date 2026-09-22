window.createFilterPanelStateService = function createFilterPanelStateService(deps) {
  let pendingFocusTimeout = null;

  function isMobileLayout() {
    return window.innerWidth <= 768 || "ontouchstart" in window;
  }

  function clearPendingSearchFocus() {
    if (pendingFocusTimeout) {
      clearTimeout(pendingFocusTimeout);
      pendingFocusTimeout = null;
    }
  }

  function setFilterPanelOpen(open) {
    const isOpen = Boolean(open);
    clearPendingSearchFocus();

    deps.setFilterPanelOpenState(isOpen);

    document.body.classList.toggle("filter-panel-open", isOpen);
    deps.filterPanel.classList.toggle("open", isOpen);
    deps.filterPanel.setAttribute("aria-hidden", isOpen ? "false" : "true");
    deps.openFilterPanelBtn.classList.toggle("active", isOpen);

    updateFilterPanelLayout();

    if (isOpen) {
      // The tag tree cannot measure its own space while the panel is closed,
      // so its default expansion is decided the first time it is visible.
      deps.refreshTagTreeDefaultState();

      if (!isMobileLayout()) {
        pendingFocusTimeout = setTimeout(() => {
          pendingFocusTimeout = null;
          if (!deps.getFilterPanelOpenState()) return;
          deps.filterSearchInput.focus();
        }, 80);
      }
    } else {
      deps.filterSearchInput.blur();
      deps.clearFilterHighlight();
    }

    deps.updateURLState();
  }

  function getFilterPanelWidthPx() {
    return deps.getPanelWidthPx();
  }

  function updateFilterPanelLayout(options = {}) {
    const overlayMode = deps.updateLayout(deps.getFilterPanelOpenState(), options);
    deps.setFilterPanelOverlayMode(overlayMode);
  }

  return {
    setFilterPanelOpen,
    getFilterPanelWidthPx,
    updateFilterPanelLayout,
  };
};
