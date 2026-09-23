window.createKeyboardShortcutsService = function createKeyboardShortcutsService(deps) {
  // A press moves the view by a fraction of what is on screen, so the step
  // stays meaningful at every zoom level.
  const PAN_STEP = 0.15;
  const PAN_STEP_LARGE = 0.5;
  const PAN_KEYS = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };

  let initialized = false;

  function isTypingTarget(target) {
    if (!target || target.nodeType !== 1) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }

  function getShortcutModal() {
    return document.getElementById("shortcut-modal");
  }

  function isShortcutModalOpen() {
    const modal = getShortcutModal();
    return Boolean(modal) && modal.style.display !== "none";
  }

  function setShortcutModalOpen(open) {
    const modal = getShortcutModal();
    if (!modal) return;
    if (open) deps.onShortcutModalOpen();
    modal.style.display = open ? "flex" : "none";
    document.body.classList.toggle("modal-locks-diagram", open);
  }

  function focusSearch() {
    if (!deps.getFilterPanelOpen()) {
      deps.setFilterPanelOpen(true);
    }
    deps.filterSearchInput.focus();
    deps.filterSearchInput.select();
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      if (isShortcutModalOpen()) {
        event.preventDefault();
        setShortcutModalOpen(false);
      }
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;
    if (deps.isAnyModalOpen()) return;

    if (event.key === "?") {
      event.preventDefault();
      setShortcutModalOpen(!isShortcutModalOpen());
      return;
    }

    if (isShortcutModalOpen()) return;

    const panDirection = PAN_KEYS[event.key];
    if (panDirection) {
      event.preventDefault();
      const step = event.shiftKey ? PAN_STEP_LARGE : PAN_STEP;
      deps.panByViewportFraction(panDirection[0] * step, panDirection[1] * step);
      return;
    }

    switch (event.key) {
      case "/":
        event.preventDefault();
        focusSearch();
        return;
      case "+":
      case "=":
        event.preventDefault();
        deps.zoomByKeyboardStep(true);
        return;
      case "-":
      case "_":
        event.preventDefault();
        deps.zoomByKeyboardStep(false);
        return;
      case "0":
        event.preventDefault();
        deps.setFitAllMode(true);
        return;
      default:
    }
  }

  function initialize() {
    if (initialized) return;
    initialized = true;

    document.addEventListener("keydown", handleKeyDown);

    const modal = getShortcutModal();
    if (!modal) return;

    modal.addEventListener("click", (event) => {
      if (event.target === modal) setShortcutModalOpen(false);
    });

    const closeBtn = document.getElementById("close-shortcut-modal");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => setShortcutModalOpen(false));
    }

    const openBtn = document.getElementById("shortcut-toggle");
    if (openBtn) {
      openBtn.addEventListener("click", () => setShortcutModalOpen(!isShortcutModalOpen()));
    }
  }

  return {
    initialize,
    isShortcutModalOpen,
    setShortcutModalOpen,
  };
};
