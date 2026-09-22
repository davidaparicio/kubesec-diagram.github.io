window.createAboutModalService = function createAboutModalService(deps) {
  let initialized = false;

  function getModal() {
    return document.getElementById("about-modal");
  }

  function isOpen() {
    const modal = getModal();
    return Boolean(modal) && modal.style.display !== "none";
  }

  function hasBeenSeen() {
    return localStorage.getItem(deps.storageKey) === "seen";
  }

  function markSeen() {
    localStorage.setItem(deps.storageKey, "seen");
  }

  function setOpen(open) {
    const modal = getModal();
    if (!modal) return;

    // .modal is a centring flex container in CSS; the inline "block" the older
    // modals set overrides that and pins the box to the top of the screen.
    modal.style.display = open ? "flex" : "none";
    // Pan and zoom stay live behind a plain modal, so the diagram would drift
    // under the reader while they read. Lock it while this is open.
    document.body.classList.toggle("modal-locks-diagram", open);
    if (open) markSeen();
  }

  // A link with parameters was sent to show something specific; opening a
  // welcome modal over it would be in the way. Only greet a bare visit.
  function showOnFirstVisit() {
    if (window.location.search.length > 0) return;
    if (hasBeenSeen()) return;
    setOpen(true);
  }

  function initialize() {
    if (initialized) return;
    initialized = true;

    const modal = getModal();
    if (!modal) return;

    modal.addEventListener("click", (event) => {
      if (event.target === modal) setOpen(false);
    });

    const closeBtn = document.getElementById("close-about-modal");
    if (closeBtn) closeBtn.addEventListener("click", () => setOpen(false));

    const openBtn = document.getElementById("about-toggle");
    if (openBtn) openBtn.addEventListener("click", () => setOpen(!isOpen()));

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !isOpen()) return;
      event.preventDefault();
      setOpen(false);
    });
  }

  return {
    initialize,
    isOpen,
    setOpen,
    showOnFirstVisit,
  };
};
