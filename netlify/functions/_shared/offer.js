export const DEFAULT_OFFER = Object.freeze({
  enabled: true,
  price: "£4",
  drinkName: "Madri",
  terms: "EVERY TELEVISED TOON GAME",
  beforeMinutes: 105,
  afterMinutes: 210,
  selectedLogoId: "madri",
  logos: [{ id: "madri", name: "Madri", src: "/assets/drinks/madri.png" }],
  updatedAt: null
});

export function normaliseOffer(value = {}) {
  const logos = Array.isArray(value.logos) ? value.logos.map(normaliseLogo).filter(Boolean).slice(0, 12) : [];
  const usableLogos = logos.length ? logos : DEFAULT_OFFER.logos.map(logo => ({ ...logo }));
  const selected = usableLogos.some(logo => logo.id === value.selectedLogoId) ? value.selectedLogoId : usableLogos[0].id;
  return {
    enabled: value.enabled !== false,
    price: clean(value.price, DEFAULT_OFFER.price, 12),
    drinkName: clean(value.drinkName, DEFAULT_OFFER.drinkName, 60),
    terms: clean(value.terms, DEFAULT_OFFER.terms, 80),
    beforeMinutes: boundedNumber(value.beforeMinutes, DEFAULT_OFFER.beforeMinutes, 0, 720),
    afterMinutes: boundedNumber(value.afterMinutes, DEFAULT_OFFER.afterMinutes, 0, 720),
    selectedLogoId: selected,
    logos: usableLogos,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null
  };
}

export function validateOffer(value) {
  if (!value || typeof value !== "object") throw new Error("Invalid offer settings");
  const normalised = normaliseOffer(value);
  if (!normalised.price || !normalised.drinkName || !normalised.terms) throw new Error("Offer wording cannot be blank");
  if (!normalised.logos.length) throw new Error("At least one drink logo is required");
  return { ...normalised, updatedAt: new Date().toISOString() };
}

export function publicOffer(value) {
  const offer = normaliseOffer(value);
  const logo = offer.logos.find(item => item.id === offer.selectedLogoId) || offer.logos[0];
  return { ...offer, logos: logo ? [logo] : [] };
}

function normaliseLogo(value) {
  if (!value || typeof value !== "object") return null;
  const id = clean(value.id, "", 60).replace(/[^a-z0-9_-]/gi, "");
  const name = clean(value.name, "", 60);
  const src = clean(value.src, "", 1_100_000);
  const local = /^\/assets\/drinks\/[a-z0-9._-]+$/i.test(src);
  const embedded = /^data:image\/(?:png|webp|jpeg);base64,[a-z0-9+/=]+$/i.test(src) && src.length <= 1_100_000;
  const asset = /^\/\.netlify\/images\?url=%2Fapi%2Ffixtures/i.test(src);
  return id && name && (local || embedded || asset) ? { id, name, src, ...(asset && typeof value.originalSrc === "string" ? { originalSrc: clean(value.originalSrc, "", 500), assetId: clean(value.assetId, "", 80) } : {}) } : null;
}

function clean(value, fallback, max) {
  const text = String(value ?? fallback).trim();
  return text.slice(0, max);
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}
