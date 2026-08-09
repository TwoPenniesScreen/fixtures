# Two Pennies fixtures screen

A fixed 16:9 Newcastle fixture display and private editing page for the Basement screen.

## What it does

- Shows one featured fixture and up to three later fixtures in chronological order.
- A single pinned fixture becomes featured and is removed from the smaller list.
- Timed fixtures remain until 45 minutes after kick-off; TBC fixtures remain through their date.
- Hidden fixtures never appear.
- Falls back to a clean “Every Televised Toon Game” message on the approved Newcastle/Basement background when nothing is eligible.
- Keeps a last-known-good browser copy if the data service is temporarily unavailable.
- Provides password-gated add, edit, delete, hide, pin and live 16:9 preview controls at `/admin`.
- Imports televised Newcastle fixtures from a private Live Football On TV calendar each day, with an on-demand sync button in the admin.
- Keeps imported hide/pin choices and manual corrections when the calendar changes; deleting an imported fixture suppresses it from later syncs.
- Keeps a successful admin login active on that device for 30 days using a signed, secure, HTTP-only cookie; “Lock admin” clears it immediately.
- Maps Premier League, UEFA competitions, FA Cup, Carabao Cup, EFL and Club World Cup selections to white transparent competition marks; `Other` remains a no-logo fallback.

## Netlify setup

1. Connect this repository to a Netlify site. No build command is required; the publish directory is `.`.
2. Add a secret environment variable named `ADMIN_PASSWORD` in Netlify. This protects all fixture changes. Do not put it in this repository.
3. Add the private calendar subscription URL as `LIVE_FOOTBALL_TV_CALENDAR_URL`. Never commit that URL.
4. Deploy, visit `/admin`, enter the password, and select **Sync TV calendar** once. Netlify then refreshes it automatically every day at 04:17 UTC.

Fixture data lives in a strongly consistent, site-scoped Netlify Blobs store and therefore persists across deploys. Public display data is read-only; writes require a valid server-issued admin session.

## Local development

Install dependencies, set `ADMIN_PASSWORD` in a local `.env`, then run `npm run dev`. Run `npm test` for the fixture-selection tests.

## Artwork

The approved clean 1920×1080 Newcastle/Basement artwork is included as the fixed display background. The supplied competition marks are cleaned and stored as individual transparent images without altering the stored fixture data.
