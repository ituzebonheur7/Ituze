/**
 * Ituze Bonheur
 * Core Application Hub
 * Includes: Cross-tab Sync, Wake Lock Management, Scrollingbar, & Background Precaching.
 */
(function () {
  'use strict';

  const CONFIG = {
    syncAndWakeLockPaths: [
      '/home', 
      '/games', 
    ],

    scrollbarPaths: [
      '/home',
      '/games',
      '/feedback',
      '/me',
      '/qrcode',
    ],

    precacheAssets: [
      'index',
      'home',
      'games',
      'codeviewer',
      'feedback',
      'hunter',
      'me',
      'performance',
      'qrcode',
      'yes',
      'favicon.ico',
    ]
  };

  function isPathAllowed(pathList) {
    const currentPath = window.location.pathname;
    return pathList.some(path => currentPath.includes(path));
  }


  if (isPathAllowed(CONFIG.syncAndWakeLockPaths)) {
    const KEY_THEME  = "themeColor";
    const KEY_CUSTOM = "customAccent";
    const KEY_NAME   = "displayName";

    const PRESETS = {
      green:  "#00ff9c",
      blue:   "#4da3ff",
      red:    "#ff4d4d",
      yellow: "#ffe44d",
    };

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

    function broadcast(key) {
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

    window.addEventListener("storage", function (e) {
      if (e.key === KEY_THEME || e.key === KEY_CUSTOM) {
        applyAccent(resolveAccent());
      }
      if (e.key === KEY_NAME) {
        if (!document.getElementById("displayNameInput")) {
          applyName(resolveName());
        }
      }
    });

    applyAll();

    window.Sync = { applyAll, saveTheme, saveName, applyAccent, applyName, resolveAccent, resolveName };
  }

  if (isPathAllowed(CONFIG.syncAndWakeLockPaths)) {
    let wakeLock = null;

    async function requestWakeLock() {
      if (!("wakeLock" in navigator)) return;
      try {
        wakeLock = await navigator.wakeLock.request("screen");
      } catch (err) {
        console.warn(`Wake Lock down: ${err.message}`);
      }
    }

    requestWakeLock();

    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "visible") {
        await requestWakeLock();
      }
    });

    window.addEventListener("focus", async () => {
      await requestWakeLock();
    });
  }

  if (isPathAllowed(CONFIG.scrollbarPaths)) {
    (function hideScrollbars() {
      const style = document.createElement('style');
      style.innerHTML = `
        * { 
          -ms-overflow-style: none !important; 
          scrollbar-width: none !important; 
        } 
        *::-webkit-scrollbar { 
          display: none !important; 
        }
      `;
      document.documentElement.appendChild(style);
    })();
  }

  function initializePrecache() {
    setTimeout(() => {
      if (!('requestIdleCallback' in window)) {
        executePrefetching();
      } else {
        requestIdleCallback(() => executePrefetching());
      }
    }, 5000);
  }

  function executePrefetching() {
    const fragment = document.createDocumentFragment();

    CONFIG.precacheAssets.forEach(assetPath => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = assetPath;
      fragment.appendChild(link);
    });

    document.head.appendChild(fragment);
  }

  if (document.readyState === 'complete') {
    initializePrecache();
  } else {
    window.addEventListener('load', initializePrecache);
  }

})();
