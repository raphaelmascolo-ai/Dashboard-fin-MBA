-- Migration: module Vue annuelle chantiers (Kanban annuel)
-- Run this in Supabase → SQL Editor
--
-- IMPORTANT: ce module RÉUTILISE la table public.planning_sites du module
-- Planning Chantiers. Ne pas créer de nouvelle table de chantiers.
-- Cette migration ne crée que la table de placements semaine-année.

create table if not exists public.planning_year_placements (
  id          text primary key,
  site_id     text not null references public.planning_sites(id) on delete cascade,
  year        integer not null,
  iso_week    integer not null check (iso_week >= 1 and iso_week <= 53),
  created_at  timestamptz default now(),
  created_by  uuid references auth.users(id) on delete set null,
  unique (site_id, year, iso_week)
);

create index if not exists planning_year_placements_year_idx
  on public.planning_year_placements(year);
create index if not exists planning_year_placements_year_week_idx
  on public.planning_year_placements(year, iso_week);
create index if not exists planning_year_placements_site_idx
  on public.planning_year_placements(site_id);

alter table public.planning_year_placements enable row level security;

create policy "admins_all_planning_year_placements" on public.planning_year_placements
  for all using (public.is_admin());

create policy "viewers_read_planning_year_placements" on public.planning_year_placements
  for select using (
    exists (
      select 1 from public.user_permissions p
      where p.user_id = auth.uid()
        and p.type in ('planning_year_view', 'planning_year_place')
    )
  );
