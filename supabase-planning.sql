-- Migration: module Planning Chantiers
-- Run this in Supabase → SQL Editor

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Ouvriers
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.planning_workers (
  id          text primary key,
  first_name  text not null,
  last_name   text not null,
  role        text not null check (role in ('ouvrier', 'chef', 'grutier')),
  active      boolean not null default true,
  created_at  timestamptz default now()
);

create index if not exists planning_workers_active_idx on public.planning_workers(active);

alter table public.planning_workers enable row level security;

create policy "admins_all_planning_workers" on public.planning_workers
  for all using (public.is_admin());

create policy "viewers_read_planning_workers" on public.planning_workers
  for select using (
    exists (
      select 1 from public.user_permissions p
      where p.user_id = auth.uid()
        and p.type in ('planning_view', 'planning_workers', 'planning_sites', 'planning_assign')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Chantiers (incluant 2 lignes système : Congé/Absent et Assurance)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.planning_sites (
  id          text primary key,
  name        text not null,
  location    text,
  color       text,
  active      boolean not null default true,
  system      boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz default now()
);

create index if not exists planning_sites_active_idx on public.planning_sites(active);

alter table public.planning_sites enable row level security;

create policy "admins_all_planning_sites" on public.planning_sites
  for all using (public.is_admin());

create policy "viewers_read_planning_sites" on public.planning_sites
  for select using (
    exists (
      select 1 from public.user_permissions p
      where p.user_id = auth.uid()
        and p.type in ('planning_view', 'planning_workers', 'planning_sites', 'planning_assign')
    )
  );

-- Seed des 2 lignes système (idempotent)
insert into public.planning_sites (id, name, color, system, sort_order)
values
  ('SYS-LEAVE',    'Congé / Absent', '#9ca3af', true, 9001),
  ('SYS-INSURANCE', 'Assurance',     '#60a5fa', true, 9002)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Assignations (un ouvrier sur un chantier un jour donné)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.planning_assignments (
  id          text primary key,
  worker_id   text not null references public.planning_workers(id) on delete cascade,
  site_id     text not null references public.planning_sites(id) on delete cascade,
  day_date    date not null,
  created_at  timestamptz default now(),
  unique (worker_id, site_id, day_date)
);

create index if not exists planning_assignments_day_idx on public.planning_assignments(day_date);
create index if not exists planning_assignments_worker_idx on public.planning_assignments(worker_id);
create index if not exists planning_assignments_site_idx on public.planning_assignments(site_id);

alter table public.planning_assignments enable row level security;

create policy "admins_all_planning_assignments" on public.planning_assignments
  for all using (public.is_admin());

create policy "viewers_read_planning_assignments" on public.planning_assignments
  for select using (
    exists (
      select 1 from public.user_permissions p
      where p.user_id = auth.uid()
        and p.type in ('planning_view', 'planning_workers', 'planning_sites', 'planning_assign')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Jours fériés (la présence d'une ligne = jour férié)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.planning_holidays (
  day_date    date primary key,
  label       text not null default '',
  created_at  timestamptz default now()
);

alter table public.planning_holidays enable row level security;

create policy "admins_all_planning_holidays" on public.planning_holidays
  for all using (public.is_admin());

create policy "viewers_read_planning_holidays" on public.planning_holidays
  for select using (
    exists (
      select 1 from public.user_permissions p
      where p.user_id = auth.uid()
        and p.type in ('planning_view', 'planning_workers', 'planning_sites', 'planning_assign')
    )
  );
