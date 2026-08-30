import test from "node:test";
import assert from "node:assert/strict";
import { normaliseOffer } from "../netlify/functions/_shared/offer.js";
test("legacy embedded logo remains compatible", () => {
  const offer = normaliseOffer({ logos: [{ id: "old", name: "Old", src: "data:image/png;base64,AA==" }], selectedLogoId: "old" });
  assert.equal(offer.logos[0].src, "data:image/png;base64,AA==");
});
test("new Blob-backed CDN logo retains original fallback metadata", () => {
  const offer = normaliseOffer({ logos: [{ id: "new", name: "New", src: "/.netlify/images?url=%2Fapi%2Ffixtures", originalSrc: "/api/fixtures?action=logo&id=logo-a", assetId: "logo-a" }], selectedLogoId: "new" });
  assert.equal(offer.logos[0].originalSrc, "/api/fixtures?action=logo&id=logo-a");
});
