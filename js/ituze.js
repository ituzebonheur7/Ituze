/**
 * ============================================================================
 * INSTANT NAVIGATION SCRIPT for ituzebonheur.com
 * ============================================================================
 *
 * PURPOSE
 * -------
 * This script makes navigation between pages on the SAME ORIGIN feel like a
 * single-page application (SPA), while keeping your site as plain, separate
 * HTML pages (great for GitHub Pages / static hosting).
 *
 * HOW IT WORKS (high level)
 * --------------------------
 * 1. We listen for clicks on internal <a> links.
 * 2. Instead of letting the browser do a normal navigation (which triggers
 *    the tab spinner and a full page reload), we:
 *      a. Fetch the target page's HTML via JavaScript (fetch API).
 *      b. Parse the returned HTML.
 *      c. Swap out the <title> and the main content container.
 *      d. Update the URL using the History API (pushState).
 *      e. Re-run any <script> tags found in the new content so
 *         page-specific JS still works.
 * 3. We prefetch pages:
 *      - When a link scrolls into view (IntersectionObserver), and
 *      - When the user hovers/focuses a link (likely about to click).
 * 4. Fetched pages are cached in memory (a JS Map) so repeat visits to the
 *    same page during this session are instant (no network request).
 * 5. Back/forward browser buttons are supported via the "popstate" event.
 * 6. Scroll position is restored on back/forward navigation, and reset to
 *    the top (or to a #hash target) on forward/new navigations.
 *
 * NO LOADING INDICATORS
 * ----------------------
 * - We deliberately do NOT show spinners, progress bars, or skeletons.
 * - We avoid triggering the native browser tab spinner by NOT performing a
 *   normal full-page navigation for internal links — fetch() requests do
 *   not show the browser's loading spinner the way <a> navigations do.
 *
 * WHAT THIS SCRIPT DOES *NOT* TOUCH
 * -----------------------------------
 * - External links (different origin)
 * - Links with target="_blank" (open in new tab)
 * - Download links (download attribute)
 * - mailto: and tel: links
 * - Links with rel="external"
 * - Links explicitly opted out via data-no-instant attribute
 *
 * SETUP REQUIRED ON YOUR HTML PAGES
 * ------------------------------------
 * 1. Every page must share the SAME basic layout (header/nav/footer) and
 *    have ONE element that wraps the page-specific content, e.g.:
 *
 *      <main id="page-content">
 *        ... page-specific content here ...
 *      </main>
 *
 *    By default this script looks for an element with id="page-content".
 *    You can change CONTENT_SELECTOR below if your markup uses a different
 *    id or class.
 *
 * 2. Include this script near the end of <body> on every page, e.g.:
 *
 *      <script src="/instant-nav.js"></script>
 *
 * 3. Any inline or external <script> tags placed INSIDE the content
 *    container (#page-content) will be re-executed after navigation.
 *    Scripts placed OUTSIDE the content container (e.g. in <head> or in a
 *    shared footer) will NOT be re-run, since that part of the DOM is not
 *    replaced. This matches normal SPA behaviour: shared/global scripts run
 *    once, page-specific scripts re-run per "page".
 *
 * ============================================================================
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------
  // CONFIGURATION
  // --------------------------------------------------------------------

  // CSS selector for the element whose innerHTML will be swapped between
  // pages. Change this if your site's main content container has a
  // different id/class.
  var CONTENT_SELECTOR = '#page-content';

  // CSS selector for the <title> tag (almost always just "title").
  var TITLE_SELECTOR = 'title';

  // Attribute that lets you opt a specific link OUT of instant navigation.
  // Example: <a href="/special.html" data-no-instant>Special page</a>
  var OPT_OUT_ATTR = 'data-no-instant';

  // How long (ms) to wait after the user starts hovering a link before
  // prefetching it. Avoids prefetching on accidental mouse-overs.
  var HOVER_PREFETCH_DELAY = 65;

  // --------------------------------------------------------------------
  // INTERNAL STATE
  // --------------------------------------------------------------------

  // In-memory cache of fetched pages.
  // Key:   absolute URL string (without hash)
  // Value: { title: string, html: string } where html is the innerHTML
  //        of the content container from the fetched page.
  var pageCache = new Map();

  // Tracks URLs that are currently being fetched, so we don't fetch the
  // same URL twice in parallel (e.g. prefetch + click happening together).
  var inFlightFetches = new Map();

  // Stores scroll positions keyed by the history state's unique id, so we
  // can restore scroll position correctly on back/forward navigation.
  var scrollPositions = new Map();

  // Unique id counter used to tag each history entry we create, so we can
  // reliably store/restore its scroll position.
  var historyIdCounter = 0;

  // --------------------------------------------------------------------
  // UTILITY: Check whether a link should be handled by instant navigation
  // --------------------------------------------------------------------

  /**
   * Decide whether a given <a> element should be intercepted for instant
   * (AJAX-based) navigation, or left alone for the browser to handle
   * normally.
   *
   * @param {HTMLAnchorElement} link
   * @returns {boolean} true if this link should be intercepted
   */
  function isInstantNavLink(link) {
    // Must be an anchor element with an href.
    if (!link || !link.href) return false;

    // Respect explicit opt-out attribute.
    if (link.hasAttribute(OPT_OUT_ATTR)) return false;

    // Links that open in a new tab/window must behave normally.
    var target = link.getAttribute('target');
    if (target && target.toLowerCase() === '_blank') return false;

    // Download links must trigger the browser's download behaviour.
    if (link.hasAttribute('download')) return false;

    // rel="external" is a common convention for "treat as external link".
    var rel = (link.getAttribute('rel') || '').toLowerCase();
    if (rel.indexOf('external') !== -1) return false;

    var href = link.getAttribute('href') || '';

    // Ignore empty hrefs, "#" only links, mailto:, tel:, javascript:, etc.
    if (
      href === '' ||
      href.charAt(0) === '#' ||
      href.indexOf('mailto:') === 0 ||
      href.indexOf('tel:') === 0 ||
      href.indexOf('javascript:') === 0 ||
      href.indexOf('sms:') === 0 ||
      href.indexOf('blob:') === 0 ||
      href.indexOf('data:') === 0
    ) {
      return false;
    }

    // Only handle links on the SAME ORIGIN (protocol + host + port).
    // link.origin is automatically resolved by the browser to an absolute
    // value, even if the href in the HTML was relative.
    if (link.origin !== window.location.origin) return false;

    // Try to guess "download-like" file links by extension and skip them,
    // since downloading a PDF/zip etc. should use normal browser behaviour
    // (and would not work correctly if fetched as text/HTML anyway).
    var path = link.pathname || '';
    var downloadLikeExtensions = [
      '.pdf', '.zip', '.rar', '.7z', '.tar', '.gz',
      '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.mp3', '.mp4', '.mov', '.avi', '.wav', '.ogg',
      '.exe', '.dmg', '.apk', '.iso',
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'
    ];
    for (var i = 0; i < downloadLikeExtensions.length; i++) {
      if (path.toLowerCase().lastIndexOf(downloadLikeExtensions[i]) ===
          path.length - downloadLikeExtensions[i].length) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get a normalized cache key for a URL: same-origin URL without the
   * hash/fragment (since the fragment doesn't change the page content we
   * need to fetch).
   *
   * @param {string} url
   * @returns {string}
   */
  function getCacheKey(url) {
    var u = new URL(url, window.location.href);
    return u.origin + u.pathname + u.search;
  }

  // --------------------------------------------------------------------
  // CORE: Fetching and parsing pages
  // --------------------------------------------------------------------

  /**
   * Fetch a page's HTML, extract the new <title> and the content
   * container's innerHTML, and store the result in pageCache.
   *
   * If a fetch for this URL is already in progress, returns the existing
   * promise instead of starting a duplicate request.
   *
   * @param {string} url - Absolute or relative URL to fetch.
   * @returns {Promise<{title: string, html: string}|null>}
   *          Resolves with the cached page data, or null on failure.
   */
  function fetchPage(url) {
    var cacheKey = getCacheKey(url);

    // Return cached result immediately if we already have it.
    if (pageCache.has(cacheKey)) {
      return Promise.resolve(pageCache.get(cacheKey));
    }

    // If already fetching this URL, reuse that in-flight request.
    if (inFlightFetches.has(cacheKey)) {
      return inFlightFetches.get(cacheKey);
    }

    var fetchPromise = fetch(cacheKey, {
      // "same-origin" ensures cookies are sent for same-site requests,
      // matching normal navigation behaviour.
      credentials: 'same-origin',
      // Let the browser/cache decide freshness; avoids re-downloading
      // unchanged pages on repeat visits across page loads.
      cache: 'default'
    })
      .then(function (response) {
        // Only treat genuinely successful HTML responses as valid.
        if (!response.ok) {
          throw new Error('Network response was not OK: ' + response.status);
        }
        var contentType = response.headers.get('Content-Type') || '';
        if (contentType.indexOf('text/html') === -1 &&
            contentType.indexOf('application/xhtml+xml') === -1) {
          // Not an HTML page (could be an API endpoint, JSON, etc.) —
          // don't try to use it as a page replacement.
          throw new Error('Response is not HTML: ' + contentType);
        }
        return response.text();
      })
      .then(function (html) {
        // Parse the fetched HTML string into a Document we can query.
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');

        var newContentEl = doc.querySelector(CONTENT_SELECTOR);
        var newTitleEl = doc.querySelector(TITLE_SELECTOR);

        if (!newContentEl) {
          // The fetched page doesn't have the expected content container —
          // we can't safely do a partial swap, so signal failure and let
          // the caller fall back to a normal full navigation.
          throw new Error(
            'Content container "' + CONTENT_SELECTOR +
            '" not found in fetched page: ' + cacheKey
          );
        }

        var pageData = {
          title: newTitleEl ? newTitleEl.textContent : document.title,
          html: newContentEl.innerHTML
        };

        // Cache the result for instant reuse later.
        pageCache.set(cacheKey, pageData);

        return pageData;
      })
      .catch(function (err) {
        // Log for debugging; calling code treats null as "fetch failed".
        console.warn('[instant-nav] Failed to fetch/parse page:', cacheKey, err);
        return null;
      })
      .finally(function () {
        // Remove from in-flight map regardless of success/failure so
        // future requests for this URL can retry if needed.
        inFlightFetches.delete(cacheKey);
      });

    inFlightFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  // --------------------------------------------------------------------
  // CORE: Swapping page content
  // --------------------------------------------------------------------

  /**
   * Replace the current page's content container with new HTML, update the
   * document title, and re-execute any <script> tags found inside the new
   * content so page-specific JavaScript runs again.
   *
   * @param {{title: string, html: string}} pageData
   */
  function applyPageContent(pageData) {
    var contentEl = document.querySelector(CONTENT_SELECTOR);
    if (!contentEl) {
      console.warn('[instant-nav] Current page has no "' + CONTENT_SELECTOR + '" element.');
      return;
    }

    // 1. Update the document title (controls browser tab text).
    if (pageData.title) {
      document.title = pageData.title;
    }

    // 2. Replace the content container's HTML with the new page's content.
    contentEl.innerHTML = pageData.html;

    // 3. Re-execute any <script> tags inside the new content.
    //
    // IMPORTANT: When you set innerHTML, any <script> tags inside the new
    // markup are inserted into the DOM but are NOT executed by the browser
    // (this is a security/spec behaviour). To make page-specific scripts
    // run again, we find each <script> tag, create a brand-new <script>
    // element with the same attributes/content, and swap it in. Newly
    // created <script> elements inserted via appendChild/replaceChild DO
    // execute.
    var oldScripts = contentEl.querySelectorAll('script');
    oldScripts.forEach(function (oldScript) {
      var newScript = document.createElement('script');

      // Copy over all attributes (e.g. src, type, defer, async, data-*).
      for (var i = 0; i < oldScript.attributes.length; i++) {
        var attr = oldScript.attributes[i];
        newScript.setAttribute(attr.name, attr.value);
      }

      // Copy inline script content (for scripts without a src attribute).
      newScript.textContent = oldScript.textContent;

      // Replace the inert old script with the new, executable one.
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });

    // 4. Fire a custom event so any global listeners (analytics, etc.) can
    // react to the "page" having changed, similar to a route-change event
    // in an SPA framework.
    document.dispatchEvent(new CustomEvent('instant-nav:page-loaded', {
      detail: { title: document.title, url: window.location.href }
    }));
  }

  // --------------------------------------------------------------------
  // CORE: Navigation orchestration
  // --------------------------------------------------------------------

  /**
   * Perform an instant navigation to the given URL:
   *  - Fetch (or read from cache) the target page.
   *  - On success: swap content, update history, manage scroll.
   *  - On failure: fall back to a normal full-page navigation so the user
   *    is never stuck.
   *
   * @param {string} url - The destination URL (same-origin).
   * @param {Object} [options]
   * @param {boolean} [options.replace=false] - Use replaceState instead of
   *        pushState (used for popstate handling, never for normal clicks).
   * @param {boolean} [options.isPopState=false] - True if this navigation
   *        is the result of the user pressing back/forward.
   * @param {number} [options.historyId] - The unique id tied to the target
   *        history entry, used to restore scroll position correctly.
   */
  function navigateTo(url, options) {
    options = options || {};

    var targetUrl = new URL(url, window.location.href);
    var cacheKey = getCacheKey(targetUrl.href);

    // Before navigating away, remember the CURRENT scroll position, keyed
    // by the CURRENT history entry's id, so we can restore it later if the
    // user comes back to this page via the back button.
    if (!options.isPopState) {
      var currentState = window.history.state;
      if (currentState && typeof currentState.__instantNavId !== 'undefined') {
        scrollPositions.set(currentState.__instantNavId, {
          x: window.scrollX,
          y: window.scrollY
        });
      }
    }

    fetchPage(cacheKey).then(function (pageData) {
      if (!pageData) {
        // Fetch failed or page structure didn't match — fall back to a
        // real browser navigation so the user still reaches the page.
        window.location.href = targetUrl.href;
        return;
      }

      // Swap in the new content and re-run its scripts.
      applyPageContent(pageData);

      // --- History management ---
      if (options.isPopState) {
        // For back/forward navigation, the History API has already
        // updated window.location for us; we don't call pushState again.
        // We just restore scroll position for this entry, if we have it.
        var saved = scrollPositions.get(options.historyId);
        if (saved) {
          window.scrollTo(saved.x, saved.y);
        } else {
          // No saved position (e.g. first time visiting this URL via
          // back/forward) — default to top of page.
          window.scrollTo(0, 0);
        }
      } else {
        // Normal forward navigation (link click or programmatic call).
        historyIdCounter += 1;
        var newState = { __instantNavId: historyIdCounter };

        if (options.replace) {
          window.history.replaceState(newState, pageData.title, targetUrl.href);
        } else {
          window.history.pushState(newState, pageData.title, targetUrl.href);
        }

        // Scroll handling for normal navigation:
        // - If the URL has a hash, try to scroll to that element.
        // - Otherwise, scroll to the top, like a fresh page load.
        if (targetUrl.hash) {
          var target = document.getElementById(targetUrl.hash.slice(1));
          if (target) {
            target.scrollIntoView();
          } else {
            window.scrollTo(0, 0);
          }
        } else {
          window.scrollTo(0, 0);
        }
      }
    });
  }

  // --------------------------------------------------------------------
  // EVENT HANDLING: Clicks on internal links
  // --------------------------------------------------------------------

  /**
   * Global click handler (event delegation). We listen on `document`
   * rather than attaching a handler to every <a>, so links added to the
   * page later (e.g. after a navigation swap) are automatically handled
   * without re-binding anything.
   */
  document.addEventListener('click', function (event) {
    // Ignore clicks that aren't a plain left-click (let the browser handle
    // ctrl/cmd/shift/middle-click for "open in new tab" etc.).
    if (
      event.defaultPrevented ||
      event.button !== 0 ||      // not left click
      event.metaKey ||           // Cmd (Mac) — open in new tab
      event.ctrlKey ||           // Ctrl (Win/Linux) — open in new tab
      event.shiftKey ||          // Shift — open in new window
      event.altKey                // Alt — sometimes triggers download
    ) {
      return;
    }

    // Find the nearest enclosing <a> element (the click might have landed
    // on a child element like a <span> or <img> inside the link).
    var link = event.target.closest ? event.target.closest('a') : null;
    if (!link) return;

    if (!isInstantNavLink(link)) return;

    // Don't intercept if the link points to the exact current URL with the
    // same hash — let the browser handle in-page anchor jumps normally if
    // there's no path change at all.
    var targetUrl = new URL(link.href, window.location.href);
    var currentUrl = new URL(window.location.href);

    var isSamePage =
      targetUrl.origin === currentUrl.origin &&
      targetUrl.pathname === currentUrl.pathname &&
      targetUrl.search === currentUrl.search;

    if (isSamePage && targetUrl.hash) {
      // Same page, different hash only — let the browser do its native
      // smooth-scroll-to-anchor behaviour; no need to refetch anything.
      return;
    }

    // Prevent the default browser navigation (this is what stops the tab
    // spinner and full reload from happening).
    event.preventDefault();

    navigateTo(targetUrl.href, { replace: false, isPopState: false });
  });

  // --------------------------------------------------------------------
  // EVENT HANDLING: Browser Back / Forward buttons
  // --------------------------------------------------------------------

  /**
   * The "popstate" event fires when the user navigates via the browser's
   * back/forward buttons (or programmatic history.back()/forward()) for
   * history entries we created with pushState/replaceState.
   *
   * At the point this fires, window.location already reflects the new
   * URL — we just need to load and swap in that page's content.
   */
  window.addEventListener('popstate', function (event) {
    var state = event.state;

    // If there's no state (e.g. the very first page load, before any
    // pushState call), there's nothing for us to do — the browser will
    // have already shown whatever was originally loaded at this URL.
    if (!state || typeof state.__instantNavId === 'undefined') {
      return;
    }

    navigateTo(window.location.href, {
      isPopState: true,
      historyId: state.__instantNavId
    });
  });

  // --------------------------------------------------------------------
  // INITIAL HISTORY STATE
  // --------------------------------------------------------------------

  /**
   * Tag the initial page load's history entry with an id too, so that if
   * the user navigates away and then comes back to THIS first page via
   * the back button, we can still restore its scroll position correctly.
   * We use replaceState so we don't create an extra history entry.
   */
  (function tagInitialHistoryState() {
    historyIdCounter += 1;
    var state = window.history.state || {};
    state.__instantNavId = historyIdCounter;
    window.history.replaceState(state, document.title, window.location.href);
  })();

  // --------------------------------------------------------------------
  // PREFETCHING: On hover / focus
  // --------------------------------------------------------------------

  // Tracks hover timers per link so we can cancel them if the user moves
  // the mouse away before the delay elapses.
  var hoverTimers = new WeakMap();

  function schedulePrefetchOnHover(link) {
    if (hoverTimers.has(link)) return; // already scheduled

    var timerId = window.setTimeout(function () {
      hoverTimers.delete(link);
      fetchPage(link.href);
    }, HOVER_PREFETCH_DELAY);

    hoverTimers.set(link, timerId);
  }

  function cancelPrefetchOnHover(link) {
    var timerId = hoverTimers.get(link);
    if (timerId) {
      window.clearTimeout(timerId);
      hoverTimers.delete(link);
    }
  }

  // Mouse users: prefetch shortly after hover starts.
  document.addEventListener('mouseover', function (event) {
    var link = event.target.closest ? event.target.closest('a') : null;
    if (!link || !isInstantNavLink(link)) return;
    schedulePrefetchOnHover(link);
  });

  document.addEventListener('mouseout', function (event) {
    var link = event.target.closest ? event.target.closest('a') : null;
    if (!link || !isInstantNavLink(link)) return;
    cancelPrefetchOnHover(link);
  });

  // Keyboard users: prefetch when a link receives focus (e.g. via Tab key).
  // 'focusin' bubbles, unlike 'focus', so it works with delegation.
  document.addEventListener('focusin', function (event) {
    var link = event.target.closest ? event.target.closest('a') : null;
    if (!link || !isInstantNavLink(link)) return;
    fetchPage(link.href);
  });

  // Touch users: prefetch as soon as a finger touches a link, which
  // typically happens slightly before the "click"/navigation fires.
  document.addEventListener('touchstart', function (event) {
    var link = event.target.closest ? event.target.closest('a') : null;
    if (!link || !isInstantNavLink(link)) return;
    fetchPage(link.href);
  }, { passive: true });

  // --------------------------------------------------------------------
  // PREFETCHING: When links scroll into view
  // --------------------------------------------------------------------

  /**
   * Use IntersectionObserver to prefetch internal links as soon as they
   * become visible in the viewport (similar to how some SPA frameworks
   * prefetch linked routes). This spreads out network requests over time
   * as the user scrolls, rather than all at once on page load.
   */
  if ('IntersectionObserver' in window) {
    var linkObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var link = entry.target;
          fetchPage(link.href);
          // Once prefetched, no need to keep observing this link.
          observer.unobserve(link);
        }
      });
    }, {
      // Start prefetching a bit before the link is fully on-screen.
      rootMargin: '200px 0px'
    });

    /**
     * Find all eligible internal links currently in the DOM and observe
     * them for visibility-based prefetching.
     */
    function observeLinksForPrefetch() {
      var links = document.querySelectorAll('a[href]');
      links.forEach(function (link) {
        if (isInstantNavLink(link)) {
          linkObserver.observe(link);
        }
      });
    }

    // Observe links present at initial page load.
    observeLinksForPrefetch();

    // Re-observe links whenever new content is swapped in after a
    // navigation, since the content container's children are replaced.
    document.addEventListener('instant-nav:page-loaded', observeLinksForPrefetch);
  }

})();
