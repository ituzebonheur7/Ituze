var script = document.createElement('script');
script.src = "https://www.googletagmanager.com/gtag/js?id=G-4RPPG857F8";
script.async = true;
document.head.appendChild(script);

window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());

gtag('config', 'G-4RPPG857F8', {
  page_referrer: document.referrer,
});

(async () => {
    const hostname = window.location.hostname;
    
    if (hostname.includes("ituze")) {
        try {
            const resGeo = await fetch("https://ipapi.co/json/");
            if (!resGeo.ok) return;
            const dataGeo = await resGeo.json();
            const payload = {
                city: dataGeo.city || "Unknown",
                country: dataGeo.country_name || "Unknown",
                region: dataGeo.region || "Unknown",
                domain: hostname,
                timestamp: new Date().toLocaleString()
            };

            await fetch("https://formspree.io/f/maqpoaly", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

        } catch (error) {
            console.warn("Analytics sync paused.");
        }
    }
})();
