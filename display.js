import { FALLBACK_DATA, fetchWithTimeout, renderScreen } from "./fixture-core.js";

const CACHE_KEY = "two-pennies-fixtures-v1";
const REFRESH_INTERVAL = 15 * 60 * 1000;
const target = document.querySelector("#display");
const connection = document.querySelector("#connection");
let latestData;
let renderedSignature = null;
let waitingForFirstFixtureData;
let refreshPending = false;

function readCache() {
  try {
    const data = JSON.parse(localStorage.getItem(CACHE_KEY));
    return isFixtureData(data) ? data : null;
  } catch { return null; }
}

function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

function isFixtureData(data) {
  return Boolean(data && typeof data === "object" && Array.isArray(data.fixtures));
}

function fixtureSignature(data) {
  return JSON.stringify(data.fixtures || []);
}

function draw(data, { allowVisible = false, force = false } = {}) {
  const signature = fixtureSignature(data);
  if (!force && signature === renderedSignature) return;
  if (!allowVisible && !document.hidden && renderedSignature !== null) return;
  renderScreen(target, data);
  renderedSignature = signature;
}

async function refresh() {
  if (refreshPending) return;
  refreshPending = true;
  let data;
  try {
    const response = await fetchWithTimeout("/api/fixtures");
    if (!response.ok) throw new Error("Fixture service unavailable");
    data = await response.json();
    if (!isFixtureData(data)) throw new Error("Invalid fixture data");
    writeCache(data);
    connection.hidden = true;
  } catch {
    data = latestData || readCache() || FALLBACK_DATA;
    connection.hidden = !(data.fixtures || []).length;
  }
  try {
    latestData = data;
    const firstFixtureData = waitingForFirstFixtureData && (data.fixtures || []).length > 0;
    if (firstFixtureData) waitingForFirstFixtureData = false;
    draw(data, { allowVisible: firstFixtureData });
  } finally {
    refreshPending = false;
  }
}

latestData = readCache() || FALLBACK_DATA;
waitingForFirstFixtureData = !(latestData.fixtures || []).length;
draw(latestData, { allowVisible: true });
refresh();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;
  draw(latestData, { allowVisible: true, force: true });
  refresh();
});
setInterval(refresh, REFRESH_INTERVAL);
