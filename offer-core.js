import { kickoffOf, tidyName } from "./fixture-core.js";

export const DEFAULT_OFFER = Object.freeze({
  enabled: true,
  price: "£4",
  drinkName: "Madri",
  terms: "EVERY TELEVISED TOON GAME",
  beforeMinutes: 105,
  afterMinutes: 210,
  selectedLogoId: "madri",
  logos: [{ id: "madri", name: "Madri", src: "/assets/drinks/madri.png" }]
});

export function normaliseOffer(value = {}) {
  const logos = (Array.isArray(value.logos) && value.logos.length ? value.logos : DEFAULT_OFFER.logos)
    .map(logo => ({ id: String(logo.id || ""), name: String(logo.name || ""), src: String(logo.src || "") }))
    .filter(logo => logo.id && logo.name && logo.src);
  const requestedLogoId = String(value.selectedLogoId || "").trim();
  const selectedLogoId = logos.some(logo => logo.id === requestedLogoId) ? requestedLogoId : logos[0]?.id || "";
  const selectedLogo = logos.find(logo => logo.id === selectedLogoId) || logos[0];
  return {
    enabled: value.enabled !== false,
    price: String(value.price || DEFAULT_OFFER.price).trim(),
    drinkName: String(selectedLogo?.name || value.drinkName || DEFAULT_OFFER.drinkName).trim(),
    terms: String(value.terms || DEFAULT_OFFER.terms).trim(),
    beforeMinutes: finiteNumber(value.beforeMinutes, DEFAULT_OFFER.beforeMinutes),
    afterMinutes: finiteNumber(value.afterMinutes, DEFAULT_OFFER.afterMinutes),
    selectedLogoId,
    logos
  };
}

export function fitOfferCanvas(canvas, frame = canvas?.parentElement) {
  if (!canvas || !frame) return () => {};
  const resize = () => {
    const scale = Math.min(frame.clientWidth / 1920, frame.clientHeight / 1080);
    canvas.style.transform = `scale(${scale})`;
    canvas.style.left = `${(frame.clientWidth - 1920 * scale) / 2}px`;
    canvas.style.top = `${(frame.clientHeight - 1080 * scale) / 2}px`;
  };
  resize();
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(resize);
    observer.observe(frame);
    return () => observer.disconnect();
  }
  window.addEventListener("resize", resize);
  return () => window.removeEventListener("resize", resize);
}

export function selectOfferFixture(fixtures = [], offerValue = DEFAULT_OFFER, nowValue = new Date()) {
  const offer = normaliseOffer(offerValue);
  const now = new Date(nowValue);
  const confirmed = fixtures
    .filter(fixture => !fixture.hidden && fixture.dateMode !== "window" && fixture.date && fixture.time)
    .map(fixture => ({ fixture, kickoff: kickoffOf(fixture) }))
    .filter(item => item.kickoff && !Number.isNaN(item.kickoff.valueOf()))
    .sort((a, b) => a.kickoff - b.kickoff);

  const active = confirmed.find(({ kickoff }) => {
    const start = new Date(kickoff.getTime() - offer.beforeMinutes * 60_000);
    const end = new Date(kickoff.getTime() + offer.afterMinutes * 60_000);
    return now >= start && now < end;
  });
  const next = confirmed.find(({ kickoff }) => kickoff >= now);
  return { active: active?.fixture || null, next: (active || next)?.fixture || null };
}

export function getOfferState(fixtures = [], offerValue = DEFAULT_OFFER, nowValue = new Date()) {
  const offer = normaliseOffer(offerValue);
  const { active, next } = selectOfferFixture(fixtures, offer, nowValue);
  return { offer, mode: !offer.enabled ? "disabled" : active ? "active" : "normal", fixture: active || next };
}

export function formatOfferFixture(fixture) {
  if (!fixture) return null;
  const kickoff = kickoffOf(fixture);
  if (!kickoff) return null;
  const home = fixture.venue === "away" ? tidyName(fixture.opponent) : "Newcastle";
  const away = fixture.venue === "away" ? "Newcastle" : tidyName(fixture.opponent);
  const when = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(kickoff).replace(",", "");
  return { teams: `${home} v ${away}`.toUpperCase(), when: when.toUpperCase() };
}

export function formatOfferPrice(offerValue = DEFAULT_OFFER) {
  const offer = normaliseOffer(offerValue);
  return `${offer.drinkName} ${offer.price}`.trim().toUpperCase();
}

export function renderOfferScreen(target, fixtures = [], offerValue = DEFAULT_OFFER, nowValue = new Date(), forcedMode = "") {
  const state = getOfferState(fixtures, offerValue, nowValue);
  const mode = forcedMode === "active" || forcedMode === "normal" ? forcedMode : state.mode;
  const offer = state.offer;
  const logo = offer.logos.find(item => item.id === offer.selectedLogoId) || offer.logos[0];
  const fixture = formatOfferFixture(state.fixture);

  target.replaceChildren();
  target.classList.toggle("is-disabled", mode === "disabled");
  const logoImg = document.createElement("img");
  logoImg.className = "offer-drink-logo";
  logoImg.alt = logo?.name || offer.drinkName;
  if (logo?.src) logoImg.src = logo.src;
  logoImg.hidden = mode === "disabled" || !logo?.src;
  target.append(logoImg);

  if (mode === "disabled") return state;
  const copy = document.createElement("section");
  copy.className = `offer-copy offer-copy-${mode}`;
  if (mode === "active") {
    copy.innerHTML = `<p class="offer-kicker">MATCHDAY OFFER</p><p class="offer-price"></p><p class="offer-now">ON NOW</p>`;
  } else {
    copy.innerHTML = `<p class="offer-window">2 HOURS BEFORE<br><span>TO</span><br>2 HOURS AFTER</p><p class="offer-price"></p><p class="offer-terms"></p>`;
    copy.querySelector(".offer-terms").textContent = offer.terms;
  }
  copy.querySelector(".offer-price").textContent = formatOfferPrice(offer);
  if (fixture) {
    const details = document.createElement("div");
    details.className = "offer-fixture";
    details.innerHTML = `<p>${mode === "active" ? "TODAY" : "NEXT GAME"}</p><strong></strong><time></time>`;
    details.querySelector("strong").textContent = fixture.teams;
    details.querySelector("time").textContent = fixture.when;
    copy.append(details);
  } else {
    copy.classList.add("without-fixture");
  }
  target.append(copy);
  return state;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
