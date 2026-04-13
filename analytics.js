/**
 * SPA Router for ituzebonheur.com
 */

const router = async () => {
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

    let match = routes.find(r => r.path === location.pathname);

    if (!match) {
        if (location.pathname === "/" || location.pathname.endsWith("index.html")) {
            match = routes[0];
        } else {
            document.querySelector("#app").innerHTML = "<h1>404 - Page Not Found</h1>";
            return;
        }
    }

    if (match.path === "/" && document.querySelector("#app").innerHTML !== "") {
        return;
    }

    try {
        const response = await fetch(match.file);
        const htmlText = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, "text/html");
        const newContent = doc.body.innerHTML;

        const appContainer = document.querySelector("#app");
        appContainer.style.opacity = 0;
        
        setTimeout(() => {
            appContainer.innerHTML = newContent;
            appContainer.style.opacity = 1;
            
            if (doc.title) document.title = doc.title;
        }, 150);

    } catch (error) {
        console.error("Routing error:", error);
        document.querySelector("#app").innerHTML = "<h1>Error loading page</h1>";
    }
};

window.navigateTo = (url) => {
    history.pushState(null, null, url);
    router();
};

document.addEventListener("click", e => {
    const link = e.target.closest("a");
    
    if (link && link.href.startsWith(window.location.origin)) {
        const path = link.getAttribute("href");
        
        if (path.includes('.') && !path.endsWith('.html')) return;

        e.preventDefault();
        navigateTo(path);
    }
});

window.addEventListener("popstate", router);

window.addEventListener("DOMContentLoaded", () => {
    const redirectPath = sessionStorage.getItem('redirect');
    if (redirectPath) {
        sessionStorage.removeItem('redirect');
        history.replaceState(null, null, redirectPath);
    }
    router();
});
