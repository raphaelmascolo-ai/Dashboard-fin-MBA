-- Migration: add commande permissions
-- Run this in Supabase → SQL Editor

-- Allow new permission types for commandes
alter table public.user_permissions
  drop constraint if exists user_permissions_type_check;

alter table public.user_permissions
  add constraint user_permissions_type_check
  check (type in (
    'all', 'company', 'mortgage',
    'vehicle_all', 'vehicle_company', 'vehicle',
    'card',
    'commande_view', 'commande_create', 'commande_edit'
  ));
