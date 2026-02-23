window.createViewportInputService = function createViewportInputService(deps) {
  let touchStartDistance = 0;
  let touchStartZoom = 1;
  let touchStartCenter = { x: 0, y: 0 };
  let initialized = false;

  function handleResize() {
    try {
      deps.updateFilterPanelLayout();
      deps.syncDiagramSize();

      deps.setCurrentZoom(1);
      deps.centerImageAtCurrentZoom();

      const currentZoom = deps.getCurrentZoom();
      const imageTranslateX = deps.getImageTranslateX();
      const imageTranslateY = deps.getImageTranslateY();
      deps.image.style.transform = `matrix(${currentZoom}, 0, 0, ${currentZoom}, ${imageTranslateX}, ${imageTranslateY})`;
      deps.image.style.cursor = "default";

      deps.setCachedBounds(null);
      deps.setIsTouchActive(false);

      deps.scheduleMarkerPositioning(true);
    } catch (error) {
      console.error("Error during resize handling:", error);
    }
  }

  function isViewportLockedByMobileTooltip() {
    if (document.body.classList.contains("mobile-tooltip-open")) {
      return true;
    }

    const mobileTooltip = window.currentMobileTooltip;
    return Boolean(
      mobileTooltip &&
      mobileTooltip.style &&
      mobileTooltip.style.display !== "none",
    );
  }

  function handleWheel(e) {
    if (isViewportLockedByMobileTooltip()) {
      const mobileTooltip = window.currentMobileTooltip;
      const rawTarget = e && e.target;
      const target =
        rawTarget && rawTarget.nodeType === 1
          ? rawTarget
          : rawTarget && rawTarget.parentElement
            ? rawTarget.parentElement
            : null;
      const insideMobileTooltip =
        mobileTooltip &&
        target &&
        mobileTooltip.contains(target);

      if (!insideMobileTooltip && e.cancelable) e.preventDefault();
      return;
    }

    if (typeof deps.shouldIgnoreWheelEvent === "function" && deps.shouldIgnoreWheelEvent(e)) {
      return;
    }

    if (deps.getFilterPanelOpen() && deps.filterPanel.contains(e.target)) {
      return;
    }

    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      return;
    }

    const imageRect = deps.image.getBoundingClientRect();
    const isOverImage =
      e.clientX >= imageRect.left &&
      e.clientX <= imageRect.right &&
      e.clientY >= imageRect.top &&
      e.clientY <= imageRect.bottom;

    if (!isOverImage) {
      return;
    }

    e.preventDefault();

    const zoomStep = 0.05;
    const oldZoom = deps.getCurrentZoom();
    const imageRectBeforeZoom = deps.image.getBoundingClientRect();
    if (e.deltaY < 0) {
      deps.setCurrentZoom(Math.min(oldZoom + zoomStep, deps.getMaxZoom()));
    } else {
      deps.setCurrentZoom(Math.max(oldZoom - zoomStep, deps.getMinZoom()));
    }

    const currentZoom = deps.getCurrentZoom();
    if (Math.abs(currentZoom - oldZoom) <= 0.001) {
      return;
    }

    const wrapperRectNow = deps.wrapper.getBoundingClientRect();
    const anchorXOnWrapper = e.clientX - wrapperRectNow.left;
    const anchorYOnWrapper = e.clientY - wrapperRectNow.top;

    const imageLeftOnWrapper = imageRectBeforeZoom.left - wrapperRectNow.left;
    const imageTopOnWrapper = imageRectBeforeZoom.top - wrapperRectNow.top;
    const imageBaseLeftOnWrapper = imageLeftOnWrapper - deps.getImageTranslateX();
    const imageBaseTopOnWrapper = imageTopOnWrapper - deps.getImageTranslateY();

    const targetX = (anchorXOnWrapper - imageLeftOnWrapper) / oldZoom;
    const targetY = (anchorYOnWrapper - imageTopOnWrapper) / oldZoom;

    deps.setImageTranslateX(
      anchorXOnWrapper - imageBaseLeftOnWrapper - targetX * currentZoom,
    );
    deps.setImageTranslateY(
      anchorYOnWrapper - imageBaseTopOnWrapper - targetY * currentZoom,
    );

    if (deps.getCurrentZoom() < deps.getMinZoom()) {
      deps.setCurrentZoom(deps.getMinZoom());
    }

    deps.updateImageTransform();
  }

  function handleMouseDown(e) {
    if (isViewportLockedByMobileTooltip()) return;
    if (deps.getCurrentZoom() <= 1) return;
    if (e.button !== 0) return;
    if (!deps.image.contains(e.target)) return;

    deps.setIsPanning(true);
    deps.setPanStartX(e.clientX - deps.getImageTranslateX());
    deps.setPanStartY(e.clientY - deps.getImageTranslateY());

    deps.image.style.cursor = "grabbing";
    e.preventDefault();
  }

  function handleMouseMove(e) {
    if (isViewportLockedByMobileTooltip()) return;
    if (!deps.getIsPanning()) return;

    deps.setImageTranslateX(e.clientX - deps.getPanStartX());
    deps.setImageTranslateY(e.clientY - deps.getPanStartY());

    deps.updateImageTransform();
    e.preventDefault();
  }

  function handleMouseUp(e) {
    if (isViewportLockedByMobileTooltip()) {
      if (deps.getIsPanning()) {
        deps.setIsPanning(false);
      }
      return;
    }

    if (!deps.getIsPanning()) return;

    deps.setIsPanning(false);
    deps.image.style.cursor =
      deps.getCurrentZoom() > deps.getMinZoom() ? "grab" : "default";
    e.preventDefault();
  }

  function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getTouchCenter(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }

  function canPanAtCurrentZoom() {
    const currentZoom = deps.getCurrentZoom();
    const displayedWidth = deps.image.offsetWidth || deps.image.clientWidth;
    const displayedHeight = deps.image.offsetHeight || deps.image.clientHeight;
    const wrapperStyles = window.getComputedStyle(deps.wrapper);
    const padLeft = Number.parseFloat(wrapperStyles.paddingLeft) || 0;
    const padRight = Number.parseFloat(wrapperStyles.paddingRight) || 0;
    const padTop = Number.parseFloat(wrapperStyles.paddingTop) || 0;
    const padBottom = Number.parseFloat(wrapperStyles.paddingBottom) || 0;
    const viewportWidth = Math.max(
      1,
      (deps.wrapper.clientWidth || window.innerWidth) - padLeft - padRight,
    );
    const viewportHeight = Math.max(
      1,
      (deps.wrapper.clientHeight || window.innerHeight) - padTop - padBottom,
    );

    return (
      displayedWidth * currentZoom > viewportWidth ||
      displayedHeight * currentZoom > viewportHeight
    );
  }

  function shouldIgnoreTouchEvent(e) {
    const rawTarget = e && e.target;
    const target =
      rawTarget && typeof rawTarget.closest === "function"
        ? rawTarget
        : rawTarget && rawTarget.parentElement && typeof rawTarget.parentElement.closest === "function"
          ? rawTarget.parentElement
          : null;

    const mobileTooltip = window.currentMobileTooltip;
    if (
      mobileTooltip &&
      mobileTooltip.style &&
      mobileTooltip.style.display !== "none" &&
      target &&
      mobileTooltip.contains(target)
    ) {
      return true;
    }

    if (!target || typeof target.closest !== "function") return false;

    return Boolean(
      target.closest(".tooltip-box") ||
      target.closest("#filter-panel") ||
      target.closest("#user-annotations-modal") ||
      target.closest("#edit-annotation-modal"),
    );
  }

  function handleTouchStart(e) {
    if (isViewportLockedByMobileTooltip()) {
      deps.setIsPanning(false);
      deps.setIsTouchActive(false);
      return;
    }

    if (shouldIgnoreTouchEvent(e)) {
      deps.setIsPanning(false);
      deps.setIsTouchActive(false);
      return;
    }

    deps.setIsTouchActive(true);

    deps.setCachedBounds(null);
    deps.getImageBounds(true);

    if (e.touches.length === 2) {
      touchStartDistance = getTouchDistance(e.touches);
      touchStartZoom = deps.getCurrentZoom();
      const center = getTouchCenter(e.touches);
      const wrapperRect = deps.wrapper.getBoundingClientRect();
      touchStartCenter = {
        x: center.x - wrapperRect.left,
        y: center.y - wrapperRect.top,
      };
      if (e.cancelable) e.preventDefault();
      return;
    }

    if (e.touches.length === 1 && canPanAtCurrentZoom()) {
      deps.setIsPanning(true);
      deps.setPanStartX(e.touches[0].clientX - deps.getImageTranslateX());
      deps.setPanStartY(e.touches[0].clientY - deps.getImageTranslateY());
      if (e.cancelable) e.preventDefault();
    }
  }

  function handleTouchMove(e) {
    if (isViewportLockedByMobileTooltip()) {
      return;
    }

    if (shouldIgnoreTouchEvent(e)) {
      return;
    }

    if (e.touches.length === 2) {
      const currentDistance = getTouchDistance(e.touches);
      const currentCenter = getTouchCenter(e.touches);
      const imageRectBeforeZoom = deps.image.getBoundingClientRect();

      const distanceRatio = currentDistance / touchStartDistance;
      const zoomFactor = Math.max(0.5, Math.min(2.0, distanceRatio));
      const newZoom = Math.max(
        deps.getMinZoom(),
        Math.min(deps.getMaxZoom(), touchStartZoom * zoomFactor),
      );

      const wrapperRect = deps.wrapper.getBoundingClientRect();
      const centerX = currentCenter.x - wrapperRect.left;
      const centerY = currentCenter.y - wrapperRect.top;
      const imageLeftOnWrapper = imageRectBeforeZoom.left - wrapperRect.left;
      const imageTopOnWrapper = imageRectBeforeZoom.top - wrapperRect.top;
      const imageBaseLeftOnWrapper = imageLeftOnWrapper - deps.getImageTranslateX();
      const imageBaseTopOnWrapper = imageTopOnWrapper - deps.getImageTranslateY();

      const oldZoom = deps.getCurrentZoom();
      deps.setCurrentZoom(newZoom);

      const targetX = (centerX - imageLeftOnWrapper) / oldZoom;
      const targetY = (centerY - imageTopOnWrapper) / oldZoom;

      deps.setImageTranslateX(
        centerX - imageBaseLeftOnWrapper - targetX * deps.getCurrentZoom(),
      );
      deps.setImageTranslateY(
        centerY - imageBaseTopOnWrapper - targetY * deps.getCurrentZoom(),
      );

      if (deps.getCurrentZoom() < deps.getMinZoom()) {
        deps.setCurrentZoom(deps.getMinZoom());
      }

      deps.updateImageTransform();
      if (e.cancelable) e.preventDefault();
      return;
    }

    if (e.touches.length === 1 && deps.getIsPanning()) {
      deps.setImageTranslateX(e.touches[0].clientX - deps.getPanStartX());
      deps.setImageTranslateY(e.touches[0].clientY - deps.getPanStartY());
      deps.updateImageTransform();
      if (e.cancelable) e.preventDefault();
    }
  }

  function handleTouchEnd(e) {
    if (isViewportLockedByMobileTooltip()) {
      deps.setIsPanning(false);
      deps.setIsTouchActive(false);
      return;
    }

    if (shouldIgnoreTouchEvent(e)) {
      return;
    }

    if (e.touches.length !== 0) return;

    deps.setIsPanning(false);
    touchStartDistance = 0;
    touchStartCenter = { x: 0, y: 0 };

    deps.setIsTouchActive(false);
    deps.setCachedBounds(null);
    deps.scheduleMarkerPositioning(true);
  }

  function handleDocumentTouchMove(e) {
    if (isViewportLockedByMobileTooltip()) {
      return;
    }

    if (!deps.getIsTouchActive()) return;
    if (!e.touches || e.touches.length < 2) return;
    if (e.cancelable) e.preventDefault();
  }

  function handleGestureEvent(e) {
    if (e.cancelable) e.preventDefault();
  }

  function initialize() {
    if (initialized) return;
    initialized = true;

    window.addEventListener("resize", handleResize);

    document.addEventListener("wheel", handleWheel, { passive: false });
    deps.image.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    deps.wrapper.addEventListener("touchstart", handleTouchStart, { passive: false });
    deps.wrapper.addEventListener("touchmove", handleTouchMove, { passive: false });
    deps.wrapper.addEventListener("touchend", handleTouchEnd);

    document.addEventListener("touchmove", handleDocumentTouchMove, { passive: false });
    deps.wrapper.addEventListener("gesturestart", handleGestureEvent, { passive: false });
    deps.wrapper.addEventListener("gesturechange", handleGestureEvent, { passive: false });
    deps.wrapper.addEventListener("gestureend", handleGestureEvent, { passive: false });
  }

  return {
    initialize,
    handleResize,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
};
