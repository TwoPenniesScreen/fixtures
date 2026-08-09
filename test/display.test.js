import test from "node:test";
import assert from "node:assert/strict";

test("unchanged data does not redraw and updates wait until the slide is hidden", async () => {
  const original = {
    document: globalThis.document,
    fetch: globalThis.fetch,
    localStorage: globalThis.localStorage,
    setInterval: globalThis.setInterval
  };

  let html = "";
  let redraws = 0;
  let poll;
  let pollDelay;
  let currentData = fixtureData("Liverpool");
  const listeners = {};
  const target = {
    get innerHTML() { return html; },
    set innerHTML(value) { html = value; redraws += 1; }
  };
  const connection = { hidden: true };
  const storage = new Map([["two-pennies-fixtures-v1", JSON.stringify(currentData)]]);

  try {
    globalThis.document = {
      hidden: false,
      querySelector: selector => selector === "#display" ? target : connection,
      addEventListener: (name, listener) => { listeners[name] = listener; },
      createElement: () => {
        let value = "";
        return {
          set textContent(text) { value = String(text); },
          get innerHTML() { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
        };
      }
    };
    globalThis.localStorage = {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    };
    globalThis.fetch = async () => ({ ok: true, json: async () => currentData });
    globalThis.setInterval = (callback, delay) => { poll = callback; pollDelay = delay; return 1; };

    await import(`../display.js?test=${Date.now()}`);
    await settle();

    assert.equal(pollDelay, 15 * 60 * 1000);
    assert.equal(redraws, 1);

    currentData = fixtureData("Bournemouth");
    await poll();
    assert.equal(redraws, 1);
    assert.doesNotMatch(html, /BOURNEMOUTH/);

    globalThis.document.hidden = true;
    listeners.visibilitychange();
    await settle();
    assert.equal(redraws, 2);
    assert.match(html, /BOURNEMOUTH/);
  } finally {
    Object.assign(globalThis, original);
  }
});

function fixtureData(opponent) {
  return {
    fixtures: [{
      id: "fixture-1",
      opponent,
      date: "2099-08-23",
      time: "16:30",
      venue: "home",
      competition: "premier-league"
    }]
  };
}

function settle() {
  return new Promise(resolve => setImmediate(resolve));
}
