-- ============================================================
-- MBA Groupe SA — Supabase Schema
-- Run this in Supabase → SQL Editor
-- ============================================================

-- 1. MORTGAGES TABLE
create table if not exists public.mortgages (
  id                    text primary key,
  label                 text not null,
  company               text not null,
  total_amount          numeric not null,
  start_date            date not null,
  end_date              date not null,
  rate_type             text not null check (rate_type in ('fixed', 'saron')),
  rate                  numeric not null,
  annual_amortization   numeric not null default 0,
  quarterly_amortization numeric not null default 0,
  remaining_at_end      numeric not null default 0,
  remaining_today       numeric not null default 0,
  property_value        numeric,
  property_group        text,
  shared                boolean default false,
  monthly_rent          numeric default 0,
  created_at            timestamptz default now()
);

-- 2. USER PROFILES TABLE
create table if not exists public.user_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  role         text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at   timestamptz default now()
);

-- 3. USER PERMISSIONS TABLE
create table if not exists public.user_permissions (
  id        bigserial primary key,
  user_id   uuid not null references public.user_profiles(id) on delete cascade,
  type      text not null check (type in ('all', 'company', 'mortgage')),
  value     text,  -- null for 'all', company name for 'company', mortgage id for 'mortgage'
  created_at timestamptz default now()
);

-- 4. AUTO-CREATE PROFILE ON SIGNUP
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_role text;
begin
  -- First user ever becomes admin
  if (select count(*) from public.user_profiles) = 0 then
    v_role := 'admin';
  else
    v_role := 'viewer';
  end if;
  insert into public.user_profiles (id, email, role)
  values (new.id, new.email, v_role);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. HELPER FUNCTION FOR RLS
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

-- 6. ENABLE RLS
alter table public.mortgages enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_permissions enable row level security;

-- 7. RLS POLICIES — MORTGAGES
-- Admins see all
create policy "admins_all_mortgages" on public.mortgages
  for all using (public.is_admin());

-- Viewers see only permitted mortgages
create policy "viewers_permitted_mortgages" on public.mortgages
  for select using (
    exists (
      select 1 from public.user_permissions p
      where p.user_id = auth.uid() and (
        p.type = 'all'
        or (p.type = 'company' and p.value = mortgages.company)
        or (p.type = 'mortgage' and p.value = mortgages.id)
      )
    )
  );

-- 8. RLS POLICIES — USER PROFILES
create policy "users_see_own_profile" on public.user_profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "admins_manage_profiles" on public.user_profiles
  for all using (public.is_admin());

-- 9. RLS POLICIES — USER PERMISSIONS
create policy "admins_manage_permissions" on public.user_permissions
  for all using (public.is_admin());

create policy "users_see_own_permissions" on public.user_permissions
  for select using (user_id = auth.uid());
