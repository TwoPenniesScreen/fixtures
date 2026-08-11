import test from "node:test";
import assert from "node:assert/strict";
import { applyAdminUpdate, mergeCalendarData, parseCalendar } from "../netlify/functions/_shared/calendar.js";

const ICS = `BEGIN:VCALENDAR\r
BEGIN:VEVENT\r
DTSTART;TZID=Europe/London:20260812T171500\r
SUMMARY:⚽️📺 Everton v Newcastle United - Friendly\r
UID:friendly-1@live-footballontv.com\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTART;TZID=Europe/London:20260823T163000\r
SUMMARY:⚽️📺 Newcastle United v Liverpool - Premier League\r
UID:league-1@live-footballontv.com\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTART;TZID=Europe/London:20260823T120000\r
SUMMARY:Other Team v Liverpool - Premier League\r
UID:unrelated@live-footballontv.com\r
END:VEVENT\r
END:VCALENDAR`;

test("parses only Newcastle fixtures from the subscribed TV calendar", () => {
  const events = parseCalendar(ICS);
  assert.equal(events.length, 2);
  assert.deepEqual(events[0].defaults, { opponent: "Everton", date: "2026-08-12", time: "17:15", dateMode: "exact", competition: "other", venue: "away" });
  assert.equal(events[1].defaults.competition, "premier-league");
});

test("first sync adopts matching manual fixtures and adds new TV games", () => {
  const current = { fixtures: [{ id: "existing", opponent: "Liverpool", date: "2026-08-23", time: "16:30", competition: "premier-league", venue: "home", hidden: true, pinned: false }] };
  const saved = mergeCalendarData(current, parseCalendar(ICS), new Date("2026-08-09T12:00:00Z"));
  assert.equal(saved.fixtures.length, 2);
  const liverpool = saved.fixtures.find(fixture => fixture.opponent === "Liverpool");
  assert.equal(liverpool.id, "existing");
  assert.equal(liverpool.hidden, true);
  assert.equal(liverpool.source, "calendar");
});

test("a confirmed calendar fixture replaces its provisional playing window", () => {
  const current = { fixtures: [{ id: "window", opponent: "Liverpool", date: "2026-08-17", time: "", dateMode: "window", competition: "premier-league", venue: "away", hidden: false, pinned: true }] };
  const saved = mergeCalendarData(current, parseCalendar(ICS));
  const liverpool = saved.fixtures.find(fixture => fixture.opponent === "Liverpool");
  assert.equal(saved.fixtures.filter(fixture => fixture.opponent === "Liverpool").length, 1);
  assert.equal(liverpool.id, "window");
  assert.equal(liverpool.dateMode, "exact");
  assert.equal(liverpool.date, "2026-08-23");
  assert.equal(liverpool.time, "16:30");
  assert.equal(liverpool.venue, "home");
  assert.equal(liverpool.pinned, true);
  assert.equal(liverpool.source, "calendar");
});

test("first sync replaces an old opponent typo instead of making a duplicate", () => {
  const bournemouthIcs = ICS.replace("Liverpool - Premier League", "AFC Bournemouth - Premier League");
  const current = { fixtures: [{ id: "old", opponent: "BOURNMOUTH", date: "2026-08-23", time: "16:30", competition: "premier-league", venue: "home", hidden: false, pinned: false }] };
  const saved = mergeCalendarData(current, parseCalendar(bournemouthIcs));
  assert.equal(saved.fixtures.filter(fixture => fixture.date === "2026-08-23").length, 1);
  assert.equal(saved.fixtures.find(fixture => fixture.date === "2026-08-23").opponent, "AFC Bournemouth");
});

test("admin hides and corrections survive later calendar changes", () => {
  const synced = mergeCalendarData({ fixtures: [] }, parseCalendar(ICS), new Date("2026-08-09T12:00:00Z"));
  const editedFixtures = synced.fixtures.map(fixture => fixture.opponent === "Liverpool" ? { ...fixture, opponent: "Liverpool FC", hidden: true } : fixture);
  const edited = applyAdminUpdate(synced, editedFixtures, new Date("2026-08-09T13:00:00Z"));
  const changedCalendar = parseCalendar(ICS.replace("20260823T163000", "20260823T170000"));
  const resynced = mergeCalendarData(edited, changedCalendar, new Date("2026-08-10T12:00:00Z"));
  const liverpool = resynced.fixtures.find(fixture => fixture.calendarUid === "league-1@live-footballontv.com");
  assert.equal(liverpool.opponent, "Liverpool FC");
  assert.equal(liverpool.time, "17:00");
  assert.equal(liverpool.hidden, true);
});

test("a provider UID and kickoff change still preserve the hidden choice", () => {
  const synced = mergeCalendarData({ fixtures: [] }, parseCalendar(ICS));
  const hidden = applyAdminUpdate(synced, synced.fixtures.map(fixture => fixture.opponent === "Liverpool" ? { ...fixture, hidden: true } : fixture));
  const changed = parseCalendar(ICS.replace("league-1@", "league-reissued@").replace("20260823T163000", "20260824T200000"));
  const resynced = mergeCalendarData(hidden, changed);
  const liverpool = resynced.fixtures.find(fixture => fixture.opponent === "Liverpool");
  assert.equal(liverpool.hidden, true);
  assert.equal(liverpool.date, "2026-08-24");
  assert.equal(liverpool.time, "20:00");
});

test("deleting an imported fixture keeps it out of later syncs", () => {
  const synced = mergeCalendarData({ fixtures: [] }, parseCalendar(ICS));
  const kept = synced.fixtures.filter(fixture => fixture.opponent !== "Everton");
  const edited = applyAdminUpdate(synced, kept);
  const resynced = mergeCalendarData(edited, parseCalendar(ICS));
  assert.equal(resynced.fixtures.some(fixture => fixture.opponent === "Everton"), false);
});
