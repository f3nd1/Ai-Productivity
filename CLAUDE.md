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
- `initiatives` — one AI use case: `name`, `department`, B narratives `b8_problem`/`b9_significance`/`b10_solution`, `final_answers` (jsonb; **only** the generated C11/C12/C13 answers are stored here — B/D raw fields are their own answers), `not_applicable` (jsonb; which of c11/c12/c13 this initiative declares genuinely N/A), `status` (`'Draft' | 'In Progress' | 'Done'`, NOT NULL default `'Draft'` — `STATUSES`/`STATUS_TONE` live in `InitiativePage.jsx` and are imported by the list for its badge and filter), and `updated_at` (stamped by the server on every update, powers the "recently updated" sort).
- `results` — Section C measurable results, FK to one initiative, `type` in `('productivity','financial','operational')`, type-specific inputs in `fields` (jsonb).
- `section_d` — **one overall singleton row** for the whole submission. (It was briefly per-initiative via `initiative_id`; that column was dropped and the rows discarded — see the last migration block.) Section D is the closing/conclusion page, reached from its own top-level tab, not from an initiative.
- `app_settings` — singleton row: OpenAI enable toggle, key, analysis/utility model choices, and persistent `org_context`.

The schema file doubles as the migration log: the base `create table`s reflect a fresh install, and each `-- MIGRATION` block at the bottom is a manual, non-destructive `alter table ... add column if not exists` to run **once** in the Supabase SQL editor when upgrading an existing DB. Adding a column to a table generally means adding a migration block here too.

### The per-initiative page is the core (`tabs/InitiativePage.jsx`)
Everything about one initiative lives on one page and is owned by this component, which is deliberately the single source of truth so the one page-level **Save** can persist the whole page atomically:
- It holds `info` (B fields + department), `cResults` (editable working copy of Section C results, seeded once on mount — **not** reseeded on reload, to avoid clobbering edits), and `answers` (C generated text). Section D is **not** here — it's a separate top-level page owning its own state and Save.
- `SectionC` is a **controlled** child (no own Save button); it keeps only a per-card **Delete** (a distinct immediate action). Section C is split into three fixed sub-sections (C11 productivity / C12 financial / C13 operational), each with its own add button — a result's type comes from the sub-section it was added under, so cards have no type picker.
- `persist()` writes everything in one action; a debounced **blur autosave** calls it as a safety net, guarded so it never runs mid-generation.
- **B8 is required**: `persist()` aborts entirely if `b8_problem` is empty (explicit Save shows an error, autosave silently skips).

### Calculators are pure and shared — never duplicate them
### Figures Table (`tabs/Figures.jsx` + `figures.js`)
One row per Section C result across every initiative, grouped into Productivity / Financial / Operational column blocks. All row building, sorting, filtering and CSV live in pure `figures.js` (tested); the JSX only renders. Every number comes from `computeResult` — when a figure isn't already exposed, add an additive raw field to `calc.js` (as `roi`, `paybackMonths`, `pointChange` were) rather than re-deriving it here. CSV building is shared with Overview via `csv.js`.

### Completeness scoring is evidence-based, not text-based (`overview.js`)
`completeness(initiative, results, sectionD)` returns `{ score, questions, thin, stale, hasAnyC, resultCount }`. The rules exist because text alone once scored a point, letting an initiative with **zero** Section C results read 9/9 "submission ready":
- **C11/C12/C13** need a linked result of that type, or an explicit `not_applicable` declaration. Stored generated text with no results behind it scores `'stale'` — never a point.
- **D14/D15/D16** (shared globally) only count for an initiative that has *some* Section C evidence; otherwise `'blocked'`. An initiative contributing nothing doesn't inherit the shared section's credit.
- B/D prose under `THIN_WORDS` scores but is flagged `'thin'`, so the UI can distinguish evidence-backed from prose-only.
Don't reintroduce "field has text ⇒ complete" anywhere. `overview.test.mjs` pins the whole table, including the original 9/9 regression.

`calc.js` (`computeResult(type, fields)`) returns `{ metrics: [{label,value}], sentence, warning }` plus raw numbers (`pct`, `monthly`, `annual`) used for aggregation. These same functions drive the Section C live preview, the Export block, and the Overview rollup, guaranteeing numbers can't drift between views. Productivity's `direction` defaults to `'lower'` (times and error counts dominate here, where the improvement is a fall); the percentage itself is direction-independent. **Do not change these formulas**, and when you need a computed figure elsewhere, reuse `computeResult` (or add an additive raw field) rather than re-deriving. `overview.js` (`computeOverview`) and `export.js` are pure aggregation/formatting modules built on top; each has a `*.test.mjs`.

### AI house style (`HOUSE_STYLE` in `server/index.js`)
Every prompt appends one shared style block. This is an **internal** tool for one college, so the output must **not name the organisation or write about it in the third person** — the reader already knows whose evidence it is. Plain simple words, **1–3 sentences, ~100 words**, no praise adjectives ("remarkable", "significant", "innovative"), no sentences about commitment or transformation. Short and factual beats padded: a sentence of praise is a sentence that isn't evidence. Elaborate and Quick Fill also **never emit `[add: ...]` placeholders** any more — they write less instead of naming the gap. `PlaceholderNotice` in `ui.jsx` is kept only so text generated before that change still gets flagged for cleanup. When adding a prompt, append `HOUSE_STYLE` rather than restating the rules.

