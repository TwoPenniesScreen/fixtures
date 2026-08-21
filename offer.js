import { DEFAULT_OFFER, fitOfferCanvas, getOfferState, normaliseOffer, renderOfferScreen } from "./offer-core.js";

const frame = document.querySelector("#offer-frame");
const screen = document.querySelector("#offer-screen");
let fixtures = [];
let offer = normaliseOffer(DEFAULT_OFFER);
let lastSignature = "";

fitOfferCanvas(screen, frame);
renderOfferScreen(screen, fixtures, offer, new Date());

async function refresh() {
  const [fixtureResult, offerResult] = await Promise.allSettled([
    fetch("/api/fixtures", { cache: "no-store" }).then(response => {
      if (!response.ok) throw new Error("Fixture request failed");
      return response.json();
    }),
    fetch("/api/fixtures?action=offer-public", { cache: "no-store" }).then(response => {
      if (!response.ok) throw new Error("Offer request failed");
      return response.json();
    })
  ]);

  if (fixtureResult.status === "fulfilled" && Array.isArray(fixtureResult.value.fixtures)) {
    fixtures = fixtureResult.value.fixtures;
  }
  if (offerResult.status === "fulfilled") offer = normaliseOffer(offerResult.value);
  paint(true);
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
