-- AI Impact Builder — Supabase schema
-- Run this ONCE in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists initiatives (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  b8_problem text,
  b9_significance text,
  b10_solution text,
  final_answers jsonb not null default '{}'::jsonb
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
