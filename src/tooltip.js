window.createTooltipService = function createTooltipService(deps) {
  let currentMobileTooltip = null;
  let mobileTooltipOriginalParent = null;
  let mobileTooltipNextSibling = null;
  let initialized = false;

  function isMobileDevice() {
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      ) ||
      window.innerWidth <= 768 ||
      "ontouchstart" in window
    );
  }

  function handleMobileTooltipOutsideClick(e) {
    if (currentMobileTooltip && !currentMobileTooltip.contains(e.target)) {
      hideMobile();
    }
  }

  function showMobile(tooltip, content, anchorPoint = null) {
    hideMobile();

    const normalizeContent = (rawHtml) => {
      const temp = document.createElement("div");
      temp.innerHTML = rawHtml || "";
      temp.querySelectorAll(".mobile-close-btn").forEach((btn) => btn.remove());
      return temp.innerHTML;
    };

    const sanitizedContent = normalizeContent(content);
    const isSmallScreen = window.innerWidth <= 768;

    if (isSmallScreen && tooltip.parentElement !== document.body) {
      mobileTooltipOriginalParent = tooltip.parentElement;
      mobileTooltipNextSibling = tooltip.nextSibling;
      document.body.appendChild(tooltip);
    }

    tooltip.classList.add("mobile-tooltip");
    document.body.classList.add("mobile-tooltip-open");
    tooltip.innerHTML = sanitizedContent;
    tooltip.style.display = "block";

    if (!isSmallScreen && anchorPoint) {
      const margin = 10;
      const gap = 12;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      tooltip.style.position = "fixed";
      tooltip.style.transform = "none";
      tooltip.style.width = "min(420px, 86vw)";
      tooltip.style.maxWidth = "86vw";
      tooltip.style.minWidth = "260px";
      tooltip.style.maxHeight = "70vh";
      tooltip.style.overflowY = "auto";
      tooltip.style.left = `${margin}px`;
      tooltip.style.top = `${margin}px`;

      requestAnimationFrame(() => {
        const tipWidth = tooltip.offsetWidth;
        const tipHeight = tooltip.offsetHeight;

        let x = anchorPoint.x + gap;
        if (x + tipWidth > viewportWidth - margin) {
          const leftCandidate = anchorPoint.x - gap - tipWidth;
          if (leftCandidate >= margin) {
            x = leftCandidate;
          } else {
            x = Math.max(margin, viewportWidth - tipWidth - margin);
          }
        }

        let y = anchorPoint.y + gap;
        if (y + tipHeight > viewportHeight - margin) {
          const topCandidate = anchorPoint.y - gap - tipHeight;
          if (topCandidate >= margin) {
            y = topCandidate;
          } else {
            y = Math.max(margin, viewportHeight - tipHeight - margin);
          }
        }

        tooltip.style.left = `${Math.round(x)}px`;
        tooltip.style.top = `${Math.round(y)}px`;
      });
    }

    currentMobileTooltip = tooltip;
    window.currentMobileTooltip = tooltip;

    setTimeout(() => {
      document.addEventListener("touchstart", handleMobileTooltipOutsideClick, true);
      document.addEventListener("click", handleMobileTooltipOutsideClick, true);
    }, 100);
  }

  function hideMobile() {
    if (currentMobileTooltip) {
      currentMobileTooltip.style.display = "none";
      currentMobileTooltip.classList.remove("mobile-tooltip");
      document.body.classList.remove("mobile-tooltip-open");
      currentMobileTooltip.style.removeProperty("position");
      currentMobileTooltip.style.removeProperty("transform");
      currentMobileTooltip.style.removeProperty("width");
      currentMobileTooltip.style.removeProperty("max-width");
      currentMobileTooltip.style.removeProperty("min-width");
      currentMobileTooltip.style.removeProperty("max-height");
      currentMobileTooltip.style.removeProperty("overflow-y");
      currentMobileTooltip.style.removeProperty("left");
      currentMobileTooltip.style.removeProperty("top");

      if (mobileTooltipOriginalParent) {
        if (mobileTooltipNextSibling && mobileTooltipNextSibling.parentNode === mobileTooltipOriginalParent) {
          mobileTooltipOriginalParent.insertBefore(currentMobileTooltip, mobileTooltipNextSibling);
        } else {
          mobileTooltipOriginalParent.appendChild(currentMobileTooltip);
        }
      }

      mobileTooltipOriginalParent = null;
      mobileTooltipNextSibling = null;
      currentMobileTooltip = null;
      window.currentMobileTooltip = null;
    }

    if (!currentMobileTooltip) {
      document.body.classList.remove("mobile-tooltip-open");
    }

    document.removeEventListener("touchstart", handleMobileTooltipOutsideClick, true);
    document.removeEventListener("click", handleMobileTooltipOutsideClick, true);
  }

  function getTooltipHorizontalBounds(margin = 10) {
    let minX = margin;
    let maxX = window.innerWidth - margin;

    if (deps.getFilterPanelOpen()) {
      const panelRect = deps.getFilterPanelElement().getBoundingClientRect();
      if (panelRect.width > 0 && panelRect.left < window.innerWidth) {
        maxX = Math.min(maxX, panelRect.left - margin);
      }
    }

    if (maxX <= minX + 80) {
      maxX = window.innerWidth - margin;
    }

    return { minX, maxX };
  }

  function positionNearPoint(tooltip, pointX, pointY, margin = 10) {
    const tipWidth = tooltip.offsetWidth;
    const tipHeight = tooltip.offsetHeight;
    const viewportHeight = window.innerHeight;
    const horizontalBounds = getTooltipHorizontalBounds(margin);
    const gap = 14;

    let left = pointX + gap;
    if (left + tipWidth > horizontalBounds.maxX) {
      const leftCandidate = pointX - gap - tipWidth;
      if (leftCandidate >= horizontalBounds.minX) {
        left = leftCandidate;
      } else {
        left = Math.max(horizontalBounds.minX, horizontalBounds.maxX - tipWidth);
      }
    }

    let top = pointY + gap;
    if (top + tipHeight > viewportHeight - margin) {
      const topCandidate = pointY - gap - tipHeight;
      if (topCandidate >= margin) {
        top = topCandidate;
      } else {
        top = Math.max(margin, viewportHeight - tipHeight - margin);
      }
    }

    tooltip.style.left = `${Math.round(left + tipWidth / 2)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
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

  function resolveElementAnchorPoint(targetEl) {
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
      const score = Math.sqrt(area);
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

  function showForSvgElement(tooltip, targetEl, hoverEvent = null) {
    tooltip.style.display = "block";
    tooltip.style.minWidth = `${deps.getTooltipMinWidth()}px`;

    requestAnimationFrame(() => {
      if (
        hoverEvent &&
        Number.isFinite(hoverEvent.clientX) &&
        Number.isFinite(hoverEvent.clientY)
      ) {
        positionNearPoint(tooltip, hoverEvent.clientX, hoverEvent.clientY);
        return;
      }

      const targetPoint = resolveElementAnchorPoint(targetEl);
      positionNearPoint(tooltip, targetPoint.x, targetPoint.y);
    });
  }

  function showAtPointer(tooltip, ann, mouseEvent) {
    if (!mouseEvent) return;

    const x = mouseEvent.clientX;
    const y = mouseEvent.clientY;
    tooltip.style.display = "block";
    tooltip.style.minWidth = `${deps.getTooltipMinWidth()}px`;

    requestAnimationFrame(() => {
      positionNearPoint(tooltip, x, y);
    });
  }

  function showForUserAnnotation(tooltip, ann) {
    if (!ann._el) return;

    const markerRect = ann._el.getBoundingClientRect();
    const markerCenterX = markerRect.left + markerRect.width / 2;
    const markerCenterY = markerRect.top + markerRect.height / 2;
    showAtPointer(tooltip, ann, {
      clientX: markerCenterX,
      clientY: markerCenterY,
    });
  }

  function getVisualViewportHeight() {
    const vv = window.visualViewport;
    if (vv && Number.isFinite(vv.height) && vv.height > 0) {
      return vv.height;
    }
    return window.innerHeight || document.documentElement.clientHeight || 0;
  }

  function applyMobileViewportHeightVar() {
    const viewportHeight = getVisualViewportHeight();
    if (!viewportHeight) return;
    document.documentElement.style.setProperty(
      "--mobile-vh",
      `${Math.round(viewportHeight)}px`,
    );
  }

  function initialize() {
    if (initialized) return;
    initialized = true;
    applyMobileViewportHeightVar();
    window.addEventListener("resize", applyMobileViewportHeightVar);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", applyMobileViewportHeightVar);
    }
    window.hideMobileTooltip = hideMobile;
  }

  return {
    initialize,
    isMobileDevice,
    showMobile,
    hideMobile,
    getHorizontalBounds: getTooltipHorizontalBounds,
    positionNearPoint,
    showForSvgElement,
    showForUserAnnotation,
    showAtPointer,
  };
};
