window.createUserAnnotationArrowService = function createUserAnnotationArrowService(
  deps,
) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  // Both ends must stay grabbable at any zoom, so the hit stroke is far wider
  // than the drawn one and the handles keep a fixed screen size.
  const SHAFT_HIT_WIDTH_PX = 18;
  const HANDLE_RADIUS_PX = 7;
  // Marker ids are document-wide, and the same style is now drawn in both the
  // type picker and the annotation list.
  let swatchSequence = 0;

  function createArrowSwatch(style) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "type-btn-arrow-svg");
    svg.setAttribute("viewBox", "0 0 40 40");
    svg.setAttribute("aria-hidden", "true");

    swatchSequence += 1;
    const markerId = `arrow-swatch-head-${swatchSequence}`;
    const defs = document.createElementNS(SVG_NS, "defs");
    const marker = document.createElementNS(SVG_NS, "marker");
    marker.setAttribute("id", markerId);
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "11");
    marker.setAttribute("markerHeight", "11");
    marker.setAttribute("orient", "auto-start-reverse");
    // Fixed size, not strokeWidth-relative: on the 5px types a scaled head
    // swallowed the whole swatch and every thick arrow looked the same.
    marker.setAttribute("markerUnits", "userSpaceOnUse");
    marker.setAttribute("refX", "8");
    const head = document.createElementNS(SVG_NS, "path");
    head.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    head.setAttribute("fill", style.border);
    marker.appendChild(head);
    defs.appendChild(marker);
    svg.appendChild(defs);

    const strokeWidth = style.strokeWidth || 3;
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", "8");
    line.setAttribute("y1", "31");
    line.setAttribute("x2", "27");
    line.setAttribute("y2", "14");
    line.setAttribute("stroke", style.border);
    line.setAttribute("stroke-width", `${strokeWidth}`);
    line.setAttribute("stroke-linecap", "round");
    if (style.borderStyle === "dashed") {
      line.setAttribute("stroke-dasharray", "6 4");
    } else if (style.borderStyle === "dotted") {
      line.setAttribute("stroke-dasharray", "1 4");
    } else if (style.borderStyle === "double") {
      line.setAttribute("stroke-dasharray", "12 3");
    }
    line.setAttribute("marker-end", `url(#${markerId})`);
    svg.appendChild(line);

    return svg;
  }

  function getStrokeWidth(style) {
    const parsed = Number.parseFloat(style && style.strokeWidth);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
  }

  function isArrowAnnotation(ann) {
    const style = deps.getUserAnnotationStyle(ann && ann.type);
    return Boolean(style) && style.annotationType === "arrow";
  }

  // The wrapper spans the whole image frame, so arrow coordinates stay plain
  // fractions of the diagram and survive zoom and pan untouched.
  function getArrowPoints(ann, frame) {
    return {
      x1: ann.x * frame.width,
      y1: ann.y * frame.height,
      x2: (Number.isFinite(ann.x2) ? ann.x2 : ann.x) * frame.width,
      y2: (Number.isFinite(ann.y2) ? ann.y2 : ann.y) * frame.height,
    };
  }

  function createArrowElements(ann, index, style) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "arrow-annotation");
    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";
    svg.style.overflow = "visible";
    svg.style.pointerEvents = "none";

    const markerId = `user-arrow-head-${index}`;
    const defs = document.createElementNS(SVG_NS, "defs");
    const marker = document.createElementNS(SVG_NS, "marker");
    marker.setAttribute("id", markerId);
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refX", "9");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "6");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("orient", "auto-start-reverse");
    marker.setAttribute("markerUnits", "strokeWidth");
    const head = document.createElementNS(SVG_NS, "path");
    head.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    head.setAttribute("fill", style.border);
    marker.appendChild(head);
    defs.appendChild(marker);
    svg.appendChild(defs);

    const shaft = document.createElementNS(SVG_NS, "line");
    shaft.setAttribute("class", "arrow-annotation-shaft");
    shaft.setAttribute("stroke", style.border);
    shaft.setAttribute("stroke-width", `${getStrokeWidth(style)}`);
    shaft.setAttribute("stroke-linecap", "round");
    if (style.borderStyle === "dashed") {
      shaft.setAttribute("stroke-dasharray", "10 6");
    } else if (style.borderStyle === "dotted") {
      shaft.setAttribute("stroke-dasharray", "2 6");
    }
    shaft.setAttribute("marker-end", `url(#${markerId})`);

    const hit = document.createElementNS(SVG_NS, "line");
    hit.setAttribute("class", "arrow-annotation-hit");
    hit.setAttribute("stroke", "transparent");
    hit.setAttribute("stroke-width", `${SHAFT_HIT_WIDTH_PX}`);
    hit.setAttribute("stroke-linecap", "round");
    hit.style.pointerEvents = "stroke";

    svg.appendChild(shaft);
    svg.appendChild(hit);

    const handles = ["tail", "head"].map((end) => {
      const handle = document.createElementNS(SVG_NS, "circle");
      handle.setAttribute("class", `arrow-annotation-handle arrow-handle-${end}`);
      handle.setAttribute("r", `${HANDLE_RADIUS_PX}`);
      handle.setAttribute("fill", "#ffffff");
      handle.setAttribute("stroke", style.border);
      handle.setAttribute("stroke-width", "2");
      handle.dataset.arrowEnd = end;
      svg.appendChild(handle);
      return handle;
    });

    return { svg, shaft, hit, handles };
  }

  function updateArrowLayout(ann, frame) {
    const parts = ann._arrow;
    if (!parts || !ann._el) return;

    ann._el.style.left = `${frame.left}px`;
    ann._el.style.top = `${frame.top}px`;
    ann._el.style.width = `${frame.width}px`;
    ann._el.style.height = `${frame.height}px`;

    parts.svg.setAttribute("width", `${frame.width}`);
    parts.svg.setAttribute("height", `${frame.height}`);

    const points = getArrowPoints(ann, frame);
    [parts.shaft, parts.hit].forEach((line) => {
      line.setAttribute("x1", `${points.x1}`);
      line.setAttribute("y1", `${points.y1}`);
      line.setAttribute("x2", `${points.x2}`);
      line.setAttribute("y2", `${points.y2}`);
    });

    parts.handles[0].setAttribute("cx", `${points.x1}`);
    parts.handles[0].setAttribute("cy", `${points.y1}`);
    parts.handles[1].setAttribute("cx", `${points.x2}`);
    parts.handles[1].setAttribute("cy", `${points.y2}`);

    const editing = deps.getEditModeEnabled();
    parts.handles.forEach((handle) => {
      handle.style.display = editing ? "block" : "none";
      handle.style.pointerEvents = editing ? "auto" : "none";
    });
    parts.hit.style.cursor = editing ? "move" : "pointer";
  }

  function clampUnit(value) {
    return Math.max(0, Math.min(1, value));
  }

  function addArrowDragListeners(ann) {
    const parts = ann._arrow;
    if (!parts) return;

    let dragEnd = null;
    let dragStart = null;

    const pointerOf = (event) =>
      event.touches && event.touches[0] ? event.touches[0] : event;

    const beginDrag = (end) => (event) => {
      if (!deps.getEditModeEnabled()) return;
      const pointer = pointerOf(event);
      dragEnd = end;
      dragStart = {
        clientX: pointer.clientX,
        clientY: pointer.clientY,
        x: ann.x,
        y: ann.y,
        x2: Number.isFinite(ann.x2) ? ann.x2 : ann.x,
        y2: Number.isFinite(ann.y2) ? ann.y2 : ann.y,
      };
      event.preventDefault();
      event.stopPropagation();
    };

    const drag = (event) => {
      if (!dragEnd) return;

      const pointer = pointerOf(event);
      const frame = deps.getImageFrameInWrapper();
      const deltaX = (pointer.clientX - dragStart.clientX) / frame.width;
      const deltaY = (pointer.clientY - dragStart.clientY) / frame.height;

      if (dragEnd === "tail") {
        ann.x = clampUnit(dragStart.x + deltaX);
        ann.y = clampUnit(dragStart.y + deltaY);
      } else if (dragEnd === "head") {
        ann.x2 = clampUnit(dragStart.x2 + deltaX);
        ann.y2 = clampUnit(dragStart.y2 + deltaY);
      } else {
        // The shaft moves both ends, and stops as soon as either would leave
        // the diagram, so the arrow never deforms while being moved.
        const limitedX = Math.max(
          -Math.min(dragStart.x, dragStart.x2),
          Math.min(deltaX, 1 - Math.max(dragStart.x, dragStart.x2)),
        );
        const limitedY = Math.max(
          -Math.min(dragStart.y, dragStart.y2),
          Math.min(deltaY, 1 - Math.max(dragStart.y, dragStart.y2)),
        );
        ann.x = dragStart.x + limitedX;
        ann.y = dragStart.y + limitedY;
        ann.x2 = dragStart.x2 + limitedX;
        ann.y2 = dragStart.y2 + limitedY;
      }

      updateArrowLayout(ann, frame);
      event.preventDefault();
    };

    const endDrag = (event) => {
      if (!dragEnd) return;
      dragEnd = null;
      dragStart = null;
      deps.encodeUserAnnotationsToURL();
      event.preventDefault();
    };

    parts.handles[0].addEventListener("mousedown", beginDrag("tail"));
    parts.handles[0].addEventListener("touchstart", beginDrag("tail"));
    parts.handles[1].addEventListener("mousedown", beginDrag("head"));
    parts.handles[1].addEventListener("touchstart", beginDrag("head"));
    parts.hit.addEventListener("mousedown", beginDrag("shaft"));
    parts.hit.addEventListener("touchstart", beginDrag("shaft"));

    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", endDrag);
    document.addEventListener("touchmove", drag, { passive: false });
    document.addEventListener("touchend", endDrag);
  }

  function addArrowHoverEvents(ann, tooltip) {
    const parts = ann._arrow;
    if (!parts) return;

    let hideTimeout = null;

    const show = (event) => {
      if (deps.getEditModeEnabled()) return;
      clearTimeout(hideTimeout);
      deps.tooltipService.showAtPointer(
        tooltip,
        ann,
        event.touches && event.touches[0] ? event.touches[0] : event,
      );
    };

    const hide = () => {
      hideTimeout = setTimeout(
        () => (tooltip.style.display = "none"),
        deps.getTooltipHideDelay(),
      );
    };

    parts.hit.addEventListener("mouseenter", show);
    parts.hit.addEventListener("mousemove", show);
    parts.hit.addEventListener("mouseleave", hide);
    parts.hit.addEventListener("touchstart", (event) => {
      if (deps.getEditModeEnabled()) return;
      if (event.cancelable) event.preventDefault();
      show(event);
    });

    tooltip.addEventListener("mouseenter", () => clearTimeout(hideTimeout));
    tooltip.addEventListener("mouseleave", hide);
  }

  function renderArrowAnnotation(ann, index, style, tooltip) {
    const wrapperEl = document.createElement("div");
    wrapperEl.className = "user-annotation-wrapper arrow-annotation-wrapper";
    wrapperEl.style.position = "absolute";
    wrapperEl.style.zIndex = "10";
    wrapperEl.style.pointerEvents = "none";

    const parts = createArrowElements(ann, index, style);
    wrapperEl.appendChild(parts.svg);
    deps.wrapper.appendChild(wrapperEl);

    ann._el = wrapperEl;
    ann._arrow = parts;
    ann._tooltip = tooltip;
    ann._index = index;

    updateArrowLayout(ann, deps.getImageFrameInWrapper());
    if (tooltip) {
      addArrowHoverEvents(ann, tooltip);
    }
    addArrowDragListeners(ann);
  }

  return {
    createArrowSwatch,
    isArrowAnnotation,
    renderArrowAnnotation,
    updateArrowLayout,
  };
};
