window.createUserAnnotationPositioningService = function createUserAnnotationPositioningService(
  deps,
) {
  let frameId = null;

  function isValidBounds(bounds) {
    return (
      bounds &&
      typeof bounds.left === "number" &&
      typeof bounds.top === "number" &&
      typeof bounds.width === "number" &&
      typeof bounds.height === "number" &&
      bounds.width > 0 &&
      bounds.height > 0 &&
      !Number.isNaN(bounds.left) &&
      !Number.isNaN(bounds.top) &&
      !Number.isNaN(bounds.width) &&
      !Number.isNaN(bounds.height)
    );
  }

  function positionUserAnnotationMarkers() {
    const bounds = deps.getImageBounds();
    const wrapper = deps.getWrapper();
    const wrapperRect = wrapper.getBoundingClientRect();

    if (!isValidBounds(bounds)) {
      console.warn(
        "Invalid bounds detected, skipping user annotation positioning",
      );
      return;
    }

    const scale = deps.getMarkerScale();

    deps.getUserAnnotations().forEach((ann) => {
      if (!ann._el) return;

      const style = deps.getUserAnnotationStyle(ann.type);
      if (!style) return;

      // An arrow spans the diagram rather than sitting at one point, so it is
      // laid out from the image frame instead of a single anchor.
      if (style.annotationType === "arrow") {
        deps.updateArrowLayout(ann, deps.getImageFrameInWrapper());
        return;
      }

      const wrapperEl = ann._el;
      const relativeX = ann.x * bounds.width * deps.getCurrentZoom();
      const relativeY = ann.y * bounds.height * deps.getCurrentZoom();

      const imageLeftInWrapper =
        bounds.left - wrapperRect.left + wrapper.scrollLeft;
      const imageTopInWrapper = bounds.top - wrapperRect.top + wrapper.scrollTop;
      const left = imageLeftInWrapper + relativeX;
      const top = imageTopInWrapper + relativeY;

      wrapperEl.style.left = `${left}px`;
      wrapperEl.style.top = `${top}px`;

      if (style.annotationType === "area") {
        const areaElement = wrapperEl.querySelector(".area-annotation");
        if (areaElement) {
          const widthRel = ann.widthRel;
          const heightRel = ann.heightRel;

          const pixelWidth = widthRel * bounds.width * deps.getCurrentZoom();
          const pixelHeight = heightRel * bounds.height * deps.getCurrentZoom();

          areaElement.style.width = `${pixelWidth}px`;
          areaElement.style.height = `${pixelHeight}px`;
        }
      } else {
        const marker = wrapperEl.querySelector(".marker");
        if (marker) {
          const baseSize = bounds.width * scale;
          const userSize =
            baseSize * (style.scale || 2.0) * deps.getCurrentZoom();

          marker.style.width = `${userSize}px`;
          marker.style.height = `${userSize}px`;
          marker.style.fontSize = `${userSize * 0.4}px`;
        }
      }
    });
  }

  function scheduleMarkerPositioning(immediate = false) {
    if (immediate || deps.getIsTouchActive()) {
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      positionUserAnnotationMarkers();
      return;
    }

    if (frameId) return;

    frameId = requestAnimationFrame(() => {
      frameId = null;
      positionUserAnnotationMarkers();
    });
  }

  return {
    isValidBounds,
    positionUserAnnotationMarkers,
    scheduleMarkerPositioning,
  };
};
