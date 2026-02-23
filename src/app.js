if (typeof config === "undefined") {
  console.error("Required data not loaded: config must be defined");
  throw new Error("Missing required configuration data");
}

const urlParams = new URLSearchParams(window.location.search);
const debug = urlParams.has("debug");

const image = document.getElementById("main-image");
const wrapper = document.getElementById("image-wrapper");
const tooltipLayer = document.getElementById("tooltip-layer");
const container = document.getElementById("container");
const filterPanel = document.getElementById("filter-panel");
const filterPanelBackdrop = document.getElementById("filter-panel-backdrop");
const filterResults = document.getElementById("filter-results");
const filterResultCount = document.getElementById("filter-result-count");
const filterSearchInput = document.getElementById("filter-search-input");
const filterTagControls = document.getElementById("filter-tag-controls");
const openFilterPanelBtn = document.getElementById("floating-filter-toggle");
const themeToggleBtn = document.getElementById("floating-theme-toggle");
const closeFilterPanelBtn = document.getElementById("close-filter-panel");
const resetFilterBtn = document.getElementById("filter-reset-btn");

if (
  !image ||
  !wrapper ||
  !tooltipLayer ||
  !container ||
  !filterPanel ||
  !filterPanelBackdrop ||
  !filterResults ||
  !filterResultCount ||
  !filterSearchInput ||
  !filterTagControls ||
  !openFilterPanelBtn ||
  !themeToggleBtn ||
  !closeFilterPanelBtn ||
  !resetFilterBtn
) {
  console.error("Required DOM elements not found");
  throw new Error("Missing required DOM elements");
}

let cachedBounds = null;

// Zoom and pan variables
let currentZoom = 1;
let maxZoom = 4;
let minZoom = 1;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let imageTranslateX = 0;
let imageTranslateY = 0;
let isTouchActive = false;

// User annotations variables
let userAnnotations = [];
let editModeEnabled = false;

// UI state
let currentMode = "area"; // Default annotation mode
let selectedType = "info"; // Default selected type
let diagramSourcePath = "";
let diagramAspectRatio = null;
let diagramTagElements = new Map();
let svgHelpRecords = [];
let svgHelpRecordByElement = new Map();
let annotationSearchQuery = "";
let filterPanelOpen = false;
let filterPanelOverlayMode = true;
let pinnedHelpSlugs = new Set();
let onlyShowPinned = false;
const tagVisibility = new Map();
const MENU_VISIBLE_PARAM = "menu";
const FILTER_HIDE_TAGS_PARAM = "filter-hide-tags";
const FILTER_QUERY_PARAM = "filter-query";
const FILTER_PINS_PARAM = "pins";
const FILTER_CONSTRAINT_PARAM = "constraint";
const THEME_STORAGE_KEY = "kubesec-theme";
const FILTER_DOCK_MIN_IMAGE_WIDTH = 1100;
const FILTER_SEARCH_PLACEHOLDER_DEFAULT = "Search annotations...";

function normalizePinnedHelpSlugs() {
  const availableSlugs = new Set(
    svgHelpRecords
      .map((record) => `${(record && record.slug) || ""}`.trim())
      .filter(Boolean),
  );

  const nextPinned = new Set();
  pinnedHelpSlugs.forEach((slugValue) => {
    const slug = `${slugValue || ""}`.trim();
    if (!slug) return;
    if (!availableSlugs.has(slug)) return;
    nextPinned.add(slug);
  });

  let changed = pinnedHelpSlugs.size !== nextPinned.size;
  if (!changed) {
    pinnedHelpSlugs.forEach((slug) => {
      if (!nextPinned.has(slug)) {
        changed = true;
      }
    });
  }

  if (changed) {
    pinnedHelpSlugs = nextPinned;
    onPinnedStateChanged();
  }
}

function onPinnedStateChanged() {
  onFilterConstraintStateChanged();
}

function onFilterConstraintStateChanged() {
  if (svgHelpService && typeof svgHelpService.refreshPinnedStates === "function") {
    svgHelpService.refreshPinnedStates();
  }
  urlStateService.updateURLState();
}

