window.createViewportService = function createViewportService(deps) {
  function syncDiagramSize() {
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

    const isPortraitViewport = viewportHeight > viewportWidth;
    const diagramAspectRatio = deps.getDiagramAspectRatio();
    const hasAspectRatio =
      Number.isFinite(diagramAspectRatio) && diagramAspectRatio > 0;

    if (isPortraitViewport && hasAspectRatio) {
      const fittedWidth = Math.max(1, Math.round(viewportHeight * diagramAspectRatio));
      deps.image.style.height = `${Math.round(viewportHeight)}px`;
      deps.image.style.width = `${fittedWidth}px`;
    } else {
      deps.image.style.width = "100%";
      deps.image.style.height = "100%";
    }

    deps.setCachedBounds(null);
  }

  function clampPanToBounds() {
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

    if (!displayedWidth || !displayedHeight || !viewportWidth || !viewportHeight) {
      return;
    }

    const currentZoom = deps.getCurrentZoom();

    let imageTranslateX = deps.getImageTranslateX();
    let imageTranslateY = deps.getImageTranslateY();

    const scaledWidth = displayedWidth * currentZoom;
    const scaledHeight = displayedHeight * currentZoom;

    if (scaledWidth > viewportWidth) {
      const minX = viewportWidth - scaledWidth;
      const maxX = 0;
      imageTranslateX = Math.max(minX, Math.min(imageTranslateX, maxX));
    } else {
      imageTranslateX = 0;
    }

    if (scaledHeight > viewportHeight) {
      const minY = viewportHeight - scaledHeight;
      const maxY = 0;
      imageTranslateY = Math.max(minY, Math.min(imageTranslateY, maxY));
    } else {
      imageTranslateY = 0;
    }

    deps.setImageTranslateX(imageTranslateX);
    deps.setImageTranslateY(imageTranslateY);
  }

  function centerImageAtCurrentZoom() {
    deps.setImageTranslateX(0);
    deps.setImageTranslateY(0);
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
    clampPanToBounds();

    const currentZoom = deps.getCurrentZoom();
    const imageTranslateX = deps.getImageTranslateX();
    const imageTranslateY = deps.getImageTranslateY();
    deps.image.style.transform = `matrix(${currentZoom}, 0, 0, ${currentZoom}, ${imageTranslateX}, ${imageTranslateY})`;
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
    const canPan =
      displayedWidth * currentZoom > viewportWidth ||
      displayedHeight * currentZoom > viewportHeight;
    deps.image.style.cursor = canPan ? "grab" : "default";

    deps.scheduleMarkerPositioning(deps.getIsTouchActive());
  }

  return {
    syncDiagramSize,
    clampPanToBounds,
    centerImageAtCurrentZoom,
    getImageBounds,
    updateImageTransform,
  };
};
