import type { Config, Context } from "@netlify/functions";
import { applyAdminUpdate, normaliseCompetitionKey, normaliseFixtureData } from "./_shared/calendar.js";
import { syncCalendar } from "./_shared/sync-calendar.ts";
import { getFixtureStore } from "./_shared/store.ts";
import { DEFAULT_OFFER, normaliseOffer, publicOffer, validateOffer } from "./_shared/offer.js";

const EMPTY = { fixtures: [], updatedAt: null };
const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const publicHeaders = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Netlify-CDN-Cache-Control": "public, durable, max-age=60, must-revalidate"
};
const SESSION_COOKIE = "fixtures_admin";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...headers, ...extraHeaders } });

export default async (req: Request, context: Context) => {
  const store = getFixtureStore(context);
  const action = new URL(req.url).searchParams.get("action");
  if (req.method === "GET" && action === "display-public") {
    const [fixtureData, offerData] = await Promise.all([
      store.get("current", { type: "json" }),
      store.get("offer", { type: "json" })
    ]);
    return json({
      fixtures: normaliseFixtureData(fixtureData || EMPTY),
      offer: publicOffer(offerData || DEFAULT_OFFER)
    }, 200, publicHeaders);
  }
  if (req.method === "GET" && action === "offer-public") return json(publicOffer((await store.get("offer", { type: "json" })) || DEFAULT_OFFER), 200, publicHeaders);
  if (req.method === "GET" && !action) return json(normaliseFixtureData((await store.get("current", { type: "json" })) || EMPTY), 200, publicHeaders);

  const expected = Netlify.env.get("ADMIN_PASSWORD");
  if (req.method === "DELETE") return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
  const supplied = req.headers.get("x-admin-password") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const cookieAuthorised = expected ? await verifySession(readCookie(req, SESSION_COOKIE), expected) : false;
  const passwordAuthorised = Boolean(expected && supplied === expected);
  if (!passwordAuthorised && !cookieAuthorised) return json({ error: "Unauthorised" }, 401);
  if (req.method === "GET" && action === "offer") return json(normaliseOffer((await store.get("offer", { type: "json" })) || DEFAULT_OFFER));
  if (req.method === "POST") {
    if (action === "sync") {
      try { return json(await syncCalendar(context)); }
      catch (error) { return json({ error: error instanceof Error ? error.message : "Calendar sync failed" }, 502); }
    }
    const token = await createSession(expected!);
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(token) });
  }
  if (req.method !== "PUT") return json({ error: "Method not allowed" }, 405);
  try {
    if (action === "offer") {
      const savedOffer = validateOffer(await req.json());
      await store.setJSON("offer", savedOffer);
      return json(savedOffer);
    }
    const body = await req.json() as { fixtures?: unknown[] };
    if (!Array.isArray(body.fixtures) || body.fixtures.length > 100) return json({ error: "Invalid fixture data" }, 400);
    const fixtures = body.fixtures.map(validateFixture);
    if (fixtures.filter(f => f.pinned).length > 1) return json({ error: "Only one fixture can be pinned" }, 400);
    const current = (await store.get("current", { type: "json" })) || EMPTY;
    const saved = applyAdminUpdate(current, fixtures);
    await store.setJSON("current", saved);
    return json(saved);
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400); }
};

function validateFixture(value: any) {
  if (!value || typeof value !== "object") throw new Error("Invalid fixture");
  const text = (key: string, max = 80) => { const v = String(value[key] || "").trim(); if (v.length > max) throw new Error(`${key} is too long`); return v; };
  const id = text("id", 80), opponent = text("opponent"), date = text("date", 10), suppliedTime = text("time", 5);
  const competition = normaliseCompetitionKey(text("competition", 40) || "other");
  const dateMode = value.dateMode === "window" ? "window" : "exact";
  const time = dateMode === "window" ? "" : suppliedTime;
  const allowedCompetitions = new Set(["premier-league", "champions-league", "europa-league", "conference-league", "fa-cup", "league-cup", "uefa-super-cup", "club-world-cup", "other"]);
  const parsedDate = new Date(`${date}T00:00:00Z`);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(parsedDate.valueOf()) && parsedDate.toISOString().slice(0, 10) === date;
  if (!id || !opponent || !validDate || (time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) || !allowedCompetitions.has(competition)) throw new Error("A fixture is missing or contains invalid information");
  return { id, opponent, date, time, dateMode, competition, venue: value.venue === "away" ? "away" : "home", hidden: Boolean(value.hidden), pinned: Boolean(value.pinned) };
}

export const config: Config = { path: "/api/fixtures" };

function readCookie(req: Request, name: string) {
  const cookies = req.headers.get("cookie") || "";
  return cookies.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

async function createSession(secret: string) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const signature = await sign(String(expires), secret);
  return `${expires}.${signature}`;
}

async function verifySession(token: string, secret: string) {
  try {
    const [expiresText, signature] = token.split(".");
    const expires = Number(expiresText);
    if (!expiresText || !signature || !Number.isFinite(expires) || expires <= Math.floor(Date.now() / 1000)) return false;
    const key = await signingKey(secret, ["verify"]);
    return crypto.subtle.verify("HMAC", key, fromBase64Url(signature), new TextEncoder().encode(expiresText));
  } catch { return false; }
}

async function sign(value: string, secret: string) {
  const key = await signingKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function signingKey(secret: string, usages: KeyUsage[]) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usages);
}

function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
}

function sessionCookie(token: string) {
  return `${SESSION_COOKIE}=${token}; Path=/api/fixtures; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/api/fixtures; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
