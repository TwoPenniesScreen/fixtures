import { FALLBACK_DATA, renderScreen } from "./fixture-core.js";

const CACHE_KEY = "two-pennies-fixtures-v1";
const target = document.querySelector("#display");
const connection = document.querySelector("#connection");

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
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
  renderScreen(target, data);
}

renderScreen(target, readCache() || FALLBACK_DATA);
refresh();
setInterval(refresh, 60_000);
