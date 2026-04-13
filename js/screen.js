let wakeLock = null;

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) {
    console.log("Wake Lock API not supported.");
    return;
  }

  try {
    wakeLock = await navigator.wakeLock.request("screen");
    console.log("Screen Wake Lock active.");

    wakeLock.addEventListener("release", () => {
      console.log("Screen Wake Lock released.");
    });
  } catch (err) {
    console.error(`Wake Lock error: ${err.name}, ${err.message}`);
  }
}

async function initWakeLock() {
  await requestWakeLock();
}

initWakeLock();

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible") {
    await requestWakeLock();
  }
});

window.addEventListener("focus", async () => {
  await requestWakeLock();
});
