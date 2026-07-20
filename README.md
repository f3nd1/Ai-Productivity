# AI Impact Builder

Internal tool for United Ceres College to assemble evidence for an IMDA SME AI
Impact Awards nomination (Sections B, C, D). Single user, no login.

## Stack
- `client/` — Vite + React + Tailwind
- `server/` — Express + Supabase (service role) + OpenAI
- `supabase-schema.sql` — the three tables

## One-time Supabase setup
Open the Supabase SQL editor and run `supabase-schema.sql` once. It creates
`initiatives`, `results`, and `section_d`.

## Configure the server
```
cp server/.env.example server/.env
# fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
```
The server runs without a `.env` too: Supabase CRUD returns 503 and OpenAI
drafts return the raw evidence, so the UI is still demoable.

## Run locally (dev)
```
cd server && npm install && node index.js      # http://localhost:3001
cd client && npm install && npm run dev         # http://localhost:5173 (proxies /api)
```

## Build for production / subpath deploy
```
cd client && npm run build                       # or: npm run build -- --base=/section_c_tracker/
cd server && pm2 start index.js                  # serves client/dist + /api
```

## Tabs
- **Initiatives** — Section B narratives (B8 required).
- **Section C** — measurable results (Productivity / Financial / Operational) with live calculators.
- **Section D** — single record: staff training, work-process impact, future readiness.
- **Final submission** — nine OpenAI-drafted, editable, 300-word-capped answers.
- **Settings** — manage OpenAI key/models/enable toggle and a persistent organisation
  context (injected into every AI call) from the UI. Key is stored server-side in
  `app_settings` (service role only) and never returned to the browser; falls back to
  `OPENAI_API_KEY` from `.env` when unset.
