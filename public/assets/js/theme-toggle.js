(() => {
  // src/assets/js/theme-toggle.js
  var THEME_KEY = "theme";
  var THEMES = {
    DARK: "dark",
    LIGHT: "light"
    // CANDY: 'candy'
  };
  var THEME_EMOJIS = {
    [THEMES.DARK]: "\u{1F319}",
    [THEMES.LIGHT]: "\u2600\uFE0F"
    // [THEMES.CANDY]: '🍬'
  };
  var THEME_CYCLE = [
    THEMES.DARK,
    THEMES.LIGHT
    // THEMES.CANDY
  ];
  function setTheme(theme) {
    if (!Object.values(THEMES).includes(theme)) {
      console.warn(`Invalid theme: ${theme}. Falling back to dark theme.`);
      theme = THEMES.DARK;
    }
    document.documentElement.dataset.theme = theme;
    const themeIcon2 = document.getElementById("theme-icon");
    if (themeIcon2) {
      themeIcon2.textContent = THEME_EMOJIS[theme];
    }
    localStorage.setItem(THEME_KEY, theme);
  }
  function getNextTheme(currentTheme) {
    const currentIndex = THEME_CYCLE.indexOf(currentTheme);
    return THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length];
  }
  function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (prefersDark ? THEMES.DARK : THEMES.LIGHT);
    setTheme(initialTheme);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (!localStorage.getItem(THEME_KEY)) {
        setTheme(e.matches ? THEMES.DARK : THEMES.LIGHT);
      }
    });
  }
  var themeIcon = document.getElementById("theme-icon");
  if (themeIcon) {
    const currentTheme = localStorage.getItem(THEME_KEY) || (window.matchMedia("(prefers-color-scheme: dark)").matches ? THEMES.DARK : THEMES.LIGHT);
    themeIcon.textContent = THEME_EMOJIS[currentTheme];
  }
  function toggleTheme() {
    const currentTheme = document.documentElement.dataset.theme || THEMES.DARK;
    setTheme(getNextTheme(currentTheme));
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTheme);
  } else {
    initTheme();
  }
  window.toggleTheme = toggleTheme;
})();
//# sourceMappingURL=theme-toggle.js.map
