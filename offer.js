import { DEFAULT_OFFER, fitOfferCanvas, getOfferState, normaliseOffer, renderOfferScreen } from "./offer-core.js";
import { fetchWithTimeout } from "./fixture-core.js";

const CACHE_KEY = "two-pennies-offer-display-v1";
const frame = document.querySelector("#offer-frame");
const screen = document.querySelector("#offer-screen");
const cached = readCache();
let fixtures = cached?.fixtures?.fixtures || [];
let offer = normaliseOffer(cached?.offer || DEFAULT_OFFER);
let lastSignature = "";
let refreshPending = false;

fitOfferCanvas(screen, frame);
renderOfferScreen(screen, fixtures, offer, new Date());

async function refresh() {
  if (refreshPending) return;
  refreshPending = true;
  try {
    const response = await fetchWithTimeout("/api/fixtures?action=display-public");
    if (!response.ok) throw new Error("Display request failed");
    const data = await response.json();
    if (!isDisplayData(data)) throw new Error("Invalid display data");
    fixtures = data.fixtures.fixtures;
    offer = normaliseOffer(data.offer);
    writeCache(data);
  } catch {
    // Keep the last successful in-memory or locally cached display state.
  } finally {
    refreshPending = false;
  }
  paint(true);
}

function readCache() {
  try {
    const data = JSON.parse(localStorage.getItem(CACHE_KEY));
    return isDisplayData(data) ? data : null;
  } catch { return null; }
}

function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

function isDisplayData(data) {
  return Boolean(
    data && typeof data === "object" &&
    data.fixtures && typeof data.fixtures === "object" && Array.isArray(data.fixtures.fixtures) &&
    data.offer && typeof data.offer === "object" && !Array.isArray(data.offer) && Array.isArray(data.offer.logos)
  );
}

function paint(force = false) {
  const now = new Date();
  const state = getOfferState(fixtures, offer, now);
  const signature = JSON.stringify({ mode: state.mode, fixture: state.fixture?.id || "", offer });
  if (force || signature !== lastSignature) {
    renderOfferScreen(screen, fixtures, offer, now);
    lastSignature = signature;
  }
}

refresh();
setInterval(() => paint(), 1_000);
setInterval(refresh, 5 * 60_000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refresh();
});
