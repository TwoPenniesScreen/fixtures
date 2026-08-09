import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const EMPTY = { fixtures: [], updatedAt: null };
const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

export default async (req: Request) => {
  const store = getStore({ name: "fixtures", consistency: "strong" });
  if (req.method === "GET") return json((await store.get("current", { type: "json" })) || EMPTY);
  if (req.method !== "PUT") return json({ error: "Method not allowed" }, 405);

  const expected = Netlify.env.get("ADMIN_PASSWORD");
  const supplied = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || supplied !== expected) return json({ error: "Unauthorised" }, 401);
  try {
    const body = await req.json() as { fixtures?: unknown[] };
    if (!Array.isArray(body.fixtures) || body.fixtures.length > 100) return json({ error: "Invalid fixture data" }, 400);
    const fixtures = body.fixtures.map(validateFixture);
    if (fixtures.filter(f => f.pinned).length > 1) return json({ error: "Only one fixture can be pinned" }, 400);
    const saved = { fixtures, updatedAt: new Date().toISOString() };
    await store.setJSON("current", saved);
    return json(saved);
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400); }
};

function validateFixture(value: any) {
  if (!value || typeof value !== "object") throw new Error("Invalid fixture");
  const text = (key: string, max = 80) => { const v = String(value[key] || "").trim(); if (v.length > max) throw new Error(`${key} is too long`); return v; };
  const id = text("id", 80), opponent = text("opponent"), date = text("date", 10), time = text("time", 5), competition = text("competition", 40) || "other";
  if (!id || !opponent || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (time && !/^\d{2}:\d{2}$/.test(time))) throw new Error("A fixture is missing required information");
  return { id, opponent, date, time, competition, venue: value.venue === "away" ? "away" : "home", hidden: Boolean(value.hidden), pinned: Boolean(value.pinned) };
}

export const config: Config = { path: "/api/fixtures" };
