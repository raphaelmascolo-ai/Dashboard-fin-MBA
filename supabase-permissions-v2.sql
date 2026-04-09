-- Migration: simplification des permissions en 3 univers
-- Run this in Supabase → SQL Editor

-- 1. Élargir la contrainte pour accepter les nouveaux types
alter table public.user_permissions
  drop constraint if exists user_permissions_type_check;

alter table public.user_permissions
  add constraint user_permissions_type_check
  check (type in (
    -- Univers (accès principal)
    'access_finance',
    'access_vehicules',
    'access_mba_construction',
    -- Granulaires Finance (legacy, conservés pour compatibilité)
    'all', 'company', 'mortgage',
    'card',
    -- Granulaires Véhicules (legacy)
    'vehicle_all', 'vehicle_company', 'vehicle',
    -- Granulaires MBA Construction
    'commande_view', 'commande_create', 'commande_edit',
    'planning_view', 'planning_workers', 'planning_sites', 'planning_assign',
    'planning_year_view', 'planning_year_place'
  ));

-- 2. Ajouter access_vehicules dans la policy RLS des véhicules
drop policy if exists "viewers_permitted_vehicles" on public.vehicles;

create policy "viewers_permitted_vehicles" on public.vehicles
  for select using (
    exists (
      select 1 from public.user_permissions p
      where p.user_id = auth.uid() and (
        p.type = 'access_vehicules'
        or p.type = 'vehicle_all'
        or (p.type = 'vehicle_company' and p.value = vehicles.company)
        or (p.type = 'vehicle' and p.value = vehicles.id)
      )
    )
  );

-- 3. Ajouter access_finance dans la policy RLS des hypothèques
-- (la policy existante s'appelle probablement "viewers_permitted_mortgages")
-- On la recrée pour inclure access_finance
drop policy if exists "viewers_permitted_mortgages" on public.mortgages;

create policy "viewers_permitted_mortgages" on public.mortgages
  for select using (
    exists (
      select 1 from public.user_permissions p
      where p.user_id = auth.uid() and (
        p.type = 'access_finance'
        or p.type = 'all'
        or (p.type = 'company' and p.value = mortgages.company)
        or (p.type = 'mortgage' and p.value = mortgages.id)
      )
    )
  );

-- 4. Ajouter access_mba_construction dans les policies RLS planning
drop policy if exists "viewers_read_planning_workers" on public.planning_workers;
create policy "viewers_read_planning_workers" on public.planning_workers
  for select using (
    exists (
      select 1 from public.user_permissions p
      where p.user_id = auth.uid()
        and p.type in ('access_mba_construction', 'planning_view', 'planning_workers', 'planning_sites', 'planning_assign')
    )
  );

drop policy if exists "viewers_read_planning_sites" on public.planning_sites;
create policy "viewers_read_planning_sites" on public.planning_sites
  for select using (
    exists (
      select 1 from public.user_permissions p
      where p.user_id = auth.uid()
        and p.type in ('access_mba_construction', 'planning_view', 'planning_workers', 'planning_sites', 'planning_assign')
    )
  );

drop policy if exists "viewers_read_planning_assignments" on public.planning_assignments;
create policy "viewers_read_planning_assignments" on public.planning_assignments
  for select using (
    exists (
      select 1 from public.user_permissions p
      where p.user_id = auth.uid()
        and p.type in ('access_mba_construction', 'planning_view', 'planning_workers', 'planning_sites', 'planning_assign')
    )
  );

drop policy if exists "viewers_read_planning_holidays" on public.planning_holidays;
create policy "viewers_read_planning_holidays" on public.planning_holidays
  for select using (
    exists (
      select 1 from public.user_permissions p
      where p.user_id = auth.uid()
        and p.type in ('access_mba_construction', 'planning_view', 'planning_workers', 'planning_sites', 'planning_assign')
    )
  );

drop policy if exists "viewers_read_planning_year_placements" on public.planning_year_placements;
create policy "viewers_read_planning_year_placements" on public.planning_year_placements
  for select using (
    exists (
      select 1 from public.user_permissions p
      where p.user_id = auth.uid()
        and p.type in ('access_mba_construction', 'planning_year_view', 'planning_year_place')
    )
  );

-- 5. Commandes: ajouter access_mba_construction
drop policy if exists "viewers_read_commandes" on public.commandes;
create policy "viewers_read_commandes" on public.commandes
  for select using (
    exists (
      select 1 from public.user_permissions p
      where p.user_id = auth.uid()
        and p.type in ('access_mba_construction', 'commande_view', 'commande_create', 'commande_edit')
    )
  );