function isRectValid(rect) {
  return (
    rect &&
    Number.isFinite(rect.left) &&
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function pulseGoToElement(element) {
  if (!element || typeof element.getBoundingClientRect !== "function") return;

  const rect = element.getBoundingClientRect();
  if (!isRectValid(rect)) return;

  if (element._mobileGoToPulseEl && element._mobileGoToPulseEl.parentNode) {
    element._mobileGoToPulseEl.parentNode.removeChild(element._mobileGoToPulseEl);
    element._mobileGoToPulseEl = null;
  }

  if (element._mobileGoToPulseTimeout) {
    clearTimeout(element._mobileGoToPulseTimeout);
    element._mobileGoToPulseTimeout = null;
  }

  const indicator = document.createElement("div");
  indicator.className = "mobile-go-to-indicator";
  const size = Math.max(22, Math.min(60, Math.max(rect.width, rect.height) * 1.35));
  indicator.style.width = `${Math.round(size)}px`;
  indicator.style.height = `${Math.round(size)}px`;
  indicator.style.left = `${Math.round(rect.left + rect.width / 2)}px`;
  indicator.style.top = `${Math.round(rect.top + rect.height / 2)}px`;
  document.body.appendChild(indicator);
  element._mobileGoToPulseEl = indicator;

  element._mobileGoToPulseTimeout = setTimeout(() => {
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
    if (element._mobileGoToPulseEl === indicator) {
      element._mobileGoToPulseEl = null;
    }
    element._mobileGoToPulseTimeout = null;
  }, 700);
}

function focusHelpRecord(record) {
  if (!record || !record.element || typeof record.element.getBoundingClientRect !== "function") {
    return;
  }

  const targetZoom = Math.min(maxZoom, Math.max(currentZoom, 2));
  currentZoom = targetZoom;
  viewportService.updateImageTransform();

  const wrapperRect = wrapper.getBoundingClientRect();
  const targetRect = record.element.getBoundingClientRect();
  if (!isRectValid(wrapperRect) || !isRectValid(targetRect)) {
    return;
  }

  const viewportCenterX = wrapperRect.left + wrapperRect.width / 2;
  const viewportCenterY = wrapperRect.top + wrapperRect.height / 2;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  imageTranslateX += viewportCenterX - targetCenterX;
  imageTranslateY += viewportCenterY - targetCenterY;
  viewportService.updateImageTransform();
}

function goToHelpRecord(record) {
  if (!record || !record.element) return;

  if (filterPanelOpen) {
    filterPanelStateService.setFilterPanelOpen(false);
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      viewportService.syncDiagramSize();
      focusHelpRecord(record);
      pulseGoToElement(record.element);
    });
  });
}

function togglePinnedHelpSlug(slugValue) {
  const slug = `${slugValue || ""}`.trim();
  if (!slug) return;

  const nextPinned = new Set(pinnedHelpSlugs);
  if (nextPinned.has(slug)) {
    nextPinned.delete(slug);
  } else {
    nextPinned.add(slug);
  }

  pinnedHelpSlugs = nextPinned;
  onPinnedStateChanged();
}

if (typeof window.createTagUtilsService !== "function") {
  console.error("Missing tag utils module: createTagUtilsService");
  throw new Error("Missing tag utils module");
}

const tagUtilsService = window.createTagUtilsService({
  getConfig: () => config,
  getTagVisibility: () => tagVisibility,
});

if (typeof window.createUserAnnotationPositioningService !== "function") {
  console.error(
    "Missing user annotation positioning module: createUserAnnotationPositioningService",
  );
  throw new Error("Missing user annotation positioning module");
}

const userAnnotationPositioningService =
  window.createUserAnnotationPositioningService({
    getImageBounds: (forceRefresh = false) =>
      viewportService.getImageBounds(forceRefresh),
    getWrapper: () => wrapper,
    getIsTouchActive: () => isTouchActive,
    getUserAnnotations: () => userAnnotations,
    getCurrentZoom: () => currentZoom,
    getMarkerScale: () => (config && config.markerScale) || 0.01,
    getUserAnnotationStyle: (type) =>
      config && config.userAnnotationTypes
        ? config.userAnnotationTypes[type]
        : null,
  });

if (typeof window.createFilterLayoutService !== "function") {
  console.error("Missing filter layout module: createFilterLayoutService");
  throw new Error("Missing filter layout module");
}

const filterLayoutService = window.createFilterLayoutService({
  filterPanel,
  filterPanelBackdrop,
  getFilterDockMinImageWidth: () => FILTER_DOCK_MIN_IMAGE_WIDTH,
  getDiagramAspectRatio: () => diagramAspectRatio,
  syncDiagramSize: () => viewportService.syncDiagramSize(),
  updateImageTransform: () => viewportService.updateImageTransform(),
});

if (typeof window.createFilterPanelStateService !== "function") {
  console.error("Missing filter panel state module: createFilterPanelStateService");
  throw new Error("Missing filter panel state module");
}

