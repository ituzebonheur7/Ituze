/**
 * SPA Router and Controller for ituzebonheur.com
 * Stops browser reloading spinners and handles native navigation.
 */
class SPARouter {
    constructor(routes) {
        this.routes = routes;
        this.cache = {};
        this.appContainer = null; // Will be set safely after DOM loads
        this.loadingTimeout = null;
        this.abortController = null;

        // FIX: The dataset error happened because the script ran before the HTML existed.
        // This guarantees the DOM is fully loaded before the router tries to find "#app".
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', this._init.bind(this));
        } else {
            this._init();
        }
    }

    _init() {
        // Now it is 100% safe to grab the container
        this.appContainer = document.querySelector("#app");

        // Failsafe: If someone deletes <div id="app"> from the HTML, log an error instead of crashing
        if (!this.appContainer) {
            console.error("[SPARouter] Critical Error: <div id='app'> not found in the HTML.");
            return; 
        }

        this._createLoadingBar();
        this._registerServiceWorker(); 
        this._initNetworkMonitoring();
        
        // Intercept clicks to stop the browser spinner
        document.addEventListener("click", this._handleLinkClick.bind(this));
        
        // Handle physical back/forward browser buttons
        window.addEventListener("popstate", this._route.bind(this));
        
        const redirectPath = sessionStorage.getItem('redirect');
        if (redirectPath) {
            sessionStorage.removeItem('redirect');
            history.replaceState(null, null, redirectPath);
        }
        
        window.navigateTo = this.navigateTo.bind(this);
        
        // Trigger the initial page load
        this._route();
    }

    _registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then((registration) => {
                        console.log('[App] Service Worker connected successfully! Scope:', registration.scope);
                    })
                    .catch((error) => console.error('[App] SW failed:', error));
            });
        }
    }

    _initNetworkMonitoring() {
        const handleConnectionChange = () => {
            const isOnline = navigator.onLine;
            console.log('[App] Status:', isOnline ? 'online' : 'offline');

            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'STATUS_CHANGE',
                    status: isOnline ? 'online' : 'offline'
                });
            }
        };

        window.addEventListener('online', handleConnectionChange);
        window.addEventListener('offline', handleConnectionChange);
    }

    _createLoadingBar() {
        this.loadingBar = document.createElement('div');
        this.loadingBar.className = 'loading-bar';
        document.body.appendChild(this.loadingBar);
    }

    _showLoading() {
        this.loadingBar.style.width = '30%';
        this.loadingBar.style.opacity = '1';
    }

    _hideLoading() {
        this.loadingBar.style.width = '100%';
        setTimeout(() => {
            this.loadingBar.style.opacity = '0';
            this.loadingBar.style.width = '0%';
        }, 300);
    }

    _updateActiveLinks(path) {
        document.querySelectorAll('nav a').forEach(link => {
            if (link.getAttribute('href') === path) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    _executeScripts(container) {
        const scripts = container.querySelectorAll("script");
        scripts.forEach(script => {
            const newScript = document.createElement("script");
            if (script.src) {
                newScript.src = script.src;
                newScript.async = false; 
            } else {
                newScript.textContent = script.textContent;
            }
            document.head.appendChild(newScript).remove(); 
        });
    }

    async _route() {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();

        // Normalize the path by removing trailing slashes (e.g., /games/ -> /games)
        let path = location.pathname;
        if (path.length > 1 && path.endsWith('/')) {
            path = path.slice(0, -1);
        }

        let match = this.routes.find(r => r.path === path);

        if (!match) {
            if (path === "/" || path.endsWith("index.html")) {
                match = this.routes[0];
            } else {
                this.appContainer.innerHTML = "<h1>404 - Page Not Found</h1>";
                return;
            }
        }
        
        // Prevent re-rendering if we are already on the requested page
        if (this.appContainer.dataset.currentPage === match.file) {
            return;
        }

        const render = (html) => {
            const doc = new DOMParser().parseFromString(html, "text/html");
            const newContent = doc.body.innerHTML;
            
            this.appContainer.style.opacity = 0;
            setTimeout(() => {
                this.appContainer.innerHTML = newContent;
                this.appContainer.dataset.currentPage = match.file;
                this._executeScripts(this.appContainer);
                this.appContainer.style.opacity = 1;
                if (doc.title) document.title = doc.title;
            }, 150);
        };

        if (this.cache[match.file]) {
            render(this.cache[match.file]);
            this._updateActiveLinks(path);
            return;
        }

        this.loadingTimeout = setTimeout(this._showLoading.bind(this), 200);

        try {
            const response = await fetch(match.file, { signal: this.abortController.signal });
            if (!response.ok) throw new Error(`Failed to fetch ${response.statusText}`);
            
            const htmlText = await response.text();
            this.cache[match.file] = htmlText;

            render(htmlText);
            this._updateActiveLinks(path);

            if (typeof ga === 'function') {
                ga('send', 'pageview', path);
            }

        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error("Routing error:", error);
            
            this.appContainer.innerHTML = `
                <div style="text-align:center; padding: 2rem;">
                    <h1>Error Loading Page</h1>
                    <p>${navigator.onLine ? "Please try again later." : "You are offline. Visited pages will load automatically."}</p>
                </div>
            `;
        } finally {
            clearTimeout(this.loadingTimeout);
            this._hideLoading();
        }
    }

    navigateTo(url) {
        history.pushState(null, null, url);
        this._route();
    }

    // THE SPINNER KILLER: This method determines what happens when any link is clicked
    _handleLinkClick(e) {
        const link = e.target.closest("a");
        if (!link) return;

        // 1. Ignore clicks with modifier keys (Ctrl/Cmd) or links opening in new tabs
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.target === "_blank") {
            return;
        }

        // 2. Ignore mailto: and tel: links
        const rawHref = link.getAttribute('href');
        if (rawHref && (rawHref.startsWith('mailto:') || rawHref.startsWith('tel:'))) {
            return;
        }

        // 3. ONLY intercept links that belong to your exact same domain
        if (link.origin === window.location.origin) {
            
            // Check if the link points to a non-HTML file asset (.pdf, .png, .zip, etc.)
            const pathname = link.pathname;
            const fileExtension = pathname.split('/').pop().split('.')[1]; 
            
            if (fileExtension && fileExtension !== 'html') {
                return; // Let the browser handle standard file downloads naturally
            }

            // 4. STOP THE DEFAULT REFRESH BEHAVIOR. This prevents the browser spinner.
            e.preventDefault();

            // 5. Build the clean URL including any query parameters or hash anchors
            const fullPath = link.pathname + link.search + link.hash;
            this.navigateTo(fullPath);
        }
    }
}

// Route Configurations
// Ensure all file paths start with an absolute slash (/) to prevent fetch errors on nested routes
const routes = [
    { path: "/", file: "/index.html" },
    { path: "/games", file: "/games.html" },
    { path: "/hunter", file: "/hunter.html" },
    { path: "/codeviewer", file: "/codeviewer.html" },
    { path: "/feedback", file: "/feedback.html" },
    { path: "/performance", file: "/performance.html" },
    { path: "/qrcode", file: "/qrcode.html" },
    { path: "/search", file: "/search.html" },
];

// Instantiate application. 
// No DOMContentLoaded wrapper is needed here because the class constructor now handles it natively!
new SPARouter(routes);
