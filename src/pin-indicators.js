window.createPinIndicatorService = function createPinIndicatorService(deps) {
  const LAYER_ID = "pin-indicator-layer";
  // Many rings can be on screen at once, so they are smaller and quieter than
  // the one-shot ring that marks a jump.
  const MIN_SIZE_PX = 16;
  const MAX_SIZE_PX = 40;
  const SIZE_RATIO = 1.15;
  const EDGE_MARGIN_PX = 4;

  let layer = null;
  let rings = new Map();
  let frameId = null;

  function ensureLayer() {
    if (layer && layer.isConnected) return layer;
    layer = document.getElementById(LAYER_ID);
    if (!layer) {
      layer = document.createElement("div");
      layer.id = LAYER_ID;
      document.body.appendChild(layer);
    }
    return layer;
  }

  function positionRing(ring, element) {
    const rect = deps.getElementFocusRect(element);
    if (!rect) {
      ring.hidden = true;
      return;
    }

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // A ring drawn past the edge of the window is just an invisible element
    // animating forever.
    const onScreen =
      centerX >= -EDGE_MARGIN_PX &&
      centerY >= -EDGE_MARGIN_PX &&
      centerX <= window.innerWidth + EDGE_MARGIN_PX &&
      centerY <= window.innerHeight + EDGE_MARGIN_PX;
    if (!onScreen) {
      ring.hidden = true;
      return;
    }

    const size = Math.max(
      MIN_SIZE_PX,
      Math.min(MAX_SIZE_PX, Math.max(rect.width, rect.height) * SIZE_RATIO),
    );

    ring.hidden = false;
    ring.style.width = `${Math.round(size)}px`;
    ring.style.height = `${Math.round(size)}px`;
    ring.style.left = `${Math.round(centerX)}px`;
    ring.style.top = `${Math.round(centerY)}px`;
  }

  // Rebuild only when the set of pinned elements changes, so the pulse
  // animation is not restarted on every pan.
  function render() {
    const elements = deps.getPinnedElements();
    const next = new Map();
    const parent = ensureLayer();

    elements.forEach((element) => {
      if (!element) return;
      const existing = rings.get(element);
      const ring = existing || document.createElement("div");
      if (!existing) {
        ring.className = "pin-indicator";
        // Glow and ping are children of one positioned box, so repositioning
        // moves both together - they cannot drift apart mid-animation.
        const glow = document.createElement("span");
        glow.className = "pin-indicator-glow";
        const ping = document.createElement("span");
        ping.className = "pin-indicator-ping";
        ring.appendChild(glow);
        ring.appendChild(ping);
        parent.appendChild(ring);
      }
      next.set(element, ring);
      positionRing(ring, element);
    });

    rings.forEach((ring, element) => {
      if (next.has(element)) return;
      ring.remove();
    });

    rings = next;
  }

  function reposition() {
    if (rings.size === 0) return;
    rings.forEach((ring, element) => positionRing(ring, element));
  }

  function scheduleReposition() {
    if (rings.size === 0 || frameId) return;
    frameId = requestAnimationFrame(() => {
      frameId = null;
      reposition();
    });
  }

  function hasIndicatorFor(element) {
    return rings.has(element);
  }

  return {
    render,
    reposition,
    scheduleReposition,
    hasIndicatorFor,
  };
};
