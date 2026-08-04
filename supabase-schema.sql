-- AI Impact Builder — Supabase schema
-- Run this ONCE in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists initiatives (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  name text,
  department text,
  -- Short read-only code (INIT-01, INIT-02, ...). The sequence and default that
  -- populate it are set up in the migration block at the end of this file.
  initiative_code text,
  b8_problem text,
  b9_significance text,
  b10_solution text,
  final_answers jsonb not null default '{}'::jsonb,
  -- Which of C11/C12/C13 this initiative has declared genuinely not applicable,
  -- e.g. {"c12": true}. A declared question counts as answered for completeness
  -- without needing a Section C result behind it.
  not_applicable jsonb not null default '{}'::jsonb
);

create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  initiative_id uuid not null references initiatives(id) on delete cascade,
  type text not null check (type in ('productivity','financial','operational')),
  fields jsonb not null default '{}'::jsonb,
  note text
);

-- Singleton settings row: OpenAI config + persistent organisation context.
-- Key is stored server-side only (service role); never returned to the browser.
create table if not exists app_settings (
  id uuid primary key default gen_random_uuid(),
  openai_enabled boolean not null default true,
  openai_key text,
  analysis_model text,
  utility_model text,
  org_context text
);

-- Singleton: ONE overall Section D for the whole submission (not per initiative).
create table if not exists section_d (
  id uuid primary key default gen_random_uuid(),
  d14_narrative text,
  d14_staff_trained int,
  d14_total_staff int,
  d14_training_weeks numeric,
  d15_narrative text,
  d15_hours_per_week numeric,
  d15_staff_affected int,
  d16_narrative text
);

-- ============================================================
-- MIGRATION — run manually, once, in the Supabase SQL editor.
-- Section D changes from ONE shared row across all initiatives to one row
-- PER INITIATIVE (each initiative now gets its own D14/D15/D16).
--
-- DATA-LOSS / MANUAL STEP WARNING:
-- This does NOT delete or overwrite the existing shared row — it only adds a
-- nullable initiative_id column, so any existing row survives with
-- initiative_id = NULL. Because that content was never tied to a specific
-- initiative before, THIS MIGRATION CANNOT DECIDE WHICH INITIATIVE IT
-- BELONGS TO. You must manually do one of:
--   a) UPDATE section_d SET initiative_id = '<uuid-of-the-right-initiative>'
--      WHERE initiative_id IS NULL;
--   b) Leave it orphaned and re-enter the D14/D15/D16 content fresh on each
--      initiative's own page, then delete the orphaned row once unneeded.
-- The app's per-initiative Section D UI will not surface an orphaned
-- (initiative_id IS NULL) row — it only reads/writes rows scoped to the
-- initiative_id you're currently viewing.
-- ============================================================
alter table section_d add column if not exists initiative_id uuid references initiatives(id) on delete cascade;
create unique index if not exists section_d_initiative_id_key on section_d (initiative_id);

-- Once every row has been backfilled with a non-null initiative_id (step (a)
-- above), you may optionally tighten the constraint to match fresh installs:
--   alter table section_d alter column initiative_id set not null;

-- ============================================================
-- MIGRATION — run manually, once, in the Supabase SQL editor.
-- Persist the Final submission generated/edited answers per initiative.
-- Non-destructive: adds a jsonb column defaulting to an empty object. Existing
-- initiatives get '{}' and simply show "Not generated yet" until answers are
-- saved. No existing data is touched.
-- ============================================================
alter table initiatives add column if not exists final_answers jsonb not null default '{}'::jsonb;

-- ============================================================
-- MIGRATION — run manually, once, in the Supabase SQL editor.
-- Adds an optional department to each initiative. Existing records remain
-- valid and will show "Department not set" until updated in the app.
-- ============================================================
alter table initiatives add column if not exists department text;