const filterPanelStateService = window.createFilterPanelStateService({
  filterPanel,
  openFilterPanelBtn,
  filterSearchInput,
  clearFilterHighlight: () => filterHighlightService.clear(),
  getPanelWidthPx: () => filterLayoutService.getPanelWidthPx(),
  updateLayout: (open) => filterLayoutService.updateLayout(open),
  getFilterPanelOpenState: () => filterPanelOpen,
  setFilterPanelOpenState: (value) => {
    filterPanelOpen = value;
  },
  setFilterPanelOverlayMode: (value) => {
    filterPanelOverlayMode = value;
  },
  updateURLState: () => urlStateService.updateURLState(),
});

if (typeof window.createUrlStateService !== "function") {
  console.error("Missing URL state module: createUrlStateService");
  throw new Error("Missing URL state module");
}

const urlStateService = window.createUrlStateService({
  compareTagsByFilterOrder: (a, b) => tagUtilsService.compareTagsByFilterOrder(a, b),
  getTagVisibilityEntries: () => Array.from(tagVisibility.entries()),
  getFilterPanelOpen: () => filterPanelOpen,
  getAnnotationSearchQuery: () => annotationSearchQuery,
  getPinnedSlugs: () => Array.from(pinnedHelpSlugs).sort((a, b) => a.localeCompare(b)),
  getFilterConstraints: () => (onlyShowPinned ? ["pinned"] : []),
  getUserAnnotations: () => userAnnotations,
  getMaxUserAnnotations: () => (config && config.maxUserAnnotations) || 10,
  menuVisibleParam: MENU_VISIBLE_PARAM,
  filterHideTagsParam: FILTER_HIDE_TAGS_PARAM,
  filterQueryParam: FILTER_QUERY_PARAM,
  pinsParam: FILTER_PINS_PARAM,
  constraintParam: FILTER_CONSTRAINT_PARAM,
});

if (typeof window.createTooltipService !== "function") {
  console.error("Missing tooltip module: createTooltipService");
  throw new Error("Missing tooltip module");
}

const tooltipService = window.createTooltipService({
  getFilterPanelOpen: () => filterPanelOpen,
  getFilterPanelElement: () => filterPanel,
  getTooltipMinWidth: () => (config && config.tooltipMinWidth) || 380,
});

tooltipService.initialize();

if (typeof window.createViewportService !== "function") {
  console.error("Missing viewport module: createViewportService");
  throw new Error("Missing viewport module");
}

const viewportService = window.createViewportService({
  image,
  wrapper,
  getDiagramAspectRatio: () => diagramAspectRatio,
  getCurrentZoom: () => currentZoom,
  setCurrentZoom: (value) => {
    currentZoom = value;
  },
  getImageTranslateX: () => imageTranslateX,
  setImageTranslateX: (value) => {
    imageTranslateX = value;
  },
  getImageTranslateY: () => imageTranslateY,
  setImageTranslateY: (value) => {
    imageTranslateY = value;
  },
  getCachedBounds: () => cachedBounds,
  setCachedBounds: (value) => {
    cachedBounds = value;
  },
  getIsTouchActive: () => isTouchActive,
  scheduleMarkerPositioning: (immediate) =>
    userAnnotationPositioningService.scheduleMarkerPositioning(immediate),
});

if (typeof window.createViewportInputService !== "function") {
  console.error("Missing viewport input module: createViewportInputService");
  throw new Error("Missing viewport input module");
}

const viewportInputService = window.createViewportInputService({
  image,
  wrapper,
  filterPanel,
  shouldIgnoreWheelEvent: (event) => {
    const target = event && event.target;
    if (!target || typeof target.closest !== "function") {
      return false;
    }

    return Boolean(
      target.closest("#user-annotations-modal") ||
        target.closest("#edit-annotation-modal"),
    );
  },
  getFilterPanelOpen: () => filterPanelOpen,
  updateFilterPanelLayout: () => filterPanelStateService.updateFilterPanelLayout(),
  syncDiagramSize: () => viewportService.syncDiagramSize(),
  centerImageAtCurrentZoom: () => viewportService.centerImageAtCurrentZoom(),
  getImageBounds: (forceRefresh = false) =>
    viewportService.getImageBounds(forceRefresh),
  updateImageTransform: () => viewportService.updateImageTransform(),
  scheduleMarkerPositioning: (immediate) =>
    userAnnotationPositioningService.scheduleMarkerPositioning(immediate),
  getCurrentZoom: () => currentZoom,
  setCurrentZoom: (value) => {
    currentZoom = value;
  },
  getMinZoom: () => minZoom,
  getMaxZoom: () => maxZoom,
  getImageTranslateX: () => imageTranslateX,
  setImageTranslateX: (value) => {
    imageTranslateX = value;
  },
  getImageTranslateY: () => imageTranslateY,
  setImageTranslateY: (value) => {
    imageTranslateY = value;
  },
  getIsPanning: () => isPanning,
  setIsPanning: (value) => {
    isPanning = value;
  },
  getPanStartX: () => panStartX,
  setPanStartX: (value) => {
    panStartX = value;
  },
  getPanStartY: () => panStartY,
  setPanStartY: (value) => {
    panStartY = value;
  },
  getCachedBounds: () => cachedBounds,
  setCachedBounds: (value) => {
    cachedBounds = value;
  },
  getIsTouchActive: () => isTouchActive,
  setIsTouchActive: (value) => {
    isTouchActive = value;
  },
});

