-- Migration: ajout des permissions Planning Chantiers
-- Run this in Supabase → SQL Editor

alter table public.user_permissions
  drop constraint if exists user_permissions_type_check;

alter table public.user_permissions
  add constraint user_permissions_type_check
  check (type in (
    'all', 'company', 'mortgage',
    'vehicle_all', 'vehicle_company', 'vehicle',
    'card',
    'commande_view', 'commande_create', 'commande_edit',
    'planning_view', 'planning_workers', 'planning_sites', 'planning_assign'
  ));
