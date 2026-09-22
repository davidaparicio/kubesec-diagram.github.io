window.createUserAnnotationListService = function createUserAnnotationListService(
  deps,
) {
  function showEditAnnotationForm(index) {
    const ann = deps.getUserAnnotations()[index];
    if (!ann) return;

    const editModal = document.getElementById("edit-annotation-modal");
    const form = document.getElementById("edit-annotation-form");
    const titleInput = document.getElementById("edit-title");
    const descInput = document.getElementById("edit-description");
    const typeSelect = document.getElementById("edit-type");
    const titleCount = document.getElementById("edit-title-count");
    const descCount = document.getElementById("edit-desc-count");

    titleInput.value = ann.title;
    descInput.value = ann.description || "";
    typeSelect.value = ann.type;
    titleCount.textContent = ann.title.length;
    descCount.textContent = (ann.description || "").length;

    form.dataset.editIndex = index;

    editModal.style.display = "block";
    titleInput.focus();

    deps.updateEditDescriptionPreview();
  }

  function updateUserAnnotationsList() {
    const container = document.getElementById("user-annotation-items");
    const count = document.getElementById("annotation-count");
    const userAnnotations = deps.getUserAnnotations();

    count.textContent = userAnnotations.length;
    container.innerHTML = "";

    if (userAnnotations.length === 0) {
      container.innerHTML = "<p><em>No user annotations yet.</em></p>";
      return;
    }

    userAnnotations.forEach((ann, index) => {
      const item = document.createElement("div");
      item.className = "user-annotation-item";

      const style = deps.getUserAnnotationStyle(ann.type) || {};
      const isArrow = style.annotationType === "arrow";
      // An arrow has no fill and no shape, so a colour swatch says nothing
      // about it. Draw the arrow itself, exactly as the type picker does.
      const indicatorHtml = isArrow
        ? '<div class="type-indicator type-indicator-arrow"></div>'
        : `<div class="type-indicator" style="background: ${style.bg}; border-color: ${style.border}; border-radius: ${ann.shape === "circle" ? "50%" : "4px"};"></div>`;
      const title = `${ann.title || ""}`.trim();
      const titleHtml = title
        ? deps.escapeHTML(title)
        : '<em class="annotation-title-empty">Untitled</em>';

      item.innerHTML = `
            <div class="annotation-item-row">
                ${indicatorHtml}
                <div class="annotation-info">
                    <span class="annotation-title">${titleHtml}</span>
                </div>
                <div class="annotation-actions">
                    <button class="action-btn edit-btn desktop-only" data-action="edit" title="Edit">✏️</button>
                    <button class="action-btn delete-btn" data-action="delete" title="Delete">🗑️</button>
                </div>
            </div>
        `;

      const editBtn = item.querySelector('[data-action="edit"]');
      if (editBtn) {
        editBtn.addEventListener("click", () => {
          showEditAnnotationForm(index);
        });
      }

      if (isArrow) {
        const indicator = item.querySelector(".type-indicator-arrow");
        if (indicator) indicator.appendChild(deps.createArrowSwatch(style));
      }

      const deleteBtn = item.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        deleteBtn.addEventListener("click", () => {
          deleteUserAnnotation(index);
        });
      }

      container.appendChild(item);
    });
  }

  function deleteUserAnnotation(index) {
    if (!confirm("Delete this annotation?")) return;

    const userAnnotations = deps.getUserAnnotations();
    userAnnotations.splice(index, 1);
    deps.encodeUserAnnotationsToURL();
    deps.renderAllMarkers();
    updateUserAnnotationsList();
  }

  return {
    showEditAnnotationForm,
    updateUserAnnotationsList,
    deleteUserAnnotation,
  };
};
