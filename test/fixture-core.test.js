import test from "node:test";
import assert from "node:assert/strict";

global.document = { createElement: () => ({ textContent:"", get innerHTML(){ return this.textContent; } }) };
const { eligibleFixtures, formatWhen, renderScreen, selectFixtures, tidyName } = await import("../fixture-core.js");
const f = (id, date, time, extra={}) => ({ id, date, time, opponent:id, venue:"home", ...extra });

test("expires a timed fixture 45 minutes after kickoff", () => {
  const fixture = f("one", "2026-08-09", "15:00");
  assert.equal(eligibleFixtures([fixture], new Date("2026-08-09T15:44:59")).length, 1);
  assert.equal(eligibleFixtures([fixture], new Date("2026-08-09T15:45:01")).length, 0);
});
test("keeps TBC fixtures until the end of their date but hides that date on screen", () => {
  const fixture = f("one", "2026-08-09", "");
  assert.equal(eligibleFixtures([fixture], new Date("2026-08-09T22:00:00")).length, 1);
  assert.equal(formatWhen(fixture), "TBC");
});
test("keeps a playing-window fixture through its seven-day window", () => {
  const fixture = f("one", "2026-08-24", "", { dateMode: "window" });
  assert.equal(eligibleFixtures([fixture], new Date("2026-08-30T23:59:59")).length, 1);
  assert.equal(eligibleFixtures([fixture], new Date("2026-08-31T00:00:00")).length, 0);
  assert.equal(formatWhen(fixture), "W/C 24 AUG TBC");
});
test("pin becomes featured and is not duplicated below", () => { const all=[f("a","2026-09-01","15:00"),f("b","2026-09-02","15:00",{pinned:true}),f("c","2026-09-03","15:00")]; const r=selectFixtures(all,new Date("2026-08-01")); assert.equal(r.featured.id,"b"); assert.deepEqual(r.upcoming.map(x=>x.id),["a","c"]); });
test("hidden fixtures are excluded", () => assert.equal(selectFixtures([f("a","2026-09-01","15:00",{hidden:true})],new Date("2026-08-01")).featured,null));
test("tidyName follows the live-score shortening philosophy", () => { assert.equal(tidyName("Newcastle United FC"),"NEWCASTLE"); assert.equal(tidyName("Tottenham Hotspur"),"TOTTENHAM"); });
test("no eligible fixtures renders the televised-games fallback", () => { const target={innerHTML:""}; renderScreen(target,{fixtures:[]},new Date("2026-08-01")); assert.match(target.innerHTML,/EVERY TELEVISED/); assert.match(target.innerHTML,/TOON GAME/); });
test("legacy EFL cache entries use the Carabao Cup artwork", () => { const target={innerHTML:""}; renderScreen(target,{fixtures:[f("one","2026-09-01","15:00",{competition:"efl"})]},new Date("2026-08-01")); assert.match(target.innerHTML,/assets\/competitions\/league-cup\.png/); });
