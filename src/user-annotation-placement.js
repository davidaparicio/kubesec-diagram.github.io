window.createUserAnnotationPlacementService =
  function createUserAnnotationPlacementService(deps) {
    const SVG_NS = "http://www.w3.org/2000/svg";
    // An arrow shorter than this is a mis-click, not a placement.
    const MIN_ARROW_LENGTH_PX = 12;

    let isInPlacementMode = false;
    let currentPlacementData = null;
    let placementMouseMoveHandler = null;
    let placementClickHandler = null;
    let dragGhost = null;
    let arrowPreview = null;
    let arrowTailPoint = null;

    function removeArrowPreview() {
      if (arrowPreview && arrowPreview.parentNode) {
        arrowPreview.parentNode.removeChild(arrowPreview);
      }
      arrowPreview = null;
      arrowTailPoint = null;
    }

    function cleanupPlacementMode() {
      if (!isInPlacementMode) return;

      const wrapper = deps.getWrapper();

      if (placementMouseMoveHandler) {
        wrapper.removeEventListener("mousemove", placementMouseMoveHandler);
        placementMouseMoveHandler = null;
      }

      if (placementClickHandler) {
        wrapper.removeEventListener("click", placementClickHandler);
        placementClickHandler = null;
      }

      if (dragGhost && dragGhost.parentNode) {
        dragGhost.parentNode.removeChild(dragGhost);
      }
      dragGhost = null;
      removeArrowPreview();

      wrapper.style.cursor = "";

      isInPlacementMode = false;
      currentPlacementData = null;
    }

    // The arrow is placed with two clicks - tail, then head - so the preview
    // is a rubber band from the first click to the pointer.
    function createArrowPreview(style) {
      const wrapper = deps.getWrapper();
      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("class", "arrow-placement-preview");
      svg.style.position = "absolute";
      svg.style.inset = "0";
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.pointerEvents = "none";
      svg.style.zIndex = "1000";
      svg.style.overflow = "visible";

      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("stroke", style.border);
      line.setAttribute("stroke-width", `${style.strokeWidth || 3}`);
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("stroke-dasharray", "8 6");
      svg.appendChild(line);

      wrapper.appendChild(svg);
      arrowPreview = svg;
      return line;
    }

    function getImageRelativePoint(clientX, clientY) {
      const bounds = deps.getImageBounds(true);
      const imageEl =
        typeof deps.getImageElement === "function" ? deps.getImageElement() : null;
      const imageRect =
        imageEl && typeof imageEl.getBoundingClientRect === "function"
          ? imageEl.getBoundingClientRect()
          : null;
      const rectLeft = imageRect ? imageRect.left : bounds.left;
      const rectTop = imageRect ? imageRect.top : bounds.top;
      const rectWidth = imageRect ? imageRect.width : bounds.width;
      const rectHeight = imageRect ? imageRect.height : bounds.height;

      return {
        x: (clientX - rectLeft) / rectWidth,
        y: (clientY - rectTop) / rectHeight,
      };
    }

    function startAddAnnotationModeWithData(annotationData) {
      if (isInPlacementMode) {
        cleanupPlacementMode();
      }

      const style = deps.getUserAnnotationStyle(annotationData.type);
      if (!annotationData.type || !style) {
        return;
      }

      isInPlacementMode = true;
      currentPlacementData = annotationData;

      const wrapper = deps.getWrapper();
      const isAreaAnnotation = style.annotationType === "area";

      if (style.annotationType === "arrow") {
        startArrowPlacement(style);
        return;
      }

      dragGhost = document.createElement("div");
      dragGhost.className = "user-annotation-ghost";
      dragGhost.style.position = "absolute";
      dragGhost.style.background = style.bg;
      dragGhost.style.color = style.color;
      const borderWidth = style.borderWidth || "3px";
      const borderStyle = style.borderStyle || "solid";
      dragGhost.style.border = `${borderWidth} ${borderStyle} ${style.border}`;
      dragGhost.style.cursor = "move";
      dragGhost.style.zIndex = "1000";
      dragGhost.style.pointerEvents = "none";
      dragGhost.style.opacity = "0.8";

      if (isAreaAnnotation) {
        const width = style.defaultSize.width;
        const height = style.defaultSize.height;
        dragGhost.style.width = `${width}px`;
        dragGhost.style.height = `${height}px`;
        dragGhost.style.borderRadius =
          annotationData.shape === "circle" ? "50%" : "4px";
        dragGhost.style.display = "flex";
        dragGhost.style.alignItems = "center";
        dragGhost.style.justifyContent = "center";
        dragGhost.style.fontWeight = "bold";
        dragGhost.style.fontSize = "14px";
        dragGhost.textContent = "+";
      } else {
        dragGhost.style.borderRadius =
          annotationData.shape === "circle" ? "50%" : "8px";
        dragGhost.style.width = "32px";
        dragGhost.style.height = "32px";
        dragGhost.style.display = "flex";
        dragGhost.style.alignItems = "center";
        dragGhost.style.justifyContent = "center";
        dragGhost.style.fontWeight = "bold";
        dragGhost.style.fontSize = "14px";
        dragGhost.textContent = "+";
      }

      wrapper.appendChild(dragGhost);
      wrapper.style.cursor = "crosshair";

      placementMouseMoveHandler = (e) => {
        if (!dragGhost) return;

        const bounds = wrapper.getBoundingClientRect();
        const ghostWidth = Number.parseInt(dragGhost.style.width, 10);
        const ghostHeight = Number.parseInt(dragGhost.style.height, 10);
        const x = e.clientX - bounds.left - ghostWidth / 2;
        const y = e.clientY - bounds.top - ghostHeight / 2;

        dragGhost.style.left = `${x}px`;
        dragGhost.style.top = `${y}px`;
      };

      placementClickHandler = (e) => {
        if (!isInPlacementMode || !currentPlacementData) {
          return;
        }

        const currentStyle = deps.getUserAnnotationStyle(currentPlacementData.type);
        const currentIsAreaAnnotation =
          currentStyle && currentStyle.annotationType === "area";

        const bounds = deps.getImageBounds(true);
        const imageEl =
          typeof deps.getImageElement === "function" ? deps.getImageElement() : null;
        const imageRect =
          imageEl && typeof imageEl.getBoundingClientRect === "function"
            ? imageEl.getBoundingClientRect()
            : null;
        const rectLeft = imageRect ? imageRect.left : bounds.left;
        const rectTop = imageRect ? imageRect.top : bounds.top;
        const rectWidth = imageRect ? imageRect.width : bounds.width;
        const rectHeight = imageRect ? imageRect.height : bounds.height;
        let x = (e.clientX - rectLeft) / rectWidth;
        let y = (e.clientY - rectTop) / rectHeight;

        if (currentIsAreaAnnotation && currentStyle.defaultSize) {
          const pixelWidth = currentStyle.defaultSize.width;
          const pixelHeight = currentStyle.defaultSize.height;

          const halfWidthRel = pixelWidth / 2 / bounds.width;
          const halfHeightRel = pixelHeight / 2 / bounds.height;

          x -= halfWidthRel;
          y -= halfHeightRel;
        }

        if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
          if (!hasRoomForAnotherAnnotation()) return;

          const annotation = {
            x,
            y,
            title: currentPlacementData.title,
            description: currentPlacementData.description,
            type: currentPlacementData.type,
            shape: currentPlacementData.shape || "rectangle",
          };

          if (currentIsAreaAnnotation) {
            annotation.widthRel = currentStyle.defaultSize.width / bounds.width;
            annotation.heightRel = currentStyle.defaultSize.height / bounds.height;
          }

          commitAnnotation(annotation);
        } else {
          cleanupPlacementMode();
        }
      };

      wrapper.addEventListener("mousemove", placementMouseMoveHandler);
      wrapper.addEventListener("click", placementClickHandler);
    }

    // Shared by every annotation type: store it, drop out of placement mode,
    // then rebind hover on the freshly rendered element and enter edit mode so
    // the new annotation can be adjusted straight away.
    function commitAnnotation(annotation) {
      const userAnnotations = deps.getUserAnnotations();
      userAnnotations.push(annotation);
      cleanupPlacementMode();
      deps.clearInlineForm();
      deps.encodeUserAnnotationsToURL();

      requestAnimationFrame(() => {
        deps.renderAllMarkers();
        deps.updateUserAnnotationsList();

        setTimeout(() => {
          const newAnnotation = userAnnotations[userAnnotations.length - 1];
          if (!newAnnotation || !newAnnotation._el) return;

          const newStyle = deps.getUserAnnotationStyle(newAnnotation.type);
          if (!newStyle) return;

          // Arrows bind their own hover while rendering, since the target is
          // the shaft rather than the wrapper.
          if (newStyle.annotationType === "arrow") return;

          if (newStyle.annotationType === "area") {
            const areaElement = newAnnotation._el.querySelector(".area-annotation");
            if (areaElement && newAnnotation._tooltip) {
              deps.addAreaAnnotationHoverEvents(
                areaElement,
                newAnnotation._tooltip,
                newAnnotation,
              );
            }
          } else if (newAnnotation._tooltip) {
            deps.addPointAnnotationHoverEvents(
              newAnnotation._el,
              newAnnotation._tooltip,
              newAnnotation,
            );
          }
        }, 50);

        setTimeout(() => {
          deps.setEditModeEnabled(true);
          const editModeCheckbox = document.getElementById("edit-mode-checkbox");
          if (editModeCheckbox) {
            editModeCheckbox.checked = true;
          }
          deps.updateUserAnnotationDragState();
          deps.updateEditModeButtonVisibility();
        }, 150);
      });
    }

    function hasRoomForAnotherAnnotation() {
      const maxAnnotations = deps.getMaxUserAnnotations();
      if (deps.getUserAnnotations().length < maxAnnotations) return true;

      alert(`Maximum ${maxAnnotations} user annotations allowed.`);
      cleanupPlacementMode();
      return false;
    }

    function startArrowPlacement(style) {
      const wrapper = deps.getWrapper();
      const previewLine = createArrowPreview(style);
      wrapper.style.cursor = "crosshair";

      placementMouseMoveHandler = (e) => {
        if (!arrowTailPoint || !arrowPreview) return;

        const wrapperRect = wrapper.getBoundingClientRect();
        previewLine.setAttribute("x2", `${e.clientX - wrapperRect.left}`);
        previewLine.setAttribute("y2", `${e.clientY - wrapperRect.top}`);
      };

      placementClickHandler = (e) => {
        if (!isInPlacementMode || !currentPlacementData) return;

        const point = getImageRelativePoint(e.clientX, e.clientY);
        if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
          cleanupPlacementMode();
          return;
        }

        const wrapperRect = wrapper.getBoundingClientRect();
        const localX = e.clientX - wrapperRect.left;
        const localY = e.clientY - wrapperRect.top;

        if (!arrowTailPoint) {
          arrowTailPoint = point;
          previewLine.setAttribute("x1", `${localX}`);
          previewLine.setAttribute("y1", `${localY}`);
          previewLine.setAttribute("x2", `${localX}`);
          previewLine.setAttribute("y2", `${localY}`);
          return;
        }

        const dx = localX - Number.parseFloat(previewLine.getAttribute("x1"));
        const dy = localY - Number.parseFloat(previewLine.getAttribute("y1"));
        if (Math.hypot(dx, dy) < MIN_ARROW_LENGTH_PX) return;

        if (!hasRoomForAnotherAnnotation()) return;

        commitAnnotation({
          x: arrowTailPoint.x,
          y: arrowTailPoint.y,
          x2: point.x,
          y2: point.y,
          title: currentPlacementData.title,
          description: currentPlacementData.description,
          type: currentPlacementData.type,
        });
      };

      wrapper.addEventListener("mousemove", placementMouseMoveHandler);
      wrapper.addEventListener("click", placementClickHandler);
    }

    function isPlacementModeActive() {
      return isInPlacementMode;
    }

    return {
      cleanupPlacementMode,
      startAddAnnotationModeWithData,
      isPlacementModeActive,
    };
  };
