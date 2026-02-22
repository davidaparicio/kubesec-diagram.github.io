window.createThemeService = function createThemeService(deps) {
  const THEME_DARK = "dark";
  const THEME_LIGHT = "light";

  function getInitialTheme() {
    const saved = localStorage.getItem(deps.storageKey);
    if (saved === THEME_DARK || saved === THEME_LIGHT) {
      return saved;
    }

    //// Dark theme still too ugly to be default
    // if (
    //   window.matchMedia &&
    //   window.matchMedia("(prefers-color-scheme: dark)").matches
    // ) {
    //   return THEME_DARK;
    // }

    return THEME_LIGHT;
  }

  function applyTheme(theme) {
    const isDark = theme === THEME_DARK;
    document.body.classList.toggle("theme-dark", isDark);
    deps.toggleButton.classList.toggle("active", isDark);

    const themeLabel = deps.toggleButton.querySelector(".theme-label");
    if (themeLabel) {
      themeLabel.textContent = isDark ? "Light theme" : "Dark theme";
    }

    deps.toggleButton.setAttribute("aria-pressed", isDark ? "true" : "false");
    deps.toggleButton.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode",
    );
    deps.toggleButton.setAttribute(
      "title",
      isDark ? "Switch to light mode" : "Switch to dark mode",
    );
  }

  let currentTheme = getInitialTheme();
  applyTheme(currentTheme);

  function toggleTheme() {
    currentTheme = currentTheme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
    localStorage.setItem(deps.storageKey, currentTheme);
    applyTheme(currentTheme);
    return currentTheme;
  }

  return {
    getCurrentTheme: () => currentTheme,
    applyTheme,
    toggleTheme,
  };
};
