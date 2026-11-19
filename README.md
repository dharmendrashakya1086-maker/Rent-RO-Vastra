# Rent-RO-Vastra — static frontend + incremental backend

The site is a plain HTML/CSS/JS frontend with a backend being added one piece at
a time. **Piece 1 (done): authentication.** Everything else (cart, orders,
messages, admin, AI) is still browser-local and will get its own piece later.

## Run it

No dependencies, no build step, no `npm install` needed — Node.js built-ins only.

```
npm start          # → http://localhost:3010
```

The server also serves the static pages, so clean URLs like `/login`,
`/collection` and `/account` work. Open it at **http://localhost:3010** (use
`localhost`, not `127.0.0.1` — Firebase authorizes `localhost` by default).

Tests: `npm test` (starts the server on a throwaway port and data file).

## Piece 1 — authentication (Firebase)

`auth.html` uses the Firebase Auth client SDK (loaded from CDN, no npm install)
for **Google sign-in** and **email/password**:

- **signup requires a 6-digit email OTP** (Brevo) before the Firebase account is created;
  both the Login and Register tabs also offer **Google sign-in**
- forgot password sends a **real reset link** via Google
- login accepts email (or your username / phone / first name, mapped locally)

After a Firebase sign-in, the browser sends the Firebase ID token to
`POST /api/auth/firebase`. The server verifies it with Google's
`accounts:lookup` endpoint, finds or creates the matching local user, and sets
this site's session cookie (`HttpOnly`, `SameSite=Lax`). No password is ever
stored or sent to our server. Local users/sessions persist in `data/auth.json`
(gitignored).

`firebase-config.json` holds the public Firebase web config — shared by the
browser and the server (the server needs only `apiKey` for token verification).
To deploy, add your production domain in Firebase Console → Authentication →
Settings → Authorized domains.

`store.js` keeps a `localStorage` copy of the user list so the pages'
synchronous `currentUser()` / `getUsers()` keep working. Cart/wishlist/orders
remain in the browser for now. The old `/api/auth/*` password endpoints still
exist for the tests but are no longer used by the UI.

### Email OTP (signup only)

`POST /api/auth/otp/send` generates a 6-digit code, stores it for 10 minutes and
emails it through Brevo. `POST /api/auth/otp/check` validates and consumes that
code before Firebase creates the account — the code is never returned to the
browser once email delivery is configured. Set these Render environment
variables (Brevo free tier allows 300 emails/day):

```
BREVO_API_KEY=your-brevo-api-key
BREVO_FROM=your-verified-sender@example.com
```

Without them the server logs the code to its console and returns it in the
response for local testing only (`delivery: "dev"`). Verify `BREVO_FROM` as a
sender in Brevo first, otherwise sends fail with a 502.

## Still to add (one piece at a time)

- Products / catalog API
- Orders + checkout (stock, server-side pricing)
- Messages, reviews, client looks
- Admin API
- AI proxy (keeps the Gemini key on the server)

## File map

- `server.js` — static serving + auth API (incl. Firebase token exchange)
- `firebase-config.json` — public Firebase web config
- `test-auth.js` — auth API tests
- `store.js` — client data layer + Firebase Auth calls
- `chat.js` — Styla chat widget (still rule-based / direct Gemini)
- `app.js`, `modern.js` — UI behaviour
- `*.html` — pages; `styles.css` — styles
- `data/auth.json` — local user/session store (created on first run)