if (typeof window.createThemeService !== "function") {
  console.error("Missing theme module: createThemeService");
  throw new Error("Missing theme module");
}

const themeService = window.createThemeService({
  storageKey: THEME_STORAGE_KEY,
  toggleButton: themeToggleBtn,
});

if (typeof window.createContentUtilsService !== "function") {
  console.error("Missing content utils module: createContentUtilsService");
  throw new Error("Missing content utils module");
}

const contentUtilsService = window.createContentUtilsService({
  getAllowedHtmlTags: () =>
    (config && config.allowedHtmlTags) || ["br", "b", "strong", "i", "em"],
  getHtmlWhitelist: () => (config && config.htmlWhitelist) || {},
});

if (typeof window.createHelpUtilsService !== "function") {
  console.error("Missing help utils module: createHelpUtilsService");
  throw new Error("Missing help utils module");
}

const helpUtilsService = window.createHelpUtilsService({
  cleanMultiline: (value) => contentUtilsService.cleanMultiline(value),
});

if (typeof window.createFilterHighlightService !== "function") {
  console.error("Missing filter highlight module: createFilterHighlightService");
  throw new Error("Missing filter highlight module");
}

const filterHighlightService = window.createFilterHighlightService();

if (typeof window.createFilterResultsService !== "function") {
  console.error("Missing filter results module: createFilterResultsService");
  throw new Error("Missing filter results module");
}

const filterResultsService = window.createFilterResultsService({
  filterResults,
  getSvgHelpRecords: () => svgHelpRecords,
  getPinnedHelpSlugs: () => pinnedHelpSlugs,
  setPinnedHelpSlugs: (nextSet) => {
    pinnedHelpSlugs = nextSet;
  },
  onPinnedStateChanged,
  onConstraintStateChanged: () => onFilterConstraintStateChanged(),
  getOnlyShowPinned: () => onlyShowPinned,
  setOnlyShowPinned: (value) => {
    onlyShowPinned = Boolean(value);
  },
  setFilterControlsDisabled: (disabled) => {
    const disable = Boolean(disabled);
    filterPanel.classList.toggle("filter-only-pinned-mode", disable);

    filterSearchInput.disabled = disable;
    filterSearchInput.placeholder = disable
      ? "Disabled while only showing pinned"
      : FILTER_SEARCH_PLACEHOLDER_DEFAULT;

    resetFilterBtn.disabled = disable;

    const tagControlInputs = filterTagControls.querySelectorAll(
      "button, input, select, textarea",
    );
    tagControlInputs.forEach((element) => {
      element.disabled = disable;
    });
  },
  getAnnotationSearchQuery: () => annotationSearchQuery,
  normalizeQuery: (query) => helpUtilsService.normalizeQuery(query),
  helpMatchesSearch: (record, query) => helpUtilsService.helpMatchesSearch(record, query),
  isTagSetVisible: (tags) => tagUtilsService.isTagSetVisible(tags),
  isTagSetDisabledByHiddenGroup: (tags) =>
    tagUtilsService.isTagSetDisabledByHiddenGroup(tags),
  getHiddenDisableTags: (tags) => tagUtilsService.getHiddenDisableTags(tags),
  getSortedVisibleTags: (tags) => tagUtilsService.getSortedVisibleTags(tags),
  compareTagsByFilterOrder: (a, b) => tagUtilsService.compareTagsByFilterOrder(a, b),
  buildTagBadgesHtml: (tags) => tagUtilsService.buildTagBadgesHtml(tags),
  getSeverityClassForTags: (tags) => tagUtilsService.getSeverityClassForTags(tags),
  applySeverityStyleToElement: (element, tags) =>
    tagUtilsService.applySeverityStyleToElement(element, tags),
  escapeHTML: (value) => contentUtilsService.escapeHTML(value),
  clearFilterHighlight: () => filterHighlightService.clear(),
  bindResultHighlight: (item, record) =>
    filterHighlightService.bindResultHighlight(item, record),
  isMobileDevice: () => tooltipService.isMobileDevice(),
  getFilterPanelOpen: () => filterPanelOpen,
  getFilterPanelOverlayMode: () => filterPanelOverlayMode,
  goToHelpRecord,
  updateSvgElementVisibility: (element) =>
    svgHelpService.updateSvgElementVisibility(element),
  updateFilterResultSummary: (helpVisible, helpTotal, query) => {
    filterResultCount.textContent = helpUtilsService.getFilterResultSummary(
      helpVisible,
      helpTotal,
      query,
    );
  },
});

