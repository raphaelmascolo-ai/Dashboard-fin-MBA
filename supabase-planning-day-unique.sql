-- Migration: contrainte "1 assignation max par ouvrier par jour"
-- Run this in Supabase → SQL Editor (à exécuter une seule fois après
-- le déploiement initial du module Planning Chantiers).

-- Étape 1: dédoublonne (au cas où il existerait déjà des doublons),
-- garde la ligne la plus récente par (worker, day).
delete from public.planning_assignments a
using public.planning_assignments b
where a.worker_id = b.worker_id
  and a.day_date = b.day_date
  and (
    a.created_at < b.created_at
    or (a.created_at = b.created_at and a.id < b.id)
  );

-- Étape 2: drop l'ancienne contrainte unique (worker, site, day)
alter table public.planning_assignments
  drop constraint if exists planning_assignments_worker_id_site_id_day_date_key;

-- Étape 3: nouvelle contrainte unique (worker, day)
alter table public.planning_assignments
  add constraint planning_assignments_worker_day_key
  unique (worker_id, day_date);
