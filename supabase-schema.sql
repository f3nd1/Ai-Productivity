-- AI Impact Builder — Supabase schema
-- Run this ONCE in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists initiatives (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  b8_problem text,
  b9_significance text,
  b10_solution text
);

create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  initiative_id uuid not null references initiatives(id) on delete cascade,
  type text not null check (type in ('productivity','financial','operational')),
  fields jsonb not null default '{}'::jsonb,
  note text
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
