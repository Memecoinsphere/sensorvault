/* Sensor Vault — static PWA (web conversion of a SwiftUI settings panel).
 *
 * IMPORTANT: Everything in this panel is COSMETIC ONLY.
 * Toggles/fields persist in localStorage but have NO real device effect.
 * No network calls (CSP connect-src 'none'), no analytics, no tracking.
 */

// ===== PASSCODE (change here) =====
const PASSCODE = "6767";
// ==================================

const STORAGE_KEY = "sensorvault.policy.v1";

/* COSMETIC ONLY — these do NOT block any hardware sensor. Checklist only. */
const DEFAULTS = { accelerometer: false, gyroscope: false, location: false, microphone: false, camera: false };
const IDS = Object.keys(DEFAULTS);

function loadSettings() {
  try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) }; }
  catch { return { ...DEFAULTS }; }
}
function saveSettings(s) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} }

function renderPanel() {
  const s = loadSettings();
  for (const id of IDS) document.getElementById(id).checked = !!s[id];
  document.getElementById("savedNote").textContent = "";
}

function initPanel() {
  document.getElementById("saveBtn").addEventListener("click", () => {
    const s = {};
    for (const id of IDS) s[id] = document.getElementById(id).checked;
    saveSettings(s);
    document.getElementById("savedNote").textContent = "Policy saved";
  });
}

const decoyEl = document.getElementById("decoy");
const lockEl = document.getElementById("lock");
const panelEl = document.getElementById("panel");
const dotsEl = document.getElementById("dots");
const errorEl = document.getElementById("lockError");
const keypadEl = document.getElementById("keypad");
const lockPanelBtn = document.getElementById("lockPanelBtn");
const decoyTimeEl = document.getElementById("decoyTime");
const decoyDateEl = document.getElementById("decoyDate");

let entered = "";
let view = "decoy"; // decoy | lock | panel

/* ---------- SettingsStore (UserDefaults → localStorage) ---------- */
function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(settings) {
  // Cosmetic only — persisted for UI state, no real device effect.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota / private mode */
  }
}

function applyTogglesToUI(settings) {
  for (const id of TOGGLE_IDS) {
    const el = document.getElementById(id);
    if (el) el.checked = !!settings[id];
  }
}

function bindToggles() {
  for (const id of TOGGLE_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("change", () => {
      const settings = loadSettings();
      settings[id] = el.checked;
      saveSettings(settings);
    });
  }
}

/* ---------- Views ---------- */
function show(name) {
  view = name;
  decoyEl.hidden = name !== "decoy";
  lockEl.hidden = name !== "lock";
  panelEl.hidden = name !== "panel";
  decoyEl.setAttribute("aria-hidden", name === "decoy" ? "false" : "true");
  if (name === "lock") {
    entered = "";
    updateDots();
    errorEl.hidden = true;
  }
  if (name === "panel") {
    renderPanel();
  }
}

function updateDots() {
  const dots = dotsEl.querySelectorAll(".dot");
  dots.forEach((d, i) => {
    d.classList.toggle("filled", i < entered.length);
  });
}

function onDigit(d) {
  if (view !== "lock" || entered.length >= 4) return;
  errorEl.hidden = true;
  entered += d;
  updateDots();
  if (entered.length === 4) {
    if (entered === PASSCODE) {
      show("panel");
    } else {
      errorEl.hidden = false;
      entered = "";
      setTimeout(updateDots, 180);
    }
  }
}

function onDelete() {
  if (view !== "lock" || !entered.length) return;
  entered = entered.slice(0, -1);
  errorEl.hidden = true;
  updateDots();
}

keypadEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-k]");
  if (!btn) return;
  const k = btn.getAttribute("data-k");
  if (k === "del") onDelete();
  else onDigit(k);
});

lockPanelBtn.addEventListener("click", () => {
  show("decoy");
});

/* ---------- Hidden gesture: double-tap in top ~15% strip ---------- */
const TOP_STRIP_RATIO = 0.15;
const DOUBLE_TAP_MS = 350;
let lastTopTapAt = 0;

function isTopStrip(clientY) {
  const h = window.innerHeight || document.documentElement.clientHeight;
  return clientY <= h * TOP_STRIP_RATIO;
}

function onPointerDown(e) {
  if (view !== "decoy") return;
  // Prefer primary pointer; ignore multi-touch extras.
  if (typeof e.button === "number" && e.button !== 0) return;
  const y = e.clientY;
  if (!isTopStrip(y)) {
    lastTopTapAt = 0;
    return;
  }
  const now = performance.now();
  if (lastTopTapAt && now - lastTopTapAt <= DOUBLE_TAP_MS) {
    lastTopTapAt = 0;
    show("lock");
  } else {
    lastTopTapAt = now;
  }
}

// Use pointerdown so it works for mouse (headless) and touch.
decoyEl.addEventListener("pointerdown", onPointerDown, { passive: true });

/* ---------- Decoy clock ---------- */
const FR_DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const FR_MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function pad2(n) { return String(n).padStart(2, "0"); }

function tickClock() {
  const now = new Date();
  decoyTimeEl.textContent = pad2(now.getHours()) + ":" + pad2(now.getMinutes());
  decoyDateEl.textContent =
    FR_DAYS[now.getDay()] + " " + now.getDate() + " " + FR_MONTHS[now.getMonth()];
}

tickClock();
setInterval(tickClock, 15000);

/* ---------- Boot ---------- */
initPanel();
show("decoy");

/* PWA service worker (app-shell only, same-origin) */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  });
}
