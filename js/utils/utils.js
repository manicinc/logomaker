/**
 * utils.js (Version 4 - Ensure Global Assignment)
 * ==============================================
 * Provides general-purpose utility functions. Ensures global availability via window.Utils.
 */

const Utils = (() => {

  // --- DOM Selectors ---
  function select(selector, required = true) { const el = document.querySelector(selector); if (!el && required) console.error(`[Utils] Element not found: ${selector}`); return el; }
  function selectAll(selector) { return document.querySelectorAll(selector); }
  function on(selector, eventType, handler) { selectAll(selector).forEach(el => el.addEventListener(eventType, handler)); }

  // --- Function Modifiers ---
  function debounce(func, wait = 200) { let timeoutId = null; return function(...args) { clearTimeout(timeoutId); timeoutId = setTimeout(() => { func.apply(this, args); }, wait); }; }
  function throttle(func, interval = 200) { let shouldWait = false; return function(...args) { if (!shouldWait) { func.apply(this, args); shouldWait = true; setTimeout(() => { shouldWait = false; }, interval); } }; }

  // --- Data Handling ---
  function deepCopy(obj) { try { return JSON.parse(JSON.stringify(obj)); } catch (e) { console.error("[Utils] Deep copy failed:", e); return null; } }
  function hexToRGBA(hex, alpha = 1) { if (!hex || typeof hex !== 'string') return null; let c = hex.startsWith('#') ? hex.slice(1) : hex; if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2]; if (c.length !== 6) return null; const r = parseInt(c.substring(0,2),16), g = parseInt(c.substring(2,4),16), b = parseInt(c.substring(4,6),16); if (isNaN(r) || isNaN(g) || isNaN(b)) return null; const validAlpha = Math.max(0, Math.min(1, alpha)); return `rgba(${r},${g},${b},${validAlpha})`; }

  // --- Async ---
  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  // --- File/Export Helpers ---
  function downloadBlob(blob, filename) {
      if (!blob || !(blob instanceof Blob)) { console.error("downloadBlob Error: Invalid Blob."); if (typeof showAlert === 'function') showAlert("Download failed: Invalid data.", "error"); return; }
      if (!filename || typeof filename !== 'string') { filename = 'download.bin'; console.warn("downloadBlob Warning: Missing filename."); }
      try {
          const url = URL.createObjectURL(blob); const a = document.createElement("a");
          a.style.display = "none"; a.href = url; a.download = filename;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 250); console.log(`[Utils] Download triggered: ${filename}`);
      } catch (err) { console.error(`[Utils] downloadBlob failed for ${filename}:`, err); if (typeof showAlert === 'function') showAlert(`Download trigger failed: ${err.message}`, "error"); }
  }

  function getLogoFilenameBase() {
    const logoEl = document.getElementById('logoText'); const logoText = logoEl ? logoEl.value.trim() : 'logo';
    const sanitized = logoText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 40);
    return sanitized || 'logo';
  }

  const publicApi = { select, selectAll, on, debounce, throttle, deepCopy, hexToRGBA, wait, downloadBlob, getLogoFilenameBase };

  // *** Explicitly assign to window for global access ***
  window.Utils = Object.assign(window.Utils || {}, publicApi);

  return publicApi;

})();

// Export for ES Modules (optional if primarily using global)
export const { select, selectAll, on, debounce, throttle, deepCopy, hexToRGBA, wait, downloadBlob, getLogoFilenameBase } = Utils;

console.log("[Utils] Module loaded. Helpers assigned to window.Utils.");