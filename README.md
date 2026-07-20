# AI Impact Builder

Internal tool for United Ceres College to assemble evidence for an IMDA SME AI
Impact Awards nomination (Sections B, C, D). Single user, no login.

## Stack
- `client/` — Vite + React + Tailwind
- `server/` — Express + Supabase (service role) + OpenAI
- `supabase-schema.sql` — the three tables

## One-time Supabase setup
Open the Supabase SQL editor and run `supabase-schema.sql` once. It creates
`initiatives`, `results`, `app_settings`, and `section_d`, then applies the
migration that makes `section_d` per-initiative (see the schema file's
`MIGRATION` block for the manual data-carry-over step if you're upgrading an
existing database that already has a shared Section D row).

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
- **Initiatives** — a list of initiative cards (name + quick status summary). Click a
  card to open its full page, or "Add initiative" to create one and jump straight in.
  Each initiative's page contains, top to bottom:
  1. Initiative details — name + B8/B9/B10 narratives (B8 required to save this section).
  2. Section C — this initiative's measurable results (Productivity / Financial /
     Operational) with live calculators.
  3. Section D — this initiative's own staff training / work-process / future-readiness
     record, with its own Save button.
  4. Final answers — nine OpenAI-drafted, editable, 300-word-capped answers generated
     from this initiative's evidence only.
  5. Export — the ERPNext Quality Action Resolution copy block for this initiative.
- **Settings** (rightmost tab) — manage OpenAI key/models/enable toggle and a persistent
  organisation context (injected into every AI call) from the UI. Key is stored
  server-side in `app_settings` (service role only) and never returned to the browser;
  falls back to `OPENAI_API_KEY` from `.env` when unset.
