import "@fontsource/archivo/400.css";
import "@fontsource/archivo/500.css";
import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "@fontsource/archivo/800.css";
import "@fontsource/archivo/800-italic.css";
import "./style.css";

const BASE = [
  [12, 156],
  [40, 150],
  [64, 158],
  [92, 142],
  [118, 148],
  [146, 130],
  [174, 136],
  [204, 116],
  [232, 122],
  [260, 104],
  [288, 110],
  [318, 90],
  [346, 98],
  [374, 74],
  [402, 82],
  [428, 58],
  [452, 66],
  [474, 40],
  [496, 28],
  [514, 50],
  [530, 86],
  [544, 68],
  [560, 118],
  [574, 162],
  [588, 196],
];

const FLOOR = 218;
const PEAK = 18;

const line = document.querySelector("#chart-line");
const area = document.querySelector("#chart-area");
const dot = document.querySelector("#chart-dot");
const halo = document.querySelector("#chart-halo");

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

function pointsAt(t) {
  return BASE.map((p, i) => {
    let amp = 1.15;
    if (i < PEAK) amp = 3.5;
    else if (i < PEAK + 3) amp = 1.8;
    const y = p[1] + Math.sin(t * 0.00135 + i * 0.62) * amp;
    return [p[0], y];
  });
}

function renderChart(t) {
  const pts = pointsAt(t);
  const d = smooth(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  line.setAttribute("d", d);
  area.setAttribute("d", `${d} L${last[0].toFixed(2)} ${FLOOR} L${first[0].toFixed(2)} ${FLOOR} Z`);
  dot.setAttribute("cx", last[0].toFixed(2));
  dot.setAttribute("cy", last[1].toFixed(2));
  halo.setAttribute("cx", last[0].toFixed(2));
  halo.setAttribute("cy", last[1].toFixed(2));
}

const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
function startChart() {
  if (motion.matches) {
    renderChart(0);
    return;
  }
  const started = performance.now();
  const loop = (now) => {
    renderChart(now - started);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
startChart();

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
