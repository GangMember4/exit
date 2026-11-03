import "@fontsource/archivo/400.css";
import "@fontsource/archivo/500.css";
import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "@fontsource/archivo/800.css";
import "@fontsource/archivo/800-italic.css";
import "./style.css";

const ROUND_MS = 11000;
const WINDOW_MS = 7200;
const CLIMB_END = 0.74;
const CRASH_END = 0.9;
const PMIN = 0.55;
const PMAX = 5.7;
const VB_W = 600;
const FLOOR = 214;

const line = document.querySelector("#chart-line");
const area = document.querySelector("#chart-area");
const candles = document.querySelector("#candles");
const dot = document.querySelector("#chart-dot");
const halo = document.querySelector("#chart-halo");
const multiplierEl = document.querySelector("#multiplier");
const timerEl = document.querySelector("#timer");
const terminal = document.querySelector("#terminal");
const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

function priceFromU(u) {
  const wobble = Math.sin(u * 46) * 0.045 + Math.sin(u * 19) * 0.07;
  if (u < CLIMB_END) {
    const t = u / CLIMB_END;
    return 1.12 + t * t * 4.05 + wobble;
  }
  if (u < CRASH_END) {
    const t = (u - CLIMB_END) / (CRASH_END - CLIMB_END);
    const peak = 1.12 + 4.05;
    return peak + (0.78 - peak) * Math.pow(t, 0.45) + wobble * 0.25;
  }
  return 1.12;
}

function priceAt(ms) {
  const u = ((ms % ROUND_MS) + ROUND_MS) % ROUND_MS / ROUND_MS;
  return { u, price: priceFromU(u) };
}

function yOf(price) {
  const n = Math.min(1, Math.max(0, (price - PMIN) / (PMAX - PMIN)));
  return 208 - n * 176;
}

