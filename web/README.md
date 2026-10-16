# Job Tracker — web

Single-page React frontend for the API in the parent folder. Vite, plain JavaScript, no UI library.

```bash
npm install
npm run dev        # http://localhost:5173, talks to the Render API by default
```

To use a local API instead, create `web/.env` with `VITE_API_URL=http://localhost:3000`.

## How auth works

- The access token is kept **in memory only** (`src/api.js`). A reload drops it on purpose.
- The refresh token is kept in `localStorage`, so a reload can silently log back in via `/auth/refresh`.
- On a 401 the client refreshes **once** and retries **once**. Concurrent 401s share one refresh promise, because the API treats a refresh token used twice as theft and revokes every session.
- Logout calls `/auth/logout` so the server-side record is deleted, then clears both tokens.

A stricter design would keep the refresh token in an `httpOnly` cookie. That needs a small API change and is noted as a next step.

## Deploy

`.github/workflows/web.yml` builds this folder on every push to `main` that touches `web/` and publishes `dist/` to the `gh-pages` branch, which GitHub Pages serves at `https://yashashviarora.github.io/job-tracker-api/`.
