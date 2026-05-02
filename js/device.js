/*!
 * device.js - Lightweight Device & Network Info Collector
 * Author: Ituze Bonheur
 * License: MIT
 */

(function (global) {
  "use strict";

  const DeviceTracker = {
    config: {
      endpoint: null,
      redirect: null,
      redirectDelay: 0,
      autoSend: false
    },

    init(options = {}) {
      this.config = {
        ...this.config,
        ...options
      };

      if (this.config.autoSend && this.config.endpoint) {
        this.send();
      }
    },

    async getNetwork() {
      const data = {
        ipv4: null,
        ipv6: null,
        isp: null,
        geo: null
      };

      try {
        const [v4, v6, geo] = await Promise.all([
          fetch("https://api.ipify.org?format=json")
            .then(r => r.json())
            .catch(() => null),

          fetch("https://api6.ipify.org?format=json")
            .then(r => r.json())
            .catch(() => null),

          fetch("https://ipapi.co/json/")
            .then(r => r.json())
            .catch(() => null)
        ]);

        if (v4) data.ipv4 = v4.ip;
        if (v6) data.ipv6 = v6.ip;

        if (geo) {
          data.isp = geo.org || null;
          data.geo = `${geo.city || "Unknown"}, ${geo.country_name || "Unknown"}`;
        }
      } catch (e) {
        console.warn("Network detection failed");
      }

      return data;
    },

    getHardware() {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl");

      let gpu = "Unknown";

      if (gl) {
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");

        gpu = debugInfo
          ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
          : "Hidden";
      }

      return {
        threads: navigator.hardwareConcurrency || null,
        ram: navigator.deviceMemory || null,
        gpu,
        touch: navigator.maxTouchPoints > 0
      };
    },

    getOS() {
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

      return "Unknown";
    },

    async getBattery() {
      if (!navigator.getBattery) return null;

      try {
        const battery = await navigator.getBattery();

        return {
          level: Math.round(battery.level * 100),
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime
        };
      } catch (e) {
        return null;
      }
    },

    async getLocation() {
      return new Promise(resolve => {
        if (!navigator.geolocation) {
          return resolve(null);
        }

        navigator.geolocation.getCurrentPosition(
          pos => {
            resolve({
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
              accuracy: pos.coords.accuracy
            });
          },
          () => {
            resolve({
              denied: true
            });
          },
          {
            enableHighAccuracy: true,
            timeout: 5000
          }
        );
      });
    },

    getPreferences() {
      return {
        darkMode: window.matchMedia("(prefers-color-scheme: dark)").matches,
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        doNotTrack: navigator.doNotTrack || "Off"
      };
    },

    getStorage() {
      return {
        localStorage: !!window.localStorage,
        sessionStorage: !!window.sessionStorage,
        indexedDB: !!window.indexedDB
      };
    },

    async collect() {
      const [network, hardware, battery, location] = await Promise.all([
        this.getNetwork(),
        Promise.resolve(this.getHardware()),
        this.getBattery(),
        this.getLocation()
      ]);

      return {
        timestamp: new Date().toISOString(),

        userAgent: navigator.userAgent,

        os: this.getOS(),

        language: navigator.language,

        languages: navigator.languages,

        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone,

        cookiesEnabled: navigator.cookieEnabled,

        screen: {
          width: screen.width,
          height: screen.height,
          availWidth: screen.availWidth,
          availHeight: screen.availHeight,
          pixelRatio: window.devicePixelRatio,
          colorDepth: screen.colorDepth,
          orientation:
            screen.orientation?.type || "Unknown"
        },

        hardware,

        network: {
          ...network,
          downlink: navigator.connection?.downlink || null,
          effectiveType:
            navigator.connection?.effectiveType || null,
          rtt: navigator.connection?.rtt || null,
          saveData:
            navigator.connection?.saveData || false
        },

        battery,

        preferences: this.getPreferences(),

        storage: this.getStorage(),

        location,

        referrer: document.referrer || "Direct"
      };
    },

    async send() {
      if (!this.config.endpoint) {
        console.warn("DeviceTracker: No endpoint defined.");
        return;
      }

      const data = await this.collect();

      try {
        await fetch(this.config.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(data)
        });

        console.log("DeviceTracker: Data sent.");
      } catch (e) {
        console.warn("DeviceTracker: Send failed.", e);
      }

      if (this.config.redirect) {
        const delay = this.config.redirectDelay || 0;

        setTimeout(() => {
          window.location.href = this.config.redirect;
        }, delay);
      }
    }
  };
  global.DeviceTracker = DeviceTracker;

})(window);
