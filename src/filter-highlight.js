window.createFilterHighlightService = function createFilterHighlightService(deps = {}) {
  let activeFilterHighlight = null;
  let activeConnection = null;
  let pendingHighlightToken = 0;
  let lineLayer = null;
  let lineElement = null;
  let lineFrame = null;
  let lineAnimationFrame = null;
  const VIEWPORT_PADDING = 8;

  function clampToViewport(value, max) {
    return Math.max(VIEWPORT_PADDING, Math.min(value, max - VIEWPORT_PADDING));
  }

  function getRectFromSvgGraphicsElement(element) {
    if (!element || typeof element.getBBox !== "function" || typeof element.getScreenCTM !== "function") {
      return null;
    }

    try {
      const bbox = element.getBBox();
      const ctm = element.getScreenCTM();
      if (!bbox || !ctm || !Number.isFinite(bbox.width) || !Number.isFinite(bbox.height)) {
        return null;
      }
      if (bbox.width <= 0 || bbox.height <= 0) return null;

      const corners = [
        new DOMPoint(bbox.x, bbox.y),
        new DOMPoint(bbox.x + bbox.width, bbox.y),
        new DOMPoint(bbox.x, bbox.y + bbox.height),
        new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height),
      ].map((point) => point.matrixTransform(ctm));

      const xs = corners.map((point) => point.x);
      const ys = corners.map((point) => point.y);
      const left = Math.min(...xs);
      const right = Math.max(...xs);
      const top = Math.min(...ys);
      const bottom = Math.max(...ys);
      const width = right - left;
      const height = bottom - top;

      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return null;
      }

      return { left, top, right, bottom, width, height };
    } catch (_error) {
      return null;
    }
  }

  function getElementRect(element) {
    const svgRect = getRectFromSvgGraphicsElement(element);
    if (svgRect) return svgRect;
    if (!element || typeof element.getBoundingClientRect !== "function") return null;
    const rect = element.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  }

  function resolveElementAnchorPoint(targetEl, sourceX, sourceY) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const viewportArea = viewportWidth * viewportHeight;

    const candidates = [targetEl];
    const candidateSelector =
      "rect,circle,ellipse,path,polygon,polyline,line,text,foreignObject,use,image";
    if (targetEl && typeof targetEl.querySelectorAll === "function") {
      candidates.push(...Array.from(targetEl.querySelectorAll(candidateSelector)));
    }

    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;

    candidates.forEach((candidate) => {
      const rect = getElementRect(candidate);
      if (!rect) return;

      const area = rect.width * rect.height;
      if (!Number.isFinite(area) || area <= 1) return;
      if (area > viewportArea * 0.75) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = centerX - sourceX;
      const dy = centerY - sourceY;
      const dist = Math.hypot(dx, dy);
      const areaPenalty = Math.sqrt(area) * 0.35;
      const score = dist + areaPenalty;

      if (score < bestScore) {
        bestScore = score;
        best = { x: centerX, y: centerY };
      }
    });

    if (best) return best;

    const fallbackRect = getElementRect(targetEl);
    if (fallbackRect) {
      return {
        x: fallbackRect.left + fallbackRect.width / 2,
        y: fallbackRect.top + fallbackRect.height / 2,
      };
    }

    return {
      x: viewportWidth / 2,
      y: viewportHeight / 2,
    };
  }

  function setLinePoints(x1, y1, x2, y2) {
    if (!lineElement) return;
    lineElement.setAttribute("x1", `${x1}`);
    lineElement.setAttribute("y1", `${y1}`);
    lineElement.setAttribute("x2", `${x2}`);
    lineElement.setAttribute("y2", `${y2}`);
  }

  function getConnectionPoints() {
    if (!activeConnection) return null;
    const { sourceEl, targetEl } = activeConnection;
    if (!sourceEl || !targetEl || !document.body.contains(sourceEl) || !document.body.contains(targetEl)) {
      return null;
    }

    const sourceRect = sourceEl.getBoundingClientRect();
    const targetPoint = resolveElementAnchorPoint(targetEl, sourceRect.left + 8, sourceRect.top + sourceRect.height / 2);
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const sourceViewportEl = sourceEl.closest(".filter-panel-body");

    const sourceRawX = sourceRect.left + 8;
    const sourceRawY = sourceRect.top + sourceRect.height / 2;
    const targetRawX = targetPoint.x;
    const targetRawY = targetPoint.y;

    let sourceMinY = VIEWPORT_PADDING;
    let sourceMaxY = viewportHeight - VIEWPORT_PADDING;
    if (sourceViewportEl) {
      const sourceViewportRect = sourceViewportEl.getBoundingClientRect();
      sourceMinY = Math.max(sourceMinY, sourceViewportRect.top + VIEWPORT_PADDING);
      sourceMaxY = Math.min(sourceMaxY, sourceViewportRect.bottom - VIEWPORT_PADDING);
    }

    if (sourceMaxY < sourceMinY) {
      sourceMinY = VIEWPORT_PADDING;
      sourceMaxY = viewportHeight - VIEWPORT_PADDING;
    }

    return {
      viewportWidth,
      viewportHeight,
      sourceX: clampToViewport(sourceRawX, viewportWidth),
      sourceY: Math.max(sourceMinY, Math.min(sourceRawY, sourceMaxY)),
      targetX: clampToViewport(targetRawX, viewportWidth),
      targetY: clampToViewport(targetRawY, viewportHeight),
    };
  }

  function stopLineAnimation() {
    if (!lineAnimationFrame) return;
    cancelAnimationFrame(lineAnimationFrame);
    lineAnimationFrame = null;
  }

  function animateLineToTarget(durationMs = 200) {
    stopLineAnimation();

    const points = getConnectionPoints();
    if (!points || !lineLayer) {
      if (lineLayer) lineLayer.classList.remove("active");
      return;
    }

    lineLayer.setAttribute(
      "viewBox",
      `0 0 ${points.viewportWidth} ${points.viewportHeight}`,
    );
    lineLayer.classList.add("active");

    const { sourceX, sourceY, targetX, targetY } = points;
    setLinePoints(sourceX, sourceY, sourceX, sourceY);

    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const x = sourceX + (targetX - sourceX) * t;
      const y = sourceY + (targetY - sourceY) * t;
      setLinePoints(sourceX, sourceY, x, y);

      if (t < 1) {
        lineAnimationFrame = requestAnimationFrame(step);
      } else {
        lineAnimationFrame = null;
      }
    };

    lineAnimationFrame = requestAnimationFrame(step);
  }

  function ensureLineLayer() {
    if (lineLayer && lineElement) return;

    const ns = "http://www.w3.org/2000/svg";
    lineLayer = document.createElementNS(ns, "svg");
    lineLayer.classList.add("filter-highlight-line-layer");
    lineElement = document.createElementNS(ns, "line");
    lineElement.classList.add("filter-highlight-line");
    lineLayer.appendChild(lineElement);
    document.body.appendChild(lineLayer);

    window.addEventListener("resize", scheduleLineUpdate, { passive: true });
    window.addEventListener("scroll", scheduleLineUpdate, true);
  }

  function updateLinePosition() {
    lineFrame = null;
    if (!activeConnection || !lineLayer || !lineElement) return;

    const points = getConnectionPoints();
    if (!points) {
      lineLayer.classList.remove("active");
      return;
    }

    lineLayer.setAttribute(
      "viewBox",
      `0 0 ${points.viewportWidth} ${points.viewportHeight}`,
    );
    setLinePoints(points.sourceX, points.sourceY, points.targetX, points.targetY);
    lineLayer.classList.add("active");
  }

  function scheduleLineUpdate() {
    if (!activeConnection) return;
    if (lineFrame) return;
    lineFrame = requestAnimationFrame(updateLinePosition);
  }

  function clear() {
    pendingHighlightToken += 1;

    if (!activeFilterHighlight) return;

    if (activeFilterHighlight.type === "help") {
      activeFilterHighlight.record?.element?.classList.remove("help-highlight");
    }

    stopLineAnimation();
    activeConnection = null;
    if (lineLayer) {
      lineLayer.classList.remove("active");
    }

    activeFilterHighlight = null;
  }

  function highlightHelpAnnotation(record, sourceEl = null) {
    clear();
    if (!record?.element) return;

    if (sourceEl) {
      ensureLineLayer();
      activeConnection = {
        sourceEl,
        targetEl: record.element,
      };
      animateLineToTarget(200);
    }

    activeFilterHighlight = { type: "help", record };
  }

  function bindResultHighlight(item, record) {
    const onEnter = () => {
      if (typeof deps.centerRecordInView === "function") {
        const token = ++pendingHighlightToken;
        deps.centerRecordInView(record, 250, () => {
          if (token !== pendingHighlightToken) return;
          highlightHelpAnnotation(record, item);
        });
        return;
      }

      highlightHelpAnnotation(record, item);
    };

    item.addEventListener("mouseenter", onEnter);
    item.addEventListener("focus", onEnter);
    item.addEventListener("mouseleave", clear);
    item.addEventListener("blur", clear);
  }

  function refreshConnectionPosition() {
    scheduleLineUpdate();
  }

  return {
    clear,
    highlightHelpAnnotation,
    bindResultHighlight,
    refreshConnectionPosition,
  };
};
