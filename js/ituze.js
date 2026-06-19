/**
 * Ituze Bonheur - Core Application Hub
 * 
 * Manages:
 * - Cross-tab Synchronization (theme, accent, display name)
 * - Wake Lock Management (screen keep-alive)
 * - Scrollbar Visibility Control
 * - Background Asset Prefetching
 * 
 * @author Ituze Bonheur
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
      '/index',
      '/home',
      '/games',
      '/codeviewer',
      '/feedback',
      '/hunter',
      '/me',
      '/performance',
      '/qrcode',
      '/yes',
      '/favicon.ico',
    ],
  };

  const pathPermissions = {
    syncAndWakeLock: isPathAllowed(CONFIG.syncAndWakeLockPaths),
    scrollbar: isPathAllowed(CONFIG.scrollbarPaths),
  };

  function isPathAllowed(pathList) {
    const currentPath = window.location.pathname;
    return pathList.some(path => currentPath.includes(path));
  }

  if (pathPermissions.syncAndWakeLock) {
    const KEY_THEME = 'themeColor';
    const KEY_CUSTOM = 'customAccent';
    const KEY_NAME = 'displayName';

    const PRESETS = {
      green: '#00ff9c',
      blue: '#4da3ff',
      red: '#ff4d4d',
      yellow: '#ffe44d',
    };

    function resolveAccent() {
      try {
        const theme = localStorage.getItem(KEY_THEME) || 'green';
        const custom = localStorage.getItem(KEY_CUSTOM) || '#00ff9c';
        return theme === 'custom' ? custom : (PRESETS[theme] || PRESETS.green);
      } catch (_) {
        return '#00ff9c';
      }
    }

    function resolveName() {
      try {
        return localStorage.getItem(KEY_NAME) || 'Ituze';
      } catch (_) {
        return 'Ituze';
      }
    }

    function applyAccent(hex) {
      if (!hex || !hex.startsWith('#')) return;

      const root = document.documentElement;
      root.style.setProperty('--accent', hex);
      root.style.setProperty('--matrix-color', hex);
      root.style.setProperty(
        '--glass-border',
        `color-mix(in srgb, ${hex} 20%, rgba(255,255,255,0.15))`
      );
      root.style.setProperty('--glass-bg', 'rgba(0,0,0,0.25)');
      root.style.setProperty(
        '--launcher-border-color',
        `color-mix(in srgb, ${hex} 35%, rgba(255,255,255,0.18))`
      );
      root.style.setProperty('--launcher-section-bg', 'rgba(15,23,42,0.6)');
      root.style.setProperty(
        '--launcher-section-border',
        `color-mix(in srgb, ${hex} 30%, rgba(148,163,184,0.35))`
      );
    }

    function applyName(name) {
      const greeting = document.getElementById('greeting');
      if (!greeting) return;

      const hour = new Date().getHours();
      let salutation;

      if (hour < 5) {
        salutation = 'Good night';
      } else if (hour < 12) {
        salutation = 'Good morning';
      } else if (hour < 17) {
        salutation = 'Good afternoon';
      } else {
        salutation = 'Good evening';
      }

      greeting.textContent = `${salutation}, ${name}`;
    }

    function applyAll() {
      applyAccent(resolveAccent());
      if (!document.getElementById('displayNameInput')) {
        applyName(resolveName());
      }
    }

    function broadcast(key) {
      try {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key,
            newValue: localStorage.getItem(key),
            storageArea: localStorage,
          })
        );
      } catch (_) {
      }
    }

    function saveTheme(themeKeyOrHex, customHex) {
      try {
        if (themeKeyOrHex === 'custom' && customHex) {
          localStorage.setItem(KEY_THEME, 'custom');
          localStorage.setItem(KEY_CUSTOM, customHex);
          applyAccent(customHex);
        } else {
          localStorage.setItem(KEY_THEME, themeKeyOrHex);
          applyAccent(PRESETS[themeKeyOrHex] || themeKeyOrHex);
        }
        broadcast(KEY_THEME);
      } catch (_) {
      }
    }

    function saveName(name) {
      try {
        const resolved = (name || '').trim() || 'Ituze';
        localStorage.setItem(KEY_NAME, resolved);
        applyName(resolved);
        broadcast(KEY_NAME);
      } catch (_) {
      }
    }

    window.addEventListener('storage', (e) => {
      if (e.key === KEY_THEME || e.key === KEY_CUSTOM) {
        applyAccent(resolveAccent());
      }
      if (e.key === KEY_NAME) {
        if (!document.getElementById('displayNameInput')) {
          applyName(resolveName());
        }
      }
    });

    applyAll();

    window.Sync = {
      applyAll,
      saveTheme,
      saveName,
      applyAccent,
      applyName,
      resolveAccent,
      resolveName,
    };
  }

  if (pathPermissions.syncAndWakeLock) {
    let wakeLock = null;
    let isWakeLockActive = false;

    async function requestWakeLock() {
      if (!('wakeLock' in navigator)) return;
      if (isWakeLockActive) return; 

      try {
        wakeLock = await navigator.wakeLock.request('screen');
        isWakeLockActive = true;

        wakeLock.addEventListener('release', () => {
          isWakeLockActive = false;
          wakeLock = null;
        });
      } catch (err) {
        isWakeLockActive = false;
        console.warn(`Wake Lock request failed: ${err.message}`);
      }
    }

    async function releaseWakeLock() {
      if (wakeLock) {
        await wakeLock.release();
        isWakeLockActive = false;
        wakeLock = null;
      }
    }

    requestWakeLock();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    });

    window.addEventListener('focus', () => {
      requestWakeLock();
    });

    window.WakeLock = { requestWakeLock, releaseWakeLock };
  }

  if (pathPermissions.scrollbar) {
    (function hideScrollbars() {
      const style = document.createElement('style');
      style.textContent = `
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
        requestIdleCallback(() => executePrefetching(), { timeout: 2000 });
      }
    }, 5000);
  }

  function executePrefetching() {
    const fragment = document.createDocumentFragment();

    CONFIG.precacheAssets.forEach((assetPath) => {
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
