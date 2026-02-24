<?php
function getUserIP() {
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        return $_SERVER['HTTP_CF_CONNECTING_IP']; // Cloudflare real IP
    }
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
        return $_SERVER['HTTP_CLIENT_IP'];
    }
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        return explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0];
    }
    return $_SERVER['REMOTE_ADDR'];
}

$ip = getUserIP();

// Get location/ISP data server-side
$geo = @json_decode(file_get_contents("https://ipapi.co/{$ip}/json/"));

$country = $geo->country_name ?? "Unavailable";
$city = $geo->city ?? "";
$org = $geo->org ?? "Unavailable";
$hostname = gethostbyaddr($ip) ?: "Unavailable";
?>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Privacy Transparency Demo | Ituze Bonheur</title>
<style>
body {
    background: black;
    color: #00ff00;
    font-family: monospace;
    padding: 40px;
}
table {
    width: 100%;
    border-collapse: collapse;
}
td {
    padding: 8px;
    border-bottom: 1px solid #003300;
}
.label {
    font-weight: bold;
    width: 220px;
}
</style>
</head>
<body>

<h1>🔎 What This Website Can See</h1>
<p>This is a cybersecurity awareness demo. No data is stored.</p>

<table id="infoTable">
<tr><td class="label">Date / Time</td><td><?php echo date("r"); ?></td></tr>
<tr><td class="label">IP Address</td><td><?php echo htmlspecialchars($ip); ?></td></tr>
<tr><td class="label">Country / Location</td><td><?php echo "$country $city"; ?></td></tr>
<tr><td class="label">Host Name</td><td><?php echo htmlspecialchars($hostname); ?></td></tr>
<tr><td class="label">ISP</td><td><?php echo htmlspecialchars($org); ?></td></tr>
<tr><td class="label">Referring URL</td><td><?php echo $_SERVER['HTTP_REFERER'] ?? "Direct Visit"; ?></td></tr>
</table>

<script>
function detectAdBlock() {
    return new Promise(resolve => {
        const ad = document.createElement("div");
        ad.className = "adsbox";
        document.body.appendChild(ad);
        setTimeout(() => {
            resolve(ad.offsetHeight === 0);
            ad.remove();
        }, 100);
    });
}

function getGPU() {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    if (!gl) return "Unavailable";
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "Unavailable";
}

function getOS() {
    const ua = navigator.userAgent;
    if (ua.includes("Windows")) return "Windows";
    if (ua.includes("Mac OS")) return "MacOS";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("Linux")) return "Linux";
    if (ua.includes("like Mac")) return "iOS";
    return "Unknown";
}

(async function() {
    const table = document.getElementById("infoTable");
    const adBlocked = await detectAdBlock();

    const clientData = {
        "Orientation": screen.orientation?.type || "Unknown",
        "Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
        "User Time": new Date().toLocaleTimeString(),
        "Language": navigator.language,
        "Incognito / Private Window": "Detection Limited",
        "Ad Blocker": adBlocked ? "Detected" : "Not Detected",
        "Screen Size": `${screen.width} x ${screen.height}`,
        "Colour Scheme": window.matchMedia('(prefers-color-scheme: dark)').matches ? "Dark" : "Light",
        "HDR Screen": window.matchMedia('(dynamic-range: high)').matches ? "Yes" : "No",
        "GPU": getGPU(),
        "Browser": navigator.userAgent,
        "Operating System": getOS(),
        "Touch Screen": navigator.maxTouchPoints > 0 ? "Yes" : "No",
        "User Agent": navigator.userAgent,
        "Platform": navigator.platform
    };

    for (let key in clientData) {
        const row = document.createElement("tr");
        row.innerHTML = `<td class="label">${key}</td><td>${clientData[key]}</td>`;
        table.appendChild(row);
    }
})();
</script>

</body>
</html>
