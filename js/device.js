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
      autoSend: false
    },

    init(options = {}) {
      this.config = { ...this.config, ...options };

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
          fetch("https://api.ipify.org?format=json").then(r => r.json()).catch(() => null),
          fetch("https://api6.ipify.org?format=json").then(r => r.json()).catch(() => null),
          fetch("https://ipapi.co/json/").then(r => r.json()).catch(() => null)
        ]);

        if (v4) data.ipv4 = v4.ip;
        if (v6) data.ipv6 = v6.ip;

        if (geo) {
          data.isp = geo.org;
          data.geo = `${geo.city}, ${geo.country_name}`;
        }
      } catch {}

      return data;
    },

    getHardware() {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl");

      let gpu = "Unknown";

      if (gl) {
        const debug = gl.getExtension("WEBGL_debug_renderer_info");
        gpu = debug
          ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
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
        const b = await navigator.getBattery();
        return {
          level: Math.round(b.level * 100),
          charging: b.charging
        };
      } catch {
        return null;
      }
    },

    async getLocation() {
      return new Promise(resolve => {
        if (!navigator.geolocation) return resolve(null);

        navigator.geolocation.getCurrentPosition(
          pos => resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          }),
          () => resolve(null),
          { timeout: 5000 }
        );
      });
    },

    async collect() {
      const [network, hardware, battery, location] = await Promise.all([
        this.getNetwork(),
        this.getHardware(),
        this.getBattery(),
        this.getLocation()
      ]);

      return {
        userAgent: navigator.userAgent,
        os: this.getOS(),
        language: navigator.language,
        screen: {
          width: screen.width,
          height: screen.height,
          pixelRatio: devicePixelRatio
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        cookies: navigator.cookieEnabled,
        hardware,
        network,
        battery,
        location,
        referrer: document.referrer || "Direct"
      };
    },

    async send() {
      if (!this.config.endpoint) {
        console.warn("No endpoint defined.");
        return;
      }

      const data = await this.collect();

      try {
        await fetch(this.config.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
      } catch (e) {
        console.warn("Send failed", e);
      }

      if (this.config.redirect) {
        window.location.href = this.config.redirect;
      }
    }
  };

  // expose globally
  global.DeviceTracker = DeviceTracker;

})(window);
