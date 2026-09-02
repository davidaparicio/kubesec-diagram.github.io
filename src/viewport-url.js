window.createViewportUrlService = function createViewportUrlService(deps) {
  const COORD_DECIMALS = 4;
  const ZOOM_EPSILON = 0.001;
  // Breathing room added around a shared rect so it is not flush against
  // the viewport edges and the chrome that overlays the diagram.
  const RESTORE_PADDING = 0.03;
  // How much of a shared rect may fall outside a cover-fitted viewport before
  // we give up on cover geometry and show the whole diagram instead.
  const MAX_COVER_SHORTFALL = 0.15;
  const CENTER_NUDGE_ITERATIONS = 3;
  // Full zoom-out is worth a word rather than a rectangle covering the whole
  // diagram. "0" is accepted as the same thing.
  const FIT_VALUE = "fit";
  const FIT_ALIASES = new Set([FIT_VALUE, "0"]);

  // Filter state is written to the URL during startup, long before the diagram
  // is on screen. Read the incoming view once so those writes cannot strip it,
  // and keep serving it until the reader moves the diagram themselves.
  let userControlled = false;
  let incomingState = null;

  function clampUnit(value) {
    return Math.min(1, Math.max(0, value));
  }

  function formatCoord(value) {
    const factor = 10 ** COORD_DECIMALS;
    return `${Math.round(value * factor) / factor}`;
  }

  function getRootSvg() {
    return deps.image.querySelector("svg");
  }

  function getViewBox() {
    const svgEl = getRootSvg();
    const viewBox = svgEl && svgEl.viewBox && svgEl.viewBox.baseVal;
    if (!viewBox || !(viewBox.width > 0) || !(viewBox.height > 0)) {
      return null;
    }
    return viewBox;
  }

  function getInverseScreenMatrix() {
    const svgEl = getRootSvg();
    if (!svgEl || typeof svgEl.getScreenCTM !== "function") {
      return null;
    }

    try {
      const matrix = svgEl.getScreenCTM();
      if (!matrix || typeof matrix.inverse !== "function") {
        return null;
      }
      return matrix.inverse();
    } catch (error) {
      console.warn("Failed to read diagram screen matrix:", error);
      return null;
    }
  }

  // The shared region is what the reader can actually see: the diagram area
  // minus whatever the filter panel covers, and never the footer strip below
  // the wrapper.
  function getDiagramViewportBounds() {
    const visible = deps.getVisibleViewportBounds();
    const wrapperRect = deps.wrapper.getBoundingClientRect();
    if (!(wrapperRect.width > 0) || !(wrapperRect.height > 0)) {
      return null;
    }

    const minX = Math.max(visible.minX, wrapperRect.left);
    const maxX = Math.min(visible.maxX, wrapperRect.right);
    const minY = Math.max(visible.minY, wrapperRect.top);
    const maxY = Math.min(visible.maxY, wrapperRect.bottom);
    if (!(maxX > minX) || !(maxY > minY)) {
      return null;
    }

    return { minX, maxX, minY, maxY };
  }

  // Visible viewport expressed in diagram space, 0..1 on both axes.
  // clampToDiagram=false keeps the raw extent, which is what the zoom math
  // needs; the serialized rect is clamped so letterboxing is never shared.
  function getVisibleDiagramRect(clampToDiagram = true) {
    const viewBox = getViewBox();
    const inverse = getInverseScreenMatrix();
    if (!viewBox || !inverse) {
      return null;
    }

    const bounds = getDiagramViewportBounds();
    if (!bounds) {
      return null;
    }

    const topLeft = new DOMPoint(bounds.minX, bounds.minY).matrixTransform(inverse);
    const bottomRight = new DOMPoint(bounds.maxX, bounds.maxY).matrixTransform(inverse);
    if (
      !Number.isFinite(topLeft.x) ||
      !Number.isFinite(topLeft.y) ||
      !Number.isFinite(bottomRight.x) ||
      !Number.isFinite(bottomRight.y)
    ) {
      return null;
    }

    let left = (topLeft.x - viewBox.x) / viewBox.width;
    let top = (topLeft.y - viewBox.y) / viewBox.height;
    let right = (bottomRight.x - viewBox.x) / viewBox.width;
    let bottom = (bottomRight.y - viewBox.y) / viewBox.height;

    if (clampToDiagram) {
      left = clampUnit(left);
      top = clampUnit(top);
      right = clampUnit(right);
      bottom = clampUnit(bottom);
    }

    const width = right - left;
    const height = bottom - top;
    if (!(width > 0) || !(height > 0)) {
      return null;
    }

    return {
      cx: left + width / 2,
      cy: top + height / 2,
      w: width,
      h: height,
    };
  }

  function serializeRect(rect) {
    return [rect.cx, rect.cy, rect.w, rect.h].map(formatCoord).join(",");
  }

  function parseRect(rawValue) {
    if (typeof rawValue !== "string") {
      return null;
    }

    const parts = rawValue.split(",").map((part) => Number.parseFloat(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
      return null;
    }

    const [cx, cy, w, h] = parts;
    if (!(w > 0) || !(h > 0) || w > 1 || h > 1) {
      return null;
    }
    if (cx < 0 || cx > 1 || cy < 0 || cy > 1) {
      return null;
    }

    return { cx, cy, w, h };
  }

  function getIncomingState() {
    if (!incomingState) {
      incomingState = parseFromURL();
    }
    return incomingState;
  }

  function markUserControlled() {
    getIncomingState();
    userControlled = true;
  }

  // Zoomed out as far as it goes, whichever way the reader got there.
  function isFullyZoomedOut() {
    return deps.getFitAllMode() || deps.getCurrentZoom() <= deps.getMinZoom() + ZOOM_EPSILON;
  }

  // Coordinates are only worth sharing when the sender picked a view: in the
  // default view the visible rect is a property of their screen, not of the
  // diagram, so the receiver is better off with their own default.
  function getUrlValue() {
    if (!userControlled) {
      const incoming = getIncomingState();
      if (incoming.fit) return FIT_VALUE;
      return incoming.rect ? serializeRect(incoming.rect) : null;
    }

    if (deps.isDefaultViewport()) {
      return null;
    }

    if (isFullyZoomedOut()) {
      return FIT_VALUE;
    }

    const rect = getVisibleDiagramRect(true);
    return rect ? serializeRect(rect) : null;
  }

  function parseFromURL() {
    try {
      const raw = new URLSearchParams(window.location.search).get(deps.viewportParam);
      const fit = typeof raw === "string" && FIT_ALIASES.has(raw.trim().toLowerCase());

      return { fit, rect: fit ? null : parseRect(raw) };
    } catch (error) {
      console.warn("Failed to parse viewport state from URL:", error);
      return { fit: false, rect: null };
    }
  }

  function centerOnRect(rect) {
    const viewBox = getViewBox();
    if (!viewBox) {
      return;
    }

    const bounds = getDiagramViewportBounds();
    if (!bounds) {
      return;
    }

    deps.nudgeToSvgAnchor(
      viewBox.x + rect.cx * viewBox.width,
      viewBox.y + rect.cy * viewBox.height,
      bounds.minX + (bounds.maxX - bounds.minX) / 2,
      bounds.minY + (bounds.maxY - bounds.minY) / 2,
      CENTER_NUDGE_ITERATIONS,
    );
  }

  // Contain semantics: pick the axis that constrains hardest so the whole
  // shared rect fits, and show more than was shared on the other axis.
  // Never the reverse - cropping is what makes a shared link useless.
  function applyRect(rect) {
    const current = getVisibleDiagramRect(false);
    if (!current) {
      return false;
    }

    const targetWidth = Math.min(1, rect.w * (1 + RESTORE_PADDING * 2));
    const targetHeight = Math.min(1, rect.h * (1 + RESTORE_PADDING * 2));
    const scaleFactor = Math.min(current.w / targetWidth, current.h / targetHeight);
    if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) {
      return false;
    }

    const minZoom = deps.getMinZoom();
    const desiredZoom = deps.getCurrentZoom() * scaleFactor;

    // Cover geometry cannot zoom out past minZoom, so a rect that is wider or
    // taller than this screen can show would silently get cropped. Give up on
    // the exact region and show the whole diagram instead.
    if (desiredZoom < minZoom * (1 - MAX_COVER_SHORTFALL)) {
      deps.setFitAllMode(true);
      return true;
    }

    deps.setCurrentZoom(Math.min(deps.getMaxZoom(), Math.max(minZoom, desiredZoom)));
    deps.applyRawTransform();
    centerOnRect(rect);
    deps.updateImageTransform();
    return true;
  }

  function restoreFromURL() {
    const state = getIncomingState();

    if (state.fit) {
      deps.setFitAllMode(true);
      return true;
    }

    if (!state.rect) {
      return false;
    }

    return applyRect(state.rect);
  }

  return {
    getUrlValue,
    markUserControlled,
    parseFromURL,
    restoreFromURL,
    getVisibleDiagramRect,
  };
};
