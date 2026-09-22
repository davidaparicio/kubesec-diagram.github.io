window.createTagControlsService = function createTagControlsService(deps) {
  const TAG_TREE_LAYOUT = "tree";
  // Height budget for the default expansion. A row is one tag line; the
  // reserve is the space the result list must keep below the tree.
  const TAG_TREE_ROW_HEIGHT_PX = 30;
  const TAG_TREE_RESULTS_RESERVE_RATIO = 0.4;
  const TAG_TREE_RESULTS_RESERVE_MAX_PX = 200;
  const TAG_TREE_RESIZE_DEBOUNCE_MS = 150;
  const TAG_TOOLTIP_MIN_WIDTH_PX = 1000;
  const TAG_TOOLTIP_GAP_PX = 10;

  const expandedTagPaths = new Set();
  let tagTreeFilterQuery = "";
  // Collapsed unless a link says otherwise. Read lazily: the service is
  // constructed before the deps object is fully populated at startup.
  let tagTreeListExpanded = null;

  function setTagTreeListExpanded(expanded) {
    tagTreeListExpanded = Boolean(expanded);
  }

  function isTagTreeListExpanded() {
    if (tagTreeListExpanded === null) {
      tagTreeListExpanded =
        typeof deps.getInitialTagTreeExpanded === "function"
          ? Boolean(deps.getInitialTagTreeExpanded())
          : false;
    }
    return tagTreeListExpanded;
  }
  // Once the reader expands or collapses a node themselves, the height rule
  // stops overruling them for the rest of the session.
  let tagTreeManualOverride = false;
  let applyTagTreeHeightDefault = null;
  let currentTagTreeRefresh = null;
  let resizeListenerBound = false;
  let resizeTimeout = null;

  function getLevelLabel(level, maxLevel) {
    const normalizedLevel = Math.max(0, Number.parseInt(level, 10) || 0);
    const normalizedMax = Math.max(0, Number.parseInt(maxLevel, 10) || 0);
    return normalizedLevel >= normalizedMax ? "max" : `${normalizedLevel}`;
  }

  function applyTagVisibility(tag) {
    const elements = deps.getDiagramTagElements().get(tag);
    if (!elements) return;

    elements.forEach((el) => {
      deps.updateSvgElementVisibility(el);
    });
  }

  function updateTagToggleVisual(tag, toggleEl) {
    const visible = deps.getTagVisibility().get(tag) !== false;
    toggleEl.classList.toggle("active", visible);
  }

  function applyTagButtonStyle(tag, buttonEl) {
    const tagMeta = deps.getTagMeta(tag);
    if (!tagMeta.style) return;

    if (tagMeta.style.background) {
      buttonEl.style.background = tagMeta.style.background;
    }
    if (tagMeta.style.color) {
      buttonEl.style.color = tagMeta.style.color;
    }
    if (tagMeta.style.borderColor) {
      buttonEl.style.borderColor = tagMeta.style.borderColor;
    }
    if (tagMeta.style.borderWidth) {
      buttonEl.style.borderWidth = tagMeta.style.borderWidth;
    }
    if (tagMeta.style.borderStyle) {
      buttonEl.style.borderStyle = tagMeta.style.borderStyle;
    }
    if (tagMeta.style.fontWeight) {
      buttonEl.style.fontWeight = tagMeta.style.fontWeight;
    }
  }

  function initializeTagControls() {
    if (!deps.filterTagControls) return;

    deps.filterTagControls.innerHTML = "";
    // The rows are gone, so their lazily created tooltips are orphans.
    document
      .querySelectorAll(".tag-description-tooltip")
      .forEach((el) => el.remove());
    const nextDiagramTagElements = new Map();
    deps.setDiagramTagElements(nextDiagramTagElements);

    const taggedElements = deps.image.querySelectorAll("[data-tags]");
    let maxDiscoveredLevel = 0;
    taggedElements.forEach((el) => {
      const tags = deps.parseTags(el.getAttribute("data-tags"));
      if (typeof deps.applyCssTagClassesToElement === "function") {
        deps.applyCssTagClassesToElement(el, tags);
      }
      maxDiscoveredLevel = Math.max(maxDiscoveredLevel, deps.getTagLevel(tags));
      tags.forEach((tag) => {
        if (deps.isLevelTag(tag) || (typeof deps.isCssTag === "function" && deps.isCssTag(tag))) {
          return;
        }
        if (!nextDiagramTagElements.has(tag)) {
          nextDiagramTagElements.set(tag, []);
        }
        nextDiagramTagElements.get(tag).push(el);
      });
    });

    const hasInitialSelectedLevel =
      typeof deps.getHasInitialSelectedLevel === "function"
        ? deps.getHasInitialSelectedLevel()
        : false;

    if (typeof deps.setMaxDiagramLevel === "function") {
      deps.setMaxDiagramLevel(maxDiscoveredLevel);
    }
    if (typeof deps.getSelectedLevel === "function" && typeof deps.setSelectedLevel === "function") {
      const selectedLevel = deps.getSelectedLevel();
      const parsedSelectedLevel = Number.parseInt(selectedLevel, 10);
      const fallbackLevel = maxDiscoveredLevel;
      const initialLevel = Number.isFinite(parsedSelectedLevel) ? parsedSelectedLevel : fallbackLevel;
      const clampedLevel = Math.max(0, Math.min(maxDiscoveredLevel, initialLevel));
      if (!hasInitialSelectedLevel && maxDiscoveredLevel > 0) {
        deps.setSelectedLevel(maxDiscoveredLevel);
      } else if (clampedLevel !== selectedLevel) {
        deps.setSelectedLevel(clampedLevel);
      }
    }

    if (maxDiscoveredLevel > 0) {
      const levelWrap = document.createElement("div");
      levelWrap.className = "level-filter-control";

      const levelHeader = document.createElement("div");
      levelHeader.className = "level-filter-header";

      const levelTitle = document.createElement("div");
      levelTitle.className = "tag-group-title";
      levelTitle.textContent = "Level";

      const levelValue = document.createElement("strong");
      levelValue.className = "level-filter-value";

      const levelInput = document.createElement("input");
      levelInput.type = "range";
      levelInput.className = "level-filter-slider";
      levelInput.min = "0";
      levelInput.max = `${maxDiscoveredLevel}`;
      levelInput.step = "1";

      const selectedLevelRaw =
        typeof deps.getSelectedLevel === "function" ? deps.getSelectedLevel() : maxDiscoveredLevel;
      const selectedLevel = Number.parseInt(selectedLevelRaw, 10);
      const clampedSelectedLevel = Math.max(
        0,
        Math.min(maxDiscoveredLevel, Number.isFinite(selectedLevel) ? selectedLevel : maxDiscoveredLevel),
      );
      levelInput.value = `${clampedSelectedLevel}`;
      levelValue.textContent = `Level ${getLevelLabel(clampedSelectedLevel, maxDiscoveredLevel)}`;

      const handleLevelChange = () => {
        const nextLevel = Math.max(
          0,
          Math.min(maxDiscoveredLevel, Number.parseInt(levelInput.value, 10) || 0),
        );
        levelValue.textContent = `Level ${getLevelLabel(nextLevel, maxDiscoveredLevel)}`;
        deps.setSelectedLevel(nextLevel);
        deps.applyAnnotationFilter();
        deps.updateURLState();
      };

      levelInput.addEventListener("input", handleLevelChange);
      levelInput.addEventListener("change", handleLevelChange);

      levelHeader.appendChild(levelTitle);
      levelHeader.appendChild(levelValue);
      levelWrap.appendChild(levelHeader);
      levelWrap.appendChild(levelInput);
      deps.filterTagControls.appendChild(levelWrap);
    }

    const discoveredTags = Array.from(nextDiagramTagElements.keys()).sort((a, b) =>
      a.localeCompare(b),
    );
    if (discoveredTags.length === 0) {
      const message = document.createElement("div");
      message.className = "filter-result-item";
      message.innerHTML =
        maxDiscoveredLevel > 0
          ? "<small>No regular tags found in this diagram.</small>"
          : "<small>No tags found in this diagram.</small>";
      deps.filterTagControls.appendChild(message);
      return;
    }

    const groupsMap = new Map();
    discoveredTags.forEach((tag) => {
      const tagMeta = deps.getTagMeta(tag);
      const groupId = tagMeta.group || "general";
      if (!groupsMap.has(groupId)) {
        groupsMap.set(groupId, []);
      }
      groupsMap.get(groupId).push(tag);
    });

    const orderedGroups = Array.from(groupsMap.keys()).sort((a, b) => {
      const groupA = deps.getTagGroupMeta(a);
      const groupB = deps.getTagGroupMeta(b);
      if ((groupA.order || 0) !== (groupB.order || 0)) {
        return (groupA.order || 0) - (groupB.order || 0);
      }
      return (groupA.label || groupA.id).localeCompare(groupB.label || groupB.id);
    });

    orderedGroups.forEach((groupId) => {
      const groupMeta = deps.getTagGroupMeta(groupId);
      const groupWrap = document.createElement("div");
      groupWrap.className = "tag-group";

      const groupTitle = document.createElement("div");
      groupTitle.className = "tag-group-title";
      groupTitle.textContent = groupMeta.label || groupMeta.id;
      groupWrap.appendChild(groupTitle);

      const orderedTags = groupsMap.get(groupId).sort((a, b) => {
        const metaA = deps.getTagMeta(a);
        const metaB = deps.getTagMeta(b);
        if ((metaA.order || Number.MAX_SAFE_INTEGER) !== (metaB.order || Number.MAX_SAFE_INTEGER)) {
          return (metaA.order || Number.MAX_SAFE_INTEGER) - (metaB.order || Number.MAX_SAFE_INTEGER);
        }
        return (metaA.label || metaA.shortName).localeCompare(metaB.label || metaB.shortName);
      });
      orderedTags.forEach(ensureTagVisibilityInitialized);

      if (groupMeta.layout === TAG_TREE_LAYOUT) {
        renderTagTreeGroup(groupWrap, groupTitle, orderedTags);
      } else {
        renderFlatTagGroup(groupWrap, orderedTags);
      }

      orderedTags.forEach(applyTagVisibility);
      deps.filterTagControls.appendChild(groupWrap);
    });
  }

  function ensureTagVisibilityInitialized(tag) {
    if (deps.getTagVisibility().has(tag)) return;
    const initiallyVisible = deps.getHasInitialHiddenTags()
      ? !deps.getInitialHiddenTags().has(tag)
      : true;
    deps.getTagVisibility().set(tag, initiallyVisible);
  }

  function setTagHidden(tag, hidden) {
    deps.getTagVisibility().set(tag, !hidden);
    applyTagVisibility(tag);
  }

  function commitTagChange(onToggled) {
    // The filter pass re-runs the panel's disabled bookkeeping, so the tree
    // refresh has to come after it or the governed rows are re-enabled.
    deps.applyAnnotationFilter();
    if (onToggled) onToggled();
    deps.updateURLState();
  }

  // Ancestors are materialised on every cell (METADATA.md R3), so an element
  // tagged Access.Cli also carries Access. Hiding a parent therefore hides its
  // whole branch on its own - no need to write the children down anywhere.
  // Showing one is the asymmetric case: a child hidden in its own right stays
  // hidden until it is cleared too.
  function hideTagBranch(tag) {
    setTagHidden(tag, true);
  }

  function showTagBranch(tag, descendantTags) {
    setTagHidden(tag, false);
    descendantTags.forEach((descendant) => setTagHidden(descendant, false));
  }

  // What the row shows: hidden in its own right, or hidden because something
  // above it is. The second kind is not the reader's to change from here.
  function isTagEffectivelyHidden(tag) {
    return isTagHidden(tag) || Boolean(getHiddenAncestor(tag));
  }

  function createTagToggle(tag, label, onToggled, descendantTags = []) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "tag-filter-btn";
    toggle.dataset.managedDisabled = "true";
    toggle.textContent = label;
    applyTagButtonStyle(tag, toggle);
    updateTagToggleVisual(tag, toggle);
    toggle.addEventListener("click", () => {
      // A governed child is not clickable; the parent decides for it.
      if (getHiddenAncestor(tag)) return;

      if (isTagHidden(tag)) {
        showTagBranch(tag, descendantTags);
      } else {
        hideTagBranch(tag);
      }
      updateTagToggleVisual(tag, toggle);
      commitTagChange(onToggled);
    });
    return toggle;
  }

  // The exception to the branch rule: show this tag back without also
  // un-hiding children that were hidden on their own.
  function createSelfOnlyToggle(tag, onToggled) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tag-tree-self-toggle";
    button.dataset.managedDisabled = "true";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (button.disabled || getHiddenAncestor(tag)) return;

      setTagHidden(tag, !isTagHidden(tag));
      commitTagChange(onToggled);
    });
    return button;
  }

  function renderFlatTagGroup(groupWrap, tags) {
    const groupButtons = document.createElement("div");
    groupButtons.className = "tag-group-buttons";
    tags.forEach((tag) => {
      const tagMeta = deps.getTagMeta(tag);
      groupButtons.appendChild(createTagToggle(tag, tagMeta.label || tag));
    });
    groupWrap.appendChild(groupButtons);
  }

  function isTagHidden(tag) {
    return deps.getTagVisibility().get(tag) === false;
  }

  function getHiddenAncestor(tag) {
    let parent = deps.getTagParent(tag);
    while (parent) {
      if (isTagHidden(parent)) return parent;
      parent = deps.getTagParent(parent);
    }
    return null;
  }

  function buildTagTree(tags) {
    const nodes = new Map();
    const ensureNode = (path) => {
      if (nodes.has(path)) return nodes.get(path);
      const node = { path, isTag: false, children: [] };
      nodes.set(path, node);
      const parentPath = deps.getTagParent(path);
      if (parentPath) ensureNode(parentPath).children.push(node);
      return node;
    };
    tags.forEach((tag) => {
      ensureNode(tag).isTag = true;
    });

    const sortNodes = (list) => {
      list.sort((a, b) => a.path.localeCompare(b.path));
      list.forEach((node) => sortNodes(node.children));
      return list;
    };
    return sortNodes(Array.from(nodes.values()).filter((node) => !deps.getTagParent(node.path)));
  }

  function getTreeNodeLabel(node) {
    const tagMeta = deps.getTagMeta(node.path);
    return tagMeta.label && tagMeta.label !== node.path ? tagMeta.label : deps.getTagLeafName(node.path);
  }

  function getTagElementCount(tag) {
    const elements = deps.getDiagramTagElements().get(tag);
    return elements ? elements.length : 0;
  }

  function setTagsVisibility(tags, visible) {
    tags.forEach((tag) => {
      deps.getTagVisibility().set(tag, visible);
      applyTagVisibility(tag);
    });
    deps.applyAnnotationFilter();
    deps.updateURLState();
  }

  function showTags(tags) {
    setTagsVisibility(tags, true);
  }

  function hideTags(tags) {
    setTagsVisibility(tags, false);
  }

  function invertTags(tags) {
    tags.forEach((tag) => {
      deps.getTagVisibility().set(tag, isTagHidden(tag));
      applyTagVisibility(tag);
    });
    deps.applyAnnotationFilter();
    deps.updateURLState();
  }

  function getDescendantTags(node) {
    return node.children.flatMap((child) => [
      ...(child.isTag ? [child.path] : []),
      ...getDescendantTags(child),
    ]);
  }

  function createTagTreeHeader(groupTitle, handlers) {
    const headerRow = document.createElement("div");
    headerRow.className = "tag-tree-header-row";

    const header = document.createElement("button");
    header.type = "button";
    header.className = "tag-tree-header";
    const caret = document.createElement("span");
    caret.className = "tag-tree-caret";
    const meta = document.createElement("span");
    meta.className = "tag-tree-meta";
    header.appendChild(caret);
    header.appendChild(groupTitle.cloneNode(true));
    header.appendChild(meta);
    header.addEventListener("click", handlers.onToggle);

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "tag-tree-link";
    reset.textContent = "Reset";
    reset.title = "Show all tags";
    reset.addEventListener("click", handlers.onReset);

    // Bulk controls act on every tag in the group, expanded or not.
    const bulk = document.createElement("div");
    bulk.className = "tag-tree-bulk";
    const bulkButtons = [
      { label: "Show all", title: "Show all tags", handler: handlers.onShowAll },
      { label: "Hide all", title: "Hide all tags", handler: handlers.onHideAll },
      { label: "Invert", title: "Invert which tags are hidden", handler: handlers.onInvert },
    ].map(({ label, title, handler }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tag-tree-bulk-btn";
      button.dataset.managedDisabled = "true";
      button.textContent = label;
      button.title = title;
      button.addEventListener("click", handler);
      bulk.appendChild(button);
      return button;
    });

    headerRow.appendChild(header);
    headerRow.appendChild(reset);
    groupTitle.replaceWith(headerRow);
    headerRow.after(bulk);
    return { header, meta, reset, bulk, showAllBtn: bulkButtons[0], hideAllBtn: bulkButtons[1] };
  }

  // How many tag rows fit above the result list. The tree is worth expanding
  // only while the results it filters stay in view.
  function countTagTreeRowsThatFit(panel) {
    const body = panel.closest(".filter-panel-body");
    if (!body) return 0;

    const bodyRect = body.getBoundingClientRect();
    if (!(bodyRect.height > 0)) return 0;

    const reserve = Math.min(
      TAG_TREE_RESULTS_RESERVE_MAX_PX,
      bodyRect.height * TAG_TREE_RESULTS_RESERVE_RATIO,
    );
    const panelTop = panel.getBoundingClientRect().top - bodyRect.top;
    const available = bodyRect.height - panelTop - reserve;
    return Math.max(0, Math.floor(available / TAG_TREE_ROW_HEIGHT_PX));
  }

  // Tag descriptions come from METADATA.md via the build step, so the tree row
  // can explain a tag without the taxonomy being duplicated into the diagram.
  function buildTagTooltipHtml(node) {
    const description = deps.getTagDescription(node.path);
    const count = node.isTag ? getTagElementCount(node.path) : 0;
    const countText = `${count} ${count === 1 ? "element" : "elements"}`;
    const descriptionHtml = description
      ? `<br>${deps.escapeHTML(description)}`
      : "";
    return `<b>${deps.escapeHTML(node.path)}</b>${descriptionHtml}<br><small>${countText}</small>`;
  }

  // Wide screens only: on a phone the panel is the whole screen, so there is no
  // "beside the menu" to put this in, and a long-press box would cover the tags
  // it is meant to describe.
  function canShowTagTooltip() {
    return (
      window.innerWidth > TAG_TOOLTIP_MIN_WIDTH_PX &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches
    );
  }

  // The box lives on <body>, not in #tooltip-layer: that layer sits inside the
  // diagram's stacking context, so its z-index could never beat the panel and
  // the description came out underneath the menu.
  function positionTagTooltip(tooltip, row) {
    const rowRect = row.getBoundingClientRect();
    const panelRect = deps.filterTagControls
      .closest(".filter-panel")
      .getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // Clear of the panel's edge, so it never covers another tag row.
    let left = panelRect.left - tooltipRect.width - TAG_TOOLTIP_GAP_PX;
    if (left < TAG_TOOLTIP_GAP_PX) {
      left = TAG_TOOLTIP_GAP_PX;
    }

    const top = Math.max(
      TAG_TOOLTIP_GAP_PX,
      Math.min(
        rowRect.top + rowRect.height / 2 - tooltipRect.height / 2,
        window.innerHeight - tooltipRect.height - TAG_TOOLTIP_GAP_PX,
      ),
    );

    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }

  function bindTagDescriptionTooltip(row, node) {
    let tooltip = null;
    let hideTimeout = null;

    const ensureTooltip = () => {
      if (tooltip) return tooltip;
      tooltip = document.createElement("div");
      tooltip.className = "tooltip-box tag-description-tooltip";
      tooltip.innerHTML = buildTagTooltipHtml(node);
      tooltip.style.display = "none";
      document.body.appendChild(tooltip);
      return tooltip;
    };

    row.addEventListener("mouseenter", () => {
      if (!canShowTagTooltip()) return;
      clearTimeout(hideTimeout);
      const el = ensureTooltip();
      el.style.display = "block";
      positionTagTooltip(el, row);
    });

    row.addEventListener("mouseleave", () => {
      if (!tooltip) return;
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        tooltip.style.display = "none";
      }, deps.getTooltipHideDelay());
    });
  }

  function renderTagTreeGroup(groupWrap, groupTitle, tags) {
    const filterInput = document.createElement("input");
    filterInput.type = "search";
    filterInput.className = "tag-tree-filter";
    filterInput.placeholder = "Filter tags...";
    filterInput.autocomplete = "off";
    filterInput.setAttribute("aria-label", "Filter tags");
    filterInput.value = tagTreeFilterQuery;

    const tree = document.createElement("div");
    tree.className = "tag-tree";

    const emptyMessage = document.createElement("small");
    emptyMessage.className = "tag-tree-empty";
    emptyMessage.textContent = "No tags match the filter.";

    const panel = document.createElement("div");
    panel.className = "tag-tree-panel tag-tree-collapsible";
    const panelInner = document.createElement("div");
    panelInner.className = "tag-tree-collapsible-inner";
    panelInner.appendChild(tree);
    panelInner.appendChild(emptyMessage);
    panel.appendChild(panelInner);

    const views = new Map();
    const roots = buildTagTree(tags);
    const refresh = () => refreshTagTree(tree, roots, views, emptyMessage, listView);
    currentTagTreeRefresh = refresh;
    const listView = {
      panel,
      tags,
      ...createTagTreeHeader(groupTitle, {
        onToggle: () => {
          if (tagTreeFilterQuery.trim()) return;
          setTagTreeListExpanded(!isTagTreeListExpanded());
          refreshTagTreeDefaultState();
          refresh();
          deps.updateURLState();
        },
        onReset: () => {
          showTags(tags);
          refresh();
        },
        onShowAll: () => {
          showTags(tags);
          refresh();
        },
        onHideAll: () => {
          hideTags(tags);
          refresh();
        },
        onInvert: () => {
          invertTags(tags);
          refresh();
        },
      }),
    };
    const toggleExpanded = (path) => {
      if (tagTreeFilterQuery.trim()) return;
      if (expandedTagPaths.has(path)) {
        expandedTagPaths.delete(path);
      } else {
        expandedTagPaths.add(path);
      }
      tagTreeManualOverride = true;
      refresh();
    };

    // The group itself starts closed and its open state comes from the URL.
    // This only decides how much of the tree is pre-expanded once it is open,
    // so opening it never pushes the results off screen.
    applyTagTreeHeightDefault = () => {
      if (tagTreeManualOverride || !isTagTreeListExpanded()) return;

      const rowsThatFit = countTagTreeRowsThatFit(panel);
      expandedTagPaths.clear();
      if (rowsThatFit < roots.length) return;

      let rows = roots.length;
      roots.forEach((root) => {
        const childRows = root.children.length;
        if (childRows === 0 || rows + childRows > rowsThatFit) return;
        expandedTagPaths.add(root.path);
        rows += childRows;
      });
    };

    const createNode = (node, depth) => {
      const hasChildren = node.children.length > 0;
      const element = document.createElement("div");
      element.className = "tag-tree-node";

      const row = document.createElement("div");
      row.className = hasChildren ? "tag-tree-row has-children" : "tag-tree-row";
      row.style.setProperty("--tag-tree-depth", `${depth}`);

      let caret;
      if (hasChildren) {
        caret = document.createElement("button");
        caret.type = "button";
        caret.className = "tag-tree-caret";
        caret.setAttribute("aria-label", `Expand ${node.path}`);
        caret.addEventListener("click", (event) => {
          event.stopPropagation();
          toggleExpanded(node.path);
        });
      } else {
        caret = document.createElement("span");
        caret.className = "tag-tree-caret-spacer";
      }
      row.appendChild(caret);

      let toggle = null;
      let selfToggle = null;
      if (node.isTag) {
        const descendantTags = getDescendantTags(node);
        toggle = createTagToggle(
          node.path,
          getTreeNodeLabel(node),
          refresh,
          descendantTags,
        );
        toggle.classList.add("tag-tree-toggle");
        toggle.addEventListener("click", (event) => event.stopPropagation());
        row.appendChild(toggle);
        if (descendantTags.length > 0) {
          selfToggle = createSelfOnlyToggle(node.path, refresh);
          row.appendChild(selfToggle);
        }
      } else {
        const label = document.createElement("span");
        label.className = "tag-tree-label";
        label.textContent = getTreeNodeLabel(node);
        row.appendChild(label);
      }

      const meta = document.createElement("span");
      meta.className = "tag-tree-meta";
      // Was a "show all under X" button. Clicking a hidden parent now does
      // exactly that, so this is only a count, and parents keep one control.
      const metaHidden = document.createElement("span");
      metaHidden.className = "tag-tree-meta-hidden";
      const metaCount = document.createElement("span");
      const elementCount = node.isTag ? getTagElementCount(node.path) : 0;
      metaCount.textContent = `${elementCount} ${elementCount === 1 ? "element" : "elements"}`;
      meta.appendChild(metaHidden);
      meta.appendChild(metaCount);
      row.appendChild(meta);

      row.addEventListener("click", () => {
        if (hasChildren) {
          toggleExpanded(node.path);
        } else if (toggle && !toggle.disabled) {
          toggle.click();
        }
      });
      bindTagDescriptionTooltip(row, node);
      element.appendChild(row);

      let childrenWrap = null;
      if (hasChildren) {
        childrenWrap = document.createElement("div");
        childrenWrap.className = "tag-tree-children tag-tree-collapsible";
        const childrenInner = document.createElement("div");
        childrenInner.className = "tag-tree-children-inner tag-tree-collapsible-inner";
        node.children.forEach((child) => childrenInner.appendChild(createNode(child, depth + 1)));
        childrenWrap.appendChild(childrenInner);
        element.appendChild(childrenWrap);
      }

      views.set(node.path, { element, row, caret, toggle, selfToggle, metaHidden, childrenWrap });
      return element;
    };
    roots.forEach((root) => tree.appendChild(createNode(root, 0)));

    filterInput.addEventListener("input", () => {
      tagTreeFilterQuery = filterInput.value || "";
      refresh();
    });
    filterInput.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !filterInput.value) return;
      event.stopPropagation();
      filterInput.value = "";
      tagTreeFilterQuery = "";
      refresh();
    });

    groupWrap.appendChild(filterInput);
    groupWrap.appendChild(panel);

    bindTagTreeResizeListener();
    refresh();
  }

  // Re-runs the height rule against the panel as it is now. A no-op once the
  // reader has expanded or collapsed anything themselves.
  function refreshTagTreeDefaultState() {
    if (tagTreeManualOverride) return;
    if (typeof applyTagTreeHeightDefault !== "function") return;

    requestAnimationFrame(() => {
      applyTagTreeHeightDefault();
      if (typeof currentTagTreeRefresh === "function") currentTagTreeRefresh();
    });
  }

  function bindTagTreeResizeListener() {
    if (resizeListenerBound) return;
    resizeListenerBound = true;

    window.addEventListener("resize", () => {
      if (tagTreeManualOverride || typeof applyTagTreeHeightDefault !== "function") return;
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        resizeTimeout = null;
        applyTagTreeHeightDefault();
        if (typeof currentTagTreeRefresh === "function") currentTagTreeRefresh();
      }, TAG_TREE_RESIZE_DEBOUNCE_MS);
    });
  }

  function refreshTagTree(tree, roots, views, emptyMessage, listView) {
    const query = tagTreeFilterQuery.trim().toLowerCase();
    const matchMemo = new Map();
    const subtreeMatches = (node) => {
      if (!query) return true;
      if (!matchMemo.has(node.path)) {
        matchMemo.set(
          node.path,
          node.path.toLowerCase().includes(query) || node.children.some(subtreeMatches),
        );
      }
      return matchMemo.get(node.path);
    };
    const countHiddenDescendants = (node) =>
      node.children.reduce(
        (sum, child) => sum + (child.isTag && isTagHidden(child.path) ? 1 : 0) + countHiddenDescendants(child),
        0,
      );

    let visibleRowIndex = 0;
    const walk = (node, parentShown) => {
      const view = views.get(node.path);
      const matches = subtreeMatches(node);
      const shown = parentShown && matches;
      view.element.hidden = !matches;
      if (shown) {
        view.row.classList.toggle("is-striped", visibleRowIndex % 2 === 1);
        visibleRowIndex += 1;
      }

      let expanded = false;
      if (view.childrenWrap) {
        expanded = query ? node.children.some(subtreeMatches) : expandedTagPaths.has(node.path);
        view.element.classList.toggle("is-expanded", expanded);
        view.childrenWrap.classList.toggle("is-collapsed", !expanded);
        view.caret.setAttribute("aria-expanded", expanded ? "true" : "false");
        node.children.forEach((child) => walk(child, shown && expanded));
      }

      const hiddenBelow = view.childrenWrap && !expanded ? countHiddenDescendants(node) : 0;
      view.metaHidden.textContent = hiddenBelow > 0 ? `${hiddenBelow} hidden` : "";

      if (view.toggle) {
        const hiddenAncestor = getHiddenAncestor(node.path);
        const governed = Boolean(hiddenAncestor) || panelDisabled;
        // Governed rows show the state they are actually in - hidden - but
        // cannot be clicked, so a click can no longer rewrite the URL under a
        // control that looks disabled.
        view.toggle.classList.toggle("active", !isTagEffectivelyHidden(node.path));
        view.toggle.classList.toggle("ancestor-hidden", governed);
        view.toggle.disabled = governed;
        view.toggle.title = hiddenAncestor
          ? `Hidden by ${hiddenAncestor}. Show ${hiddenAncestor} to change this.`
          : isTagHidden(node.path)
            ? `Show ${node.path} and everything under it`
            : `Hide ${node.path} and everything under it`;

        if (view.selfToggle) {
          view.selfToggle.disabled = governed;
          view.selfToggle.classList.toggle("is-hidden-tag", isTagHidden(node.path));
          view.selfToggle.title = hiddenAncestor
            ? `Hidden by ${hiddenAncestor}. Show ${hiddenAncestor} to change this.`
            : isTagHidden(node.path)
              ? `Show ${node.path} only, leaving hidden children hidden`
              : `Hide ${node.path} only`;
          view.selfToggle.setAttribute("aria-label", view.selfToggle.title);
        }
      }
    };

    // While only-pinned mode is on the whole panel is disabled from outside.
    const panelDisabled = Boolean(
      deps.filterTagControls.closest(".filter-only-pinned-mode"),
    );
    const listOpen = query.length > 0 || isTagTreeListExpanded();
    tree.classList.toggle("is-filtering", query.length > 0);
    listView.header.classList.toggle("is-filtering", query.length > 0);
    listView.header.classList.toggle("is-expanded", listOpen);
    listView.header.setAttribute("aria-expanded", listOpen ? "true" : "false");
    listView.panel.classList.toggle("is-collapsed", !listOpen);
    const hiddenTotal = listView.tags.filter(isTagHidden).length;
    listView.meta.textContent = `${listView.tags.length} tags${hiddenTotal > 0 ? ` \u00B7 ${hiddenTotal} hidden` : ""}`;
    listView.reset.hidden = hiddenTotal === 0;
    listView.bulk.hidden = !listOpen;
    listView.showAllBtn.disabled = panelDisabled || hiddenTotal === 0;
    listView.hideAllBtn.disabled = panelDisabled || hiddenTotal === listView.tags.length;

    roots.forEach((root) => walk(root, listOpen));
    emptyMessage.hidden = !query || roots.some(subtreeMatches);
  }

  function clearTagTreeFilter() {
    tagTreeFilterQuery = "";
  }

  return {
    clearTagTreeFilter,
    refreshTagTreeDefaultState,
    setTagTreeListExpanded,
    isTagTreeListExpanded,
    applyTagVisibility,
    updateTagToggleVisual,
    applyTagButtonStyle,
    initializeTagControls,
  };
};
