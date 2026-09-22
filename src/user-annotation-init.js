window.createUserAnnotationInitService = function createUserAnnotationInitService(
  deps,
) {
  const MODE_TYPE_PREFIX = { point: "user-", area: "area-", arrow: "arrow-" };

  function getTypePrefixForMode(mode) {
    return MODE_TYPE_PREFIX[mode] || MODE_TYPE_PREFIX.point;
  }

  // Shape only means something for a box or a marker; an arrow has no shape.
  function updateShapeSelectorVisibility() {
    const shapeGroup = document.querySelector(".shape-selector-group");
    if (shapeGroup) {
      shapeGroup.hidden = deps.getCurrentMode() === "arrow";
    }
  }

  function updateUserAnnotationTypeOptions(typeSelector) {
    typeSelector.innerHTML = "";
    updateShapeSelectorVisibility();

    const cfg = deps.getConfig();
    if (cfg && cfg.userAnnotationTypes) {
      const uniqueTypes = new Set();
      Object.keys(cfg.userAnnotationTypes).forEach((type) => {
        const baseType = type.replace(/^(user-|area-|arrow-)/, "");
        uniqueTypes.add(baseType);
      });

      uniqueTypes.forEach((baseType) => {
        const prefix = getTypePrefixForMode(deps.getCurrentMode());
        const fullTypeKey = prefix + baseType;
        const style = cfg.userAnnotationTypes[fullTypeKey];
        if (!style) return;

        const typeBtn = document.createElement("button");
        typeBtn.type = "button";
        typeBtn.className = `type-btn ${baseType === deps.getSelectedType() ? "active" : ""}`;
        typeBtn.title = style.label;
        typeBtn.dataset.type = baseType;

        const circleBtn = document.getElementById("shape-circle");
        const isCircleShape = circleBtn && circleBtn.classList.contains("active");

        if (deps.getCurrentMode() === "arrow") {
          typeBtn.classList.add("type-btn-arrow");
          typeBtn.appendChild(deps.createArrowSwatch(style));
        } else if (deps.getCurrentMode() === "area") {
          typeBtn.style.background = "transparent";
          typeBtn.style.borderColor = style.border;
          typeBtn.style.borderWidth = style.borderWidth || "3px";
          typeBtn.style.borderStyle = style.borderStyle || "solid";
        } else {
          typeBtn.style.background = style.bg;
          typeBtn.style.borderColor = style.border;
          typeBtn.style.borderWidth = style.borderWidth || "2px";
          typeBtn.style.borderStyle = style.borderStyle || "solid";
        }

        typeBtn.style.borderRadius = isCircleShape ? "50%" : "6px";

        typeBtn.addEventListener("click", () => {
          typeSelector.querySelectorAll(".type-btn").forEach((btn) => {
            btn.classList.remove("active");
          });
          typeBtn.classList.add("active");
          deps.setSelectedType(baseType);
          deps.updateInlineFormValidation();
        });

        typeSelector.appendChild(typeBtn);
      });

      if (!deps.getSelectedType()) {
        deps.setSelectedType("info");
      }

      typeSelector.querySelectorAll(".type-btn").forEach((btn) => {
        btn.classList.remove("active");
      });

      const currentBtn = typeSelector.querySelector(
        `[data-type="${deps.getSelectedType()}"]`,
      );
      if (currentBtn) {
        currentBtn.classList.add("active");
      }
    }

    deps.updateInlineFormValidation();
  }

  const ANNOTATION_KIND_LABEL = { point: "Point", area: "Area", arrow: "Arrow" };

  // The same colour name exists for a point, an area and an arrow, so a list of
  // bare labels held three identical "Red Solid" entries. Group by kind.
  function populateEditTypeOptions(editTypeSelect) {
    const cfg = deps.getConfig();
    if (!cfg || !cfg.userAnnotationTypes) return;

    const groups = new Map();
    Object.entries(cfg.userAnnotationTypes).forEach(([type, style]) => {
      const kind = style.annotationType || "point";
      if (!groups.has(kind)) groups.set(kind, []);
      groups.get(kind).push([type, style]);
    });

    ["point", "area", "arrow"].forEach((kind) => {
      const entries = groups.get(kind);
      if (!entries || entries.length === 0) return;

      const kindLabel = ANNOTATION_KIND_LABEL[kind] || kind;
      const group = document.createElement("optgroup");
      group.label = kindLabel;
      entries.forEach(([type, style]) => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = `${kindLabel} · ${style.label}`;
        group.appendChild(option);
      });
      editTypeSelect.appendChild(group);
    });
  }

  function bindModeAndShapeSelectors(typeSelector) {
    const modeButtons = [
      ["point", document.getElementById("mode-point")],
      ["area", document.getElementById("mode-area")],
      ["arrow", document.getElementById("mode-arrow")],
    ].filter(([, button]) => Boolean(button));
    const rectangleBtn = document.getElementById("shape-rectangle");
    const circleBtn = document.getElementById("shape-circle");

    modeButtons.forEach(([mode, button]) => {
      button.addEventListener("click", () => {
        deps.setCurrentMode(mode);
        modeButtons.forEach(([, other]) => other.classList.toggle("active", other === button));
        updateUserAnnotationTypeOptions(typeSelector);
        deps.updateInlineFormValidation();
      });
    });

    if (rectangleBtn && circleBtn) {
      rectangleBtn.addEventListener("click", () => {
        rectangleBtn.classList.add("active");
        circleBtn.classList.remove("active");
        updateUserAnnotationTypeOptions(typeSelector);
        deps.updateInlineFormValidation();
      });

      circleBtn.addEventListener("click", () => {
        circleBtn.classList.add("active");
        rectangleBtn.classList.remove("active");
        updateUserAnnotationTypeOptions(typeSelector);
        deps.updateInlineFormValidation();
      });
    }
  }

  function bindUserModalOpenClose({
    toggleBtn,
    modal,
    editModal,
    closeBtn,
    closeEditBtn,
    typeSelector,
  }) {
    toggleBtn.addEventListener("click", () => {
      const isVisible = modal.style.display !== "none";
      modal.style.display = isVisible ? "none" : "block";
      if (!isVisible) {
        deps.clearInlineForm();

        deps.setCurrentMode("area");
        document.querySelectorAll(".mode-selector .mode-btn").forEach((btn) => {
          btn.classList.toggle("active", btn.id === "mode-area");
        });

        const rectangleBtn = document.getElementById("shape-rectangle");
        const circleBtn = document.getElementById("shape-circle");
        if (rectangleBtn && circleBtn) {
          rectangleBtn.classList.add("active");
          circleBtn.classList.remove("active");
        }

        updateUserAnnotationTypeOptions(typeSelector);
        deps.updateUserAnnotationsList();
        deps.updateInlineFormValidation();
      }
    });

    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
      deps.cleanupPlacementMode();
    });

    closeEditBtn.addEventListener("click", () => {
      editModal.style.display = "none";
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
        deps.cleanupPlacementMode();
      }
    });

    editModal.addEventListener("click", (e) => {
      if (e.target === editModal) {
        editModal.style.display = "none";
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (deps.isPlacementModeActive()) deps.cleanupPlacementMode();
      if (modal.style.display !== "none") modal.style.display = "none";
      if (editModal.style.display !== "none") editModal.style.display = "none";
    });
  }

  function bindEditModeActions({ editModeCheckbox, exitEditModeBtn }) {
    editModeCheckbox.addEventListener("change", () => {
      deps.setEditModeEnabled(editModeCheckbox.checked);
      deps.updateUserAnnotationDragState();
      deps.updateEditModeButtonVisibility();
    });

    exitEditModeBtn.addEventListener("click", () => {
      deps.setEditModeEnabled(false);
      editModeCheckbox.checked = false;
      deps.updateUserAnnotationDragState();
      deps.updateEditModeButtonVisibility();
    });
  }

  function bindUserAnnotationActions({ placeBtn, modal }) {
    placeBtn.addEventListener("click", () => {
      const title = document.getElementById("inline-title").value.trim();
      const type = deps.getSelectedType();
      const description = document.getElementById("inline-description").value;
      const mode = deps.getCurrentMode();

      if (!type || !mode) return;

      let shape = "rectangle";
      const circleBtn = document.getElementById("shape-circle");
      if (circleBtn && circleBtn.classList.contains("active")) {
        shape = "circle";
      }

      const fullType = getTypePrefixForMode(mode) + type;

      const annotationData = {
        title: title.substring(0, 50),
        type: fullType,
        description: description.substring(0, 500),
        shape,
      };

      deps.startAddAnnotationModeWithData(annotationData);
      modal.style.display = "none";
    });
  }

  function bindShareAndClearActions({ shareBtn, clearAllBtn }) {
    shareBtn.addEventListener("click", () => {
      try {
        navigator.clipboard.writeText(window.location.href);
        shareBtn.textContent = "✓ Copied!";
        setTimeout(() => {
          shareBtn.textContent = "📋 Copy Share URL";
        }, 2000);
      } catch (error) {
        console.error("Failed to copy URL:", error);
        shareBtn.textContent = "Failed to copy";
        setTimeout(() => {
          shareBtn.textContent = "📋 Copy Share URL";
        }, 2000);
      }
    });

    clearAllBtn.addEventListener("click", () => {
      if (!confirm("Are you sure you want to remove all user annotations?")) return;
      deps.setUserAnnotations([]);
      deps.encodeUserAnnotationsToURL();
      deps.renderAllMarkers();
      deps.updateUserAnnotationsList();
    });
  }

  function initializeUserAnnotations() {
    const toggleBtn = document.getElementById("toggle-user-annotations");
    const modal = document.getElementById("user-annotations-modal");
    const editModal = document.getElementById("edit-annotation-modal");
    const closeBtn = document.getElementById("close-user-modal");
    const closeEditBtn = document.getElementById("close-edit-modal");
    const typeSelector = document.getElementById("type-selector");
    const editTypeSelect = document.getElementById("edit-type");
    const placeBtn = document.getElementById("place-annotation-btn");
    const shareBtn = document.getElementById("share-url-btn");
    const clearAllBtn = document.getElementById("clear-all-annotations");
    const editModeCheckbox = document.getElementById("edit-mode-checkbox");
    const exitEditModeBtn = document.getElementById("exit-edit-mode");

    populateEditTypeOptions(editTypeSelect);
    bindModeAndShapeSelectors(typeSelector);
    bindUserModalOpenClose({
      toggleBtn,
      modal,
      editModal,
      closeBtn,
      closeEditBtn,
      typeSelector,
    });
    bindEditModeActions({ editModeCheckbox, exitEditModeBtn });
    bindUserAnnotationActions({ placeBtn, modal });
    bindShareAndClearActions({ shareBtn, clearAllBtn });

    updateUserAnnotationTypeOptions(typeSelector);
    deps.updateEditModeButtonVisibility();

    deps.initializeInlineForm();
    deps.initializeEditForm();
  }

  function initializeUserAnnotationsUI() {
    initializeUserAnnotations();
    if (deps.getUserAnnotations().length > 0) {
      setTimeout(() => {
        deps.renderAllMarkers();
      }, 100);
    }
  }

  return {
    updateUserAnnotationTypeOptions,
    populateEditTypeOptions,
    bindModeAndShapeSelectors,
    bindUserModalOpenClose,
    bindEditModeActions,
    bindUserAnnotationActions,
    bindShareAndClearActions,
    initializeUserAnnotations,
    initializeUserAnnotationsUI,
  };
};
