(function () {
  'use strict';

  var CONTENT_SELECTOR = '#page-content';
  var TITLE_SELECTOR = 'title';
  var OPT_OUT_ATTR = 'data-no-instant';

  var pageCache = new Map();
  var inFlightFetches = new Map();
  var scrollPositions = new Map();
  var historyIdCounter = 0;

  function isInstantNavLink(link) {
    if (!link || !link.href) return false;
    if (link.hasAttribute(OPT_OUT_ATTR)) return false;
    
    var target = link.getAttribute('target');
    if (target && target.toLowerCase() === '_blank') return false;
    if (link.hasAttribute('download')) return false;
    
    var rel = (link.getAttribute('rel') || '').toLowerCase();
    if (rel.indexOf('external') !== -1) return false;
    
    var href = link.getAttribute('href') || '';
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
    
    if (link.origin !== window.location.origin) return false;
    
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

  function getCacheKey(url) {
    var u = new URL(url, window.location.href);
    return u.origin + u.pathname + u.search;
  }

  function fetchPage(url) {
    var cacheKey = getCacheKey(url);

    if (pageCache.has(cacheKey)) {
      return Promise.resolve(pageCache.get(cacheKey));
    }

    if (inFlightFetches.has(cacheKey)) {
      return inFlightFetches.get(cacheKey);
    }

    var fetchPromise = fetch(cacheKey, {
      credentials: 'same-origin',
      cache: 'no-store'
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Network response was not OK: ' + response.status);
        }
        var contentType = response.headers.get('Content-Type') || '';
        if (contentType.indexOf('text/html') === -1 &&
            contentType.indexOf('application/xhtml+xml') === -1) {
          throw new Error('Response is not HTML: ' + contentType);
        }
        return response.text();
      })
      .then(function (html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');

        var newContentEl = doc.querySelector(CONTENT_SELECTOR);
        var newTitleEl = doc.querySelector(TITLE_SELECTOR);

        if (!newContentEl) {
          throw new Error(
            'Content container "' + CONTENT_SELECTOR +
            '" not found in fetched page: ' + cacheKey
          );
        }

        var pageData = {
          title: newTitleEl ? newTitleEl.textContent : document.title,
          html: newContentEl.innerHTML
        };

        pageCache.set(cacheKey, pageData);

        return pageData;
      })
      .catch(function (err) {
        console.error('[instant-nav] Failed to fetch/parse page:', cacheKey, err);
        return null;
      })
      .finally(function () {
        inFlightFetches.delete(cacheKey);
      });

    inFlightFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  function applyPageContent(pageData) {
    var contentEl = document.querySelector(CONTENT_SELECTOR);
    if (!contentEl) {
      return;
    }

    if (pageData.title) {
      document.title = pageData.title;
    }

    contentEl.innerHTML = pageData.html;

    var oldScripts = contentEl.querySelectorAll('script');
    oldScripts.forEach(function (oldScript) {
      var newScript = document.createElement('script');

      for (var i = 0; i < oldScript.attributes.length; i++) {
        var attr = oldScript.attributes[i];
        newScript.setAttribute(attr.name, attr.value);
      }

      newScript.textContent = oldScript.textContent;

      oldScript.parentNode.replaceChild(newScript, oldScript);
    });

    document.dispatchEvent(new CustomEvent('instant-nav:page-loaded', {
      detail: { title: document.title, url: window.location.href }
    }));
  }

  function navigateTo(url, options) {
    options = options || {};

    var targetUrl = new URL(url, window.location.href);
    var cacheKey = getCacheKey(targetUrl.href);

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
        window.location.href = targetUrl.href;
        return;
      }

      applyPageContent(pageData);

      if (options.isPopState) {
        var saved = scrollPositions.get(options.historyId);
        if (saved) {
          window.scrollTo(saved.x, saved.y);
        } else {
          window.scrollTo(0, 0);
        }
      } else {
        historyIdCounter += 1;
        var newState = { __instantNavId: historyIdCounter };

        if (options.replace) {
          window.history.replaceState(newState, pageData.title, targetUrl.href);
        } else {
          window.history.pushState(newState, pageData.title, targetUrl.href);
        }

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

  document.addEventListener('click', function (event) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    var link = event.target.closest ? event.target.closest('a') : null;
    if (!link) return;

    if (!isInstantNavLink(link)) return;

    var targetUrl = new URL(link.href, window.location.href);
    var currentUrl = new URL(window.location.href);

    var isSamePage =
      targetUrl.origin === currentUrl.origin &&
      targetUrl.pathname === currentUrl.pathname &&
      targetUrl.search === currentUrl.search;

    if (isSamePage && targetUrl.hash) {
      return;
    }

    event.preventDefault();

    navigateTo(targetUrl.href, { replace: false, isPopState: false });
  });

  window.addEventListener('popstate', function (event) {
    var state = event.state;

    if (!state || typeof state.__instantNavId === 'undefined') {
      return;
    }

    navigateTo(window.location.href, {
      isPopState: true,
      historyId: state.__instantNavId
    });
  });

  (function tagInitialHistoryState() {
    historyIdCounter += 1;
    var state = window.history.state || {};
    state.__instantNavId = historyIdCounter;
    window.history.replaceState(state, document.title, window.location.href);
  })();

})();
