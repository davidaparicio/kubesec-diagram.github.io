window.createViewportService = function createViewportService(deps) {
  const PAN_INDICATOR_EPSILON = 2;
  const FIT_ALL_INSET = 20;
  const FIT_ALL_GAP_EPSILON = 0.75;
  // How far the diagram may hang past the viewport, measured against the black
  // band at full zoom-out. That band is what a zoom has to move the diagram
  // through, so allowing it is what keeps the point under the pointer in
  // place; without it the diagram is pinned the moment it fills the viewport,
  // and zooming in on something near an edge eats the band first and drags the
  // target towards the middle. It is a constant for a given layout, so the
  // bound still moves continuously with the zoom and nothing snaps.
  const OVERHANG_SLACK_RATIO = 1;
  // The slack is faded out as the zoom approaches its floor, so full zoom-out
  // still lands on the whole diagram and cannot be dragged off to one side.
  const OVERHANG_TAPER_EXPONENT = 3;
  let panDragBounds = { x: null, y: null };
  let panIndicatorLayer = null;
  let panIndicatorUp = null;
  let panIndicatorRight = null;
  let panIndicatorDown = null;
  let panIndicatorLeft = null;

  function ensurePanIndicatorLayer() {
    if (panIndicatorLayer) return;

    panIndicatorLayer = document.createElement("div");
    panIndicatorLayer.className = "pan-indicator-layer";

    panIndicatorUp = document.createElement("div");
    panIndicatorUp.className = "pan-indicator pan-indicator-up";

    panIndicatorRight = document.createElement("div");
    panIndicatorRight.className = "pan-indicator pan-indicator-right";

    panIndicatorDown = document.createElement("div");
    panIndicatorDown.className = "pan-indicator pan-indicator-down";

    panIndicatorLeft = document.createElement("div");
    panIndicatorLeft.className = "pan-indicator pan-indicator-left";

    panIndicatorLayer.appendChild(panIndicatorUp);
    panIndicatorLayer.appendChild(panIndicatorRight);
    panIndicatorLayer.appendChild(panIndicatorDown);
    panIndicatorLayer.appendChild(panIndicatorLeft);

    deps.wrapper.appendChild(panIndicatorLayer);
  }

  function setIndicatorVisible(indicator, visible) {
    if (!indicator) return;
    indicator.classList.toggle("active", Boolean(visible));
  }

  function getViewportSize() {
    const wrapperStyles = window.getComputedStyle(deps.wrapper);
    const padLeft = Number.parseFloat(wrapperStyles.paddingLeft) || 0;
    const padRight = Number.parseFloat(wrapperStyles.paddingRight) || 0;
    const padTop = Number.parseFloat(wrapperStyles.paddingTop) || 0;
    const padBottom = Number.parseFloat(wrapperStyles.paddingBottom) || 0;

    return {
      width: Math.max(1, (deps.wrapper.clientWidth || window.innerWidth) - padLeft - padRight),
      height: Math.max(1, (deps.wrapper.clientHeight || window.innerHeight) - padTop - padBottom),
    };
  }

  function getScaledImageSize() {
    const currentZoom = deps.getCurrentZoom();
    return {
      width: (deps.image.offsetWidth || deps.image.clientWidth) * currentZoom,
      height: (deps.image.offsetHeight || deps.image.clientHeight) * currentZoom,
    };
  }

  function getAxisTranslate(alignment, viewportSize, scaledSize) {
    if (alignment === "right" || alignment === "bottom") {
      return viewportSize - scaledSize;
    }
    if (alignment === "center") {
      return (viewportSize - scaledSize) / 2;
    }
    return 0;
  }

  function updatePanIndicators(viewportWidth, viewportHeight, scaledWidth, scaledHeight) {
    ensurePanIndicatorLayer();

    const imageTranslateX = deps.getImageTranslateX();
    const imageTranslateY = deps.getImageTranslateY();
    const minX = viewportWidth - scaledWidth;
    const minY = viewportHeight - scaledHeight;

    const canRevealLeft = scaledWidth > viewportWidth && imageTranslateX < -PAN_INDICATOR_EPSILON;
    const canRevealRight =
      scaledWidth > viewportWidth && imageTranslateX > minX + PAN_INDICATOR_EPSILON;
    const canRevealTop = scaledHeight > viewportHeight && imageTranslateY < -PAN_INDICATOR_EPSILON;
    const canRevealBottom =
      scaledHeight > viewportHeight && imageTranslateY > minY + PAN_INDICATOR_EPSILON;

    setIndicatorVisible(panIndicatorLeft, canRevealLeft);
    setIndicatorVisible(panIndicatorRight, canRevealRight);
    setIndicatorVisible(panIndicatorUp, canRevealTop);
    setIndicatorVisible(panIndicatorDown, canRevealBottom);
  }

  // How far out the diagram may be zoomed: down to the point where every edge
  // is inside the viewport. Past the zoom that fills the screen the leftover
  // space is letterboxed instead of the zoom being blocked.
  function computeMinZoom() {
    const coverZoom = deps.getCoverZoom();
    const displayedWidth = deps.image.offsetWidth || deps.image.clientWidth;
    const displayedHeight = deps.image.offsetHeight || deps.image.clientHeight;
    if (!displayedWidth || !displayedHeight) {
      return coverZoom;
    }

    const viewport = getViewportSize();
    const fitScale = Math.min(
      viewport.width / displayedWidth,
      viewport.height / displayedHeight,
    );
    if (!Number.isFinite(fitScale) || fitScale <= 0) {
      return coverZoom;
    }

    return Math.min(coverZoom, fitScale);
  }

  function syncMinZoom() {
    const minZoom = computeMinZoom();
    deps.setMinZoom(minZoom);

    if (deps.getCurrentZoom() < minZoom) {
      deps.setCurrentZoom(minZoom);
    }
  }

  function syncDiagramSize() {
    const viewport = getViewportSize();
    const viewportWidth = viewport.width;
    const viewportHeight = viewport.height;

    const viewportAspectRatio = viewportWidth / Math.max(1, viewportHeight);
    const diagramAspectRatio = deps.getDiagramAspectRatio();
    const hasAspectRatio =
      Number.isFinite(diagramAspectRatio) && diagramAspectRatio > 0;
    const fitAllMode = typeof deps.getFitAllMode === "function" ? deps.getFitAllMode() : false;
    const fitGeometryMode =
      typeof deps.getFitGeometryMode === "function" ? deps.getFitGeometryMode() : "cover";
    const useContainFit = fitGeometryMode === "contain";

    if (hasAspectRatio) {
      const fitByHeight = useContainFit
        ? viewportAspectRatio > diagramAspectRatio
        : viewportAspectRatio < diagramAspectRatio;
      if (fitByHeight) {
        const fittedWidth = Math.max(1, viewportHeight * diagramAspectRatio);
        deps.image.style.height = `${viewportHeight}px`;
        deps.image.style.width = `${fittedWidth}px`;
      } else {
        const fittedHeight = Math.max(1, viewportWidth / diagramAspectRatio);
        deps.image.style.width = `${viewportWidth}px`;
        deps.image.style.height = `${fittedHeight}px`;
      }
    } else {
      deps.image.style.width = `${viewportWidth}px`;
      deps.image.style.height = `${viewportHeight}px`;
    }

    syncMinZoom();
    deps.setCachedBounds(null);
  }

  // The diagram's own edges: where a drag is allowed to stop.
  function getStrictPanRange(viewportSize, scaledSize) {
    const gap = viewportSize - scaledSize;
    return { min: Math.min(0, gap), max: Math.max(0, gap) };
  }

  // One bound for both cases: the diagram overflowing the viewport and the
  // diagram sitting inside it. Both ends move continuously with the zoom, so
  // there is no point where the view snaps sideways.
  function getPanRange(viewportSize, scaledSize, displayedSize) {
    const gap = viewportSize - scaledSize;
    const minZoom = deps.getMinZoom();
    const currentZoom = deps.getCurrentZoom();
    const maxGap = Math.max(0, viewportSize - displayedSize * minZoom);
    const taper =
      currentZoom > 0 ? 1 - (minZoom / currentZoom) ** OVERHANG_TAPER_EXPONENT : 0;
    const slack = maxGap * OVERHANG_SLACK_RATIO * Math.max(0, Math.min(1, taper));

    return {
      min: Math.min(0, gap) - slack,
      max: Math.max(0, gap) + slack,
    };
  }

  // A drag is bounded by the diagram's edges, but it must not jerk a view that
  // a zoom left overhanging back into place. The room the drag starts with is
  // whatever the view already has; it is given up as the drag moves back
  // inside, and never handed out again.
  function clampAlongAxis(axis, translate, viewportSize, scaledSize, displayedSize) {
    const strict = getStrictPanRange(viewportSize, scaledSize);
    const isPanning = typeof deps.getIsPanning === "function" && deps.getIsPanning();

    if (!isPanning) {
      panDragBounds[axis] = null;
      const range = getPanRange(viewportSize, scaledSize, displayedSize);
      return Math.max(range.min, Math.min(translate, range.max));
    }

    if (!panDragBounds[axis]) {
      panDragBounds[axis] = {
        min: Math.min(strict.min, translate),
        max: Math.max(strict.max, translate),
      };
    }

    const bounds = panDragBounds[axis];
    const clamped = Math.max(bounds.min, Math.min(translate, bounds.max));

    bounds.min = Math.min(strict.min, Math.max(bounds.min, clamped));
    bounds.max = Math.max(strict.max, Math.min(bounds.max, clamped));

    return clamped;
  }

  function clampPanToBounds() {
    const displayedWidth = deps.image.offsetWidth || deps.image.clientWidth;
    const displayedHeight = deps.image.offsetHeight || deps.image.clientHeight;
    const viewport = getViewportSize();
    const viewportWidth = viewport.width;
    const viewportHeight = viewport.height;

    if (!displayedWidth || !displayedHeight || !viewportWidth || !viewportHeight) {
      return;
    }

    const currentZoom = deps.getCurrentZoom();

    let imageTranslateX = deps.getImageTranslateX();
    let imageTranslateY = deps.getImageTranslateY();

    const scaledWidth = displayedWidth * currentZoom;
    const scaledHeight = displayedHeight * currentZoom;
    const fitAllMode = typeof deps.getFitAllMode === "function" ? deps.getFitAllMode() : false;
    const fitGeometryMode =
      typeof deps.getFitGeometryMode === "function" ? deps.getFitGeometryMode() : "cover";

    if (!fitAllMode && fitGeometryMode === "contain") {
      return;
    }
    const gapX = Math.max(0, viewportWidth - scaledWidth);
    const gapY = Math.max(0, viewportHeight - scaledHeight);
    const hasGapX = gapX > FIT_ALL_GAP_EPSILON;
    const hasGapY = gapY > FIT_ALL_GAP_EPSILON;
    const insetAxis =
      fitAllMode && hasGapX && hasGapY
        ? gapX >= gapY
          ? "x"
          : "y"
        : null;

    if (!fitAllMode) {
      deps.setImageTranslateX(
        clampAlongAxis("x", imageTranslateX, viewportWidth, scaledWidth, displayedWidth),
      );
      deps.setImageTranslateY(
        clampAlongAxis("y", imageTranslateY, viewportHeight, scaledHeight, displayedHeight),
      );
      return;
    }

    if (scaledWidth > viewportWidth) {
      const minX = viewportWidth - scaledWidth;
      const maxX = 0;
      imageTranslateX = Math.max(minX, Math.min(imageTranslateX, maxX));
    } else {
      if (fitAllMode) {
        const useInsetX = insetAxis === "x" || (!insetAxis && hasGapX && !hasGapY);
        imageTranslateX =
          useInsetX && gapX >= FIT_ALL_INSET * 2
            ? FIT_ALL_INSET + (gapX - FIT_ALL_INSET * 2) / 2
            : gapX / 2;
      } else {
        // Zoomed out past the edge of the diagram: the sides move independently
        // and the diagram may hang past an edge, so the point under the pointer
        // stays put instead of being dragged in as the band is eaten.
        const slackX = getOverhangSlack(gapX, viewportWidth, displayedWidth);
        imageTranslateX = Math.max(-slackX, Math.min(imageTranslateX, gapX + slackX));
      }
    }

    if (scaledHeight > viewportHeight) {
      const minY = viewportHeight - scaledHeight;
      const maxY = 0;
      imageTranslateY = Math.max(minY, Math.min(imageTranslateY, maxY));
    } else {
      if (fitAllMode) {
        const useInsetY = insetAxis === "y" || (!insetAxis && hasGapY && !hasGapX);
        imageTranslateY =
          useInsetY && gapY >= FIT_ALL_INSET * 2
            ? FIT_ALL_INSET + (gapY - FIT_ALL_INSET * 2) / 2
            : gapY / 2;
      } else {
        const slackY = getOverhangSlack(gapY, viewportHeight, displayedHeight);
        imageTranslateY = Math.max(-slackY, Math.min(imageTranslateY, gapY + slackY));
      }
    }

    deps.setImageTranslateX(imageTranslateX);
    deps.setImageTranslateY(imageTranslateY);
  }

  function getAlignmentTranslate(horizontal = "center", vertical = "center") {
    const viewport = getViewportSize();
    const scaled = getScaledImageSize();

    return {
      x: getAxisTranslate(horizontal, viewport.width, scaled.width),
      y: getAxisTranslate(vertical, viewport.height, scaled.height),
    };
  }

  function alignImageAtCurrentZoom(horizontal = "center", vertical = "center") {
    const translate = getAlignmentTranslate(horizontal, vertical);

    deps.setImageTranslateX(translate.x);
    deps.setImageTranslateY(translate.y);
  }

  function centerImageAtCurrentZoom() {
    alignImageAtCurrentZoom("center", "center");
  }

  function getImageBounds(forceRefresh = false) {
    const cachedBounds = deps.getCachedBounds();
    const isTouchActive = deps.getIsTouchActive();

    if (!forceRefresh && isTouchActive && cachedBounds) {
      const imageTranslateX = deps.getImageTranslateX();
      const imageTranslateY = deps.getImageTranslateY();
      return {
        ...cachedBounds,
        left: cachedBounds.left + imageTranslateX,
        top: cachedBounds.top + imageTranslateY,
        right: cachedBounds.right + imageTranslateX,
        bottom: cachedBounds.bottom + imageTranslateY,
      };
    }

    if (forceRefresh || !cachedBounds) {
      void deps.image.offsetHeight;
    }

    const imageRect = deps.image.getBoundingClientRect();
    const baseWidth = deps.image.offsetWidth || deps.image.clientWidth;
    const baseHeight = deps.image.offsetHeight || deps.image.clientHeight;
    let displayedWidth = baseWidth;
    let displayedHeight = baseHeight;

    const diagramAspectRatio = deps.getDiagramAspectRatio();
    const hasAspectRatio =
      Number.isFinite(diagramAspectRatio) && diagramAspectRatio > 0;
    if (hasAspectRatio && baseWidth > 0 && baseHeight > 0) {
      const elementAspectRatio = baseWidth / baseHeight;
      if (elementAspectRatio > diagramAspectRatio) {
        displayedHeight = baseHeight;
        displayedWidth = displayedHeight * diagramAspectRatio;
      } else {
        displayedWidth = baseWidth;
        displayedHeight = displayedWidth / diagramAspectRatio;
      }
    }

    const bounds = {
      left: imageRect.left,
      top: imageRect.top,
      width: displayedWidth,
      height: displayedHeight,
      right: imageRect.left + displayedWidth,
      bottom: imageRect.top + displayedHeight,
    };

    if (!isTouchActive) {
      deps.setCachedBounds({
        left: imageRect.left,
        top: imageRect.top,
        width: displayedWidth,
        height: displayedHeight,
        right: imageRect.left + displayedWidth,
        bottom: imageRect.top + displayedHeight,
      });
    }

    return bounds;
  }

  function updateImageTransform() {
    // The zoom floor depends on the viewport, which can change without a
    // re-sync (resize settles, panel layout, orientation change).
    syncMinZoom();
    clampPanToBounds();

    const currentZoom = deps.getCurrentZoom();
    const imageTranslateX = deps.getImageTranslateX();
    const imageTranslateY = deps.getImageTranslateY();
    deps.image.style.transform = `matrix(${currentZoom}, 0, 0, ${currentZoom}, ${imageTranslateX}, ${imageTranslateY})`;
    const viewport = getViewportSize();
    const viewportWidth = viewport.width;
    const viewportHeight = viewport.height;
    const scaled = getScaledImageSize();
    deps.image.style.cursor = "grab";

    updatePanIndicators(viewportWidth, viewportHeight, scaled.width, scaled.height);

    deps.scheduleMarkerPositioning(deps.getIsTouchActive());

    if (typeof deps.onViewportSettled === "function") {
      deps.onViewportSettled();
    }
  }

  function applyRawTransform() {
    const currentZoom = deps.getCurrentZoom();
    const imageTranslateX = deps.getImageTranslateX();
    const imageTranslateY = deps.getImageTranslateY();
    deps.image.style.transform = `matrix(${currentZoom}, 0, 0, ${currentZoom}, ${imageTranslateX}, ${imageTranslateY})`;

    const viewport = getViewportSize();
    const viewportWidth = viewport.width;
    const viewportHeight = viewport.height;
    const scaled = getScaledImageSize();
    deps.image.style.cursor = "grab";

    updatePanIndicators(viewportWidth, viewportHeight, scaled.width, scaled.height);

    deps.scheduleMarkerPositioning(deps.getIsTouchActive());
  }

  return {
    syncDiagramSize,
    syncMinZoom,
    clampPanToBounds,
    getAlignmentTranslate,
    alignImageAtCurrentZoom,
    centerImageAtCurrentZoom,
    getImageBounds,
    updateImageTransform,
    applyRawTransform,
  };
};
