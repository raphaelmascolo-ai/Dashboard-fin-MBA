-- Migration: création de la table commandes pour le module
-- "Commande MBA Construction SA"
-- Run this in Supabase → SQL Editor

create table if not exists public.commandes (
  id              text primary key,
  order_date      date not null,
  chantier        text not null,
  fournisseur     text not null,
  description     text not null,
  amount          numeric not null default 0,
  delivery_date   date,
  devis_path      text,            -- chemin dans le bucket Supabase Storage (commandes-devis)
  devis_name      text,            -- nom original du fichier
  comment         text not null default '',
  created_at      timestamptz default now(),
  created_by      uuid references auth.users(id) on delete set null
);

create index if not exists commandes_order_date_idx on public.commandes(order_date desc);
create index if not exists commandes_chantier_idx   on public.commandes(chantier);
create index if not exists commandes_fournisseur_idx on public.commandes(fournisseur);

alter table public.commandes enable row level security;

-- Admins peuvent tout faire
create policy "admins_all_commandes" on public.commandes
  for all using (public.is_admin());

-- Lecture: utilisateur ayant la permission commande_view (ou commande_create / commande_edit)
create policy "viewers_read_commandes" on public.commandes
  for select using (
    exists (
      select 1 from public.user_permissions p
      where p.user_id = auth.uid()
        and p.type in ('commande_view', 'commande_create', 'commande_edit')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Bucket Supabase Storage pour les devis joints (PDF, images, etc.)
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('commandes-devis', 'commandes-devis', false)
on conflict (id) do nothing;

-- Lecture des devis: même règle que la lecture des commandes
create policy "commandes_devis_read"
  on storage.objects for select
  using (
    bucket_id = 'commandes-devis'
    and (
      public.is_admin()
      or exists (
        select 1 from public.user_permissions p
        where p.user_id = auth.uid()
          and p.type in ('commande_view', 'commande_create', 'commande_edit')
      )
    )
  );

-- Upload: utilisateurs avec commande_create ou commande_edit (ou admin)
create policy "commandes_devis_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'commandes-devis'
    and (
      public.is_admin()
      or exists (
        select 1 from public.user_permissions p
        where p.user_id = auth.uid()
          and p.type in ('commande_create', 'commande_edit')
      )
    )
  );

-- Suppression / mise à jour: commande_edit ou admin
create policy "commandes_devis_delete"
  on storage.objects for delete
  using (
    bucket_id = 'commandes-devis'
    and (
      public.is_admin()
      or exists (
        select 1 from public.user_permissions p
        where p.user_id = auth.uid()
          and p.type = 'commande_edit'
      )
    )
  );
