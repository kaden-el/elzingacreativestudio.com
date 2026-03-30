-- ═══════════════════════════════════════════════════════════════════
-- ELZINGA CREATIVE STUDIO — Supabase Database Setup
-- Run this entire file in: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. CLIENTS ────────────────────────────────────────────────────
-- Populated by the onboarding form. Read by agency + client dashboards.
create table if not exists clients (
  id               uuid primary key default gen_random_uuid(),
  reference_id     text unique not null,
  status           text default 'New',
  submitted_at     timestamptz default now(),

  -- Business
  business_name    text,
  industry         text,
  location         text,
  website          text,
  facebook         text,
  instagram        text,
  biz_description  text,
  ad_focus         text,

  -- Goals
  objective        text,
  target_customer  text,
  timeline         text,
  goal_notes       text,

  -- Audience
  age_range        text,
  gender           text,
  target_locations text,
  interests        text,
  pain_points      text,
  existing_data    text,

  -- Budget
  budget_range     text,
  budget_raw       numeric,
  platforms        text,
  contract_length  text,
  start_date       text,
  budget_notes     text,

  -- Creative
  brand_style      text,
  brand_personality text,
  brand_colours    text,
  assets_url       text,

  -- Contact
  contact_name     text,
  contact_email    text,
  contact_phone    text,
  contact_time     text,
  contact_notes    text,

  -- Full JSON blob (entire intake form data)
  full_data        jsonb
);

-- ── 2. TESTS (back-test lab) ──────────────────────────────────────
create table if not exists tests (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  data       jsonb not null
);

-- ── 3. CAMPAIGNS ─────────────────────────────────────────────────
create table if not exists campaigns (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  data       jsonb not null
);

-- ── 4. SETTINGS (single row — upserted, never duplicated) ─────────
create table if not exists settings (
  id   int primary key default 1,
  data jsonb not null default '{}'
);

-- ── 5. SECURITY ───────────────────────────────────────────────────
-- Disable RLS — this is an internal agency tool with password auth.
-- All access is controlled by keeping the anon key private.
-- If you ever make the site fully public, enable RLS and add policies.
alter table clients   disable row level security;
alter table tests     disable row level security;
alter table campaigns disable row level security;
alter table settings  disable row level security;

-- ── 6. INDEXES (for fast lookups) ─────────────────────────────────
create index if not exists clients_reference_id_idx on clients(reference_id);
create index if not exists clients_status_idx on clients(status);
create index if not exists clients_submitted_at_idx on clients(submitted_at desc);

-- Done. You should see 4 tables in the Table Editor.
