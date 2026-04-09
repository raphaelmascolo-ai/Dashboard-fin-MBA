-- Migration: demi-journées (matin/après-midi) + site système Dépôt
-- Run this in Supabase → SQL Editor

-- 1. Ajout colonne period sur les assignations existantes
alter table public.planning_assignments
  add column if not exists period text not null default 'journée'
  check (period in ('journée', 'matin', 'après-midi'));

-- 2. Drop l'ancienne contrainte unique (worker, day)
alter table public.planning_assignments
  drop constraint if exists planning_assignments_worker_day_key;

-- 3. Nouvelle contrainte: un ouvrier max par (jour, période)
alter table public.planning_assignments
  add constraint planning_assignments_worker_day_period_key
  unique (worker_id, day_date, period);

-- 4. Ajout du site système "Dépôt"
insert into public.planning_sites (id, name, color, system, sort_order)
values ('SYS-DEPOT', 'Dépôt', '#a78bfa', true, 9000)
on conflict (id) do nothing;
