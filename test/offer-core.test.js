import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_OFFER, formatOfferFixture, formatOfferPrice, getOfferState, selectOfferFixture } from "../offer-core.js";

const fixture = {
  id: "liv",
  opponent: "Liverpool",
  venue: "home",
  date: "2026-08-23",
  time: "16:30",
  competition: "premier-league",
  hidden: false
};

test("offer starts and stops at the exact configured local times", () => {
  assert.equal(getOfferState([fixture], DEFAULT_OFFER, new Date("2026-08-23T14:44:59+01:00")).mode, "normal");
  assert.equal(getOfferState([fixture], DEFAULT_OFFER, new Date("2026-08-23T14:45:00+01:00")).mode, "active");
  assert.equal(getOfferState([fixture], DEFAULT_OFFER, new Date("2026-08-23T19:59:59+01:00")).mode, "active");
  assert.equal(getOfferState([fixture], DEFAULT_OFFER, new Date("2026-08-23T20:00:00+01:00")).mode, "normal");
});

test("hidden, window and TBC fixtures cannot activate the offer", () => {
  const now = new Date("2026-08-23T16:30:00+01:00");
  assert.equal(selectOfferFixture([{ ...fixture, hidden: true }], DEFAULT_OFFER, now).active, null);
  assert.equal(selectOfferFixture([{ ...fixture, dateMode: "window" }], DEFAULT_OFFER, now).active, null);
  assert.equal(selectOfferFixture([{ ...fixture, time: "" }], DEFAULT_OFFER, now).active, null);
});

test("the next confirmed fixture is selected chronologically", () => {
  const later = { ...fixture, id: "later", opponent: "Leeds United", date: "2026-09-14", time: "20:00" };
  const selected = selectOfferFixture([later, fixture], DEFAULT_OFFER, new Date("2026-08-21T12:00:00+01:00"));
  assert.equal(selected.next.id, "liv");
});

test("away fixtures use the display name philosophy", () => {
  const formatted = formatOfferFixture({ ...fixture, venue: "away", opponent: "Tottenham Hotspur" });
  assert.equal(formatted.teams, "TOTTENHAM V NEWCASTLE");
});

test("the displayed price follows the selected logo name", () => {
  const offer = {
    ...DEFAULT_OFFER,
    price: "£4",
    drinkName: "Old name",
    selectedLogoId: "pravha",
    logos: [
      ...DEFAULT_OFFER.logos,
      { id: "pravha", name: "Pravha", src: "/assets/drinks/pravha.png" }
    ]
  };
  assert.equal(formatOfferPrice(offer), "PRAVHA £4");
});
