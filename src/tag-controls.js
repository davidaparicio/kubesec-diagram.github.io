window.createTagControlsService = function createTagControlsService(deps) {
  const TAG_TREE_LAYOUT = "tree";
  const expandedTagPaths = new Set();
  let tagTreeFilterQuery = "";
  let tagTreeListExpanded = false;

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

  function createTagToggle(tag, label, onToggled) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "tag-filter-btn";
    toggle.title = `Toggle tag: ${tag}`;
    toggle.textContent = label;
    applyTagButtonStyle(tag, toggle);
    updateTagToggleVisual(tag, toggle);
    toggle.addEventListener("click", () => {
      const currentlyVisible = deps.getTagVisibility().get(tag) !== false;
      deps.getTagVisibility().set(tag, !currentlyVisible);
      updateTagToggleVisual(tag, toggle);
      applyTagVisibility(tag);
      if (onToggled) onToggled();
      deps.applyAnnotationFilter();
      deps.updateURLState();
    });
    return toggle;
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

  function showTags(tags) {
    tags.forEach((tag) => {
      deps.getTagVisibility().set(tag, true);
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

  function createTagTreeHeader(groupTitle, onToggle, onReset) {
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
    header.addEventListener("click", onToggle);

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "tag-tree-link";
    reset.textContent = "Reset";
    reset.title = "Show all tags";
    reset.addEventListener("click", onReset);

    headerRow.appendChild(header);
    headerRow.appendChild(reset);
    groupTitle.replaceWith(headerRow);
    return { header, meta, reset };
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
    const listView = {
      panel,
      tags,
      ...createTagTreeHeader(
        groupTitle,
        () => {
          if (tagTreeFilterQuery.trim()) return;
          tagTreeListExpanded = !tagTreeListExpanded;
          refresh();
        },
        () => {
          showTags(tags);
          refresh();
        },
      ),
    };
    const toggleExpanded = (path) => {
      if (tagTreeFilterQuery.trim()) return;
      if (expandedTagPaths.has(path)) {
        expandedTagPaths.delete(path);
      } else {
        expandedTagPaths.add(path);
      }
      refresh();
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
      if (node.isTag) {
        toggle = createTagToggle(node.path, getTreeNodeLabel(node), refresh);
        toggle.classList.add("tag-tree-toggle");
        toggle.addEventListener("click", (event) => event.stopPropagation());
        row.appendChild(toggle);
      } else {
        const label = document.createElement("span");
        label.className = "tag-tree-label";
        label.textContent = getTreeNodeLabel(node);
        row.appendChild(label);
      }

      const meta = document.createElement("span");
      meta.className = "tag-tree-meta";
      const metaHidden = document.createElement("button");
      metaHidden.type = "button";
      metaHidden.className = "tag-tree-link tag-tree-meta-hidden";
      metaHidden.title = `Show all tags under ${node.path}`;
      metaHidden.addEventListener("click", (event) => {
        event.stopPropagation();
        showTags(getDescendantTags(node));
        refresh();
      });
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

      views.set(node.path, { element, row, caret, toggle, metaHidden, childrenWrap });
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
    refresh();
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
      view.metaHidden.textContent = hiddenBelow > 0 ? `${hiddenBelow} hidden \u00B7 show` : "";

      if (view.toggle) {
        updateTagToggleVisual(node.path, view.toggle);
        const hiddenAncestor = getHiddenAncestor(node.path);
        view.toggle.classList.toggle("ancestor-hidden", Boolean(hiddenAncestor));
        view.toggle.title = hiddenAncestor
          ? `Toggle tag: ${node.path} (hidden by parent ${hiddenAncestor})`
          : `Toggle tag: ${node.path}`;
      }
    };

    const listOpen = query.length > 0 || tagTreeListExpanded;
    tree.classList.toggle("is-filtering", query.length > 0);
    listView.header.classList.toggle("is-filtering", query.length > 0);
    listView.header.classList.toggle("is-expanded", listOpen);
    listView.header.setAttribute("aria-expanded", listOpen ? "true" : "false");
    listView.panel.classList.toggle("is-collapsed", !listOpen);
    const hiddenTotal = listView.tags.filter(isTagHidden).length;
    listView.meta.textContent = `${listView.tags.length} tags${hiddenTotal > 0 ? ` \u00B7 ${hiddenTotal} hidden` : ""}`;
    listView.reset.hidden = hiddenTotal === 0;

    roots.forEach((root) => walk(root, listOpen));
    emptyMessage.hidden = !query || roots.some(subtreeMatches);
  }

  function clearTagTreeFilter() {
    tagTreeFilterQuery = "";
  }

  return {
    clearTagTreeFilter,
    applyTagVisibility,
    updateTagToggleVisual,
    applyTagButtonStyle,
    initializeTagControls,
  };
};