if (typeof window.createLoadFeedbackService !== "function") {
  console.error("Missing load feedback module: createLoadFeedbackService");
  throw new Error("Missing load feedback module");
}

const loadFeedbackService = window.createLoadFeedbackService({
  getLoadingIndicatorId: () =>
    (config && config.ui && config.ui.loadingIndicatorId) || "loading-indicator",
  getLoadingMessage: () =>
    (config && config.ui && config.ui.loadingMessage) || "Loading diagram...",
});

if (typeof window.createAppLifecycleService !== "function") {
  console.error("Missing app lifecycle module: createAppLifecycleService");
  throw new Error("Missing app lifecycle module");
}

const appLifecycleService = window.createAppLifecycleService({
  image,
  getCurrentZoom: () => currentZoom,
  setCurrentZoom: (value) => {
    currentZoom = value;
  },
  getImageTranslateX: () => imageTranslateX,
  getImageTranslateY: () => imageTranslateY,
  getFilterPanelOpen: () => filterPanelOpen,
  getDiagramSourcePath: () => diagramSourcePath,
  syncDiagramSize: () => viewportService.syncDiagramSize(),
  centerImageAtCurrentZoom: () => viewportService.centerImageAtCurrentZoom(),
  setFilterPanelOpen: (open) => filterPanelStateService.setFilterPanelOpen(open),
  renderAllMarkers: () => userAnnotationRenderService.renderAllMarkers(),
  clearUserAnnotationVisuals: () => userAnnotationRenderService.clearUserAnnotationVisuals(),
  showLoadingOverlay: () => loadFeedbackService.showLoadingState(),
  hideLoadingOverlay: () => loadFeedbackService.hideLoadingState(),
  showErrorOverlay: (message, isRetryable) =>
    loadFeedbackService.showError(message, isRetryable),
  loadDiagram: () => svgLoaderService.loadDiagram(diagramSourcePath),
});

if (typeof window.createSvgHelpService !== "function") {
  console.error("Missing SVG help module: createSvgHelpService");
  throw new Error("Missing SVG help module");
}

const svgHelpService = window.createSvgHelpService({
  image,
  tooltipLayer,
  parseTags: (tagValue) => tagUtilsService.parseTags(tagValue),
  parseHelpContent: (rawText) => helpUtilsService.parseHelpContent(rawText),
  buildTagBadgesHtml: (tags) => tagUtilsService.buildTagBadgesHtml(tags),
  getSeverityClassForTags: (tags) => tagUtilsService.getSeverityClassForTags(tags),
  applySeverityStyleToElement: (element, tags) =>
    tagUtilsService.applySeverityStyleToElement(element, tags),
  escapeHTML: (value) => contentUtilsService.escapeHTML(value),
  tooltipService,
  getEditModeEnabled: () => editModeEnabled,
  getDebugEnabled: () => debug,
  isSlugPinned: (slugValue) => pinnedHelpSlugs.has(`${slugValue || ""}`.trim()),
  togglePinnedSlug: (slugValue) => togglePinnedHelpSlug(slugValue),
  applyAnnotationFilter: () => filterResultsService.applyAnnotationFilter(),
  getOnlyShowPinned: () => onlyShowPinned,
  getTooltipHideDelay: () => (config && config.ui && config.ui.tooltipHideDelay) || 100,
  getTagVisibility: () => tagVisibility,
  isTagSetDisabledByHiddenGroup: (tags) =>
    tagUtilsService.isTagSetDisabledByHiddenGroup(tags),
  getHiddenDisableTags: (tags) => tagUtilsService.getHiddenDisableTags(tags),
  getSvgHelpRecordByElement: () => svgHelpRecordByElement,
});

if (typeof window.createSvgLoaderService !== "function") {
  console.error("Missing SVG loader module: createSvgLoaderService");
  throw new Error("Missing SVG loader module");
}

