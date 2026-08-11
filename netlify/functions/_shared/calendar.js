const FIXTURE_FIELDS = ["opponent", "date", "time", "dateMode", "competition", "venue"];

export function parseCalendar(ics) {
  const unfolded = String(ics).replace(/\r?\n[ \t]/g, "");
  if (!unfolded.includes("BEGIN:VCALENDAR")) throw new Error("The TV calendar response is not a calendar");
  const events = [...unfolded.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)\r?\nEND:VEVENT/g)].map(match => parseEvent(match[1])).filter(Boolean);
  if (events.length > 100) throw new Error("The TV calendar contains too many fixtures");
  return events;
}

function parseEvent(block) {
  const summary = unescapeIcs(property(block, "SUMMARY")).replace(/^[^A-Za-z0-9]+/u, "").trim();
  const match = summary.match(/^(.+?)\s+v\s+(.+?)\s+-\s+(.+)$/i);
  const starts = property(block, "DTSTART").match(/(\d{8})T(\d{4})/);
  const uid = unescapeIcs(property(block, "UID")).trim();
  if (!match || !starts || !uid) return null;

  const home = cleanTeam(match[1]);
  const away = cleanTeam(match[2]);
  const homeIsNewcastle = isNewcastle(home);
  const awayIsNewcastle = isNewcastle(away);
  if (homeIsNewcastle === awayIsNewcastle) return null;

  const dateText = starts[1];
  const timeText = starts[2];
  return {
    uid,
    defaults: {
      opponent: homeIsNewcastle ? away : home,
      date: `${dateText.slice(0, 4)}-${dateText.slice(4, 6)}-${dateText.slice(6, 8)}`,
      time: `${timeText.slice(0, 2)}:${timeText.slice(2, 4)}`,
      dateMode: "exact",
      competition: competitionKey(unescapeIcs(match[3]).trim()),
      venue: homeIsNewcastle ? "home" : "away"
    }
  };
}

export function mergeCalendarData(current = {}, events = [], now = new Date()) {
  const currentFixtures = Array.isArray(current.fixtures) ? current.fixtures : [];
  const ignored = new Set(Array.isArray(current.ignoredCalendarUids) ? current.ignoredCalendarUids : []);
  const matchedIds = new Set();
  const imported = [];

  for (const event of events) {
    if (ignored.has(event.uid)) continue;
    const existing = currentFixtures.find(fixture => fixture.calendarUid === event.uid)
      || currentFixtures.find(fixture => !matchedIds.has(fixture.id) && sameFixture(fixture, event.defaults))
      || currentFixtures.find(fixture => !matchedIds.has(fixture.id) && samePlayingWindow(fixture, event.defaults))
      || currentFixtures.find(fixture => !matchedIds.has(fixture.id) && sameOpponentFixture(fixture, event.defaults));
    if (existing) matchedIds.add(existing.id);
    const overrides = existing?.manualOverrides && typeof existing.manualOverrides === "object" ? existing.manualOverrides : {};
    imported.push({
      id: existing?.id || calendarId(event.uid),
      ...event.defaults,
      ...pickOverrides(overrides),
      hidden: Boolean(existing?.hidden),
      pinned: Boolean(existing?.pinned),
      source: "calendar",
      calendarUid: event.uid,
      calendarDefaults: event.defaults,
      manualOverrides: pickOverrides(overrides)
    });
  }

  const manual = currentFixtures.filter(fixture => !fixture.calendarUid && !matchedIds.has(fixture.id));
  const fixtures = [...manual, ...imported].sort(compareFixtures);
  if (fixtures.filter(fixture => fixture.pinned).length > 1) {
    let keptPin = false;
    for (const fixture of fixtures) {
      if (!fixture.pinned) continue;
      if (keptPin) fixture.pinned = false;
      keptPin = true;
    }
  }
  return {
    fixtures,
    ignoredCalendarUids: [...ignored],
    updatedAt: now.toISOString(),
    calendar: { provider: "Live Football On TV", lastSyncedAt: now.toISOString(), imported: imported.length }
  };
}

