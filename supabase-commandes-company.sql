-- Migration: ajout colonne company sur la table commandes
-- + permission access_asv_fenetres + RLS update
-- Run this in Supabase → SQL Editor

-- 1. Ajout colonne company (défaut = MBA Construction SA pour les commandes existantes)
alter table public.commandes
  add column if not exists company text not null default 'MBA Construction SA';

create index if not exists commandes_company_idx on public.commandes(company);

-- 2. Nouvelle permission access_asv_fenetres
alter table public.user_permissions
  drop constraint if exists user_permissions_type_check;

alter table public.user_permissions
  add constraint user_permissions_type_check
  check (type in (
    'access_finance',
    'access_vehicules',
    'access_mba_construction',
    'access_asv_fenetres',
    'all', 'company', 'mortgage', 'card',
    'vehicle_all', 'vehicle_company', 'vehicle',
    'commande_view', 'commande_create', 'commande_edit',
    'planning_view', 'planning_workers', 'planning_sites', 'planning_assign',
    'planning_year_view', 'planning_year_place'
  ));

-- 3. Mettre à jour la RLS des commandes pour filtrer par company + permissions
drop policy if exists "viewers_read_commandes" on public.commandes;

create policy "viewers_read_commandes" on public.commandes
  for select using (
    exists (
      select 1 from public.user_permissions p
      where p.user_id = auth.uid()
        and (
          -- MBA Construction SA
          (commandes.company = 'MBA Construction SA' and p.type in ('access_mba_construction', 'commande_view', 'commande_create', 'commande_edit'))
          -- ASV Fenêtres et Portes SA
          or (commandes.company = 'ASV Fenêtres et Portes SA' and p.type = 'access_asv_fenetres')
        )
    )
  );