function smooth(pts) {
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

function formatMult(price) {
  return `${price.toFixed(2)}x`;
}

function formatTime(seconds) {
  const s = Math.max(0, Math.min(99, seconds));
  return `00:${String(s).padStart(2, "0")}`;
}

let lastCandleDraw = -1000;

function renderFeed(nowMs, animate) {
  const samples = 72;
  const candlesEvery = 3;
  const pts = [];
  const candlePts = [];
  for (let i = 0; i < samples; i += 1) {
    const ms = nowMs - WINDOW_MS + (WINDOW_MS * i) / (samples - 1);
    const { price } = priceAt(ms);
    const x = 16 + ((VB_W - 32) * i) / (samples - 1);
    const y = yOf(price);
    pts.push([x, y]);
    if (i % candlesEvery === 0) candlePts.push({ x, price, ms });
  }

  const d = smooth(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  line.setAttribute("d", d);
  area.setAttribute("d", `${d} L${last[0].toFixed(2)} ${FLOOR} L${first[0].toFixed(2)} ${FLOOR} Z`);
  dot.setAttribute("cx", last[0].toFixed(2));
  dot.setAttribute("cy", last[1].toFixed(2));
  halo.setAttribute("cx", last[0].toFixed(2));
  halo.setAttribute("cy", last[1].toFixed(2));

  const ns = "http://www.w3.org/2000/svg";
  const drawCandles = !animate || nowMs - lastCandleDraw > 140;
  if (drawCandles) {
    lastCandleDraw = nowMs;
    candles.replaceChildren();
  }
  const slot = (VB_W - 32) / samples;
  if (drawCandles) for (let i = 1; i < candlePts.length; i += 1) {
    const prev = priceAt(candlePts[i].ms - 220).price;
    const close = candlePts[i].price;
    const open = prev;
    const wick = Math.abs(close - open) * 0.65 + 0.04;
    const high = Math.max(open, close) + wick;
    const low = Math.min(open, close) - wick * 0.55;
    const up = close >= open;
    const x = candlePts[i].x;
    const bodyTop = yOf(Math.max(open, close));
    const bodyBot = yOf(Math.min(open, close));
    const bodyH = Math.max(1.6, bodyBot - bodyTop);
    const wickEl = document.createElementNS(ns, "line");
    wickEl.setAttribute("x1", x.toFixed(2));
    wickEl.setAttribute("x2", x.toFixed(2));
    wickEl.setAttribute("y1", yOf(high).toFixed(2));
    wickEl.setAttribute("y2", yOf(low).toFixed(2));
    wickEl.setAttribute("stroke", up ? "rgba(255,220,170,0.7)" : "rgba(255,70,70,0.85)");
    wickEl.setAttribute("stroke-width", "1");
    const body = document.createElementNS(ns, "rect");
    body.setAttribute("x", (x - slot * 0.7).toFixed(2));
    body.setAttribute("y", bodyTop.toFixed(2));
    body.setAttribute("width", Math.max(2.2, slot * 1.15).toFixed(2));
    body.setAttribute("height", bodyH.toFixed(2));
    body.setAttribute("rx", "0.6");
    body.setAttribute("fill", up ? "rgba(255,214,120,0.92)" : "#ff2d2d");
    candles.appendChild(wickEl);
    candles.appendChild(body);
  }

  const { u, price } = priceAt(nowMs);
  const crashing = animate && u >= CLIMB_END && u < CRASH_END + 0.04;
  terminal.classList.toggle("is-crashing", crashing);
  line.setAttribute("stroke", crashing ? "#ff1a1a" : "#ff3a3a");
  line.setAttribute("stroke-width", crashing ? "3.1" : "2.3");

  if (animate) {
    multiplierEl.textContent = formatMult(price);
    const remain = 32 - Math.floor(u * 13);
    timerEl.textContent = formatTime(remain);
  } else {
    multiplierEl.textContent = "3.24x";
    timerEl.textContent = "00:32";
  }
}

function renderResting() {
  const series = [1.35, 1.52, 1.46, 1.74, 1.9, 1.82, 2.15, 2.28, 2.1, 2.46, 2.7, 2.58, 2.95, 3.24, 3.55, 3.4, 3.86, 4.2, 3.9, 2.7, 1.55, 1.05];
  const pts = series.map((price, i) => {
    const x = 16 + ((VB_W - 32) * i) / (series.length - 1);
    return [x, yOf(price)];
  });
  const d = smooth(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  line.setAttribute("d", d);
  area.setAttribute("d", `${d} L${last[0].toFixed(2)} ${FLOOR} L${first[0].toFixed(2)} ${FLOOR} Z`);
  dot.setAttribute("cx", last[0].toFixed(2));
  dot.setAttribute("cy", last[1].toFixed(2));
  halo.setAttribute("cx", last[0].toFixed(2));
  halo.setAttribute("cy", last[1].toFixed(2));
  multiplierEl.textContent = "3.24x";
  timerEl.textContent = "00:32";
  terminal.classList.remove("is-crashing");
}

function startChart() {
  if (motion.matches) {
    renderResting();
    return;
  }
  const loop = (now) => {
    renderFeed(now, true);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
startChart();

function parsePos(value) {
  if (!value) return 0.5;
  if (value.endsWith("%")) return parseFloat(value) / 100;
  if (value === "left" || value === "top") return 0;
  if (value === "right" || value === "bottom") return 1;
  return 0.5;
}

function layoutHotspots() {
  const photo = document.querySelector("#scene-photo");
  const img = photo.querySelector("img");
  const layer = document.querySelector("#hotspots");
  const cw = photo.clientWidth;
  const ch = photo.clientHeight;
  if (!cw || !ch) return;
  const pos = getComputedStyle(img).objectPosition.trim().split(/\s+/);
  const px = parsePos(pos[0]);
  const py = parsePos(pos[1] || "50%");
  const scale = Math.max(cw / 1280, ch / 720);
  const w = 1280 * scale;
  const h = 720 * scale;
  layer.style.left = `${(cw - w) * px}px`;
  layer.style.top = `${(ch - h) * py}px`;
  layer.style.width = `${w}px`;
  layer.style.height = `${h}px`;
}

const photo = document.querySelector("#scene-photo");
const photoImg = photo.querySelector("img");
if (photoImg.complete) layoutHotspots();
photoImg.addEventListener("load", layoutHotspots);
new ResizeObserver(layoutHotspots).observe(photo);
window.addEventListener("resize", layoutHotspots);

function detectEthereum() {
  try {
    return window.ethereum ?? null;
  } catch {
    return null;
  }
}

const connectButton = document.querySelector("#connect");
const connectLabel = document.querySelector("#connect-label");
const connectChev = document.querySelector("#connect-chev");
const walletNote = document.querySelector("#wallet-note");

let busy = false;
let connected = null;

function shorten(address) {
  if (!address || address.length < 12) return address || "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function showNote(text) {
  walletNote.hidden = false;
  walletNote.textContent = text;
}

function hideNote() {
  walletNote.hidden = true;
  walletNote.textContent = "";
}

function setConnected(address) {
  connected = address;
  connectButton.classList.add("is-connected");
  connectLabel.textContent = shorten(address);
  connectChev.setAttribute("hidden", "");
  connectButton.title = address;
  connectButton.setAttribute("aria-label", `Wallet connected ${address}`);
}

function setDisconnected() {
  connected = null;
  connectButton.classList.remove("is-connected");
  connectLabel.textContent = "CONNECT WALLET";
  connectChev.removeAttribute("hidden");
  connectButton.title = "";
  connectButton.removeAttribute("aria-label");
}

async function connectWallet() {
  if (busy || connected) return;
  const ethereum = detectEthereum();
  if (!ethereum) {
    showNote("A wallet extension is required.");
    return;
  }
  busy = true;
  connectButton.disabled = true;
  try {
    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    if (accounts && accounts[0]) {
      hideNote();
      setConnected(accounts[0]);
    } else {
      showNote("No account was returned by the wallet.");
    }
  } catch (err) {
    if (err && err.code === 4001) showNote("Connection request was rejected.");
    else showNote("Could not connect to the wallet.");
  } finally {
    busy = false;
    connectButton.disabled = false;
  }
}

async function hydrateWallet() {
  const ethereum = detectEthereum();
  if (!ethereum) return;
  try {
    const accounts = await ethereum.request({ method: "eth_accounts" });
    if (accounts && accounts[0]) setConnected(accounts[0]);
  } catch {
    /* No unlocked account yet. */
  }
  if (typeof ethereum.on === "function") {
    ethereum.on("accountsChanged", (accounts) => {
      if (accounts && accounts[0]) {
        hideNote();
        setConnected(accounts[0]);
      } else {
        setDisconnected();
      }
    });
  }
}

connectButton.addEventListener("click", connectWallet);
hydrateWallet();

const modal = document.querySelector("#modal");
const playButton = document.querySelector("#play");
const gate = document.querySelector("#gate");
const gateError = document.querySelector("#gate-error");
const accessKey = document.querySelector("#access-key");
const modalCard = modal.querySelector(".modal-card");
let lastFocus = null;

function focusable() {
  return [...modalCard.querySelectorAll("button, input, [href], [tabindex]:not([tabindex='-1'])")].filter(
    (el) => !el.hidden && el.offsetParent !== null
  );
}

function openModal() {
  lastFocus = document.activeElement;
  gateError.hidden = true;
  accessKey.value = "";
  modal.hidden = false;
  document.body.classList.add("modal-open");
  accessKey.focus();
}

function closeModal() {
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
}

playButton.addEventListener("click", openModal);

modal.addEventListener("click", (event) => {
  if (event.target.closest("[data-close]")) closeModal();
});

document.addEventListener("keydown", (event) => {
  if (modal.hidden) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeModal();
    return;
  }
  if (event.key !== "Tab") return;
  const items = focusable();
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

gate.addEventListener("submit", (event) => {
  event.preventDefault();
  gateError.hidden = false;
});
