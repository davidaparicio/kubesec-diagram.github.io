window.createSvgLoaderService = function createSvgLoaderService(deps) {
  // requestAnimationFrame never fires in a hidden tab, so a page opened in the
  // background would sit on "Loading diagram..." until focused. Run the
  // callback on the first of rAF, a timeout, or the tab becoming visible.
  function scheduleOnceWhenRenderable(callback) {
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      callback();
    };
    const onVisibilityChange = () => {
      if (!document.hidden) run();
    };

    requestAnimationFrame(run);
    setTimeout(run, 250);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  async function loadDiagram(diagramSourcePath) {
    try {
      const response = await fetch(diagramSourcePath, { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} while loading ${diagramSourcePath}`);
      }

      const svgMarkup = await response.text();
      deps.image.innerHTML = svgMarkup;

      const svgEl = deps.image.querySelector("svg");
      if (!svgEl) {
        throw new Error("Loaded diagram is not a valid SVG");
      }

      svgEl.setAttribute("preserveAspectRatio", "xMinYMin meet");
      svgEl.style.display = "block";
      svgEl.style.width = "100%";
      svgEl.style.height = "100%";
      svgEl.style.pointerEvents = "auto";

      let nextAspectRatio = null;
      const viewBox = svgEl.getAttribute("viewBox");
      if (viewBox) {
        const parts = viewBox.split(/[\s,]+/).map(Number);
        if (
          parts.length === 4 &&
          Number.isFinite(parts[2]) &&
          Number.isFinite(parts[3]) &&
          parts[2] > 0 &&
          parts[3] > 0
        ) {
          nextAspectRatio = parts[2] / parts[3];
        }
      }

      deps.setDiagramAspectRatio(nextAspectRatio);
      deps.syncDiagramSize();
      deps.initializeSvgPropertyAnnotations();
      deps.initializeTagControls();
      deps.updateFilterPanelLayout();
      scheduleOnceWhenRenderable(() => deps.handleImageLoad());
    } catch (error) {
      deps.handleImageError(error);
    }
  }

  return {
    loadDiagram,
  };
};
