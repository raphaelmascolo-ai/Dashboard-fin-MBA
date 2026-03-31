-- Migration: add vehicle permissions
-- Run this in Supabase → SQL Editor

-- 1. Allow new permission types for vehicles
alter table public.user_permissions
  drop constraint if exists user_permissions_type_check;

alter table public.user_permissions
  add constraint user_permissions_type_check
  check (type in ('all', 'company', 'mortgage', 'vehicle_all', 'vehicle_company', 'vehicle'));

-- 2. Drop the old "viewers see all vehicles" policy
drop policy if exists "viewers_read_vehicles" on public.vehicles;

-- 3. Add permission-based viewer policy for vehicles
create policy "viewers_permitted_vehicles" on public.vehicles
  for select using (
    exists (
      select 1 from public.user_permissions p
      where p.user_id = auth.uid() and (
        p.type = 'vehicle_all'
        or (p.type = 'vehicle_company' and p.value = vehicles.company)
        or (p.type = 'vehicle' and p.value = vehicles.id)
      )
    )
  );
