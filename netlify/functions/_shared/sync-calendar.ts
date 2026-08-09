import type { Context } from "@netlify/functions";
import { mergeCalendarData, parseCalendar } from "./calendar.js";
import { getFixtureStore } from "./store.ts";

const EMPTY = { fixtures: [], updatedAt: null };

export async function syncCalendar(context?: Context) {
  const calendarUrl = Netlify.env.get("LIVE_FOOTBALL_TV_CALENDAR_URL");
  if (!calendarUrl) throw new Error("TV calendar is not configured");

  const response = await fetch(calendarUrl, {
    headers: { Accept: "text/calendar" },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error("TV calendar could not be reached");
  const text = await response.text();
  if (text.length > 500_000) throw new Error("TV calendar response is too large");

  const events = parseCalendar(text);
  if (!events.length) throw new Error("TV calendar contained no Newcastle fixtures; keeping the last good copy");
  const store = getFixtureStore(context);
  const current = (await store.get("current", { type: "json" })) || EMPTY;
  const saved = mergeCalendarData(current, events);
  await store.setJSON("current", saved);
  return saved;
}
