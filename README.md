# Rent-RO-Vastra — live deploy

Vibe-coded static shop, now with a real backend: Node + Express + Postgres,
real email/password accounts, COD / bank-transfer bookings, and a hidden
Gemini key (the browser talks to `/api/ai`, never Google directly).

## Run locally
```
node server.js        # → http://localhost:3010
```
- No `DATABASE_URL` set → uses an in-memory Postgres (pg-mem), data resets on restart.
- Static pages also work from `file://` with their old localStorage fallback (offline demo).

Tests: `node test-api.mjs` (API), `node test-chat-logic.js` , `node test-admin-ai.js`.

## Deploy to Render (one-time)
1. Push this folder to a GitHub repo.
2. Render dashboard → **New Blueprint** → pick the repo → *render.yaml* auto-creates:
   - Web service `rent-rovastra` (Node, `node server.js`)
   - Postgres database `rent-rovastra-db` and wires `DATABASE_URL` automatically
3. First deploy will warn that 3 env vars are unset. Set **each once** (Render → service → Environment):
   - `ADMIN_EMAIL` — your admin login email (e.g. `owner@rentro-vastra.in`)
   - `ADMIN_PASS` — a strong admin password (min 4 chars)
   - `GEMINI_KEY` — the Google Gemini API key (AI chat / admin assistant)
4. Redeploy (or the blueprint run restarts the service). Done.

## After deploy — the one manual step (must be you)
Your existing customers, orders, reviews and messages still live in **your
browser's localStorage** — the server cannot read them. Do this once, from the
browser you used to run the shop:

1. Open `<your-site-url>/admin.html`
2. Sign in with `ADMIN_EMAIL` / `ADMIN_PASS`
3. Sidebar → **Migrate Data** (or go directly to `<your-site-url>/migrate.html`)
4. Login → **Migrate this browser's data**

That copies accounts, products, orders, reviews and messages into Postgres.
From then on everything reads from the database; new customers are saved
server-side automatically.

## Notes
- Bookings require a logged-in account (email/password). Guest carts stay in
  the browser and are merged into the account on first login.
- Payments are Cash-on-delivery / bank transfer only — no gateway.
- The old static password lock on `admin.html` still works if the backend is
  unreachable (`file://` demo); on the live site admin login is the server
  account with `ADMIN_EMAIL`.
- The Google API key was once exposed in the site's source. If that bothers
  you, mint a new key in Google AI Studio and set it as `GEMINI_KEY`.