export function applyAdminUpdate(current = {}, fixtures = [], now = new Date()) {
  const existingFixtures = Array.isArray(current.fixtures) ? current.fixtures : [];
  const existingById = new Map(existingFixtures.map(fixture => [fixture.id, fixture]));
  const submittedIds = new Set(fixtures.map(fixture => fixture.id));
  const ignored = new Set(Array.isArray(current.ignoredCalendarUids) ? current.ignoredCalendarUids : []);

  for (const existing of existingFixtures) {
    if (existing.calendarUid && !submittedIds.has(existing.id)) ignored.add(existing.calendarUid);
  }

  const updated = fixtures.map(fixture => {
    const existing = existingById.get(fixture.id);
    if (!existing?.calendarUid) return fixture;
    const defaults = existing.calendarDefaults || pickFixtureFields(existing);
    const manualOverrides = {};
    for (const field of FIXTURE_FIELDS) {
      if (fixture[field] !== defaults[field]) manualOverrides[field] = fixture[field];
    }
    return {
      ...fixture,
      source: "calendar",
      calendarUid: existing.calendarUid,
      calendarDefaults: defaults,
      manualOverrides
    };
  });

  return {
    ...current,
    fixtures: updated,
    ignoredCalendarUids: [...ignored],
    updatedAt: now.toISOString()
  };
}

function property(block, name) {
  const line = block.split(/\r?\n/).find(value => value.startsWith(`${name}:`) || value.startsWith(`${name};`));
  return line ? line.slice(line.indexOf(":") + 1) : "";
}

function unescapeIcs(value) {
  return String(value).replace(/\\[nN]/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function cleanTeam(value) {
  return String(value).trim().replace(/\s+/g, " ");
}

function isNewcastle(value) {
  return normaliseTeam(value) === "newcastle";
}

function normaliseTeam(value) {
  return cleanTeam(value).toLowerCase().replace(/\b(?:afc|fc)\b/g, "").replace(/\bunited\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function competitionKey(value) {
  const name = value.toLowerCase();
  if (name.includes("premier league")) return "premier-league";
  if (name.includes("champions league")) return "champions-league";
  if (name.includes("europa league")) return "europa-league";
  if (name.includes("conference league")) return "conference-league";
  if (name.includes("fa cup")) return "fa-cup";
  if (name.includes("carabao") || name.includes("league cup") || name.includes("efl cup")) return "league-cup";
  if (name.includes("uefa super cup")) return "uefa-super-cup";
  if (name.includes("club world cup")) return "club-world-cup";
  if (name === "efl" || name.includes("football league")) return "efl";
  return "other";
}

function sameFixture(fixture, defaults) {
  return fixture.date === defaults.date
    && (fixture.time || "") === defaults.time
    && fixture.venue === defaults.venue;
}

function sameOpponentFixture(fixture, defaults) {
  return fixture.venue === defaults.venue
    && fixture.competition === defaults.competition
    && normaliseTeam(fixture.opponent) === normaliseTeam(defaults.opponent)
    && Math.abs(new Date(`${fixture.date}T12:00:00Z`) - new Date(`${defaults.date}T12:00:00Z`)) <= 14 * 24 * 60 * 60 * 1000;
}

function samePlayingWindow(fixture, defaults) {
  if (fixture.dateMode !== "window"
    || fixture.competition !== defaults.competition
    || normaliseTeam(fixture.opponent) !== normaliseTeam(defaults.opponent)) return false;
  const starts = new Date(`${fixture.date}T00:00:00Z`);
  const ends = new Date(starts);
  ends.setUTCDate(ends.getUTCDate() + 7);
  const confirmed = new Date(`${defaults.date}T12:00:00Z`);
  return confirmed >= starts && confirmed < ends;
}

function calendarId(uid) {
  return `lfotv:${uid}`.slice(0, 80);
}

function pickFixtureFields(fixture) {
  return Object.fromEntries(FIXTURE_FIELDS.map(field => [field, fixture[field]]));
}

function pickOverrides(value) {
  return Object.fromEntries(FIXTURE_FIELDS.filter(field => Object.hasOwn(value, field)).map(field => [field, value[field]]));
}

function compareFixtures(a, b) {
  return `${a.date || ""}${a.time || "23:59"}`.localeCompare(`${b.date || ""}${b.time || "23:59"}`);
}
