/**
 * theme-sync.js
 * How it works:
 *  - applySharedTheme()  → reads localStorage and applies --accent / --matrix-color
 *  - saveSharedTheme()   → writes theme to localStorage (call this whenever the user picks a color)
 *  - window.storage event → other open tabs/pages automatically pick up the change instantly
 */

(function () {
  const THEME_KEY   = "themeColor"; 
  const CUSTOM_KEY  = "customAccent";

  const PRESETS = {
    green:  "#00ff9c",
    blue:   "#4da3ff",
    red:    "#ff4d4d",
    yellow: "#ffe44d",
  };

  function resolveAccent() {
    try {
      const theme  = localStorage.getItem(THEME_KEY)  || "green";
      const custom = localStorage.getItem(CUSTOM_KEY) || "#00ff9c";
      if (theme === "custom") return custom;
      return PRESETS[theme] || PRESETS.green;
    } catch (e) {
      return "#00ff9c";
    }
  }

  function applyAccent(hex) {
    if (!hex || !hex.startsWith("#")) return;
    const root = document.documentElement;
    root.style.setProperty("--accent",       hex);
    root.style.setProperty("--matrix-color", hex);
    root.style.setProperty("--glass-border", `color-mix(in srgb, ${hex} 20%, rgba(255,255,255,0.15))`);
    root.style.setProperty("--glass-bg",     "rgba(0,0,0,0.25)");
    root.style.setProperty("--launcher-border-color",   `color-mix(in srgb, ${hex} 35%, rgba(255,255,255,0.18))`);
    root.style.setProperty("--launcher-section-bg",     "rgba(15,23,42,0.6)");
    root.style.setProperty("--launcher-section-border", `color-mix(in srgb, ${hex} 30%, rgba(148,163,184,0.35))`);
  }

  function applySharedTheme() {
    applyAccent(resolveAccent());
  }

  function saveSharedTheme(themeKeyOrHex, customHex) {
    try {
      if (themeKeyOrHex === "custom" && customHex) {
        localStorage.setItem(THEME_KEY,  "custom");
        localStorage.setItem(CUSTOM_KEY, customHex);
        applyAccent(customHex);
      } else {
        localStorage.setItem(THEME_KEY, themeKeyOrHex);
        applyAccent(PRESETS[themeKeyOrHex] || themeKeyOrHex);
      }

      window.dispatchEvent(new StorageEvent("storage", {
        key:      THEME_KEY,
        newValue: localStorage.getItem(THEME_KEY),
        storageArea: localStorage,
      }));
    } catch (e) {}
  }

  /** Listen for changes made in another tab (e.g. home.html → games.html) */
  window.addEventListener("storage", function (e) {
    if (e.key === THEME_KEY || e.key === CUSTOM_KEY) {
      applyAccent(resolveAccent());
    }
  });

  // Apply on every page load
  applySharedTheme();

  // Expose helpers globally
  window.ThemeSync = { applySharedTheme, saveSharedTheme, resolveAccent, applyAccent };
})();