-- ============================================================
-- MIGRATION — run manually, once, in the Supabase SQL editor.
-- Section D reverts from one row PER INITIATIVE back to ONE OVERALL row.
-- Section D is now the closing/conclusion section of the whole submission
-- (organisation-wide adoption, process change and future readiness), reached
-- from its own top-level tab rather than from any single initiative's page.
--
-- *** THIS MIGRATION DESTROYS DATA — ON PURPOSE ***
-- Unlike every other migration in this file, this one is NOT non-destructive.
-- `delete from section_d` discards EVERY existing per-initiative D14/D15/D16
-- row: all D14 narratives, staff-trained / total-staff / training-weeks
-- figures, D15 narratives, hours-freed / staff-affected figures, and D16
-- narratives, for every initiative. Nothing is merged or carried forward.
--
-- This is the confirmed, deliberate decision: start the overall Section D from
-- one blank row rather than guess how several per-initiative answers should be
-- combined into a single organisation-wide one. Anything worth keeping must be
-- copied out of the app BEFORE running this.
--
-- Dropping initiative_id (rather than keeping it nullable and only ever using
-- the IS NULL row) is what makes the table a real singleton again: no dead
-- column, and no way for a stale scoped row to shadow the overall one.
-- ============================================================
delete from section_d;
drop index if exists section_d_initiative_id_key;
alter table section_d drop column if exists initiative_id;

-- ============================================================
-- MIGRATION — run manually, once, in the Supabase SQL editor.
-- Two additive columns on initiatives. Non-destructive: existing rows get the
-- defaults and behave exactly as before.
--   not_applicable — lets an initiative declare C11/C12/C13 genuinely N/A, so
--     completeness can require real Section C evidence for every C question
--     that ISN'T declared N/A (previously any stored text scored a point,
--     which let an initiative with zero results show 9/9).
--   updated_at — powers the Initiatives list's "recently updated" sort. Existing
--     rows start NULL and sort last until their next save; the server stamps it
--     on every initiative update.
-- ============================================================
alter table initiatives add column if not exists not_applicable jsonb not null default '{}'::jsonb;
alter table initiatives add column if not exists updated_at timestamptz;

-- ============================================================
-- MIGRATION — run manually, once, in the Supabase SQL editor.
-- Short read-only initiative codes: INIT-01, INIT-02, ... The code is generated
-- by a Postgres SEQUENCE used as the column default, so it is allocated by the
-- database on insert. That is what makes it safe under concurrent creation —
-- the server never reads a max and adds one, so two simultaneous inserts can't
-- race to the same code.
--
-- The pad width is greatest(2, length(n)) rather than a plain lpad(n, 2, '0'):
-- lpad TRUNCATES when the value is longer than the target width, so lpad('100',
-- 2, '0') returns '10' — the 100th initiative would collide with INIT-10. This
-- form pads to 2 digits and then simply gets wider, so 99 -> INIT-99 and
-- 100 -> INIT-100.
--
-- Non-destructive: adds a column, backfills existing rows in creation order,
-- then starts the sequence after the highest code already assigned.
-- Run the whole block together — the backfill must complete before setval.
-- ============================================================
alter table initiatives add column if not exists initiative_code text;

create sequence if not exists initiative_code_seq;

-- Backfill existing rows in creation order, oldest = INIT-01. Only touches rows
-- that don't already have a code, so re-running this block is harmless.
with numbered as (
  select id, row_number() over (order by created_at, id) as n
  from initiatives
  where initiative_code is null
)
update initiatives i
set initiative_code = 'INIT-' || lpad(numbered.n::text, greatest(2, length(numbered.n::text)), '0')
from numbered
where i.id = numbered.id;

-- Point the sequence at the next code to hand out, so it continues the run
-- instead of colliding with an existing code. The `false` third argument means
-- "not yet called", so nextval() returns exactly this value — which is why an
-- empty table correctly starts at INIT-01 rather than skipping to INIT-02.
select setval(
  'initiative_code_seq',
  (select coalesce(max(regexp_replace(initiative_code, '\D', '', 'g')::int), 0) + 1
   from initiatives
   where initiative_code ~ '\d'),
  false
);

-- A function, not an inline expression: the padding width depends on the value,
-- and a column default can't hold a subquery, so writing it inline would have to
-- call nextval() twice and burn two sequence values per insert.
create or replace function next_initiative_code() returns text as $$
  select 'INIT-' || lpad(n::text, greatest(2, length(n::text)), '0')
  from (select nextval('initiative_code_seq') as n) s;
$$ language sql volatile;

alter table initiatives alter column initiative_code set default next_initiative_code();

-- Enforces the guarantee rather than trusting it.
create unique index if not exists initiatives_initiative_code_key on initiatives (initiative_code);
