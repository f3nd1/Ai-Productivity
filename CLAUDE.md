# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Internal single-user web app for United Ceres College to assemble evidence for an IMDA SME AI Impact Awards nomination (form sections B, C, D — 9 capped-at-300-word questions). No login; VPS access is the entire security model. Deployed on a DigitalOcean VPS under nginx + PM2 at the subpath `/ai_impact_builder/`, PM2 process name `ai_impact_builder`, repo at `/var/www/ai_impact_builder`.

## Commands

Client (`client/`):
- `npm run dev` — Vite dev server; proxies `/ai_impact_builder/api/*` to the Express server on :3001 (see "Base path" below).
- `npm run build` — production build. For the subpath deploy: `npm run build -- --base=/ai_impact_builder/` (the base is already set in `vite.config.js`, so plain `npm run build` also works).
- No lint step and no test framework. Tests are plain `assert`-based Node scripts run directly:
  - `node src/calc.test.mjs` (and `evidence`, `export`, `overview`) — run one at a time.

Server (`server/`):
- `node index.js` (or `npm start`) — Express on :3001. Starts fine with **no `.env`** (see graceful degradation).
- `node config.test.mjs` — server-side pure-helper test.

There is no root-level package; `client/` and `server/` are independent npm packages, each needing its own `npm install`.

## Architecture

Three layers, all talking JSON over `/api/*`:
- **`client/`** — Vite + React + Tailwind SPA. No router library; `App.jsx` holds `tab` + `selectedId` state and does its own view switching (sidebar nav + a list→detail flip inside the Initiatives tab).
- **`server/index.js`** — one-file Express app. CRUD + AI + git endpoints, and in production serves the built `client/dist` as static files with an SPA fallback.
- **Supabase (Postgres)** — reached **only** from the server using the **service-role key**. There is no anon key and no client-side Supabase access anywhere; the browser never holds a DB or API secret. All persistence goes through Express.

### Data model (see `supabase-schema.sql`)
- `initiatives` — one AI use case: `name`, `department`, B narratives `b8_problem`/`b9_significance`/`b10_solution`, and `final_answers` (jsonb; **only** the generated C11/C12/C13 answers are stored here — B/D raw fields are their own answers).
- `results` — Section C measurable results, FK to one initiative, `type` in `('productivity','financial','operational')`, type-specific inputs in `fields` (jsonb).
- `section_d` — **one row per initiative** (was a singleton historically; migrated to per-initiative via `initiative_id`).
- `app_settings` — singleton row: OpenAI enable toggle, key, analysis/utility model choices, and persistent `org_context`.

The schema file doubles as the migration log: the base `create table`s reflect a fresh install, and each `-- MIGRATION` block at the bottom is a manual, non-destructive `alter table ... add column if not exists` to run **once** in the Supabase SQL editor when upgrading an existing DB. Adding a column to a table generally means adding a migration block here too.

### The per-initiative page is the core (`tabs/InitiativePage.jsx`)
Everything about one initiative lives on one page and is owned by this component, which is deliberately the single source of truth so the one page-level **Save** can persist the whole page atomically:
- It holds `info` (B fields + department), `cResults` (editable working copy of Section C results, seeded once on mount — **not** reseeded on reload, to avoid clobbering edits), `dFields` (Section D), and `answers` (C generated text).
- `SectionC`, `SectionD` are **controlled** children (no own Save buttons); Section C keeps only a per-card **Delete** (a distinct immediate action).
- `persist()` writes everything in one action; a debounced **blur autosave** calls it as a safety net, guarded so it never runs mid-generation.
- **B8 is required**: `persist()` aborts entirely if `b8_problem` is empty (explicit Save shows an error, autosave silently skips).

### Calculators are pure and shared — never duplicate them
`calc.js` (`computeResult(type, fields)`) returns `{ metrics: [{label,value}], sentence, warning }` plus raw numbers (`pct`, `monthly`, `annual`) used for aggregation. These same functions drive the Section C live preview, the Export block, and the Overview rollup, guaranteeing numbers can't drift between views. **Do not change these formulas**, and when you need a computed figure elsewhere, reuse `computeResult` (or add an additive raw field) rather than re-deriving. `overview.js` (`computeOverview`) and `export.js` are pure aggregation/formatting modules built on top; each has a `*.test.mjs`.

### AI + settings flow
- OpenAI is called **server-side only**, model `gpt-4o-mini`. Endpoints: `POST /api/draft/:questionId` and `POST /api/tighten`. The effective key/models/enable-toggle/org-context are resolved **per request** from `app_settings` (merged with the `OPENAI_API_KEY` env fallback via `config.js` `mergeConfig`); the stored key is never returned to the browser (only a masked form).
- Only **C11/C12/C13** have a "Generate" step (they synthesise multiple Section C results). B8–B10 and D14–D16 raw text *is* their answer — those get a Tighten button + word count instead. Generation is **evidence-gated** (`evidence.js` `hasEvidence`): a question can't be generated with no underlying data. Generated C answers are persisted immediately (independent of the B8-gated whole-page Save) so they survive a reload.

### Graceful degradation (important; keep it working)
The server never hard-crashes on missing config. With no Supabase env, CRUD endpoints return **503**; with no OpenAI key/disabled, `/api/draft` and `/api/tighten` return a clearly-labelled **stub** echoing the evidence. `App.jsx` shows a degraded-mode banner from `/api/health`. Any change to endpoints must preserve this.

### Base path (subpath deploy)
The app runs under `/ai_impact_builder/`. `client/src/api.js` is the single choke point that prefixes every request with `import.meta.env.BASE_URL`, and it hard-fails with a clear message if a response isn't JSON (catches subpath/nginx misroutes instead of a cryptic `JSON.parse` error). In production nginx strips the `/ai_impact_builder/` prefix before proxying, so Express still sees `/api/...` and `/`; the Vite dev proxy mirrors that stripping. Keep all client API calls going through `api.js`.

### Change Log tab
`GET /api/changelog` shells out to **read-only** `git log` (via `execFile`, no shell) against the repo root and caches 60s — so the Change Log page only shows real data when the deployed code is an intact git clone. Never add write git operations to this endpoint.

## Workflow notes

- Development branch is `claude/ai-impact-builder-fullstack-fcstiw`; commit and push there.
- **GitHub is the source of truth.** This project has a recurring history of edits made directly on the VPS being lost on the next pull — always commit/push, then pull on the server; never hand-edit only on the server.
- Non-trivial logic (branches, money/calculation, parsing) leaves one runnable `assert`-based `*.test.mjs` next to it; run it with `node`.