const svgLoaderService = window.createSvgLoaderService({
  image,
  setDiagramAspectRatio: (value) => {
    diagramAspectRatio = value;
  },
  syncDiagramSize: () => viewportService.syncDiagramSize(),
  initializeSvgPropertyAnnotations: () => {
    const nextState = svgHelpService.initializeSvgPropertyAnnotations();
    svgHelpRecords = nextState.records;
    svgHelpRecordByElement = nextState.recordByElement;
    normalizePinnedHelpSlugs();
  },
  initializeTagControls: () => tagControlsService.initializeTagControls(),
  updateFilterPanelLayout: () => filterPanelStateService.updateFilterPanelLayout(),
  handleImageLoad: () => appLifecycleService.handleImageLoad(),
  handleImageError: (error) => appLifecycleService.handleImageError(error),
});

const initialFilterState = urlStateService.parseFilterStateFromURL();
const initialHiddenTags = new Set(initialFilterState.hiddenTags || []);
const hasInitialHiddenTags = Boolean(initialFilterState.hasHiddenTags);
annotationSearchQuery = initialFilterState.query || "";
filterPanelOpen = Boolean(initialFilterState.open);
pinnedHelpSlugs = new Set(initialFilterState.pinnedSlugs || []);
onlyShowPinned = Array.isArray(initialFilterState.constraints)
  ? initialFilterState.constraints.includes("pinned")
  : false;
filterSearchInput.value = annotationSearchQuery;

if (typeof window.createTagControlsService !== "function") {
  console.error("Missing tag controls module: createTagControlsService");
  throw new Error("Missing tag controls module");
}

const tagControlsService = window.createTagControlsService({
  image,
  filterTagControls,
  parseTags: (tagValue) => tagUtilsService.parseTags(tagValue),
  getTagMeta: (tag) => tagUtilsService.getTagMeta(tag),
  getTagGroupMeta: (groupId) => tagUtilsService.getTagGroupMeta(groupId),
  getTagVisibility: () => tagVisibility,
  getDiagramTagElements: () => diagramTagElements,
  setDiagramTagElements: (value) => {
    diagramTagElements = value;
  },
  getInitialHiddenTags: () => initialHiddenTags,
  getHasInitialHiddenTags: () => hasInitialHiddenTags,
  updateSvgElementVisibility: (element) =>
    svgHelpService.updateSvgElementVisibility(element),
  applyAnnotationFilter: () => filterResultsService.applyAnnotationFilter(),
  updateURLState: () => urlStateService.updateURLState(),
});

if (typeof window.createUserAnnotationFormsService !== "function") {
  console.error(
    "Missing user annotation forms module: createUserAnnotationFormsService",
  );
  throw new Error("Missing user annotation forms module");
}

const userAnnotationFormsService = window.createUserAnnotationFormsService({
  processUserDescription: (text) => contentUtilsService.processUserDescription(text),
  getSelectedType: () => selectedType,
  setSelectedType: (value) => {
    selectedType = value;
  },
  getCurrentMode: () => currentMode,
  getUserAnnotations: () => userAnnotations,
  encodeUserAnnotationsToURL: () => urlStateService.encodeUserAnnotationsToURL(),
  renderAllMarkers: () => userAnnotationRenderService.renderAllMarkers(),
  updateUserAnnotationsList: () => userAnnotationListService.updateUserAnnotationsList(),
});

if (typeof window.createUserAnnotationListService !== "function") {
  console.error(
    "Missing user annotation list module: createUserAnnotationListService",
  );
  throw new Error("Missing user annotation list module");
}

const userAnnotationListService = window.createUserAnnotationListService({
  getUserAnnotations: () => userAnnotations,
  getUserAnnotationStyle: (type) =>
    config && config.userAnnotationTypes ? config.userAnnotationTypes[type] : null,
  escapeHTML: (value) => contentUtilsService.escapeHTML(value),
  updateEditDescriptionPreview: () =>
    userAnnotationFormsService.updateEditDescriptionPreview(),
  encodeUserAnnotationsToURL: () => urlStateService.encodeUserAnnotationsToURL(),
  renderAllMarkers: () => userAnnotationRenderService.renderAllMarkers(),
});

if (typeof window.createUserAnnotationHoverService !== "function") {
  console.error(
    "Missing user annotation hover module: createUserAnnotationHoverService",
  );
  throw new Error("Missing user annotation hover module");
}

const userAnnotationHoverService = window.createUserAnnotationHoverService({
  tooltipService,
  getEditModeEnabled: () => editModeEnabled,
  getTooltipHideDelay: () => (config && config.ui && config.ui.tooltipHideDelay) || 100,
  getAreaHoverTolerance: () =>
    (config &&
      config.areaAnnotationConfig &&
      config.areaAnnotationConfig.minHoverDistance) ||
    5,
});

