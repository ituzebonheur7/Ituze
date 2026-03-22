var script = document.createElement('script');
script.src = "https://www.googletagmanager.com/gtag/js?id=G-4RPPG857F8";
script.async = true;
document.head.appendChild(script);

window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-4RPPG857F8', { page_referrer: document.referrer });

(async () => {
    const currentUrl = window.location.href;
    
    if (currentUrl.includes("ituze")) {
        try {
            const resGeo = await fetch("https://ipapi.co/json/");
            if (!resGeo.ok) return;
            
            const dataGeo = await resGeo.json();
            
            const payload = {
                city: dataGeo.city || "Unknown",
                country: dataGeo.country_name || "Unknown",
                region: dataGeo.region || "Unknown",
                trigger_url: currentUrl,
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

            console.log("Analytics processed for ituze reference.");

        } catch (error) {
            console.warn("Sync paused.");
        }
    }
})();