### AI + settings flow
- OpenAI is called **server-side only**, model `gpt-4o-mini`. Endpoints: `POST /api/draft/:questionId` and `POST /api/tighten`. The effective key/models/enable-toggle/org-context are resolved **per request** from `app_settings` (merged with the `OPENAI_API_KEY` env fallback via `config.js` `mergeConfig`); the stored key is never returned to the browser (only a masked form).
- Only **C11/C12/C13** have a "Generate" step (they synthesise multiple Section C results). B8–B10 and D14–D16 raw text *is* their answer — those get **Tighten** + **Elaborate** buttons and a word count instead. Both share `POST /api/tighten`, switched by a `mode` field (`tighten` | `elaborate`); Elaborate expands a fragment but must never add a fact, emitting `[add: ...]` placeholders for anything the form wants that the input doesn't state. The client surfaces those placeholders as a highlighted checklist under the field (`PlaceholderNotice` in `ui.jsx`) — a textarea can't style its own contents.
- **Quick Fill** (`tabs/QuickFill.jsx` + pure `quickfill.js`) turns one rough pasted note into B8/B9/B10 plus proposed Section C results via `POST /api/quick-fill` (JSON mode, analysis model). It is paste → **review** → apply: nothing touches the page until Apply, Apply only populates in-memory state (the page Save still persists it), and replacing existing B text always warns first. Blur autosave is suppressed while the modal is open.
  - It is **propose-and-elaborate**, and the prompt carries two deliberately opposite rules. *Qualitative* text (B8/B9/B10 and each result's note) may be expanded into fuller prose, emitting `[add: ...]` placeholders for detail the note lacks — same contract as Elaborate, and the review reuses `PlaceholderNotice` to surface them. *Quantitative* figures (`before`, `after`, `monthlySaving`) may only be filled from an actual numeric hint in the note, however vague ("roughly halved"); a figure derived that way is flagged `estimated` and shown with an amber "confirm or adjust" label, and editing the value clears the flag. **No numeric hint ⇒ the field stays blank.** Never relax that half.
  - `quickfill.js` enforces this structurally rather than trusting the model: unusable proposals are dropped, unparseable numbers become `null` (never `0`), and an `estimated` flag on a field the model left null is discarded — otherwise the UI would badge an empty box as an estimate.
- The Export block has its own **Generate with AI** step (`POST /api/export-draft`) that rewrites the four Quality Action Resolution text fields from this initiative's B+C evidence. It returns labelled prose which `parseExportDraft` (in `export.js`, tested) splits into the four fields; the plain-concatenation build is what shows until then, and every field stays editable after. **Section D never enters the export** — it is one shared answer for the whole submission, so including it gave every initiative an identical Action Taken. The mapping is Finding = B8+B9, Root Cause & Resolution = AI analysis only (no plain-text source, starts empty), Action Taken = B10 + this initiative's result notes, General Notes = calculated sentences + department + per-result detail. Generation is **evidence-gated** (`evidence.js` `hasEvidence`): a question can't be generated with no underlying data. Generated C answers are persisted immediately (independent of the B8-gated whole-page Save) so they survive a reload.

### Graceful degradation (important; keep it working)
The server never hard-crashes on missing config. With no Supabase env, CRUD endpoints return **503**; with no OpenAI key/disabled, `/api/draft` and `/api/tighten` return a clearly-labelled **stub** echoing the evidence. `App.jsx` shows a degraded-mode banner from `/api/health`. Any change to endpoints must preserve this.

### Base path (subpath deploy)
The app runs under `/ai_impact_builder/`. `client/src/api.js` is the single choke point that prefixes every request with `import.meta.env.BASE_URL`, and it hard-fails with a clear message if a response isn't JSON (catches subpath/nginx misroutes instead of a cryptic `JSON.parse` error). In production nginx strips the `/ai_impact_builder/` prefix before proxying, so Express still sees `/api/...` and `/`; the Vite dev proxy mirrors that stripping. Keep all client API calls going through `api.js`.

### Print / Export PDF (`tabs/PrintView.jsx` + the print block in `index.css`)
A **dedicated document render**, not a print stylesheet over the live form — textareas, inputs and buttons don't print. `PrintDocument` is the layout (pure, renderable without a DOM, which is how it's verified); `PrintView` portals it to `<body>` so `@media print` can hide `#root` outright and no app chrome can leak in. It covers Section B, Section C and the four export fields — **Section D is deliberately absent**, being one shared answer for the whole submission rather than this initiative's evidence. `InitiativePage` takes no `sectionD` prop at all for the same reason. It mounts only while `printing` is true, so the editing UI is untouched otherwise. `printResultRows` in `export.js` builds the Section C tables (financial gets its own columns — it has no before/after pair) and is tested. Everything is native `window.print()`; there is no PDF library. Browser print-to-PDF can't number pages from CSS, so the repeating footer carries the confidentiality line only.

### Change Log tab
`GET /api/changelog` shells out to **read-only** `git log` (via `execFile`, no shell) against the repo root and caches 60s — so the Change Log page only shows real data when the deployed code is an intact git clone. Never add write git operations to this endpoint.

## Workflow notes

- Development branch is `claude/ai-impact-builder-fullstack-fcstiw`; commit and push there.
- **GitHub is the source of truth.** This project has a recurring history of edits made directly on the VPS being lost on the next pull — always commit/push, then pull on the server; never hand-edit only on the server.
- Non-trivial logic (branches, money/calculation, parsing) leaves one runnable `assert`-based `*.test.mjs` next to it; run it with `node`.