if (typeof window.createUserAnnotationDragService !== "function") {
  console.error(
    "Missing user annotation drag module: createUserAnnotationDragService",
  );
  throw new Error("Missing user annotation drag module");
}

const userAnnotationDragService = window.createUserAnnotationDragService({
  wrapper,
  getEditModeEnabled: () => editModeEnabled,
  getUserAnnotations: () => userAnnotations,
  getUserAnnotationStyle: (type) =>
    config && config.userAnnotationTypes ? config.userAnnotationTypes[type] : null,
  getImageBounds: (forceRefresh = false) =>
    viewportService.getImageBounds(forceRefresh),
  scheduleMarkerPositioning: (immediate) =>
    userAnnotationPositioningService.scheduleMarkerPositioning(immediate),
  encodeUserAnnotationsToURL: () => urlStateService.encodeUserAnnotationsToURL(),
});

if (typeof window.createUserAnnotationRenderService !== "function") {
  console.error(
    "Missing user annotation render module: createUserAnnotationRenderService",
  );
  throw new Error("Missing user annotation render module");
}

const userAnnotationRenderService = window.createUserAnnotationRenderService({
  image,
  wrapper,
  tooltipLayer,
  getUserAnnotations: () => userAnnotations,
  getUserAnnotationStyle: (type) =>
    config && config.userAnnotationTypes ? config.userAnnotationTypes[type] : null,
  getEditModeEnabled: () => editModeEnabled,
  getImageBounds: (forceRefresh = false) =>
    viewportService.getImageBounds(forceRefresh),
  escapeHTML: (value) => contentUtilsService.escapeHTML(value),
  processUserDescription: (value) => contentUtilsService.processUserDescription(value),
  applyAnnotationFilter: () => filterResultsService.applyAnnotationFilter(),
  scheduleMarkerPositioning: (immediate) =>
    userAnnotationPositioningService.scheduleMarkerPositioning(immediate),
  addPointAnnotationHoverEvents: (wrapperEl, tooltip, ann) =>
    userAnnotationHoverService.addPointAnnotationHoverEvents(wrapperEl, tooltip, ann),
  addUserAnnotationDragListeners: (wrapperEl, marker, index) =>
    userAnnotationDragService.addUserAnnotationDragListeners(wrapperEl, marker, index),
  addAreaResizeHandles: (areaElement, ann, index) =>
    userAnnotationDragService.addAreaResizeHandles(areaElement, ann, index),
  addAreaAnnotationHoverEvents: (areaElement, tooltip, ann) =>
    userAnnotationHoverService.addAreaAnnotationHoverEvents(areaElement, tooltip, ann),
  addAreaAnnotationDragListeners: (wrapperEl, areaElement, index) =>
    userAnnotationDragService.addAreaAnnotationDragListeners(
      wrapperEl,
      areaElement,
      index,
    ),
});

if (typeof window.createUserAnnotationPlacementService !== "function") {
  console.error(
    "Missing user annotation placement module: createUserAnnotationPlacementService",
  );
  throw new Error("Missing user annotation placement module");
}

const userAnnotationPlacementService = window.createUserAnnotationPlacementService({
  getWrapper: () => wrapper,
  getUserAnnotations: () => userAnnotations,
  getUserAnnotationStyle: (type) =>
    config && config.userAnnotationTypes ? config.userAnnotationTypes[type] : null,
  getImageBounds: (forceRefresh = false) =>
    viewportService.getImageBounds(forceRefresh),
  getMaxUserAnnotations: () => (config && config.maxUserAnnotations) || 10,
  clearInlineForm: () => userAnnotationFormsService.clearInlineForm(),
  encodeUserAnnotationsToURL: () => urlStateService.encodeUserAnnotationsToURL(),
  renderAllMarkers: () => userAnnotationRenderService.renderAllMarkers(),
  updateUserAnnotationsList: () => userAnnotationListService.updateUserAnnotationsList(),
  addAreaAnnotationHoverEvents: (areaElement, tooltip, ann) =>
    userAnnotationHoverService.addAreaAnnotationHoverEvents(areaElement, tooltip, ann),
  addPointAnnotationHoverEvents: (wrapperEl, tooltip, ann) =>
    userAnnotationHoverService.addPointAnnotationHoverEvents(wrapperEl, tooltip, ann),
  setEditModeEnabled: (value) => {
    editModeEnabled = value;
  },
  updateUserAnnotationDragState: () =>
    userAnnotationDragService.updateUserAnnotationDragState(),
  updateEditModeButtonVisibility: () => {
    const exitEditModeBtn = document.getElementById("exit-edit-mode");
    if (exitEditModeBtn) {
      exitEditModeBtn.style.display = editModeEnabled ? "inline-block" : "none";
    }
  },
});

