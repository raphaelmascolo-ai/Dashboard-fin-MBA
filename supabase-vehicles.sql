create table if not exists public.vehicles (
  id                    text primary key,
  type                  text not null check (type in ('VHC Exploit', 'VHC Admin', 'Machines')),
  brand                 text not null,
  plate                 text,
  year                  integer not null default 0,
  notes                 text not null default '',
  last_expertise        date,
  last_service          date,
  purchase_price        numeric not null default 0,
  company               text not null default '',
  billed_to_mbas        numeric not null default 0,
  leasing_monthly       numeric not null default 0,
  leasing_number        text,
  leasing_end           date,
  insurance_monthly     numeric not null default 0,
  resale_monthly        numeric not null default 0,
  refacturing_rate      numeric not null default 0,
  refacturing_unit      text not null default '' check (refacturing_unit in ('mois', 'jours', '')),
  refacturing_to        text not null default '',
  created_at            timestamptz default now()
);

alter table public.vehicles enable row level security;

-- Admins can do everything
create policy "admins_all_vehicles" on public.vehicles
  for all using (public.is_admin());

-- Viewers can read all vehicles (no per-vehicle permission needed for now)
create policy "viewers_read_vehicles" on public.vehicles
  for select using (auth.uid() is not null);
