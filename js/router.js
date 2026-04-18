/**
 * SPA Router for ituzebonheur.com
 */

class SPARouter {
    constructor(routes) {
        this.routes = routes;
        this.cache = {};
        this.appContainer = document.querySelector("#app");
        this.loadingTimeout = null;
        this.abortController = null;

        this._init();
    }

    _init() {
        this._createLoadingBar();
        document.addEventListener("click", this._handleLinkClick.bind(this));
        window.addEventListener("popstate", this._route.bind(this));
        window.addEventListener("DOMContentLoaded", () => {
            const redirectPath = sessionStorage.getItem('redirect');
            if (redirectPath) {
                sessionStorage.removeItem('redirect');
                history.replaceState(null, null, redirectPath);
            }
            this._route();
        });
        window.navigateTo = this.navigateTo.bind(this);
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
                newScript.async = false; // Ensure sequential execution if needed
            } else {
                newScript.textContent = script.textContent;
            }
            document.head.appendChild(newScript).remove(); // Append to head, execute, and remove
        });
    }

    async _route() {
        // Cancel any ongoing fetch
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();

        const path = location.pathname;
        let match = this.routes.find(r => r.path === path);

        if (!match) {
            if (path === "/" || path.endsWith("index.html")) {
                match = this.routes[0];
            } else {
                this.appContainer.innerHTML = "<h1>404 - Page Not Found</h1>";
                return;
            }
        }
        
        // Don't re-render the same page if content is already there
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

            // Trigger analytics
            if (typeof ga === 'function') {
                ga('send', 'pageview', path);
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Fetch aborted');
                return;
            }
            console.error("Routing error:", error);
            this.appContainer.innerHTML = `<h1>Error Loading Page</h1><p>${navigator.onLine ? "Please try again later." : "You are offline."}</p>`;
        } finally {
            clearTimeout(this.loadingTimeout);
            this._hideLoading();
        }
    }

    navigateTo(url) {
        history.pushState(null, null, url);
        this._route();
    }

    _handleLinkClick(e) {
        const link = e.target.closest("a");
        if (link && link.href.startsWith(window.location.origin)) {
            const path = link.getAttribute("href");
            if (path.includes('.') && !path.endsWith('.html')) return;
            e.preventDefault();
            this.navigateTo(path);
        }
    }
}

const routes = [
    { path: "/", file: "index.html" },
    { path: "/games", file: "games.html" },
    { path: "/hunter", file: "hunter.html" },
    { path: "/codeviewer", file: "codeviewer.html" },
    { path: "/feedback", file: "feedback.html" },
    { path: "/performance", file: "performance.html" },
    { path: "/qrcode", file: "qrcode.html" },
    { path: "/search", file: "search.html" },
    { path: "/what", file: "what.html" }
];

new SPARouter(routes);
