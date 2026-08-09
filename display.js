import { FALLBACK_DATA, renderScreen } from "./fixture-core.js";

const CACHE_KEY = "two-pennies-fixtures-v1";
const REFRESH_INTERVAL = 15 * 60 * 1000;
const target = document.querySelector("#display");
const connection = document.querySelector("#connection");
let latestData;
let renderedSignature = null;
let waitingForFirstFixtureData;

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
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
  let data;
  try {
    const response = await fetch("/api/fixtures", { cache: "no-store" });
    if (!response.ok) throw new Error("Fixture service unavailable");
    data = await response.json();
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    connection.hidden = true;
  } catch {
    data = readCache() || FALLBACK_DATA;
    connection.hidden = !(data.fixtures || []).length;
  }
  latestData = data;
  const firstFixtureData = waitingForFirstFixtureData && (data.fixtures || []).length > 0;
  if (firstFixtureData) waitingForFirstFixtureData = false;
  draw(data, { allowVisible: firstFixtureData });
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
