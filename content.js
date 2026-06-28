// Bloxgen Voice Checker - content script (page bloxgen.net/dashboard/generator)
// - Pulls each account's cookie from the Bloxgen API (/api/accounts/history)
// - Injects a real native-styled button "[mic] Voice" on every history row and on
//   the latest-account card. The mic goes gray -> green (ON) / red (OFF) / orange
//   (dead) and the label updates accordingly.

(() => {
  "use strict";

  const HISTORY_URL =
    "https://api.bloxgen.net/api/accounts/history?page=1&limit=100";

  // Inline mic icon; its color is driven by its own style.color (stroke=currentColor)
  const MIC_SVG =
    '<svg class="bvc-mic-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true">' +
    '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>' +
    '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>' +
    '<line x1="12" y1="19" x2="12" y2="22"/></svg>';

  // --- State ----------------------------------------------------------------
  let cookieMap = {};        // username(lower) -> cookie
  let lastFetch = 0;
  let nativeBtnClass = "";   // className cloned from a native Bloxgen button
  let voiceCache = {};       // username(lower) -> { state, title, extra } (persisted results)

  // --- Result cache (already-checked accounts stay checked) -----------------
  chrome.storage.local.get({ voiceCache: {} }, (v) => {
    voiceCache = v.voiceCache || {};
    applyCacheToAll();
  });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === "local" && ch.voiceCache) {
      voiceCache = ch.voiceCache.newValue || {};
      applyCacheToAll();
    }
  });
  function saveCache(uname, entry) {
    voiceCache[uname] = entry;
    chrome.storage.local.set({ voiceCache });
  }
  function applyCacheTo(el) {
    const c = voiceCache[el.dataset.bvcUser];
    if (c) { applyStatus(el, c.state, c.title, c.extra); return; }
    if (el.classList.contains("bvc-pulse")) return; // don't disturb an in-flight check
    applyStatus(el, "idle");
  }
  function applyCacheToAll() {
    document.querySelectorAll(".bvc-el").forEach(applyCacheTo);
  }

  // Status -> mic color + button label
  const STATES = {
    idle:    { mic: "#9ca3af", label: "Voice" },
    pending: { mic: "#9ca3af", label: "Checking..." },
    on:      { mic: "#10b981", label: "Voice ON" },
    off:     { mic: "#ef4444", label: "Voice OFF" },
    dead:    { mic: "#f97316", label: "Dead cookie" },
    error:   { mic: "#9ca3af", label: "Error" }
  };

  // --- Bloxgen cookies ------------------------------------------------------
  async function refreshHistory() {
    const r = await fetch(HISTORY_URL, { credentials: "include", cache: "no-store" });
    const j = await r.json();
    const map = {};
    const list = (j && j.data && j.data.history) || [];
    for (const a of list) {
      if (a && a.username && a.cookie) map[a.username.toLowerCase()] = a.cookie;
    }
    cookieMap = map;
    lastFetch = Date.now();
  }

  async function getCookie(uname) {
    if (!(uname in cookieMap) || Date.now() - lastFetch > 15000) {
      await refreshHistory();
    }
    return cookieMap[uname];
  }

  // --- Status -> button appearance ------------------------------------------
  function cssEsc(s) { return String(s).replace(/["\\]/g, "\\$&"); }

  function applyStatus(el, state, title, extra) {
    const s = STATES[state] || STATES.idle;
    el.title = title || s.label;
    const svg = el.querySelector(".bvc-mic-svg");
    if (svg) svg.style.color = s.mic;
    const lbl = el.querySelector(".bvc-label");
    if (lbl) lbl.textContent = s.label + (extra ? " · " + extra : "");
    el.classList.toggle("bvc-pulse", state === "pending");
  }

  function setStatus(uname, state, title, extra) {
    document
      .querySelectorAll('[data-bvc-user="' + cssEsc(uname) + '"]')
      .forEach((el) => applyStatus(el, state, title, extra));
  }

  // --- Run a check ----------------------------------------------------------
  async function checkAccount(username) {
    const uname = String(username).toLowerCase();
    setStatus(uname, "pending");
    let cookie;
    try {
      cookie = await getCookie(uname);
    } catch (e) {
      setStatus(uname, "error", "Bloxgen API unreachable");
      return;
    }
    if (!cookie) {
      setStatus(uname, "error", "Cookie not found in history");
      return;
    }
    chrome.runtime.sendMessage({ type: "CHECK_VOICE", cookie }, (res) => {
      if (chrome.runtime.lastError || !res) {
        setStatus(uname, "error", (chrome.runtime.lastError || {}).message || "No response");
        return;
      }
      if (!res.ok) { setStatus(uname, "error", res.error || "Error"); return; }
      if (!res.alive) {
        setStatus(uname, "dead", "Cookie expired/invalid - regenerate");
        saveCache(uname, { state: "dead", title: "Cookie expired/invalid - regenerate", extra: "" });
        return;
      }
      const detail =
        "verified: " + res.verified +
        " | eligible: " + res.eligible +
        " | denialReason: " + res.denialReason +
        (res.ageGroup ? " | age: " + res.ageGroup : "") +
        (res.banned ? " | BANNED" : "");
      const state = res.voiceEnabled ? "on" : "off";
      const extra = res.ageGroup || "";
      setStatus(uname, state, detail, extra);
      saveCache(uname, { state: state, title: detail, extra: extra });
    });
  }

  // --- The button (native style + mic icon + label) -------------------------
  function makeVoiceButton(username) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = (nativeBtnClass || "bvc-fallback") + " bvc-voicebtn bvc-el";
    btn.dataset.bvcUser = String(username).toLowerCase();
    btn.innerHTML = MIC_SVG + '<span class="bvc-label">Voice</span>';
    applyStatus(btn, "idle", "Check Roblox voice chat for " + username);
    applyCacheTo(btn); // show a previously-checked result immediately
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      checkAccount(username);
    });
    return btn;
  }

  // --- Capture a native (neutral) button className to clone its look --------
  function captureNativeClass() {
    if (nativeBtnClass) return;
    const ref = [...document.querySelectorAll("button")].find((b) => {
      const t = b.textContent.trim();
      return t === "Copy Cookie" || t === "Copy Combo";
    });
    if (ref) nativeBtnClass = ref.className;
  }

  // --- Injection ------------------------------------------------------------
  function onGeneratorPage() {
    return /^\/dashboard\/generator/.test(location.pathname);
  }

  // The "Generation History" table specifically — NOT some other table on the page
  // (e.g. the pricing/plans comparison). Identified by its Username + Generated At headers.
  function findHistoryTable() {
    const tables = document.querySelectorAll("table");
    for (const t of tables) {
      const heads = [...t.querySelectorAll("th")].map((th) => th.textContent.trim().toLowerCase());
      if (heads.includes("username") && heads.includes("generated at")) return t;
    }
    return null;
  }

  // Inject a fresh Voice button, OR replace the existing one if it's bound to a
  // different account (React reuses the card/row node when a new alt is generated).
  function ensureVoiceButton(container, username) {
    const existing = container.querySelector(".bvc-el");
    if (existing && existing.dataset.bvcUser === String(username).toLowerCase()) return;
    if (existing) existing.remove();
    container.appendChild(makeVoiceButton(username));
  }

  function injectAll() {
    if (!onGeneratorPage()) return; // SPA: don't inject after navigating away
    captureNativeClass();

    // 1) "Generation History" table -> a Voice button per row
    const table = findHistoryTable();
    if (table) {
      table.querySelectorAll("tbody tr").forEach((row) => {
        if (!row.cells || row.cells.length < 2) return;
        const username = (row.cells[1].textContent || "").trim();
        if (!username) return;
        ensureVoiceButton(row.cells[row.cells.length - 1], username);
      });
    }

    // 2) Latest-generated account card -> a Voice button in the action bar
    const copyBtn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Copy Cookie"
    );
    if (copyBtn) {
      let node = copyBtn, h3 = null, d = 0;
      while (node && d < 8) {
        h3 = node.querySelector ? node.querySelector("h3") : null;
        if (h3) break;
        node = node.parentElement; d++;
      }
      const username = h3 ? h3.textContent.trim() : null;
      const bar = copyBtn.parentElement;
      if (username && bar) ensureVoiceButton(bar, username);
    }
  }

  // --- DOM observation (React re-renders) -----------------------------------
  let pending = null;
  function scheduleInject() {
    if (pending) return;
    pending = setTimeout(() => { pending = null; injectAll(); }, 300);
  }
  new MutationObserver(scheduleInject).observe(document.body, { childList: true, subtree: true });
  injectAll();

  // --- Messages from popup ("Check all visible accounts") -------------------
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "CHECK_ALL") {
      const table = findHistoryTable();
      if (!table) return;
      const names = [];
      table.querySelectorAll("tbody tr").forEach((row) => {
        if (row.cells && row.cells.length >= 2) {
          const u = (row.cells[1].textContent || "").trim();
          if (u) names.push(u);
        }
      });
      names.forEach((u, i) => setTimeout(() => checkAccount(u), i * 150));
    }
  });
})();
