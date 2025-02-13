// Theme toggle functionality
const THEME_KEY = 'theme';
const THEMES = {
  DARK: 'dark',
  LIGHT: 'light',
  // CANDY: 'candy'
};

const THEME_EMOJIS = {
  [THEMES.DARK]: '🌙',
  [THEMES.LIGHT]: '☀️',
  // [THEMES.CANDY]: '🍬'
};

// Define theme cycle order
const THEME_CYCLE = [
  THEMES.DARK,
  THEMES.LIGHT,
  // THEMES.CANDY
];

function setTheme(theme) {
  // Validate theme
  if (!Object.values(THEMES).includes(theme)) {
    console.warn(`Invalid theme: ${theme}. Falling back to dark theme.`);
    theme = THEMES.DARK;
  }
  
  // Set theme on html element
  document.documentElement.dataset.theme = theme;
  
  // Update theme icon
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) {
    themeIcon.textContent = THEME_EMOJIS[theme];
  }
  
  // Store theme preference
  localStorage.setItem(THEME_KEY, theme);
}

function getNextTheme(currentTheme) {
  const currentIndex = THEME_CYCLE.indexOf(currentTheme);
  return THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length];
}

function initTheme() {
  // Get saved theme or system preference
  const savedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Set initial theme
  const initialTheme = savedTheme || (prefersDark ? THEMES.DARK : THEMES.LIGHT);
  setTheme(initialTheme);

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(THEME_KEY)) {
      setTheme(e.matches ? THEMES.DARK : THEMES.LIGHT);
    }
  });
}

// Set initial emoji as soon as possible
const themeIcon = document.getElementById('theme-icon');
if (themeIcon) {
  const currentTheme = localStorage.getItem(THEME_KEY) || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? THEMES.DARK : THEMES.LIGHT);
  themeIcon.textContent = THEME_EMOJIS[currentTheme];
}

function toggleTheme() {
  const currentTheme = document.documentElement.dataset.theme || THEMES.DARK;
  setTheme(getNextTheme(currentTheme));
}

// Initialize theme when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme);
} else {
  initTheme();
}

// Make toggle function available globally
window.toggleTheme = toggleTheme; 