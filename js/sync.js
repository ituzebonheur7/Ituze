/**
 * Syncs between home.html ↔ games.html (and any future page):
 *   • Theme color  (themeColor / customAccent)
 *   • Display name (displayName)
 *
 * API (available as window.Sync.*):
 *   Sync.applyAll()                        — read localStorage, apply everything now
 *   Sync.saveTheme(key, customHex?)        — persist + broadcast a theme change
 *   Sync.saveName(name)                    — persist + broadcast a name change
 *   Sync.resolveAccent()                   — returns the current hex color string
 *   Sync.resolveName()                     — returns the current display name string
 */

(function () {
  /* ── Keys ── */
  const KEY_THEME  = "themeColor";
  const KEY_CUSTOM = "customAccent";
  const KEY_NAME   = "displayName";

  /* ── Preset palette (mirrors home.html) ── */
  const PRESETS = {
    green:  "#00ff9c",
    blue:   "#4da3ff",
    red:    "#ff4d4d",
    yellow: "#ffe44d",
  };

  /* ────────────────────────────────────────────
     Helpers
  ──────────────────────────────────────────── */

  function resolveAccent() {
    try {
      const theme  = localStorage.getItem(KEY_THEME)  || "green";
      const custom = localStorage.getItem(KEY_CUSTOM) || "#00ff9c";
      return theme === "custom" ? custom : (PRESETS[theme] || PRESETS.green);
    } catch (_) { return "#00ff9c"; }
  }

  function resolveName() {
    try { return localStorage.getItem(KEY_NAME) || "Ituze"; }
    catch (_) { return "Ituze"; }
  }

  /* ────────────────────────────────────────────
     Apply to DOM
  ──────────────────────────────────────────── */

  function applyAccent(hex) {
    if (!hex || !hex.startsWith("#")) return;
    const r = document.documentElement;
    r.style.setProperty("--accent",                  hex);
    r.style.setProperty("--matrix-color",            hex);
    r.style.setProperty("--glass-border",            `color-mix(in srgb, ${hex} 20%, rgba(255,255,255,0.15))`);
    r.style.setProperty("--glass-bg",                "rgba(0,0,0,0.25)");
    r.style.setProperty("--launcher-border-color",   `color-mix(in srgb, ${hex} 35%, rgba(255,255,255,0.18))`);
    r.style.setProperty("--launcher-section-bg",     "rgba(15,23,42,0.6)");
    r.style.setProperty("--launcher-section-border", `color-mix(in srgb, ${hex} 30%, rgba(148,163,184,0.35))`);
  }

  function applyName(name) {
    const greeting = document.getElementById("greeting");
    if (greeting) {
      const hour = new Date().getHours();
      const salutation =
        hour < 5  ? "Good night"   :
        hour < 12 ? "Good morning" :
        hour < 17 ? "Good afternoon" : "Good evening";
      greeting.textContent = `${salutation}, ${name}`;
    }
  }

  function applyAll() {
    applyAccent(resolveAccent());
    if (!document.getElementById("displayNameInput")) {
      applyName(resolveName());
    }
  }

  /* ────────────────────────────────────────────
     Save & broadcast
  ──────────────────────────────────────────── */

  function broadcast(key) {
    // localStorage.setItem already fires "storage" in OTHER tabs automatically.
    // For the CURRENT tab we dispatch it manually so listeners here also run.
    try {
      window.dispatchEvent(new StorageEvent("storage", {
        key,
        newValue: localStorage.getItem(key),
        storageArea: localStorage,
      }));
    } catch (_) {}
  }

  function saveTheme(themeKeyOrHex, customHex) {
    try {
      if (themeKeyOrHex === "custom" && customHex) {
        localStorage.setItem(KEY_THEME,  "custom");
        localStorage.setItem(KEY_CUSTOM, customHex);
        applyAccent(customHex);
      } else {
        localStorage.setItem(KEY_THEME, themeKeyOrHex);
        applyAccent(PRESETS[themeKeyOrHex] || themeKeyOrHex);
      }
      broadcast(KEY_THEME);
    } catch (_) {}
  }

  function saveName(name) {
    try {
      const resolved = (name || "").trim() || "Ituze";
      localStorage.setItem(KEY_NAME, resolved);
      applyName(resolved);
      broadcast(KEY_NAME);
    } catch (_) {}
  }

  /* ────────────────────────────────────────────
     Live cross-tab listener
     (fires when another tab writes to localStorage)
  ──────────────────────────────────────────── */

  window.addEventListener("storage", function (e) {
    if (e.key === KEY_THEME || e.key === KEY_CUSTOM) {
      applyAccent(resolveAccent());
    }
    if (e.key === KEY_NAME) {
      // Only update greeting text on pages without home's own name input
      if (!document.getElementById("displayNameInput")) {
        applyName(resolveName());
      }
    }
  });

  /* ── Apply immediately on every page load ── */
  applyAll();

  /* ── Public API ── */
  window.Sync = { applyAll, saveTheme, saveName, applyAccent, applyName, resolveAccent, resolveName };
})();