if (typeof window.createUserAnnotationInitService !== "function") {
  console.error(
    "Missing user annotation init module: createUserAnnotationInitService",
  );
  throw new Error("Missing user annotation init module");
}

const userAnnotationInitService = window.createUserAnnotationInitService({
  getConfig: () => config,
  getCurrentMode: () => currentMode,
  setCurrentMode: (value) => {
    currentMode = value;
  },
  getSelectedType: () => selectedType,
  setSelectedType: (value) => {
    selectedType = value;
  },
  getUserAnnotations: () => userAnnotations,
  setUserAnnotations: (value) => {
    userAnnotations = value;
  },
  setEditModeEnabled: (value) => {
    editModeEnabled = value;
  },
  isPlacementModeActive: () => userAnnotationPlacementService.isPlacementModeActive(),
  cleanupPlacementMode: () => userAnnotationPlacementService.cleanupPlacementMode(),
  startAddAnnotationModeWithData: (annotationData) =>
    userAnnotationPlacementService.startAddAnnotationModeWithData(annotationData),
  updateInlineFormValidation: () =>
    userAnnotationFormsService.updateInlineFormValidation(),
  updateUserAnnotationsList: () => userAnnotationListService.updateUserAnnotationsList(),
  updateUserAnnotationDragState: () =>
    userAnnotationDragService.updateUserAnnotationDragState(),
  updateEditModeButtonVisibility: () => {
    const exitEditModeBtn = document.getElementById("exit-edit-mode");
    if (exitEditModeBtn) {
      exitEditModeBtn.style.display = editModeEnabled ? "inline-block" : "none";
    }
  },
  clearInlineForm: () => userAnnotationFormsService.clearInlineForm(),
  initializeInlineForm: () => userAnnotationFormsService.initializeInlineForm(),
  initializeEditForm: () => userAnnotationFormsService.initializeEditForm(),
  encodeUserAnnotationsToURL: () => urlStateService.encodeUserAnnotationsToURL(),
  renderAllMarkers: () => userAnnotationRenderService.renderAllMarkers(),
});

if (typeof window.createFilterPanelInputService !== "function") {
  console.error("Missing filter panel input module: createFilterPanelInputService");
  throw new Error("Missing filter panel input module");
}

const filterPanelInputService = window.createFilterPanelInputService({
  filterPanel,
  filterPanelBackdrop,
  openFilterPanelBtn,
  closeFilterPanelBtn,
  filterSearchInput,
  resetFilterBtn,
  getFilterPanelOpen: () => filterPanelOpen,
  getFilterPanelOverlayMode: () => filterPanelOverlayMode,
  setFilterPanelOpen: (open) => filterPanelStateService.setFilterPanelOpen(open),
  getTagVisibility: () => tagVisibility,
  setAnnotationSearchQuery: (value) => {
    annotationSearchQuery = value;
  },
  applyAnnotationFilter: () => filterResultsService.applyAnnotationFilter(),
  initializeTagControls: () => tagControlsService.initializeTagControls(),
  updateURLState: () => urlStateService.updateURLState(),
  isAnyAnnotationModalOpen: () => {
    const userModal = document.getElementById("user-annotations-modal");
    const editModal = document.getElementById("edit-annotation-modal");
    return (
      (userModal && userModal.style.display !== "none") ||
      (editModal && editModal.style.display !== "none")
    );
  },
});

// Initialize user annotations from URL
userAnnotations = urlStateService.parseUserAnnotationsFromURL();

diagramSourcePath = debug
  ? (config && config.imagePaths && config.imagePaths.debug) ||
    "./kubesec-diagram.svg"
  : (config && config.imagePaths && config.imagePaths.production) ||
    "./kubesec-diagram.svg";

themeToggleBtn.addEventListener("click", () => {
  themeService.toggleTheme();
});

filterPanelInputService.initialize();

// Show loading state immediately
appLifecycleService.start();

viewportInputService.initialize();

// updateTypePreview function removed - type selection is now visual

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () =>
    userAnnotationInitService.initializeUserAnnotationsUI(),
  );
} else {
  userAnnotationInitService.initializeUserAnnotationsUI();
}

// Handle window resize for area annotations
window.addEventListener("resize", () => {
  // Re-position all markers on window resize
  userAnnotationPositioningService.scheduleMarkerPositioning();
});
