window.createUserAnnotationFormsService = function createUserAnnotationFormsService(
  deps,
) {
  function updateInlineFormValidation() {
    const title = document.getElementById("inline-title").value.trim();
    const type = deps.getSelectedType();
    const placeBtn = document.getElementById("place-annotation-btn");

    // Title is optional - an arrow pointing at something often needs no words.
    let isValid = Boolean(type) && Boolean(deps.getCurrentMode());

    const rectangleBtn = document.getElementById("shape-rectangle");
    const circleBtn = document.getElementById("shape-circle");
    const hasShapeSelected =
      (rectangleBtn && rectangleBtn.classList.contains("active")) ||
      (circleBtn && circleBtn.classList.contains("active"));
    isValid = isValid && hasShapeSelected;

    placeBtn.disabled = !isValid;
  }

  function updateInlineDescriptionPreview() {
    const descInput = document.getElementById("inline-description");
    const preview = document.getElementById("inline-description-preview");

    const processedText = deps.processUserDescription(descInput.value);
    preview.innerHTML = processedText || "<em>No description</em>";
  }

  function updateEditDescriptionPreview() {
    const descInput = document.getElementById("edit-description");
    const preview = document.getElementById("edit-description-preview");

    const processedText = deps.processUserDescription(descInput.value);
    preview.innerHTML = processedText || "<em>No description</em>";
  }

  function initializeInlineForm() {
    const titleInput = document.getElementById("inline-title");
    const descInput = document.getElementById("inline-description");
    const titleCount = document.getElementById("inline-title-count");
    const descCount = document.getElementById("inline-desc-count");

    titleInput.addEventListener("input", () => {
      titleCount.textContent = titleInput.value.length;
      updateInlineFormValidation();
    });

    descInput.addEventListener("input", () => {
      descCount.textContent = descInput.value.length;
      updateInlineDescriptionPreview();
    });

    updateInlineDescriptionPreview();
  }

  function initializeEditForm() {
    const form = document.getElementById("edit-annotation-form");
    const titleInput = document.getElementById("edit-title");
    const descInput = document.getElementById("edit-description");
    const titleCount = document.getElementById("edit-title-count");
    const descCount = document.getElementById("edit-desc-count");
    const cancelBtn = document.getElementById("cancel-edit");

    titleInput.addEventListener("input", () => {
      titleCount.textContent = titleInput.value.length;
    });

    descInput.addEventListener("input", () => {
      descCount.textContent = descInput.value.length;
      updateEditDescriptionPreview();
    });

    form.addEventListener("submit", (e) => {
      if (e.cancelable) e.preventDefault();

      const title = titleInput.value.trim();
      const description = descInput.value;
      const type = document.getElementById("edit-type").value;
      const editIndex = Number.parseInt(form.dataset.editIndex, 10);

      if (!type || Number.isNaN(editIndex)) return;

      const userAnnotations = deps.getUserAnnotations();
      userAnnotations[editIndex] = {
        ...userAnnotations[editIndex],
        title: title.substring(0, 50),
        description: description.substring(0, 500),
        type,
      };

      deps.encodeUserAnnotationsToURL();
      deps.renderAllMarkers();
      deps.updateUserAnnotationsList();

      document.getElementById("edit-annotation-modal").style.display = "none";
    });

    cancelBtn.addEventListener("click", () => {
      document.getElementById("edit-annotation-modal").style.display = "none";
    });
  }

  function clearInlineForm() {
    document.getElementById("inline-title").value = "";
    document.getElementById("inline-description").value = "";

    deps.setSelectedType("info");
    const typeSelector = document.getElementById("type-selector");
    if (typeSelector) {
      const infoBtn = typeSelector.querySelector('[data-type="info"]');
      if (infoBtn) {
        typeSelector
          .querySelectorAll(".type-btn")
          .forEach((btn) => btn.classList.remove("active"));
        infoBtn.classList.add("active");
      }
    }

    document.getElementById("inline-title-count").textContent = "0";
    document.getElementById("inline-desc-count").textContent = "0";
    updateInlineDescriptionPreview();
    updateInlineFormValidation();
  }

  return {
    updateInlineFormValidation,
    initializeInlineForm,
    updateInlineDescriptionPreview,
    initializeEditForm,
    updateEditDescriptionPreview,
    clearInlineForm,
  };
};
