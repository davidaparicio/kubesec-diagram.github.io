window.createLinkInfoService = function createLinkInfoService(deps) {
  const COPIED_MS = 1200;
  const PREVIEW_VALUE_MAX = 24;

  let initialized = false;

  function getVariantsEl() {
    return document.getElementById("link-info-variants");
  }

  function getParamsEl() {
    return document.getElementById("link-info-params");
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function plural(count, word) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
  }

  function splitList(value) {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function buildUrlWithout(removed) {
    const url = new URL(window.location.href);
    removed.forEach((name) => url.searchParams.delete(name));
    return deps.toAbsoluteReadableUrl(url);
  }

  function buildVariants() {
    const params = new URLSearchParams(window.location.search);
    const has = (name) => params.has(name);
    const candidates = [
      { title: "Current", description: "Exactly what you see now", removed: [] },
      has(deps.annotationsParam) && {
        title: "Without annotations",
        description: `Drops ${plural(deps.getUserAnnotationCount(), "user annotation")}`,
        removed: [deps.annotationsParam],
      },
      has(deps.viewportParam) && {
        title: "Without position",
        description: "Opens zoomed out instead of at this view",
        removed: [deps.viewportParam],
      },
      has(deps.filterHideTagsParam) && {
        title: "Without hidden tags",
        description: `Shows ${plural(splitList(params.get(deps.filterHideTagsParam)).length, "hidden tag")} again`,
        removed: [deps.filterHideTagsParam],
      },
      params.size > 0 && {
        title: "Clean",
        description: "Just the diagram, no state",
        removed: Array.from(new Set(params.keys())),
      },
    ].filter(Boolean);

    const seen = new Set();
    return candidates
      .map((variant) => ({ ...variant, url: buildUrlWithout(variant.removed) }))
      .filter((variant) => {
        if (seen.has(variant.url)) return false;
        seen.add(variant.url);
        return true;
      });
  }

  function shorten(value) {
    return value.length > PREVIEW_VALUE_MAX ? `${value.slice(0, PREVIEW_VALUE_MAX - 1)}…` : value;
  }

  // Query string with long values cut short and the removed parameters struck
  // through and moved to the front, so the difference survives the ellipsis.
  function renderPreview(removed) {
    const preview = el("span", "link-info-preview");
    const entries = Array.from(new URLSearchParams(window.location.search).entries()).sort(
      ([a], [b]) => Number(removed.includes(b)) - Number(removed.includes(a)),
    );
    if (entries.length === 0 || removed.length === entries.length) {
      preview.textContent = window.location.pathname;
      return preview;
    }

    preview.append(window.location.pathname, "?");
    entries.forEach(([name, value], index) => {
      if (index > 0) preview.append("&");
      const part = el(removed.includes(name) ? "del" : "span", "", `${name}=${shorten(value)}`);
      preview.append(part);
    });
    return preview;
  }

  function copyText(text, feedbackEl) {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      console.error("Link info: clipboard API unavailable (needs a secure context)");
      showFeedback(feedbackEl, "Copy unavailable", true);
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => showFeedback(feedbackEl, "Copied", false),
      (error) => {
        console.error("Link info: clipboard write failed:", error);
        showFeedback(feedbackEl, "Copy failed", true);
      },
    );
  }

  function showFeedback(feedbackEl, label, isError) {
    const original = feedbackEl.dataset.label || feedbackEl.textContent;
    feedbackEl.dataset.label = original;
    feedbackEl.textContent = label;
    feedbackEl.classList.add(isError ? "is-error" : "is-done");
    window.setTimeout(() => {
      feedbackEl.textContent = original;
      feedbackEl.classList.remove("is-error", "is-done");
    }, COPIED_MS);
  }

  function renderVariant(variant, isCurrent) {
    const row = el("div", "link-info-link");
    row.title = variant.url;

    const text = el("span", "link-info-link-text");
    const head = el("span", "link-info-link-head");
    head.append(el("strong", "", variant.title), el("span", "link-info-muted", variant.description));
    text.append(head, renderPreview(variant.removed));

    const actions = el("span", "link-info-actions");
    const copyBtn = el("button", "link-info-action", "Copy");
    copyBtn.type = "button";
    copyBtn.addEventListener("click", () => copyText(variant.url, copyBtn));
    actions.append(copyBtn);

    if (!isCurrent) {
      const openBtn = el("button", "link-info-action", "Open");
      openBtn.type = "button";
      openBtn.title = "Load this link here";
      openBtn.addEventListener("click", () => window.location.assign(variant.url));
      actions.append(openBtn);
    }

    row.append(text, actions);
    return row;
  }

  function renderPills(options, active) {
    const pills = el("span", "link-info-pills");
    const all = options.concat(active.filter((value) => !options.includes(value)));
    all.forEach((value) => {
      const known = options.includes(value);
      const state = !known ? " is-invalid" : active.includes(value) ? " is-active" : "";
      const pill = el("span", `link-info-pill${state}${value === "" ? " is-none" : ""}`);
      pill.textContent = value === "" ? "none" : value;
      if (value === "") pill.title = "Parameter left out";
      if (!known) pill.title = "Not a valid value";
      pills.append(pill);
    });
    return pills;
  }

  function resolveValues(doc) {
    return typeof doc.values === "function" ? doc.values() : doc.values;
  }

  function renderValue(doc, value) {
    const wrap = el("div", "link-info-value");
    let copyable = value;

    switch (doc.kind) {
      case "enum":
        wrap.append(el("span", "link-info-hint", "one of"), renderPills(resolveValues(doc), [value]));
        copyable = null;
        break;
      case "enum-multi":
        wrap.append(
          el("span", "link-info-hint", "any of"),
          renderPills(resolveValues(doc), splitList(value)),
        );
        copyable = null;
        break;
      case "flag":
        wrap.append(renderPills(["on"], ["on"]));
        copyable = null;
        break;
      case "list":
        copyable = splitList(value).join(",");
        wrap.append(el("code", "link-info-code", copyable.replace(/,/g, ", ")));
        break;
      case "blob":
        wrap.append(
          el("span", "link-info-muted", `${plural(deps.getUserAnnotationCount(), "annotation")}, ${value.length} chars`),
        );
        break;
      default:
        wrap.append(el("code", "link-info-code", value || "(empty)"));
    }

    if (copyable) {
      const copyBtn = el("button", "link-info-copy", "Copy");
      copyBtn.type = "button";
      copyBtn.addEventListener("click", () => copyText(copyable, copyBtn));
      wrap.append(copyBtn);
    }
    return wrap;
  }

  function buildParamRows() {
    const params = new URLSearchParams(window.location.search);
    const docsByName = new Map(deps.paramDocs.map((doc) => [doc.name, doc]));
    const rows = deps.paramDocs
      .filter((doc) => params.has(doc.name))
      .map((doc) => ({ doc, value: params.get(doc.name) }));

    params.forEach((value, name) => {
      if (docsByName.has(name)) return;
      docsByName.set(name, null);
      rows.push({ doc: { name, kind: "text", description: "Unknown parameter" }, value });
    });
    return rows;
  }

  function renderParams() {
    const container = getParamsEl();
    const rows = buildParamRows();
    if (rows.length === 0) {
      container.replaceChildren(el("p", "link-info-muted", "No parameters set."));
      return;
    }

    container.replaceChildren(
      ...rows.map(({ doc, value }) => {
        const item = el("div", "link-info-param");
        const body = el("div", "link-info-param-body");
        body.append(el("span", "link-info-muted", doc.description), renderValue(doc, value));
        item.append(el("code", "link-info-param-name", doc.name), body);
        return item;
      }),
    );
  }

  function render() {
    if (!getVariantsEl() || !getParamsEl()) return;
    getVariantsEl().replaceChildren(
      ...buildVariants().map((variant) => renderVariant(variant, variant.removed.length === 0)),
    );
    renderParams();
  }

  function initialize() {
    if (initialized) return;
    initialized = true;
    if (!getVariantsEl() || !getParamsEl()) {
      console.error("Link info: #link-info-variants or #link-info-params missing from index.html");
    }
  }

  return {
    initialize,
    render,
  };
};
